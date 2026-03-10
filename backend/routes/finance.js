import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { authorize } from "../auth.js";
import { getKnex } from "../db-knex.js";
import { recordAuditLog } from "../audit.js";
import { recalculateChargeStatus } from "../services/charge-status.js";
import { renderPaymentReceiptPdfBuffer } from "../services/pdf/receipt-template.js";
import {
  CHARGE_STATUS_VALUES,
  RECEIPT_STORAGE_DIR,
  toNumber,
  toIsoDate,
  normalizeKey,
  parseCsvText,
  sanitizeFileName,
  ensureDirectory,
  getAllowedFractionIdsForRequest,
  requireResidentFractionAccess,
  readPaymentContext,
} from "../helpers.js";

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

router.post("/finance/reconciliation/import-csv", authorize("finance", "create"), async (req, res) => {
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
  const parseNumeric = (value) => {
    let normalized = String(value || "").trim().replace(/\s+/g, "");
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
    return Number.isFinite(parsedValue) ? parsedValue : NaN;
  };

  let importedCount = 0;
  let skippedCount = 0;
  const errors = [];
  await knex.transaction(async (trx) => {
    for (let rowIndex = 0; rowIndex < parsed.rows.length; rowIndex += 1) {
      const row = parsed.rows[rowIndex];
      const bookedAtRaw = readCell(row, ["booked_at", "data", "date", "valor_data"]);
      const description = readCell(row, ["description", "descricao", "descrição", "movimento"]);
      const amountRaw = readCell(row, ["amount", "valor", "montante"]);
      const reference = readCell(row, ["reference", "referencia", "referência", "ref"]) || null;
      const amount = parseNumeric(amountRaw);
      const bookedAt = toIsoDate(bookedAtRaw || new Date().toISOString());

      if (!description || Number.isNaN(amount)) {
        errors.push({ row: rowIndex + 2, error: "Linha invalida (descricao/valor)." });
        continue;
      }

      const duplicate = await trx("bank_transactions")
        .where("tenant_id", tenantId)
        .where("booked_at", bookedAt)
        .where("description", description)
        .whereRaw("ABS(amount - ?) < 0.0001", [amount])
        .whereRaw("COALESCE(reference, '') = COALESCE(?, '')", [reference])
        .select("id")
        .first();
      if (duplicate) {
        skippedCount += 1;
        continue;
      }

      await trx("bank_transactions").insert({
        id: `bt-${crypto.randomUUID()}`,
        tenant_id: tenantId,
        booked_at: bookedAt,
        description,
        amount,
        reference,
        raw_json: JSON.stringify({
          rowNumber: rowIndex + 2,
          row,
        }),
        status: "unmatched",
        matched_payment_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      importedCount += 1;
    }
  });

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "finance.reconciliation.import_csv",
    entityType: "bank_transaction",
    metadata: {
      importedCount,
      skippedCount,
      errorCount: errors.length,
    },
  });

  return res.status(201).json({
    importedCount,
    skippedCount,
    errorCount: errors.length,
    errors,
  });
});

router.get("/finance/reconciliation/transactions", authorize("finance", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const status = String(req.query.status || "").trim().toLowerCase();
  const validStatuses = new Set(["unmatched", "matched", "ignored"]);
  const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || "200"), 10), 1), 500);

  let q = knex("bank_transactions as bt")
    .where("bt.tenant_id", tenantId)
    .select(
      "bt.id",
      "bt.tenant_id as tenantId",
      "bt.booked_at as bookedAt",
      "bt.description",
      "bt.amount",
      "bt.reference",
      "bt.status",
      "bt.matched_payment_id as matchedPaymentId",
      "bt.created_at as createdAt",
      "bt.updated_at as updatedAt"
    );

  if (status) {
    if (!validStatuses.has(status)) {
      return res.status(400).json({ error: "status invalido." });
    }
    q = q.where("bt.status", status);
  }

  const items = await q
    .orderBy("bt.booked_at", "desc")
    .orderBy("bt.created_at", "desc")
    .limit(limit);
  return res.json({ items });
});

