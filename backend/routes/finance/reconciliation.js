import crypto from "node:crypto";
import express from "express";
import { authorize } from "../../auth.js";
import { getKnex } from "../../db-knex.js";
import { recordAuditLog } from "../../audit.js";
import { recalculateChargeStatus } from "../../services/charge-status.js";
import {
  toIsoDate,
  normalizeKey,
  parseCsvText,
} from "../../helpers.js";

const router = express.Router();

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

export default router;
