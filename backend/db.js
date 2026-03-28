import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, ENABLE_DEMO_USERS } from "./config.js";

const DB_DIRECTORY = path.resolve(process.cwd(), "backend/data");
const DB_FILENAME_BY_ENV = process.env.NODE_ENV === "test" ? "condoos.test.sqlite" : "condoos.sqlite";
const DB_FILE = process.env.CONDOOS_DB_FILE
  ? path.resolve(process.cwd(), process.env.CONDOOS_DB_FILE)
  : path.join(DB_DIRECTORY, DB_FILENAME_BY_ENV);
const SEED_FILE = path.resolve(process.cwd(), "data/synthetic/condominio_portugal_seed.json");

export const DEMO_USERS = [
  {
    id: "app-user-manager-001",
    email: "gestao.demo@condoos.pt",
    fullName: "Gestao Demo",
    role: "manager",
    password: "Condoos!Gestao2026",
  },
  {
    id: "app-user-accounting-001",
    email: "contabilidade.demo@condoos.pt",
    fullName: "Contabilidade Demo",
    role: "accounting",
    password: "Condoos!Contabilidade2026",
  },
  {
    id: "app-user-operations-001",
    email: "operacoes.demo@condoos.pt",
    fullName: "Operacoes Demo",
    role: "operations",
    password: "Condoos!Operacoes2026",
  },
  {
    id: "app-user-resident-001",
    email: "condomino.demo@condoos.pt",
    fullName: "Condomino Demo",
    role: "resident",
    password: "Condoos!Condomino2026",
  },
];

let database = null;

