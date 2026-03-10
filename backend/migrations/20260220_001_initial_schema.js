/**
 * Initial Condoos schema – all 20 tables, indexes, and constraints.
 * Compatible with both SQLite (better-sqlite3) and PostgreSQL.
 */
export async function up(knex) {
  const isPg = knex.client.config.client === "pg";

  // ---------- tenants ----------
  await knex.schema.createTable("tenants", (t) => {
    t.text("id").primary();
    t.text("name").notNullable();
    t.text("tax_number");
    t.text("address");
    t.text("postal_code");
    t.text("city");
    t.text("country");
    t.text("management_type");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---------- app_users ----------
  await knex.schema.createTable("app_users", (t) => {
    t.text("id").primary();
    t.text("email").notNullable().unique();
    t.text("password_hash").notNullable();
    t.text("full_name").notNullable();
    t.text("role").notNullable();
    if (isPg) {
      t.boolean("is_active").notNullable().defaultTo(true);
    } else {
      t.integer("is_active").notNullable().defaultTo(1);
    }
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---------- user_tenants ----------
  await knex.schema.createTable("user_tenants", (t) => {
    t.text("user_id").notNullable().references("id").inTable("app_users").onDelete("CASCADE");
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.primary(["user_id", "tenant_id"]);
  });

  // ---------- fractions ----------
  await knex.schema.createTable("fractions", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("code").notNullable();
    t.integer("floor_number").notNullable();
    t.text("type").notNullable();
    t.text("typology").notNullable();
    if (isPg) {
      t.decimal("private_area_m2", 10, 2).notNullable();
      t.decimal("permillage", 10, 4).notNullable();
      t.decimal("monthly_fee_amount", 14, 2).notNullable();
    } else {
      t.float("private_area_m2").notNullable();
      t.float("permillage").notNullable();
      t.float("monthly_fee_amount").notNullable();
    }
    t.text("status").notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    t.unique(["tenant_id", "code"]);
  });

  // ---------- user_fraction_scopes ----------
  await knex.schema.createTable("user_fraction_scopes", (t) => {
    t.text("user_id").notNullable().references("id").inTable("app_users").onDelete("CASCADE");
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("fraction_id").notNullable().references("id").inTable("fractions").onDelete("CASCADE");
    t.primary(["user_id", "tenant_id", "fraction_id"]);
  });

  // ---------- people ----------
  await knex.schema.createTable("people", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("full_name").notNullable();
    t.text("role_type").notNullable();
    t.text("tax_number");
    t.text("email");
    t.text("phone");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---------- fraction_parties ----------
  await knex.schema.createTable("fraction_parties", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("fraction_id").notNullable().references("id").inTable("fractions").onDelete("CASCADE");
    t.text("person_id").notNullable().references("id").inTable("people").onDelete("CASCADE");
    t.text("relationship").notNullable();
    t.text("start_date").notNullable();
    t.text("end_date");
    if (isPg) {
      t.boolean("is_primary").notNullable().defaultTo(false);
    } else {
      t.integer("is_primary").notNullable().defaultTo(0);
    }
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---------- charges ----------
  await knex.schema.createTable("charges", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("fraction_id").notNullable().references("id").inTable("fractions").onDelete("CASCADE");
    t.text("kind").notNullable();
    t.text("period").notNullable();
    t.text("due_date").notNullable();
    if (isPg) {
      t.decimal("amount", 14, 2).notNullable();
    } else {
      t.float("amount").notNullable();
    }
    t.text("status").notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---------- payments ----------
  await knex.schema.createTable("payments", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("fraction_id").notNullable().references("id").inTable("fractions").onDelete("CASCADE");
    t.text("charge_id").references("id").inTable("charges").onDelete("SET NULL");
    t.text("method").notNullable();
    if (isPg) {
      t.decimal("amount", 14, 2).notNullable();
    } else {
      t.float("amount").notNullable();
    }
    t.text("paid_at").notNullable();
    t.text("reference");
    t.text("source").notNullable().defaultTo("manual");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---------- issues ----------
  await knex.schema.createTable("issues", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("fraction_id").references("id").inTable("fractions").onDelete("SET NULL");
    t.text("created_by_person_id");
    t.text("assigned_supplier_person_id");
    t.text("category").notNullable();
    t.text("priority").notNullable();
    t.text("status").notNullable();
    t.text("title").notNullable();
    t.text("description").notNullable();
    t.text("opened_at").notNullable();
    t.text("closed_at");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---------- finance_ledger_entries ----------
  await knex.schema.createTable("finance_ledger_entries", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("fraction_id").references("id").inTable("fractions").onDelete("SET NULL");
    t.text("charge_id").references("id").inTable("charges").onDelete("SET NULL");
    t.text("payment_id").references("id").inTable("payments").onDelete("SET NULL");
    t.text("entry_type").notNullable();
    if (isPg) {
      t.decimal("amount", 14, 2).notNullable();
    } else {
      t.float("amount").notNullable();
    }
    t.text("occurred_at").notNullable();
    t.text("metadata_json");
    t.text("created_by_user_id").references("id").inTable("app_users").onDelete("SET NULL");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---------- documents ----------
  await knex.schema.createTable("documents", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("category").notNullable();
    t.text("title").notNullable();
    t.text("visibility").notNullable();
    t.text("uploaded_by_person_id");
    t.text("uploaded_at").notNullable();
    t.text("storage_path").notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---------- document_versions ----------
  await knex.schema.createTable("document_versions", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("document_id").notNullable().references("id").inTable("documents").onDelete("CASCADE");
    t.integer("version_number").notNullable();
    t.text("storage_path").notNullable();
    t.text("original_file_name");
    t.text("mime_type");
    t.integer("file_size_bytes");
    t.text("checksum_sha256");
    t.text("created_by_user_id").references("id").inTable("app_users").onDelete("SET NULL");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.unique(["document_id", "version_number"]);
  });

  // ---------- finance_receipts ----------
  await knex.schema.createTable("finance_receipts", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("payment_id").notNullable().unique().references("id").inTable("payments").onDelete("CASCADE");
    t.text("receipt_number").notNullable();
    t.text("storage_path").notNullable();
    t.text("mime_type").notNullable().defaultTo("application/pdf");
    t.integer("file_size_bytes").notNullable().defaultTo(0);
    t.text("checksum_sha256");
    t.text("generated_at").notNullable();
    t.text("created_by_user_id").references("id").inTable("app_users").onDelete("SET NULL");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---------- bank_transactions ----------
  await knex.schema.createTable("bank_transactions", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("booked_at").notNullable();
    t.text("description").notNullable();
    if (isPg) {
      t.decimal("amount", 14, 2).notNullable();
    } else {
      t.float("amount").notNullable();
    }
    t.text("reference");
    t.text("raw_json");
    t.text("status").notNullable().defaultTo("unmatched");
    t.text("matched_payment_id").references("id").inTable("payments").onDelete("SET NULL");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---------- assemblies ----------
  await knex.schema.createTable("assemblies", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("meeting_type").notNullable();
    t.text("scheduled_at").notNullable();
    t.text("location").notNullable();
    t.text("call_notice_sent_at");
    t.text("minutes_document_id").references("id").inTable("documents").onDelete("SET NULL");
    t.text("status").notNullable().defaultTo("scheduled");
    t.text("vote_items_json");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---------- assembly_attendees ----------
  await knex.schema.createTable("assembly_attendees", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("assembly_id").notNullable().references("id").inTable("assemblies").onDelete("CASCADE");
    t.text("person_id").notNullable().references("id").inTable("people").onDelete("CASCADE");
    t.text("representation_type").notNullable().defaultTo("self");
    t.text("proxy_document_id").references("id").inTable("documents").onDelete("SET NULL");
    t.text("presence_status").notNullable().defaultTo("present");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    t.unique(["assembly_id", "person_id"]);
  });

  // ---------- auth_refresh_tokens ----------
  await knex.schema.createTable("auth_refresh_tokens", (t) => {
    t.text("id").primary();
    t.text("user_id").notNullable().references("id").inTable("app_users").onDelete("CASCADE");
    t.text("token_hash").notNullable().unique();
    t.text("expires_at").notNullable();
    t.text("revoked_at");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---------- auth_password_reset_tokens ----------
  await knex.schema.createTable("auth_password_reset_tokens", (t) => {
    t.text("id").primary();
    t.text("user_id").notNullable().references("id").inTable("app_users").onDelete("CASCADE");
    t.text("token_hash").notNullable().unique();
    t.text("expires_at").notNullable();
    t.text("used_at");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---------- integration_events ----------
  await knex.schema.createTable("integration_events", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("kind").notNullable();
    t.text("payload_json").notNullable();
    t.text("created_by_user_id").references("id").inTable("app_users").onDelete("SET NULL");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---------- audit_logs ----------
  await knex.schema.createTable("audit_logs", (t) => {
    if (isPg) {
      t.bigIncrements("id").primary();
    } else {
      t.increments("id").primary();
    }
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("actor_user_id").references("id").inTable("app_users").onDelete("SET NULL");
    t.text("action").notNullable();
    t.text("entity_type").notNullable();
    t.text("entity_id");
    t.text("before_json");
    t.text("after_json");
    t.text("metadata_json");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---------- indexes ----------
  await knex.schema.table("user_tenants", (t) => {
    t.index("user_id", "idx_user_tenants_user_id");
  });
  await knex.schema.table("user_fraction_scopes", (t) => {
    t.index(["user_id", "tenant_id"], "idx_user_fraction_scopes_user_tenant");
  });
  await knex.schema.table("fractions", (t) => {
    t.index("tenant_id", "idx_fractions_tenant_id");
  });
  await knex.schema.table("people", (t) => {
    t.index("tenant_id", "idx_people_tenant_id");
  });
  await knex.schema.table("fraction_parties", (t) => {
    t.index("tenant_id", "idx_fraction_parties_tenant_id");
  });
  await knex.schema.table("charges", (t) => {
    t.index("tenant_id", "idx_charges_tenant_id");
  });
  await knex.schema.table("payments", (t) => {
    t.index("tenant_id", "idx_payments_tenant_id");
  });
  await knex.schema.table("finance_ledger_entries", (t) => {
    t.index("tenant_id", "idx_ledger_tenant_id");
  });
  await knex.schema.table("issues", (t) => {
    t.index("tenant_id", "idx_issues_tenant_id");
  });
  await knex.schema.table("documents", (t) => {
    t.index("tenant_id", "idx_documents_tenant_id");
  });
  await knex.schema.table("document_versions", (t) => {
    t.index(["document_id", "version_number"], "idx_document_versions_document");
  });
  await knex.schema.table("finance_receipts", (t) => {
    t.index("tenant_id", "idx_finance_receipts_tenant_id");
    t.index("payment_id", "idx_finance_receipts_payment_id");
  });
  await knex.schema.table("bank_transactions", (t) => {
    t.index(["tenant_id", "status", "booked_at"], "idx_bank_transactions_tenant_status");
  });
  await knex.schema.table("assemblies", (t) => {
    t.index("tenant_id", "idx_assemblies_tenant_id");
  });
  await knex.schema.table("assembly_attendees", (t) => {
    t.index("assembly_id", "idx_assembly_attendees_assembly_id");
  });
  await knex.schema.table("auth_refresh_tokens", (t) => {
    t.index("user_id", "idx_refresh_tokens_user_id");
  });
  await knex.schema.table("auth_password_reset_tokens", (t) => {
    t.index("user_id", "idx_password_reset_tokens_user_id");
  });
  await knex.schema.table("integration_events", (t) => {
    t.index("tenant_id", "idx_integration_events_tenant_id");
  });
  await knex.schema.table("audit_logs", (t) => {
    t.index("tenant_id", "idx_audit_logs_tenant_id");
  });
}

export async function down(knex) {
  const tables = [
    "audit_logs",
    "integration_events",
    "auth_password_reset_tokens",
    "auth_refresh_tokens",
    "assembly_attendees",
    "assemblies",
    "bank_transactions",
    "finance_receipts",
    "document_versions",
    "documents",
    "finance_ledger_entries",
    "issues",
    "payments",
    "charges",
    "fraction_parties",
    "people",
    "user_fraction_scopes",
    "fractions",
    "user_tenants",
    "app_users",
    "tenants",
  ];

  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
}
