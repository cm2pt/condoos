import crypto from "node:crypto";
import express from "express";
import { authorize } from "../../auth.js";
import { getKnex } from "../../db-knex.js";
import { recordAuditLog } from "../../audit.js";
import {
  CHARGE_STATUS_VALUES,
  toNumber,
  toIsoDate,
  getAllowedFractionIdsForRequest,
} from "../../helpers.js";

const router = express.Router();

router.get("/finance/charges", authorize("finance", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const allowedFractionIds = await getAllowedFractionIdsForRequest(req);
  const status = String(req.query.status || "").trim();
  const period = String(req.query.period || "").trim();

  if (allowedFractionIds && allowedFractionIds.length === 0) {
    return res.json({ items: [] });
  }

  let q = knex("charges as c")
    .join("fractions as f", "f.id", "c.fraction_id")
    .where("c.tenant_id", tenantId)
    .select(
      "c.id",
      "c.tenant_id as tenantId",
      "c.fraction_id as fractionId",
      "f.code as fractionCode",
      "c.kind",
      "c.period",
      "c.due_date as dueDate",
      "c.amount",
      "c.status"
    );

  if (allowedFractionIds) {
    q = q.whereIn("c.fraction_id", allowedFractionIds);
  }

  if (status) {
    q = q.where("c.status", status);
  }

  if (period) {
    q = q.where("c.period", period);
  }

  const items = await q.orderBy("c.due_date", "asc");
  res.json({ items });
});

router.post("/finance/charges", authorize("finance", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const body = req.body || {};
  const fractionId = String(body.fractionId || "").trim();

  if (!fractionId) {
    return res.status(400).json({ error: "Campo fractionId e obrigatorio." });
  }

  const fraction = await knex("fractions")
    .where({ id: fractionId, tenant_id: tenantId })
    .select("id", "code")
    .first();
  if (!fraction) {
    return res.status(404).json({ error: "Fracao nao encontrada no condominio atual." });
  }

  const dueDate = toIsoDate(body.dueDate || new Date().toISOString());
  const nowIso = new Date().toISOString();
  const period = String(body.period || dueDate.slice(0, 7));
  const status = String(body.status || "open");
  if (!CHARGE_STATUS_VALUES.includes(status)) {
    return res.status(400).json({ error: "Status de encargo invalido." });
  }

  const charge = {
    id: `charge-${crypto.randomUUID()}`,
    tenantId,
    fractionId,
    kind: String(body.kind || "quota"),
    period,
    dueDate,
    amount: toNumber(body.amount, 0),
    status,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  if (charge.amount <= 0) {
    return res.status(400).json({ error: "Campo amount deve ser maior que 0." });
  }

  await knex("charges").insert({
    id: charge.id,
    tenant_id: charge.tenantId,
    fraction_id: charge.fractionId,
    kind: charge.kind,
    period: charge.period,
    due_date: charge.dueDate,
    amount: charge.amount,
    status: charge.status,
    created_at: charge.createdAt,
    updated_at: charge.updatedAt,
  });

  await knex("finance_ledger_entries").insert({
    id: `ledger-${crypto.randomUUID()}`,
    tenant_id: tenantId,
    fraction_id: charge.fractionId,
    charge_id: charge.id,
    payment_id: null,
    entry_type: "charge_issue",
    amount: charge.amount,
    occurred_at: charge.createdAt,
    metadata_json: JSON.stringify({
      kind: charge.kind,
      period: charge.period,
      status: charge.status,
    }),
    created_by_user_id: req.user.id,
    created_at: charge.createdAt,
  });

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "charge.create",
    entityType: "charge",
    entityId: charge.id,
    after: charge,
  });

  res.status(201).json({
    item: {
      ...charge,
      fractionCode: fraction.code,
    },
  });
});

// ── Bulk quota generation ──────────────────────────────────────────────
router.post("/finance/charges/generate-bulk", authorize("finance", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const body = req.body || {};
  const period = String(body.period || "").trim();

  if (!/^\d{4}-\d{2}$/.test(period)) {
    return res.status(400).json({ error: "Campo period deve ter formato YYYY-MM." });
  }

  const kind = String(body.kind || "quota");
  const dueDay = Math.min(Math.max(Number.parseInt(String(body.dueDay || "8"), 10), 1), 28);
  const dueDate = `${period}-${String(dueDay).padStart(2, "0")}`;
  const fractionIds = Array.isArray(body.fractionIds) ? body.fractionIds : null;

  // Fetch all active fractions (or filtered subset)
  let q = knex("fractions")
    .where({ tenant_id: tenantId, status: "active" })
    .select("id", "code", "monthly_fee_amount");

  if (fractionIds && fractionIds.length > 0) {
    q = q.whereIn("id", fractionIds);
  }

  const fractions = await q;

  if (fractions.length === 0) {
    return res.status(400).json({ error: "Nenhuma fracao ativa encontrada." });
  }

  // Check for existing charges in this period to prevent duplicates
  const existing = await knex("charges")
    .where({ tenant_id: tenantId, kind, period })
    .whereIn("fraction_id", fractions.map((f) => f.id))
    .select("fraction_id");

  const existingSet = new Set(existing.map((e) => e.fraction_id));
  const toCreate = fractions.filter((f) => !existingSet.has(f.id) && f.monthly_fee_amount > 0);

  const nowIso = new Date().toISOString();
  const created = [];

  await knex.transaction(async (trx) => {
    for (const fraction of toCreate) {
      const chargeId = `charge-${crypto.randomUUID()}`;
      const charge = {
        id: chargeId,
        tenant_id: tenantId,
        fraction_id: fraction.id,
        kind,
        period,
        due_date: dueDate,
        amount: fraction.monthly_fee_amount,
        status: "open",
        created_at: nowIso,
        updated_at: nowIso,
      };

      await trx("charges").insert(charge);

      await trx("finance_ledger_entries").insert({
        id: `ledger-${crypto.randomUUID()}`,
        tenant_id: tenantId,
        fraction_id: fraction.id,
        charge_id: chargeId,
        payment_id: null,
        entry_type: "charge_issue",
        amount: fraction.monthly_fee_amount,
        occurred_at: nowIso,
        metadata_json: JSON.stringify({ kind, period, status: "open", bulk: true }),
        created_by_user_id: req.user.id,
        created_at: nowIso,
      });

      created.push({
        id: chargeId,
        fractionId: fraction.id,
        fractionCode: fraction.code,
        amount: fraction.monthly_fee_amount,
        period,
        dueDate,
        kind,
        status: "open",
      });
    }
  });

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "charges.generate_bulk",
    entityType: "charge",
    entityId: period,
    after: { period, kind, createdCount: created.length, skippedCount: existingSet.size },
  });

  res.status(201).json({
    createdCount: created.length,
    skippedCount: existingSet.size,
    items: created,
  });
});

export default router;