router.post("/finance/reconciliation/auto-match", authorize("finance", "update"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const unmatchedTransactions = await knex("bank_transactions")
    .where({ tenant_id: tenantId, status: "unmatched" })
    .select(
      "id",
      "booked_at as bookedAt",
      "description",
      "amount",
      "reference"
    )
    .orderBy("booked_at", "asc")
    .orderBy("created_at", "asc");

  let matchedCount = 0;
  const skippedTransactionIds = [];

  await knex.transaction(async (trx) => {
    for (const transaction of unmatchedTransactions) {
      if (Number(transaction.amount) <= 0) {
        skippedTransactionIds.push(transaction.id);
        continue;
      }

      if (transaction.reference) {
        const existingPayment = await trx("payments")
          .where({ tenant_id: tenantId, reference: transaction.reference })
          .select("id")
          .first();

        if (existingPayment) {
          await trx("bank_transactions")
            .where({ id: transaction.id, tenant_id: tenantId })
            .update({
              status: "matched",
              matched_payment_id: existingPayment.id,
              updated_at: new Date().toISOString(),
            });
          matchedCount += 1;
          continue;
        }
      }

      const candidateCharge = await trx.raw(`
        SELECT c.id, c.fraction_id AS fractionId, c.amount, c.due_date AS dueDate
        FROM charges c
        LEFT JOIN (
          SELECT charge_id, SUM(amount) AS paidAmount
          FROM payments
          WHERE tenant_id = ?
          GROUP BY charge_id
        ) cp ON cp.charge_id = c.id
        WHERE c.tenant_id = ?
          AND c.status IN ('open', 'partially_paid', 'overdue')
          AND ABS((c.amount - COALESCE(cp.paidAmount, 0)) - ?) < 0.02
        ORDER BY c.due_date ASC
        LIMIT 1
      `, [tenantId, tenantId, Number(transaction.amount)]);
      const candidate = candidateCharge?.rows?.[0] ?? candidateCharge?.[0];

      if (!candidate) {
        skippedTransactionIds.push(transaction.id);
        continue;
      }

      const paymentId = `pay-${crypto.randomUUID()}`;
      const payment = {
        id: paymentId,
        tenantId,
        fractionId: candidate.fractionId,
        chargeId: candidate.id,
        method: "bank_transfer",
        amount: Number(transaction.amount),
        paidAt: toIsoDate(transaction.bookedAt),
        reference: transaction.reference || `reconc-${transaction.id}`,
        source: "imported",
      };

      await trx("payments").insert({
        id: payment.id,
        tenant_id: payment.tenantId,
        fraction_id: payment.fractionId,
        charge_id: payment.chargeId,
        method: payment.method,
        amount: payment.amount,
        paid_at: payment.paidAt,
        reference: payment.reference,
        source: payment.source,
      });

      await trx("finance_ledger_entries").insert({
        id: `ledger-${crypto.randomUUID()}`,
        tenant_id: tenantId,
        fraction_id: payment.fractionId,
        charge_id: payment.chargeId,
        payment_id: payment.id,
        entry_type: "payment_received",
        amount: payment.amount,
        occurred_at: payment.paidAt,
        metadata_json: JSON.stringify({
          source: "reconciliation_auto",
          bankTransactionId: transaction.id,
          reference: payment.reference,
        }),
        created_by_user_id: req.user.id,
        created_at: new Date().toISOString(),
      });

      await recalculateChargeStatus(tenantId, payment.chargeId, trx);
      await trx("bank_transactions")
        .where({ id: transaction.id, tenant_id: tenantId })
        .update({
          status: "matched",
          matched_payment_id: payment.id,
          updated_at: new Date().toISOString(),
        });
      matchedCount += 1;
    }
  });

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "finance.reconciliation.auto_match",
    entityType: "bank_transaction",
    metadata: {
      scannedCount: unmatchedTransactions.length,
      matchedCount,
      unmatchedCount: unmatchedTransactions.length - matchedCount,
    },
  });

  return res.json({
    scannedCount: unmatchedTransactions.length,
    matchedCount,
    unmatchedCount: unmatchedTransactions.length - matchedCount,
    skippedTransactionIds,
  });
});

