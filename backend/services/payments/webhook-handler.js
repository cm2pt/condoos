/**
 * Payment webhook handler for ifthenpay callbacks.
 * Processes Multibanco and MB Way payment confirmations.
 */
import crypto from "node:crypto";
import { getKnex } from "../../db-knex.js";
import { recordAuditLog } from "../../audit.js";
import { logger } from "../../logger.js";
import { recalculateChargeStatus } from "../charge-status.js";
import { IFTHENPAY_ANTI_PHISHING_KEY } from "../../config.js";

/**
 * Verify ifthenpay webhook signature.
 */
export function verifyWebhookSignature(query) {
  if (!IFTHENPAY_ANTI_PHISHING_KEY) {
    return true; // Skip verification in dev/mock mode
  }
  return query?.key === IFTHENPAY_ANTI_PHISHING_KEY;
}

/**
 * Process a Multibanco payment confirmation webhook.
 * @param {{ entity: string, reference: string, amount: string, requestId?: string }} payload
 */
export async function handleMultibancoCallback({ entity, reference, amount, requestId }) {
  const knex = getKnex();

  const paymentRef = await knex("payment_references")
    .where({ entity, reference, method: "multibanco" })
    .whereIn("status", ["pending"])
    .first();

  if (!paymentRef) {
    return { matched: false, reason: "No pending reference found" };
  }

  const now = new Date().toISOString();

  await knex.transaction(async (trx) => {
    await trx("payment_references")
      .where({ id: paymentRef.id })
      .update({
        status: "paid",
        paid_at: now,
        provider_transaction_id: requestId || null,
        webhook_payload_json: JSON.stringify({ entity, reference, amount, requestId }),
        updated_at: now,
      });

    await trx("payments").insert({
      id: `pay-${crypto.randomUUID()}`,
      tenant_id: paymentRef.tenant_id,
      charge_id: paymentRef.charge_id,
      amount: paymentRef.amount,
      method: "multibanco",
      paid_at: now,
      reference: `${entity} ${reference}`,
      source: "webhook",
      created_at: now,
    });
  });

  await recalculateChargeStatus(paymentRef.tenant_id, paymentRef.charge_id);

  await recordAuditLog({
    tenantId: paymentRef.tenant_id,
    actorUserId: "system",
    action: "payment.webhook.multibanco.confirmed",
    entityType: "payment_reference",
    entityId: paymentRef.id,
    metadata: { entity, reference, amount },
  });

  return { matched: true, paymentReferenceId: paymentRef.id, chargeId: paymentRef.charge_id };
}

/**
 * Process an MB Way payment confirmation webhook.
 * @param {{ requestId: string, amount: string, status: string }} payload
 */
export async function handleMbWayCallback({ requestId, amount, status }) {
  const knex = getKnex();

  const paymentRef = await knex("payment_references")
    .where({ provider_transaction_id: requestId, method: "mbway" })
    .whereIn("status", ["pending"])
    .first();

  if (!paymentRef) {
    return { matched: false, reason: "No pending MB Way reference found" };
  }

  const now = new Date().toISOString();
  const isPaid = status === "000" || status === "paid";

  await knex.transaction(async (trx) => {
    await trx("payment_references")
      .where({ id: paymentRef.id })
      .update({
        status: isPaid ? "paid" : "error",
        paid_at: isPaid ? now : null,
        error_message: isPaid ? null : `MB Way status: ${status}`,
        webhook_payload_json: JSON.stringify({ requestId, amount, status }),
        updated_at: now,
      });

    if (isPaid) {
      await trx("payments").insert({
        id: `pay-${crypto.randomUUID()}`,
        tenant_id: paymentRef.tenant_id,
        charge_id: paymentRef.charge_id,
        amount: paymentRef.amount,
        method: "mbway",
        paid_at: now,
        reference: `MBWAY-${requestId}`,
        source: "webhook",
        created_at: now,
      });
    }
  });

  if (isPaid) {
    await recalculateChargeStatus(paymentRef.tenant_id, paymentRef.charge_id);
  }

  await recordAuditLog({
    tenantId: paymentRef.tenant_id,
    actorUserId: "system",
    action: isPaid ? "payment.webhook.mbway.confirmed" : "payment.webhook.mbway.failed",
    entityType: "payment_reference",
    entityId: paymentRef.id,
    metadata: { requestId, amount, status },
  });

  return { matched: true, paid: isPaid, paymentReferenceId: paymentRef.id };
}
