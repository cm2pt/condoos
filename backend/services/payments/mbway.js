/**
 * MB Way push payment via ifthenpay API.
 * Sends a payment request to the user's MB Way app.
 *
 * ifthenpay docs: https://ifthenpay.com/docs
 */

const IFTHENPAY_API_URL = process.env.IFTHENPAY_MBWAY_API_URL || "https://api.ifthenpay.com/spg/payment/mbway";
const IFTHENPAY_MBWAY_KEY = process.env.IFTHENPAY_MBWAY_KEY || "";

/**
 * Send an MB Way push payment request.
 * @param {{ chargeId: string, amount: number, phone: string, orderId?: string }} params
 * @returns {Promise<{ requestId: string, phone: string, amount: string, status: string }>}
 */
export async function sendMbWayPayment({ chargeId, amount, phone, orderId }) {
  const normalizedPhone = normalizePortuguesePhone(phone);

  if (!IFTHENPAY_MBWAY_KEY) {
    return generateMockMbWay({ chargeId, amount, phone: normalizedPhone });
  }

  const body = {
    mbWayKey: IFTHENPAY_MBWAY_KEY,
    orderId: orderId || chargeId,
    amount: Number(amount).toFixed(2),
    mobileNumber: normalizedPhone,
    description: `Condoos - Encargo ${chargeId}`,
  };

  const response = await fetch(IFTHENPAY_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`ifthenpay MB Way API error: ${response.status} ${text}`);
  }

  const data = await response.json();

  return {
    provider: "ifthenpay",
    requestId: data.RequestId || null,
    phone: normalizedPhone,
    amount: Number(amount).toFixed(2),
    status: data.Status === "000" ? "pending" : "error",
    errorMessage: data.Status !== "000" ? (data.Message || "Erro MB Way") : null,
  };
}

/**
 * Normalize Portuguese phone number to international format (351XXXXXXXXX).
 */
function normalizePortuguesePhone(phone) {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("351") && digits.length === 12) {
    return digits;
  }
  if (digits.length === 9 && (digits.startsWith("9") || digits.startsWith("2"))) {
    return `351${digits}`;
  }
  return digits;
}

function generateMockMbWay({ amount, phone }) {
  return {
    provider: "mock",
    requestId: `mock-mbway-${Date.now()}`,
    phone,
    amount: Number(amount).toFixed(2),
    status: "pending",
    errorMessage: null,
  };
}
