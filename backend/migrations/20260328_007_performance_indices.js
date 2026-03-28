/**
 * Índices de performance — acelera queries multi-tenant e filtros comuns.
 * Todas as tabelas principais filtram por tenant_id; charges/issues por status e due_date.
 */
export async function up(knex) {
  // Índices tenant_id em tabelas sem índice composto existente
  await knex.schema.alterTable("people", (t) => {
    t.index("tenant_id", "idx_people_tenant");
  });

  await knex.schema.alterTable("charges", (t) => {
    t.index("tenant_id", "idx_charges_tenant");
    t.index(["tenant_id", "status"], "idx_charges_tenant_status");
    t.index(["tenant_id", "due_date"], "idx_charges_tenant_due_date");
    t.index(["tenant_id", "fraction_id"], "idx_charges_tenant_fraction");
  });

  await knex.schema.alterTable("payments", (t) => {
    t.index("tenant_id", "idx_payments_tenant");
    t.index(["tenant_id", "fraction_id"], "idx_payments_tenant_fraction");
    t.index(["tenant_id", "charge_id"], "idx_payments_tenant_charge");
  });

  await knex.schema.alterTable("issues", (t) => {
    t.index("tenant_id", "idx_issues_tenant");
    t.index(["tenant_id", "status"], "idx_issues_tenant_status");
    t.index(["tenant_id", "priority"], "idx_issues_tenant_priority");
  });

  await knex.schema.alterTable("documents", (t) => {
    t.index("tenant_id", "idx_documents_tenant");
    t.index(["tenant_id", "category"], "idx_documents_tenant_category");
  });

  await knex.schema.alterTable("assemblies", (t) => {
    t.index("tenant_id", "idx_assemblies_tenant");
    t.index(["tenant_id", "status"], "idx_assemblies_tenant_status");
  });

  await knex.schema.alterTable("finance_ledger_entries", (t) => {
    t.index("tenant_id", "idx_ledger_tenant");
    t.index(["tenant_id", "entry_type"], "idx_ledger_tenant_type");
  });

  await knex.schema.alterTable("bank_transactions", (t) => {
    t.index("tenant_id", "idx_bank_tx_tenant");
    t.index(["tenant_id", "status"], "idx_bank_tx_tenant_status");
  });

  await knex.schema.alterTable("fraction_parties", (t) => {
    t.index("tenant_id", "idx_fraction_parties_tenant");
    t.index(["tenant_id", "fraction_id"], "idx_fraction_parties_tenant_fraction");
  });

  await knex.schema.alterTable("document_versions", (t) => {
    t.index("tenant_id", "idx_doc_versions_tenant");
  });

  await knex.schema.alterTable("finance_receipts", (t) => {
    t.index("tenant_id", "idx_receipts_tenant");
  });
}

export async function down(knex) {
  const indices = [
    ["people", "idx_people_tenant"],
    ["charges", "idx_charges_tenant"],
    ["charges", "idx_charges_tenant_status"],
    ["charges", "idx_charges_tenant_due_date"],
    ["charges", "idx_charges_tenant_fraction"],
    ["payments", "idx_payments_tenant"],
    ["payments", "idx_payments_tenant_fraction"],
    ["payments", "idx_payments_tenant_charge"],
    ["issues", "idx_issues_tenant"],
    ["issues", "idx_issues_tenant_status"],
    ["issues", "idx_issues_tenant_priority"],
    ["documents", "idx_documents_tenant"],
    ["documents", "idx_documents_tenant_category"],
    ["assemblies", "idx_assemblies_tenant"],
    ["assemblies", "idx_assemblies_tenant_status"],
    ["finance_ledger_entries", "idx_ledger_tenant"],
    ["finance_ledger_entries", "idx_ledger_tenant_type"],
    ["bank_transactions", "idx_bank_tx_tenant"],
    ["bank_transactions", "idx_bank_tx_tenant_status"],
    ["fraction_parties", "idx_fraction_parties_tenant"],
    ["fraction_parties", "idx_fraction_parties_tenant_fraction"],
    ["document_versions", "idx_doc_versions_tenant"],
    ["finance_receipts", "idx_receipts_tenant"],
  ];

  for (const [table, indexName] of indices) {
    await knex.schema.alterTable(table, (t) => {
      t.dropIndex([], indexName);
    });
  }
}
