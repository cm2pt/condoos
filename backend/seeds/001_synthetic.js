import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

const SEED_FILE = path.resolve(process.cwd(), "data/synthetic/condominio_portugal_seed.json");

const DEMO_USERS = [
  { id: "app-user-manager-001", email: "gestao.demo@condoos.pt", fullName: "Gestao Demo", role: "manager", password: "Condoos!Gestao2026" },
  { id: "app-user-accounting-001", email: "contabilidade.demo@condoos.pt", fullName: "Contabilidade Demo", role: "accounting", password: "Condoos!Contabilidade2026" },
  { id: "app-user-operations-001", email: "operacoes.demo@condoos.pt", fullName: "Operacoes Demo", role: "operations", password: "Condoos!Operacoes2026" },
  { id: "app-user-resident-001", email: "condomino.demo@condoos.pt", fullName: "Condomino Demo", role: "resident", password: "Condoos!Condomino2026" },
];

// ── Helper: deterministic pseudo-random from seed string ──────────────────
function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

// ── Generate 10 months of charges (Jun 2025 – Mar 2026) ──────────────────
function generateHistoricalCharges(fractions, tenantId) {
  const months = [
    { period: "2025-06", dueDate: "2025-06-30" },
    { period: "2025-07", dueDate: "2025-07-31" },
    { period: "2025-08", dueDate: "2025-08-31" },
    { period: "2025-09", dueDate: "2025-09-30" },
    { period: "2025-10", dueDate: "2025-10-31" },
    { period: "2025-11", dueDate: "2025-11-30" },
    { period: "2025-12", dueDate: "2025-12-31" },
    { period: "2026-01", dueDate: "2026-01-31" },
    { period: "2026-02", dueDate: "2026-02-28" },
    { period: "2026-03", dueDate: "2026-03-31" },
  ];

  const rand = seededRandom("charges-history");
  const charges = [];
  const payments = [];
  const ledgerEntries = [];
  const receipts = [];
  const bankTransactions = [];
  let chargeIdx = 0;
  let paymentIdx = 0;
  let ledgerIdx = 0;
  let receiptIdx = 0;
  let bankIdx = 0;

  const paymentMethods = ["bank_transfer", "multibanco", "mbway", "sepa"];

  for (const month of months) {
    const isPast = month.period < "2026-03";
    const isRecent = month.period >= "2026-02";

    for (const frac of fractions) {
      chargeIdx++;
      const chargeId = `charge-hist-${String(chargeIdx).padStart(4, "0")}`;
      const r = rand();

      // Older months: mostly paid (90%+). Recent months: more varied
      let status;
      if (month.period < "2025-12") {
        status = r < 0.92 ? "paid" : r < 0.96 ? "overdue" : "partially_paid";
      } else if (month.period < "2026-02") {
        status = r < 0.82 ? "paid" : r < 0.90 ? "overdue" : r < 0.95 ? "partially_paid" : "open";
      } else if (month.period === "2026-02") {
        status = r < 0.70 ? "paid" : r < 0.80 ? "overdue" : r < 0.88 ? "partially_paid" : "open";
      } else {
        // March 2026 (current) — many open
        status = r < 0.35 ? "paid" : r < 0.45 ? "overdue" : r < 0.50 ? "partially_paid" : "open";
      }

      // Add extra charges (fundo reserva, seguro, obras) occasionally
      const kinds = [{ kind: "quota", amount: frac.monthlyFee }];
      if (month.period === "2025-07" && frac.permillage > 30) {
        kinds.push({ kind: "fundo_reserva", amount: Math.round(frac.monthlyFee * 0.15) });
      }
      if (month.period === "2025-12" && frac.permillage > 25) {
        kinds.push({ kind: "seguro", amount: Math.round(frac.permillage * 0.8) });
      }
      if (month.period === "2026-01" && frac.type === "habitacao") {
        kinds.push({ kind: "obras_fachada", amount: Math.round(frac.permillage * 2.5) });
      }

      for (const { kind, amount } of kinds) {
        const cid = kind === "quota" ? chargeId : `charge-hist-${String(++chargeIdx).padStart(4, "0")}`;
        const createdAt = `${month.period}-01T09:00:00Z`;

        charges.push({
          id: cid,
          tenant_id: tenantId,
          fraction_id: frac.id,
          kind,
          period: month.period,
          due_date: month.dueDate,
          amount,
          status,
          created_at: createdAt,
          updated_at: createdAt,
        });

        // Ledger entry for the charge
        ledgerIdx++;
        ledgerEntries.push({
          id: `ledger-${String(ledgerIdx).padStart(4, "0")}`,
          tenant_id: tenantId,
          fraction_id: frac.id,
          charge_id: cid,
          payment_id: null,
          entry_type: "charge_issued",
          amount,
          occurred_at: createdAt,
          metadata_json: JSON.stringify({ kind, period: month.period }),
          created_by_user_id: "app-user-accounting-001",
          created_at: createdAt,
        });

        // Generate payment if paid or partially_paid
        if (status === "paid" || status === "partially_paid") {
          paymentIdx++;
          const paymentId = `pay-hist-${String(paymentIdx).padStart(4, "0")}`;
          const paidAmount = status === "paid" ? amount : Math.round(amount * 0.6);
          const method = paymentMethods[paymentIdx % paymentMethods.length];
          // Pay between 1st and 25th of the month, or up to 15 days after due for late payers
          const payDay = String(Math.min(28, 3 + Math.floor(rand() * 22))).padStart(2, "0");
          const paidAt = `${month.period}-${payDay}T${String(8 + Math.floor(rand() * 10)).padStart(2, "0")}:${String(Math.floor(rand() * 60)).padStart(2, "0")}:00Z`;

          const ref = method === "multibanco"
            ? `MB${String(Math.floor(rand() * 999999)).padStart(6, "0")}`
            : method === "mbway"
              ? `MW${String(Math.floor(rand() * 999999)).padStart(6, "0")}`
              : `TRF${String(Math.floor(rand() * 999999)).padStart(6, "0")}`;

          payments.push({
            id: paymentId,
            tenant_id: tenantId,
            fraction_id: frac.id,
            charge_id: cid,
            method,
            amount: paidAmount,
            paid_at: paidAt,
            reference: ref,
            source: method === "mbway" ? "automatic" : "manual",
            created_at: paidAt,
          });

          // Ledger entry for payment
          ledgerIdx++;
          ledgerEntries.push({
            id: `ledger-${String(ledgerIdx).padStart(4, "0")}`,
            tenant_id: tenantId,
            fraction_id: frac.id,
            charge_id: cid,
            payment_id: paymentId,
            entry_type: "payment_received",
            amount: paidAmount,
            occurred_at: paidAt,
            metadata_json: JSON.stringify({ method, reference: ref }),
            created_by_user_id: null,
            created_at: paidAt,
          });

          // Receipt for fully paid charges
          if (status === "paid" && isPast) {
            receiptIdx++;
            receipts.push({
              id: `receipt-${String(receiptIdx).padStart(4, "0")}`,
              tenant_id: tenantId,
              payment_id: paymentId,
              receipt_number: `REC-${month.period.replace("-", "")}-${String(receiptIdx).padStart(3, "0")}`,
              storage_path: `receipts/${month.period}/${paymentId}.pdf`,
              mime_type: "application/pdf",
              file_size_bytes: 15000 + Math.floor(rand() * 5000),
              checksum_sha256: null,
              generated_at: paidAt,
              created_by_user_id: "app-user-accounting-001",
              created_at: paidAt,
            });
          }

          // Bank transaction matching — ~70% of payments have matched bank entries
          if (rand() < 0.7 && (method === "bank_transfer" || method === "sepa")) {
            bankIdx++;
            bankTransactions.push({
              id: `bank-${String(bankIdx).padStart(4, "0")}`,
              tenant_id: tenantId,
              booked_at: paidAt.split("T")[0],
              description: `TRF ${frac.code} quota ${month.period}`,
              amount: paidAmount,
              reference: ref,
              raw_json: null,
              status: "matched",
              matched_payment_id: paymentId,
              created_at: paidAt,
              updated_at: paidAt,
            });
          }
        }
      }
    }
  }

  // Add unmatched bank transactions (income from other sources)
  const unmatchedDescriptions = [
    { desc: "Juros deposito a prazo", amount: 45.20, date: "2025-08-15" },
    { desc: "Reembolso seguro sinistro elevador", amount: 1200.00, date: "2025-10-22" },
    { desc: "Aluguer sala comum - evento privado", amount: 150.00, date: "2025-11-08" },
    { desc: "Subsidio camara municipal jardim", amount: 500.00, date: "2026-01-20" },
    { desc: "Reembolso fornecedor obra cancelada", amount: 875.50, date: "2026-02-10" },
    { desc: "Juros deposito a prazo", amount: 38.90, date: "2026-02-28" },
    { desc: "Pagamento duplicado - devolucao pendente", amount: -65.00, date: "2026-03-05" },
    { desc: "TRF desconhecida - ref 998877", amount: 120.00, date: "2026-03-12" },
  ];
  for (const bt of unmatchedDescriptions) {
    bankIdx++;
    bankTransactions.push({
      id: `bank-${String(bankIdx).padStart(4, "0")}`,
      tenant_id: tenantId,
      booked_at: bt.date,
      description: bt.desc,
      amount: bt.amount,
      reference: null,
      raw_json: null,
      status: "unmatched",
      matched_payment_id: null,
      created_at: `${bt.date}T12:00:00Z`,
      updated_at: `${bt.date}T12:00:00Z`,
    });
  }

  return { charges, payments, ledgerEntries, receipts, bankTransactions };
}

