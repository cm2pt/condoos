import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { authorize } from "../../auth.js";
import { getKnex } from "../../db-knex.js";
import { recordAuditLog } from "../../audit.js";
import { recalculateChargeStatus } from "../../services/charge-status.js";
import { renderPaymentReceiptPdfBuffer } from "../../services/pdf/receipt-template.js";
import {
  RECEIPT_STORAGE_DIR,
  toNumber,
  toIsoDate,
  sanitizeFileName,
  ensureDirectory,
  getAllowedFractionIdsForRequest,
  requireResidentFractionAccess,
  readPaymentContext,
} from "../../helpers.js";

const router = express.Router();

// ── Local helper: getOrCreatePaymentReceipt ───────────────────────────────────

async function getOrCreatePaymentReceipt({
  tenantId,
  paymentId,
  actorUserId,
  forceRegenerate = false,
}) {
  const knex = getKnex();
  const payment = await readPaymentContext(tenantId, paymentId);
  if (!payment) {
    return null;
  }

  const receiptColumns = [
    "id",
    "tenant_id as tenantId",
    "payment_id as paymentId",
    "receipt_number as receiptNumber",
    "storage_path as storagePath",
    "mime_type as mimeType",
    "file_size_bytes as fileSizeBytes",
    "checksum_sha256 as checksumSha256",
    "generated_at as generatedAt",
  ];

  const currentReceipt = await knex("finance_receipts")
    .where({ payment_id: paymentId, tenant_id: tenantId })
    .select(receiptColumns)
    .first();

  if (currentReceipt && !forceRegenerate && fs.existsSync(path.resolve(process.cwd(), currentReceipt.storagePath))) {
    return {
      ...currentReceipt,
      absolutePath: path.resolve(process.cwd(), currentReceipt.storagePath),
    };
  }

  const sequenceRow = await knex("finance_receipts")
    .where({ tenant_id: tenantId })
    .count("* as total")
    .first();
  const sequenceNumber = Number(sequenceRow?.total || 0) + 1;
  const year = String(payment.paidAt || new Date().toISOString()).slice(0, 4);
  const receiptNumber = currentReceipt?.receiptNumber || `RCP-${year}-${String(sequenceNumber).padStart(6, "0")}`;
  const generatedAt = new Date().toISOString();

  const tenantAddressParts = [payment.tenantAddress, payment.tenantPostalCode, payment.tenantCity].filter(Boolean);
  const pdfBuffer = await renderPaymentReceiptPdfBuffer({
    receiptNumber,
    generatedAt,
    tenantName: payment.tenantName || tenantId,
    tenantAddress: tenantAddressParts.join(", ") || null,
    tenantNif: payment.tenantNif || null,
    fractionCode: payment.fractionCode || payment.fractionId,
    chargePeriod: payment.chargePeriod || "-",
    chargeKind: payment.chargeKind || "quota",
    chargeDueDate: payment.chargeDueDate || "-",
    paidAt: payment.paidAt,
    method: payment.method,
    reference: payment.reference || "",
    amountFormatted: new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(Number(payment.amount || 0)),
  });

  const tenantDir = path.join(RECEIPT_STORAGE_DIR, sanitizeFileName(tenantId, "tenant"));
  ensureDirectory(tenantDir);
  const receiptFileName = `${sanitizeFileName(receiptNumber, "recibo")}.pdf`;
  const absolutePath = path.join(tenantDir, receiptFileName);
  fs.writeFileSync(absolutePath, pdfBuffer);
  const storagePath = path.relative(process.cwd(), absolutePath);
  const checksumSha256 = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

  if (currentReceipt) {
    await knex("finance_receipts").where({ id: currentReceipt.id }).update({
      storage_path: storagePath,
      mime_type: "application/pdf",
      file_size_bytes: pdfBuffer.length,
      checksum_sha256: checksumSha256,
      generated_at: generatedAt,
      created_by_user_id: actorUserId,
    });
  } else {
    await knex("finance_receipts").insert({
      id: `receipt-${crypto.randomUUID()}`,
      tenant_id: tenantId,
      payment_id: paymentId,
      receipt_number: receiptNumber,
      storage_path: storagePath,
      mime_type: "application/pdf",
      file_size_bytes: pdfBuffer.length,
      checksum_sha256: checksumSha256,
      generated_at: generatedAt,
      created_by_user_id: actorUserId,
      created_at: generatedAt,
    });
  }

  const persisted = await knex("finance_receipts")
    .where({ payment_id: paymentId, tenant_id: tenantId })
    .select(receiptColumns)
    .first();

  return {
    ...persisted,
    absolutePath: path.resolve(process.cwd(), persisted.storagePath),
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/finance/payments", authorize("finance", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const allowedFractionIds = await getAllowedFractionIdsForRequest(req);

  if (allowedFractionIds && allowedFractionIds.length === 0) {
    return res.json({ items: [] });
  }

  let q = knex("payments as p")
    .join("fractions as f", "f.id", "p.fraction_id")
    .leftJoin("finance_receipts as fr", "fr.payment_id", "p.id")
    .where("p.tenant_id", tenantId)
    .select(
      "p.id",
      "p.tenant_id as tenantId",
      "p.fraction_id as fractionId",
      "f.code as fractionCode",
      "p.charge_id as chargeId",
      "p.method",
      "p.amount",
      "p.paid_at as paidAt",
      "p.reference",
      "p.source",
      knex.raw("CASE WHEN fr.id IS NULL THEN 0 ELSE 1 END as hasReceipt")
    );

  if (allowedFractionIds) {
    q = q.whereIn("p.fraction_id", allowedFractionIds);
  }

  const items = await q.orderBy("p.paid_at", "desc");

  res.json({
    items: items.map((item) => ({
      ...item,
      hasReceipt: Number(item.hasReceipt) === 1,
    })),
  });
});

