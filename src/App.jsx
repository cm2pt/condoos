import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import seedData from "../data/synthetic/condominio_portugal_seed.json";

const MODULES = [
  { id: "dashboard", label: "Painel", mobile: "Painel" },
  { id: "fractions", label: "Frações", mobile: "Frações" },
  { id: "finance", label: "Financeiro", mobile: "Financeiro" },
  { id: "issues", label: "Ocorrências", mobile: "Ocorrências" },
  { id: "assemblies", label: "Assembleias", mobile: "Assembleias" },
  { id: "portal", label: "Portal condómino", mobile: "Portal" },
  { id: "documents", label: "Documentos", mobile: "Docs" },
  { id: "compliance", label: "Compliance", mobile: "RGPD" },
];

const QUICK_ACTION_TYPES = [
  { id: "fractions", label: "Fração" },
  { id: "finance", label: "Encargo" },
  { id: "issues", label: "Ocorrência" },
  { id: "assemblies", label: "Assembleia" },
];

const HEADER_ACTION_LABEL = {
  dashboard: "Nova ação",
  fractions: "Nova fração",
  finance: "Novo encargo",
  issues: "Nova ocorrência",
  assemblies: "Nova assembleia",
  portal: "Nova ação",
  documents: "Nova ação",
  compliance: "Nova ação",
};

const PROFILE_OPTIONS = [
  { id: "manager", label: "Gestão" },
  { id: "accounting", label: "Contabilidade" },
  { id: "operations", label: "Operações" },
];

const PROFILE_CAPABILITIES = {
  manager: {
    modules: ["dashboard", "fractions", "finance", "issues", "assemblies", "portal", "documents", "compliance"],
    quickActions: ["fractions", "finance", "issues", "assemblies"],
  },
  accounting: {
    modules: ["dashboard", "fractions", "finance", "portal", "documents", "compliance"],
    quickActions: ["fractions", "finance"],
  },
  operations: {
    modules: ["dashboard", "fractions", "finance", "issues", "assemblies", "portal", "documents", "compliance"],
    quickActions: ["fractions", "issues", "assemblies"],
  },
};

const STORAGE_KEY = "condoos_runtime_v1";

const ISSUE_COLUMNS = [
  { key: "new", label: "Novo" },
  { key: "triage", label: "Triagem" },
  { key: "in_progress", label: "Em curso" },
  { key: "waiting_supplier", label: "Fornecedor" },
  { key: "resolved", label: "Resolvido" },
  { key: "closed", label: "Fechado" },
];

const PRIORITY_LABEL = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

const ISSUE_STATUS_LABEL = {
  new: "Novo",
  triage: "Triagem",
  in_progress: "Em curso",
  waiting_supplier: "Fornecedor",
  resolved: "Resolvido",
  closed: "Fechado",
};

const ISSUE_STATUS_FLOW = ["new", "triage", "in_progress", "waiting_supplier", "resolved", "closed"];

const TEMPLATE_CHECKLIST = [
  { id: "convocatoria", label: "Convocatória de assembleia", status: "ready" },
  { id: "ata", label: "Ata de assembleia", status: "ready" },
  { id: "procuracao", label: "Procuração", status: "ready" },
  { id: "divida", label: "Notificação de quota em atraso", status: "ready" },
  { id: "privacidade", label: "Política de privacidade", status: "ready" },
  { id: "dpa", label: "Acordo DPA", status: "ready" },
  { id: "incidente", label: "Registo de incidente RGPD", status: "ready" },
  { id: "plano-pagamento", label: "Plano de pagamento de dívida", status: "ready" },
];

const COMPLIANCE_TASKS = [
  {
    title: "Mapear base legal por tipo de tratamento",
    owner: "Gestão",
    dueDate: "2026-02-20",
    status: "Em execução",
  },
  {
    title: "Publicar política de retenção por módulo",
    owner: "Produto",
    dueDate: "2026-02-24",
    status: "Em revisão",
  },
  {
    title: "Fluxo de resposta a direitos do titular",
    owner: "Suporte",
    dueDate: "2026-02-28",
    status: "Pronto",
  },
  {
    title: "Checklist de notificação de incidente",
    owner: "Segurança",
    dueDate: "2026-03-02",
    status: "Pronto",
  },
];

