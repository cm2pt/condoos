/**
 * Multibanco reference generation via ifthenpay API.
 * Generates ATM payment references (entity + reference + amount).
 *
 * ifthenpay docs: https://ifthenpay.com/docs
 */
import { logger } from "../../logger.js";
import {
  IFTHENPAY_API_KEY,
  IFTHENPAY_MULTIBANCO_ENTITY,
  IFTHENPAY_MULTIBANCO_SUBENTITY,
  IFTHENPAY_SANDBOX,
} from "../../config.js";

const IFTHENPAY_API_URL = process.env.IFTHENPAY_API_URL || "https://api.ifthenpay.com/spg/payment/multibanco";

/**
 * Generate a Multibanco payment reference.
 * @param {{ chargeId: string, amount: number, dueDate: string, orderId?: string }} params
 * @returns {Promise<{ provider: string, entity: string, reference: string, amount: string, requestId: string|null }>}
 */
export async function generateMultibancoReference({ chargeId, amount, dueDate, orderId }) {
  if (!IFTHENPAY_API_KEY || !IFTHENPAY_MULTIBANCO_ENTITY) {
    return generateMockReference({ chargeId, amount, dueDate });
  }

  try {
    const body = {
      mbKey: IFTHENPAY_API_KEY,
      orderId: orderId || chargeId,
      amount: Number(amount).toFixed(2),
      description: `Condoos - Encargo ${chargeId}`,
      expiryDays: dueDate ? Math.max(1, Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86_400_000)) : 30,
    };

    const response = await fetch(IFTHENPAY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logger.error("ifthenpay_multibanco_api_error", { status: response.status, body: text, chargeId });
      throw new Error(`ifthenpay Multibanco API error: ${response.status} ${text}`);
    }

    const data = await response.json();

    return {
      provider: "ifthenpay",
      entity: data.Entity || IFTHENPAY_MULTIBANCO_ENTITY,
      reference: data.Reference,
      amount: Number(amount).toFixed(2),
      requestId: data.RequestId || null,
    };
  } catch (err) {
    logger.error("ifthenpay_multibanco_error", { error: err.message, chargeId });
    throw err;
  }
}

function generateMockReference({ amount }) {
  return {
    provider: "mock",
    entity: String(Math.floor(10000 + Math.random() * 89999)),
    reference: String(Math.floor(100000000 + Math.random() * 899999999)),
    amount: Number(amount).toFixed(2),
    requestId: `mock-${Date.now()}`,
  };
}
