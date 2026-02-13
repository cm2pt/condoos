import fs from "fs";
import path from "path";

const outputPath = path.resolve("data/synthetic/condominio_portugal_seed.json");

const floorPlan = [
  { floor: 0, codes: ["LJ1", "LJ2", "G01", "AR01"] },
  { floor: 1, codes: ["1A", "1B", "1C"] },
  { floor: 2, codes: ["2A", "2B", "2C"] },
  { floor: 3, codes: ["3A", "3B", "3C"] },
  { floor: 4, codes: ["4A", "4B", "4C"] },
  { floor: 5, codes: ["5A", "5B", "5C"] },
  { floor: 6, codes: ["6A", "6B", "6C"] },
  { floor: 7, codes: ["7A", "7B"] },
  { floor: 8, codes: ["8A", "8B"] },
  { floor: 9, codes: ["9A", "9B"] },
  { floor: 10, codes: ["10A", "10B"] },
];

const ownerNames = [
  "Ana Martins",
  "Joao Pereira",
  "Carla Sousa",
  "Miguel Costa",
  "Rita Gomes",
  "Pedro Silva",
  "Sofia Teixeira",
  "Nuno Almeida",
  "Ines Fernandes",
  "Tiago Rocha",
  "Beatriz Duarte",
  "Diogo Araujo",
  "Mariana Neves",
  "Bruno Correia",
  "Helena Cardoso",
  "Ricardo Pires",
  "Marta Lopes",
  "Goncalo Faria",
  "Patricia Reis",
  "Luis Baptista",
  "Sara Moreira",
  "Andre Tavares",
  "Vera Mota",
  "Rui Mendonca",
  "Claudia Matos",
  "Daniel Coelho",
  "Filipa Freitas",
  "Hugo Monteiro",
  "Teresa Vidal",
  "Paulo Cunha",
];

const typologies = ["T0", "T1", "T1", "T2", "T2", "T3", "T3", "T4"];
let residentialIndex = 0;

const fractions = [];
for (const level of floorPlan) {
  for (const code of level.codes) {
    let type = "habitacao";
    let typology = typologies[residentialIndex % typologies.length];
    let privateAreaM2 = 68 + (residentialIndex % 6) * 8 + level.floor * 1.5;
    let permillage = 30 + (residentialIndex % 5) * 2;
    let monthlyFee = 52 + level.floor * 2 + (residentialIndex % 4) * 3;

    if (code.startsWith("LJ")) {
      type = "loja";
      typology = "N/A";
      privateAreaM2 = code === "LJ1" ? 95 : 88;
      permillage = code === "LJ1" ? 44 : 40;
      monthlyFee = code === "LJ1" ? 165 : 148;
    } else if (code.startsWith("G")) {
      type = "estacionamento";
      typology = "N/A";
      privateAreaM2 = 14;
      permillage = 8;
      monthlyFee = 18;
    } else if (code.startsWith("AR")) {
      type = "arrecadacao";
      typology = "N/A";
      privateAreaM2 = 11;
      permillage = 6;
      monthlyFee = 12;
    } else {
      residentialIndex += 1;
    }

    fractions.push({
      id: `fraction-${code.toLowerCase()}`,
      code,
      floorNumber: level.floor,
      type,
      typology,
      privateAreaM2,
      permillage,
      monthlyFee,
      status: "active",
    });
  }
}

const owners = fractions.map((fraction, index) => {
  const name = ownerNames[index] || `Proprietario ${index + 1}`;
  const base = String(index + 1).padStart(3, "0");
  return {
    id: `person-owner-${base}`,
    fullName: name,
    roleType: "owner",
    taxNumber: `2${String(10000000 + index).slice(-8)}`,
    email: `owner${base}@example.pt`,
    phone: `+35191000${base}`,
  };
});

const tenants = fractions
  .filter((fraction) => fraction.type === "habitacao")
  .filter((_, index) => index % 4 === 0)
  .map((fraction, index) => {
    const base = String(index + 1).padStart(3, "0");
    return {
      id: `person-tenant-${base}`,
      fullName: `Arrendatario ${index + 1}`,
      roleType: "tenant",
      taxNumber: `2${String(20000000 + index).slice(-8)}`,
      email: `tenant${base}@example.pt`,
      phone: `+35192000${base}`,
      fractionId: fraction.id,
    };
  });

const managers = [
  {
    id: "person-manager-001",
    fullName: "Luis Laginha",
    roleType: "manager",
    taxNumber: "299000001",
    email: "gestor1@example.pt",
    phone: "+351930000001",
  },
  {
    id: "person-manager-002",
    fullName: "Mafalda Ribeiro",
    roleType: "manager",
    taxNumber: "299000002",
    email: "gestor2@example.pt",
    phone: "+351930000002",
  },
];