const numberFormatter = new Intl.NumberFormat("pt-PT");
const currencyFormatter = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});
const dateFormatter = new Intl.DateTimeFormat("pt-PT", {
  dateStyle: "medium",
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

function formatDate(dateLike) {
  if (!dateLike) {
    return "-";
  }

  return dateFormatter.format(new Date(dateLike));
}

function statusTone(status) {
  if (status === "paid" || status === "resolved" || status === "closed" || status === "Pronto") {
    return "success";
  }

  if (status === "overdue" || status === "critical" || status === "Crítica") {
    return "danger";
  }

  if (status === "partially_paid" || status === "in_progress" || status === "Em execução") {
    return "warning";
  }

  return "neutral";
}

function cleanLabel(value) {
  const tokenOverrides = {
    habitacao: "Habitação",
    arrecadacao: "Arrecadação",
    infiltracao: "Infiltração",
    iluminacao: "Iluminação",
    canalizacao: "Canalização",
    media: "Média",
    critica: "Crítica",
    ordinaria: "Ordinária",
    extraordinaria: "Extraordinária",
    abstencao: "Abstenção",
  };

  return String(value || "")
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((token) => tokenOverrides[token.toLowerCase()] || token.replace(/^\w/, (char) => char.toUpperCase()))
    .join(" ");
}

function buildPeopleById(people) {
  return Object.fromEntries(people.map((person) => [person.id, person]));
}

function buildPrimaryOwnerByFraction(data, peopleById) {
  const ownerMap = {};

  data.fractionParties
    .filter((item) => item.relationship === "owner" && item.isPrimary)
    .forEach((item) => {
      ownerMap[item.fractionId] = peopleById[item.personId]?.fullName ?? "Sem titular";
    });

  return ownerMap;
}

function buildFinanceBreakdown(data) {
  const chargeById = Object.fromEntries(data.charges.map((charge) => [charge.id, charge]));

  const summary = {
    emitted: data.charges.reduce((sum, charge) => sum + charge.amount, 0),
    collected: data.payments.reduce((sum, payment) => sum + payment.amount, 0),
    overdue: data.charges
      .filter((charge) => charge.status === "overdue")
      .reduce((sum, charge) => sum + charge.amount, 0),
    openBalance: 0,
    byMethod: {},
    monthly: {},
    openCharges: [],
  };

  for (const charge of data.charges) {
    const paidForCharge = data.payments
      .filter((payment) => payment.chargeId === charge.id)
      .reduce((sum, payment) => sum + payment.amount, 0);

    const missing = Math.max(charge.amount - paidForCharge, 0);
    summary.openBalance += missing;

    if (missing > 0.009) {
      summary.openCharges.push({
        ...charge,
        missing,
      });
    }

    const monthEntry = summary.monthly[charge.period] || { emitted: 0, collected: 0 };
    monthEntry.emitted += charge.amount;
    summary.monthly[charge.period] = monthEntry;
  }

  for (const payment of data.payments) {
    summary.byMethod[payment.method] = (summary.byMethod[payment.method] || 0) + payment.amount;

    const charge = chargeById[payment.chargeId];
    if (charge) {
      const monthEntry = summary.monthly[charge.period] || { emitted: 0, collected: 0 };
      monthEntry.collected += payment.amount;
      summary.monthly[charge.period] = monthEntry;
    }
  }

  summary.openCharges.sort((a, b) => {
    if (a.status === b.status) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }

    if (a.status === "overdue") {
      return -1;
    }

    if (b.status === "overdue") {
      return 1;
    }

    return 0;
  });

  return summary;
}

function buildFractionBalances(data) {
  const totals = {};

  for (const charge of data.charges) {
    totals[charge.fractionId] = totals[charge.fractionId] || { emitted: 0, paid: 0 };
    totals[charge.fractionId].emitted += charge.amount;
  }

  for (const payment of data.payments) {
    totals[payment.fractionId] = totals[payment.fractionId] || { emitted: 0, paid: 0 };
    totals[payment.fractionId].paid += payment.amount;
  }

  return Object.fromEntries(
    Object.entries(totals).map(([fractionId, values]) => [
      fractionId,
      {
        emitted: values.emitted,
        paid: values.paid,
        balance: Math.max(values.emitted - values.paid, 0),
      },
    ])
  );
}

function buildFloorMatrix(fractions) {
  const byFloor = fractions.reduce((acc, fraction) => {
    if (!acc[fraction.floorNumber]) {
      acc[fraction.floorNumber] = {
        floor: fraction.floorNumber,
        total: 0,
        residential: 0,
        nonResidential: 0,
      };
    }

    acc[fraction.floorNumber].total += 1;
    if (fraction.type === "habitacao") {
      acc[fraction.floorNumber].residential += 1;
    } else {
      acc[fraction.floorNumber].nonResidential += 1;
    }

    return acc;
  }, {});

  return Object.values(byFloor).sort((a, b) => b.floor - a.floor);
}

function metricCards(data, finance) {
  const collectionRate = finance.emitted > 0 ? (finance.collected / finance.emitted) * 100 : 0;

  return [
    {
      label: "Taxa de cobrança",
      value: `${collectionRate.toFixed(1)}%`,
      detail: `${formatCurrency(finance.collected)} recebidos`,
      tone: "accent",
    },
    {
      label: "Saldo em aberto",
      value: formatCurrency(finance.openBalance),
      detail: `${finance.openCharges.length} encargos pendentes`,
      tone: "warning",
    },
    {
      label: "Ocorrências abertas",
      value: numberFormatter.format(
        data.issues.filter((issue) => ["new", "triage", "in_progress", "waiting_supplier"].includes(issue.status)).length
      ),
      detail: `${data.issues.filter((issue) => issue.priority === "critical").length} críticas`,
      tone: "danger",
    },
    {
      label: "SLA médio",
      value: `${data.kpisSnapshot.avgResolutionHours}h`,
      detail: "Resolução média",
      tone: "neutral",
    },
  ];
}

function getModuleTitle(moduleId) {
  const titles = {
    dashboard: "Painel de controlo",
    fractions: "Frações e titulares",
    finance: "Tesouraria e cobrança",
    issues: "Ocorrências e manutenção",
    assemblies: "Assembleias e votações",
    portal: "Portal do condómino",
    documents: "Repositório documental",
    compliance: "RGPD e compliance",
  };

  return titles[moduleId];
}

function getProfileCapability(profileId) {
  return PROFILE_CAPABILITIES[profileId] || PROFILE_CAPABILITIES.manager;
}

function getExportPresetKeys(moduleId, profileId) {
  const presets = {
    manager: {
      dashboard: ["section", "item", "value", "detail"],
      fractions: ["fracao", "piso", "tipo", "tipologia", "titular", "quota", "saldo"],
      finance: ["fracao", "periodo", "vencimento", "valor", "emFalta", "estado"],
      issues: ["id", "titulo", "categoria", "prioridade", "estado", "fracao", "fornecedor"],
      assemblies: ["id", "tipo", "data", "local", "pontos"],
      portal: ["fracao", "titular", "periodo", "vencimento", "valor", "pago", "emFalta", "estado"],
      documents: ["titulo", "categoria", "visibilidade", "upload", "caminho"],
      compliance: ["tipo", "item", "estado", "responsavel"],
    },
    accounting: {
      dashboard: ["section", "item", "value"],
      fractions: ["fracao", "titular", "quota", "saldo"],
      finance: ["fracao", "periodo", "vencimento", "valor", "emFalta", "estado"],
      portal: ["fracao", "titular", "periodo", "vencimento", "valor", "pago", "emFalta", "estado"],
      issues: ["id", "titulo", "estado", "fracao"],
      assemblies: ["id", "tipo", "data"],
      documents: ["titulo", "categoria", "upload"],
      compliance: ["tipo", "item", "estado"],
    },
    operations: {
      dashboard: ["section", "item", "detail"],
      fractions: ["fracao", "piso", "tipo", "titular"],
      finance: ["fracao", "periodo", "estado"],
      issues: ["id", "titulo", "categoria", "prioridade", "estado", "fornecedor"],
      assemblies: ["id", "tipo", "data", "local"],
      portal: ["fracao", "titular", "periodo", "vencimento", "estado"],
      documents: ["titulo", "categoria", "visibilidade"],
      compliance: ["tipo", "item", "estado", "responsavel"],
    },
  };

  return presets[profileId]?.[moduleId] || presets.manager[moduleId];
}

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

function csvEscape(value) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

function buildCsv(columns, rows) {
  const head = columns.map((column) => csvEscape(column.label)).join(";");
  const body = rows
    .map((row) => columns.map((column) => csvEscape(row[column.key])).join(";"))
    .join("\n");
  return `${head}\n${body}\n`;
}

function downloadCsv(filename, csvText) {
  if (typeof window === "undefined") {
    return;
  }

  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function nextIssueStatus(currentStatus) {
  const index = ISSUE_STATUS_FLOW.indexOf(currentStatus);
  if (index === -1 || index === ISSUE_STATUS_FLOW.length - 1) {
    return null;
  }

  return ISSUE_STATUS_FLOW[index + 1];
}

function buildIssueTimeline(issue, workOrder) {
  if (!issue) {
    return [];
  }

  const timeline = [
    {
      id: `${issue.id}-opened`,
      label: "Ocorrência criada",
      when: issue.openedAt,
      detail: `${cleanLabel(issue.category)} | ${PRIORITY_LABEL[issue.priority]}`,
      tone: statusTone(issue.priority),
    },
  ];

  if (issue.status !== "new") {
    timeline.push({
      id: `${issue.id}-triage`,
      label: "Triagem iniciada",
      when: issue.openedAt,
      detail: "Ocorrência analisada pela gestão.",
      tone: "neutral",
    });
  }

  if (workOrder?.requestedAt) {
    timeline.push({
      id: `${issue.id}-wo-request`,
      label: "Ordem de trabalho emitida",
      when: workOrder.requestedAt,
      detail: `Estimativa ${formatCurrency(workOrder.estimatedCost)}`,
      tone: "warning",
    });
  }

  if (workOrder?.scheduledAt) {
    timeline.push({
      id: `${issue.id}-wo-scheduled`,
      label: "Intervenção agendada",
      when: workOrder.scheduledAt,
      detail: "Fornecedor notificado e janela reservada.",
      tone: "neutral",
    });
  }

  if (workOrder?.completedAt) {
    timeline.push({
      id: `${issue.id}-wo-completed`,
      label: "Intervenção concluída",
      when: workOrder.completedAt,
      detail: `Custo final ${formatCurrency(workOrder.finalCost || 0)}`,
      tone: "success",
    });
  }

  if (issue.closedAt) {
    timeline.push({
      id: `${issue.id}-closed`,
      label: issue.status === "closed" ? "Ocorrência fechada" : "Ocorrência resolvida",
      when: issue.closedAt,
      detail: "Registo encerrado no sistema.",
      tone: "success",
    });
  }

  return timeline.sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime());
}

function buildIssueAttachments(issue) {
  if (!issue) {
    return [];
  }

  const idSuffix = issue.id.split("-").slice(-1)[0];
  return [
    `foto_${issue.category}_${idSuffix}.jpg`,
    `relatorio_${issue.category}_${idSuffix}.pdf`,
  ];
}

function App() {
  const baseData = seedData;
  const queryParams = useMemo(() => {
    if (typeof window === "undefined") {
      return new URLSearchParams();
    }

    return new URLSearchParams(window.location.search);
  }, []);
  const isCaptureMode = queryParams.get("capture") === "1";
  const queryModule = queryParams.get("module");
  const queryProfile = queryParams.get("profile");
  const querySearch = queryParams.get("q") || "";
  const queryNotificationsOpen = queryParams.get("notifications") === "1";
  const queryCommandOpen = queryParams.get("command") === "1";
  const queryCommandText = queryParams.get("cmdq") || "";
  const [persistedRuntime] = useState(() => (isCaptureMode ? null : getPersistedRuntime(baseData)));

  const [activeModule, setActiveModule] = useState(() => {
    return MODULES.some((module) => module.id === queryModule) ? queryModule : "dashboard";
  });
  const [activeProfile, setActiveProfile] = useState(() => {
    if (PROFILE_OPTIONS.some((option) => option.id === queryProfile)) {
      return queryProfile;
    }

    return persistedRuntime?.activeProfile || "manager";
  });
  const profileCapability = useMemo(() => getProfileCapability(activeProfile), [activeProfile]);
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

  const [fractionsData, setFractionsData] = useState(persistedRuntime?.fractions || baseData.fractions);
  const [peopleData, setPeopleData] = useState(persistedRuntime?.people || baseData.people);
  const [fractionPartiesData, setFractionPartiesData] = useState(
    persistedRuntime?.fractionParties || baseData.fractionParties
  );
  const [chargesData, setChargesData] = useState(persistedRuntime?.charges || baseData.charges);
  const [paymentsData] = useState(persistedRuntime?.payments || baseData.payments);
  const [issuesData, setIssuesData] = useState(persistedRuntime?.issues || baseData.issues);
  const [assembliesData, setAssembliesData] = useState(persistedRuntime?.assemblies || baseData.assemblies);
  const [documentsData] = useState(persistedRuntime?.documents || baseData.documents);
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
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("module", activeModule);
    url.searchParams.set("profile", activeProfile);
    if (globalQuery.trim()) {
      url.searchParams.set("q", globalQuery.trim());
    } else {
      url.searchParams.delete("q");
    }
    window.history.replaceState({}, "", url);
  }, [activeModule, activeProfile, globalQuery]);

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

  const moduleBadge = {
    dashboard: `${fractionsData.length} frações`,
    fractions: `${fractionsData.length} registos`,
    finance: `${formatCurrency(finance.openBalance)} em aberto`,
    issues: `${issuesData.length} tickets`,
    assemblies: `${assembliesData.length} reuniões`,
    portal: `${Object.values(fractionBalances).filter((entry) => Number(entry?.balance || 0) > 0).length} saldos`,
    documents: `${documentsData.length} ficheiros`,
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

  const notifications = useMemo(() => {
    const canSeeModule = (moduleId) => profileCapability.modules.includes(moduleId);
    const now = Date.now();
    const in30Days = now + 30 * 24 * 60 * 60 * 1000;

    const overdueChargeAlerts = finance.openCharges
      .filter((charge) => charge.status === "overdue")
      .slice(0, 5)
      .map((charge) => ({
        id: `notif-charge-${charge.id}`,
        title: `Quota em atraso (${fractionCodeById[charge.fractionId] || charge.fractionId})`,
        detail: `${formatCurrency(charge.missing)} | Venceu em ${formatDate(charge.dueDate)}`,
        when: charge.dueDate,
        tone: "danger",
        module: "finance",
        targetId: charge.id,
        targetType: "charge",
        priorityScore: 4,
      }));

    const criticalIssueAlerts = issuesData
      .filter((issue) => issue.priority === "critical" && !["resolved", "closed"].includes(issue.status))
      .slice(0, 5)
      .map((issue) => ({
        id: `notif-issue-${issue.id}`,
        title: `Ocorrência crítica: ${issue.title}`,
        detail: `${ISSUE_STATUS_LABEL[issue.status]} | ${issue.fractionId ? fractionCodeById[issue.fractionId] : "Área comum"}`,
        when: issue.openedAt,
        tone: "warning",
        module: "issues",
        targetId: issue.id,
        targetType: "issue",
        priorityScore: 3,
      }));

    const assemblyAlerts = assembliesData
      .filter((assembly) => {
        const time = new Date(assembly.scheduledAt).getTime();
        return time >= now && time <= in30Days;
      })
      .slice(0, 4)
      .map((assembly) => ({
        id: `notif-assembly-${assembly.id}`,
        title: `Assembleia ${assembly.meetingType === "ordinary" ? "ordinária" : "extraordinária"} próxima`,
        detail: `${formatDate(assembly.scheduledAt)} | ${assembly.location}`,
        when: assembly.scheduledAt,
        tone: "neutral",
        module: "assemblies",
        targetId: assembly.id,
        targetType: "assembly",
        priorityScore: 2,
      }));

    const activityAlerts = activityLog.slice(0, 5).map((item) => ({
      id: `notif-activity-${item.id}`,
      title: item.title,
      detail: item.detail,
      when: item.createdAt,
      tone: item.tone || "neutral",
      module: "dashboard",
      targetId: "",
      targetType: "activity",
      priorityScore: 1,
    }));

    return [...overdueChargeAlerts, ...criticalIssueAlerts, ...assemblyAlerts, ...activityAlerts]
      .filter((notification) => canSeeModule(notification.module))
      .sort((a, b) => {
        if (a.priorityScore !== b.priorityScore) {
          return b.priorityScore - a.priorityScore;
        }
        return new Date(b.when).getTime() - new Date(a.when).getTime();
      })
      .slice(0, 12);
  }, [finance.openCharges, issuesData, assembliesData, activityLog, fractionCodeById, profileCapability]);

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
    return documentsData.filter((document) => {
      if (!docQuery.trim()) {
        return true;
      }

      const text = `${document.title} ${document.category} ${document.visibility}`.toLowerCase();
      return text.includes(docQuery.toLowerCase());
    });
  }, [documentsData, docQuery]);

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
    () => documentsData.filter((document) => ["residents", "all"].includes(document.visibility)),
    [documentsData]
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

    return [...activityEntries, ...overdueEntries, ...issueEntries]
      .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
      .slice(0, 120);
  }, [activityLog, activeProfileLabel, finance.openCharges, fractionCodeById, issuesData]);

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
      const document = documentsData.find((item) => item.id === targetId);
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
      ? documentsData
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
  }, [globalQuery, fractionsData, ownerByFraction, issuesData, documentsData, profileCapability]);

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

  const handleAdvanceIssueStatus = (issueId) => {
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
    setIssuesData((previous) =>
      previous.map((item) =>
        item.id === issueId
          ? {
              ...item,
              status: nextStatus,
              closedAt: nextStatus === "resolved" || nextStatus === "closed" ? now : item.closedAt,
            }
          : item
      )
    );

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

  const commandActions = useMemo(() => {
    const moduleActions = availableModules.map((module) => ({
      id: `cmd-module-${module.id}`,
      label: `Abrir ${module.label}`,
      detail: `Navegar para o módulo ${module.label}`,
      search: `${module.label} módulo navegar`,
      onSelect: () => navigateToContext({ module: module.id }),
    }));

    const quickCreateActions = availableQuickActionTypes.map((typeOption) => ({
      id: `cmd-create-${typeOption.id}`,
      label: `Criar ${typeOption.label.toLowerCase()}`,
      detail: "Abre o painel de registo rápido",
      search: `${typeOption.label} criar novo rápido`,
      onSelect: () => openQuickActionType(typeOption.id),
    }));

    const utilityActions = [
      {
        id: "cmd-export",
        label: "Exportar CSV do módulo atual",
        detail: `Preset ${activeProfileLabel}`,
        search: "csv exportar excel",
        onSelect: handleExportCsv,
      },
      {
        id: "cmd-notifications",
        label: "Abrir centro de alertas",
        detail: `${unreadNotifications.length} alertas por ler`,
        search: "alertas notificações inbox",
        onSelect: () => {
          setIsCommandPaletteOpen(false);
          setIsNotificationsOpen(true);
        },
      },
      {
        id: "cmd-clear-search",
        label: "Limpar pesquisa global",
        detail: "Remove termo de pesquisa e fecha resultados",
        search: "limpar pesquisa global",
        onSelect: () => {
          setGlobalQuery("");
          setIsCommandPaletteOpen(false);
        },
      },
    ];

    const term = commandQuery.trim().toLowerCase();
    const allActions = [...moduleActions, ...quickCreateActions, ...utilityActions];

    if (!term) {
      return allActions.slice(0, 12);
    }

    return allActions
      .filter((action) => `${action.label} ${action.detail} ${action.search}`.toLowerCase().includes(term))
      .slice(0, 12);
  }, [
    availableModules,
    availableQuickActionTypes,
    activeProfileLabel,
    commandQuery,
    navigateToContext,
    openQuickActionType,
    handleExportCsv,
    unreadNotifications.length,
  ]);

  const handleExecuteCommandAction = (actionId) => {
    const action = commandActions.find((item) => item.id === actionId);
    if (!action) {
      return;
    }

    action.onSelect();
    setIsCommandPaletteOpen(false);
  };

  const handleQuickActionSubmit = ({ type, values }) => {
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
      setSelectedFractionId(fractionId);
      setSelectedPortalFractionId(fractionId);
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

      setChargesData((previous) => [newCharge, ...previous]);
      setSelectedChargeId(newCharge.id);
      setToastMessage(`Encargo criado para a fração ${fractionCode}.`);
      setActivityLog((previous) => [
        {
          id: `act-${Date.now().toString(36)}-charge`,
          title: `Encargo criado para ${fractionCode}`,
          detail: `${cleanLabel(values.kind)} | ${formatCurrency(amount)} | Vencimento ${formatDate(newCharge.dueDate)}`,
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

      const newIssue = {
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

      setIssuesData((previous) => [newIssue, ...previous]);
      setSelectedIssueId(newIssue.id);
      setToastMessage("Ocorrência registada na coluna Novo.");
      setActivityLog((previous) => [
        {
          id: `act-${Date.now().toString(36)}-issue`,
          title: `Ocorrência criada: ${newIssue.title}`,
          detail: `${cleanLabel(newIssue.category)} | ${PRIORITY_LABEL[newIssue.priority]}`,
          createdAt: new Date().toISOString(),
          tone: statusTone(newIssue.priority),
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

    setIsQuickActionOpen(false);
  };

  const topHeaderValue = `${runtimeData.condominium.name} | ${runtimeData.condominium.city}`;

  return (
    <div className="condo-app">
      <div className="orb orb-one" aria-hidden="true" />
      <div className="orb orb-two" aria-hidden="true" />

      <aside className="sidebar">
        <div>
          <p className="eyebrow">CondoOS PT</p>
          <h1>{runtimeData.condominium.name}</h1>
          <p className="sidebar-meta">11 andares | {fractionsData.length} frações | Piloto V1</p>
        </div>

        <nav className="module-nav" aria-label="Módulos principais">
          {MODULES.map((module) => {
            const isAllowed = profileCapability.modules.includes(module.id);
            const isActive = activeModule === module.id;
            const buttonClass = isAllowed ? (isActive ? "module-btn active" : "module-btn") : "module-btn locked";
            return (
              <button
                key={module.id}
                type="button"
                className={buttonClass}
                aria-disabled={!isAllowed}
                onClick={() => {
                  if (!isAllowed) {
                    setToastMessage(`Perfil ${activeProfileLabel} sem acesso ao módulo ${module.label}.`);
                    return;
                  }
                  setActiveModule(module.id);
                }}
              >
                <span>{module.label}</span>
                <small>{isAllowed ? moduleBadge[module.id] : "Sem acesso"}</small>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-status">
          <h2>Estado do rollout</h2>
          <p>Templates jurídicos preparados e dataset sintético carregado para QA.</p>
          <ul>
            <li>V1 funcional: 7 módulos</li>
            <li>Seed de demo: 100% carregado</li>
            <li>Build: estável</li>
          </ul>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Ambiente de demonstração</p>
            <h2>{getModuleTitle(activeModule)}</h2>
            <p>{topHeaderValue}</p>
            <small className="profile-hint">Perfil ativo: {activeProfileLabel}</small>
          </div>

          <div className="header-tools">
            <div className="global-search-wrap">
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
            >
              {PROFILE_OPTIONS.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  Preset: {profile.label}
                </option>
              ))}
            </select>

            <div className="header-actions">
              <button type="button" className="ghost-btn" onClick={handleOpenCommandPalette}>
                Comandos <span className="shortcut-hint">{commandShortcutLabel}</span>
              </button>
              <button type="button" className="ghost-btn notification-btn" onClick={handleOpenNotifications}>
                Alertas
                {unreadNotifications.length > 0 ? (
                  <span className="notification-count">{unreadNotifications.length}</span>
                ) : null}
              </button>
              <button type="button" className="ghost-btn" onClick={handleExportCsv}>
                Exportar CSV
              </button>
              <button type="button" className="primary-btn" onClick={openQuickAction} disabled={!hasQuickActions}>
                {hasQuickActions ? HEADER_ACTION_LABEL[activeModule] : "Sem permissão de criação"}
              </button>
            </div>
          </div>
        </header>

        <AnimateSection keyName={activeModule} disableAnimation={isCaptureMode}>
          {activeModule === "dashboard" && (
            <DashboardScreen
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
            <FractionsScreen
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
            <FinanceScreen
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
            />
          )}

          {activeModule === "issues" && (
            <IssuesScreen
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
            <AssembliesScreen assemblies={assembliesData} onOpenAction={openQuickActionType} />
          )}

          {activeModule === "documents" && (
            <DocumentsScreen documents={documentList} docQuery={docQuery} setDocQuery={setDocQuery} />
          )}

          {activeModule === "portal" && (
            <PortalScreen
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
            />
          )}

          {activeModule === "compliance" && (
            <ComplianceScreen
              auditEntries={filteredAuditEntries}
              auditQuery={auditQuery}
              setAuditQuery={setAuditQuery}
              auditDomain={auditDomain}
              setAuditDomain={setAuditDomain}
            />
          )}
        </AnimateSection>
      </main>

      <nav className="mobile-nav" aria-label="Navegação móvel">
        {availableModules.map((module) => (
          <button
            key={module.id}
            type="button"
            className={module.id === activeModule ? "mobile-nav-btn active" : "mobile-nav-btn"}
            onClick={() => setActiveModule(module.id)}
          >
            {module.mobile}
          </button>
        ))}
      </nav>

      <QuickActionDrawer
        open={isQuickActionOpen}
        actionType={quickActionType}
        allowedActionTypes={availableQuickActionTypes}
        onActionTypeChange={setQuickActionType}
        onClose={() => setIsQuickActionOpen(false)}
        onSubmit={handleQuickActionSubmit}
        fractions={fractionsData}
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

      {toastMessage ? <div className="toast-note">{toastMessage}</div> : null}
    </div>
  );
}

function AnimateSection({ children, keyName, disableAnimation = false }) {
  if (disableAnimation) {
    return <section className="screen capture-screen">{children}</section>;
  }

  return (
    <motion.section
      key={keyName}
      className="screen"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.section>
  );
}

function DashboardScreen({
  cards,
  floorMatrix,
  nextDeadlines,
  disableMotion = false,
  activityLog,
  onboardingChecklist,
  onboardingCompletion,
  onOpenAction,
}) {
  const kpiCards = cards.map((card) => (
    <article key={card.label} className={`kpi-card tone-${card.tone}`}>
      <p>{card.label}</p>
      <strong>{card.value}</strong>
      <span>{card.detail}</span>
    </article>
  ));

  return (
    <div className="stack-lg">
      {disableMotion ? (
        <div className="kpi-grid">{kpiCards}</div>
      ) : (
        <motion.div
          className="kpi-grid"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.07 } },
          }}
        >
          {cards.map((card) => (
            <motion.article
              key={card.label}
              className={`kpi-card tone-${card.tone}`}
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            >
              <p>{card.label}</p>
              <strong>{card.value}</strong>
              <span>{card.detail}</span>
            </motion.article>
          ))}
        </motion.div>
      )}

      <div className="split-grid">
        <article className="panel">
          <header className="panel-header">
            <h3>Agenda de execução</h3>
            <span>Próximos 30 dias</span>
          </header>
          <ul className="timeline-list">
            {nextDeadlines.map((item) => (
              <li key={`${item.type}-${item.title}`}>
                <div>
                  <p>{item.title}</p>
                  <small>{formatDate(item.date)}</small>
                </div>
                <div className="timeline-side">
                  {item.amount ? <strong>{formatCurrency(item.amount)}</strong> : <strong>{cleanLabel(item.type)}</strong>}
                  <StatusPill label={cleanLabel(item.status)} tone={statusTone(item.status)} />
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <header className="panel-header">
            <h3>Mapa por piso</h3>
            <span>Habitação vs não habitação</span>
          </header>
          <div className="building-map">
            {floorMatrix.map((floor) => (
              <div key={floor.floor} className="floor-row">
                <span>Piso {floor.floor}</span>
                <div>
                  {Array.from({ length: floor.total }).map((_, index) => {
                    const isResidential = index < floor.residential;
                    return (
                      <i
                        key={`${floor.floor}-${index}`}
                        className={isResidential ? "slot residential" : "slot mixed"}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="panel">
        <header className="panel-header">
          <h3>Checklist de onboarding</h3>
          <span>
            {onboardingCompletion}/{onboardingChecklist.length} concluídos
          </span>
        </header>
        <div className="onboarding-progress" role="presentation">
          <i style={{ width: `${(onboardingCompletion / Math.max(onboardingChecklist.length, 1)) * 100}%` }} />
        </div>
        <ul className="onboarding-list">
          {onboardingChecklist.map((item) => (
            <li key={item.id} className={item.done ? "done" : ""}>
              <div>
                <p>{item.label}</p>
                <small>{item.detail}</small>
              </div>
              <div className="timeline-side">
                <StatusPill label={item.done ? "Concluído" : "Em falta"} tone={item.done ? "success" : "warning"} />
                <button type="button" className="mini-btn" onClick={item.action}>
                  {item.done ? "Ver" : item.cta}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </article>

      <article className="panel">
        <header className="panel-header">
          <h3>Atividade recente</h3>
          <div className="inline-actions">
            <button type="button" className="mini-btn" onClick={() => onOpenAction("issues")}>
              + Ocorrência
            </button>
            <button type="button" className="mini-btn" onClick={() => onOpenAction("finance")}>
              + Encargo
            </button>
            <button type="button" className="mini-btn" onClick={() => onOpenAction("fractions")}>
              + Fração
            </button>
          </div>
        </header>
        {activityLog.length === 0 ? (
          <p className="empty-note">
            Ainda sem registos manuais nesta sessão. Usa os botões acima para criar uma fração, encargo ou ocorrência.
          </p>
        ) : (
          <ul className="activity-list">
            {activityLog.slice(0, 6).map((item) => (
              <li key={item.id}>
                <div>
                  <p>{item.title}</p>
                  <small>{item.detail}</small>
                </div>
                <div className="timeline-side">
                  <small>{formatDate(item.createdAt)}</small>
                  <StatusPill label={cleanLabel(item.tone)} tone={item.tone} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}

function FractionsScreen({
  fractions,
  ownerByFraction,
  balances,
  fractionFilter,
  setFractionFilter,
  fractionFloorFilter,
  setFractionFloorFilter,
  floorOptions,
  fractionDebtFilter,
  setFractionDebtFilter,
  fractionQuery,
  setFractionQuery,
  typeSummary,
  selectedFraction,
  selectedFractionCharges,
  selectedFractionPaymentsTotal,
  onSelectFraction,
  onOpenAction,
}) {
  const typePills = [
    { key: "all", label: "Todas", count: Object.values(typeSummary).reduce((sum, value) => sum + value, 0) },
    { key: "habitacao", label: "Habitação", count: typeSummary.habitacao || 0 },
    { key: "loja", label: "Loja", count: typeSummary.loja || 0 },
    { key: "estacionamento", label: "Estacionamento", count: typeSummary.estacionamento || 0 },
    { key: "arrecadacao", label: "Arrecadação", count: typeSummary.arrecadacao || 0 },
  ];

  return (
    <div className="stack-lg">
      <article className="panel">
        <header className="panel-header split-header">
          <h3>Pesquisa e filtros</h3>
          <div className="inline-actions stretch-right">
            <button type="button" className="mini-btn" onClick={() => onOpenAction("fractions")}>
              + Nova fração
            </button>
            <div className="search-wrap compact">
              <input
                type="search"
                value={fractionQuery}
                onChange={(event) => setFractionQuery(event.target.value)}
                placeholder="Filtrar por fração ou titular"
              />
            </div>
          </div>
        </header>

        <div className="pill-group">
          {typePills.map((pill) => (
            <button
              key={pill.key}
              type="button"
              className={pill.key === fractionFilter ? "filter-pill active" : "filter-pill"}
              onClick={() => setFractionFilter(pill.key)}
            >
              {pill.label}
              <span>{pill.count}</span>
            </button>
          ))}
          <select
            className="filter-select"
            value={fractionFloorFilter}
            onChange={(event) => setFractionFloorFilter(event.target.value)}
            aria-label="Filtrar por piso"
          >
            <option value="all">Todos os pisos</option>
            {floorOptions.map((floor) => (
              <option key={floor} value={floor}>
                Piso {floor}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            value={fractionDebtFilter}
            onChange={(event) => setFractionDebtFilter(event.target.value)}
            aria-label="Filtrar por saldo"
          >
            <option value="all">Com e sem dívida</option>
            <option value="in_debt">Apenas com dívida</option>
            <option value="regular">Apenas regularizadas</option>
          </select>
        </div>
      </article>

      <div className="fractions-layout">
        <article className="panel">
          <header className="panel-header">
            <h3>Mapa de frações</h3>
            <span>{fractions.length} resultados</span>
          </header>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fração</th>
                  <th>Piso</th>
                  <th>Tipo</th>
                  <th>Titologia</th>
                  <th>Titular principal</th>
                  <th>Quota mensal</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {fractions.map((fraction) => {
                  const balance = balances[fraction.id]?.balance || 0;
                  return (
                    <tr
                      key={fraction.id}
                      className={selectedFraction?.id === fraction.id ? "row-selected" : ""}
                      onClick={() => onSelectFraction(fraction.id)}
                    >
                      <td>{fraction.code}</td>
                      <td>{fraction.floorNumber}</td>
                      <td>{cleanLabel(fraction.type)}</td>
                      <td>{fraction.typology}</td>
                      <td>{ownerByFraction[fraction.id] || "Sem titular"}</td>
                      <td>{formatCurrency(fraction.monthlyFee)}</td>
                      <td>
                        <StatusPill
                          label={balance > 0 ? formatCurrency(balance) : "Sem dívida"}
                          tone={balance > 0 ? "warning" : "success"}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel fraction-detail-panel">
          {!selectedFraction ? (
            <p className="empty-note">Seleciona uma fração para ver detalhe.</p>
          ) : (
            <>
              <header className="panel-header">
                <h3>Detalhe da fração</h3>
                <StatusPill
                  label={formatCurrency(balances[selectedFraction.id]?.balance || 0)}
                  tone={(balances[selectedFraction.id]?.balance || 0) > 0 ? "warning" : "success"}
                />
              </header>

              <div className="issue-meta-grid">
                <span>
                  Fração
                  <strong>{selectedFraction.code}</strong>
                </span>
                <span>
                  Piso
                  <strong>{selectedFraction.floorNumber}</strong>
                </span>
                <span>
                  Tipo
                  <strong>{cleanLabel(selectedFraction.type)}</strong>
                </span>
                <span>
                  Tipologia
                  <strong>{selectedFraction.typology}</strong>
                </span>
                <span>
                  Titular principal
                  <strong>{ownerByFraction[selectedFraction.id] || "Sem titular"}</strong>
                </span>
                <span>
                  Área / Permilagem
                  <strong>
                    {selectedFraction.privateAreaM2} m2 | {selectedFraction.permillage}
                  </strong>
                </span>
                <span>
                  Quota mensal
                  <strong>{formatCurrency(selectedFraction.monthlyFee)}</strong>
                </span>
                <span>
                  Pago acumulado
                  <strong>{formatCurrency(selectedFractionPaymentsTotal)}</strong>
                </span>
              </div>

              <div className="issue-costs">
                <h4>Últimos encargos</h4>
                <ul className="issue-timeline">
                  {selectedFractionCharges.slice(0, 6).map((charge) => (
                    <li key={charge.id}>
                      <div>
                        <p>{charge.period}</p>
                        <small>
                          {formatCurrency(charge.amount)} | Em falta {formatCurrency(charge.missing)}
                        </small>
                      </div>
                      <div className="timeline-side">
                        <small>{formatDate(charge.dueDate)}</small>
                        <StatusPill label={cleanLabel(charge.status)} tone={statusTone(charge.status)} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </article>
      </div>
    </div>
  );
}

function FinanceScreen({
  finance,
  fractions,
  financeRows,
  financePeriods,
  financeStatusFilter,
  setFinanceStatusFilter,
  financePeriodFilter,
  setFinancePeriodFilter,
  selectedFinanceCharge,
  selectedFinanceChargePayments,
  onSelectCharge,
  onOpenAction,
}) {
  const byMonth = Object.entries(finance.monthly).sort(([a], [b]) => (a < b ? -1 : 1));
  const maxMonthly = Math.max(
    ...byMonth.map(([, values]) => Math.max(values.emitted, values.collected)),
    1
  );

  const fractionCodeById = Object.fromEntries(fractions.map((fraction) => [fraction.id, fraction.code]));

  return (
    <div className="stack-lg">
      <div className="kpi-grid finance-kpi-grid">
        <article className="kpi-card tone-accent">
          <p>Emitido (período)</p>
          <strong>{formatCurrency(finance.emitted)}</strong>
          <span>Quotas e encargos totais</span>
        </article>
        <article className="kpi-card tone-success">
          <p>Cobrado</p>
          <strong>{formatCurrency(finance.collected)}</strong>
          <span>Pagamentos registados</span>
        </article>
        <article className="kpi-card tone-danger">
          <p>Em atraso</p>
          <strong>{formatCurrency(finance.overdue)}</strong>
          <span>Quotas vencidas</span>
        </article>
        <article className="kpi-card tone-warning">
          <p>Saldo em aberto</p>
          <strong>{formatCurrency(finance.openBalance)}</strong>
          <span>Inclui parcial e vencido</span>
        </article>
      </div>

      <div className="split-grid">
        <article className="panel">
          <header className="panel-header">
            <h3>Cobrança mensal</h3>
            <span>Emitido vs recebido</span>
          </header>

          <div className="bar-chart">
            {byMonth.map(([month, values]) => (
              <div key={month} className="bar-row">
                <label>{month}</label>
                <div className="bar-track">
                  <div className="bar bar-emitted" style={{ width: `${(values.emitted / maxMonthly) * 100}%` }} />
                </div>
                <div className="bar-track">
                  <div className="bar bar-collected" style={{ width: `${(values.collected / maxMonthly) * 100}%` }} />
                </div>
                <small>
                  {formatCurrency(values.collected)} / {formatCurrency(values.emitted)}
                </small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <header className="panel-header">
            <h3>Distribuição por método</h3>
            <span>Pagamentos recebidos</span>
          </header>
          <ul className="simple-list">
            {Object.entries(finance.byMethod)
              .sort(([, a], [, b]) => b - a)
              .map(([method, total]) => (
                <li key={method}>
                  <span>{cleanLabel(method)}</span>
                  <strong>{formatCurrency(total)}</strong>
                </li>
              ))}
          </ul>
        </article>
      </div>

      <div className="finance-layout">
        <article className="panel">
          <header className="panel-header">
            <h3>Encargos pendentes</h3>
            <div className="inline-actions">
              <span>{financeRows.length} linhas</span>
              <button type="button" className="mini-btn" onClick={() => onOpenAction("finance")}>
                + Novo encargo
              </button>
            </div>
          </header>

          <div className="pill-group">
            <select
              className="filter-select"
              value={financeStatusFilter}
              onChange={(event) => setFinanceStatusFilter(event.target.value)}
              aria-label="Filtrar por estado financeiro"
            >
              <option value="all">Todos os estados</option>
              <option value="overdue">Em atraso</option>
              <option value="open">Em aberto</option>
              <option value="partially_paid">Parcial</option>
            </select>
            <select
              className="filter-select"
              value={financePeriodFilter}
              onChange={(event) => setFinancePeriodFilter(event.target.value)}
              aria-label="Filtrar por período"
            >
              <option value="all">Todos os períodos</option>
              {financePeriods.map((period) => (
                <option key={period} value={period}>
                  {period}
                </option>
              ))}
            </select>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fração</th>
                  <th>Período</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Em falta</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {financeRows.slice(0, 18).map((charge) => (
                  <tr
                    key={charge.id}
                    className={selectedFinanceCharge?.id === charge.id ? "row-selected" : ""}
                    onClick={() => onSelectCharge(charge.id)}
                  >
                    <td>{fractionCodeById[charge.fractionId]}</td>
                    <td>{charge.period}</td>
                    <td>{formatDate(charge.dueDate)}</td>
                    <td>{formatCurrency(charge.amount)}</td>
                    <td>{formatCurrency(charge.missing)}</td>
                    <td>
                      <StatusPill label={cleanLabel(charge.status)} tone={statusTone(charge.status)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel finance-detail-panel">
          {!selectedFinanceCharge ? (
            <p className="empty-note">Seleciona um encargo para ver detalhe.</p>
          ) : (
            <>
              <header className="panel-header">
                <h3>Detalhe do encargo</h3>
                <StatusPill label={cleanLabel(selectedFinanceCharge.status)} tone={statusTone(selectedFinanceCharge.status)} />
              </header>

              <div className="issue-meta-grid">
                <span>
                  Fração
                  <strong>{fractionCodeById[selectedFinanceCharge.fractionId] || selectedFinanceCharge.fractionId}</strong>
                </span>
                <span>
                  Período
                  <strong>{selectedFinanceCharge.period}</strong>
                </span>
                <span>
                  Vencimento
                  <strong>{formatDate(selectedFinanceCharge.dueDate)}</strong>
                </span>
                <span>
                  Valor
                  <strong>{formatCurrency(selectedFinanceCharge.amount)}</strong>
                </span>
                <span>
                  Pago
                  <strong>{formatCurrency(selectedFinanceCharge.amount - selectedFinanceCharge.missing)}</strong>
                </span>
                <span>
                  Em falta
                  <strong>{formatCurrency(selectedFinanceCharge.missing)}</strong>
                </span>
              </div>

              <div className="issue-costs">
                <h4>Pagamentos associados</h4>
                {selectedFinanceChargePayments.length === 0 ? (
                  <p>Sem pagamentos registados para este encargo.</p>
                ) : (
                  <ul className="issue-timeline">
                    {selectedFinanceChargePayments.map((payment) => (
                      <li key={payment.id}>
                        <div>
                          <p>{formatCurrency(payment.amount)}</p>
                          <small>{cleanLabel(payment.method)} | Ref. {payment.reference}</small>
                        </div>
                        <div className="timeline-side">
                          <small>{formatDate(payment.paidAt)}</small>
                          <StatusPill label="Pago" tone="success" />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </article>
      </div>
    </div>
  );
}

function IssuesScreen({
  issuesByStatus,
  peopleById,
  onOpenAction,
  selectedIssue,
  selectedIssueTimeline,
  selectedIssueAttachments,
  selectedIssueWorkOrder,
  selectedIssueNextStatus,
  onSelectIssue,
  onAdvanceIssueStatus,
  fractionCodeById,
}) {
  return (
    <div className="stack-lg">
      <div className="issues-layout">
        <article className="panel">
          <header className="panel-header">
            <h3>Painel Kanban de manutenção</h3>
            <div className="inline-actions">
              <span>Fluxo operacional em tempo real</span>
              <button type="button" className="mini-btn" onClick={() => onOpenAction("issues")}>
                + Nova ocorrencia
              </button>
            </div>
          </header>

          <div className="kanban-grid">
            {ISSUE_COLUMNS.map((column) => (
              <div key={column.key} className="kanban-column">
                <div className="kanban-head">
                  <h4>{column.label}</h4>
                  <span>{issuesByStatus[column.key].length}</span>
                </div>

                <div className="kanban-cards">
                  {issuesByStatus[column.key].map((issue) => (
                    <article
                      key={issue.id}
                      className={selectedIssue?.id === issue.id ? "kanban-card selected" : "kanban-card"}
                      onClick={() => onSelectIssue(issue.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectIssue(issue.id);
                        }
                      }}
                    >
                      <header>
                        <StatusPill label={PRIORITY_LABEL[issue.priority]} tone={statusTone(issue.priority)} />
                        <small>{cleanLabel(issue.category)}</small>
                      </header>
                      <p>{issue.title}</p>
                      <footer>
                        <span>{issue.fractionId ? fractionCodeById[issue.fractionId] || issue.fractionId : "Area comum"}</span>
                        <small>
                          {issue.assignedSupplierPersonId
                            ? peopleById[issue.assignedSupplierPersonId]?.fullName || "Fornecedor"
                            : "Sem atribuição"}
                        </small>
                      </footer>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel issue-detail-panel">
          {!selectedIssue ? (
          <p className="empty-note">Seleciona uma ocorrência para ver detalhes.</p>
          ) : (
            <>
              <header className="panel-header">
                <h3>Detalhe da ocorrencia</h3>
                <StatusPill label={ISSUE_STATUS_LABEL[selectedIssue.status] || cleanLabel(selectedIssue.status)} tone={statusTone(selectedIssue.status)} />
              </header>

              <div className="issue-head">
                <strong>{selectedIssue.title}</strong>
                <p>{selectedIssue.description}</p>
              </div>

              <div className="issue-meta-grid">
                <span>
                  Fração
                  <strong>{selectedIssue.fractionId ? fractionCodeById[selectedIssue.fractionId] || selectedIssue.fractionId : "Area comum"}</strong>
                </span>
                <span>
                  Categoria
                  <strong>{cleanLabel(selectedIssue.category)}</strong>
                </span>
                <span>
                  Prioridade
                  <strong>{PRIORITY_LABEL[selectedIssue.priority]}</strong>
                </span>
                <span>
                  Fornecedor
                  <strong>
                    {selectedIssue.assignedSupplierPersonId
                      ? peopleById[selectedIssue.assignedSupplierPersonId]?.fullName || "Fornecedor"
                      : "Sem atribuição"}
                  </strong>
                </span>
              </div>

              <div className="issue-costs">
                <h4>Custo estimado/final</h4>
                <p>
                  {selectedIssueWorkOrder
                    ? `${formatCurrency(selectedIssueWorkOrder.estimatedCost || 0)} / ${formatCurrency(
                        selectedIssueWorkOrder.finalCost || selectedIssueWorkOrder.estimatedCost || 0
                      )}`
                    : "Sem ordem de trabalho associada"}
                </p>
              </div>

              <div className="issue-costs">
                <h4>Anexos</h4>
                <ul className="attachment-list">
                  {selectedIssueAttachments.map((attachment) => (
                    <li key={attachment}>
                      <code>{attachment}</code>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="issue-costs">
                <h4>Timeline</h4>
                <ul className="issue-timeline">
                  {selectedIssueTimeline.map((entry) => (
                    <li key={entry.id}>
                      <div>
                        <p>{entry.label}</p>
                        <small>{entry.detail}</small>
                      </div>
                      <div className="timeline-side">
                        <small>{formatDate(entry.when)}</small>
                        <StatusPill label={cleanLabel(entry.tone)} tone={entry.tone} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="inline-actions">
                <button type="button" className="mini-btn" onClick={() => onOpenAction("issues")}>
                  + Nova ocorrencia
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => onAdvanceIssueStatus(selectedIssue.id)}
                  disabled={!selectedIssueNextStatus}
                >
                  {selectedIssueNextStatus
                    ? `Mover para ${ISSUE_STATUS_LABEL[selectedIssueNextStatus]}`
                    : "Estado final"}
                </button>
              </div>
            </>
          )}
        </article>
      </div>
    </div>
  );
}

function AssembliesScreen({ assemblies, onOpenAction }) {
  return (
    <div className="stack-lg">
      <div className="split-grid">
        <article className="panel">
          <header className="panel-header">
            <h3>Agenda de assembleias</h3>
            <div className="inline-actions">
              <span>Planeamento 2026</span>
              <button type="button" className="mini-btn" onClick={() => onOpenAction("assemblies")}>
                + Nova assembleia
              </button>
            </div>
          </header>
          <ul className="timeline-list">
            {assemblies.map((assembly) => (
              <li key={assembly.id}>
                <div>
                  <p>{assembly.meetingType === "ordinary" ? "Assembleia ordinária" : "Assembleia extraordinária"}</p>
                  <small>{formatDate(assembly.scheduledAt)}</small>
                </div>
                <div className="timeline-side">
                  <strong>{assembly.voteItems.length} pontos</strong>
                  <StatusPill label="Planeada" tone="neutral" />
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <header className="panel-header">
            <h3>Estado de templates legais</h3>
            <span>Prontos para gerar PDF</span>
          </header>
          <ul className="check-list">
            {TEMPLATE_CHECKLIST.map((item) => (
              <li key={item.id}>
                <span>{item.label}</span>
                <StatusPill label={item.status === "ready" ? "Pronto" : "Em falta"} tone="success" />
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="panel">
        <header className="panel-header">
        <h3>Resumo de votações previstas</h3>
          <span>Com base no seed de demo</span>
        </header>

        <div className="vote-grid">
          {assemblies.flatMap((assembly) =>
            assembly.voteItems.map((item) => (
              <article key={item.id} className="vote-card">
                <h4>{item.description}</h4>
                <p>{cleanLabel(item.votingRule)}</p>
                <div>
                  <span>A favor: {item.summary.for}</span>
                  <span>Contra: {item.summary.against}</span>
                  <span>Abstenção: {item.summary.abstention}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </article>
    </div>
  );
}

function PortalScreen({
  selectedFraction,
  fractions,
  ownerByFraction,
  balances,
  portalChargeRows,
  portalPayments,
  portalOpenIssues,
  portalVisibleDocuments,
  portalNextCharge,
  portalCollectedYear,
  onSelectFraction,
  onOpenAction,
  onExport,
}) {
  return (
    <div className="stack-lg">
      <article className="panel">
        <header className="panel-header split-header">
        <h3>Conta corrente do condómino</h3>
          <div className="inline-actions stretch-right">
            <select
              className="filter-select"
              value={selectedFraction?.id || ""}
              onChange={(event) => onSelectFraction(event.target.value)}
              aria-label="Selecionar fração do portal"
            >
              {fractions.map((fraction) => (
                <option key={fraction.id} value={fraction.id}>
                  {fraction.code} | {ownerByFraction[fraction.id] || "Sem titular"}
                </option>
              ))}
            </select>
            <button type="button" className="mini-btn" onClick={() => onOpenAction("issues")}>
            + Abrir ocorrência
            </button>
            <button type="button" className="ghost-btn" onClick={onExport}>
              Exportar extrato
            </button>
          </div>
        </header>

        {selectedFraction ? (
          <div className="kpi-grid portal-kpi-grid">
            <article className="kpi-card tone-warning">
              <p>Saldo atual</p>
              <strong>{formatCurrency(balances[selectedFraction.id]?.balance || 0)}</strong>
              <span>{ownerByFraction[selectedFraction.id] || "Sem titular"}</span>
            </article>
            <article className="kpi-card tone-accent">
            <p>Próxima quota</p>
              <strong>{portalNextCharge ? formatCurrency(portalNextCharge.missing) : formatCurrency(0)}</strong>
              <span>{portalNextCharge ? formatDate(portalNextCharge.dueDate) : "Sem encargos pendentes"}</span>
            </article>
            <article className="kpi-card tone-success">
            <p>Pagamentos no período</p>
              <strong>{formatCurrency(portalCollectedYear)}</strong>
              <span>{portalPayments.length} movimentos registados</span>
            </article>
            <article className="kpi-card tone-danger">
            <p>Ocorrências ativas</p>
              <strong>{portalOpenIssues.length}</strong>
              <span>Inclui área comum e fração</span>
            </article>
          </div>
        ) : (
        <p className="empty-note">Sem fração selecionada.</p>
        )}
      </article>

      <div className="split-grid">
        <article className="panel">
          <header className="panel-header">
            <h3>Extrato de encargos</h3>
            <span>{portalChargeRows.length} movimentos</span>
          </header>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                <th>Período</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Pago</th>
                  <th>Em falta</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {portalChargeRows.slice(0, 12).map((charge) => (
                  <tr key={charge.id}>
                    <td>{charge.period}</td>
                    <td>{formatDate(charge.dueDate)}</td>
                    <td>{formatCurrency(charge.amount)}</td>
                    <td>{formatCurrency(charge.paid)}</td>
                    <td>{formatCurrency(charge.missing)}</td>
                    <td>
                      <StatusPill label={cleanLabel(charge.status)} tone={statusTone(charge.status)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <header className="panel-header">
            <h3>Pagamentos recentes</h3>
            <span>Últimos lançamentos</span>
          </header>
          {portalPayments.length === 0 ? (
            <p className="empty-note">Ainda sem pagamentos registados.</p>
          ) : (
            <ul className="timeline-list">
              {portalPayments.slice(0, 8).map((payment) => (
                <li key={payment.id}>
                  <div>
                    <p>{formatCurrency(payment.amount)}</p>
                    <small>
                      {cleanLabel(payment.method)} | Ref. {payment.reference}
                    </small>
                  </div>
                  <div className="timeline-side">
                    <small>{formatDate(payment.paidAt)}</small>
                    <StatusPill label="Pago" tone="success" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <div className="split-grid">
        <article className="panel">
          <header className="panel-header">
          <h3>Ocorrências acompanhadas</h3>
            <span>{portalOpenIssues.length} em curso</span>
          </header>
          {portalOpenIssues.length === 0 ? (
          <p className="empty-note">Sem ocorrências abertas para esta fração.</p>
          ) : (
            <ul className="issue-timeline">
              {portalOpenIssues.slice(0, 6).map((issue) => (
                <li key={issue.id}>
                  <div>
                    <p>{issue.title}</p>
                    <small>
                      {cleanLabel(issue.category)} | {PRIORITY_LABEL[issue.priority]}
                    </small>
                  </div>
                  <div className="timeline-side">
                    <small>{formatDate(issue.openedAt)}</small>
                    <StatusPill label={ISSUE_STATUS_LABEL[issue.status]} tone={statusTone(issue.status)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="panel">
          <header className="panel-header">
            <h3>Documentos do portal</h3>
            <span>{portalVisibleDocuments.length} visíveis</span>
          </header>
          <ul className="simple-list">
            {portalVisibleDocuments.slice(0, 8).map((document) => (
              <li key={document.id}>
                <span>{document.title}</span>
                <strong>{cleanLabel(document.visibility)}</strong>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </div>
  );
}

function DocumentsScreen({ documents, docQuery, setDocQuery }) {
  const visibilitySummary = documents.reduce(
    (acc, document) => {
      acc[document.visibility] = (acc[document.visibility] || 0) + 1;
      return acc;
    },
    { manager_only: 0, residents: 0, all: 0 }
  );

  return (
    <div className="stack-lg">
      <article className="panel">
        <header className="panel-header split-header">
          <h3>Biblioteca documental</h3>
          <div className="search-wrap">
            <input
              type="search"
              value={docQuery}
              onChange={(event) => setDocQuery(event.target.value)}
              placeholder="Pesquisar por categoria, título ou visibilidade"
            />
          </div>
        </header>

        <div className="pill-group">
          <span className="stat-pill">
            Manager only <strong>{visibilitySummary.manager_only}</strong>
          </span>
          <span className="stat-pill">
            Residentes <strong>{visibilitySummary.residents}</strong>
          </span>
          <span className="stat-pill">
            Todos <strong>{visibilitySummary.all}</strong>
          </span>
        </div>
      </article>

      <article className="panel">
        <header className="panel-header">
          <h3>Documentos carregados</h3>
          <span>{documents.length} ficheiros visíveis</span>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
              <th>Título</th>
                <th>Categoria</th>
                <th>Data upload</th>
                <th>Visibilidade</th>
                <th>Caminho</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td>{document.title}</td>
                  <td>{cleanLabel(document.category)}</td>
                  <td>{formatDate(document.uploadedAt)}</td>
                  <td>
                    <StatusPill label={cleanLabel(document.visibility)} tone="neutral" />
                  </td>
                  <td>
                    <code>{document.storagePath}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

function NotificationCenter({ open, notifications, readIds, unreadCount, onClose, onMarkAllRead, onSelectNotification }) {
  if (!open) {
    return null;
  }

  return (
    <div className="drawer-backdrop notification-layer" role="dialog" aria-modal="true" onClick={onClose}>
      <aside className="notification-panel" onClick={(event) => event.stopPropagation()}>
        <header className="panel-header">
          <div>
            <h3>Centro de alertas</h3>
            <span>{unreadCount} por ler</span>
          </div>
          <div className="inline-actions">
            <button type="button" className="mini-btn" onClick={onMarkAllRead}>
              Marcar tudo lido
            </button>
            <button type="button" className="close-btn" onClick={onClose}>
              Fechar
            </button>
          </div>
        </header>
        {notifications.length === 0 ? (
          <p className="empty-note">Sem alertas ativos no momento.</p>
        ) : (
          <ul className="notification-list">
            {notifications.map((notification) => {
              const isUnread = !readIds.includes(notification.id);
              return (
                <li key={notification.id} className={isUnread ? "unread" : ""}>
                  <button type="button" onClick={() => onSelectNotification(notification)}>
                    <div>
                      <p>{notification.title}</p>
                      <small>{notification.detail}</small>
                    </div>
                    <div className="timeline-side">
                      <small>{formatDate(notification.when)}</small>
                      <StatusPill label={isUnread ? "Novo" : "Lido"} tone={isUnread ? notification.tone : "neutral"} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}

function CommandPalette({ open, query, actions, onQueryChange, onClose, onSelectAction }) {
  const inputRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 16);
  }, [open, query]);

  useEffect(() => {
    if (!open || actions.length === 0) {
      return;
    }

    setActiveIndex((previous) => Math.min(previous, actions.length - 1));
  }, [actions, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((previous) => (actions.length === 0 ? 0 : (previous + 1) % actions.length));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((previous) => (actions.length === 0 ? 0 : (previous - 1 + actions.length) % actions.length));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const action = actions[activeIndex];
        if (action) {
          onSelectAction(action.id);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, actions, activeIndex, onClose, onSelectAction]);

  if (!open) {
    return null;
  }

  return (
    <div className="drawer-backdrop command-layer" role="dialog" aria-modal="true" onClick={onClose}>
      <section className="command-panel" onClick={(event) => event.stopPropagation()}>
        <header className="panel-header">
        <h3>Comandos rápidos</h3>
        <span>Navegação com setas e Enter</span>
        </header>
        <div className="search-wrap">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Procurar módulo, ação ou utilitário"
          />
        </div>
        <ul className="command-list">
          {actions.map((action, index) => (
            <li key={action.id}>
              <button
                type="button"
                className={index === activeIndex ? "active" : ""}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onSelectAction(action.id)}
              >
                <strong>{action.label}</strong>
                <small>{action.detail}</small>
              </button>
            </li>
          ))}
        </ul>
        {actions.length === 0 ? <p className="empty-note">Sem resultados para este termo.</p> : null}
      </section>
    </div>
  );
}

function QuickActionDrawer({ open, actionType, allowedActionTypes, onActionTypeChange, onClose, onSubmit, fractions }) {
  const [formError, setFormError] = useState("");
  const [fractionForm, setFractionForm] = useState({
    code: "",
    floorNumber: "1",
    type: "habitacao",
    typology: "T2",
    monthlyFee: "65",
    privateAreaM2: "82",
    permillage: "32",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    ownerTaxNumber: "",
  });
  const [chargeForm, setChargeForm] = useState({
    fractionId: fractions[0]?.id || "",
    kind: "quota",
    period: "2026-03",
    dueDate: "2026-03-08",
    amount: "60",
  });
  const [issueForm, setIssueForm] = useState({
    title: "",
    category: "infiltracao",
    priority: "medium",
    fractionId: "common",
    description: "",
  });
  const [assemblyForm, setAssemblyForm] = useState({
    meetingType: "ordinary",
    scheduledAt: "2026-03-25T20:30",
    location: "Sala comum do condomínio",
  });

  const orderedFractions = useMemo(() => {
    return [...fractions].sort((a, b) =>
      a.floorNumber === b.floorNumber ? a.code.localeCompare(b.code) : a.floorNumber - b.floorNumber
    );
  }, [fractions]);

  useEffect(() => {
    if (!open || allowedActionTypes.length === 0) {
      return;
    }

    if (!allowedActionTypes.some((item) => item.id === actionType)) {
      onActionTypeChange(allowedActionTypes[0].id);
    }
  }, [open, actionType, allowedActionTypes, onActionTypeChange]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormError("");
    if (!chargeForm.fractionId && orderedFractions[0]?.id) {
      setChargeForm((previous) => ({ ...previous, fractionId: orderedFractions[0].id }));
    }
  }, [open, orderedFractions, chargeForm.fractionId]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const submitCurrentForm = (event) => {
    event.preventDefault();

    try {
      if (actionType === "fractions") {
        onSubmit({ type: actionType, values: fractionForm });
      }

      if (actionType === "finance") {
        onSubmit({ type: actionType, values: chargeForm });
      }

      if (actionType === "issues") {
        onSubmit({ type: actionType, values: issueForm });
      }

      if (actionType === "assemblies") {
        onSubmit({ type: actionType, values: assemblyForm });
      }
    } catch (error) {
setFormError(error instanceof Error ? error.message : "Não foi possível guardar esta ação.");
    }
  };

  return (
    <div className="drawer-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <aside className="quick-drawer" onClick={(event) => event.stopPropagation()}>
        <header className="drawer-header">
          <div>
          <p className="eyebrow">Ações rápidas</p>
          <h3>Registar nova ação operacional</h3>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Fechar painel">
            Fechar
          </button>
        </header>

        <div className="type-switch">
          {allowedActionTypes.map((typeOption) => (
            <button
              key={typeOption.id}
              type="button"
              className={typeOption.id === actionType ? "switch-pill active" : "switch-pill"}
              onClick={() => {
                setFormError("");
                onActionTypeChange(typeOption.id);
              }}
            >
              {typeOption.label}
            </button>
          ))}
        </div>

        {allowedActionTypes.length === 0 ? (
        <p className="form-error">Este perfil não tem permissões para criar novos registos.</p>
        ) : null}

        <form className="drawer-form" onSubmit={submitCurrentForm}>
          {actionType === "fractions" && (
            <div className="field-grid two-cols">
              <label className="field">
              <span>Código da fração</span>
                <input
                  required
                  value={fractionForm.code}
                  onChange={(event) => setFractionForm((previous) => ({ ...previous, code: event.target.value }))}
                  placeholder="Ex: 11A"
                />
              </label>
              <label className="field">
                <span>Piso</span>
                <input
                  required
                  type="number"
                  value={fractionForm.floorNumber}
                  onChange={(event) =>
                    setFractionForm((previous) => ({ ...previous, floorNumber: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Tipo</span>
                <select
                  value={fractionForm.type}
                  onChange={(event) => setFractionForm((previous) => ({ ...previous, type: event.target.value }))}
                >
                <option value="habitacao">Habitação</option>
                  <option value="loja">Loja</option>
                  <option value="estacionamento">Estacionamento</option>
                  <option value="arrecadacao">Arrecadação</option>
                </select>
              </label>
              <label className="field">
                <span>Tipologia</span>
                <input
                  value={fractionForm.typology}
                  onChange={(event) =>
                    setFractionForm((previous) => ({ ...previous, typology: event.target.value }))
                  }
                  placeholder="Ex: T2"
                />
              </label>
              <label className="field">
                <span>Quota mensal (EUR)</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={fractionForm.monthlyFee}
                  onChange={(event) =>
                    setFractionForm((previous) => ({ ...previous, monthlyFee: event.target.value }))
                  }
                />
              </label>
              <label className="field">
              <span>Área privativa (m2)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={fractionForm.privateAreaM2}
                  onChange={(event) =>
                    setFractionForm((previous) => ({ ...previous, privateAreaM2: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Permilagem</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={fractionForm.permillage}
                  onChange={(event) =>
                    setFractionForm((previous) => ({ ...previous, permillage: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Titular principal</span>
                <input
                  value={fractionForm.ownerName}
                  onChange={(event) =>
                    setFractionForm((previous) => ({ ...previous, ownerName: event.target.value }))
                  }
                  placeholder="Nome do proprietário"
                />
              </label>
              <label className="field">
                <span>Email titular</span>
                <input
                  type="email"
                  value={fractionForm.ownerEmail}
                  onChange={(event) =>
                    setFractionForm((previous) => ({ ...previous, ownerEmail: event.target.value }))
                  }
                  placeholder="owner@example.pt"
                />
              </label>
              <label className="field">
                <span>Telemóvel titular</span>
                <input
                  value={fractionForm.ownerPhone}
                  onChange={(event) =>
                    setFractionForm((previous) => ({ ...previous, ownerPhone: event.target.value }))
                  }
                  placeholder="+3519..."
                />
              </label>
              <label className="field">
                <span>NIF titular</span>
                <input
                  value={fractionForm.ownerTaxNumber}
                  onChange={(event) =>
                    setFractionForm((previous) => ({ ...previous, ownerTaxNumber: event.target.value }))
                  }
                  placeholder="9XXXXXXXX"
                />
              </label>
            </div>
          )}

          {actionType === "finance" && (
            <div className="field-grid">
              <label className="field">
              <span>Fração</span>
                <select
                  required
                  value={chargeForm.fractionId}
                  onChange={(event) => setChargeForm((previous) => ({ ...previous, fractionId: event.target.value }))}
                >
                  {orderedFractions.map((fraction) => (
                    <option key={fraction.id} value={fraction.id}>
                      {fraction.code} - Piso {fraction.floorNumber}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Tipo de encargo</span>
                <select
                  value={chargeForm.kind}
                  onChange={(event) => setChargeForm((previous) => ({ ...previous, kind: event.target.value }))}
                >
                  <option value="quota">Quota</option>
                  <option value="reserve_fund">Fundo de reserva</option>
                  <option value="adjustment">Acerto</option>
                  <option value="penalty">Penalização</option>
                </select>
              </label>
              <label className="field">
              <span>Período</span>
                <input
                  required
                  type="month"
                  value={chargeForm.period}
                  onChange={(event) => setChargeForm((previous) => ({ ...previous, period: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>Data de vencimento</span>
                <input
                  required
                  type="date"
                  value={chargeForm.dueDate}
                  onChange={(event) => setChargeForm((previous) => ({ ...previous, dueDate: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>Valor (EUR)</span>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={chargeForm.amount}
                  onChange={(event) => setChargeForm((previous) => ({ ...previous, amount: event.target.value }))}
                />
              </label>
            </div>
          )}

          {actionType === "issues" && (
            <div className="field-grid">
              <label className="field">
              <span>Título</span>
                <input
                  required
                  value={issueForm.title}
                  onChange={(event) => setIssueForm((previous) => ({ ...previous, title: event.target.value }))}
                  placeholder="Ex: Infiltração na cobertura"
                />
              </label>
              <label className="field">
                <span>Categoria</span>
                <select
                  value={issueForm.category}
                  onChange={(event) => setIssueForm((previous) => ({ ...previous, category: event.target.value }))}
                >
                  {seedData.catalogs.issueCategories.map((category) => (
                    <option key={category} value={category}>
                      {cleanLabel(category)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
              <span>Prioridade</span>
                <select
                  value={issueForm.priority}
                  onChange={(event) => setIssueForm((previous) => ({ ...previous, priority: event.target.value }))}
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </label>
              <label className="field">
              <span>Fração</span>
                <select
                  value={issueForm.fractionId}
                  onChange={(event) => setIssueForm((previous) => ({ ...previous, fractionId: event.target.value }))}
                >
                <option value="common">Área comum</option>
                  {orderedFractions.map((fraction) => (
                    <option key={fraction.id} value={fraction.id}>
                      {fraction.code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field full-row">
              <span>Descrição</span>
                <textarea
                  rows={4}
                  value={issueForm.description}
                  onChange={(event) =>
                    setIssueForm((previous) => ({ ...previous, description: event.target.value }))
                  }
                  placeholder="Detalhes iniciais para triagem."
                />
              </label>
            </div>
          )}

          {actionType === "assemblies" && (
            <div className="field-grid">
              <label className="field">
                <span>Tipo</span>
                <select
                  value={assemblyForm.meetingType}
                  onChange={(event) =>
                    setAssemblyForm((previous) => ({ ...previous, meetingType: event.target.value }))
                  }
                >
                <option value="ordinary">Ordinária</option>
                <option value="extraordinary">Extraordinária</option>
                </select>
              </label>
              <label className="field">
                <span>Data e hora</span>
                <input
                  required
                  type="datetime-local"
                  value={assemblyForm.scheduledAt}
                  onChange={(event) =>
                    setAssemblyForm((previous) => ({ ...previous, scheduledAt: event.target.value }))
                  }
                />
              </label>
              <label className="field full-row">
                <span>Local</span>
                <input
                  value={assemblyForm.location}
                  onChange={(event) => setAssemblyForm((previous) => ({ ...previous, location: event.target.value }))}
                />
              </label>
            </div>
          )}

          {formError ? <p className="form-error">{formError}</p> : null}

          <footer className="drawer-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary-btn" disabled={allowedActionTypes.length === 0}>
Guardar ação
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}

function ComplianceScreen({ auditEntries, auditQuery, setAuditQuery, auditDomain, setAuditDomain }) {
  return (
    <div className="stack-lg">
      <div className="split-grid">
        <article className="panel">
          <header className="panel-header">
            <h3>Checklist RGPD operacional</h3>
            <span>Prioridade de lançamento</span>
          </header>
          <ul className="check-list">
            {COMPLIANCE_TASKS.map((task) => (
              <li key={task.title}>
                <div>
                  <p>{task.title}</p>
                  <small>{task.owner}</small>
                </div>
                <div className="timeline-side">
                  <small>{formatDate(task.dueDate)}</small>
                  <StatusPill label={task.status} tone={statusTone(task.status)} />
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <header className="panel-header">
          <h3>Templates jurídicos</h3>
          <span>Pré-validados para edição</span>
          </header>
          <ul className="simple-list">
            <li>
            <span>Política de privacidade</span>
              <strong>v0.1</strong>
            </li>
            <li>
            <span>Termos de utilização</span>
              <strong>v0.1</strong>
            </li>
            <li>
              <span>DPA subcontratante</span>
              <strong>v0.1</strong>
            </li>
            <li>
              <span>Registo de incidente</span>
              <strong>v0.1</strong>
            </li>
            <li>
              <span>Resposta ao titular</span>
              <strong>v0.1</strong>
            </li>
          </ul>
        </article>
      </div>

      <article className="panel">
        <header className="panel-header">
          <h3>Trilho de auditoria operacional</h3>
          <span>{auditEntries.length} eventos filtrados</span>
        </header>
        <div className="audit-toolbar">
          <select
            className="filter-select"
            value={auditDomain}
            onChange={(event) => setAuditDomain(event.target.value)}
aria-label="Filtrar domínio de auditoria"
          >
          <option value="all">Todos os domínios</option>
            <option value="financeiro">Financeiro</option>
            <option value="operacional">Operacional</option>
            <option value="governance">Governance</option>
            <option value="cadastros">Cadastros</option>
            <option value="compliance">Compliance</option>
            <option value="sistema">Sistema</option>
          </select>
          <div className="search-wrap compact">
            <input
              type="search"
              value={auditQuery}
              onChange={(event) => setAuditQuery(event.target.value)}
              placeholder="Pesquisar por ação, detalhe ou ator"
            />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Ator</th>
                <th>Domínio</th>
                <th>Ação</th>
                <th>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {auditEntries.slice(0, 40).map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDate(entry.when)}</td>
                  <td>{entry.actor}</td>
                  <td>
                    <StatusPill label={cleanLabel(entry.domain)} tone={entry.tone} />
                  </td>
                  <td>{entry.action}</td>
                  <td>{entry.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel">
        <header className="panel-header">
          <h3>Trilho de auditoria recomendado para V1</h3>
          <span>Campos mínimos</span>
        </header>
        <div className="audit-grid">
          <article>
            <h4>Financeiro</h4>
            <p>
            Criação/edição de encargos, alteração de valores, conciliação manual e anulações de pagamentos devem ser
              auditados com before/after.
            </p>
          </article>
          <article>
            <h4>Governance</h4>
            <p>
            Convocatórias, alterações de ordem de trabalhos, votações e atas publicadas exigem registo de ator,
            timestamp e justificação.
            </p>
          </article>
          <article>
            <h4>Dados pessoais</h4>
            <p>
            Operações de exportação, apagamento e retificação de dados devem ter trilho completo para resposta a
              pedidos do titular.
            </p>
          </article>
        </div>
      </article>
    </div>
  );
}

function StatusPill({ label, tone = "neutral" }) {
  return <span className={`status-pill ${tone}`}>{label}</span>;
}

export default App;