// ── Generate historical issues (older, resolved ones) ─────────────────────
function generateHistoricalIssues(fractions, people, tenantId) {
  const suppliers = people.filter((p) => p.roleType === "supplier");
  const owners = people.filter((p) => p.roleType === "owner");
  const rand = seededRandom("issues-history");

  const historicalIssues = [
    { id: "issue-hist-001", category: "infiltracao", priority: "high", title: "Infiltração no tecto da garagem", description: "Água a infiltrar pelo tecto da garagem junto ao pilar central. Mancha de humidade com cerca de 2m².", openedAt: "2025-06-10T08:30:00Z", closedAt: "2025-07-05T16:00:00Z", status: "closed" },
    { id: "issue-hist-002", category: "elevador", priority: "critical", title: "Elevador parado no 3º andar", description: "Elevador ficou preso entre o 3º e 4º andar. Porta não abre. Sem passageiros no interior.", openedAt: "2025-06-15T19:45:00Z", closedAt: "2025-06-16T11:00:00Z", status: "closed" },
    { id: "issue-hist-003", category: "iluminacao", priority: "medium", title: "Lâmpadas fundidas no hall do 5º andar", description: "Duas das três lâmpadas do hall do 5º andar fundidas há mais de uma semana.", openedAt: "2025-07-01T10:00:00Z", closedAt: "2025-07-08T14:30:00Z", status: "closed" },
    { id: "issue-hist-004", category: "canalizacao", priority: "high", title: "Fuga de água na coluna central", description: "Fuga de água visível na coluna de abastecimento entre o 2º e 3º andar. Pressão reduzida nos andares superiores.", openedAt: "2025-07-20T07:15:00Z", closedAt: "2025-08-12T17:00:00Z", status: "closed" },
    { id: "issue-hist-005", category: "porta_garagem", priority: "medium", title: "Portão da garagem com ruído excessivo", description: "Portão automático da garagem a fazer ruído metálico ao abrir e fechar. Possível falta de lubrificação.", openedAt: "2025-08-05T09:00:00Z", closedAt: "2025-08-15T12:00:00Z", status: "closed" },
    { id: "issue-hist-006", category: "limpeza", priority: "low", title: "Limpeza insuficiente na zona do lixo", description: "Zona dos contentores do lixo com odor forte e sujidade acumulada. Limpeza profissional necessária.", openedAt: "2025-08-20T11:30:00Z", closedAt: "2025-08-25T10:00:00Z", status: "closed" },
    { id: "issue-hist-007", category: "eletricidade", priority: "high", title: "Quadro eléctrico das áreas comuns com avaria", description: "Disjuntor geral das áreas comuns a disparar frequentemente. Necessário electricista qualificado.", openedAt: "2025-09-01T14:00:00Z", closedAt: "2025-09-18T16:30:00Z", status: "closed" },
    { id: "issue-hist-008", category: "jardim", priority: "low", title: "Rega automática avariada", description: "Sistema de rega automática do jardim não funciona. Plantas a secar.", openedAt: "2025-09-10T08:00:00Z", closedAt: "2025-09-20T11:00:00Z", status: "closed" },
    { id: "issue-hist-009", category: "videoporteiro", priority: "medium", title: "Videoporteiro do 7A sem imagem", description: "Câmara do videoporteiro da fração 7A não transmite imagem. Áudio funciona normalmente.", openedAt: "2025-10-05T17:00:00Z", closedAt: "2025-10-22T15:00:00Z", status: "closed" },
    { id: "issue-hist-010", category: "seguranca", priority: "high", title: "Fechadura da porta principal danificada", description: "Fechadura da porta principal do edifício danificada. Porta não fecha correctamente à noite.", openedAt: "2025-10-15T20:00:00Z", closedAt: "2025-10-17T10:00:00Z", status: "closed" },
    { id: "issue-hist-011", category: "pragas", priority: "critical", title: "Baratas nas áreas comuns do R/C", description: "Presença de baratas no hall de entrada e zona dos contadores. Necessária desinfestação urgente.", openedAt: "2025-11-03T09:00:00Z", closedAt: "2025-11-10T14:00:00Z", status: "closed" },
    { id: "issue-hist-012", category: "infiltracao", priority: "high", title: "Humidade na parede da escadaria 6º-7º", description: "Mancha de humidade crescente na parede da escadaria entre o 6º e 7º andar. Possível problema na cobertura.", openedAt: "2025-11-20T10:30:00Z", closedAt: "2025-12-15T16:00:00Z", status: "closed" },
    { id: "issue-hist-013", category: "ruido", priority: "low", title: "Ruído nocturno excessivo - fração 4B", description: "Queixa de ruído nocturno proveniente da fração 4B entre as 23h e 2h.", openedAt: "2025-12-01T23:30:00Z", closedAt: "2025-12-10T09:00:00Z", status: "resolved" },
    { id: "issue-hist-014", category: "elevador", priority: "medium", title: "Botão do 8º andar não funciona no elevador", description: "Botão de chamada do 8º andar dentro da cabine do elevador não responde ao toque.", openedAt: "2025-12-12T16:00:00Z", closedAt: "2025-12-20T11:00:00Z", status: "closed" },
    { id: "issue-hist-015", category: "canalizacao", priority: "medium", title: "Torneira da zona comum com fuga", description: "Torneira da zona de lavagem da garagem com fuga constante. Desperdício de água.", openedAt: "2026-01-08T08:45:00Z", closedAt: "2026-01-20T14:00:00Z", status: "resolved" },
  ];

  const habFractions = fractions.filter((f) => f.type === "habitacao");

  return historicalIssues.map((issue, idx) => {
    const frac = habFractions[idx % habFractions.length];
    const owner = owners[idx % owners.length];
    const supplier = suppliers[idx % suppliers.length];
    return {
      id: issue.id,
      tenant_id: tenantId,
      fraction_id: frac.id,
      created_by_person_id: owner.id,
      assigned_supplier_person_id: supplier.id,
      category: issue.category,
      priority: issue.priority,
      status: issue.status,
      title: issue.title,
      description: issue.description,
      opened_at: issue.openedAt,
      closed_at: issue.closedAt,
      created_at: issue.openedAt,
      updated_at: issue.closedAt || issue.openedAt,
    };
  });
}