// Suggest charge matches for a single unmatched bank transaction
router.get("/finance/reconciliation/suggest-matches/:transactionId", authorize("finance", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const { transactionId } = req.params;

  const transaction = await knex("bank_transactions")
    .where({ id: transactionId, tenant_id: tenantId })
    .select("id", "amount", "booked_at as bookedAt", "description", "reference")
    .first();

  if (!transaction) {
    return res.status(404).json({ error: "Transacao bancaria nao encontrada." });
  }

  const txAmount = Number(transaction.amount);
  if (txAmount <= 0) {
    return res.json({ suggestions: [] });
  }

  // Find open charges with remaining balance close to transaction amount
  const candidates = await knex.raw(`
    SELECT
      c.id,
      c.fraction_id AS "fractionId",
      c.period,
      c.kind,
      c.amount AS "chargeAmount",
      c.due_date AS "dueDate",
      c.status,
      COALESCE(cp.paidAmount, 0) AS "paidAmount",
      (c.amount - COALESCE(cp.paidAmount, 0)) AS "remainingAmount",
      f.code AS "fractionCode"
    FROM charges c
    LEFT JOIN (
      SELECT charge_id, SUM(amount) AS "paidAmount"
      FROM payments
      WHERE tenant_id = ?
      GROUP BY charge_id
    ) cp ON cp.charge_id = c.id
    LEFT JOIN fractions f ON f.id = c.fraction_id AND f.tenant_id = c.tenant_id
    WHERE c.tenant_id = ?
      AND c.status IN ('open', 'partially_paid', 'overdue')
      AND ABS((c.amount - COALESCE(cp.paidAmount, 0)) - ?) < ?
    ORDER BY
      ABS((c.amount - COALESCE(cp.paidAmount, 0)) - ?) ASC,
      ABS(JULIANDAY(c.due_date) - JULIANDAY(?)) ASC
    LIMIT 10
  `, [tenantId, tenantId, txAmount, txAmount * 0.1 + 1, txAmount, transaction.bookedAt]);

  const rows = candidates?.rows ?? candidates ?? [];

  // Score each candidate
  const suggestions = rows.map((c) => {
    const remaining = Number(c.remainingAmount);
    const amountDiff = Math.abs(remaining - txAmount);
    const amountScore = amountDiff < 0.01 ? 100 : amountDiff < 1 ? 80 : amountDiff < 5 ? 50 : 20;

    const dueDate = new Date(c.dueDate);
    const txDate = new Date(transaction.bookedAt);
    const daysDiff = Math.abs((txDate - dueDate) / (1000 * 60 * 60 * 24));
    const dateScore = daysDiff < 7 ? 100 : daysDiff < 30 ? 70 : daysDiff < 90 ? 40 : 10;

    const refScore = transaction.reference && c.fractionCode
      && transaction.reference.toLowerCase().includes(c.fractionCode.toLowerCase()) ? 50 : 0;

    const confidence = Math.round((amountScore * 0.5 + dateScore * 0.3 + refScore * 0.2));
    return {
      chargeId: c.id,
      fractionId: c.fractionId,
      fractionCode: c.fractionCode,
      period: c.period,
      kind: c.kind,
      chargeAmount: c.chargeAmount,
      remainingAmount: remaining,
      dueDate: c.dueDate,
      confidence,
      amountDiff: Number(amountDiff.toFixed(2)),
    };
  }).sort((a, b) => b.confidence - a.confidence);

  return res.json({ transaction, suggestions });
});

// Manual match or ignore a bank transaction
router.post("/finance/reconciliation/manual-match", authorize("finance", "update"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const { transactionId, chargeId, action } = req.body || {};

  if (!transactionId) {
    return res.status(400).json({ error: "transactionId obrigatorio." });
  }

  const transaction = await knex("bank_transactions")
    .where({ id: transactionId, tenant_id: tenantId, status: "unmatched" })
    .select("id", "amount", "booked_at as bookedAt", "description", "reference")
    .first();

  if (!transaction) {
    return res.status(404).json({ error: "Transacao nao encontrada ou ja processada." });
  }

  if (action === "ignore") {
    await knex("bank_transactions")
      .where({ id: transactionId, tenant_id: tenantId })
      .update({ status: "ignored", updated_at: new Date().toISOString() });

    await recordAuditLog({
      tenantId,
      actorUserId: req.user.id,
      action: "finance.reconciliation.manual_ignore",
      entityType: "bank_transaction",
      entityId: transactionId,
    });
    return res.json({ status: "ignored", transactionId });
  }

  if (!chargeId) {
    return res.status(400).json({ error: "chargeId obrigatorio para match manual." });
  }

  const charge = await knex("charges")
    .where({ id: chargeId, tenant_id: tenantId })
    .select("id", "fraction_id as fractionId", "status")
    .first();

  if (!charge) {
    return res.status(404).json({ error: "Encargo nao encontrado." });
  }

  const now = new Date().toISOString();
  const paymentId = `pay-${crypto.randomUUID()}`;

  await knex.transaction(async (trx) => {
    await trx("payments").insert({
      id: paymentId,
      tenant_id: tenantId,
      fraction_id: charge.fractionId,
      charge_id: chargeId,
      method: "bank_transfer",
      amount: Number(transaction.amount),
      paid_at: toIsoDate(transaction.bookedAt),
      reference: transaction.reference || `manual-${transactionId}`,
      source: "imported",
      created_at: now,
    });

    await trx("finance_ledger_entries").insert({
      id: `ledger-${crypto.randomUUID()}`,
      tenant_id: tenantId,
      fraction_id: charge.fractionId,
      charge_id: chargeId,
      payment_id: paymentId,
      entry_type: "payment_received",
      amount: Number(transaction.amount),
      occurred_at: toIsoDate(transaction.bookedAt),
      metadata_json: JSON.stringify({
        source: "reconciliation_manual",
        bankTransactionId: transactionId,
      }),
      created_by_user_id: req.user.id,
      created_at: now,
    });

    await recalculateChargeStatus(tenantId, chargeId, trx);

    await trx("bank_transactions")
      .where({ id: transactionId, tenant_id: tenantId })
      .update({
        status: "matched",
        matched_payment_id: paymentId,
        updated_at: now,
      });
  });

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "finance.reconciliation.manual_match",
    entityType: "bank_transaction",
    entityId: transactionId,
    metadata: { chargeId, paymentId },
  });

  return res.json({ status: "matched", transactionId, paymentId, chargeId });
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
