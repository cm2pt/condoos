import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import seedData from "../data/synthetic/condominio_portugal_seed.json";
import {
  advanceIssueStatusApi,
  clearStoredAuthSession,
  createChargeApi,
  createFractionPartyApi,
  createFractionApi,
  createIssueApi,
  createPersonApi,
  createPaymentApi,
  downloadPaymentReceiptApi,
  downloadDocumentApi,
  fetchCoreRuntime,
  fetchMySession,
  loginApi,
  persistAuthSession,
  readStoredAuthSession,
  uploadDocumentApi,
  uploadDocumentVersionApi,
} from "./services/condoosApi.js";

import PageLoader from "./components/shared/PageLoader.jsx";
import ErrorBoundary from "./components/shared/ErrorBoundary.jsx";

const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const FractionsPage = lazy(() => import("./pages/FractionsPage.jsx"));
const FinancePage = lazy(() => import("./pages/FinancePage.jsx"));
const IssuesPage = lazy(() => import("./pages/IssuesPage.jsx"));
const AssembliesPage = lazy(() => import("./pages/AssembliesPage.jsx"));
const PortalPage = lazy(() => import("./pages/PortalPage.jsx"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage.jsx"));
const CompliancePage = lazy(() => import("./pages/CompliancePage.jsx"));
const ReportsPage = lazy(() => import("./pages/ReportsPage.jsx"));
const NotificationCenter = lazy(() => import("./features/notifications/NotificationCenter.jsx"));
const CommandPalette = lazy(() => import("./features/command-palette/CommandPalette.jsx"));
const QuickActionDrawer = lazy(() => import("./features/quick-actions/QuickActionDrawer.jsx"));
import AnimateSection from "./components/shared/AnimateSection.jsx";
import Icon from "./components/shared/Icon.jsx";
import TenantSelector from "./components/shared/TenantSelector.jsx";
import {
  MODULES,
  QUICK_ACTION_TYPES,
  HEADER_ACTION_LABEL,
  PROFILE_OPTIONS,
  PROFILE_CAPABILITIES,
  STORAGE_KEY,
  TENANT_STORAGE_KEY,
  BRAND_SYMBOL_SRC,
  BRAND_WORDMARK_SRC,
  ISSUE_COLUMNS,
  PRIORITY_LABEL,
  ISSUE_STATUS_LABEL,
  TEMPLATE_CHECKLIST,
  COMPLIANCE_TASKS,
} from "./lib/constants.js";
import {
  normalizeKey,
  formatCurrency,
  formatDate,
  statusTone,
  cleanLabel,
  getModuleTitle,
  getProfileCapability,
  normalizeCapabilityForProfile,
  canProfileReadDocument,
  getExportPresetKeys,
} from "./lib/formatters.js";
import {
  buildPeopleById,
  buildPrimaryOwnerByFraction,
  buildFinanceBreakdown,
  buildFractionBalances,
  buildFloorMatrix,
  metricCards,
} from "./lib/finance.js";
import {
  buildCsv,
  downloadBlob,
  downloadCsv,
  buildDocumentDownloadName,
} from "./lib/csv.js";
import {
  nextIssueStatus,
  buildIssueTimeline,
  buildIssueAttachments,
} from "./lib/issueHelpers.js";
import {
  DEMO_PROFILE_CREDENTIALS,
  DEMO_LOGIN_ENABLED,
  DEMO_PROFILES_AVAILABLE,
} from "./config/profiles.js";
import { useNotifications } from "./features/notifications/useNotifications.js";
import { useCommandActions } from "./features/command-palette/commands.js";
import { useTheme } from "./contexts/ThemeContext.jsx";

function getPersistedRuntime(baseData) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const asArray = (value, fallback) => (Array.isArray(value) ? value : fallback);

    return {
      fractions: asArray(parsed.fractions, baseData.fractions),
      people: asArray(parsed.people, baseData.people),
      fractionParties: asArray(parsed.fractionParties, baseData.fractionParties),
      charges: asArray(parsed.charges, baseData.charges),
      payments: asArray(parsed.payments, baseData.payments),
      issues: asArray(parsed.issues, baseData.issues),
      assemblies: asArray(parsed.assemblies, baseData.assemblies),
      documents: asArray(parsed.documents, baseData.documents),
      workOrders: asArray(parsed.workOrders, baseData.workOrders),
      activityLog: asArray(parsed.activityLog, []),
      selectedIssueId: typeof parsed.selectedIssueId === "string" ? parsed.selectedIssueId : "",
      selectedFractionId: typeof parsed.selectedFractionId === "string" ? parsed.selectedFractionId : "",
      selectedPortalFractionId: typeof parsed.selectedPortalFractionId === "string" ? parsed.selectedPortalFractionId : "",
      selectedChargeId: typeof parsed.selectedChargeId === "string" ? parsed.selectedChargeId : "",
      activeProfile: typeof parsed.activeProfile === "string" ? parsed.activeProfile : "manager",
      notificationReadIds: Array.isArray(parsed.notificationReadIds) ? parsed.notificationReadIds : [],
    };
  } catch {
    return null;
  }
}