// ── Generate issue comments ───────────────────────────────────────────────
function generateIssueComments(allIssueIds, tenantId) {
  const commentTemplates = [
    "Situação reportada ao fornecedor. A aguardar disponibilidade para visita técnica.",
    "Fornecedor confirmou visita para a próxima semana.",
    "Visita técnica realizada. Orçamento em preparação.",
    "Orçamento aprovado pela administração. Trabalhos agendados.",
    "Trabalhos em curso. Previsão de conclusão em 3 dias úteis.",
    "Trabalhos concluídos. A aguardar validação do condómino.",
    "Condómino confirmou resolução. Processo encerrado.",
    "Pedido de esclarecimento adicional enviado ao fornecedor.",
    "Garantia activada — fornecedor irá reparar sem custo adicional.",
    "Situação monitorizada. Sem novos desenvolvimentos.",
    "Contactado fornecedor alternativo para segundo orçamento.",
    "Reunião com administração para aprovar intervenção urgente.",
    "Material encomendado. Prazo de entrega: 5 dias úteis.",
    "Intervenção parcial realizada. Falta concluir acabamentos.",
    "Fotografias do estado actual enviadas ao fornecedor.",
  ];

  const demoUsers = ["app-user-manager-001", "app-user-operations-001", "app-user-accounting-001"];
  const comments = [];
  let idx = 0;

  for (const issueId of allIssueIds) {
    // 2-4 comments per issue
    const numComments = 2 + (idx % 3);
    for (let c = 0; c < numComments; c++) {
      idx++;
      const dayOffset = c * 3 + 1;
      comments.push({
        id: `comment-${String(idx).padStart(4, "0")}`,
        tenant_id: tenantId,
        issue_id: issueId,
        author_user_id: demoUsers[idx % demoUsers.length],
        body: commentTemplates[idx % commentTemplates.length],
        created_at: `2025-${String(6 + Math.floor(idx / 10) % 7).padStart(2, "0")}-${String(Math.min(28, dayOffset + (idx % 15))).padStart(2, "0")}T${String(9 + (idx % 8)).padStart(2, "0")}:${String(idx % 60).padStart(2, "0")}:00Z`,
      });
    }
  }

  return comments;
}

// ── Generate assembly attendees & votes ───────────────────────────────────
function generateAssemblyData(assemblies, fractions, people, tenantId) {
  const owners = people.filter((p) => p.roleType === "owner");
  const attendees = [];
  const votes = [];
  let attIdx = 0;
  let voteIdx = 0;
  const rand = seededRandom("assembly-data");

  for (const assembly of assemblies) {
    // ~75% of owners attend
    const attending = owners.filter(() => rand() < 0.75);
    const absent = owners.filter((o) => !attending.includes(o));
    // Some absent owners send proxies
    const proxied = absent.filter(() => rand() < 0.3);

    for (const person of attending) {
      attIdx++;
      attendees.push({
        id: `att-${String(attIdx).padStart(4, "0")}`,
        tenant_id: tenantId,
        assembly_id: assembly.id,
        person_id: person.id,
        representation_type: "self",
        proxy_document_id: null,
        presence_status: "present",
        created_at: assembly.scheduledAt,
        updated_at: assembly.scheduledAt,
      });
    }

    for (const person of proxied) {
      attIdx++;
      attendees.push({
        id: `att-${String(attIdx).padStart(4, "0")}`,
        tenant_id: tenantId,
        assembly_id: assembly.id,
        person_id: person.id,
        representation_type: "proxy",
        proxy_document_id: null,
        presence_status: "represented",
        created_at: assembly.scheduledAt,
        updated_at: assembly.scheduledAt,
      });
    }

    // Generate votes for each vote item — only for the first (past) assembly
    if (assembly.voteItems && assembly.status === "completed") {
      for (let itemIdx = 0; itemIdx < assembly.voteItems.length; itemIdx++) {
        const votingFractions = fractions.filter((f) => f.type === "habitacao");
        for (const frac of votingFractions) {
          voteIdx++;
          const r = rand();
          const vote = r < 0.7 ? "for" : r < 0.9 ? "against" : "abstention";
          votes.push({
            id: `vote-${String(voteIdx).padStart(4, "0")}`,
            tenant_id: tenantId,
            assembly_id: assembly.id,
            vote_item_index: itemIdx,
            user_id: "app-user-resident-001", // cast via app
            fraction_id: frac.id,
            vote,
            permillage_weight: frac.permillage,
            cast_at: assembly.scheduledAt,
          });
        }
      }
    }
  }

  return { attendees, votes };
}

