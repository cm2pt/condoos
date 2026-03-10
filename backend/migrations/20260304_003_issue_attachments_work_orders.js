/**
 * Migration 003: issue_attachments, work_orders, issue updates (PATCH fields)
 */
export async function up(knex) {
  const isPg = knex.client.config.client === "pg";

  // ---------- issue_attachments ----------
  await knex.schema.createTable("issue_attachments", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("issue_id").notNullable().references("id").inTable("issues").onDelete("CASCADE");
    t.text("file_name").notNullable();
    t.text("file_path").notNullable();
    t.text("mime_type").notNullable();
    t.integer("file_size").notNullable();
    t.text("uploaded_by_user_id");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.table("issue_attachments", (t) => {
    t.index("issue_id", "idx_issue_attachments_issue_id");
  });

  // ---------- work_orders ----------
  await knex.schema.createTable("work_orders", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("issue_id").notNullable().references("id").inTable("issues").onDelete("CASCADE");
    t.text("supplier_person_id").references("id").inTable("people").onDelete("SET NULL");
    t.text("description").notNullable();
    t.text("status").notNullable().defaultTo("pending");
    if (isPg) {
      t.decimal("estimated_cost", 14, 2);
      t.decimal("final_cost", 14, 2);
    } else {
      t.float("estimated_cost");
      t.float("final_cost");
    }
    t.text("scheduled_at");
    t.text("completed_at");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.table("work_orders", (t) => {
    t.index("issue_id", "idx_work_orders_issue_id");
  });

  // ---------- issue_comments ----------
  await knex.schema.createTable("issue_comments", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("issue_id").notNullable().references("id").inTable("issues").onDelete("CASCADE");
    t.text("author_user_id");
    t.text("body").notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.table("issue_comments", (t) => {
    t.index("issue_id", "idx_issue_comments_issue_id");
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("issue_comments");
  await knex.schema.dropTableIfExists("work_orders");
  await knex.schema.dropTableIfExists("issue_attachments");
}
