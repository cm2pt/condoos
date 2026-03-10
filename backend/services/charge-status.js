import { getKnex } from "../db-knex.js";

/**
 * Recalculate charge status based on payments.
 * @param {string} tenantId
 * @param {string} chargeId
 * @param {import('knex').Knex} [db] - Optional transaction or knex instance
 * @returns {Promise<string|null>} New status or null if charge not found
 */
export async function recalculateChargeStatus(tenantId, chargeId, db = null) {
  const knex = db || getKnex();
  const charge = await knex("charges")
    .where({ id: chargeId, tenant_id: tenantId })
    .select("id", "amount", "due_date")
    .first();

  if (!charge) {
    return null;
  }

  const paymentSummary = await knex("payments")
    .where({ charge_id: chargeId, tenant_id: tenantId })
    .sum("amount as total_paid")
    .first();

  const amount = Number(charge.amount);
  const totalPaid = Number(paymentSummary?.total_paid || 0);
  const today = new Date().toISOString().slice(0, 10);

  let nextStatus = "open";
  if (totalPaid >= amount - 0.009) {
    nextStatus = "paid";
  } else if (totalPaid > 0) {
    nextStatus = "partially_paid";
  } else if (charge.due_date < today) {
    nextStatus = "overdue";
  }

  await knex("charges")
    .where({ id: chargeId, tenant_id: tenantId })
    .update({ status: nextStatus, updated_at: new Date().toISOString() });

  return nextStatus;
}
