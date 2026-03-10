import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_EXPIRES_IN, JWT_SECRET } from "./config.js";
import { getKnex } from "./db-knex.js";
import { can } from "./rbac.js";

function readBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== "string") {
    return null;
  }

  const [scheme, token] = headerValue.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
    }
  );
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compareSync(password, passwordHash);
}

export async function getUserTenants(userId) {
  const knex = getKnex();
  return knex("user_tenants as ut")
    .join("tenants as t", "t.id", "ut.tenant_id")
    .where("ut.user_id", userId)
    .orderBy("t.name", "asc")
    .select("t.id", "t.name", "t.city", "t.country");
}

export async function authenticateRequest(req, res, next) {
  const token = readBearerToken(req.headers.authorization) || req.cookies?.access_token || null;
  if (!token) {
    return res.status(401).json({ error: "Authorization bearer token em falta." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const knex = getKnex();
    const user = await knex("app_users")
      .where({ id: payload.sub })
      .select("id", "email", "full_name", "role", "is_active")
      .first();

    if (!user || Number(user.is_active) !== 1) {
      return res.status(401).json({ error: "Utilizador invalido ou inativo." });
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    };

    return next();
  } catch {
    return res.status(401).json({ error: "Token invalido ou expirado." });
  }
}

export async function resolveTenantScope(req, res, next) {
  const memberships = await getUserTenants(req.user.id);

  if (memberships.length === 0) {
    return res.status(403).json({ error: "Utilizador sem acesso a condominio." });
  }

  const requestedTenantId = req.headers["x-tenant-id"];
  const membershipByTenant = new Map(memberships.map((tenant) => [tenant.id, tenant]));

  if (requestedTenantId && !membershipByTenant.has(requestedTenantId)) {
    return res.status(403).json({ error: "Sem acesso ao condominio pedido." });
  }

  req.tenant = requestedTenantId ? membershipByTenant.get(requestedTenantId) : memberships[0];
  req.tenants = memberships;
  return next();
}

export function authorize(resource, action) {
  return (req, res, next) => {
    if (!can(req.user.role, resource, action)) {
      return res.status(403).json({
        error: `Permissao insuficiente para ${resource}:${action}.`,
      });
    }
    return next();
  };
}
