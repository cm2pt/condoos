/**
 * Assembly votes table — stores individual votes cast per fraction per vote item.
 */
export async function up(knex) {
  await knex.schema.createTable("assembly_votes", (t) => {
    t.text("id").primary();
    t.text("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.text("assembly_id").notNullable().references("id").inTable("assemblies").onDelete("CASCADE");
    t.integer("vote_item_index").notNullable();
    t.text("user_id").notNullable().references("id").inTable("app_users").onDelete("CASCADE");
    t.text("fraction_id").notNullable().references("id").inTable("fractions").onDelete("CASCADE");
    t.text("vote").notNullable();
    t.float("permillage_weight").notNullable();
    t.text("cast_at").notNullable().defaultTo(knex.fn.now());
    t.unique(["assembly_id", "vote_item_index", "fraction_id"]);
  });

  await knex.schema.table("assembly_votes", (t) => {
    t.index(["assembly_id", "vote_item_index"], "idx_assembly_votes_assembly_item");
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("assembly_votes");
}
