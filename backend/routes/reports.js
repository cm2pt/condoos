import express from "express";
import { authorize } from "../auth.js";
import { getKnex } from "../db-knex.js";
import { getAllowedFractionIdsForRequest, requireResidentFractionAccess } from "../helpers.js";
import { renderStatementPdfBuffer } from "../services/pdf/statement-template.js";

const router = express.Router();

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatEur(value) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatDatePt(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  return d.toLocaleDateString("pt-PT");
}

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// ── GET /reports/annual-summary ────────────────────────────────────────────────

router.get("/reports/annual-summary", authorize("reports", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const year = Number(req.query.year) || new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  // Charges grouped by month
  const charges = await knex("charges")
    .where("tenant_id", tenantId)
    .whereBetween("due_date", [yearStart, yearEnd])
    .select(
      knex.raw("substr(due_date, 1, 7) as month"),
      knex.raw("sum(amount) as emitted")
    )
    .groupBy("month")
    .orderBy("month", "asc");

  // Payments grouped by month
  const payments = await knex("payments")
    .where("tenant_id", tenantId)
    .whereBetween("paid_at", [yearStart, yearEnd])
    .select(
      knex.raw("substr(paid_at, 1, 7) as month"),
      knex.raw("sum(amount) as collected")
    )
    .groupBy("month")
    .orderBy("month", "asc");

  const chargesByMonth = Object.fromEntries(charges.map((r) => [r.month, Number(r.emitted)]));
  const paymentsByMonth = Object.fromEntries(payments.map((r) => [r.month, Number(r.collected)]));

  const months = [];
  let totalEmitted = 0;
  let totalCollected = 0;

  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    const emitted = chargesByMonth[key] || 0;
    const collected = paymentsByMonth[key] || 0;
    const rate = emitted > 0 ? collected / emitted : 0;
    months.push({ month: key, label: MONTH_LABELS[m - 1], emitted, collected, rate });
    totalEmitted += emitted;
    totalCollected += collected;
  }

  const totalRate = totalEmitted > 0 ? totalCollected / totalEmitted : 0;

  res.json({
    year,
    months,
    totals: {
      emitted: totalEmitted,
      collected: totalCollected,
      rate: totalRate,
    },
  });
});

// ── GET /reports/annual-summary/export ─────────────────────────────────────────

