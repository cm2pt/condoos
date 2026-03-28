export const MODULES = [
  { id: "dashboard", label: "Painel", mobile: "Painel", icon: "LayoutDashboard" },
  { id: "fractions", label: "Frações", mobile: "Frações", icon: "Building2" },
  { id: "finance", label: "Financeiro", mobile: "Financeiro", icon: "Wallet" },
  { id: "reports", label: "Relatórios", mobile: "Relatórios", icon: "BarChart3" },
  { id: "issues", label: "Ocorrências", mobile: "Ocorrências", icon: "Wrench" },
  { id: "assemblies", label: "Assembleias", mobile: "Assembleias", icon: "Vote" },
  { id: "portal", label: "Portal condómino", mobile: "Portal", icon: "Users" },
  { id: "documents", label: "Documentos", mobile: "Docs", icon: "FolderOpen" },
  { id: "compliance", label: "Compliance", mobile: "RGPD", icon: "ShieldCheck" },
];

export const QUICK_ACTION_TYPES = [
  { id: "fractions", label: "Fração" },
  { id: "finance", label: "Encargo" },
  { id: "issues", label: "Ocorrência" },
  { id: "assemblies", label: "Assembleia" },
];

export const HEADER_ACTION_LABEL = {
  dashboard: "Nova ação",
  fractions: "Nova fração",
  finance: "Novo encargo",
  reports: "Nova ação",
  issues: "Nova ocorrência",
  assemblies: "Nova assembleia",
  portal: "Nova ação",
  documents: "Nova ação",
  compliance: "Nova ação",
};

export const PROFILE_OPTIONS = [
  { id: "manager", label: "Gestão" },
  { id: "accounting", label: "Contabilidade" },
  { id: "operations", label: "Operações" },
  { id: "resident", label: "Condómino" },
];

export const PROFILE_CAPABILITIES = {
  manager: {
    modules: ["dashboard", "fractions", "finance", "reports", "issues", "assemblies", "portal", "documents", "compliance"],
    quickActions: ["fractions", "finance", "issues", "assemblies"],
  },
  accounting: {
    modules: ["dashboard", "fractions", "finance", "reports", "portal", "documents", "compliance"],
    quickActions: ["fractions", "finance"],
  },
  operations: {
    modules: ["dashboard", "fractions", "finance", "issues", "assemblies", "portal", "documents", "compliance"],
    quickActions: ["fractions", "issues", "assemblies"],
  },
  resident: {
    modules: ["dashboard", "finance", "issues", "portal", "documents"],
    quickActions: ["issues"],
  },
};

export const STORAGE_KEY = "condoos_runtime_v1";
export const TENANT_STORAGE_KEY = "condoos_selected_tenant";

export const DEV_DEMO_PROFILE_CREDENTIALS = {
  manager: {
    email: "gestao.demo@condoos.pt",
    password: "Condoos!Gestao2026",
  },
  accounting: {
    email: "contabilidade.demo@condoos.pt",
    password: "Condoos!Contabilidade2026",
  },
  operations: {
    email: "operacoes.demo@condoos.pt",
    password: "Condoos!Operacoes2026",
  },
  resident: {
    email: "condomino.demo@condoos.pt",
    password: "Condoos!Condomino2026",
  },
};

export const DEMO_PROFILE_COPY = {
  manager: "Visão completa da gestão diária do condomínio.",
  accounting: "Acompanhamento de quotas, cobranças e pagamentos.",
  operations: "Abertura e acompanhamento de ocorrências operacionais.",
  resident: "Experiência do condómino no portal da sua fração.",
};

export const BRAND_SYMBOL_SRC = "/brand/condoo-symbol.svg";
export const BRAND_WORDMARK_SRC = "/brand/condoo-wordmark.svg";

export const ISSUE_COLUMNS = [
  { key: "new", label: "Novo" },
  { key: "triage", label: "Triagem" },
  { key: "in_progress", label: "Em curso" },
  { key: "waiting_supplier", label: "Fornecedor" },
  { key: "resolved", label: "Resolvido" },
  { key: "closed", label: "Fechado" },
];

export const PRIORITY_LABEL = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

export const ISSUE_STATUS_LABEL = {
  new: "Novo",
  triage: "Triagem",
  in_progress: "Em curso",
  waiting_supplier: "Fornecedor",
  resolved: "Resolvido",
  closed: "Fechado",
};

export const ISSUE_STATUS_FLOW = ["new", "triage", "in_progress", "waiting_supplier", "resolved", "closed"];

export const TEMPLATE_CHECKLIST = [
  { id: "convocatoria", label: "Convocatória de assembleia", status: "ready" },
  { id: "ata", label: "Ata de assembleia", status: "ready" },
  { id: "procuracao", label: "Procuração", status: "ready" },
  { id: "divida", label: "Notificação de quota em atraso", status: "ready" },
  { id: "privacidade", label: "Política de privacidade", status: "ready" },
  { id: "dpa", label: "Acordo DPA", status: "ready" },
  { id: "incidente", label: "Registo de incidente RGPD", status: "ready" },
  { id: "plano-pagamento", label: "Plano de pagamento de dívida", status: "ready" },
];

export const COMPLIANCE_TASKS = [
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

export const LABEL_OVERRIDES = {
  manager: "Gestão",
  accounting: "Contabilidade",
  operations: "Operações",
  resident: "Condómino",
  active: "Ativo",
  inactive: "Inativo",
  open: "Em aberto",
  partially_paid: "Parcialmente pago",
  paid: "Pago",
  overdue: "Em atraso",
  new: "Novo",
  triage: "Triagem",
  in_progress: "Em curso",
  waiting_supplier: "A aguardar fornecedor",
  resolved: "Resolvido",
  closed: "Fechado",
  manager_only: "Gestão",
  residents: "Condóminos",
  all: "Todos",
  agenda: "Agendado",
  reserve_fund: "Fundo de reserva",
  adjustment: "Acerto",
  penalty: "Penalização",
  bank_transfer: "Transferência bancária",
  direct_debit: "Débito direto",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  card: "Cartão",
  cash: "Numerário",
  mbway: "MB WAY",
  governance: "Governação",
  compliance: "Conformidade",
  rgpd: "RGPD",
  ready: "Pronto",
};