router.post("/finance/payments", authorize("finance", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const body = req.body || {};
  const chargeId = String(body.chargeId || "").trim();

  if (!chargeId) {
    return res.status(400).json({ error: "Campo chargeId e obrigatorio." });
  }

  const charge = await knex("charges")
    .where({ id: chargeId, tenant_id: tenantId })
    .select("id", "fraction_id", "amount", "status")
    .first();
  if (!charge) {
    return res.status(404).json({ error: "Encargo nao encontrado." });
  }

  const amount = toNumber(body.amount, 0);
  if (amount <= 0) {
    return res.status(400).json({ error: "Campo amount deve ser maior que 0." });
  }

  const payment = {
    id: `pay-${crypto.randomUUID()}`,
    tenantId,
    fractionId: charge.fraction_id,
    chargeId,
    method: String(body.method || "bank_transfer"),
    amount,
    paidAt: toIsoDate(body.paidAt || new Date().toISOString()),
    reference: String(body.reference || ""),
    source: String(body.source || "manual"),
  };

  await knex("payments").insert({
    id: payment.id,
    tenant_id: payment.tenantId,
    fraction_id: payment.fractionId,
    charge_id: payment.chargeId,
    method: payment.method,
    amount: payment.amount,
    paid_at: payment.paidAt,
    reference: payment.reference || null,
    source: payment.source,
  });

  await knex("finance_ledger_entries").insert({
    id: `ledger-${crypto.randomUUID()}`,
    tenant_id: tenantId,
    fraction_id: payment.fractionId,
    charge_id: payment.chargeId,
    payment_id: payment.id,
    entry_type: "payment_received",
    amount: payment.amount,
    occurred_at: payment.paidAt,
    metadata_json: JSON.stringify({
      method: payment.method,
      reference: payment.reference || null,
      source: payment.source,
    }),
    created_by_user_id: req.user.id,
    created_at: new Date().toISOString(),
  });

  const nextChargeStatus = await recalculateChargeStatus(tenantId, chargeId);

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "payment.create",
    entityType: "payment",
    entityId: payment.id,
    after: {
      ...payment,
      chargeStatusAfterPayment: nextChargeStatus,
    },
  });

  res.status(201).json({
    item: payment,
    chargeStatus: nextChargeStatus,
  });
});