router.get("/reports/annual-summary/export", authorize("reports", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const year = Number(req.query.year) || new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const charges = await knex("charges")
    .where("tenant_id", tenantId)
    .whereBetween("due_date", [yearStart, yearEnd])
    .select(knex.raw("substr(due_date, 1, 7) as month"), knex.raw("sum(amount) as emitted"))
    .groupBy("month");

  const payments = await knex("payments")
    .where("tenant_id", tenantId)
    .whereBetween("paid_at", [yearStart, yearEnd])
    .select(knex.raw("substr(paid_at, 1, 7) as month"), knex.raw("sum(amount) as collected"))
    .groupBy("month");

  const chargesByMonth = Object.fromEntries(charges.map((r) => [r.month, Number(r.emitted)]));
  const paymentsByMonth = Object.fromEntries(payments.map((r) => [r.month, Number(r.collected)]));

  const csvRows = ["Periodo;Emitido;Cobrado;Taxa de Cobranca"];
  let totalEmitted = 0;
  let totalCollected = 0;

  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    const emitted = chargesByMonth[key] || 0;
    const collected = paymentsByMonth[key] || 0;
    const rate = emitted > 0 ? collected / emitted : 0;
    csvRows.push(`${MONTH_LABELS[m - 1]} ${year};${formatEur(emitted)};${formatEur(emitted ? collected : 0)};${formatPercent(rate)}`);
    totalEmitted += emitted;
    totalCollected += collected;
  }

  const totalRate = totalEmitted > 0 ? totalCollected / totalEmitted : 0;
  csvRows.push(`Total;${formatEur(totalEmitted)};${formatEur(totalCollected)};${formatPercent(totalRate)}`);

  const csvContent = csvRows.join("\n");
  const filename = `resumo-anual-${year}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send("\uFEFF" + csvContent);
});

// ── GET /reports/owner-statement ───────────────────────────────────────────────

router.get("/reports/owner-statement", authorize("reports", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const fractionId = String(req.query.fractionId || "").trim();
  const year = Number(req.query.year) || new Date().getFullYear();

  if (!fractionId) {
    return res.status(400).json({ error: "Campo fractionId e obrigatorio." });
  }

  // Fraction scope check for residents
  const access = await requireResidentFractionAccess(req, fractionId);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error });
  }

  const fraction = await knex("fractions")
    .where({ id: fractionId, tenant_id: tenantId })
    .select("id", "code")
    .first();

  if (!fraction) {
    return res.status(404).json({ error: "Fracao nao encontrada no condominio atual." });
  }

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const charges = await knex("charges")
    .where({ tenant_id: tenantId, fraction_id: fractionId })
    .whereBetween("due_date", [yearStart, yearEnd])
    .select("id", "kind", "period", "due_date as date", "amount", "status")
    .orderBy("due_date", "asc");

  const payments = await knex("payments")
    .where({ tenant_id: tenantId, fraction_id: fractionId })
    .whereBetween("paid_at", [yearStart, yearEnd])
    .select("id", "charge_id as chargeId", "method", "paid_at as date", "amount", "reference")
    .orderBy("paid_at", "asc");

  // Build combined rows sorted by date
  const rows = [];

  for (const charge of charges) {
    rows.push({
      date: charge.date,
      type: "Encargo",
      description: `${charge.kind || "quota"} - ${charge.period || ""}`.trim(),
      amount: Number(charge.amount),
      sign: 1, // positive = owed
    });
  }

  for (const payment of payments) {
    rows.push({
      date: payment.date,
      type: "Pagamento",
      description: `${payment.method || ""} ${payment.reference ? "Ref. " + payment.reference : ""}`.trim(),
      amount: Number(payment.amount),
      sign: -1, // negative = paid
    });
  }

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // Compute running balance
  let balance = 0;
  const rowsWithBalance = rows.map((row) => {
    balance += row.amount * row.sign;
    return {
      date: row.date,
      type: row.type,
      description: row.description,
      amount: row.amount,
      balance,
    };
  });

  const totalCharges = charges.reduce((sum, c) => sum + Number(c.amount), 0);
  const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  res.json({
    year,
    fractionId,
    fractionCode: fraction.code,
    rows: rowsWithBalance,
    totalCharges,
    totalPayments,
    finalBalance: balance,
  });
});

// ── GET /reports/owner-statement/export ────────────────────────────────────────

router.get("/reports/owner-statement/export", authorize("reports", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const fractionId = String(req.query.fractionId || "").trim();
  const year = Number(req.query.year) || new Date().getFullYear();
  const format = String(req.query.format || "csv").trim().toLowerCase();

  if (!fractionId) {
    return res.status(400).json({ error: "Campo fractionId e obrigatorio." });
  }

  const access = await requireResidentFractionAccess(req, fractionId);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error });
  }

  const fraction = await knex("fractions")
    .where({ id: fractionId, tenant_id: tenantId })
    .select("id", "code")
    .first();

  if (!fraction) {
    return res.status(404).json({ error: "Fracao nao encontrada no condominio atual." });
  }

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const charges = await knex("charges")
    .where({ tenant_id: tenantId, fraction_id: fractionId })
    .whereBetween("due_date", [yearStart, yearEnd])
    .select("id", "kind", "period", "due_date as date", "amount", "status")
    .orderBy("due_date", "asc");

  const payments = await knex("payments")
    .where({ tenant_id: tenantId, fraction_id: fractionId })
    .whereBetween("paid_at", [yearStart, yearEnd])
    .select("id", "charge_id as chargeId", "method", "paid_at as date", "amount", "reference")
    .orderBy("paid_at", "asc");

  // Build combined rows sorted by date
  const combined = [];
  for (const charge of charges) {
    combined.push({
      date: charge.date,
      type: "Encargo",
      description: `${charge.kind || "quota"} - ${charge.period || ""}`.trim(),
      amount: Number(charge.amount),
      sign: 1,
    });
  }
  for (const payment of payments) {
    combined.push({
      date: payment.date,
      type: "Pagamento",
      description: `${payment.method || ""} ${payment.reference ? "Ref. " + payment.reference : ""}`.trim(),
      amount: Number(payment.amount),
      sign: -1,
    });
  }
  combined.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let balance = 0;
  const rows = combined.map((row) => {
    balance += row.amount * row.sign;
    return {
      date: formatDatePt(row.date),
      type: row.type,
      description: row.description,
      amount: row.amount,
      balance,
    };
  });

  const totalCharges = charges.reduce((sum, c) => sum + Number(c.amount), 0);
  const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  if (format === "pdf") {
    const tenantRow = await knex("tenants").where({ id: tenantId }).select("name").first();
    const tenantName = tenantRow?.name || tenantId;

    const pdfBuffer = await renderStatementPdfBuffer({
      tenantName,
      fractionCode: fraction.code,
      year,
      rows,
      totalCharges,
      totalPayments,
      finalBalance: balance,
    });

    const filename = `extrato-${fraction.code}-${year}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  }

  // Default: CSV
  const csvRows = ["Data;Tipo;Descricao;Valor;Saldo"];
  for (const row of rows) {
    csvRows.push(`${row.date};${row.type};${row.description};${formatEur(row.amount)};${formatEur(row.balance)}`);
  }
  csvRows.push("");
  csvRows.push(`Total encargos;;${formatEur(totalCharges)};;`);
  csvRows.push(`Total pagamentos;;${formatEur(totalPayments)};;`);
  csvRows.push(`Saldo final;;;;${formatEur(balance)}`);

  const csvContent = csvRows.join("\n");
  const filename = `extrato-${fraction.code}-${year}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send("\uFEFF" + csvContent);
});

export default router;
