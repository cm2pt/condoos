import { Router } from "express";
import {
  toNumber,
  toIsoDate,
  toBool,
  normalizeKey,
  firstDefinedValue,
  parseCsvText,
  FRACTION_STATUS_VALUES,
  getAllowedFractionIdsForRequest,
  readFractionById,
  clearPrimaryOwnerForFraction,
  requireResidentFractionAccess,
} from "../helpers.js";
import { authorize } from "../auth.js";
import { getKnex } from "../db-knex.js";
import { recordAuditLog } from "../audit.js";
import crypto from "node:crypto";

const router = Router();

router.get("/fractions", authorize("fractions", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const allowedFractionIds = await getAllowedFractionIdsForRequest(req);
  const query = String(req.query.q || "").trim();
  const status = String(req.query.status || "").trim();
  const floor = String(req.query.floor || "").trim();

  if (allowedFractionIds && allowedFractionIds.length === 0) {
    return res.json({ items: [] });
  }

  let q = knex("fractions")
    .where("tenant_id", tenantId)
    .select(
      "id", "tenant_id as tenantId", "code", "floor_number as floorNumber",
      "type", "typology", "private_area_m2 as privateAreaM2", "permillage",
      "monthly_fee_amount as monthlyFeeAmount", "status"
    );

  if (allowedFractionIds) {
    q = q.whereIn("id", allowedFractionIds);
  }
  if (query) {
    q = q.where(function () {
      this.where("code", "like", `%${query}%`)
        .orWhere("typology", "like", `%${query}%`)
        .orWhere("type", "like", `%${query}%`);
    });
  }
  if (status) {
    q = q.where("status", status);
  }
  if (floor) {
    q = q.where("floor_number", Number.parseInt(floor, 10));
  }

  const items = await q.orderBy("floor_number", "asc").orderBy("code", "asc");
  res.json({ items });
});

router.post("/fractions", authorize("fractions", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const body = req.body || {};
  const code = String(body.code || "").trim().toUpperCase();

  if (!code) {
    return res.status(400).json({ error: "Campo code e obrigatorio." });
  }

  const existing = await knex("fractions")
    .where({ tenant_id: tenantId, code })
    .select("id")
    .first();
  if (existing) {
    return res.status(409).json({ error: "Ja existe uma fracao com este codigo." });
  }

  const nowIso = new Date().toISOString();
  const fraction = {
    id: `fraction-${crypto.randomUUID()}`,
    tenantId,
    code,
    floorNumber: Number.parseInt(body.floorNumber, 10),
    type: String(body.type || "habitacao"),
    typology: String(body.typology || "N/A"),
    privateAreaM2: toNumber(body.privateAreaM2, 0),
    permillage: toNumber(body.permillage, 0),
    monthlyFeeAmount: toNumber(body.monthlyFeeAmount, 0),
    status: String(body.status || "active"),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  if (!Number.isInteger(fraction.floorNumber)) {
    return res.status(400).json({ error: "Campo floorNumber invalido." });
  }
  if (!FRACTION_STATUS_VALUES.includes(fraction.status)) {
    return res.status(400).json({ error: "Status de fracao invalido." });
  }

  await knex("fractions").insert({
    id: fraction.id,
    tenant_id: fraction.tenantId,
    code: fraction.code,
    floor_number: fraction.floorNumber,
    type: fraction.type,
    typology: fraction.typology,
    private_area_m2: fraction.privateAreaM2,
    permillage: fraction.permillage,
    monthly_fee_amount: fraction.monthlyFeeAmount,
    status: fraction.status,
    created_at: fraction.createdAt,
    updated_at: fraction.updatedAt,
  });

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "fraction.create",
    entityType: "fraction",
    entityId: fraction.id,
    after: fraction,
  });

  return res.status(201).json({ item: fraction });
});