router.get("/finance/payments/:paymentId/receipt", authorize("finance", "read"), async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const paymentId = String(req.params.paymentId || "").trim();
    if (!paymentId) {
      return res.status(400).json({ error: "paymentId invalido." });
    }

    const payment = await readPaymentContext(tenantId, paymentId);
    if (!payment) {
      return res.status(404).json({ error: "Pagamento nao encontrado." });
    }

    const residentScopeCheck = await requireResidentFractionAccess(req, payment.fractionId);
    if (!residentScopeCheck.ok) {
      return res.status(residentScopeCheck.status).json({ error: residentScopeCheck.error });
    }

    const receipt = await getOrCreatePaymentReceipt({
      tenantId,
      paymentId,
      actorUserId: req.user.id,
      forceRegenerate: false,
    });

    if (!receipt || !receipt.absolutePath || !fs.existsSync(receipt.absolutePath)) {
      return res.status(500).json({ error: "Nao foi possivel gerar recibo PDF." });
    }

    res.setHeader("Content-Type", receipt.mimeType || "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFileName(receipt.receiptNumber, "recibo")}.pdf"`);
    return res.status(200).send(fs.readFileSync(receipt.absolutePath));
  } catch {
    return res.status(500).json({ error: "Erro ao gerar recibo." });
  }
});

router.post("/finance/payments/:paymentId/receipt/regenerate", authorize("finance", "update"), async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const paymentId = String(req.params.paymentId || "").trim();
    if (!paymentId) {
      return res.status(400).json({ error: "paymentId invalido." });
    }

    const payment = await readPaymentContext(tenantId, paymentId);
    if (!payment) {
      return res.status(404).json({ error: "Pagamento nao encontrado." });
    }

    const receipt = await getOrCreatePaymentReceipt({
      tenantId,
      paymentId,
      actorUserId: req.user.id,
      forceRegenerate: true,
    });

    await recordAuditLog({
      tenantId,
      actorUserId: req.user.id,
      action: "payment.receipt.regenerate",
      entityType: "payment_receipt",
      entityId: paymentId,
      metadata: {
        receiptNumber: receipt?.receiptNumber || null,
      },
    });

    return res.json({
      item: {
        paymentId,
        receiptNumber: receipt?.receiptNumber,
        generatedAt: receipt?.generatedAt,
      },
    });
  } catch {
    return res.status(500).json({ error: "Erro ao regenerar recibo." });
  }
});

router.get("/finance/export/accounting.csv", authorize("finance", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const period = String(req.query.period || "").trim();

  let q = knex("finance_ledger_entries as fle")
    .leftJoin("fractions as f", "f.id", "fle.fraction_id")
    .leftJoin("charges as c", "c.id", "fle.charge_id")
    .leftJoin("payments as p", "p.id", "fle.payment_id")
    .where("fle.tenant_id", tenantId)
    .select(
      "fle.id",
      "fle.entry_type as entryType",
      "fle.occurred_at as occurredAt",
      "fle.amount",
      "f.code as fractionCode",
      "c.period as chargePeriod",
      "p.reference as paymentReference",
      "fle.metadata_json as metadataJson"
    );

  if (period) {
    q = q.where(function () {
      this.where("c.period", period)
        .orWhereRaw("SUBSTR(fle.occurred_at, 1, 7) = ?", [period]);
    });
  }

  const rows = await q.orderBy("fle.occurred_at", "asc").orderBy("fle.id", "asc");
  const header = [
    "entry_id",
    "entry_type",
    "occurred_at",
    "amount",
    "fraction_code",
    "charge_period",
    "payment_reference",
    "metadata_json",
  ];
  const csvBody = rows
    .map((row) =>
      [
        row.id,
        row.entryType,
        row.occurredAt,
        Number(row.amount || 0).toFixed(2),
        row.fractionCode || "",
        row.chargePeriod || "",
        row.paymentReference || "",
        row.metadataJson || "",
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(";")
    )
    .join("\n");
  const csv = `${header.join(";")}\n${csvBody}${csvBody ? "\n" : ""}`;

  const fileSuffix = period ? `-${sanitizeFileName(period, "periodo")}` : "";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="export-contabilistico${fileSuffix}.csv"`);
  return res.status(200).send(csv);
});

export default router;
