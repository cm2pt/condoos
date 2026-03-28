import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearStoredAuthSession,
  fetchCoreRuntime,
  fetchMySession,
  loginApi,
  persistAuthSession,
  readStoredAuthSession,
} from "../services/condoosApi.js";
import { PROFILE_OPTIONS } from "../lib/constants.js";
import {
  getProfileCapability,
  normalizeCapabilityForProfile,
} from "../lib/formatters.js";
import {
  DEMO_PROFILE_CREDENTIALS,
  DEMO_LOGIN_ENABLED,
  DEMO_PROFILES_AVAILABLE,
} from "../config/profiles.js";

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

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