function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tax_number TEXT,
      address TEXT,
      postal_code TEXT,
      city TEXT,
      country TEXT,
      management_type TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('manager', 'accounting', 'operations', 'resident')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_tenants (
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, tenant_id)
    );

    CREATE TABLE IF NOT EXISTS user_fraction_scopes (
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      fraction_id TEXT NOT NULL REFERENCES fractions(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, tenant_id, fraction_id)
    );

    CREATE TABLE IF NOT EXISTS fractions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      floor_number INTEGER NOT NULL,
      type TEXT NOT NULL,
      typology TEXT NOT NULL,
      private_area_m2 REAL NOT NULL,
      permillage REAL NOT NULL,
      monthly_fee_amount REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, code)
    );

    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      role_type TEXT NOT NULL,
      tax_number TEXT,
      email TEXT,
      phone TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fraction_parties (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      fraction_id TEXT NOT NULL REFERENCES fractions(id) ON DELETE CASCADE,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      relationship TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS charges (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      fraction_id TEXT NOT NULL REFERENCES fractions(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      period TEXT NOT NULL,
      due_date TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      fraction_id TEXT NOT NULL REFERENCES fractions(id) ON DELETE CASCADE,
      charge_id TEXT REFERENCES charges(id) ON DELETE SET NULL,
      method TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_at TEXT NOT NULL,
      reference TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      fraction_id TEXT REFERENCES fractions(id) ON DELETE SET NULL,
      created_by_person_id TEXT,
      assigned_supplier_person_id TEXT,
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS finance_ledger_entries (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      fraction_id TEXT REFERENCES fractions(id) ON DELETE SET NULL,
      charge_id TEXT REFERENCES charges(id) ON DELETE SET NULL,
      payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
      entry_type TEXT NOT NULL CHECK (entry_type IN ('charge_issue', 'payment_received', 'payment_reversal', 'charge_adjustment')),
      amount REAL NOT NULL,
      occurred_at TEXT NOT NULL,
      metadata_json TEXT,
      created_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      visibility TEXT NOT NULL CHECK (visibility IN ('manager_only', 'residents', 'all')),
      uploaded_by_person_id TEXT,
      uploaded_at TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS document_versions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      original_file_name TEXT,
      mime_type TEXT,
      file_size_bytes INTEGER,
      checksum_sha256 TEXT,
      created_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (document_id, version_number)
    );

    CREATE TABLE IF NOT EXISTS finance_receipts (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id) ON DELETE CASCADE,
      receipt_number TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/pdf',
      file_size_bytes INTEGER NOT NULL DEFAULT 0,
      checksum_sha256 TEXT,
      generated_at TEXT NOT NULL,
      created_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bank_transactions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      booked_at TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      reference TEXT,
      raw_json TEXT,
      status TEXT NOT NULL CHECK (status IN ('unmatched', 'matched', 'ignored')) DEFAULT 'unmatched',
      matched_payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assemblies (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      meeting_type TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      location TEXT NOT NULL,
      call_notice_sent_at TEXT,
      minutes_document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      vote_items_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assembly_attendees (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      assembly_id TEXT NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      representation_type TEXT NOT NULL DEFAULT 'self',
      proxy_document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
      presence_status TEXT NOT NULL DEFAULT 'present',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (assembly_id, person_id)
    );

    CREATE TABLE IF NOT EXISTS assembly_votes (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      assembly_id TEXT NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
      vote_item_index INTEGER NOT NULL,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      fraction_id TEXT NOT NULL REFERENCES fractions(id) ON DELETE CASCADE,
      vote TEXT NOT NULL CHECK (vote IN ('favor', 'contra', 'abstencao')),
      permillage_weight REAL NOT NULL,
      cast_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (assembly_id, vote_item_index, fraction_id)
    );

    CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auth_password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS integration_events (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      actor_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      before_json TEXT,
      after_json TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_user_tenants_user_id ON user_tenants(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_fraction_scopes_user_tenant
      ON user_fraction_scopes(user_id, tenant_id);
    CREATE INDEX IF NOT EXISTS idx_fractions_tenant_id ON fractions(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_people_tenant_id ON people(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_fraction_parties_tenant_id ON fraction_parties(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_charges_tenant_id ON charges(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_tenant_id ON finance_ledger_entries(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_issues_tenant_id ON issues(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON documents(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_document_versions_document ON document_versions(document_id, version_number DESC);
    CREATE INDEX IF NOT EXISTS idx_finance_receipts_tenant_id ON finance_receipts(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_finance_receipts_payment_id ON finance_receipts(payment_id);
    CREATE INDEX IF NOT EXISTS idx_bank_transactions_tenant_status
      ON bank_transactions(tenant_id, status, booked_at DESC);
    CREATE INDEX IF NOT EXISTS idx_assemblies_tenant_id ON assemblies(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_assembly_attendees_assembly_id ON assembly_attendees(assembly_id);
    CREATE INDEX IF NOT EXISTS idx_assembly_votes_assembly_item ON assembly_votes(assembly_id, vote_item_index);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON auth_refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON auth_password_reset_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_integration_events_tenant_id ON integration_events(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
  `);
}

function applySchemaMigrations(db) {
  const documentVersionColumns = db.prepare("PRAGMA table_info(document_versions)").all();
  const hasOriginalFileName = documentVersionColumns.some((column) => column.name === "original_file_name");
  if (!hasOriginalFileName) {
    db.exec("ALTER TABLE document_versions ADD COLUMN original_file_name TEXT;");
  }
}

function loadSeedData() {
  return JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
}

function hasTenantData(db) {
  const row = db.prepare("SELECT COUNT(*) AS total FROM tenants").get();
  return Number(row?.total || 0) > 0;
}

function clearSeededData(db) {
  db.exec(`
    DELETE FROM audit_logs;
    DELETE FROM integration_events;
    DELETE FROM auth_password_reset_tokens;
    DELETE FROM auth_refresh_tokens;
    DELETE FROM assembly_votes;
    DELETE FROM assembly_attendees;
    DELETE FROM assemblies;
    DELETE FROM document_versions;
    DELETE FROM finance_receipts;
    DELETE FROM bank_transactions;
    DELETE FROM finance_ledger_entries;
    DELETE FROM documents;
    DELETE FROM payments;
    DELETE FROM charges;
    DELETE FROM issues;
    DELETE FROM user_fraction_scopes;
    DELETE FROM fraction_parties;
    DELETE FROM people;
    DELETE FROM fractions;
    DELETE FROM user_tenants;
    DELETE FROM app_users;
    DELETE FROM tenants;
  `);
}

function seedDemoUsers(db, tenantId) {
  const userInsert = db.prepare(`
    INSERT INTO app_users (id, email, password_hash, full_name, role, is_active)
    VALUES (:id, :email, :password_hash, :full_name, :role, 1)
  `);
  const userTenantInsert = db.prepare(`
    INSERT INTO user_tenants (user_id, tenant_id)
    VALUES (:user_id, :tenant_id)
  `);

  for (const user of DEMO_USERS) {
    userInsert.run({
      ":id": user.id,
      ":email": user.email.toLowerCase(),
      ":password_hash": bcrypt.hashSync(user.password, 10),
      ":full_name": user.fullName,
      ":role": user.role,
    });

    userTenantInsert.run({
      ":user_id": user.id,
      ":tenant_id": tenantId,
    });
  }
}

function seedBootstrapAdmin(db, tenantId) {
  if (!BOOTSTRAP_ADMIN_EMAIL || !BOOTSTRAP_ADMIN_PASSWORD) {
    return;
  }

  const managerUser = {
    id: "app-user-bootstrap-manager-001",
    email: BOOTSTRAP_ADMIN_EMAIL,
    fullName: "Administrador",
    role: "manager",
  };

  db.prepare(`
    INSERT INTO app_users (id, email, password_hash, full_name, role, is_active)
    VALUES (:id, :email, :password_hash, :full_name, :role, 1)
  `).run({
    ":id": managerUser.id,
    ":email": managerUser.email,
    ":password_hash": bcrypt.hashSync(BOOTSTRAP_ADMIN_PASSWORD, 10),
    ":full_name": managerUser.fullName,
    ":role": managerUser.role,
  });

  db.prepare(`
    INSERT INTO user_tenants (user_id, tenant_id)
    VALUES (:user_id, :tenant_id)
  `).run({
    ":user_id": managerUser.id,
    ":tenant_id": tenantId,
  });
}

function seedResidentFractionScopes(db, tenantId) {
  const defaultFraction = db
    .prepare(`
      SELECT id
      FROM fractions
      WHERE tenant_id = :tenant_id
      ORDER BY floor_number ASC, code ASC
      LIMIT 1
    `)
    .get({ ":tenant_id": tenantId });

  if (!defaultFraction?.id) {
    return;
  }

  const residentUsers = DEMO_USERS.filter((user) => user.role === "resident");
  const insertScope = db.prepare(`
    INSERT OR IGNORE INTO user_fraction_scopes (user_id, tenant_id, fraction_id)
    VALUES (:user_id, :tenant_id, :fraction_id)
  `);

  for (const user of residentUsers) {
    insertScope.run({
      ":user_id": user.id,
      ":tenant_id": tenantId,
      ":fraction_id": defaultFraction.id,
    });
  }
}

function backfillResidentFractionScopes(db) {
  const residentMemberships = db
    .prepare(`
      SELECT ut.user_id AS userId, ut.tenant_id AS tenantId
      FROM user_tenants ut
      INNER JOIN app_users u ON u.id = ut.user_id
      WHERE u.role = 'resident' AND u.is_active = 1
    `)
    .all();

  const countScopes = db.prepare(`
    SELECT COUNT(*) AS total
    FROM user_fraction_scopes
    WHERE user_id = :user_id AND tenant_id = :tenant_id
  `);
  const pickFirstFraction = db.prepare(`
    SELECT id
    FROM fractions
    WHERE tenant_id = :tenant_id
    ORDER BY floor_number ASC, code ASC
    LIMIT 1
  `);
  const insertScope = db.prepare(`
    INSERT OR IGNORE INTO user_fraction_scopes (user_id, tenant_id, fraction_id)
    VALUES (:user_id, :tenant_id, :fraction_id)
  `);

  for (const membership of residentMemberships) {
    const scoped = countScopes.get({
      ":user_id": membership.userId,
      ":tenant_id": membership.tenantId,
    });

    if (Number(scoped?.total || 0) > 0) {
      continue;
    }

    const fallbackFraction = pickFirstFraction.get({
      ":tenant_id": membership.tenantId,
    });

    if (!fallbackFraction?.id) {
      continue;
    }

    insertScope.run({
      ":user_id": membership.userId,
      ":tenant_id": membership.tenantId,
      ":fraction_id": fallbackFraction.id,
    });
  }
}

function seedFromSyntheticDataset(db) {
  const seed = loadSeedData();
  const tenant = seed.condominium;
  const tenantId = tenant.id;
  const nowIso = new Date().toISOString();

  const insertTenant = db.prepare(`
    INSERT INTO tenants (id, name, tax_number, address, postal_code, city, country, management_type, created_at, updated_at)
    VALUES (:id, :name, :tax_number, :address, :postal_code, :city, :country, :management_type, :created_at, :updated_at)
  `);
  const insertFraction = db.prepare(`
    INSERT INTO fractions (
      id, tenant_id, code, floor_number, type, typology, private_area_m2, permillage, monthly_fee_amount, status, created_at, updated_at
    ) VALUES (
      :id, :tenant_id, :code, :floor_number, :type, :typology, :private_area_m2, :permillage, :monthly_fee_amount, :status, :created_at, :updated_at
    )
  `);
  const insertPerson = db.prepare(`
    INSERT INTO people (
      id, tenant_id, full_name, role_type, tax_number, email, phone, created_at, updated_at
    ) VALUES (
      :id, :tenant_id, :full_name, :role_type, :tax_number, :email, :phone, :created_at, :updated_at
    )
  `);
  const insertFractionParty = db.prepare(`
    INSERT INTO fraction_parties (
      id, tenant_id, fraction_id, person_id, relationship, start_date, end_date, is_primary, created_at, updated_at
    ) VALUES (
      :id, :tenant_id, :fraction_id, :person_id, :relationship, :start_date, :end_date, :is_primary, :created_at, :updated_at
    )
  `);
  const insertCharge = db.prepare(`
    INSERT INTO charges (
      id, tenant_id, fraction_id, kind, period, due_date, amount, status, created_at, updated_at
    ) VALUES (
      :id, :tenant_id, :fraction_id, :kind, :period, :due_date, :amount, :status, :created_at, :updated_at
    )
  `);
  const insertPayment = db.prepare(`
    INSERT INTO payments (
      id, tenant_id, fraction_id, charge_id, method, amount, paid_at, reference, source, created_at
    ) VALUES (
      :id, :tenant_id, :fraction_id, :charge_id, :method, :amount, :paid_at, :reference, :source, :created_at
    )
  `);
  const insertIssue = db.prepare(`
    INSERT INTO issues (
      id, tenant_id, fraction_id, created_by_person_id, assigned_supplier_person_id, category, priority, status, title, description, opened_at, closed_at, created_at, updated_at
    ) VALUES (
      :id, :tenant_id, :fraction_id, :created_by_person_id, :assigned_supplier_person_id, :category, :priority, :status, :title, :description, :opened_at, :closed_at, :created_at, :updated_at
    )
  `);
  const insertAssembly = db.prepare(`
    INSERT INTO assemblies (
      id, tenant_id, meeting_type, scheduled_at, location, call_notice_sent_at, minutes_document_id, status, vote_items_json, created_at, updated_at
    ) VALUES (
      :id, :tenant_id, :meeting_type, :scheduled_at, :location, :call_notice_sent_at, :minutes_document_id, :status, :vote_items_json, :created_at, :updated_at
    )
  `);
  const insertDocument = db.prepare(`
    INSERT INTO documents (
      id, tenant_id, category, title, visibility, uploaded_by_person_id, uploaded_at, storage_path, created_at, updated_at
    ) VALUES (
      :id, :tenant_id, :category, :title, :visibility, :uploaded_by_person_id, :uploaded_at, :storage_path, :created_at, :updated_at
    )
  `);

  insertTenant.run({
    ":id": tenantId,
    ":name": tenant.name,
    ":tax_number": tenant.taxNumber,
    ":address": tenant.address,
    ":postal_code": tenant.postalCode,
    ":city": tenant.city,
    ":country": tenant.country,
    ":management_type": tenant.managementType,
    ":created_at": nowIso,
    ":updated_at": nowIso,
  });

  for (const fraction of seed.fractions) {
    insertFraction.run({
      ":id": fraction.id,
      ":tenant_id": tenantId,
      ":code": fraction.code,
      ":floor_number": Number(fraction.floorNumber),
      ":type": fraction.type,
      ":typology": fraction.typology,
      ":private_area_m2": Number(fraction.privateAreaM2),
      ":permillage": Number(fraction.permillage),
      ":monthly_fee_amount": Number(fraction.monthlyFee),
      ":status": fraction.status,
      ":created_at": nowIso,
      ":updated_at": nowIso,
    });
  }

  for (const person of seed.people || []) {
    insertPerson.run({
      ":id": person.id,
      ":tenant_id": tenantId,
      ":full_name": person.fullName,
      ":role_type": person.roleType,
      ":tax_number": person.taxNumber || null,
      ":email": person.email || null,
      ":phone": person.phone || null,
      ":created_at": nowIso,
      ":updated_at": nowIso,
    });
  }

  for (const relation of seed.fractionParties || []) {
    insertFractionParty.run({
      ":id": relation.id,
      ":tenant_id": tenantId,
      ":fraction_id": relation.fractionId,
      ":person_id": relation.personId,
      ":relationship": relation.relationship,
      ":start_date": relation.startDate,
      ":end_date": relation.endDate || null,
      ":is_primary": relation.isPrimary ? 1 : 0,
      ":created_at": nowIso,
      ":updated_at": nowIso,
    });
  }

  for (const charge of seed.charges) {
    insertCharge.run({
      ":id": charge.id,
      ":tenant_id": tenantId,
      ":fraction_id": charge.fractionId,
      ":kind": charge.kind,
      ":period": charge.period,
      ":due_date": charge.dueDate,
      ":amount": Number(charge.amount),
      ":status": charge.status,
      ":created_at": nowIso,
      ":updated_at": nowIso,
    });
  }

  for (const payment of seed.payments) {
    insertPayment.run({
      ":id": payment.id,
      ":tenant_id": tenantId,
      ":fraction_id": payment.fractionId,
      ":charge_id": payment.chargeId || null,
      ":method": payment.method,
      ":amount": Number(payment.amount),
      ":paid_at": payment.paidAt,
      ":reference": payment.reference || null,
      ":source": payment.source || "manual",
      ":created_at": nowIso,
    });
  }

  for (const issue of seed.issues) {
    insertIssue.run({
      ":id": issue.id,
      ":tenant_id": tenantId,
      ":fraction_id": issue.fractionId || null,
      ":created_by_person_id": issue.createdByPersonId || null,
      ":assigned_supplier_person_id": issue.assignedSupplierPersonId || null,
      ":category": issue.category,
      ":priority": issue.priority,
      ":status": issue.status,
      ":title": issue.title,
      ":description": issue.description,
      ":opened_at": issue.openedAt,
      ":closed_at": issue.closedAt || null,
      ":created_at": nowIso,
      ":updated_at": nowIso,
    });
  }

  for (const document of seed.documents) {
    insertDocument.run({
      ":id": document.id,
      ":tenant_id": tenantId,
      ":category": document.category,
      ":title": document.title,
      ":visibility": document.visibility,
      ":uploaded_by_person_id": document.uploadedByPersonId || null,
      ":uploaded_at": document.uploadedAt,
      ":storage_path": document.storagePath,
      ":created_at": nowIso,
      ":updated_at": nowIso,
    });
  }

  for (const assembly of seed.assemblies || []) {
    insertAssembly.run({
      ":id": assembly.id,
      ":tenant_id": tenantId,
      ":meeting_type": assembly.meetingType,
      ":scheduled_at": assembly.scheduledAt,
      ":location": assembly.location,
      ":call_notice_sent_at": assembly.callNoticeSentAt || null,
      ":minutes_document_id": assembly.minutesDocumentId || null,
      ":status": assembly.status || "scheduled",
      ":vote_items_json": assembly.voteItems ? JSON.stringify(assembly.voteItems) : null,
      ":created_at": nowIso,
      ":updated_at": nowIso,
    });
  }

  if (ENABLE_DEMO_USERS) {
    seedDemoUsers(db, tenantId);
    seedResidentFractionScopes(db, tenantId);
  } else {
    seedBootstrapAdmin(db, tenantId);
  }
}

function seedDatabase(db, { force = false } = {}) {
  const alreadySeeded = hasTenantData(db);

  if (alreadySeeded && !force) {
    return false;
  }

  db.exec("BEGIN IMMEDIATE TRANSACTION");
  try {
    if (alreadySeeded && force) {
      clearSeededData(db);
    }
    seedFromSyntheticDataset(db);
    db.exec("COMMIT");
    return true;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function initializeDatabase({ reset = false, forceSeed = false } = {}) {
  if (database) {
    database.close();
    database = null;
  }

  if (reset && fs.existsSync(DB_FILE)) {
    fs.rmSync(DB_FILE, { force: true });
  }

  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  database = new DatabaseSync(DB_FILE);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);

  createSchema(database);
  applySchemaMigrations(database);
  const seeded = seedDatabase(database, { force: forceSeed || reset });
  backfillResidentFractionScopes(database);
  return { db: database, seeded, databasePath: DB_FILE };
}

export function getDatabase() {
  if (!database) {
    throw new Error("Database not initialized. Call initializeDatabase() before using getDatabase().");
  }

  return database;
}

export function getDatabasePath() {
  return DB_FILE;
}