router.post("/fractions/import/csv", authorize("fractions", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const csvText = String(req.body?.csvText || "");
  const delimiter = String(req.body?.delimiter || "");
  const parsed = parseCsvText(csvText, delimiter);

  if (parsed.header.length === 0 || parsed.rows.length === 0) {
    return res.status(400).json({ error: "CSV vazio ou invalido." });
  }

  const indexByHeader = Object.fromEntries(parsed.header.map((column, index) => [column, index]));
  const readCell = (row, keys) => {
    for (const key of keys) {
      const index = indexByHeader[normalizeKey(key)];
      if (Number.isInteger(index) && row[index] !== undefined) {
        const value = String(row[index]).trim();
        if (value) {
          return value;
        }
      }
    }
    return "";
  };
  const parseNumeric = (value, fallback = 0) => {
    let normalized = String(value || "").trim().replace(/\s+/g, "");
    if (!normalized) {
      return fallback;
    }

    const hasComma = normalized.includes(",");
    const hasDot = normalized.includes(".");
    if (hasComma && hasDot) {
      if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
        normalized = normalized.replace(/\./g, "").replace(",", ".");
      } else {
        normalized = normalized.replace(/,/g, "");
      }
    } else if (hasComma) {
      normalized = normalized.replace(",", ".");
    }

    const parsedValue = Number(normalized);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  };

  const existingRows = await knex("fractions")
    .where("tenant_id", tenantId)
    .select("code");
  const existingCodes = new Set(
    existingRows.map((row) => String(row.code || "").toUpperCase())
  );

  const insertedIds = [];
  const errors = [];
  let skippedCount = 0;

  await knex.transaction(async (trx) => {
    for (let rowIndex = 0; rowIndex < parsed.rows.length; rowIndex += 1) {
      const row = parsed.rows[rowIndex];
      const code = readCell(row, ["code", "fracao", "fraction_code"]).toUpperCase();
      const floorRaw = readCell(row, ["floor_number", "floornumber", "piso", "floor"]);
      const type = readCell(row, ["type", "tipo"]) || "habitacao";
      const typology = readCell(row, ["typology", "tipologia"]) || "N/A";
      const privateAreaM2 = parseNumeric(readCell(row, ["private_area_m2", "privateaream2", "area_privativa_m2"]), 0);
      const permillage = parseNumeric(readCell(row, ["permillage", "permilagem"]), 0);
      const monthlyFeeAmount = parseNumeric(
        readCell(row, ["monthly_fee_amount", "monthlyfeeamount", "quota_mensal", "quotamensal", "quota"]),
        0
      );
      const status = (readCell(row, ["status", "estado"]) || "active").toLowerCase();
      const floorNumber = Number.parseInt(floorRaw, 10);

      if (!code) {
        errors.push({ row: rowIndex + 2, error: "code em falta." });
        continue;
      }
      if (!Number.isInteger(floorNumber)) {
        errors.push({ row: rowIndex + 2, code, error: "floorNumber invalido." });
        continue;
      }
      if (!FRACTION_STATUS_VALUES.includes(status)) {
        errors.push({ row: rowIndex + 2, code, error: "status invalido." });
        continue;
      }
      if (existingCodes.has(code)) {
        skippedCount += 1;
        continue;
      }

      const fractionId = `fraction-${crypto.randomUUID()}`;
      const nowIso = new Date().toISOString();
      await trx("fractions").insert({
        id: fractionId,
        tenant_id: tenantId,
        code,
        floor_number: floorNumber,
        type,
        typology,
        private_area_m2: privateAreaM2,
        permillage,
        monthly_fee_amount: monthlyFeeAmount,
        status,
        created_at: nowIso,
        updated_at: nowIso,
      });
      existingCodes.add(code);
      insertedIds.push(fractionId);
    }
  });

  if (insertedIds.length > 0) {
    await recordAuditLog({
      tenantId,
      actorUserId: req.user.id,
      action: "fraction.import.csv",
      entityType: "fraction",
      metadata: {
        insertedCount: insertedIds.length,
        skippedCount,
        errorCount: errors.length,
      },
    });
  }

  return res.status(201).json({
    insertedCount: insertedIds.length,
    skippedCount,
    errorCount: errors.length,
    errors,
    insertedIds,
  });
});

