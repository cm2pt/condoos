import { LABEL_OVERRIDES, MODULES, PROFILE_CAPABILITIES, QUICK_ACTION_TYPES } from "./constants.js";

export const numberFormatter = new Intl.NumberFormat("pt-PT");
export const currencyFormatter = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});
export const dateFormatter = new Intl.DateTimeFormat("pt-PT", {
  dateStyle: "medium",
});

export function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replace(/\s+/g, "_");
}

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

export function formatDate(dateLike) {
  if (!dateLike) {
    return "-";
  }

  return dateFormatter.format(new Date(dateLike));
}

export function statusTone(status) {
  const normalized = normalizeKey(status);

  if (["paid", "resolved", "closed", "pronto", "ready", "active", "ativo"].includes(normalized)) {
    return "success";
  }

  if (["overdue", "critical", "crítica", "critica", "em_atraso"].includes(normalized)) {
    return "danger";
  }

  if (
    [
      "partially_paid",
      "in_progress",
      "em_execução",
      "em_execucao",
      "triage",
      "open",
      "new",
      "waiting_supplier",
      "agenda",
      "review",
      "em_revisão",
      "em_revisao",
    ].includes(normalized)
  ) {
    return "warning";
  }

  return "neutral";
}

export function cleanLabel(value) {
  const normalizedValue = normalizeKey(value);
  if (LABEL_OVERRIDES[normalizedValue]) {
    return LABEL_OVERRIDES[normalizedValue];
  }

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

  return normalizedValue
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((token) => tokenOverrides[token.toLowerCase()] || token.replace(/^\w/, (char) => char.toUpperCase()))
    .join(" ");
}

export function getModuleTitle(moduleId) {
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

export function getProfileCapability(profileId, capabilityMap = PROFILE_CAPABILITIES) {
  return capabilityMap[profileId] || PROFILE_CAPABILITIES[profileId] || PROFILE_CAPABILITIES.manager;
}

export function normalizeCapabilityForProfile(capability, profileId) {
  const fallback = getProfileCapability(profileId, PROFILE_CAPABILITIES);
  const allowedModuleIds = new Set(MODULES.map((module) => module.id));
  const allowedQuickActionIds = new Set(QUICK_ACTION_TYPES.map((item) => item.id));
  const hasCapabilityModules = Array.isArray(capability?.modules);
  const hasCapabilityQuickActions = Array.isArray(capability?.quickActions);

  const modules = hasCapabilityModules
    ? capability.modules.filter((moduleId) => typeof moduleId === "string" && allowedModuleIds.has(moduleId))
    : fallback.modules;

  const quickActions = hasCapabilityQuickActions
    ? capability.quickActions.filter((actionId) => typeof actionId === "string" && allowedQuickActionIds.has(actionId))
    : fallback.quickActions;

  const sanitizedModules = [...new Set(modules)];
  const sanitizedQuickActions = [...new Set(quickActions)];

  return {
    modules: hasCapabilityModules ? sanitizedModules : fallback.modules,
    quickActions: hasCapabilityQuickActions ? sanitizedQuickActions : fallback.quickActions,
  };
}

export function getDocumentVisibilityScope(profileId) {
  const visibilityByProfile = {
    manager: ["manager_only", "residents", "all"],
    accounting: ["residents", "all"],
    operations: ["residents", "all"],
    resident: ["residents", "all"],
  };

  return visibilityByProfile[profileId] || [];
}

export function canProfileReadDocument(profileId, documentVisibility) {
  const allowedVisibilities = getDocumentVisibilityScope(profileId);
  return allowedVisibilities.includes(documentVisibility);
}

export function getExportPresetKeys(moduleId, profileId) {
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
    resident: {
      dashboard: ["section", "item", "value"],
      fractions: ["fracao", "titular"],
      finance: ["fracao", "periodo", "vencimento", "valor", "emFalta", "estado"],
      issues: ["id", "titulo", "categoria", "prioridade", "estado"],
      assemblies: ["id", "tipo", "data"],
      portal: ["fracao", "periodo", "vencimento", "valor", "estado"],
      documents: ["titulo", "categoria", "upload"],
      compliance: ["tipo", "item", "estado"],
    },
  };

  return presets[profileId]?.[moduleId] || presets.manager[moduleId];
}

export function toEnvText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function toEnvBool(value, fallback = false) {
  const normalized = toEnvText(value).toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}
