import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import express from "express";
import rateLimit from "express-rate-limit";
import { recordAuditLog } from "../audit.js";
import { authenticateRequest, createAccessToken, getUserTenants, verifyPassword } from "../auth.js";
import { AUTH_PASSWORD_RESET_EXPIRES_MINUTES, AUTH_REFRESH_EXPIRES_DAYS, JWT_EXPIRES_IN } from "../config.js";
import { getKnex } from "../db-knex.js";
import { hashSecretToken, normalizeEmail } from "../helpers.js";
import { getUiCapability } from "../rbac.js";

// ── Token helpers ────────────────────────────────────────────────────────

async function issueRefreshToken(userId) {
  const knex = getKnex();
  const token = crypto.randomBytes(48).toString("base64url");
  const tokenHash = hashSecretToken(token);
  const expiresAt = new Date(Date.now() + AUTH_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await knex("auth_refresh_tokens").insert({
    id: `rt-${crypto.randomUUID()}`, user_id: userId,
    token_hash: tokenHash, expires_at: expiresAt, revoked_at: null, created_at: new Date().toISOString(),
  });
  return { refreshToken: token, refreshTokenExpiresAt: expiresAt };
}

async function issuePasswordResetToken(userId) {
  const knex = getKnex();
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashSecretToken(token);
  const expiresAt = new Date(Date.now() + AUTH_PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000).toISOString();
  await knex("auth_password_reset_tokens").insert({
    id: `prt-${crypto.randomUUID()}`, user_id: userId,
    token_hash: tokenHash, expires_at: expiresAt, used_at: null, created_at: new Date().toISOString(),
  });
  return { token, expiresAt };
}

async function revokeRefreshToken(rawToken) {
  if (!rawToken) return 0;
  const knex = getKnex();
  const count = await knex("auth_refresh_tokens")
    .where("token_hash", hashSecretToken(rawToken)).whereNull("revoked_at")
    .update({ revoked_at: new Date().toISOString() });
  return Number(count || 0);
}

async function readRefreshTokenRecord(rawToken) {
  if (!rawToken) return null;
  const knex = getKnex();
  return knex("auth_refresh_tokens").where("token_hash", hashSecretToken(rawToken))
    .select("id", "user_id as userId", "token_hash as tokenHash", "expires_at as expiresAt", "revoked_at as revokedAt")
    .first();
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

function setAuthCookies(res, token, refreshToken) {
  res.cookie("access_token", token, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 }); // 15 min
  if (refreshToken) {
    res.cookie("refresh_token", refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 }); // 7 days
  }
}

function clearAuthCookies(res) {
  res.clearCookie("access_token", COOKIE_OPTIONS);
  res.clearCookie("refresh_token", COOKIE_OPTIONS);
}