router.get("/fractions/:fractionId/profile", authorize("fractions", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const fractionId = String(req.params.fractionId || "").trim();

  if (!fractionId) {
    return res.status(400).json({ error: "fractionId invalido." });
  }

  const residentScopeCheck = await requireResidentFractionAccess(req, fractionId);
  if (!residentScopeCheck.ok) {
    return res.status(residentScopeCheck.status).json({ error: residentScopeCheck.error });
  }

  const fraction = await readFractionById(tenantId, fractionId);
  if (!fraction) {
    return res.status(404).json({ error: "Fracao nao encontrada." });
  }

  const contactsRaw = await knex("fraction_parties as fp")
    .join("people as p", "p.id", "fp.person_id")
    .where("fp.tenant_id", tenantId)
    .where("fp.fraction_id", fractionId)
    .select(
      "fp.id",
      "fp.tenant_id as tenantId",
      "fp.fraction_id as fractionId",
      "fp.person_id as personId",
      "fp.relationship",
      "fp.start_date as startDate",
      "fp.end_date as endDate",
      "fp.is_primary as isPrimary",
      "p.full_name as fullName",
      "p.role_type as roleType",
      "p.email",
      "p.phone"
    )
    .orderBy([
      { column: "fp.is_primary", order: "desc" },
      { column: "fp.relationship", order: "asc" },
      { column: "p.full_name", order: "asc" },
    ]);
  const contacts = contactsRaw.map((item) => ({
    ...item,
    isPrimary: Number(item.isPrimary) === 1,
  }));

  const charges = await knex("charges")
    .where({ tenant_id: tenantId, fraction_id: fractionId })
    .select(
      "id",
      "tenant_id as tenantId",
      "fraction_id as fractionId",
      "kind",
      "period",
      "due_date as dueDate",
      "amount",
      "status"
    )
    .orderBy("due_date", "desc")
    .limit(12);

  const payments = await knex("payments")
    .where({ tenant_id: tenantId, fraction_id: fractionId })
    .select(
      "id",
      "tenant_id as tenantId",
      "fraction_id as fractionId",
      "charge_id as chargeId",
      "method",
      "amount",
      "paid_at as paidAt",
      "reference",
      "source"
    )
    .orderBy("paid_at", "desc")
    .limit(12);

  const emittedRow = await knex("charges")
    .where({ tenant_id: tenantId, fraction_id: fractionId })
    .sum("amount as emitted")
    .first();
  const collectedRow = await knex("payments")
    .where({ tenant_id: tenantId, fraction_id: fractionId })
    .sum("amount as collected")
    .first();
  const summary = {
    emitted: toNumber(emittedRow?.emitted, 0),
    collected: toNumber(collectedRow?.collected, 0),
  };

  const emitted = summary.emitted;
  const collected = summary.collected;
  const balance = Math.max(emitted - collected, 0);

  const chargeHistory = charges.map((item) => ({
    id: `charge-${item.id}`,
    kind: "charge",
    when: item.dueDate,
    amount: Number(item.amount),
    status: item.status,
    reference: item.period,
  }));
  const paymentHistory = payments.map((item) => ({
    id: `payment-${item.id}`,
    kind: "payment",
    when: item.paidAt,
    amount: Number(item.amount),
    status: "paid",
    reference: item.reference || item.method,
  }));
  const history = [...chargeHistory, ...paymentHistory]
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
    .slice(0, 20);

  return res.json({
    item: {
      ...fraction,
      monthlyFeeAmount: Number(fraction.monthlyFeeAmount),
      contacts,
      summary: {
        emitted,
        collected,
        balance,
      },
      recentCharges: charges.map((item) => ({
        ...item,
        amount: Number(item.amount),
      })),
      recentPayments: payments.map((item) => ({
        ...item,
        amount: Number(item.amount),
      })),
      history,
    },
  });
});

