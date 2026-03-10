import express from "express";
import crypto from "node:crypto";
import { authorize } from "../auth.js";
import { getKnex } from "../db-knex.js";
import { recordAuditLog } from "../audit.js";
import { normalizeEmail } from "../helpers.js";
import { generateMultibancoReference } from "../services/payments/multibanco.js";
import { sendMbWayPayment } from "../services/payments/mbway.js";
import { generateSepaDirectDebitXml } from "../services/payments/sepa.js";
import { sendNotification, sendPaymentReminders } from "../services/email/index.js";

const router = express.Router();

// ── Payment integration routes ──

router.post("/integrations/payments/mb-reference", authorize("finance", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const chargeId = String(req.body?.chargeId || "").trim();
  if (!chargeId) {
    return res.status(400).json({ error: "chargeId e obrigatorio." });
  }

  const charge = await knex("charges")
    .where({ id: chargeId, tenant_id: tenantId })
    .select("id", "amount", "due_date as dueDate")
    .first();
  if (!charge) {
    return res.status(404).json({ error: "Encargo nao encontrado." });
  }

  const existing = await knex("payment_references")
    .where({ charge_id: chargeId, method: "multibanco", status: "pending" })
    .first();
  if (existing) {
    return res.json({ item: { id: existing.id, provider: existing.provider, entity: existing.entity, reference: existing.reference, amount: existing.amount, dueDate: charge.dueDate, chargeId, status: existing.status } });
  }

  const result = await generateMultibancoReference({ chargeId, amount: charge.amount, dueDate: charge.dueDate });
  const now = new Date().toISOString();
  const refId = `pref-${crypto.randomUUID()}`;
  const expiresAt = charge.dueDate || new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  await knex("payment_references").insert({
    id: refId,
    tenant_id: tenantId,
    charge_id: chargeId,
    provider: result.provider,
    method: "multibanco",
    entity: result.entity,
    reference: result.reference,
    amount: result.amount,
    status: "pending",
    provider_transaction_id: result.requestId,
    expires_at: expiresAt,
    created_by_user_id: req.user.id,
    created_at: now,
    updated_at: now,
  });

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "integration.payments.mb_reference.create",
    entityType: "payment_reference",
    entityId: refId,
    metadata: { entity: result.entity, reference: result.reference, amount: result.amount, provider: result.provider },
  });

  return res.status(201).json({ item: { id: refId, ...result, dueDate: charge.dueDate, chargeId, status: "pending" } });
});

router.post("/integrations/payments/mbway", authorize("finance", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const chargeId = String(req.body?.chargeId || "").trim();
  const phone = String(req.body?.phone || "").trim();
  if (!chargeId || !phone) {
    return res.status(400).json({ error: "chargeId e phone sao obrigatorios." });
  }

  const charge = await knex("charges")
    .where({ id: chargeId, tenant_id: tenantId })
    .select("id", "amount")
    .first();
  if (!charge) {
    return res.status(404).json({ error: "Encargo nao encontrado." });
  }

  const result = await sendMbWayPayment({ chargeId, amount: charge.amount, phone });
  if (result.status === "error") {
    return res.status(502).json({ error: result.errorMessage || "Erro ao enviar pedido MB Way." });
  }

  const now = new Date().toISOString();
  const refId = `pref-${crypto.randomUUID()}`;

  await knex("payment_references").insert({
    id: refId,
    tenant_id: tenantId,
    charge_id: chargeId,
    provider: result.provider,
    method: "mbway",
    phone: result.phone,
    amount: result.amount,
    status: "pending",
    provider_transaction_id: result.requestId,
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    created_by_user_id: req.user.id,
    created_at: now,
    updated_at: now,
  });

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "integration.payments.mbway.create",
    entityType: "payment_reference",
    entityId: refId,
    metadata: { phone: result.phone, amount: result.amount, provider: result.provider },
  });

  return res.status(201).json({ item: { id: refId, ...result, chargeId, status: "pending" } });
});

