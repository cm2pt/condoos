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

export async function seed(knex) {
  const enableDemo = process.env.ENABLE_DEMO_USERS !== "false";
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  const tenant = seed.condominium;
  const tenantId = tenant.id;
  const now = new Date().toISOString();

  // Clear existing data in dependency order
  await knex("audit_logs").del();
  await knex("integration_events").del();
  await knex("auth_password_reset_tokens").del();
  await knex("auth_refresh_tokens").del();
  await knex("assembly_attendees").del();
  await knex("assemblies").del();
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

  // Tenant
  await knex("tenants").insert({
    id: tenantId,
    name: tenant.name,
    tax_number: tenant.taxNumber,
    address: tenant.address,
    postal_code: tenant.postalCode,
    city: tenant.city,
    country: tenant.country,
    management_type: tenant.managementType,
    created_at: now,
    updated_at: now,
  });

  // Fractions
  if (seed.fractions?.length) {
    await knex.batchInsert(
      "fractions",
      seed.fractions.map((f) => ({
        id: f.id,
        tenant_id: tenantId,
        code: f.code,
        floor_number: Number(f.floorNumber),
        type: f.type,
        typology: f.typology,
        private_area_m2: Number(f.privateAreaM2),
        permillage: Number(f.permillage),
        monthly_fee_amount: Number(f.monthlyFee),
        status: f.status,
        created_at: now,
        updated_at: now,
      })),
      30
    );
  }

  // People
  if (seed.people?.length) {
    await knex.batchInsert(
      "people",
      seed.people.map((p) => ({
        id: p.id,
        tenant_id: tenantId,
        full_name: p.fullName,
        role_type: p.roleType,
        tax_number: p.taxNumber || null,
        email: p.email || null,
        phone: p.phone || null,
        created_at: now,
        updated_at: now,
      })),
      30
    );
  }

  // Fraction Parties
  if (seed.fractionParties?.length) {
    await knex.batchInsert(
      "fraction_parties",
      seed.fractionParties.map((r) => ({
        id: r.id,
        tenant_id: tenantId,
        fraction_id: r.fractionId,
        person_id: r.personId,
        relationship: r.relationship,
        start_date: r.startDate,
        end_date: r.endDate || null,
        is_primary: r.isPrimary ? 1 : 0,
        created_at: now,
        updated_at: now,
      })),
      30
    );
  }

  // Charges
  if (seed.charges?.length) {
    await knex.batchInsert(
      "charges",
      seed.charges.map((c) => ({
        id: c.id,
        tenant_id: tenantId,
        fraction_id: c.fractionId,
        kind: c.kind,
        period: c.period,
        due_date: c.dueDate,
        amount: Number(c.amount),
        status: c.status,
        created_at: now,
        updated_at: now,
      })),
      30
    );
  }

  // Payments
  if (seed.payments?.length) {
    await knex.batchInsert(
      "payments",
      seed.payments.map((p) => ({
        id: p.id,
        tenant_id: tenantId,
        fraction_id: p.fractionId,
        charge_id: p.chargeId || null,
        method: p.method,
        amount: Number(p.amount),
        paid_at: p.paidAt,
        reference: p.reference || null,
        source: p.source || "manual",
        created_at: now,
      })),
      30
    );
  }

  // Issues
  if (seed.issues?.length) {
    await knex.batchInsert(
      "issues",
      seed.issues.map((i) => ({
        id: i.id,
        tenant_id: tenantId,
        fraction_id: i.fractionId || null,
        created_by_person_id: i.createdByPersonId || null,
        assigned_supplier_person_id: i.assignedSupplierPersonId || null,
        category: i.category,
        priority: i.priority,
        status: i.status,
        title: i.title,
        description: i.description,
        opened_at: i.openedAt,
        closed_at: i.closedAt || null,
        created_at: now,
        updated_at: now,
      })),
      30
    );
  }

  // Documents
  if (seed.documents?.length) {
    await knex.batchInsert(
      "documents",
      seed.documents.map((d) => ({
        id: d.id,
        tenant_id: tenantId,
        category: d.category,
        title: d.title,
        visibility: d.visibility,
        uploaded_by_person_id: d.uploadedByPersonId || null,
        uploaded_at: d.uploadedAt,
        storage_path: d.storagePath,
        created_at: now,
        updated_at: now,
      })),
      30
    );
  }

  // Demo users
  if (enableDemo) {
    for (const user of DEMO_USERS) {
      await knex("app_users").insert({
        id: user.id,
        email: user.email.toLowerCase(),
        password_hash: bcrypt.hashSync(user.password, 10),
        full_name: user.fullName,
        role: user.role,
        is_active: 1,
        created_at: now,
        updated_at: now,
      });
      await knex("user_tenants").insert({
        user_id: user.id,
        tenant_id: tenantId,
      });
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
          user_id: user.id,
          tenant_id: tenantId,
          fraction_id: firstFraction.id,
        }).onConflict(["user_id", "tenant_id", "fraction_id"]).ignore();
      }
    }
  } else {
    // Bootstrap admin
    const adminEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || "";
    if (adminEmail && adminPassword) {
      await knex("app_users").insert({
        id: "app-user-bootstrap-manager-001",
        email: adminEmail,
        password_hash: bcrypt.hashSync(adminPassword, 10),
        full_name: "Administrador",
        role: "manager",
        is_active: 1,
        created_at: now,
        updated_at: now,
      });
      await knex("user_tenants").insert({
        user_id: "app-user-bootstrap-manager-001",
        tenant_id: tenantId,
      });
    }
  }
}
