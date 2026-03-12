// VITE_API_BASE_URL controla o endpoint da API.
// Em dev: configurar no .env.development.local ou usar proxy do Vite.
// Em produção (Vercel): não definir — resolve para "" (mesma origem).
const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const AUTH_STORAGE_KEY = "condoos_auth_v1";

function toErrorMessage(status, payload) {
  if (payload && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  if (status === 401) {
    return "Sessao expirada ou credenciais invalidas.";
  }

  if (status === 403) {
    return "Sem permissao para executar esta operacao.";
  }

  if (status >= 500) {
    return "Erro interno no servidor API.";
  }

  return "Nao foi possivel concluir o pedido.";
}

async function request(path, { method = "GET", token, tenantId, body } = {}) {
  const headers = {
    Accept: "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (tenantId) {
    headers["x-tenant-id"] = tenantId;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(`${DEFAULT_API_BASE_URL}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(`API indisponivel em ${DEFAULT_API_BASE_URL}. Inicia o backend com \"npm run api\".`);
  }

  const payload = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(toErrorMessage(response.status, payload));
  }

  return payload;
}

function parseFilenameFromDisposition(contentDispositionValue, fallback = "documento.txt") {
  if (!contentDispositionValue) {
    return fallback;
  }

  const utf8Match = contentDispositionValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const simpleMatch = contentDispositionValue.match(/filename=\"?([^\";]+)\"?/i);
  if (simpleMatch?.[1]) {
    return simpleMatch[1];
  }

  return fallback;
}

function toDownloadSafeName(value) {
  const normalized = String(value || "documento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalized || "documento"}.txt`;
}

async function requestBinary(path, { method = "GET", token, tenantId, fallbackFilename = "documento.txt" } = {}) {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (tenantId) {
    headers["x-tenant-id"] = tenantId;
  }

  let response;
  try {
    response = await fetch(`${DEFAULT_API_BASE_URL}${path}`, {
      method,
      headers,
      credentials: "include",
    });
  } catch {
    throw new Error(`API indisponivel em ${DEFAULT_API_BASE_URL}. Inicia o backend com \"npm run api\".`);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(toErrorMessage(response.status, payload));
  }

  const blob = await response.blob();
  const filename = parseFilenameFromDisposition(response.headers.get("content-disposition"), fallbackFilename);
  return { blob, filename };
}

function mapFraction(item) {
  return {
    id: item.id,
    code: item.code,
    floorNumber: Number(item.floorNumber),
    type: item.type,
    typology: item.typology,
    privateAreaM2: Number(item.privateAreaM2),
    permillage: Number(item.permillage),
    monthlyFee: Number(item.monthlyFeeAmount),
    status: item.status,
  };
}

function mapCharge(item) {
  return {
    id: item.id,
    condominiumId: item.tenantId,
    fractionId: item.fractionId,
    kind: item.kind,
    period: item.period,
    dueDate: item.dueDate,
    amount: Number(item.amount),
    status: item.status,
  };
}

function mapPayment(item) {
  return {
    id: item.id,
    chargeId: item.chargeId,
    condominiumId: item.tenantId,
    fractionId: item.fractionId,
    method: item.method,
    amount: Number(item.amount),
    paidAt: item.paidAt,
    reference: item.reference,
    source: item.source,
    hasReceipt: Boolean(item.hasReceipt),
  };
}

function mapIssue(item) {
  return {
    id: item.id,
    condominiumId: item.tenantId,
    fractionId: item.fractionId,
    createdByPersonId: item.createdByPersonId,
    category: item.category,
    priority: item.priority,
    status: item.status,
    title: item.title,
    description: item.description,
    openedAt: item.openedAt,
    closedAt: item.closedAt,
    assignedSupplierPersonId: item.assignedSupplierPersonId,
  };
}

function mapPerson(item) {
  return {
    id: item.id,
    fullName: item.fullName,
    roleType: item.roleType,
    taxNumber: item.taxNumber,
    email: item.email,
    phone: item.phone,
  };
}

function mapFractionParty(item) {
  return {
    id: item.id,
    fractionId: item.fractionId,
    personId: item.personId,
    relationship: item.relationship,
    startDate: item.startDate,
    endDate: item.endDate,
    isPrimary: Boolean(item.isPrimary),
  };
}

function mapDocument(item) {
  return {
    id: item.id,
    condominiumId: item.tenantId,
    category: item.category,
    title: item.title,
    visibility: item.visibility,
    uploadedByPersonId: item.uploadedByPersonId,
    uploadedAt: item.uploadedAt,
    storagePath: item.storagePath,
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error("Falha ao ler ficheiro."));
    reader.readAsDataURL(file);
  });
}

function inferAuditDomain(action) {
  const normalized = String(action || "").toLowerCase();
  if (normalized.includes("charge") || normalized.includes("payment") || normalized.includes("finance")) {
    return "financeiro";
  }
  if (normalized.includes("issue") || normalized.includes("work")) {
    return "operacional";
  }
  if (normalized.includes("assembly") || normalized.includes("vote")) {
    return "governance";
  }
  if (normalized.includes("fraction") || normalized.includes("person") || normalized.includes("tenant")) {
    return "cadastros";
  }
  return "sistema";
}

function inferAuditTone(action) {
  const normalized = String(action || "").toLowerCase();
  if (normalized.includes("delete") || normalized.includes("error")) {
    return "danger";
  }
  if (normalized.includes("update") || normalized.includes("status")) {
    return "warning";
  }
  if (normalized.includes("create") || normalized.includes("login")) {
    return "success";
  }
  return "neutral";
}

function mapAuditEntry(item) {
  const detailChunks = [];
  if (item.entityType) {
    detailChunks.push(item.entityType);
  }
  if (item.entityId) {
    detailChunks.push(item.entityId);
  }

  return {
    id: `audit-api-${item.id}`,
    when: item.createdAt,
    actor: item.actorUserId || "Sistema",
    domain: inferAuditDomain(item.action),
    action: item.action,
    detail: detailChunks.join(" | "),
    tone: inferAuditTone(item.action),
  };
}

function mapCapabilities(item) {
  const modules = Array.isArray(item?.modules) ? item.modules.filter((value) => typeof value === "string") : [];
  const quickActions = Array.isArray(item?.quickActions)
    ? item.quickActions.filter((value) => typeof value === "string")
    : [];

  return { modules, quickActions };
}

export function readStoredAuthSession() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.tenantId) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function persistAuthSession(session) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function loginApi({ email, password }) {
  const payload = await request("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });

  return {
    token: payload.token,
    tokenType: payload.tokenType,
    expiresIn: payload.expiresIn,
    refreshToken: payload.refreshToken || null,
    refreshTokenExpiresAt: payload.refreshTokenExpiresAt || null,
    user: payload.user,
    capabilities: mapCapabilities(payload.capabilities),
    tenants: payload.tenants || [],
    tenantId: payload.defaultTenantId || payload.tenants?.[0]?.id || null,
  };
}

export async function fetchMySession(session) {
  const payload = await request("/api/auth/me", {
    token: session.token,
    tenantId: session.tenantId,
  });

  return {
    ...payload,
    capabilities: mapCapabilities(payload.capabilities),
  };
}

export async function fetchCoreRuntime(session) {
  const [fractionsResult, peopleResult, fractionPartiesResult, chargesResult, paymentsResult, issuesResult, documentsResult, auditResult] = await Promise.all([
    request("/api/fractions", { token: session.token, tenantId: session.tenantId }).catch(() => ({ items: [] })),
    request("/api/people", { token: session.token, tenantId: session.tenantId }).catch(() => ({ items: [] })),
    request("/api/fraction-parties", { token: session.token, tenantId: session.tenantId }).catch(() => ({ items: [] })),
    request("/api/finance/charges", { token: session.token, tenantId: session.tenantId }).catch(() => ({ items: [] })),
    request("/api/finance/payments", { token: session.token, tenantId: session.tenantId }).catch(() => ({ items: [] })),
    request("/api/issues", { token: session.token, tenantId: session.tenantId }).catch(() => ({ items: [] })),
    request("/api/documents", { token: session.token, tenantId: session.tenantId }).catch(() => ({ items: [] })),
    request("/api/audit-log?limit=80", { token: session.token, tenantId: session.tenantId }).catch(() => ({ items: [] })),
  ]);

  return {
    fractions: (fractionsResult.items || []).map(mapFraction),
    people: (peopleResult.items || []).map(mapPerson),
    fractionParties: (fractionPartiesResult.items || []).map(mapFractionParty),
    charges: (chargesResult.items || []).map(mapCharge),
    payments: (paymentsResult.items || []).map(mapPayment),
    issues: (issuesResult.items || []).map(mapIssue),
    documents: (documentsResult.items || []).map(mapDocument),
    auditEntries: (auditResult.items || []).map(mapAuditEntry),
  };
}

export async function fetchFractions(session) {
  const result = await request("/api/fractions", { token: session.token, tenantId: session.tenantId });
  return (result.items || []).map(mapFraction);
}

export async function fetchPeople(session) {
  const result = await request("/api/people", { token: session.token, tenantId: session.tenantId });
  return (result.items || []).map(mapPerson);
}

export async function fetchFractionParties(session) {
  const result = await request("/api/fraction-parties", { token: session.token, tenantId: session.tenantId });
  return (result.items || []).map(mapFractionParty);
}

export async function fetchCharges(session) {
  const result = await request("/api/finance/charges", { token: session.token, tenantId: session.tenantId });
  return (result.items || []).map(mapCharge);
}

export async function fetchPayments(session) {
  const result = await request("/api/finance/payments", { token: session.token, tenantId: session.tenantId });
  return (result.items || []).map(mapPayment);
}

export async function fetchIssues(session) {
  const result = await request("/api/issues", { token: session.token, tenantId: session.tenantId });
  return (result.items || []).map(mapIssue);
}

export async function fetchDocuments(session) {
  const result = await request("/api/documents", { token: session.token, tenantId: session.tenantId });
  return (result.items || []).map(mapDocument);
}

export async function fetchAuditLog(session) {
  const result = await request("/api/audit-log?limit=80", { token: session.token, tenantId: session.tenantId });
  return (result.items || []).map(mapAuditEntry);
}

export async function createFractionApi(session, values) {
  const payload = await request("/api/fractions", {
    method: "POST",
    token: session.token,
    tenantId: session.tenantId,
    body: values,
  });

  return mapFraction(payload.item);
}

export async function createPersonApi(session, values) {
  const payload = await request("/api/people", {
    method: "POST",
    token: session.token,
    tenantId: session.tenantId,
    body: values,
  });

  return mapPerson(payload.item);
}

export async function createFractionPartyApi(session, values) {
  const payload = await request("/api/fraction-parties", {
    method: "POST",
    token: session.token,
    tenantId: session.tenantId,
    body: values,
  });

  return mapFractionParty(payload.item);
}

export async function createChargeApi(session, values) {
  const payload = await request("/api/finance/charges", {
    method: "POST",
    token: session.token,
    tenantId: session.tenantId,
    body: values,
  });

  return mapCharge(payload.item);
}

export async function createIssueApi(session, values) {
  const payload = await request("/api/issues", {
    method: "POST",
    token: session.token,
    tenantId: session.tenantId,
    body: values,
  });

  return mapIssue(payload.item);
}

export async function createPaymentApi(session, values) {
  const payload = await request("/api/finance/payments", {
    method: "POST",
    token: session.token,
    tenantId: session.tenantId,
    body: values,
  });

  return {
    item: mapPayment(payload.item),
    chargeStatus: payload.chargeStatus,
  };
}

export async function advanceIssueStatusApi(session, issueId, status) {
  const payload = await request(`/api/issues/${issueId}/status`, {
    method: "PATCH",
    token: session.token,
    tenantId: session.tenantId,
    body: { status },
  });

  return mapIssue(payload.item);
}

export async function downloadDocumentApi(session, documentId, title = "documento") {
  return requestBinary(`/api/documents/${documentId}/download`, {
    token: session.token,
    tenantId: session.tenantId,
    fallbackFilename: toDownloadSafeName(title),
  });
}

export async function uploadDocumentApi(session, values) {
  const payload = {
    title: values.title,
    category: values.category,
    visibility: values.visibility,
    mimeType: values.file?.type || values.mimeType || "application/octet-stream",
    fileName: values.file?.name || values.fileName || "documento",
    uploadedByPersonId: values.uploadedByPersonId || null,
  };

  if (values.file) {
    payload.contentBase64 = await fileToBase64(values.file);
  } else if (typeof values.contentBase64 === "string") {
    payload.contentBase64 = values.contentBase64;
  }

  const response = await request("/api/documents", {
    method: "POST",
    token: session.token,
    tenantId: session.tenantId,
    body: payload,
  });

  return mapDocument(response.item);
}

export async function uploadDocumentVersionApi(session, documentId, values) {
  const payload = {
    mimeType: values.file?.type || values.mimeType || "application/octet-stream",
    fileName: values.file?.name || values.fileName || "documento",
  };

  if (values.file) {
    payload.contentBase64 = await fileToBase64(values.file);
  } else if (typeof values.contentBase64 === "string") {
    payload.contentBase64 = values.contentBase64;
  }

  const response = await request(`/api/documents/${documentId}/versions`, {
    method: "POST",
    token: session.token,
    tenantId: session.tenantId,
    body: payload,
  });

  return response.item;
}

export async function downloadPaymentReceiptApi(session, paymentId) {
  return requestBinary(`/api/finance/payments/${paymentId}/receipt`, {
    token: session.token,
    tenantId: session.tenantId,
    fallbackFilename: `recibo-${paymentId}.pdf`,
  });
}