const suppliers = [
  {
    id: "person-supplier-001",
    fullName: "Elevadores Atlantico Lda",
    roleType: "supplier",
    taxNumber: "509000001",
    email: "suporte@elevadoresatlantico.pt",
    phone: "+351210000001",
    specialty: "elevador",
  },
  {
    id: "person-supplier-002",
    fullName: "CanalMax Servicos",
    roleType: "supplier",
    taxNumber: "509000002",
    email: "equipas@canalmax.pt",
    phone: "+351210000002",
    specialty: "canalizacao",
  },
  {
    id: "person-supplier-003",
    fullName: "LuzPronta Manutencao",
    roleType: "supplier",
    taxNumber: "509000003",
    email: "helpdesk@luzpronta.pt",
    phone: "+351210000003",
    specialty: "eletricidade",
  },
  {
    id: "person-supplier-004",
    fullName: "PortaSegura Tecnica",
    roleType: "supplier",
    taxNumber: "509000004",
    email: "operacoes@portasegura.pt",
    phone: "+351210000004",
    specialty: "acessos",
  },
  {
    id: "person-supplier-005",
    fullName: "HigiaLimpa Lda",
    roleType: "supplier",
    taxNumber: "509000005",
    email: "coord@higialimpa.pt",
    phone: "+351210000005",
    specialty: "limpeza",
  },
];

const people = [...owners, ...tenants, ...managers, ...suppliers];

const fractionParties = owners.map((owner, index) => ({
  id: `fp-owner-${String(index + 1).padStart(3, "0")}`,
  fractionId: fractions[index].id,
  personId: owner.id,
  relationship: "owner",
  startDate: "2024-01-01",
  endDate: null,
  isPrimary: true,
}));

tenants.forEach((tenant, index) => {
  fractionParties.push({
    id: `fp-tenant-${String(index + 1).padStart(3, "0")}`,
    fractionId: tenant.fractionId,
    personId: tenant.id,
    relationship: "tenant",
    startDate: "2025-01-01",
    endDate: null,
    isPrimary: false,
  });
});

const chargePeriods = [
  { month: "2026-01", dueDate: "2026-01-08" },
  { month: "2026-02", dueDate: "2026-02-08" },
];

const charges = [];
for (const period of chargePeriods) {
  for (const fraction of fractions) {
    charges.push({
      id: `charge-${period.month}-${fraction.code.toLowerCase()}`,
      condominiumId: "condo-pt-001",
      fractionId: fraction.id,
      kind: "quota",
      period: period.month,
      dueDate: period.dueDate,
      amount: fraction.monthlyFee,
      status: "open",
    });
  }
}

const payments = [];
for (const charge of charges) {
  const isJanuary = charge.period === "2026-01";
  const fractionCode = charge.id.split("-").slice(3).join("-");
  const hash = fractionCode
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  if (isJanuary && hash % 7 !== 0) {
    payments.push({
      id: `pay-${charge.id}`,
      chargeId: charge.id,
      condominiumId: "condo-pt-001",
      fractionId: charge.fractionId,
      method: hash % 3 === 0 ? "multibanco" : hash % 3 === 1 ? "mbway" : "bank_transfer",
      amount: charge.amount,
      paidAt: "2026-01-06",
      reference: `MB-${100000 + hash}`,
      source: "imported",
    });
    charge.status = "paid";
  }

  if (!isJanuary && hash % 5 === 0) {
    const partial = Number((charge.amount * 0.5).toFixed(2));
    payments.push({
      id: `pay-${charge.id}-partial`,
      chargeId: charge.id,
      condominiumId: "condo-pt-001",
      fractionId: charge.fractionId,
      method: "mbway",
      amount: partial,
      paidAt: "2026-02-07",
      reference: `MBW-${200000 + hash}`,
      source: "manual",
    });
    charge.status = "partially_paid";
  }
}

for (const charge of charges) {
  if (charge.status === "open" && charge.period === "2026-01") {
    charge.status = "overdue";
  }
}

const documentCatalog = [
  "regulamento_interno",
  "ata_assembleia",
  "convocatoria",
  "apolice_seguro",
  "contrato_manutencao_elevador",
  "contrato_limpeza",
  "certificado_eletrico",
  "certificado_extintores",
  "orcamento_obra",
  "fatura_fornecedor",
  "recibo_quota",
  "mapa_quotas",
  "politica_privacidade",
  "termos_utilizacao",
  "dpa_subcontratante",
  "plano_emergencia",
  "plano_preventivo_manutencao",
  "inspecao_gas",
  "inspecao_elevador",
  "apolice_multirriscos",
];

