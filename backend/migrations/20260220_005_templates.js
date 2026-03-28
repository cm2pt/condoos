/**
 * Custom templates – modelos personalizáveis de e-mail e documentos jurídicos.
 */
export async function up(knex) {
  await knex.schema.createTable("custom_templates", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants");
    t.text("template_key").notNullable(); // payment-reminder, payment-confirmation, issue-update, assembly-convocation, welcome, privacy-policy, terms-of-service, dpa
    t.text("subject_template"); // para templates de e-mail
    t.text("body_template").notNullable();
    t.text("template_type").notNullable().defaultTo("email"); // email, legal
    t.integer("is_active").notNullable().defaultTo(1);
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    t.unique(["tenant_id", "template_key"]);
  });

  await knex.schema.table("custom_templates", (t) => {
    t.index(["tenant_id"], "idx_custom_templates_tenant");
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("custom_templates");
}