// ── Generate notifications ────────────────────────────────────────────────
function generateNotifications(tenantId) {
  const notifications = [
    // Today and recent
    { id: "notif-001", type: "charge_overdue", title: "Quota em atraso — Fração 3B", detail: "A quota de Fevereiro 2026 da fração 3B encontra-se em atraso há 15 dias.", tone: "danger", module: "finance", targetId: "fraction-3b", targetType: "fraction", createdAt: "2026-03-28T09:00:00Z" },
    { id: "notif-002", type: "payment_received", title: "Pagamento recebido — Fração 1A", detail: "Pagamento de €54.00 via MBWay referente à quota de Março 2026.", tone: "success", module: "finance", targetId: "fraction-1a", targetType: "fraction", createdAt: "2026-03-28T08:30:00Z" },
    { id: "notif-003", type: "issue_update", title: "Ocorrência actualizada — Infiltração 8A", detail: "O fornecedor CanalMax agendou visita técnica para 2 de Abril.", tone: "accent", module: "issues", targetId: "issue-001", targetType: "issue", createdAt: "2026-03-27T16:45:00Z" },
    { id: "notif-004", type: "assembly_scheduled", title: "Assembleia extraordinária agendada", detail: "Assembleia extraordinária marcada para 12 de Maio às 20h30 na sala comum.", tone: "accent", module: "assemblies", targetId: "assembly-2026-ext-01", targetType: "assembly", createdAt: "2026-03-27T10:00:00Z" },
    { id: "notif-005", type: "system", title: "Backup de dados concluído", detail: "Backup diário dos dados do condomínio realizado com sucesso.", tone: "neutral", module: "dashboard", targetId: null, targetType: null, createdAt: "2026-03-27T03:00:00Z" },

    // This week
    { id: "notif-006", type: "charge_overdue", title: "5 quotas em atraso — Fevereiro 2026", detail: "Existem 5 frações com quotas de Fevereiro em atraso. Total: €321.00", tone: "warning", module: "finance", targetId: null, targetType: null, createdAt: "2026-03-25T09:00:00Z" },
    { id: "notif-007", type: "issue_update", title: "Ocorrência resolvida — Elevador", detail: "A ocorrência do elevador parado foi resolvida pela Elevadores Atlântico.", tone: "success", module: "issues", targetId: "issue-002", targetType: "issue", createdAt: "2026-03-24T15:30:00Z" },
    { id: "notif-008", type: "payment_received", title: "3 pagamentos recebidos hoje", detail: "Foram registados 3 pagamentos no valor total de €189.00.", tone: "success", module: "finance", targetId: null, targetType: null, createdAt: "2026-03-24T17:00:00Z" },
    { id: "notif-009", type: "system", title: "Documento carregado — Acta assembleia", detail: "Acta da assembleia ordinária de Março 2026 disponível para download.", tone: "neutral", module: "documents", targetId: "doc-ata-assembleia", targetType: "document", createdAt: "2026-03-23T11:00:00Z" },

    // Last week
    { id: "notif-010", type: "issue_update", title: "Nova ocorrência — Ruído nocturno", detail: "Condómino da fração 5C reportou ruído nocturno excessivo da fração vizinha.", tone: "warning", module: "issues", targetId: "issue-006", targetType: "issue", createdAt: "2026-03-20T23:15:00Z" },
    { id: "notif-011", type: "payment_received", title: "Pagamento parcial — Fração 6A", detail: "Pagamento parcial de €40.00 (de €73.00) referente à quota de Fevereiro.", tone: "accent", module: "finance", targetId: "fraction-6a", targetType: "fraction", createdAt: "2026-03-19T14:20:00Z" },
    { id: "notif-012", type: "system", title: "Relatório mensal gerado", detail: "Relatório financeiro de Fevereiro 2026 gerado automaticamente.", tone: "neutral", module: "reports", targetId: null, targetType: null, createdAt: "2026-03-15T06:00:00Z" },

    // Older
    { id: "notif-013", type: "assembly_scheduled", title: "Assembleia ordinária — Lembrete", detail: "Assembleia ordinária amanhã às 20h30. Confirmação de presença recomendada.", tone: "accent", module: "assemblies", targetId: "assembly-2026-ord-01", targetType: "assembly", createdAt: "2026-03-19T09:00:00Z" },
    { id: "notif-014", type: "charge_overdue", title: "Quota em atraso — Fração LJ1", detail: "A loja LJ1 tem quota de Janeiro em atraso. Valor: €165.00.", tone: "danger", module: "finance", targetId: "fraction-lj1", targetType: "fraction", createdAt: "2026-03-10T09:00:00Z" },
    { id: "notif-015", type: "issue_update", title: "Obra de fachada — Orçamento aprovado", detail: "Orçamento de €12.500 para obras de fachada aprovado em assembleia.", tone: "success", module: "issues", targetId: null, targetType: null, createdAt: "2026-03-08T10:00:00Z" },
    { id: "notif-016", type: "system", title: "Actualização de contrato — Elevadores", detail: "Contrato de manutenção de elevadores renovado até Dezembro 2026.", tone: "neutral", module: "documents", targetId: null, targetType: null, createdAt: "2026-03-01T09:00:00Z" },
    { id: "notif-017", type: "payment_received", title: "Reconciliação bancária completa", detail: "45 transações bancárias de Fevereiro foram reconciliadas automaticamente.", tone: "success", module: "finance", targetId: null, targetType: null, createdAt: "2026-02-28T18:00:00Z" },
    { id: "notif-018", type: "charge_overdue", title: "Aviso 2ª via — 3 frações em atraso", detail: "Enviado segundo aviso de quota em atraso a 3 frações (Jan 2026).", tone: "warning", module: "finance", targetId: null, targetType: null, createdAt: "2026-02-20T09:00:00Z" },
    { id: "notif-019", type: "issue_update", title: "Desinfestação concluída", detail: "Tratamento de desinfestação nas áreas comuns do R/C concluído com sucesso.", tone: "success", module: "issues", targetId: "issue-hist-011", targetType: "issue", createdAt: "2025-11-10T14:00:00Z" },
    { id: "notif-020", type: "system", title: "Inspecção de gás aprovada", detail: "Inspecção periódica obrigatória de gás aprovada sem anomalias.", tone: "success", module: "compliance", targetId: null, targetType: null, createdAt: "2025-10-15T11:00:00Z" },
  ];

  return notifications.map((n) => ({
    id: n.id,
    tenant_id: tenantId,
    user_id: null, // broadcast to all
    type: n.type,
    title: n.title,
    detail: n.detail,
    tone: n.tone,
    module: n.module,
    target_id: n.targetId,
    target_type: n.targetType,
    read_at: n.createdAt < "2026-03-20" ? n.createdAt : null, // older ones are read
    created_at: n.createdAt,
  }));
}