const documents = documentCatalog.map((type, index) => ({
  id: `doc-${String(index + 1).padStart(3, "0")}`,
  condominiumId: "condo-pt-001",
  category: type,
  title: `${type.replaceAll("_", " ").toUpperCase()} ${index + 1}`,
  visibility: index % 3 === 0 ? "manager_only" : index % 3 === 1 ? "residents" : "all",
  uploadedByPersonId: "person-manager-001",
  uploadedAt: `2026-01-${String((index % 20) + 1).padStart(2, "0")}`,
  storagePath: `/condo-pt-001/documents/${type}-${index + 1}.pdf`,
}));

const issueTemplates = [
  {
    category: "infiltracao",
    title: "Infiltracao na parede da caixa de escadas",
    priority: "high",
    status: "in_progress",
    assignedSupplier: "person-supplier-002",
    fractionId: "fraction-6a",
  },
  {
    category: "elevador",
    title: "Elevador para entre os pisos 3 e 4",
    priority: "critical",
    status: "waiting_supplier",
    assignedSupplier: "person-supplier-001",
    fractionId: null,
  },
  {
    category: "ruido",
    title: "Queixa de ruido apos as 23h",
    priority: "medium",
    status: "new",
    assignedSupplier: null,
    fractionId: "fraction-2b",
  },
  {
    category: "iluminacao",
    title: "Luminaria fundida no piso -1",
    priority: "low",
    status: "resolved",
    assignedSupplier: "person-supplier-003",
    fractionId: null,
  },
  {
    category: "porta_garagem",
    title: "Porta da garagem nao fecha totalmente",
    priority: "high",
    status: "in_progress",
    assignedSupplier: "person-supplier-004",
    fractionId: null,
  },
  {
    category: "limpeza",
    title: "Reforco de limpeza no hall principal",
    priority: "low",
    status: "closed",
    assignedSupplier: "person-supplier-005",
    fractionId: null,
  },
  {
    category: "canalizacao",
    title: "Fuga de agua no patamar do 5o andar",
    priority: "high",
    status: "triage",
    assignedSupplier: "person-supplier-002",
    fractionId: "fraction-5b",
  },
  {
    category: "eletricidade",
    title: "Quadro eletrico com disparos recorrentes",
    priority: "critical",
    status: "waiting_supplier",
    assignedSupplier: "person-supplier-003",
    fractionId: null,
  },
  {
    category: "videoporteiro",
    title: "Videoporteiro sem audio na entrada B",
    priority: "medium",
    status: "new",
    assignedSupplier: "person-supplier-004",
    fractionId: null,
  },
  {
    category: "jardim",
    title: "Sistema de rega avariado",
    priority: "low",
    status: "resolved",
    assignedSupplier: "person-supplier-005",
    fractionId: null,
  },
  {
    category: "pragas",
    title: "Sinais de pragas na zona de lixo",
    priority: "medium",
    status: "in_progress",
    assignedSupplier: "person-supplier-005",
    fractionId: null,
  },
  {
    category: "seguranca",
    title: "Fechadura avariada na porta tecnica",
    priority: "high",
    status: "closed",
    assignedSupplier: "person-supplier-004",
    fractionId: null,
  },
  {
    category: "infiltracao",
    title: "Humidade no teto da fracao 8B",
    priority: "medium",
    status: "triage",
    assignedSupplier: "person-supplier-002",
    fractionId: "fraction-8b",
  },
  {
    category: "elevador",
    title: "Ruido anormal na subida",
    priority: "medium",
    status: "resolved",
    assignedSupplier: "person-supplier-001",
    fractionId: null,
  },
  {
    category: "limpeza",
    title: "Reposicao de consumiveis WC comum",
    priority: "low",
    status: "closed",
    assignedSupplier: "person-supplier-005",
    fractionId: null,
  },
  {
    category: "canalizacao",
    title: "Baixa pressao de agua no 10A",
    priority: "medium",
    status: "new",
    assignedSupplier: "person-supplier-002",
    fractionId: "fraction-10a",
  },
];

const issues = issueTemplates.map((issue, index) => ({
  id: `issue-${String(index + 1).padStart(3, "0")}`,
  condominiumId: "condo-pt-001",
  fractionId: issue.fractionId,
  createdByPersonId: owners[index % owners.length].id,
  category: issue.category,
  priority: issue.priority,
  status: issue.status,
  title: issue.title,
  description: `Descricao detalhada da ocorrencia: ${issue.title}.`,
  openedAt: `2026-01-${String((index % 20) + 1).padStart(2, "0")}T10:30:00Z`,
  closedAt: issue.status === "closed" || issue.status === "resolved" ? `2026-02-${String((index % 10) + 1).padStart(2, "0")}T16:00:00Z` : null,
  assignedSupplierPersonId: issue.assignedSupplier,
}));

