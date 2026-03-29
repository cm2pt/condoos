import express from "express";
import { getKnex } from "../db-knex.js";
import { logger } from "../logger.js";
import { getTransporter, isEmailConfigured } from "../services/email/transporter.js";
import { verifyWebhookSignature, handleMultibancoCallback, handleMbWayCallback } from "../services/payments/webhook-handler.js";

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "condoos-api", now: new Date().toISOString() });
});

// One-time reseed endpoint — protected by RESEED_SECRET env var or FORCE_RESEED
router.post("/health/reseed", async (_req, res) => {
  if ((process.env.FORCE_RESEED || "").trim() !== "true") {
    return res.status(403).json({ error: "FORCE_RESEED not enabled." });
  }
  try {
    const knex = getKnex();
    await knex.seed.run();
    // Auto-disable after successful reseed
    process.env.FORCE_RESEED = "done";
    const counts = {};
    for (const t of ["tenants", "charges", "payments", "issues", "documents", "assemblies", "audit_logs", "notifications", "finance_ledger_entries"]) {
      const r = await knex(t).count("* as c").first();
      counts[t] = Number(r.c);
    }
    res.json({ status: "reseeded", counts });
  } catch (err) {
    logger.error("Reseed failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
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

router.get("/health/email", async (_req, res) => {
  const configured = isEmailConfigured();
  if (!configured) {
    return res.json({ configured: false, verified: false });
  }
  try {
    const transporter = getTransporter();
    await transporter.verify();
    res.json({ configured: true, verified: true });
  } catch (err) {
    logger.error("Health check: SMTP verification failed", { error: err.message });
    res.json({ configured: true, verified: false });
  }
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
