/**
 * Notifications table – notificações internas para utilizadores.
 */
export async function up(knex) {
  await knex.schema.createTable("notifications", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants");
    t.text("user_id"); // null = todos os utilizadores do tenant
    t.text("type").notNullable(); // charge_overdue, payment_received, issue_update, assembly_scheduled, system
    t.text("title").notNullable();
    t.text("detail");
    t.text("tone").notNullable().defaultTo("neutral"); // accent, warning, danger, neutral, success
    t.text("module"); // dashboard, finance, issues, assemblies, documents, compliance
    t.text("target_id"); // link para entidade relacionada
    t.text("target_type"); // charge, payment, issue, assembly, document
    t.text("read_at");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.table("notifications", (t) => {
    t.index(["tenant_id"], "idx_notifications_tenant");
    t.index(["user_id", "read_at"], "idx_notifications_user_read");
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("notifications");
}