// ── Generate audit logs ───────────────────────────────────────────────────
function generateAuditLogs(tenantId) {
  const demoUserIds = ["app-user-manager-001", "app-user-accounting-001", "app-user-operations-001", "app-user-resident-001"];
  const logs = [];
  let idx = 0;

  const actions = [
    // Finance
    { action: "charge.create", entity_type: "charge", months: ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"] },
    { action: "payment.record", entity_type: "payment", months: ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"] },
    // Issues
    { action: "issue.create", entity_type: "issue", months: ["2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01"] },
    { action: "issue.update", entity_type: "issue", months: ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2026-01", "2026-02", "2026-03"] },
    { action: "issue.close", entity_type: "issue", months: ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01"] },
    // Documents
    { action: "document.upload", entity_type: "document", months: ["2025-06", "2025-09", "2025-12", "2026-01", "2026-03"] },
    // Assemblies
    { action: "assembly.create", entity_type: "assembly", months: ["2026-02", "2026-03"] },
    { action: "assembly.notice_sent", entity_type: "assembly", months: ["2026-03"] },
    // Users
    { action: "user.login", entity_type: "user", months: ["2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"] },
    { action: "user.login", entity_type: "user", months: ["2026-01", "2026-02", "2026-03"] },
    // Compliance-relevant
    { action: "document.access", entity_type: "document", months: ["2025-08", "2025-10", "2025-12", "2026-02", "2026-03"] },
    { action: "report.generate", entity_type: "report", months: ["2025-09", "2025-12", "2026-03"] },
    { action: "person.update", entity_type: "person", months: ["2025-07", "2025-10", "2026-01"] },
    { action: "fraction.update", entity_type: "fraction", months: ["2025-09", "2026-02"] },
    { action: "bank_transaction.reconcile", entity_type: "bank_transaction", months: ["2025-08", "2025-10", "2025-12", "2026-02"] },
    { action: "receipt.generate", entity_type: "receipt", months: ["2025-07", "2025-09", "2025-11", "2026-01", "2026-03"] },
  ];

  for (const template of actions) {
    for (const month of template.months) {
      idx++;
      const day = String(5 + (idx % 20)).padStart(2, "0");
      const hour = String(8 + (idx % 10)).padStart(2, "0");
      const minute = String(idx % 60).padStart(2, "0");
      logs.push({
        tenant_id: tenantId,
        actor_user_id: demoUserIds[idx % demoUserIds.length],
        action: template.action,
        entity_type: template.entity_type,
        entity_id: `${template.entity_type}-${String(idx).padStart(3, "0")}`,
        before_json: null,
        after_json: JSON.stringify({ updatedAt: `${month}-${day}T${hour}:${minute}:00Z` }),
        metadata_json: JSON.stringify({ ip: "203.0.113." + (idx % 255), userAgent: "Mozilla/5.0" }),
        created_at: `${month}-${day}T${hour}:${minute}:00Z`,
      });
    }
  }

  return logs;
}

// ── Generate additional documents with historical dates ───────────────────
function generateAdditionalDocuments(tenantId) {
  return [
    // Actas de assembleias anteriores
    { id: "doc-ata-2024", category: "ata_assembleia", title: "Acta da Assembleia Ordinária 2024", visibility: "owners", uploadedAt: "2024-04-15T10:00:00Z", storagePath: "documents/atas/acta-2024-ord.pdf" },
    { id: "doc-ata-2025-ext", category: "ata_assembleia", title: "Acta da Assembleia Extraordinária Out 2025", visibility: "owners", uploadedAt: "2025-10-30T10:00:00Z", storagePath: "documents/atas/acta-2025-ext-out.pdf" },
    // Orçamentos
    { id: "doc-orc-fachada", category: "orcamento_obra", title: "Orçamento Obras Fachada — IberConstruções", visibility: "management", uploadedAt: "2025-11-15T14:00:00Z", storagePath: "documents/orcamentos/fachada-iberconstrucoes.pdf" },
    { id: "doc-orc-elevador", category: "orcamento_obra", title: "Orçamento Modernização Elevador", visibility: "management", uploadedAt: "2026-01-10T09:00:00Z", storagePath: "documents/orcamentos/elevador-modernizacao.pdf" },
    // Facturas de fornecedores
    { id: "doc-fat-limpeza-jan", category: "fatura_fornecedor", title: "Factura HigiaLimpa — Janeiro 2026", visibility: "management", uploadedAt: "2026-02-05T09:00:00Z", storagePath: "documents/faturas/higialimpa-2026-01.pdf" },
    { id: "doc-fat-limpeza-fev", category: "fatura_fornecedor", title: "Factura HigiaLimpa — Fevereiro 2026", visibility: "management", uploadedAt: "2026-03-05T09:00:00Z", storagePath: "documents/faturas/higialimpa-2026-02.pdf" },
    { id: "doc-fat-elevador-q4", category: "fatura_fornecedor", title: "Factura Elevadores Atlântico — Q4 2025", visibility: "management", uploadedAt: "2026-01-15T09:00:00Z", storagePath: "documents/faturas/elevadores-q4-2025.pdf" },
    // Mapas de quotas
    { id: "doc-mapa-2025", category: "mapa_quotas", title: "Mapa de Quotas 2025", visibility: "owners", uploadedAt: "2025-01-10T09:00:00Z", storagePath: "documents/mapas/quotas-2025.pdf" },
    { id: "doc-mapa-2026", category: "mapa_quotas", title: "Mapa de Quotas 2026", visibility: "owners", uploadedAt: "2026-01-05T09:00:00Z", storagePath: "documents/mapas/quotas-2026.pdf" },
    // Recibos mensais
    { id: "doc-recibo-dez", category: "recibo_quota", title: "Recibos de Quotas — Dezembro 2025", visibility: "owners", uploadedAt: "2026-01-02T09:00:00Z", storagePath: "documents/recibos/recibos-2025-12.pdf" },
    { id: "doc-recibo-jan", category: "recibo_quota", title: "Recibos de Quotas — Janeiro 2026", visibility: "owners", uploadedAt: "2026-02-02T09:00:00Z", storagePath: "documents/recibos/recibos-2026-01.pdf" },
    { id: "doc-recibo-fev", category: "recibo_quota", title: "Recibos de Quotas — Fevereiro 2026", visibility: "owners", uploadedAt: "2026-03-02T09:00:00Z", storagePath: "documents/recibos/recibos-2026-02.pdf" },
    // Contratos
    { id: "doc-contrato-jardim", category: "contrato_manutencao_elevador", title: "Contrato Manutenção Jardim 2026", visibility: "management", uploadedAt: "2025-12-20T09:00:00Z", storagePath: "documents/contratos/manutencao-jardim-2026.pdf" },
    // Certificados
    { id: "doc-cert-incendio", category: "certificado_extintores", title: "Certificado Inspecção Extintores — 2025", visibility: "management", uploadedAt: "2025-09-10T09:00:00Z", storagePath: "documents/certificados/extintores-2025.pdf" },
    { id: "doc-cert-gas-2025", category: "inspecao_gas", title: "Relatório Inspecção Gás — Outubro 2025", visibility: "management", uploadedAt: "2025-10-15T09:00:00Z", storagePath: "documents/certificados/inspecao-gas-2025.pdf" },
    // Convocatórias
    { id: "doc-conv-mar-2026", category: "convocatoria", title: "Convocatória Assembleia Ordinária Março 2026", visibility: "all", uploadedAt: "2026-03-05T09:00:00Z", storagePath: "documents/convocatorias/conv-mar-2026.pdf" },
    // Seguros
    { id: "doc-seguro-2026", category: "apolice_multirriscos", title: "Apólice Seguro Multirriscos 2026", visibility: "management", uploadedAt: "2026-01-02T09:00:00Z", storagePath: "documents/seguros/apolice-multirriscos-2026.pdf" },
  ];
}

// ── Generate work orders for historical issues ────────────────────────────
function generateHistoricalWorkOrders(historicalIssues, people, tenantId) {
  const suppliers = people.filter((p) => p.roleType === "supplier");
  const workOrders = [];
  let idx = 0;

  for (const issue of historicalIssues) {
    if (issue.status === "closed" || issue.status === "resolved") {
      idx++;
      const supplier = suppliers[idx % suppliers.length];
      const openedDate = new Date(issue.opened_at);
      const scheduledDate = new Date(openedDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      const completedDate = issue.closed_at ? new Date(new Date(issue.closed_at).getTime() - 2 * 24 * 60 * 60 * 1000) : null;
      const estimatedCost = 150 + (idx * 73 % 800);
      const finalCost = completedDate ? Math.round(estimatedCost * (0.8 + (idx % 4) * 0.1)) : null;

      workOrders.push({
        id: `wo-hist-${String(idx).padStart(3, "0")}`,
        tenant_id: tenantId,
        issue_id: issue.id,
        supplier_person_id: supplier.id,
        description: `Intervenção: ${issue.title}`,
        status: completedDate ? "completed" : "in_progress",
        estimated_cost: estimatedCost,
        final_cost: finalCost,
        scheduled_at: scheduledDate.toISOString(),
        completed_at: completedDate ? completedDate.toISOString() : null,
        created_at: issue.opened_at,
        updated_at: completedDate ? completedDate.toISOString() : issue.opened_at,
      });
    }
  }

  return workOrders;
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN SEED
// ══════════════════════════════════════════════════════════════════════════

export async function seed(knex) {
  const enableDemo = process.env.ENABLE_DEMO_USERS !== "false";
  const seedData = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  const tenant = seedData.condominium;
  const tenantId = tenant.id;
  const now = new Date().toISOString();

  // ── Clear existing data in dependency order ──────────────────────────
  await knex("audit_logs").del();
  await knex("integration_events").del();
  await knex("auth_password_reset_tokens").del();
  await knex("auth_refresh_tokens").del();
  const hasAssemblyVotes = await knex.schema.hasTable("assembly_votes");
  if (hasAssemblyVotes) await knex("assembly_votes").del();
  await knex("assembly_attendees").del();
  await knex("assemblies").del();
  const hasNotifications = await knex.schema.hasTable("notifications");
  if (hasNotifications) await knex("notifications").del();
  const hasIssueComments = await knex.schema.hasTable("issue_comments");
  if (hasIssueComments) await knex("issue_comments").del();
  const hasWorkOrders = await knex.schema.hasTable("work_orders");
  if (hasWorkOrders) await knex("work_orders").del();
  const hasIssueAttachments = await knex.schema.hasTable("issue_attachments");
  if (hasIssueAttachments) await knex("issue_attachments").del();
  await knex("document_versions").del();
  await knex("finance_receipts").del();
  await knex("bank_transactions").del();
  await knex("finance_ledger_entries").del();
  await knex("documents").del();
  await knex("payments").del();
  await knex("charges").del();
  await knex("issues").del();
  await knex("user_fraction_scopes").del();
  await knex("fraction_parties").del();
  await knex("people").del();
  await knex("fractions").del();
  await knex("user_tenants").del();
  await knex("app_users").del();
  await knex("tenants").del();

  // ── Tenant ───────────────────────────────────────────────────────────
  await knex("tenants").insert({
    id: tenantId, name: tenant.name, tax_number: tenant.taxNumber,
    address: tenant.address, postal_code: tenant.postalCode, city: tenant.city,
    country: tenant.country, management_type: tenant.managementType,
    created_at: "2024-01-15T09:00:00Z", updated_at: now,
  });

  // ── Fractions ────────────────────────────────────────────────────────
  if (seedData.fractions?.length) {
    await knex.batchInsert("fractions", seedData.fractions.map((f) => ({
      id: f.id, tenant_id: tenantId, code: f.code, floor_number: Number(f.floorNumber),
      type: f.type, typology: f.typology, private_area_m2: Number(f.privateAreaM2),
      permillage: Number(f.permillage), monthly_fee_amount: Number(f.monthlyFee),
      status: f.status, created_at: "2024-01-15T09:00:00Z", updated_at: now,
    })), 30);
  }

  // ── People ───────────────────────────────────────────────────────────
  if (seedData.people?.length) {
    await knex.batchInsert("people", seedData.people.map((p) => ({
      id: p.id, tenant_id: tenantId, full_name: p.fullName, role_type: p.roleType,
      tax_number: p.taxNumber || null, email: p.email || null, phone: p.phone || null,
      created_at: "2024-01-15T09:00:00Z", updated_at: now,
    })), 30);
  }

  // ── Fraction Parties ─────────────────────────────────────────────────
  if (seedData.fractionParties?.length) {
    await knex.batchInsert("fraction_parties", seedData.fractionParties.map((r) => ({
      id: r.id, tenant_id: tenantId, fraction_id: r.fractionId, person_id: r.personId,
      relationship: r.relationship, start_date: r.startDate, end_date: r.endDate || null,
      is_primary: r.isPrimary, created_at: "2024-01-15T09:00:00Z", updated_at: now,
    })), 30);
  }

  // ── Demo users (inserted early — needed as FK for ledger entries) ───
  if (enableDemo) {
    for (const user of DEMO_USERS) {
      await knex("app_users").insert({
        id: user.id, email: user.email.toLowerCase(),
        password_hash: bcrypt.hashSync(user.password, 10),
        full_name: user.fullName, role: user.role, is_active: true,
        created_at: "2024-01-15T09:00:00Z", updated_at: now,
      });
      await knex("user_tenants").insert({ user_id: user.id, tenant_id: tenantId });
    }
  }

  // ── Historical charges, payments, ledger, receipts, bank txns ───────
  const financial = generateHistoricalCharges(seedData.fractions, tenantId);
  await knex.batchInsert("charges", financial.charges, 50);
  await knex.batchInsert("payments", financial.payments, 50);
  await knex.batchInsert("finance_ledger_entries", financial.ledgerEntries, 50);
  if (financial.receipts.length) {
    await knex.batchInsert("finance_receipts", financial.receipts, 50);
  }
  if (financial.bankTransactions.length) {
    await knex.batchInsert("bank_transactions", financial.bankTransactions, 50);
  }

  // ── Historical issues (15 resolved/closed) ──────────────────────────
  const historicalIssues = generateHistoricalIssues(seedData.fractions, seedData.people, tenantId);
  // Current issues from JSON
  const currentIssues = (seedData.issues || []).map((i) => ({
    id: i.id, tenant_id: tenantId, fraction_id: i.fractionId || null,
    created_by_person_id: i.createdByPersonId || null,
    assigned_supplier_person_id: i.assignedSupplierPersonId || null,
    category: i.category, priority: i.priority, status: i.status,
    title: i.title, description: i.description, opened_at: i.openedAt,
    closed_at: i.closedAt || null, created_at: i.openedAt, updated_at: i.closedAt || i.openedAt,
  }));
  await knex.batchInsert("issues", [...historicalIssues, ...currentIssues], 30);

  // ── Work orders (from JSON + historical) ────────────────────────────
  if (hasWorkOrders) {
    const jsonWorkOrders = (seedData.workOrders || []).map((wo) => ({
      id: wo.id, tenant_id: tenantId, issue_id: wo.issueId,
      supplier_person_id: wo.supplierPersonId || null,
      description: wo.notes || `Ordem de trabalho para ${wo.issueId}`,
      status: wo.completedAt ? "completed" : wo.scheduledAt ? "in_progress" : "pending",
      estimated_cost: wo.estimatedCost || null, final_cost: wo.finalCost || null,
      scheduled_at: wo.scheduledAt || null, completed_at: wo.completedAt || null,
      created_at: wo.requestedAt || now, updated_at: wo.completedAt || wo.requestedAt || now,
    }));
    const historicalWorkOrders = generateHistoricalWorkOrders(historicalIssues, seedData.people, tenantId);
    const allWorkOrders = [...jsonWorkOrders, ...historicalWorkOrders];
    if (allWorkOrders.length) {
      await knex.batchInsert("work_orders", allWorkOrders, 30);
    }
  }

  // ── Issue comments ──────────────────────────────────────────────────
  if (hasIssueComments) {
    const allIssueIds = [...historicalIssues.map((i) => i.id), ...currentIssues.map((i) => i.id)];
    const comments = generateIssueComments(allIssueIds, tenantId);
    if (comments.length) {
      await knex.batchInsert("issue_comments", comments, 50);
    }
  }

  // ── Documents (JSON + historical) ───────────────────────────────────
  const jsonDocs = (seedData.documents || []).map((d) => ({
    id: d.id, tenant_id: tenantId, category: d.category, title: d.title,
    visibility: d.visibility, uploaded_by_person_id: d.uploadedByPersonId || null,
    uploaded_at: d.uploadedAt, storage_path: d.storagePath,
    created_at: d.uploadedAt, updated_at: d.uploadedAt,
  }));
  const additionalDocs = generateAdditionalDocuments(tenantId).map((d) => ({
    id: d.id, tenant_id: tenantId, category: d.category, title: d.title,
    visibility: d.visibility, uploaded_by_person_id: null,
    uploaded_at: d.uploadedAt, storage_path: d.storagePath,
    created_at: d.uploadedAt, updated_at: d.uploadedAt,
  }));
  await knex.batchInsert("documents", [...jsonDocs, ...additionalDocs], 30);

  // ── Assemblies ──────────────────────────────────────────────────────
  // Add a past completed assembly + existing ones from JSON
  const pastAssembly = {
    id: "assembly-2025-ord-01",
    tenant_id: tenantId,
    meeting_type: "ordinary",
    scheduled_at: "2025-03-15T20:30:00Z",
    location: "Sala comum do condomínio",
    call_notice_sent_at: "2025-03-01T09:00:00Z",
    minutes_document_id: "doc-ata-2024",
    status: "completed",
    vote_items_json: JSON.stringify([
      { id: "vi-2025-001", itemNumber: 1, question: "Aprovação das contas do exercício de 2024", type: "ordinary", votingRule: "simple_majority" },
      { id: "vi-2025-002", itemNumber: 2, question: "Orçamento anual 2025/2026", type: "ordinary", votingRule: "simple_majority" },
      { id: "vi-2025-003", itemNumber: 3, question: "Eleição do conselho fiscal", type: "ordinary", votingRule: "permillage_majority" },
    ]),
    created_at: "2025-02-15T09:00:00Z",
    updated_at: "2025-03-16T10:00:00Z",
  };

  const jsonAssemblies = (seedData.assemblies || []).map((a) => ({
    id: a.id, tenant_id: tenantId, meeting_type: a.meetingType,
    scheduled_at: a.scheduledAt, location: a.location,
    call_notice_sent_at: a.callNoticeSentAt || null,
    minutes_document_id: a.minutesDocumentId || null,
    status: a.id === "assembly-2026-ord-01" ? "completed" : (a.status || "scheduled"),
    vote_items_json: a.voteItems ? JSON.stringify(a.voteItems) : null,
    created_at: "2026-02-01T09:00:00Z", updated_at: now,
  }));

  await knex.batchInsert("assemblies", [pastAssembly, ...jsonAssemblies], 10);

  // ── Assembly attendees & votes ──────────────────────────────────────
  const allAssemblies = [
    { id: pastAssembly.id, scheduledAt: pastAssembly.scheduled_at, status: pastAssembly.status, voteItems: JSON.parse(pastAssembly.vote_items_json) },
    ...seedData.assemblies.map((a) => ({
      id: a.id,
      scheduledAt: a.scheduledAt,
      status: a.id === "assembly-2026-ord-01" ? "completed" : (a.status || "scheduled"),
      voteItems: a.voteItems,
    })),
  ];
  const { attendees, votes } = generateAssemblyData(allAssemblies, seedData.fractions, seedData.people, tenantId);
  if (attendees.length) {
    await knex.batchInsert("assembly_attendees", attendees, 30);
  }
  if (hasAssemblyVotes && votes.length) {
    await knex.batchInsert("assembly_votes", votes, 50);
  }

  // ── Notifications ───────────────────────────────────────────────────
  if (hasNotifications) {
    const notifications = generateNotifications(tenantId);
    if (notifications.length) {
      await knex.batchInsert("notifications", notifications, 30);
    }
  }

  // ── Audit logs ──────────────────────────────────────────────────────
  const auditLogs = generateAuditLogs(tenantId);
  if (auditLogs.length) {
    await knex.batchInsert("audit_logs", auditLogs, 50);
  }

  // ── Second tenant (smaller, for multi-tenant demo) ──────────────────
  if (seedData.secondCondominium) {
    const t2 = seedData.secondCondominium;
    const t2Id = t2.id;
    await knex("tenants").insert({
      id: t2Id, name: t2.name, tax_number: t2.taxNumber, address: t2.address,
      postal_code: t2.postalCode, city: t2.city, country: t2.country,
      management_type: t2.managementType, created_at: "2025-06-01T09:00:00Z", updated_at: now,
    });

    const t2Fractions = [
      { id: "frac-t2-001", code: "A-R/C", floorNumber: 0, type: "apartment", typology: "T2", privateAreaM2: 75, permillage: 180, monthlyFee: 90, status: "occupied" },
      { id: "frac-t2-002", code: "A-1D", floorNumber: 1, type: "apartment", typology: "T3", privateAreaM2: 95, permillage: 220, monthlyFee: 110, status: "occupied" },
      { id: "frac-t2-003", code: "A-1E", floorNumber: 1, type: "apartment", typology: "T1", privateAreaM2: 55, permillage: 140, monthlyFee: 70, status: "occupied" },
      { id: "frac-t2-004", code: "A-2D", floorNumber: 2, type: "apartment", typology: "T3", privateAreaM2: 95, permillage: 220, monthlyFee: 110, status: "vacant" },
      { id: "frac-t2-005", code: "A-2E", floorNumber: 2, type: "apartment", typology: "T2", privateAreaM2: 75, permillage: 240, monthlyFee: 120, status: "occupied" },
    ];
    await knex.batchInsert("fractions", t2Fractions.map((f) => ({
      id: f.id, tenant_id: t2Id, code: f.code, floor_number: f.floorNumber,
      type: f.type, typology: f.typology, private_area_m2: f.privateAreaM2,
      permillage: f.permillage, monthly_fee_amount: f.monthlyFee, status: f.status,
      created_at: "2025-06-01T09:00:00Z", updated_at: now,
    })), 30);

    const t2People = [
      { id: "person-t2-001", fullName: "Ana Ferreira", roleType: "owner", taxNumber: "234567890", email: "ana.ferreira@example.pt", phone: "+351912345678" },
      { id: "person-t2-002", fullName: "Carlos Mendes", roleType: "tenant", taxNumber: "345678901", email: "carlos.mendes@example.pt", phone: "+351923456789" },
    ];
    await knex.batchInsert("people", t2People.map((p) => ({
      id: p.id, tenant_id: t2Id, full_name: p.fullName, role_type: p.roleType,
      tax_number: p.taxNumber, email: p.email, phone: p.phone,
      created_at: "2025-06-01T09:00:00Z", updated_at: now,
    })), 30);

    // 6 months of charges for T2
    const t2Months = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"];
    const t2Charges = [];
    let t2ci = 0;
    for (const period of t2Months) {
      const lastDay = period === "2026-02" ? "28" : period.endsWith("11") ? "30" : "31";
      for (const frac of t2Fractions) {
        if (frac.status === "vacant") continue;
        t2ci++;
        t2Charges.push({
          id: `charge-t2-${String(t2ci).padStart(3, "0")}`,
          tenant_id: t2Id, fraction_id: frac.id, kind: "quota", period,
          due_date: `${period}-${lastDay}`, amount: frac.monthlyFee,
          status: period < "2026-02" ? "paid" : period === "2026-02" ? (t2ci % 3 === 0 ? "overdue" : "paid") : "open",
          created_at: `${period}-01T09:00:00Z`, updated_at: `${period}-01T09:00:00Z`,
        });
      }
    }
    await knex.batchInsert("charges", t2Charges, 30);
  }

  // ── Demo users (tenant links + fraction scopes) ─────────────────────
  if (enableDemo) {
    // Users already inserted above (before financial data). Now add cross-tenant links.
    if (seedData.secondCondominium) {
      const multiTenantUsers = DEMO_USERS.filter((u) => u.role === "manager" || u.role === "accounting");
      for (const user of multiTenantUsers) {
        await knex("user_tenants").insert({
          user_id: user.id, tenant_id: seedData.secondCondominium.id,
        }).onConflict(["user_id", "tenant_id"]).ignore();
      }
    }

    // Resident fraction scope
    const firstFraction = await knex("fractions")
      .where({ tenant_id: tenantId })
      .orderBy("floor_number", "asc")
      .orderBy("code", "asc")
      .first();

    if (firstFraction) {
      const residentUsers = DEMO_USERS.filter((u) => u.role === "resident");
      for (const user of residentUsers) {
        await knex("user_fraction_scopes").insert({
          user_id: user.id, tenant_id: tenantId, fraction_id: firstFraction.id,
        }).onConflict(["user_id", "tenant_id", "fraction_id"]).ignore();
      }
    }
  } else {
    // Bootstrap admin
    const adminEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || "";
    if (adminEmail && adminPassword) {
      await knex("app_users").insert({
        id: "app-user-bootstrap-manager-001", email: adminEmail,
        password_hash: bcrypt.hashSync(adminPassword, 10),
        full_name: "Administrador", role: "manager", is_active: true,
        created_at: now, updated_at: now,
      });
      await knex("user_tenants").insert({
        user_id: "app-user-bootstrap-manager-001", tenant_id: tenantId,
      });
    }
  }
}
