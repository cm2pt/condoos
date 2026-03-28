import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { logger } from "./logger.js";
import { authenticateRequest, resolveTenantScope } from "./auth.js";
import { API_HOST, API_PORT, CORS_ORIGINS, IS_PRODUCTION } from "./config.js";
import { initializeKnex } from "./db-knex.js";
import { ensureDirectory, DOCUMENT_STORAGE_DIR, RECEIPT_STORAGE_DIR } from "./helpers.js";

// ── Route modules ────────────────────────────────────────────────────────
import healthRouter from "./routes/health.js";
import { registerPublicAuthRoutes } from "./routes/auth.js";
import authRouter from "./routes/auth.js";
import tenantsRouter from "./routes/tenants.js";
import dashboardRouter from "./routes/dashboard.js";
import fractionsRouter from "./routes/fractions.js";
import peopleRouter from "./routes/people.js";
import documentsRouter from "./routes/documents.js";
import financeRouter from "./routes/finance.js";
import integrationsRouter, { webhookRouter as integrationsWebhookRouter } from "./routes/integrations.js";
import issuesRouter from "./routes/issues.js";
import assembliesRouter from "./routes/assemblies.js";
import votingRouter from "./routes/voting.js";
import reportsRouter from "./routes/reports.js";
import auditRouter from "./routes/audit.js";
import notificationsRouter from "./routes/notifications.js";
import templatesRouter from "./routes/templates.js";

// ── CORS ─────────────────────────────────────────────────────────────────

function buildCorsOptions() {
  return {
    origin: (origin, callback) => {
      if (!origin || CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origem bloqueada por CORS: ${origin}`));
    },
  };
}

function resolveRequestId(req) {
  const incoming = req.headers["x-request-id"];
  if (typeof incoming === "string" && incoming.trim()) return incoming.trim();
  if (Array.isArray(incoming) && incoming[0]?.trim()) return incoming[0].trim();
  return crypto.randomUUID();
}

// ── Server factory ───────────────────────────────────────────────────────

export async function createServer() {
  await initializeKnex({ migrate: true, seed: true });
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  if (!IS_PRODUCTION) {
    ensureDirectory(DOCUMENT_STORAGE_DIR);
    ensureDirectory(RECEIPT_STORAGE_DIR);
  }

  // ── Global middleware ──────────────────────────────────────────────────
  app.use(cors({ ...buildCorsOptions(), credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  app.use((req, res, next) => {
    const requestId = resolveRequestId(req);
    const startedAt = process.hrtime.bigint();
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    res.on("finish", () => {
      if (process.env.NODE_ENV === "test") return;
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      logger.info("request", {
        requestId, method: req.method, path: req.originalUrl, statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)), actorUserId: req.user?.id || null,
        tenantId: req.tenant?.id || req.headers["x-tenant-id"] || null, ip: req.ip,
      });
    });
    next();
  });

  // ── Public routes (no auth) ────────────────────────────────────────────
  app.use(healthRouter);
  registerPublicAuthRoutes(app);
  app.use("/api", integrationsWebhookRouter);

  // ── Authenticated API routes ───────────────────────────────────────────
  const api = express.Router();
  api.use(authenticateRequest);
  api.use(resolveTenantScope);

  api.use(authRouter);
  api.use(tenantsRouter);
  api.use(dashboardRouter);
  api.use(fractionsRouter);
  api.use(documentsRouter);
  api.use(peopleRouter);
  api.use(financeRouter);
  api.use(reportsRouter);
  api.use(integrationsRouter);
  api.use(issuesRouter);
  api.use(assembliesRouter);
  api.use(votingRouter);
  api.use(auditRouter);
  api.use(notificationsRouter);
  api.use(templatesRouter);

  app.use("/api", api);

  // ── Error handler ──────────────────────────────────────────────────────
  app.use((err, _req, res, _next) => {
    const status = err.statusCode || 500;
    const message = status >= 500 ? "Erro interno no servidor." : err.message;
    res.status(status).json({ error: message, requestId: _req.requestId });
  });

  return app;
}

// ── Start ────────────────────────────────────────────────────────────────

export async function startServer() {
  const app = await createServer();
  return app.listen(API_PORT, API_HOST, () => {
    logger.info("Condoos API pronta", { host: API_HOST, port: API_PORT });
    logger.info("Knex database initialized");
    logger.info("CORS permitido", { origins: CORS_ORIGINS });
  });
}

const isEntryPoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntryPoint) {
  startServer();
}