const workOrders = issues
  .filter((issue) => issue.assignedSupplierPersonId)
  .map((issue, index) => ({
    id: `wo-${String(index + 1).padStart(3, "0")}`,
    issueId: issue.id,
    supplierPersonId: issue.assignedSupplierPersonId,
    requestedAt: issue.openedAt,
    scheduledAt: `2026-02-${String((index % 10) + 1).padStart(2, "0")}T09:00:00Z`,
    completedAt: issue.closedAt,
    estimatedCost: 80 + index * 25,
    finalCost: issue.closedAt ? 90 + index * 20 : null,
    notes: issue.closedAt ? "Intervencao concluida e validada." : "A aguardar conclusao do fornecedor.",
  }));

const assemblies = [
  {
    id: "assembly-2026-ord-01",
    condominiumId: "condo-pt-001",
    meetingType: "ordinary",
    scheduledAt: "2026-03-20T20:30:00Z",
    location: "Sala comum do condominio",
    callNoticeSentAt: "2026-03-05T09:00:00Z",
    minutesDocumentId: null,
    voteItems: [
      {
        id: "vote-item-001",
        itemNumber: 1,
        description: "Aprovacao de contas de 2025",
        votingRule: "simple_majority",
        summary: { for: 680, against: 120, abstention: 60 },
      },
      {
        id: "vote-item-002",
        itemNumber: 2,
        description: "Aprovacao do orcamento de 2026",
        votingRule: "simple_majority",
        summary: { for: 640, against: 150, abstention: 70 },
      },
      {
        id: "vote-item-003",
        itemNumber: 3,
        description: "Substituicao de videoporteiro",
        votingRule: "permillage_majority",
        summary: { for: 720, against: 90, abstention: 50 },
      },
    ],
  },
  {
    id: "assembly-2026-ext-01",
    condominiumId: "condo-pt-001",
    meetingType: "extraordinary",
    scheduledAt: "2026-05-12T20:30:00Z",
    location: "Sala comum do condominio",
    callNoticeSentAt: "2026-04-28T09:00:00Z",
    minutesDocumentId: null,
    voteItems: [
      {
        id: "vote-item-004",
        itemNumber: 1,
        description: "Obra de impermeabilizacao da cobertura",
        votingRule: "permillage_majority",
        summary: { for: 760, against: 120, abstention: 30 },
      },
    ],
  },
];

const kpisSnapshot = {
  period: "2026-02",
  totalFractions: fractions.length,
  activeResidentsApprox: owners.length + tenants.length,
  chargesOpen: charges.filter((charge) => charge.status === "open" || charge.status === "overdue" || charge.status === "partially_paid").length,
  chargesPaid: charges.filter((charge) => charge.status === "paid").length,
  collectionRatePercent: 78.4,
  issuesOpen: issues.filter((issue) => ["new", "triage", "in_progress", "waiting_supplier"].includes(issue.status)).length,
  issuesClosed: issues.filter((issue) => ["resolved", "closed"].includes(issue.status)).length,
  avgResolutionHours: 42,
};

const dataset = {
  meta: {
    generatedAt: "2026-02-12",
    locale: "pt-PT",
    currency: "EUR",
    disclaimer: "Dados sinteticos para desenvolvimento e QA. Nao representam pessoas reais.",
  },
  condominium: {
    id: "condo-pt-001",
    name: "Condominio Jardim Atlantico",
    taxNumber: "509123456",
    address: "Rua das Magnolias, 25",
    postalCode: "1700-123",
    city: "Lisboa",
    country: "PT",
    floors: 11,
    totalFractions: 30,
    managementType: "professional",
    managerCompany: "GestCondo Pro, Lda",
  },
  catalogs: {
    documentTypes: documentCatalog,
    issueCategories: [
      "infiltracao",
      "elevador",
      "ruido",
      "iluminacao",
      "porta_garagem",
      "limpeza",
      "jardim",
      "canalizacao",
      "eletricidade",
      "videoporteiro",
      "pragas",
      "seguranca",
    ],
    paymentMethods: ["bank_transfer", "multibanco", "mbway", "sepa", "cash"],
  },
  fractions,
  people,
  fractionParties,
  charges,
  payments,
  documents,
  issues,
  workOrders,
  assemblies,
  kpisSnapshot,
};

fs.writeFileSync(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
console.log(`Seed generated at: ${outputPath}`);
console.log(`Fractions: ${fractions.length}, People: ${people.length}, Charges: ${charges.length}, Issues: ${issues.length}`);