async function buildAuthResponse(user, tenantHint = null) {
  const tenants = await getUserTenants(user.id);
  const defaultTenantId = tenantHint || tenants[0]?.id || null;
  const token = createAccessToken({ id: user.id, email: user.email, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);
  return {
    token, tokenType: "Bearer", expiresIn: JWT_EXPIRES_IN,
    refreshToken: refreshToken.refreshToken, refreshTokenExpiresAt: refreshToken.refreshTokenExpiresAt,
    user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
    capabilities: getUiCapability(user.role), tenants, defaultTenantId,
  };
}

// ── Public auth routes (mounted on app, not api) ─────────────────────────

export function registerPublicAuthRoutes(app) {
  const authRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, limit: 25, standardHeaders: true, legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ error: "Demasiadas tentativas de login. Tente novamente dentro de alguns minutos.", requestId: req.requestId });
    },
  });

  app.post("/api/auth/login", authRateLimiter, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    if (!email || !password) return res.status(400).json({ error: "Campos email e password sao obrigatorios." });

    const knex = getKnex();
    const user = await knex("app_users").where({ email })
      .select("id", "email", "full_name", "role", "password_hash", "is_active").first();

    if (!user || Number(user.is_active) !== 1 || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Credenciais invalidas." });
    }

    const tenants = await getUserTenants(user.id);
    if (tenants.length === 0) return res.status(403).json({ error: "Sem acesso a condominio." });

    const authData = await buildAuthResponse(user, tenants[0].id);
    setAuthCookies(res, authData.token, authData.refreshToken);
    return res.json(authData);
  });

  app.post("/api/auth/refresh", authRateLimiter, async (req, res) => {
    const incomingRefreshToken = String(req.body?.refreshToken || req.cookies?.refresh_token || "").trim();
    if (!incomingRefreshToken) return res.status(400).json({ error: "refreshToken e obrigatorio." });

    const knex = getKnex();
    const refreshTokenRecord = await readRefreshTokenRecord(incomingRefreshToken);
    if (!refreshTokenRecord || refreshTokenRecord.revokedAt) {
      return res.status(401).json({ error: "Refresh token invalido." });
    }
    if (new Date(refreshTokenRecord.expiresAt).getTime() <= Date.now()) {
      await revokeRefreshToken(incomingRefreshToken);
      return res.status(401).json({ error: "Refresh token expirado." });
    }

    const user = await knex("app_users").where({ id: refreshTokenRecord.userId })
      .select("id", "email", "full_name", "role", "is_active").first();

    if (!user || Number(user.is_active) !== 1) {
      await revokeRefreshToken(incomingRefreshToken);
      return res.status(401).json({ error: "Utilizador invalido ou inativo." });
    }

    await revokeRefreshToken(incomingRefreshToken);
    const authData = await buildAuthResponse(user);
    setAuthCookies(res, authData.token, authData.refreshToken);
    return res.json(authData);
  });

  app.post("/api/auth/logout", async (req, res) => {
    const incomingRefreshToken = String(req.body?.refreshToken || req.cookies?.refresh_token || "").trim();
    const revoked = await revokeRefreshToken(incomingRefreshToken);
    clearAuthCookies(res);
    return res.json({ ok: true, revoked });
  });

  app.post("/api/auth/password-reset/request", authRateLimiter, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const knex = getKnex();
    const user = await knex("app_users").where({ email }).select("id", "is_active").first();

    let debugToken = null;
    if (user && Number(user.is_active) === 1) {
      const issued = await issuePasswordResetToken(user.id);
      if (process.env.NODE_ENV !== "production") debugToken = issued.token;
    }

    return res.json({
      ok: true,
      message: "Se existir conta para este email, enviamos instrucoes de reset.",
      resetToken: debugToken,
    });
  });

  app.post("/api/auth/password-reset/confirm", authRateLimiter, async (req, res) => {
    const token = String(req.body?.token || "").trim();
    const newPassword = String(req.body?.newPassword || "");
    if (!token || !newPassword) return res.status(400).json({ error: "token e newPassword sao obrigatorios." });
    if (newPassword.length < 10) return res.status(400).json({ error: "newPassword deve ter pelo menos 10 caracteres." });

    const knex = getKnex();
    const tokenRecord = await knex("auth_password_reset_tokens")
      .where({ token_hash: hashSecretToken(token) })
      .select("id", "user_id as userId", "expires_at as expiresAt", "used_at as usedAt").first();

    if (!tokenRecord || tokenRecord.usedAt) return res.status(400).json({ error: "Token de reset invalido." });
    if (new Date(tokenRecord.expiresAt).getTime() <= Date.now()) return res.status(400).json({ error: "Token de reset expirado." });

    const user = await knex("app_users").where({ id: tokenRecord.userId })
      .select("id", "email", "full_name", "role", "is_active").first();

    if (!user || Number(user.is_active) !== 1) return res.status(400).json({ error: "Utilizador invalido ou inativo." });

    await knex.transaction(async (trx) => {
      await trx("app_users").where({ id: user.id }).update({ password_hash: bcrypt.hashSync(newPassword, 10), updated_at: new Date().toISOString() });
      await trx("auth_password_reset_tokens").where({ id: tokenRecord.id }).update({ used_at: new Date().toISOString() });
      await trx("auth_refresh_tokens").where("user_id", user.id).whereNull("revoked_at").update({ revoked_at: new Date().toISOString() });
    });

    const memberships = await getUserTenants(user.id);
    for (const membership of memberships) {
      await recordAuditLog({
        tenantId: membership.id, actorUserId: user.id, action: "auth.password_reset.confirm",
        entityType: "user", entityId: user.id, metadata: { via: "token" },
      });
    }

    return res.json({ ok: true });
  });
}

// ── Authenticated /auth/me route (mounted on api router) ─────────────────

const router = express.Router();

router.get("/auth/me", (req, res) => {
  res.json({
    user: req.user,
    capabilities: getUiCapability(req.user.role),
    tenant: req.tenant,
    tenants: req.tenants,
  });
});

export default router;
