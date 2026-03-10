/**
 * Payment references table for Multibanco, MB Way, and SEPA Direct Debit tracking.
 */
export async function up(knex) {
  await knex.schema.createTable("payment_references", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants");
    t.text("charge_id").notNullable().references("id").inTable("charges");
    t.text("provider").notNullable(); // ifthenpay, mock
    t.text("method").notNullable(); // multibanco, mbway, sepa_dd
    t.text("entity"); // Multibanco entity (5 digits)
    t.text("reference"); // Multibanco reference (9 digits) or SEPA mandate ID
    t.text("phone"); // MB Way phone number
    t.specificType("amount", "numeric(14,2)").notNullable();
    t.text("currency").notNullable().defaultTo("EUR");
    t.text("status").notNullable().defaultTo("pending"); // pending, paid, expired, cancelled, error
    t.text("provider_transaction_id"); // ID returned by the payment provider
    t.text("expires_at");
    t.text("paid_at");
    t.text("error_message");
    t.text("webhook_payload_json"); // raw webhook data for audit
    t.text("created_by_user_id").references("id").inTable("app_users");
    t.text("created_at").notNullable();
    t.text("updated_at").notNullable();
  });

  await knex.schema.table("payment_references", (t) => {
    t.index("tenant_id", "idx_payment_refs_tenant_id");
    t.index("charge_id", "idx_payment_refs_charge_id");
    t.index("status", "idx_payment_refs_status");
    t.index(["entity", "reference"], "idx_payment_refs_entity_reference");
  });

  // Add IBAN/BIC to people and tenants for SEPA Direct Debit
  await knex.schema.table("people", (t) => {
    t.text("iban");
    t.text("bic");
  });

  await knex.schema.table("tenants", (t) => {
    t.text("iban");
    t.text("bic");
    t.text("sepa_creditor_id");
  });

  // Email log table for tracking sent notifications
  await knex.schema.createTable("email_log", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants");
    t.text("template").notNullable(); // payment-reminder, issue-update, assembly-convocation, welcome
    t.text("recipient_email").notNullable();
    t.text("recipient_name");
    t.text("subject").notNullable();
    t.text("status").notNullable().defaultTo("queued"); // queued, sent, failed, bounced
    t.text("error_message");
    t.text("metadata_json"); // additional context (chargeId, issueId, etc.)
    t.text("sent_at");
    t.text("created_at").notNullable();
  });

  await knex.schema.table("email_log", (t) => {
    t.index("tenant_id", "idx_email_log_tenant_id");
    t.index("status", "idx_email_log_status");
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("email_log");
  await knex.schema.dropTableIfExists("payment_references");

  // SQLite doesn't support DROP COLUMN, so we skip these in dev/test
  const isSQLite = knex.client?.config?.client === "better-sqlite3";
  if (!isSQLite) {
    await knex.schema.table("people", (t) => {
      t.dropColumn("iban");
      t.dropColumn("bic");
    });
    await knex.schema.table("tenants", (t) => {
      t.dropColumn("iban");
      t.dropColumn("bic");
      t.dropColumn("sepa_creditor_id");
    });
  }
}
