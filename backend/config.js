function asNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseCorsOrigins(rawValue) {
  if (!rawValue) {
    return ["http://127.0.0.1:4173", "http://localhost:4173", "http://127.0.0.1:5173", "http://localhost:5173", "https://condoos.vercel.app"];
  }

  return rawValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const API_HOST = process.env.API_HOST || "127.0.0.1";
export const API_PORT = asNumber(process.env.API_PORT, 4100);
export const IS_PRODUCTION = process.env.NODE_ENV === "production";
const DEFAULT_DEV_JWT_SECRET = "condoos_dev_only_change_this_secret";
const configuredJwtSecret = process.env.JWT_SECRET || DEFAULT_DEV_JWT_SECRET;

if (IS_PRODUCTION && configuredJwtSecret === DEFAULT_DEV_JWT_SECRET) {
  throw new Error("JWT_SECRET obrigatorio em producao.");
}

export const JWT_SECRET = configuredJwtSecret;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
export const AUTH_REFRESH_EXPIRES_DAYS = Math.max(asNumber(process.env.AUTH_REFRESH_EXPIRES_DAYS, 30), 1);
export const AUTH_PASSWORD_RESET_EXPIRES_MINUTES = Math.max(
  asNumber(process.env.AUTH_PASSWORD_RESET_EXPIRES_MINUTES, 30),
  5
);
export const CORS_ORIGINS = parseCorsOrigins(process.env.CORS_ORIGINS);
export const ENABLE_DEMO_USERS = asBoolean(process.env.ENABLE_DEMO_USERS, !IS_PRODUCTION);
export const BOOTSTRAP_ADMIN_EMAIL = String(process.env.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
export const BOOTSTRAP_ADMIN_PASSWORD = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || "");

if (IS_PRODUCTION && !ENABLE_DEMO_USERS && (!BOOTSTRAP_ADMIN_EMAIL || !BOOTSTRAP_ADMIN_PASSWORD)) {
  throw new Error(
    "Produção sem utilizadores demo requer BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD para criar conta inicial."
  );
}
