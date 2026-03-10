import express from "express";
import { getKnex } from "../db-knex.js";
import { logger } from "../logger.js";
import { verifyWebhookSignature, handleMultibancoCallback, handleMbWayCallback } from "../services/payments/webhook-handler.js";

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "condoos-api", now: new Date().toISOString() });
});

router.get("/health/ready", async (_req, res) => {
  const checks = { database: "unknown" };
  try {
    const knex = getKnex();
    await knex.raw("SELECT 1");
    checks.database = "ok";
  } catch (err) {
    checks.database = "error";
    logger.error("Health check: database unreachable", { error: err.message });
    return res.status(503).json({ status: "degraded", checks, now: new Date().toISOString() });
  }
  res.json({ status: "ok", checks, now: new Date().toISOString() });
});

// ── Payment webhooks (public, no auth) ──

router.get("/webhooks/payments/multibanco", async (req, res) => {
  if (!verifyWebhookSignature(req.query)) {
    return res.status(403).json({ error: "Invalid webhook signature." });
  }
  const { entity, reference, amount, requestId } = req.query;
  if (!entity || !reference) {
    return res.status(400).json({ error: "entity and reference are required." });
  }
  const result = await handleMultibancoCallback({ entity, reference, amount, requestId });
  return res.json(result);
});

router.get("/webhooks/payments/mbway", async (req, res) => {
  if (!verifyWebhookSignature(req.query)) {
    return res.status(403).json({ error: "Invalid webhook signature." });
  }
  const { requestId, amount, status } = req.query;
  if (!requestId) {
    return res.status(400).json({ error: "requestId is required." });
  }
  const result = await handleMbWayCallback({ requestId, amount, status });
  return res.json(result);
});

export default router;