router.patch("/fractions/:fractionId", authorize("fractions", "update"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const fractionId = String(req.params.fractionId || "").trim();
  const body = req.body || {};

  const current = await readFractionById(tenantId, fractionId);
  if (!current) {
    return res.status(404).json({ error: "Fracao nao encontrada." });
  }

  const next = {
    ...current,
    code: firstDefinedValue([body.code, current.code]),
    floorNumber: Number.parseInt(String(firstDefinedValue([body.floorNumber, current.floorNumber])), 10),
    type: firstDefinedValue([body.type, current.type]),
    typology: firstDefinedValue([body.typology, current.typology]),
    privateAreaM2: toNumber(firstDefinedValue([body.privateAreaM2, current.privateAreaM2]), 0),
    permillage: toNumber(firstDefinedValue([body.permillage, current.permillage]), 0),
    monthlyFeeAmount: toNumber(firstDefinedValue([body.monthlyFeeAmount, current.monthlyFeeAmount]), 0),
    status: String(firstDefinedValue([body.status, current.status]) || "").trim().toLowerCase(),
    updatedAt: new Date().toISOString(),
  };

  if (!next.code || !Number.isInteger(next.floorNumber)) {
    return res.status(400).json({ error: "Dados da fracao invalidos." });
  }
  if (!FRACTION_STATUS_VALUES.includes(next.status)) {
    return res.status(400).json({ error: "Status de fracao invalido." });
  }

  const duplicated = await knex("fractions")
    .where("tenant_id", tenantId)
    .where("code", String(next.code).trim().toUpperCase())
    .whereNot("id", fractionId)
    .select("id")
    .first();
  if (duplicated) {
    return res.status(409).json({ error: "Ja existe uma fracao com este codigo." });
  }

  await knex("fractions")
    .where({ id: fractionId, tenant_id: tenantId })
    .update({
      code: String(next.code).trim().toUpperCase(),
      floor_number: next.floorNumber,
      type: String(next.type || "habitacao"),
      typology: String(next.typology || "N/A"),
      private_area_m2: next.privateAreaM2,
      permillage: next.permillage,
      monthly_fee_amount: next.monthlyFeeAmount,
      status: next.status,
      updated_at: next.updatedAt,
    });

  const updated = await readFractionById(tenantId, fractionId);
  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "fraction.update",
    entityType: "fraction",
    entityId: fractionId,
    before: current,
    after: updated,
  });

  return res.json({ item: updated });
});

router.delete("/fractions/:fractionId", authorize("fractions", "delete"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const fractionId = String(req.params.fractionId || "").trim();
  const current = await readFractionById(tenantId, fractionId);

  if (!current) {
    return res.status(404).json({ error: "Fracao nao encontrada." });
  }

  const chargeCount = await knex("charges").where({ tenant_id: tenantId, fraction_id: fractionId }).count("* as cnt").first();
  const paymentCount = await knex("payments").where({ tenant_id: tenantId, fraction_id: fractionId }).count("* as cnt").first();
  const issueCount = await knex("issues").where({ tenant_id: tenantId, fraction_id: fractionId }).count("* as cnt").first();
  const partyCount = await knex("fraction_parties").where({ tenant_id: tenantId, fraction_id: fractionId }).count("* as cnt").first();

  if (
    Number(chargeCount?.cnt || 0) > 0 ||
    Number(paymentCount?.cnt || 0) > 0 ||
    Number(issueCount?.cnt || 0) > 0 ||
    Number(partyCount?.cnt || 0) > 0
  ) {
    return res.status(409).json({
      error: "Fracao com historico associado. Marque como inativa para preservar auditoria.",
    });
  }

  await knex("fractions").where({ id: fractionId, tenant_id: tenantId }).del();

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "fraction.delete",
    entityType: "fraction",
    entityId: fractionId,
    before: current,
  });

  return res.status(204).send();
});

export default router;
