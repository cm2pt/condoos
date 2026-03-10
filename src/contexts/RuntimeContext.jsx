import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MODULES, QUICK_ACTION_TYPES } from "../lib/constants.js";
import { useAuth } from "./AuthContext.jsx";

const RuntimeContext = createContext(null);

export function RuntimeProvider({ children }) {
  const { profileCapability, activeProfileLabel } = useAuth();

  const queryParams = useMemo(() => {
    if (typeof window === "undefined") {
      return new URLSearchParams();
    }
    return new URLSearchParams(window.location.search);
  }, []);

  const isCaptureMode = queryParams.get("capture") === "1";
  const queryModule = queryParams.get("module");
  const querySearch = queryParams.get("q") || "";
  const queryNotificationsOpen = queryParams.get("notifications") === "1";
  const queryCommandOpen = queryParams.get("command") === "1";
  const queryCommandText = queryParams.get("cmdq") || "";

  const [activeModule, setActiveModule] = useState(() => {
    return MODULES.some((module) => module.id === queryModule) ? queryModule : "dashboard";
  });

  const [globalQuery, setGlobalQuery] = useState(querySearch);
  const [quickActionType, setQuickActionType] = useState("issues");
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(queryNotificationsOpen);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(queryCommandOpen);
  const [commandQuery, setCommandQuery] = useState(queryCommandText);
  const [notificationReadIds, setNotificationReadIds] = useState([]);
  const [toastMessage, setToastMessage] = useState("");
  const [activityLog, setActivityLog] = useState([]);

  const availableModules = useMemo(
    () => MODULES.filter((module) => profileCapability.modules.includes(module.id)),
    [profileCapability]
  );

  const availableQuickActionTypes = useMemo(
    () => QUICK_ACTION_TYPES.filter((typeOption) => profileCapability.quickActions.includes(typeOption.id)),
    [profileCapability]
  );

  useEffect(() => {
    if (!profileCapability.modules.includes(activeModule)) {
      setActiveModule(profileCapability.modules[0] || "dashboard");
    }
  }, [activeModule, profileCapability]);

  useEffect(() => {
    if (!availableQuickActionTypes.some((item) => item.id === quickActionType)) {
      setQuickActionType(availableQuickActionTypes[0]?.id || "issues");
    }
  }, [quickActionType, availableQuickActionTypes]);

  // Keyboard shortcuts
  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      const hasMod = event.metaKey || event.ctrlKey;

      if (hasMod && key === "k") {
        event.preventDefault();
        setIsQuickActionOpen(false);
        setIsNotificationsOpen(false);
        setIsCommandPaletteOpen(true);
        return;
      }

      if (hasMod && event.shiftKey && key === "n") {
        event.preventDefault();
        setIsQuickActionOpen(false);
        setIsCommandPaletteOpen(false);
        setIsNotificationsOpen((previous) => !previous);
        return;
      }

      if (event.key === "Escape") {
        setIsCommandPaletteOpen(false);
        setIsNotificationsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }
    const timer = window.setTimeout(() => setToastMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  // URL sync
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("module", activeModule);
    if (globalQuery.trim()) {
      url.searchParams.set("q", globalQuery.trim());
    } else {
      url.searchParams.delete("q");
    }
    window.history.replaceState({}, "", url);
  }, [activeModule, globalQuery]);

  // Quick action URL trigger
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const quickAction = params.get("quickAction");
    const actionType = params.get("actionType");
    const allowedActionIds = availableQuickActionTypes.map((item) => item.id);

    if (quickAction === "1" && allowedActionIds.length > 0) {
      if (allowedActionIds.includes(actionType)) {
        setQuickActionType(actionType);
      }
      setIsQuickActionOpen(true);
    }
  }, [availableQuickActionTypes]);

  const value = useMemo(
    () => ({
      isCaptureMode,
      activeModule,
      setActiveModule,
      globalQuery,
      setGlobalQuery,
      quickActionType,
      setQuickActionType,
      isQuickActionOpen,
      setIsQuickActionOpen,
      isNotificationsOpen,
      setIsNotificationsOpen,
      isCommandPaletteOpen,
      setIsCommandPaletteOpen,
      commandQuery,
      setCommandQuery,
      notificationReadIds,
      setNotificationReadIds,
      toastMessage,
      setToastMessage,
      activityLog,
      setActivityLog,
      availableModules,
      availableQuickActionTypes,
    }),
    [
      isCaptureMode,
      activeModule,
      globalQuery,
      quickActionType,
      isQuickActionOpen,
      isNotificationsOpen,
      isCommandPaletteOpen,
      commandQuery,
      notificationReadIds,
      toastMessage,
      activityLog,
      availableModules,
      availableQuickActionTypes,
    ]
  );

  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useRuntime() {
  const context = useContext(RuntimeContext);
  if (!context) {
    throw new Error("useRuntime must be used within a RuntimeProvider");
  }
  return context;
}
