import {
  DEV_DEMO_PROFILE_CREDENTIALS,
  PROFILE_OPTIONS,
} from "../lib/constants.js";
import { toEnvText, toEnvBool } from "../lib/formatters.js";

export function buildDemoCredentials() {
  if (import.meta.env.DEV) {
    return DEV_DEMO_PROFILE_CREDENTIALS;
  }

  return {
    manager: {
      email: toEnvText(import.meta.env.VITE_DEMO_MANAGER_EMAIL),
      password: toEnvText(import.meta.env.VITE_DEMO_MANAGER_PASSWORD),
    },
    accounting: {
      email: toEnvText(import.meta.env.VITE_DEMO_ACCOUNTING_EMAIL),
      password: toEnvText(import.meta.env.VITE_DEMO_ACCOUNTING_PASSWORD),
    },
    operations: {
      email: toEnvText(import.meta.env.VITE_DEMO_OPERATIONS_EMAIL),
      password: toEnvText(import.meta.env.VITE_DEMO_OPERATIONS_PASSWORD),
    },
    resident: {
      email: toEnvText(import.meta.env.VITE_DEMO_RESIDENT_EMAIL),
      password: toEnvText(import.meta.env.VITE_DEMO_RESIDENT_PASSWORD),
    },
  };
}

export const DEMO_PROFILE_CREDENTIALS = buildDemoCredentials();

// VITE_ENABLE_DEMO_LOGIN controlado via env vars do Vercel em produção
export const DEMO_LOGIN_ENABLED = toEnvBool(import.meta.env.VITE_ENABLE_DEMO_LOGIN, import.meta.env.DEV);

export const DEMO_PROFILES_AVAILABLE = PROFILE_OPTIONS.filter((profile) => {
  const credentials = DEMO_PROFILE_CREDENTIALS[profile.id];
  return Boolean(credentials?.email && credentials?.password);
});