router.post("/integrations/payments/sepa-xml", authorize("finance", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const chargeIds = Array.isArray(req.body?.chargeIds) ? req.body.chargeIds : [];
  if (chargeIds.length === 0) {
    return res.status(400).json({ error: "chargeIds e obrigatorio (lista de encargos)." });
  }

  const charges = await knex("charges")
    .where("tenant_id", tenantId)
    .whereIn("id", chargeIds)
    .whereIn("status", ["open", "overdue", "partially_paid"])
    .select("id", "fraction_id", "amount", "due_date as dueDate");

  if (charges.length === 0) {
    return res.status(404).json({ error: "Nenhum encargo pendente encontrado." });
  }

  const fractionIds = [...new Set(charges.map((c) => c.fraction_id))];
  const parties = await knex("fraction_parties as fp")
    .join("people as p", "p.id", "fp.person_id")
    .where("fp.tenant_id", tenantId)
    .whereIn("fp.fraction_id", fractionIds)
    .where("fp.relationship", "owner")
    .where("fp.is_primary", 1)
    .whereNull("fp.end_date")
    .select("fp.fraction_id", "p.full_name as debtorName", "p.iban as debtorIBAN", "p.bic as debtorBIC");

  const partyByFraction = new Map(parties.map((p) => [p.fraction_id, p]));
  const payments = [];

  for (const charge of charges) {
    const party = partyByFraction.get(charge.fraction_id);
    if (!party?.debtorIBAN) continue;

    payments.push({
      mandateId: `MANDATE-${charge.fraction_id}`,
      debtorName: party.debtorName,
      debtorIBAN: party.debtorIBAN,
      debtorBIC: party.debtorBIC || "",
      amount: charge.amount,
      reference: charge.id,
      dueDate: charge.dueDate || new Date().toISOString().slice(0, 10),
    });
  }

  if (payments.length === 0) {
    return res.status(400).json({ error: "Nenhum proprietario com IBAN encontrado para os encargos." });
  }

  const tenant = await knex("tenants").where({ id: tenantId }).first();
  const xml = generateSepaDirectDebitXml({
    creditorName: tenant?.name || "Condoos",
    creditorIBAN: tenant?.iban || process.env.SEPA_CREDITOR_IBAN || "",
    creditorBIC: tenant?.bic || process.env.SEPA_CREDITOR_BIC || "",
    creditorId: tenant?.sepa_creditor_id || process.env.SEPA_CREDITOR_ID || "",
    payments,
  });

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "integration.payments.sepa_xml.export",
    entityType: "charges",
    metadata: { chargeCount: charges.length, paymentCount: payments.length },
  });

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="sepa-dd-${tenantId}-${Date.now()}.xml"`);
  return res.status(200).send(xml);
});

router.get("/integrations/payments/references", authorize("finance", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const chargeId = String(req.query.chargeId || "").trim();
  const status = String(req.query.status || "").trim();

  let q = knex("payment_references")
    .where("tenant_id", tenantId)
    .select(
      "id", "tenant_id as tenantId", "charge_id as chargeId", "provider", "method",
      "entity", "reference", "phone", "amount", "status",
      "provider_transaction_id as providerTransactionId",
      "expires_at as expiresAt", "paid_at as paidAt",
      "created_at as createdAt"
    )
    .orderBy("created_at", "desc");

  if (chargeId) q = q.where("charge_id", chargeId);
  if (status) q = q.where("status", status);

  const items = await q;
  return res.json({ items });
});

// ── Email notification routes ──

router.post("/integrations/communications/email", authorize("documents", "create"), async (req, res) => {
  const tenantId = req.tenant.id;
  const template = String(req.body?.template || "").trim();
  const recipientEmail = normalizeEmail(req.body?.recipientEmail || req.body?.email);
  const recipientName = String(req.body?.recipientName || "").trim();
  const data = req.body?.data || {};

  // Legacy freeform email support
  if (!template && req.body?.recipients) {
    const recipients = Array.isArray(req.body.recipients) ? req.body.recipients.map((item) => normalizeEmail(item)).filter(Boolean) : [];
    const subject = String(req.body?.subject || "").trim();
    const bodyText = String(req.body?.body || "").trim();

    if (recipients.length === 0 || !subject || !bodyText) {
      return res.status(400).json({ error: "recipients, subject e body sao obrigatorios." });
    }

    const results = [];
    for (const email of recipients) {
      const result = await sendNotification({
        tenantId,
        template: "welcome",
        recipientEmail: email,
        data: { ...data, condominiumName: req.tenant.name },
      });
      results.push(result);
    }

    await recordAuditLog({
      tenantId,
      actorUserId: req.user.id,
      action: "integration.communications.email.send",
      entityType: "email_log",
      metadata: { recipientCount: recipients.length, subject },
    });

    return res.status(202).json({ items: results });
  }

  if (!recipientEmail) {
    return res.status(400).json({ error: "recipientEmail e obrigatorio." });
  }
  if (!template) {
    return res.status(400).json({ error: "template e obrigatorio." });
  }

  const result = await sendNotification({
    tenantId,
    template,
    recipientEmail,
    recipientName,
    data: { ...data, condominiumName: req.tenant.name },
  });

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "integration.communications.email.send",
    entityType: "email_log",
    entityId: result.id,
    metadata: { template, recipientEmail },
  });

  return res.status(202).json({ item: result });
});

router.post("/integrations/communications/payment-reminders", authorize("finance", "create"), async (req, res) => {
  const tenantId = req.tenant.id;
  const daysBeforeDue = Number(req.body?.daysBeforeDue) || 7;

  const result = await sendPaymentReminders({ tenantId, daysBeforeDue });

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "integration.communications.payment_reminders.send",
    entityType: "email_log",
    metadata: { daysBeforeDue, ...result },
  });

  return res.json(result);
});

router.get("/integrations/communications/email-log", authorize("documents", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const status = String(req.query.status || "").trim();

  let q = knex("email_log")
    .where("tenant_id", tenantId)
    .select("id", "template", "recipient_email as recipientEmail", "recipient_name as recipientName",
      "subject", "status", "error_message as errorMessage", "sent_at as sentAt", "created_at as createdAt")
    .orderBy("created_at", "desc")
    .limit(100);

  if (status) q = q.where("status", status);

  const items = await q;
  return res.json({ items });
});

export default router;
