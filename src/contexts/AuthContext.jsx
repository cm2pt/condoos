import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearStoredAuthSession,
  fetchCoreRuntime,
  fetchMySession,
  loginApi,
  persistAuthSession,
  readStoredAuthSession,
} from "../services/condoosApi.js";
import {
  DEV_DEMO_PROFILE_CREDENTIALS,
  PROFILE_CAPABILITIES,
  PROFILE_OPTIONS,
} from "../lib/constants.js";
import {
  cleanLabel,
  getProfileCapability,
  normalizeCapabilityForProfile,
  toEnvBool,
  toEnvText,
} from "../lib/formatters.js";

function buildDemoCredentials() {
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

const DEMO_PROFILE_CREDENTIALS = buildDemoCredentials();
const DEMO_LOGIN_ENABLED = toEnvBool(import.meta.env.VITE_ENABLE_DEMO_LOGIN, import.meta.env.DEV);
const DEMO_PROFILES_AVAILABLE = PROFILE_OPTIONS.filter((profile) => {
  const credentials = DEMO_PROFILE_CREDENTIALS[profile.id];
  return Boolean(credentials?.email && credentials?.password);
});

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [apiSession, setApiSession] = useState(() => readStoredAuthSession());
  const [apiLoginForm, setApiLoginForm] = useState({ email: "", password: "" });
  const [apiLoginError, setApiLoginError] = useState("");
  const [isApiSyncing, setIsApiSyncing] = useState(false);
  const [apiLastSyncAt, setApiLastSyncAt] = useState("");

  const isServerMode = Boolean(apiSession?.token && apiSession?.tenantId);

  const [activeProfile, setActiveProfile] = useState(() => {
    if (apiSession?.user?.role && PROFILE_OPTIONS.some((option) => option.id === apiSession.user.role)) {
      return apiSession.user.role;
    }
    return "manager";
  });

  const serverProfileCapability = useMemo(() => {
    if (!isServerMode || !apiSession?.user?.role || activeProfile !== apiSession.user.role) {
      return null;
    }
    return normalizeCapabilityForProfile(apiSession.capabilities, apiSession.user.role);
  }, [activeProfile, apiSession, isServerMode]);

  const profileCapability = useMemo(() => {
    if (serverProfileCapability) {
      return serverProfileCapability;
    }
    return getProfileCapability(activeProfile);
  }, [activeProfile, serverProfileCapability]);

  const activeProfileLabel = PROFILE_OPTIONS.find((option) => option.id === activeProfile)?.label || activeProfile;

  useEffect(() => {
    if (!isServerMode || !apiSession?.user?.role) {
      return;
    }
    if (activeProfile !== apiSession.user.role) {
      setActiveProfile(apiSession.user.role);
    }
  }, [activeProfile, apiSession, isServerMode]);

  const performApiLogin = useCallback(
    async ({ email, password }) => {
      setApiLoginError("");
      setIsApiSyncing(true);

      try {
        const session = await loginApi({ email: email.trim(), password });
        const me = await fetchMySession(session);
        const tenantId = session.tenantId || me.tenant?.id || me.tenants?.[0]?.id;
        const hydratedSession = {
          ...session,
          tenantId,
          tenantName: me.tenant?.name || me.tenants?.find((item) => item.id === tenantId)?.name || "",
          tenants: me.tenants || session.tenants || [],
          user: me.user || session.user,
          capabilities: me.capabilities || session.capabilities || null,
        };

        persistAuthSession(hydratedSession);
        setApiSession(hydratedSession);
        setActiveProfile(hydratedSession.user?.role || "manager");
        setApiLoginForm({ email: hydratedSession.user?.email || email, password: "" });
        return hydratedSession;
      } catch (error) {
        setApiLoginError(error instanceof Error ? error.message : "Nao foi possivel iniciar sessao na API.");
        return null;
      } finally {
        setIsApiSyncing(false);
      }
    },
    []
  );

  const handleApiLogin = useCallback(
    async (event) => {
      event.preventDefault();
      return performApiLogin({ email: apiLoginForm.email, password: apiLoginForm.password });
    },
    [apiLoginForm, performApiLogin]
  );

  const handleApiLoginAsDemoProfile = useCallback(
    async (profileId) => {
      if (!DEMO_LOGIN_ENABLED) {
        return null;
      }
      const credentials = DEMO_PROFILE_CREDENTIALS[profileId];
      if (!credentials?.email || !credentials?.password) {
        setApiLoginError("Credenciais demo indisponíveis neste ambiente.");
        return null;
      }
      setApiLoginForm({ email: credentials.email, password: credentials.password });
      return performApiLogin(credentials);
    },
    [performApiLogin]
  );

  const handleApiLogout = useCallback(() => {
    clearStoredAuthSession();
    setApiSession(null);
    setApiLastSyncAt("");
    setApiLoginError("");
  }, []);

  const value = useMemo(
    () => ({
      apiSession,
      setApiSession,
      apiLoginForm,
      setApiLoginForm,
      apiLoginError,
      setApiLoginError,
      isApiSyncing,
      setIsApiSyncing,
      apiLastSyncAt,
      setApiLastSyncAt,
      isServerMode,
      activeProfile,
      setActiveProfile,
      profileCapability,
      activeProfileLabel,
      performApiLogin,
      handleApiLogin,
      handleApiLoginAsDemoProfile,
      handleApiLogout,
      demoLoginEnabled: DEMO_LOGIN_ENABLED,
      demoProfilesAvailable: DEMO_PROFILES_AVAILABLE,
    }),
    [
      apiSession,
      apiLoginForm,
      apiLoginError,
      isApiSyncing,
      apiLastSyncAt,
      isServerMode,
      activeProfile,
      profileCapability,
      activeProfileLabel,
      performApiLogin,
      handleApiLogin,
      handleApiLoginAsDemoProfile,
      handleApiLogout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