function moduleFromPath(pathname) {
  const segment = (pathname || "/").replace(/^\//, "").split("/")[0];
  return MODULES.some((m) => m.id === segment) ? segment : null;
}

function App() {
  const baseData = seedData;
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const routePath = location.pathname;
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isCaptureMode = queryParams.get("capture") === "1";
  const queryProfile = queryParams.get("profile");
  const querySearch = queryParams.get("q") || "";
  const queryNotificationsOpen = queryParams.get("notifications") === "1";
  const queryCommandOpen = queryParams.get("command") === "1";
  const queryCommandText = queryParams.get("cmdq") || "";
  const isLoginRoute = routePath === "/login";
  const [persistedRuntime] = useState(() => (isCaptureMode ? null : getPersistedRuntime(baseData)));
  const [apiSession, setApiSession] = useState(() => (isCaptureMode ? null : readStoredAuthSession()));
  const [apiLoginForm, setApiLoginForm] = useState({
    email: "",
    password: "",
  });
  const [apiLoginError, setApiLoginError] = useState("");
  const [isApiSyncing, setIsApiSyncing] = useState(false);
  const [apiLastSyncAt, setApiLastSyncAt] = useState("");
  const [apiAuditEntries, setApiAuditEntries] = useState([]);
  const isServerMode = Boolean(apiSession?.token && apiSession?.tenantId);
  const [selectedTenantId, setSelectedTenantId] = useState(() => {
    try {
      const stored = localStorage.getItem(TENANT_STORAGE_KEY);
      if (stored) return stored;
    } catch { /* ignorar */ }
    return apiSession?.tenantId || "";
  });

  const activeModule = moduleFromPath(routePath) || "dashboard";
  const setActiveModule = useCallback((mod) => {
    navigate(`/${mod}${location.search}`, { replace: true });
  }, [navigate, location.search]);
  const [activeProfile, setActiveProfile] = useState(() => {
    if (apiSession?.user?.role && PROFILE_OPTIONS.some((option) => option.id === apiSession.user.role)) {
      return apiSession.user.role;
    }

    if (PROFILE_OPTIONS.some((option) => option.id === queryProfile)) {
      return queryProfile;
    }

    return persistedRuntime?.activeProfile || "manager";
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
  const availableModules = useMemo(
    () => MODULES.filter((module) => profileCapability.modules.includes(module.id)),
    [profileCapability]
  );
  const availableQuickActionTypes = useMemo(
    () => QUICK_ACTION_TYPES.filter((typeOption) => profileCapability.quickActions.includes(typeOption.id)),
    [profileCapability]
  );
  const activeProfileLabel = PROFILE_OPTIONS.find((option) => option.id === activeProfile)?.label || activeProfile;
  const [globalQuery, setGlobalQuery] = useState(querySearch);
  const [fractionFilter, setFractionFilter] = useState("all");
  const [fractionFloorFilter, setFractionFloorFilter] = useState("all");
  const [fractionDebtFilter, setFractionDebtFilter] = useState("all");
  const [fractionQuery, setFractionQuery] = useState("");
  const [docQuery, setDocQuery] = useState("");
  const [financeStatusFilter, setFinanceStatusFilter] = useState("all");
  const [financePeriodFilter, setFinancePeriodFilter] = useState("all");
  const [quickActionType, setQuickActionType] = useState("issues");
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(queryNotificationsOpen);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(queryCommandOpen);
  const [commandQuery, setCommandQuery] = useState(queryCommandText);
  const [notificationReadIds, setNotificationReadIds] = useState(persistedRuntime?.notificationReadIds || []);
  const [auditQuery, setAuditQuery] = useState("");
  const [auditDomain, setAuditDomain] = useState("all");
  const [toastMessage, setToastMessage] = useState("");
  const [activityLog, setActivityLog] = useState(persistedRuntime?.activityLog || []);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const documentUploadInputRef = useRef(null);
  const documentUploadVersionTargetRef = useRef(null);

  const [fractionsData, setFractionsData] = useState(persistedRuntime?.fractions || baseData.fractions);
  const [peopleData, setPeopleData] = useState(persistedRuntime?.people || baseData.people);
  const [fractionPartiesData, setFractionPartiesData] = useState(
    persistedRuntime?.fractionParties || baseData.fractionParties
  );
  const [chargesData, setChargesData] = useState(persistedRuntime?.charges || baseData.charges);
  const [paymentsData, setPaymentsData] = useState(persistedRuntime?.payments || baseData.payments);
  const [issuesData, setIssuesData] = useState(persistedRuntime?.issues || baseData.issues);
  const [assembliesData, setAssembliesData] = useState(persistedRuntime?.assemblies || baseData.assemblies);
  const [documentsData, setDocumentsData] = useState(persistedRuntime?.documents || baseData.documents);
  const [workOrdersData, setWorkOrdersData] = useState(persistedRuntime?.workOrders || baseData.workOrders);
  const [selectedIssueId, setSelectedIssueId] = useState(
    persistedRuntime?.selectedIssueId || (persistedRuntime?.issues || baseData.issues)[0]?.id || ""
  );
  const [selectedFractionId, setSelectedFractionId] = useState(
    persistedRuntime?.selectedFractionId || (persistedRuntime?.fractions || baseData.fractions)[0]?.id || ""
  );
  const [selectedPortalFractionId, setSelectedPortalFractionId] = useState(
    persistedRuntime?.selectedPortalFractionId || (persistedRuntime?.fractions || baseData.fractions)[0]?.id || ""
  );
  const [selectedChargeId, setSelectedChargeId] = useState(
    persistedRuntime?.selectedChargeId || (persistedRuntime?.charges || baseData.charges)[0]?.id || ""
  );

  const navigateToPath = useCallback((path, { replace = false } = {}) => {
    navigate(path, { replace });
  }, [navigate]);

  const resetRuntimeToLocal = useCallback(() => {
    setFractionsData(persistedRuntime?.fractions || baseData.fractions);
    setPeopleData(persistedRuntime?.people || baseData.people);
    setFractionPartiesData(persistedRuntime?.fractionParties || baseData.fractionParties);
    setChargesData(persistedRuntime?.charges || baseData.charges);
    setPaymentsData(persistedRuntime?.payments || baseData.payments);
    setIssuesData(persistedRuntime?.issues || baseData.issues);
    setAssembliesData(persistedRuntime?.assemblies || baseData.assemblies);
    setDocumentsData(persistedRuntime?.documents || baseData.documents);
    setWorkOrdersData(persistedRuntime?.workOrders || baseData.workOrders);
    setApiAuditEntries([]);
  }, [baseData, persistedRuntime]);

  const syncRuntimeFromApi = useCallback(async (session) => {
    if (!session?.token || !session?.tenantId) {
      return false;
    }

    setIsApiSyncing(true);
    setApiLoginError("");
    try {
      const runtime = await fetchCoreRuntime(session);
      const sortedFractions = [...runtime.fractions].sort((a, b) =>
        a.floorNumber === b.floorNumber ? a.code.localeCompare(b.code) : a.floorNumber - b.floorNumber
      );

      setFractionsData(sortedFractions);
      setPeopleData(runtime.people || []);
      setFractionPartiesData(runtime.fractionParties || []);
      setChargesData(runtime.charges);
      setPaymentsData(runtime.payments);
      setIssuesData(runtime.issues);
      setDocumentsData(runtime.documents);
      setApiAuditEntries(runtime.auditEntries);
      setApiLastSyncAt(new Date().toISOString());
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao sincronizar dados da API.";
      setApiLoginError(message);
      clearStoredAuthSession();
      setApiSession(null);
      resetRuntimeToLocal();
      return false;
    } finally {
      setIsApiSyncing(false);
    }
  }, [resetRuntimeToLocal]);

  const performApiLogin = useCallback(
    async ({ email, password }) => {
      setApiLoginError("");
      setIsApiSyncing(true);

      try {
        const session = await loginApi({
          email: email.trim(),
          password,
        });

        const me = await fetchMySession(session);
        let tenantId = session.tenantId || me.tenant?.id || me.tenants?.[0]?.id;
        // Respeitar preferencia guardada se o utilizador tem acesso
        try {
          const storedTenant = localStorage.getItem(TENANT_STORAGE_KEY);
          if (storedTenant && (me.tenants || []).some((t) => t.id === storedTenant)) {
            tenantId = storedTenant;
          }
        } catch { /* ignorar */ }
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
        setSelectedTenantId(tenantId);
        try { localStorage.setItem(TENANT_STORAGE_KEY, tenantId); } catch { /* ignorar */ }
        setActiveProfile(hydratedSession.user?.role || "manager");
        setApiLoginForm({
          email: hydratedSession.user?.email || email,
          password: "",
        });
        navigateToPath("/", { replace: true });
        setToastMessage(`Sessao API iniciada com o perfil ${cleanLabel(hydratedSession.user?.role || "manager")}.`);
        await syncRuntimeFromApi(hydratedSession);
      } catch (error) {
        setApiLoginError(error instanceof Error ? error.message : "Nao foi possivel iniciar sessao na API.");
      } finally {
        setIsApiSyncing(false);
      }
    },
    [navigateToPath, syncRuntimeFromApi]
  );

  const handleApiLogin = useCallback(
    async (event) => {
      event.preventDefault();
      await performApiLogin({
        email: apiLoginForm.email,
        password: apiLoginForm.password,
      });
    },
    [apiLoginForm, performApiLogin]
  );

  const handleApiLoginAsDemoProfile = useCallback(
    async (profileId) => {
      if (!DEMO_LOGIN_ENABLED) {
        return;
      }

      const credentials = DEMO_PROFILE_CREDENTIALS[profileId];
      if (!credentials?.email || !credentials?.password) {
        setApiLoginError("Credenciais demo indisponíveis neste ambiente.");
        return;
      }

      setApiLoginForm({
        email: credentials.email,
        password: credentials.password,
      });

      await performApiLogin(credentials);
    },
    [performApiLogin]
  );

  const handleApiLogout = useCallback(() => {
    clearStoredAuthSession();
    setApiSession(null);
    setApiLastSyncAt("");
    setApiLoginError("");
    resetRuntimeToLocal();
    navigateToPath("/login", { replace: true });
    setToastMessage("Sessao API terminada. Aplicacao em modo local.");
  }, [navigateToPath, resetRuntimeToLocal]);

  const handleApiSyncNow = useCallback(async () => {
    if (!apiSession) {
      return;
    }

    const didSync = await syncRuntimeFromApi(apiSession);
    if (didSync) {
      setToastMessage("Dados sincronizados a partir da API.");
    }
  }, [apiSession, syncRuntimeFromApi]);

  const handleTenantChange = useCallback(async (newTenantId) => {
    if (!apiSession || newTenantId === apiSession.tenantId) {
      return;
    }

    const tenant = apiSession.tenants?.find((t) => t.id === newTenantId);
    const updatedSession = {
      ...apiSession,
      tenantId: newTenantId,
      tenantName: tenant?.name || "",
    };

    persistAuthSession(updatedSession);
    setApiSession(updatedSession);
    setSelectedTenantId(newTenantId);
    try {
      localStorage.setItem(TENANT_STORAGE_KEY, newTenantId);
    } catch { /* ignorar */ }
    setToastMessage(`Condominio alterado para ${tenant?.name || newTenantId}.`);
    await syncRuntimeFromApi(updatedSession);
  }, [apiSession, syncRuntimeFromApi]);

  const handleDocumentDownload = useCallback(
    async (docItem) => {
      if (!docItem?.id) {
        return;
      }

      try {
        if (isServerMode) {
          const file = await downloadDocumentApi(apiSession, docItem.id, docItem.title);
          downloadBlob(file.filename, file.blob);
        } else {
          const previewContent = [
            "Condoos | Documento de demonstração",
            `Título: ${docItem.title}`,
            `Categoria: ${cleanLabel(docItem.category)}`,
            `Visibilidade: ${cleanLabel(docItem.visibility)}`,
            `Data de upload: ${formatDate(docItem.uploadedAt)}`,
            "",
            "Nota: conteúdo de demonstração gerado no frontend.",
          ].join("\n");

          downloadBlob(
            buildDocumentDownloadName(docItem.title),
            new Blob([previewContent], { type: "text/plain;charset=utf-8;" })
          );
        }

        setToastMessage(`Download iniciado: ${docItem.title}.`);
      } catch (error) {
        setToastMessage(error instanceof Error ? error.message : "Não foi possível descarregar o documento.");
      }
    },
    [apiSession, isServerMode]
  );

  const triggerDocumentUpload = useCallback((documentItem = null) => {
    if (!documentUploadInputRef.current) {
      return;
    }

    documentUploadVersionTargetRef.current = documentItem?.id || null;
    documentUploadInputRef.current.value = "";
    documentUploadInputRef.current.click();
  }, []);

  const handleDocumentUploadSelection = useCallback(
    async (event) => {
      const input = event.target;
      const selectedFile = input?.files?.[0];
      if (!selectedFile) {
        documentUploadVersionTargetRef.current = null;
        return;
      }

      if (typeof window === "undefined") {
        documentUploadVersionTargetRef.current = null;
        return;
      }

      const versionTargetId = documentUploadVersionTargetRef.current;
      const isNewVersion = Boolean(versionTargetId);
      const versionTarget = isNewVersion ? documentsData.find((document) => document.id === versionTargetId) : null;

      try {
        setIsUploadingDocument(true);

        if (isNewVersion) {
          if (!isServerMode || !apiSession) {
            setToastMessage("Atualização de versão disponível apenas no modo API.");
            return;
          }

          await uploadDocumentVersionApi(apiSession, versionTargetId, {
            file: selectedFile,
          });
          await syncRuntimeFromApi(apiSession);
          setToastMessage(`Nova versão carregada para ${versionTarget?.title || "documento"}.`);
          return;
        }

        const defaultTitle = selectedFile.name.replace(/\.[^.]+$/, "") || "Novo documento";
        const title = window.prompt("Título do documento", defaultTitle)?.trim();
        if (!title) {
          return;
        }

        const categoryInput = window.prompt("Categoria (ex: legal, financeiro, manutencao)", "general");
        const category = categoryInput ? categoryInput.trim().toLowerCase() : "general";

        let visibility = "residents";
        if (activeProfile === "manager") {
          const visibilityInput = window.prompt(
            "Visibilidade (manager_only | residents | all)",
            "residents"
          );
          const normalized = normalizeKey(visibilityInput || "residents");
          if (["manager_only", "residents", "all"].includes(normalized)) {
            visibility = normalized;
          }
        }

        if (isServerMode && apiSession) {
          const uploaded = await uploadDocumentApi(apiSession, {
            title,
            category,
            visibility,
            file: selectedFile,
          });
          setDocumentsData((previous) =>
            [uploaded, ...previous].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
          );
          setToastMessage(`Documento ${title} carregado com sucesso.`);
          await syncRuntimeFromApi(apiSession);
          return;
        }

        const localDoc = {
          id: `doc-local-${Date.now().toString(36)}`,
          condominiumId: baseData.condominium.id,
          category,
          title,
          visibility,
          uploadedByPersonId: null,
          uploadedAt: new Date().toISOString(),
          storagePath: `local/uploads/${selectedFile.name}`,
        };
        setDocumentsData((previous) => [localDoc, ...previous]);
        setToastMessage(`Documento ${title} carregado em modo local.`);
      } catch (error) {
        setToastMessage(error instanceof Error ? error.message : "Nao foi possivel carregar o documento.");
      } finally {
        documentUploadVersionTargetRef.current = null;
        if (input) {
          input.value = "";
        }
        setIsUploadingDocument(false);
      }
    },
    [activeProfile, apiSession, baseData.condominium.id, documentsData, isServerMode, syncRuntimeFromApi]
  );

  const runtimeData = useMemo(
    () => ({
      ...baseData,
      fractions: fractionsData,
      people: peopleData,
      fractionParties: fractionPartiesData,
      charges: chargesData,
      payments: paymentsData,
      issues: issuesData,
      assemblies: assembliesData,
      documents: documentsData,
      workOrders: workOrdersData,
    }),
    [
      baseData,
      fractionsData,
      peopleData,
      fractionPartiesData,
      chargesData,
      paymentsData,
      issuesData,
      assembliesData,
      documentsData,
      workOrdersData,
    ]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const onPopState = () => {
      setRoutePath(window.location.pathname || "/");
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (isCaptureMode) {
      return;
    }

    if (!isServerMode && !isLoginRoute) {
      navigateToPath("/login", { replace: true });
      return;
    }

    if (isServerMode && isLoginRoute) {
      navigateToPath("/", { replace: true });
    }
  }, [isCaptureMode, isLoginRoute, isServerMode, navigateToPath]);

  useEffect(() => {
    if (!isServerMode || isCaptureMode) {
      return;
    }

    syncRuntimeFromApi(apiSession);
  }, [apiSession, isCaptureMode, isServerMode, syncRuntimeFromApi]);

  useEffect(() => {
    if (!isServerMode || !apiSession?.user?.role) {
      return;
    }

    if (activeProfile !== apiSession.user.role) {
      setActiveProfile(apiSession.user.role);
    }
  }, [activeProfile, apiSession, isServerMode]);

  useEffect(() => {
    if (isLoginRoute) return;
    const params = new URLSearchParams(location.search);
    params.set("profile", activeProfile);
    if (globalQuery.trim()) { params.set("q", globalQuery.trim()); } else { params.delete("q"); }
    const targetPath = `/${activeModule}`;
    const targetSearch = params.toString();
    const currentFull = `${location.pathname}?${new URLSearchParams(location.search).toString()}`;
    const newFull = `${targetPath}?${targetSearch}`;
    if (currentFull !== newFull) {
      navigate(`${targetPath}?${targetSearch}`, { replace: true });
    }
  }, [activeModule, activeProfile, globalQuery, isLoginRoute, navigate, location.pathname, location.search]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (isLoginRoute) {
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
  }, [availableQuickActionTypes, isLoginRoute]);

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

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const timer = window.setTimeout(() => setToastMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (!issuesData.some((issue) => issue.id === selectedIssueId)) {
      setSelectedIssueId(issuesData[0]?.id || "");
    }
  }, [issuesData, selectedIssueId]);

  useEffect(() => {
    if (!fractionsData.some((fraction) => fraction.id === selectedFractionId)) {
      setSelectedFractionId(fractionsData[0]?.id || "");
    }
  }, [fractionsData, selectedFractionId]);

  useEffect(() => {
    if (!fractionsData.some((fraction) => fraction.id === selectedPortalFractionId)) {
      setSelectedPortalFractionId(fractionsData[0]?.id || "");
    }
  }, [fractionsData, selectedPortalFractionId]);

  useEffect(() => {
    if (typeof window === "undefined" || isCaptureMode) {
      return;
    }

    const payload = {
      fractions: fractionsData,
      people: peopleData,
      fractionParties: fractionPartiesData,
      charges: chargesData,
      payments: paymentsData,
      issues: issuesData,
      assemblies: assembliesData,
      documents: documentsData,
      workOrders: workOrdersData,
      activityLog,
      activeProfile,
      selectedIssueId,
      selectedFractionId,
      selectedPortalFractionId,
      selectedChargeId,
      notificationReadIds,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    isCaptureMode,
    fractionsData,
    peopleData,
    fractionPartiesData,
    chargesData,
    paymentsData,
    issuesData,
    assembliesData,
    documentsData,
    workOrdersData,
    activityLog,
    activeProfile,
    selectedIssueId,
    selectedFractionId,
    selectedPortalFractionId,
    selectedChargeId,
    notificationReadIds,
  ]);

  const peopleById = useMemo(() => buildPeopleById(peopleData), [peopleData]);
  const ownerByFraction = useMemo(
    () => buildPrimaryOwnerByFraction({ fractionParties: fractionPartiesData }, peopleById),
    [fractionPartiesData, peopleById]
  );
  const finance = useMemo(() => buildFinanceBreakdown(runtimeData), [runtimeData]);
  const fractionBalances = useMemo(() => buildFractionBalances(runtimeData), [runtimeData]);
  const floorMatrix = useMemo(() => buildFloorMatrix(fractionsData), [fractionsData]);
  const cards = useMemo(() => metricCards(runtimeData, finance), [runtimeData, finance]);
  const fractionCodeById = useMemo(
    () => Object.fromEntries(fractionsData.map((fraction) => [fraction.id, fraction.code])),
    [fractionsData]
  );
  const visibleDocuments = useMemo(
    () => documentsData.filter((document) => canProfileReadDocument(activeProfile, document.visibility)),
    [documentsData, activeProfile]
  );
  const canShowDocumentVisibility = activeProfile !== "resident";
  const canUploadDocuments = isServerMode && activeProfile !== "resident";

  const moduleBadge = {
    dashboard: `${fractionsData.length} frações`,
    fractions: `${fractionsData.length} registos`,
    finance: `${formatCurrency(finance.openBalance)} em aberto`,
    issues: `${issuesData.length} ocorrências`,
    assemblies: `${assembliesData.length} reuniões`,
    portal: `${Object.values(fractionBalances).filter((entry) => Number(entry?.balance || 0) > 0).length} saldos`,
    documents: `${visibleDocuments.length} ficheiros`,
    compliance: `${TEMPLATE_CHECKLIST.length} templates`,
  };

  const openAllowedQuickAction = (type) => {
    if (!availableQuickActionTypes.some((item) => item.id === type)) {
      setToastMessage(`Sem permissão no perfil ${activeProfileLabel} para criar ${cleanLabel(type)}.`);
      return;
    }

    setQuickActionType(type);
    setIsNotificationsOpen(false);
    setIsCommandPaletteOpen(false);
    setIsQuickActionOpen(true);
  };

  const nextDeadlines = useMemo(() => {
    const overdueCharges = finance.openCharges.slice(0, 4).map((charge) => ({
      type: "cobranca",
      title: `Cobrança ${charge.period} - ${charge.fractionId.replace("fraction-", "").toUpperCase()}`,
      date: charge.dueDate,
      amount: charge.missing,
      status: charge.status,
    }));

    const assemblyEvents = assembliesData.map((assembly) => ({
      type: "assembleia",
      title: `${assembly.meetingType === "ordinary" ? "Assembleia ordinária" : "Assembleia extraordinária"}`,
      date: assembly.scheduledAt,
      amount: null,
      status: "agenda",
    }));

    return [...overdueCharges, ...assemblyEvents]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 7);
  }, [assembliesData, finance.openCharges]);

  const onboardingChecklist = useMemo(() => {
    const openIssueCount = issuesData.filter((issue) => !["resolved", "closed"].includes(issue.status)).length;
    const criticalIssueCount = issuesData.filter(
      (issue) => issue.priority === "critical" && !["resolved", "closed"].includes(issue.status)
    ).length;
    const completedWorkOrders = workOrdersData.filter((workOrder) => Number(workOrder.finalCost || 0) > 0).length;
    const readyTemplates = TEMPLATE_CHECKLIST.filter((template) => template.status === "ready").length;

    return [
      {
        id: "fractions-seed",
        label: "Base de frações carregada",
        detail: `${fractionsData.length} de 30 frações`,
        done: fractionsData.length >= 30,
        cta: "Fração",
        action: () => openAllowedQuickAction("fractions"),
      },
      {
        id: "finance-seed",
        label: "Plano de cobrança ativo",
        detail: `${chargesData.length} encargos emitidos`,
        done: chargesData.length >= fractionsData.length,
        cta: "Encargo",
        action: () => openAllowedQuickAction("finance"),
      },
      {
        id: "issues-flow",
        label: "Fluxo operacional em curso",
        detail: `${openIssueCount} ocorrências abertas | ${criticalIssueCount} críticas`,
        done: openIssueCount > 0,
        cta: "Ocorrência",
        action: () => openAllowedQuickAction("issues"),
      },
      {
        id: "assembly-plan",
        label: "Calendário de assembleias definido",
        detail: `${assembliesData.length} reuniões planeadas`,
        done: assembliesData.length >= 2,
        cta: "Assembleia",
        action: () => openAllowedQuickAction("assemblies"),
      },
      {
        id: "compliance-pack",
        label: "Pack jurídico preparado",
        detail: `${readyTemplates}/${TEMPLATE_CHECKLIST.length} templates prontos`,
        done: readyTemplates === TEMPLATE_CHECKLIST.length,
        cta: "Compliance",
        action: () => {
          setIsNotificationsOpen(false);
          setIsCommandPaletteOpen(false);
          setActiveModule("compliance");
        },
      },
      {
        id: "supplier-close",
        label: "Encerramentos com custo final",
        detail: `${completedWorkOrders} ordens de trabalho concluídas`,
        done: completedWorkOrders >= 2,
        cta: "Ocorrências",
        action: () => {
          setIsNotificationsOpen(false);
          setIsCommandPaletteOpen(false);
          setActiveModule("issues");
        },
      },
    ];
  }, [
    assembliesData.length,
    chargesData.length,
    fractionsData.length,
    issuesData,
    workOrdersData,
    openAllowedQuickAction,
  ]);

  const onboardingCompletion = useMemo(
    () => onboardingChecklist.filter((item) => item.done).length,
    [onboardingChecklist]
  );

  const notifications = useNotifications({
    openCharges: finance.openCharges,
    issues: issuesData,
    assemblies: assembliesData,
    activityLog,
    fractionCodeById,
    profileCapability,
  });

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notificationReadIds.includes(notification.id)),
    [notifications, notificationReadIds]
  );
  const hasQuickActions = availableQuickActionTypes.length > 0;
  const commandShortcutLabel =
    typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac") ? "Cmd+K" : "Ctrl+K";

  const fractionTypeSummary = useMemo(() => {
    return fractionsData.reduce((acc, fraction) => {
      acc[fraction.type] = (acc[fraction.type] || 0) + 1;
      return acc;
    }, {});
  }, [fractionsData]);

  const filteredFractions = useMemo(() => {
    return fractionsData.filter((fraction) => {
      const byType = fractionFilter === "all" || fraction.type === fractionFilter;
      const byFloor = fractionFloorFilter === "all" || String(fraction.floorNumber) === fractionFloorFilter;
      const balance = fractionBalances[fraction.id]?.balance || 0;
      const byDebt =
        fractionDebtFilter === "all" ||
        (fractionDebtFilter === "in_debt" && balance > 0) ||
        (fractionDebtFilter === "regular" && balance <= 0);
      const byText =
        fractionQuery.trim().length === 0 ||
        fraction.code.toLowerCase().includes(fractionQuery.toLowerCase()) ||
        (ownerByFraction[fraction.id] || "").toLowerCase().includes(fractionQuery.toLowerCase());

      return byType && byFloor && byDebt && byText;
    });
  }, [
    fractionsData,
    fractionFilter,
    fractionFloorFilter,
    fractionDebtFilter,
    fractionQuery,
    ownerByFraction,
    fractionBalances,
  ]);

  const issuesByStatus = useMemo(() => {
    return ISSUE_COLUMNS.reduce((acc, column) => {
      acc[column.key] = issuesData.filter((issue) => issue.status === column.key);
      return acc;
    }, {});
  }, [issuesData]);

  const documentList = useMemo(() => {
    return visibleDocuments.filter((document) => {
      if (!docQuery.trim()) {
        return true;
      }

      const visibilityChunk = canShowDocumentVisibility ? ` ${document.visibility}` : "";
      const text = `${document.title} ${document.category}${visibilityChunk}`.toLowerCase();
      return text.includes(docQuery.toLowerCase());
    });
  }, [visibleDocuments, docQuery, canShowDocumentVisibility]);

  const floorOptions = useMemo(
    () =>
      [...new Set(fractionsData.map((fraction) => fraction.floorNumber))]
        .sort((a, b) => a - b)
        .map((floor) => String(floor)),
    [fractionsData]
  );

  const workOrderByIssue = useMemo(
    () => Object.fromEntries(workOrdersData.map((workOrder) => [workOrder.issueId, workOrder])),
    [workOrdersData]
  );
  const selectedIssue = useMemo(
    () => issuesData.find((issue) => issue.id === selectedIssueId) || issuesData[0] || null,
    [issuesData, selectedIssueId]
  );
  const selectedIssueWorkOrder = selectedIssue ? workOrderByIssue[selectedIssue.id] || null : null;
  const selectedIssueTimeline = useMemo(
    () => buildIssueTimeline(selectedIssue, selectedIssueWorkOrder),
    [selectedIssue, selectedIssueWorkOrder]
  );
  const selectedIssueAttachments = useMemo(
    () => buildIssueAttachments(selectedIssue),
    [selectedIssue]
  );
  const selectedIssueNextStatus = selectedIssue ? nextIssueStatus(selectedIssue.status) : null;

  useEffect(() => {
    if (!filteredFractions.some((fraction) => fraction.id === selectedFractionId)) {
      setSelectedFractionId(filteredFractions[0]?.id || "");
    }
  }, [filteredFractions, selectedFractionId]);

  const selectedFraction = useMemo(
    () => filteredFractions.find((fraction) => fraction.id === selectedFractionId) || filteredFractions[0] || null,
    [filteredFractions, selectedFractionId]
  );
  const selectedFractionCharges = useMemo(
    () =>
      selectedFraction
        ? chargesData
            .filter((charge) => charge.fractionId === selectedFraction.id)
            .map((charge) => {
              const paid = paymentsData
                .filter((payment) => payment.chargeId === charge.id)
                .reduce((sum, payment) => sum + payment.amount, 0);
              const missing = Math.max(charge.amount - paid, 0);
              return {
                ...charge,
                paid,
                missing,
              };
            })
            .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
        : [],
    [selectedFraction, chargesData, paymentsData]
  );
  const selectedFractionPaymentsTotal = useMemo(
    () => selectedFractionCharges.reduce((sum, item) => sum + item.paid, 0),
    [selectedFractionCharges]
  );

  const selectedPortalFraction = useMemo(
    () => fractionsData.find((fraction) => fraction.id === selectedPortalFractionId) || fractionsData[0] || null,
    [fractionsData, selectedPortalFractionId]
  );
  const portalChargeRows = useMemo(
    () =>
      selectedPortalFraction
        ? chargesData
            .filter((charge) => charge.fractionId === selectedPortalFraction.id)
            .map((charge) => {
              const paid = paymentsData
                .filter((payment) => payment.chargeId === charge.id)
                .reduce((sum, payment) => sum + payment.amount, 0);
              const missing = Math.max(charge.amount - paid, 0);
              return {
                ...charge,
                paid,
                missing,
              };
            })
            .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
        : [],
    [selectedPortalFraction, chargesData, paymentsData]
  );
  const portalNextCharge = useMemo(
    () =>
      portalChargeRows
        .filter((charge) => charge.missing > 0)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0] || null,
    [portalChargeRows]
  );
  const portalPayments = useMemo(
    () =>
      selectedPortalFraction
        ? paymentsData
            .filter((payment) => payment.fractionId === selectedPortalFraction.id)
            .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
        : [],
    [selectedPortalFraction, paymentsData]
  );
  const portalOpenIssues = useMemo(
    () =>
      selectedPortalFraction
        ? issuesData.filter(
            (issue) =>
              !["resolved", "closed"].includes(issue.status) &&
              (issue.fractionId === selectedPortalFraction.id || issue.fractionId == null)
          )
        : [],
    [selectedPortalFraction, issuesData]
  );
  const portalVisibleDocuments = useMemo(
    () => visibleDocuments.filter((document) => ["residents", "all"].includes(document.visibility)),
    [visibleDocuments]
  );
  const portalCollectedYear = useMemo(
    () => portalPayments.reduce((sum, payment) => sum + payment.amount, 0),
    [portalPayments]
  );

  const inferAuditDomain = (text) => {
    const normalized = text.toLowerCase();
    if (normalized.includes("encargo") || normalized.includes("cobranca") || normalized.includes("cobrança") || normalized.includes("quota")) {
      return "financeiro";
    }
    if (normalized.includes("ocorrencia") || normalized.includes("fornecedor")) {
      return "operacional";
    }
    if (normalized.includes("assembleia") || normalized.includes("ata")) {
      return "governance";
    }
    if (normalized.includes("fracao") || normalized.includes("fração") || normalized.includes("titular")) {
      return "cadastros";
    }
    if (normalized.includes("rgpd") || normalized.includes("compliance")) {
      return "compliance";
    }
    return "sistema";
  };

  const auditEntries = useMemo(() => {
    const activityEntries = activityLog.slice(0, 80).map((item) => {
      const domain = inferAuditDomain(`${item.title} ${item.detail}`);
      return {
        id: `audit-activity-${item.id}`,
        when: item.createdAt,
        actor: activeProfileLabel,
        domain,
        action: item.title,
        detail: item.detail,
        tone: item.tone || "neutral",
      };
    });

    const overdueEntries = finance.openCharges.slice(0, 20).map((charge) => ({
      id: `audit-overdue-${charge.id}`,
      when: charge.dueDate,
      actor: "Sistema",
      domain: "financeiro",
      action: `Saldo em aberto na fração ${fractionCodeById[charge.fractionId] || charge.fractionId}`,
      detail: `${formatCurrency(charge.missing)} pendente | ${cleanLabel(charge.status)}`,
      tone: charge.status === "overdue" ? "danger" : "warning",
    }));

    const issueEntries = issuesData.slice(0, 20).map((issue) => ({
      id: `audit-issue-${issue.id}`,
      when: issue.openedAt,
      actor: "Sistema",
      domain: "operacional",
      action: `Ticket ${ISSUE_STATUS_LABEL[issue.status]}`,
      detail: `${issue.title} | ${PRIORITY_LABEL[issue.priority]}`,
      tone: statusTone(issue.priority),
    }));

    return [...apiAuditEntries, ...activityEntries, ...overdueEntries, ...issueEntries]
      .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
      .slice(0, 120);
  }, [activityLog, activeProfileLabel, apiAuditEntries, finance.openCharges, fractionCodeById, issuesData]);

  const filteredAuditEntries = useMemo(() => {
    return auditEntries.filter((entry) => {
      const byDomain = auditDomain === "all" || entry.domain === auditDomain;
      const byText =
        !auditQuery.trim() ||
        `${entry.action} ${entry.detail} ${entry.actor}`.toLowerCase().includes(auditQuery.trim().toLowerCase());
      return byDomain && byText;
    });
  }, [auditEntries, auditDomain, auditQuery]);

  const financeRows = useMemo(
    () =>
      finance.openCharges.filter((charge) => {
        const byStatus = financeStatusFilter === "all" || charge.status === financeStatusFilter;
        const byPeriod = financePeriodFilter === "all" || charge.period === financePeriodFilter;
        return byStatus && byPeriod;
      }),
    [finance.openCharges, financeStatusFilter, financePeriodFilter]
  );
  const financePeriods = useMemo(
    () => [...new Set(finance.openCharges.map((charge) => charge.period))].sort(),
    [finance.openCharges]
  );

  useEffect(() => {
    if (!financeRows.some((charge) => charge.id === selectedChargeId)) {
      setSelectedChargeId(financeRows[0]?.id || "");
    }
  }, [financeRows, selectedChargeId]);

  const selectedFinanceCharge = useMemo(
    () => financeRows.find((charge) => charge.id === selectedChargeId) || financeRows[0] || null,
    [financeRows, selectedChargeId]
  );
  const selectedFinanceChargePayments = useMemo(
    () =>
      selectedFinanceCharge
        ? paymentsData
            .filter((payment) => payment.chargeId === selectedFinanceCharge.id)
            .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
        : [],
    [selectedFinanceCharge, paymentsData]
  );

  const openQuickAction = () => {
    if (availableQuickActionTypes.length === 0) {
      setToastMessage(`O perfil ${activeProfileLabel} não tem permissões de criação.`);
      return;
    }

    const defaultType = availableQuickActionTypes.some((item) => item.id === activeModule)
      ? activeModule
      : availableQuickActionTypes[0].id;
    setQuickActionType(defaultType);
    setIsNotificationsOpen(false);
    setIsCommandPaletteOpen(false);
    setIsQuickActionOpen(true);
  };

  const openQuickActionType = (type) => {
    if (!availableQuickActionTypes.some((item) => item.id === type)) {
      setToastMessage(`Sem permissão no perfil ${activeProfileLabel} para criar ${cleanLabel(type)}.`);
      return;
    }

    setQuickActionType(type);
    setIsNotificationsOpen(false);
    setIsCommandPaletteOpen(false);
    setIsQuickActionOpen(true);
  };

  const navigateToContext = ({ module, targetId, targetType }) => {
    if (!profileCapability.modules.includes(module)) {
      setToastMessage(`Sem acesso ao módulo ${getModuleTitle(module)} no perfil ${activeProfileLabel}.`);
      return;
    }

    setIsQuickActionOpen(false);
    setIsNotificationsOpen(false);
    setIsCommandPaletteOpen(false);
    setActiveModule(module);

    if (module === "fractions" && targetId) {
      const fraction = fractionsData.find((item) => item.id === targetId);
      setFractionQuery(fraction?.code || "");
      setSelectedFractionId(targetId);
      setSelectedPortalFractionId(targetId);
    }

    if (module === "issues" && targetId) {
      setSelectedIssueId(targetId);
    }

    if (module === "finance" && targetType === "charge" && targetId) {
      setSelectedChargeId(targetId);
      setFinanceStatusFilter("all");
      setFinancePeriodFilter("all");
    }

    if (module === "documents" && targetId) {
      const document = visibleDocuments.find((item) => item.id === targetId);
      setDocQuery(document?.title || "");
    }
  };

  const globalResults = useMemo(() => {
    const query = globalQuery.trim().toLowerCase();
    if (query.length < 2) {
      return [];
    }

    const fractionMatches = profileCapability.modules.includes("fractions")
      ? fractionsData
          .filter((fraction) => {
            const owner = ownerByFraction[fraction.id] || "";
            return fraction.code.toLowerCase().includes(query) || owner.toLowerCase().includes(query);
          })
          .slice(0, 4)
          .map((fraction) => ({
            id: `fraction-${fraction.id}`,
            type: "Fração",
            module: "fractions",
            targetId: fraction.id,
            label: fraction.code,
            detail: `${ownerByFraction[fraction.id] || "Sem titular"} | Piso ${fraction.floorNumber}`,
          }))
      : [];

    const issueMatches = profileCapability.modules.includes("issues")
      ? issuesData
          .filter(
            (issue) =>
              issue.title.toLowerCase().includes(query) ||
              cleanLabel(issue.category).toLowerCase().includes(query)
          )
          .slice(0, 4)
          .map((issue) => ({
            id: `issue-${issue.id}`,
            type: "Ocorrência",
            module: "issues",
            targetId: issue.id,
            label: issue.title,
            detail: `${PRIORITY_LABEL[issue.priority]} | ${ISSUE_STATUS_LABEL[issue.status]}`,
          }))
      : [];

    const documentMatches = profileCapability.modules.includes("documents")
      ? visibleDocuments
          .filter(
            (document) =>
              document.title.toLowerCase().includes(query) ||
              cleanLabel(document.category).toLowerCase().includes(query)
          )
          .slice(0, 4)
          .map((document) => ({
            id: `document-${document.id}`,
            type: "Documento",
            module: "documents",
            targetId: document.id,
            label: document.title,
            detail: cleanLabel(document.category),
          }))
      : [];

    return [...fractionMatches, ...issueMatches, ...documentMatches].slice(0, 9);
  }, [globalQuery, fractionsData, ownerByFraction, issuesData, visibleDocuments, profileCapability]);

  const handleSelectGlobalResult = (result) => {
    navigateToContext({ module: result.module, targetId: result.targetId, targetType: result.type.toLowerCase() });
    setGlobalQuery("");
  };

  const handleOpenCommandPalette = () => {
    setIsQuickActionOpen(false);
    setIsNotificationsOpen(false);
    setIsCommandPaletteOpen(true);
  };

  const handleOpenNotifications = () => {
    setIsQuickActionOpen(false);
    setIsCommandPaletteOpen(false);
    setIsNotificationsOpen((previous) => !previous);
  };

  const handleMarkNotificationsRead = () => {
    setNotificationReadIds((previous) => [...new Set([...previous, ...notifications.map((notification) => notification.id)])]);
  };

  const handleSelectNotification = (notification) => {
    setNotificationReadIds((previous) => [...new Set([...previous, notification.id])]);
    navigateToContext({
      module: notification.module,
      targetId: notification.targetId,
      targetType: notification.targetType,
    });
  };

  const handleAdvanceIssueStatus = async (issueId) => {
    const issue = issuesData.find((item) => item.id === issueId);
    if (!issue) {
      return;
    }

    const nextStatus = nextIssueStatus(issue.status);
    if (!nextStatus) {
      setToastMessage("A ocorrência já está no estado final.");
      return;
    }

    const now = new Date().toISOString();
    let updatedIssue = {
      ...issue,
      status: nextStatus,
      closedAt: nextStatus === "resolved" || nextStatus === "closed" ? now : issue.closedAt,
    };

    if (isServerMode) {
      try {
        updatedIssue = await advanceIssueStatusApi(apiSession, issueId, nextStatus);
        setIssuesData((previous) => previous.map((item) => (item.id === issueId ? updatedIssue : item)));
      } catch (error) {
        setToastMessage(error instanceof Error ? error.message : "Nao foi possivel atualizar a ocorrencia.");
        return;
      }
    } else {
      setIssuesData((previous) => previous.map((item) => (item.id === issueId ? updatedIssue : item)));
    }

    if (nextStatus === "waiting_supplier") {
      const existingWorkOrder = workOrdersData.find((workOrder) => workOrder.issueId === issueId);
      if (!existingWorkOrder) {
        const supplierId = peopleData.find((person) => person.roleType === "supplier")?.id || null;
        if (supplierId) {
          const newWorkOrder = {
            id: `wo-manual-${Date.now().toString(36)}`,
            issueId,
            supplierPersonId: supplierId,
            requestedAt: now,
            scheduledAt: null,
            completedAt: null,
            estimatedCost: 120,
            finalCost: null,
            notes: "Ordem criada automaticamente ao encaminhar para fornecedor.",
          };
          setWorkOrdersData((previous) => [newWorkOrder, ...previous]);
        }
      }
    }

    if (nextStatus === "resolved" || nextStatus === "closed") {
      setWorkOrdersData((previous) =>
        previous.map((workOrder) =>
          workOrder.issueId === issueId
            ? {
                ...workOrder,
                completedAt: workOrder.completedAt || now,
                finalCost: workOrder.finalCost || workOrder.estimatedCost || 140,
              }
            : workOrder
        )
      );
    }

    setActivityLog((previous) => [
      {
        id: `act-${Date.now().toString(36)}-issue-status`,
        title: `Ocorrência ${issue.title} passou para ${ISSUE_STATUS_LABEL[nextStatus]}`,
        detail: `Fluxo operacional atualizado`,
        createdAt: now,
        tone: statusTone(nextStatus),
      },
      ...previous,
    ]);

    setToastMessage(`Ocorrência atualizada para ${ISSUE_STATUS_LABEL[nextStatus]}.`);
  };

  const handleRegisterPayment = async (chargeId) => {
    const charge = chargesData.find((item) => item.id === chargeId);
    if (!charge) {
      return;
    }

    const alreadyPaid = paymentsData
      .filter((payment) => payment.chargeId === chargeId)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const missing = Math.max(Number(charge.amount || 0) - alreadyPaid, 0);
    if (missing <= 0.009) {
      setToastMessage("Este encargo ja se encontra totalmente liquidado.");
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const amountInput = window.prompt("Valor do pagamento (EUR)", missing.toFixed(2));
    if (amountInput == null) {
      return;
    }

    const normalizedAmount = Number(amountInput.replace(",", "."));
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setToastMessage("Valor de pagamento invalido.");
      return;
    }

    const paymentAmount = Math.min(normalizedAmount, missing);
    const paidAt = new Date().toISOString().slice(0, 10);
    const reference = `MAN-${Date.now().toString(36).toUpperCase()}`;
    const method = "bank_transfer";
    let resultingChargeStatus = charge.status;

    if (isServerMode) {
      try {
        const result = await createPaymentApi(apiSession, {
          chargeId,
          amount: paymentAmount,
          method,
          paidAt,
          reference,
          source: "manual",
        });

        setPaymentsData((previous) => [result.item, ...previous]);
        resultingChargeStatus = result.chargeStatus || resultingChargeStatus;
        setChargesData((previous) =>
          previous.map((item) =>
            item.id === chargeId
              ? {
                  ...item,
                  status: resultingChargeStatus,
                }
              : item
          )
        );
        syncRuntimeFromApi(apiSession);
      } catch (error) {
        setToastMessage(error instanceof Error ? error.message : "Nao foi possivel registar o pagamento.");
        return;
      }
    } else {
      const localPayment = {
        id: `pay-manual-${Date.now().toString(36)}`,
        chargeId,
        condominiumId: charge.condominiumId || runtimeData.condominium.id,
        fractionId: charge.fractionId,
        method,
        amount: paymentAmount,
        paidAt,
        reference,
        source: "manual",
      };

      const totalAfter = alreadyPaid + paymentAmount;
      if (totalAfter >= Number(charge.amount || 0) - 0.009) {
        resultingChargeStatus = "paid";
      } else if (totalAfter > 0) {
        resultingChargeStatus = "partially_paid";
      }

      setPaymentsData((previous) => [localPayment, ...previous]);
      setChargesData((previous) =>
        previous.map((item) =>
          item.id === chargeId
            ? {
                ...item,
                status: resultingChargeStatus,
              }
            : item
        )
      );
    }

    setActivityLog((previous) => [
      {
        id: `act-${Date.now().toString(36)}-payment`,
        title: `Pagamento registado (${fractionCodeById[charge.fractionId] || charge.fractionId})`,
        detail: `${formatCurrency(paymentAmount)} | ${cleanLabel(method)} | ${reference}`,
        createdAt: new Date().toISOString(),
        tone: "success",
      },
      ...previous,
    ]);

    setToastMessage(`Pagamento registado com sucesso (${formatCurrency(paymentAmount)}).`);
  };

  const handleDownloadPaymentReceipt = useCallback(
    async (paymentId) => {
      if (!paymentId) {
        return;
      }

      try {
        if (isServerMode && apiSession) {
          const file = await downloadPaymentReceiptApi(apiSession, paymentId);
          downloadBlob(file.filename, file.blob);
          setPaymentsData((previous) =>
            previous.map((payment) =>
              payment.id === paymentId
                ? {
                    ...payment,
                    hasReceipt: true,
                  }
                : payment
            )
          );
          setToastMessage("Recibo PDF descarregado com sucesso.");
          return;
        }

        const placeholder = [
          "Recibo local de demonstração",
          `Pagamento: ${paymentId}`,
          `Data: ${new Date().toISOString().slice(0, 10)}`,
        ].join("\n");
        downloadBlob(`recibo-${paymentId}.txt`, new Blob([placeholder], { type: "text/plain;charset=utf-8;" }));
        setToastMessage("Recibo local descarregado.");
      } catch (error) {
        setToastMessage(error instanceof Error ? error.message : "Nao foi possivel descarregar o recibo.");
      }
    },
    [apiSession, isServerMode]
  );

  const handleExportCsv = () => {
    const exportDate = new Date().toISOString().slice(0, 10);
    const moduleSlug = activeModule;
    let columns = [];
    let rows = [];

    if (activeModule === "dashboard") {
      columns = [
        { key: "section", label: "Secção" },
        { key: "item", label: "Item" },
        { key: "value", label: "Valor" },
        { key: "detail", label: "Detalhe" },
      ];
      rows = [
        ...cards.map((card) => ({
          section: "kpi",
          item: card.label,
          value: card.value,
          detail: card.detail,
        })),
        ...nextDeadlines.map((item) => ({
          section: "agenda",
          item: item.title,
          value: item.amount ? formatCurrency(item.amount) : cleanLabel(item.type),
          detail: `${formatDate(item.date)} | ${cleanLabel(item.status)}`,
        })),
        ...activityLog.slice(0, 20).map((item) => ({
          section: "atividade",
          item: item.title,
          value: formatDate(item.createdAt),
          detail: item.detail,
        })),
      ];
    }

    if (activeModule === "fractions") {
      columns = [
        { key: "fracao", label: "Fração" },
        { key: "piso", label: "Piso" },
        { key: "tipo", label: "Tipo" },
        { key: "tipologia", label: "Tipologia" },
        { key: "titular", label: "Titular Principal" },
        { key: "quota", label: "Quota Mensal" },
        { key: "saldo", label: "Saldo" },
      ];
      rows = filteredFractions.map((fraction) => ({
        fracao: fraction.code,
        piso: fraction.floorNumber,
        tipo: cleanLabel(fraction.type),
        tipologia: fraction.typology,
        titular: ownerByFraction[fraction.id] || "Sem titular",
        quota: formatCurrency(fraction.monthlyFee),
        saldo: formatCurrency(fractionBalances[fraction.id]?.balance || 0),
      }));
    }

    if (activeModule === "finance") {
      columns = [
        { key: "fracao", label: "Fração" },
        { key: "periodo", label: "Período" },
        { key: "vencimento", label: "Vencimento" },
        { key: "valor", label: "Valor" },
        { key: "emFalta", label: "Em Falta" },
        { key: "estado", label: "Estado" },
      ];
      rows = financeRows.map((charge) => ({
        fracao: fractionCodeById[charge.fractionId] || charge.fractionId,
        periodo: charge.period,
        vencimento: formatDate(charge.dueDate),
        valor: formatCurrency(charge.amount),
        emFalta: formatCurrency(charge.missing),
        estado: ISSUE_STATUS_LABEL[charge.status] || cleanLabel(charge.status),
      }));
    }

    if (activeModule === "issues") {
      columns = [
        { key: "id", label: "ID" },
        { key: "titulo", label: "Título" },
        { key: "categoria", label: "Categoria" },
        { key: "prioridade", label: "Prioridade" },
        { key: "estado", label: "Estado" },
        { key: "fracao", label: "Fração" },
        { key: "fornecedor", label: "Fornecedor" },
      ];
      rows = issuesData.map((issue) => ({
        id: issue.id,
        titulo: issue.title,
        categoria: cleanLabel(issue.category),
        prioridade: PRIORITY_LABEL[issue.priority],
        estado: ISSUE_STATUS_LABEL[issue.status] || cleanLabel(issue.status),
        fracao: issue.fractionId ? fractionCodeById[issue.fractionId] || issue.fractionId : "Área comum",
        fornecedor: issue.assignedSupplierPersonId ? peopleById[issue.assignedSupplierPersonId]?.fullName || "-" : "-",
      }));
    }

    if (activeModule === "assemblies") {
      columns = [
        { key: "id", label: "ID" },
        { key: "tipo", label: "Tipo" },
        { key: "data", label: "Data" },
        { key: "local", label: "Local" },
        { key: "pontos", label: "Pontos" },
      ];
      rows = assembliesData.map((assembly) => ({
        id: assembly.id,
        tipo: assembly.meetingType === "ordinary" ? "Ordinária" : "Extraordinária",
        data: formatDate(assembly.scheduledAt),
        local: assembly.location,
        pontos: assembly.voteItems.length,
      }));
    }

    if (activeModule === "portal") {
      columns = [
        { key: "fracao", label: "Fração" },
        { key: "titular", label: "Titular" },
        { key: "periodo", label: "Período" },
        { key: "vencimento", label: "Vencimento" },
        { key: "valor", label: "Valor" },
        { key: "pago", label: "Pago" },
        { key: "emFalta", label: "Em Falta" },
        { key: "estado", label: "Estado" },
      ];
      rows = portalChargeRows.map((charge) => ({
        fracao: selectedPortalFraction?.code || "-",
        titular: selectedPortalFraction ? ownerByFraction[selectedPortalFraction.id] || "Sem titular" : "-",
        periodo: charge.period,
        vencimento: formatDate(charge.dueDate),
        valor: formatCurrency(charge.amount),
        pago: formatCurrency(charge.paid),
        emFalta: formatCurrency(charge.missing),
        estado: cleanLabel(charge.status),
      }));
    }

    if (activeModule === "documents") {
      columns = [
        { key: "titulo", label: "Título" },
        { key: "categoria", label: "Categoria" },
        { key: "visibilidade", label: "Visibilidade" },
        { key: "upload", label: "Upload" },
        { key: "caminho", label: "Caminho" },
      ];
      rows = documentList.map((document) => ({
        titulo: document.title,
        categoria: cleanLabel(document.category),
        visibilidade: cleanLabel(document.visibility),
        upload: formatDate(document.uploadedAt),
        caminho: document.storagePath,
      }));
    }

    if (activeModule === "compliance") {
      columns = [
        { key: "tipo", label: "Tipo" },
        { key: "item", label: "Item" },
        { key: "estado", label: "Estado" },
        { key: "responsavel", label: "Responsável" },
      ];
      rows = [
        ...COMPLIANCE_TASKS.map((task) => ({
          tipo: "task",
          item: task.title,
          estado: task.status,
          responsavel: task.owner,
        })),
        ...TEMPLATE_CHECKLIST.map((template) => ({
          tipo: "template",
          item: template.label,
          estado: template.status === "ready" ? "Pronto" : "Em falta",
          responsavel: "Jurídico",
        })),
        ...filteredAuditEntries.slice(0, 80).map((entry) => ({
          tipo: "audit",
          item: entry.action,
          estado: cleanLabel(entry.domain),
          responsavel: entry.actor,
        })),
      ];
    }

    if (rows.length === 0) {
      setToastMessage("Não existem dados para exportar neste módulo.");
      return;
    }

    const presetKeys = getExportPresetKeys(activeModule, activeProfile);
    const profileColumns = columns.filter((column) => presetKeys.includes(column.key));

    if (profileColumns.length === 0) {
      setToastMessage("O preset atual não tem colunas para este módulo.");
      return;
    }

    const csv = buildCsv(profileColumns, rows);
    downloadCsv(`condoos-${moduleSlug}-${activeProfile}-${exportDate}.csv`, csv);
    setToastMessage(`CSV exportado (${rows.length} linhas) no preset ${activeProfile}.`);
    setActivityLog((previous) => [
      {
        id: `act-${Date.now().toString(36)}-export`,
        title: `Exportação CSV do módulo ${getModuleTitle(activeModule)}`,
        detail: `Preset ${activeProfileLabel} | ${rows.length} linhas`,
        createdAt: new Date().toISOString(),
        tone: "neutral",
      },
      ...previous,
    ]);
  };

  const commandActions = useCommandActions({
    availableModules,
    availableQuickActionTypes,
    activeProfileLabel,
    commandQuery,
    navigateToContext,
    openQuickActionType,
    handleExportCsv,
    unreadCount: unreadNotifications.length,
    setIsCommandPaletteOpen,
    setIsNotificationsOpen,
    setGlobalQuery,
  });

  const handleExecuteCommandAction = (actionId) => {
    const action = commandActions.find((item) => item.id === actionId);
    if (!action) {
      return;
    }

    action.onSelect();
    setIsCommandPaletteOpen(false);
  };

  const handleQuickActionSubmit = async ({ type, values }) => {
    if (!availableQuickActionTypes.some((item) => item.id === type)) {
      throw new Error(`O perfil ${activeProfileLabel} não permite criar ${cleanLabel(type)}.`);
    }

    if (type === "fractions") {
      const code = values.code.trim().toUpperCase();
      if (!code) {
        throw new Error("Indica o código da fração.");
      }

      if (fractionsData.some((fraction) => fraction.code === code)) {
        throw new Error(`A fração ${code} já existe.`);
      }

      const safeCode = code.toLowerCase().replace(/[^a-z0-9]/g, "");
      const fractionId = `fraction-${safeCode || Date.now().toString(36)}`;
      const floorNumber = Number(values.floorNumber || 0);
      const monthlyFee = Number(values.monthlyFee || 0);
      let createdFractionId = fractionId;

      if (isServerMode) {
        const createdFraction = await createFractionApi(apiSession, {
          code,
          floorNumber,
          type: values.type,
          typology: values.typology || "N/A",
          privateAreaM2: Number(values.privateAreaM2 || 80),
          permillage: Number(values.permillage || 30),
          monthlyFeeAmount: monthlyFee,
          status: "active",
        });

        createdFractionId = createdFraction.id;
        setFractionsData((previous) =>
          [...previous, createdFraction].sort((a, b) =>
            a.floorNumber === b.floorNumber ? a.code.localeCompare(b.code) : a.floorNumber - b.floorNumber
          )
        );

        let ownerLinked = false;
        if (values.ownerName.trim()) {
          const createdOwner = await createPersonApi(apiSession, {
            fullName: values.ownerName.trim(),
            roleType: "owner",
            taxNumber: values.ownerTaxNumber.trim(),
            email: values.ownerEmail.trim(),
            phone: values.ownerPhone.trim(),
          });
          setPeopleData((previous) => [...previous, createdOwner]);

          const createdRelation = await createFractionPartyApi(apiSession, {
            fractionId: createdFraction.id,
            personId: createdOwner.id,
            relationship: "owner",
            startDate: new Date().toISOString().slice(0, 10),
            endDate: null,
            isPrimary: true,
          });
          setFractionPartiesData((previous) => [
            ...previous.filter(
              (relation) =>
                !(
                  relation.fractionId === createdRelation.fractionId &&
                  relation.relationship === "owner" &&
                  relation.isPrimary
                )
            ),
            createdRelation,
          ]);
          ownerLinked = true;
        }

        setToastMessage(
          ownerLinked ? `Fração ${code} criada com titular principal associado.` : `Fração ${code} criada com sucesso.`
        );
      } else {
        const privateAreaM2 = Number(values.privateAreaM2 || 80);
        const newFraction = {
          id: fractionId,
          code,
          floorNumber,
          type: values.type,
          typology: values.typology || "N/A",
          privateAreaM2,
          permillage: Number(values.permillage || 30),
          monthlyFee,
          status: "active",
        };

        setFractionsData((previous) =>
          [...previous, newFraction].sort((a, b) =>
            a.floorNumber === b.floorNumber ? a.code.localeCompare(b.code) : a.floorNumber - b.floorNumber
          )
        );

        if (values.ownerName.trim()) {
          const ownerId = `person-owner-manual-${Date.now().toString(36)}`;
          const relationId = `fp-owner-manual-${Date.now().toString(36)}`;

          setPeopleData((previous) => [
            ...previous,
            {
              id: ownerId,
              fullName: values.ownerName.trim(),
              roleType: "owner",
              taxNumber: values.ownerTaxNumber.trim(),
              email: values.ownerEmail.trim(),
              phone: values.ownerPhone.trim(),
            },
          ]);

          setFractionPartiesData((previous) => [
            ...previous,
            {
              id: relationId,
              fractionId,
              personId: ownerId,
              relationship: "owner",
              startDate: new Date().toISOString().slice(0, 10),
              endDate: null,
              isPrimary: true,
            },
          ]);
        }

        setToastMessage(`Fração ${code} criada com sucesso.`);
      }

      setSelectedFractionId(createdFractionId);
      setSelectedPortalFractionId(createdFractionId);
      setActivityLog((previous) => [
        {
          id: `act-${Date.now().toString(36)}-fraction`,
          title: `Fração ${code} criada`,
          detail: `Piso ${floorNumber} | ${cleanLabel(values.type)} | ${formatCurrency(monthlyFee)}`,
          createdAt: new Date().toISOString(),
          tone: "success",
        },
        ...previous,
      ]);
      setActiveModule("fractions");
    }

    if (type === "finance") {
      const amount = Number(values.amount || 0);
      if (amount <= 0) {
        throw new Error("Indica um valor válido para o encargo.");
      }

      if (!values.fractionId) {
        throw new Error("Seleciona a fração do encargo.");
      }

      const fractionCode = fractionCodeById[values.fractionId] || "GEN";
      let createdChargeId = "";

      if (isServerMode) {
        const createdCharge = await createChargeApi(apiSession, {
          fractionId: values.fractionId,
          kind: values.kind,
          period: values.period || new Date().toISOString().slice(0, 7),
          dueDate: values.dueDate || new Date().toISOString().slice(0, 10),
          amount,
          status: "open",
        });
        createdChargeId = createdCharge.id;
        setChargesData((previous) => [createdCharge, ...previous]);
      } else {
        const period = values.period || new Date().toISOString().slice(0, 7);
        const suffix = Date.now().toString(36).slice(-5);
        const newCharge = {
          id: `charge-${period}-${fractionCode.toLowerCase()}-${suffix}`,
          condominiumId: runtimeData.condominium.id,
          fractionId: values.fractionId,
          kind: values.kind,
          period,
          dueDate: values.dueDate || new Date().toISOString().slice(0, 10),
          amount,
          status: "open",
        };

        createdChargeId = newCharge.id;
        setChargesData((previous) => [newCharge, ...previous]);
      }

      setSelectedChargeId(createdChargeId);
      setToastMessage(`Encargo criado para a fração ${fractionCode}.`);
      setActivityLog((previous) => [
        {
          id: `act-${Date.now().toString(36)}-charge`,
          title: `Encargo criado para ${fractionCode}`,
          detail: `${cleanLabel(values.kind)} | ${formatCurrency(amount)} | Vencimento ${formatDate(values.dueDate)}`,
          createdAt: new Date().toISOString(),
          tone: "warning",
        },
        ...previous,
      ]);
      setActiveModule("finance");
    }

    if (type === "issues") {
      if (!values.title.trim()) {
        throw new Error("Indica um título para a ocorrência.");
      }

      const managerId =
        peopleData.find((person) => person.roleType === "manager")?.id ||
        peopleData.find((person) => person.roleType === "owner")?.id;

      let createdIssue;

      if (isServerMode) {
        createdIssue = await createIssueApi(apiSession, {
          fractionId: values.fractionId === "common" ? null : values.fractionId,
          createdByPersonId: managerId,
          category: values.category,
          priority: values.priority,
          status: "new",
          title: values.title.trim(),
          description: values.description.trim() || `Descricao inicial: ${values.title.trim()}.`,
          assignedSupplierPersonId: null,
        });
      } else {
        createdIssue = {
          id: `issue-${String(issuesData.length + 1).padStart(3, "0")}-${Date.now().toString(36).slice(-3)}`,
          condominiumId: runtimeData.condominium.id,
          fractionId: values.fractionId === "common" ? null : values.fractionId,
          createdByPersonId: managerId,
          category: values.category,
          priority: values.priority,
          status: "new",
          title: values.title.trim(),
          description: values.description.trim() || `Descrição inicial: ${values.title.trim()}.`,
          openedAt: new Date().toISOString(),
          closedAt: null,
          assignedSupplierPersonId: null,
        };
      }

      setIssuesData((previous) => [createdIssue, ...previous]);
      setSelectedIssueId(createdIssue.id);
      setToastMessage("Ocorrência registada na coluna Novo.");
      setActivityLog((previous) => [
        {
          id: `act-${Date.now().toString(36)}-issue`,
          title: `Ocorrência criada: ${createdIssue.title}`,
          detail: `${cleanLabel(createdIssue.category)} | ${PRIORITY_LABEL[createdIssue.priority]}`,
          createdAt: new Date().toISOString(),
          tone: statusTone(createdIssue.priority),
        },
        ...previous,
      ]);
      setActiveModule("issues");
    }

    if (type === "assemblies") {
      if (!values.scheduledAt) {
        throw new Error("Define data e hora da assembleia.");
      }

      const scheduleISO = new Date(values.scheduledAt).toISOString();
      const newAssembly = {
        id: `assembly-${Date.now().toString(36)}`,
        condominiumId: runtimeData.condominium.id,
        meetingType: values.meetingType,
        scheduledAt: scheduleISO,
        location: values.location.trim() || "Sala comum do condomínio",
        callNoticeSentAt: new Date().toISOString(),
        minutesDocumentId: null,
        voteItems: [],
      };

      setAssembliesData((previous) =>
        [...previous, newAssembly].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      );
      setToastMessage("Assembleia adicionada ao planeamento.");
      setActivityLog((previous) => [
        {
          id: `act-${Date.now().toString(36)}-assembly`,
          title: `Assembleia ${values.meetingType === "ordinary" ? "ordinária" : "extraordinária"} agendada`,
          detail: `${formatDate(scheduleISO)} | ${newAssembly.location}`,
          createdAt: new Date().toISOString(),
          tone: "neutral",
        },
        ...previous,
      ]);
      setActiveModule("assemblies");
    }

    if (isServerMode) {
      syncRuntimeFromApi(apiSession);
    }

    setIsQuickActionOpen(false);
  };

  const tenantDisplayName = isServerMode ? apiSession.tenantName || runtimeData.condominium.name : runtimeData.condominium.name;
  const topHeaderValue = `${tenantDisplayName} | ${runtimeData.condominium.city} | ${isServerMode ? "API" : "Local"}`;

  if (!isServerMode) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LoginPage
          apiLoginForm={apiLoginForm}
          setApiLoginForm={setApiLoginForm}
          apiLoginError={apiLoginError}
          isApiSyncing={isApiSyncing}
          showDemoProfiles={DEMO_LOGIN_ENABLED && DEMO_PROFILES_AVAILABLE.length > 0}
          demoProfiles={DEMO_PROFILES_AVAILABLE}
          onSubmit={handleApiLogin}
          onLoginAsProfile={handleApiLoginAsDemoProfile}
        />
      </Suspense>
    );
  }

  return (
    <div className={`condo-app${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <div className="orb orb-one" aria-hidden="true" />
      <div className="orb orb-two" aria-hidden="true" />

      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand-lockup">
            {!sidebarCollapsed && <img className="brand-wordmark" src={BRAND_WORDMARK_SRC} alt="Condoo" />}
            {sidebarCollapsed && <img className="brand-symbol-mini" src={BRAND_SYMBOL_SRC} alt="Condoo" style={{ width: 28, height: 28 }} />}
          </div>

          {!sidebarCollapsed && (
            <div className="sidebar-tenant-card">
              <Icon name="Building2" size={16} className="sidebar-tenant-icon" />
              <div>
                <strong>{tenantDisplayName}</strong>
                <small>11 andares · {fractionsData.length} frações</small>
              </div>
            </div>
          )}

          {!sidebarCollapsed && (
            <TenantSelector
              tenants={apiSession?.tenants}
              selectedTenantId={selectedTenantId || apiSession?.tenantId}
              onTenantChange={handleTenantChange}
            />
          )}

          {!sidebarCollapsed && <p className="sidebar-section-label">Módulos</p>}

          <nav className="module-nav" aria-label="Módulos principais">
            {availableModules.map((module) => {
              const isActive = activeModule === module.id;
              return (
                <button
                  key={module.id}
                  type="button"
                  className={isActive ? "module-btn active" : "module-btn"}
                  onClick={() => setActiveModule(module.id)}
                  title={sidebarCollapsed ? module.label : undefined}
                >
                  <div className="module-btn-left">
                    <Icon name={module.icon} size={17} />
                    {!sidebarCollapsed && <span>{module.label}</span>}
                  </div>
                  {!sidebarCollapsed && moduleBadge[module.id] ? <small>{moduleBadge[module.id]}</small> : null}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-bottom">
          {!sidebarCollapsed && (
            <details className="sidebar-debug">
              <summary>
                <Icon name="Settings" size={14} />
                <span>Detalhes da sessão</span>
              </summary>
              <div className="sidebar-debug-content">
                <p className="api-meta">
                  Tenant: <strong>{apiSession.tenantName || apiSession.tenantId}</strong>
                </p>
                <p className="api-meta">
                  Sync: <strong>{apiLastSyncAt ? formatDate(apiLastSyncAt) : "-"}</strong>
                </p>
                <div className="api-actions">
                  <button type="button" className="ghost-btn compact" onClick={handleApiSyncNow} disabled={isApiSyncing}>
                    <Icon name="RefreshCw" size={13} />
                    {isApiSyncing ? "A sincronizar..." : "Sincronizar"}
                  </button>
                </div>
              </div>
            </details>
          )}

          <div className="sidebar-bottom-actions">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === "light" ? "Ativar modo escuro" : "Ativar modo claro"}
              title={theme === "light" ? "Modo escuro" : "Modo claro"}
            >
              <Icon name={theme === "light" ? "Moon" : "Sun"} size={16} />
            </button>
            <button
              type="button"
              className="sidebar-collapse-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
              title={sidebarCollapsed ? "Expandir" : "Colapsar"}
            >
              <Icon name={sidebarCollapsed ? "PanelLeft" : "PanelLeftClose"} size={16} />
            </button>
          </div>

          <div className="sidebar-user">
            <div className="sidebar-avatar">
              <Icon name="User" size={16} />
            </div>
            {!sidebarCollapsed && (
              <div className="sidebar-user-info">
                <strong>{apiSession.user?.email || "demo@condoos.pt"}</strong>
                <small>{activeProfileLabel} · online</small>
              </div>
            )}
            <button type="button" className="sidebar-logout-btn" onClick={handleApiLogout} aria-label="Terminar sessão">
              <Icon name="LogOut" size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <div className="workspace-brandline">
              <img className="workspace-brand-icon" src={BRAND_SYMBOL_SRC} alt="" aria-hidden="true" />
              <p className="eyebrow">{isServerMode ? "Ambiente de integração API" : "Ambiente de demonstração"}</p>
            </div>
            <h2>{getModuleTitle(activeModule)}</h2>
            <p>{topHeaderValue}</p>
            <small className="profile-hint">
              Perfil ativo: {activeProfileLabel}
              {isServerMode ? " (enforcement backend)" : " (modo local)"}
            </small>
          </div>

          <div className="header-tools">
            <div className="global-search-wrap">
              <Icon name="Search" size={16} className="global-search-icon" />
              <input
                type="search"
                value={globalQuery}
                onChange={(event) => setGlobalQuery(event.target.value)}
                placeholder="Pesquisar fração, ocorrência ou documento"
              />
              {globalResults.length > 0 ? (
                <ul className="global-results">
                  {globalResults.map((result) => (
                    <li key={result.id}>
                      <button type="button" onClick={() => handleSelectGlobalResult(result)}>
                        <strong>{result.label}</strong>
                        <small>
                          {result.type} | {result.detail}
                        </small>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <select
              className="profile-select"
              value={activeProfile}
              onChange={(event) => setActiveProfile(event.target.value)}
              aria-label="Preset de exportação"
              disabled={isServerMode}
            >
              {PROFILE_OPTIONS.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  Preset: {profile.label}
                </option>
              ))}
            </select>

            <div className="header-actions">
              <button type="button" className="ghost-btn" onClick={handleOpenCommandPalette}>
                <Icon name="Command" size={15} />
                Comandos
                <span className="shortcut-hint">{commandShortcutLabel}</span>
              </button>
              <button type="button" className="ghost-btn notification-btn" onClick={handleOpenNotifications}>
                <Icon name="Bell" size={15} />
                Alertas
                {unreadNotifications.length > 0 ? (
                  <span className="notification-count">{unreadNotifications.length}</span>
                ) : null}
              </button>
              <button type="button" className="ghost-btn" onClick={handleExportCsv}>
                <Icon name="Download" size={15} />
                Exportar CSV
              </button>
              <button type="button" className="primary-btn" onClick={openQuickAction} disabled={!hasQuickActions}>
                <Icon name="Plus" size={15} />
                {hasQuickActions ? HEADER_ACTION_LABEL[activeModule] : "Sem permissão de criação"}
              </button>
            </div>
          </div>
        </header>

        <ErrorBoundary key={activeModule}>
        <Suspense fallback={<PageLoader />}>
        <AnimateSection keyName={activeModule} disableAnimation={isCaptureMode}>
          {activeModule === "dashboard" && (
            <DashboardPage
              cards={cards}
              floorMatrix={floorMatrix}
              nextDeadlines={nextDeadlines}
              disableMotion={isCaptureMode}
              activityLog={activityLog}
              onboardingChecklist={onboardingChecklist}
              onboardingCompletion={onboardingCompletion}
              onOpenAction={openQuickActionType}
            />
          )}

          {activeModule === "fractions" && (
            <FractionsPage
              fractions={filteredFractions}
              ownerByFraction={ownerByFraction}
              balances={fractionBalances}
              fractionFilter={fractionFilter}
              setFractionFilter={setFractionFilter}
              fractionFloorFilter={fractionFloorFilter}
              setFractionFloorFilter={setFractionFloorFilter}
              floorOptions={floorOptions}
              fractionDebtFilter={fractionDebtFilter}
              setFractionDebtFilter={setFractionDebtFilter}
              fractionQuery={fractionQuery}
              setFractionQuery={setFractionQuery}
              typeSummary={fractionTypeSummary}
              selectedFraction={selectedFraction}
              selectedFractionCharges={selectedFractionCharges}
              selectedFractionPaymentsTotal={selectedFractionPaymentsTotal}
              onSelectFraction={setSelectedFractionId}
              onOpenAction={openQuickActionType}
            />
          )}

          {activeModule === "finance" && (
            <FinancePage
              finance={finance}
              fractions={fractionsData}
              financeRows={financeRows}
              financePeriods={financePeriods}
              financeStatusFilter={financeStatusFilter}
              setFinanceStatusFilter={setFinanceStatusFilter}
              financePeriodFilter={financePeriodFilter}
              setFinancePeriodFilter={setFinancePeriodFilter}
              selectedFinanceCharge={selectedFinanceCharge}
              selectedFinanceChargePayments={selectedFinanceChargePayments}
              onSelectCharge={setSelectedChargeId}
              onOpenAction={openQuickActionType}
              onRegisterPayment={handleRegisterPayment}
              onDownloadReceipt={handleDownloadPaymentReceipt}
            />
          )}

          {activeModule === "reports" && (
            <ReportsPage
              session={apiSession}
              fractions={fractionsData}
            />
          )}

          {activeModule === "issues" && (
            <IssuesPage
              issuesByStatus={issuesByStatus}
              peopleById={peopleById}
              onOpenAction={openQuickActionType}
              selectedIssue={selectedIssue}
              selectedIssueTimeline={selectedIssueTimeline}
              selectedIssueAttachments={selectedIssueAttachments}
              selectedIssueWorkOrder={selectedIssueWorkOrder}
              selectedIssueNextStatus={selectedIssueNextStatus}
              onSelectIssue={setSelectedIssueId}
              onAdvanceIssueStatus={handleAdvanceIssueStatus}
              fractionCodeById={fractionCodeById}
            />
          )}

          {activeModule === "assemblies" && (
            <AssembliesPage assemblies={assembliesData} onOpenAction={openQuickActionType} />
          )}

          {activeModule === "documents" && (
            <DocumentsPage
              documents={documentList}
              docQuery={docQuery}
              setDocQuery={setDocQuery}
              showVisibility={canShowDocumentVisibility}
              showStoragePath={activeProfile === "manager"}
              onDownloadDocument={handleDocumentDownload}
              onUploadDocument={canUploadDocuments ? () => triggerDocumentUpload(null) : null}
              onUploadDocumentVersion={canUploadDocuments ? (document) => triggerDocumentUpload(document) : null}
              isUploadingDocument={isUploadingDocument}
            />
          )}

          {activeModule === "portal" && (
            <PortalPage
              selectedFraction={selectedPortalFraction}
              fractions={fractionsData}
              ownerByFraction={ownerByFraction}
              balances={fractionBalances}
              portalChargeRows={portalChargeRows}
              portalPayments={portalPayments}
              portalOpenIssues={portalOpenIssues}
              portalVisibleDocuments={portalVisibleDocuments}
              portalNextCharge={portalNextCharge}
              portalCollectedYear={portalCollectedYear}
              onSelectFraction={setSelectedPortalFractionId}
              onOpenAction={openQuickActionType}
              onExport={handleExportCsv}
              onDownloadDocument={handleDocumentDownload}
              onDownloadReceipt={handleDownloadPaymentReceipt}
            />
          )}

          {activeModule === "compliance" && (
            <CompliancePage
              auditEntries={filteredAuditEntries}
              auditQuery={auditQuery}
              setAuditQuery={setAuditQuery}
              auditDomain={auditDomain}
              setAuditDomain={setAuditDomain}
            />
          )}
        </AnimateSection>
        </Suspense>
        </ErrorBoundary>
      </main>

      <nav className="mobile-nav" aria-label="Navegação móvel">
        {availableModules.map((module) => (
          <button
            key={module.id}
            type="button"
            className={module.id === activeModule ? "mobile-nav-btn active" : "mobile-nav-btn"}
            onClick={() => setActiveModule(module.id)}
          >
            <Icon name={module.icon} size={20} />
            <span>{module.mobile}</span>
          </button>
        ))}
      </nav>

      <input
        ref={documentUploadInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.zip,.json,application/pdf,image/*,text/plain,text/csv,application/json,application/zip"
        style={{ display: "none" }}
        onChange={handleDocumentUploadSelection}
      />

      <Suspense fallback={null}>
        <QuickActionDrawer
          open={isQuickActionOpen}
          actionType={quickActionType}
          allowedActionTypes={availableQuickActionTypes}
          onActionTypeChange={setQuickActionType}
          onClose={() => setIsQuickActionOpen(false)}
          onSubmit={handleQuickActionSubmit}
          fractions={fractionsData}
          allowCommonIssueArea={activeProfile !== "resident"}
          issueCategories={baseData.catalogs.issueCategories}
        />

        <NotificationCenter
          open={isNotificationsOpen}
          notifications={notifications}
          readIds={notificationReadIds}
          unreadCount={unreadNotifications.length}
          onClose={() => setIsNotificationsOpen(false)}
          onMarkAllRead={handleMarkNotificationsRead}
          onSelectNotification={handleSelectNotification}
        />

        <CommandPalette
          open={isCommandPaletteOpen}
          query={commandQuery}
          actions={commandActions}
          onQueryChange={setCommandQuery}
          onClose={() => setIsCommandPaletteOpen(false)}
          onSelectAction={handleExecuteCommandAction}
        />
      </Suspense>

      {toastMessage ? <div className="toast-note">{toastMessage}</div> : null}
    </div>
  );
}

export default App;
