import test, { after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createServer } from "../server.js";
import { destroyKnex } from "../db-knex.js";

after(async () => {
  await destroyKnex();
});

const SEEDED_TENANT_ID = "condo-pt-001";

async function login(app, credentials) {
  const response = await request(app)
    .post("/api/auth/login")
    .send(credentials);

  assert.equal(response.statusCode, 200);
  assert.equal(typeof response.body.token, "string");
  assert.equal(response.body.token.length > 20, true);

  // Always use the seeded tenant as default to avoid test ordering issues
  // when other tests create new tenants that sort alphabetically before the seeded one
  const body = response.body;
  if (body.tenants?.some((t) => t.id === SEEDED_TENANT_ID)) {
    body.defaultTenantId = SEEDED_TENANT_ID;
  }

  return body;
}

test("manager login and core routes work", async () => {
  const app = await createServer();

  const auth = await login(app, {
    email: "gestao.demo@condoos.pt",
    password: "Condoos!Gestao2026",
  });

  const me = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${auth.token}`)
    .set("x-tenant-id", auth.defaultTenantId);

  assert.equal(me.statusCode, 200);
  assert.equal(me.body.user.role, "manager");
  assert.equal(Array.isArray(me.body.capabilities.modules), true);
  assert.equal(me.body.capabilities.modules.includes("dashboard"), true);
  assert.equal(Array.isArray(me.body.capabilities.quickActions), true);

  const fractions = await request(app)
    .get("/api/fractions")
    .set("Authorization", `Bearer ${auth.token}`)
    .set("x-tenant-id", auth.defaultTenantId);

  assert.equal(fractions.statusCode, 200);
  assert.equal(Array.isArray(fractions.body.items), true);
  assert.equal(fractions.body.items.length >= 30, true);
  assert.equal(Array.isArray(auth.capabilities.modules), true);
  assert.equal(auth.capabilities.modules.includes("documents"), true);
});

test("tenant scope blocks cross-tenant access", async () => {
  const app = await createServer();
  const auth = await login(app, {
    email: "gestao.demo@condoos.pt",
    password: "Condoos!Gestao2026",
  });

  const forbidden = await request(app)
    .get("/api/fractions")
    .set("Authorization", `Bearer ${auth.token}`)
    .set("x-tenant-id", "condo-pt-999");

  assert.equal(forbidden.statusCode, 403);
});

test("resident cannot read audit log", async () => {
  const app = await createServer();
  const auth = await login(app, {
    email: "condomino.demo@condoos.pt",
    password: "Condoos!Condomino2026",
  });

  const response = await request(app)
    .get("/api/audit-log")
    .set("Authorization", `Bearer ${auth.token}`)
    .set("x-tenant-id", auth.defaultTenantId);

  assert.equal(response.statusCode, 403);
});

test("operations can create and update issue status", async () => {
  const app = await createServer();
  const auth = await login(app, {
    email: "operacoes.demo@condoos.pt",
    password: "Condoos!Operacoes2026",
  });

  const createIssueResponse = await request(app)
    .post("/api/issues")
    .set("Authorization", `Bearer ${auth.token}`)
    .set("x-tenant-id", auth.defaultTenantId)
    .send({
      title: "Teste integration",
      description: "Criado em testes",
      category: "limpeza",
      priority: "medium",
      status: "new",
    });

  assert.equal(createIssueResponse.statusCode, 201);
  const issueId = createIssueResponse.body.item.id;

  const updateResponse = await request(app)
    .patch(`/api/issues/${issueId}/status`)
    .set("Authorization", `Bearer ${auth.token}`)
    .set("x-tenant-id", auth.defaultTenantId)
    .send({ status: "triage" });

  assert.equal(updateResponse.statusCode, 200);
  assert.equal(updateResponse.body.item.status, "triage");
});

test("accounting cannot update issue status", async () => {
  const app = await createServer();
  const opsAuth = await login(app, {
    email: "operacoes.demo@condoos.pt",
    password: "Condoos!Operacoes2026",
  });
  const accountingAuth = await login(app, {
    email: "contabilidade.demo@condoos.pt",
    password: "Condoos!Contabilidade2026",
  });

  const issue = await request(app)
    .post("/api/issues")
    .set("Authorization", `Bearer ${opsAuth.token}`)
    .set("x-tenant-id", opsAuth.defaultTenantId)
    .send({
      title: "Issue bloqueada para accounting",
      description: "Criada para validar RBAC",
      category: "limpeza",
      priority: "low",
      status: "new",
    });

  assert.equal(issue.statusCode, 201);

  const patchResponse = await request(app)
    .patch(`/api/issues/${issue.body.item.id}/status`)
    .set("Authorization", `Bearer ${accountingAuth.token}`)
    .set("x-tenant-id", accountingAuth.defaultTenantId)
    .send({ status: "triage" });

  assert.equal(patchResponse.statusCode, 403);
});

test("accounting can create charge while operations cannot", async () => {
  const app = await createServer();

  const accountingAuth = await login(app, {
    email: "contabilidade.demo@condoos.pt",
    password: "Condoos!Contabilidade2026",
  });
  const operationsAuth = await login(app, {
    email: "operacoes.demo@condoos.pt",
    password: "Condoos!Operacoes2026",
  });

  const fractions = await request(app)
    .get("/api/fractions")
    .set("Authorization", `Bearer ${accountingAuth.token}`)
    .set("x-tenant-id", accountingAuth.defaultTenantId);
  assert.equal(fractions.statusCode, 200);
  const fractionId = fractions.body.items[0].id;

  const accountingCreate = await request(app)
    .post("/api/finance/charges")
    .set("Authorization", `Bearer ${accountingAuth.token}`)
    .set("x-tenant-id", accountingAuth.defaultTenantId)
    .send({
      fractionId,
      kind: "quota",
      period: "2026-02",
      dueDate: "2026-02-28",
      amount: 50,
      status: "open",
    });
  assert.equal(accountingCreate.statusCode, 201);

  const operationsCreate = await request(app)
    .post("/api/finance/charges")
    .set("Authorization", `Bearer ${operationsAuth.token}`)
    .set("x-tenant-id", operationsAuth.defaultTenantId)
    .send({
      fractionId,
      kind: "quota",
      period: "2026-02",
      dueDate: "2026-02-28",
      amount: 50,
      status: "open",
    });
  assert.equal(operationsCreate.statusCode, 403);
});

test("resident can create issue but cannot create fraction", async () => {
  const app = await createServer();
  const residentAuth = await login(app, {
    email: "condomino.demo@condoos.pt",
    password: "Condoos!Condomino2026",
  });

  const scopedFractions = await request(app)
    .get("/api/fractions")
    .set("Authorization", `Bearer ${residentAuth.token}`)
    .set("x-tenant-id", residentAuth.defaultTenantId);
  assert.equal(scopedFractions.statusCode, 200);
  assert.equal(scopedFractions.body.items.length, 1);
  const residentFractionId = scopedFractions.body.items[0].id;

  const issueCreate = await request(app)
    .post("/api/issues")
    .set("Authorization", `Bearer ${residentAuth.token}`)
    .set("x-tenant-id", residentAuth.defaultTenantId)
    .send({
      fractionId: residentFractionId,
      title: "Ocorrencia residente",
      description: "Teste de permissao",
      category: "ruido",
      priority: "low",
      status: "new",
    });
  assert.equal(issueCreate.statusCode, 201);

  const fractionCreate = await request(app)
    .post("/api/fractions")
    .set("Authorization", `Bearer ${residentAuth.token}`)
    .set("x-tenant-id", residentAuth.defaultTenantId)
    .send({
      code: "99X",
      floorNumber: 9,
      type: "habitacao",
      typology: "T1",
      privateAreaM2: 70,
      permillage: 20,
      monthlyFeeAmount: 50,
      status: "active",
    });
  assert.equal(fractionCreate.statusCode, 403);
});

test("resident only sees finance and issues from scoped fraction", async () => {
  const app = await createServer();
  const managerAuth = await login(app, {
    email: "gestao.demo@condoos.pt",
    password: "Condoos!Gestao2026",
  });
  const residentAuth = await login(app, {
    email: "condomino.demo@condoos.pt",
    password: "Condoos!Condomino2026",
  });

  const managerFractions = await request(app)
    .get("/api/fractions")
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId);
  assert.equal(managerFractions.statusCode, 200);
  assert.equal(managerFractions.body.items.length >= 30, true);

  const residentFractions = await request(app)
    .get("/api/fractions")
    .set("Authorization", `Bearer ${residentAuth.token}`)
    .set("x-tenant-id", residentAuth.defaultTenantId);
  assert.equal(residentFractions.statusCode, 200);
  assert.equal(residentFractions.body.items.length, 1);
  const residentFractionId = residentFractions.body.items[0].id;
  const outsideFractionId = managerFractions.body.items.find((item) => item.id !== residentFractionId)?.id;
  assert.equal(typeof outsideFractionId, "string");

  const residentCharges = await request(app)
    .get("/api/finance/charges")
    .set("Authorization", `Bearer ${residentAuth.token}`)
    .set("x-tenant-id", residentAuth.defaultTenantId);
  assert.equal(residentCharges.statusCode, 200);
  assert.equal(residentCharges.body.items.every((item) => item.fractionId === residentFractionId), true);

  const residentPayments = await request(app)
    .get("/api/finance/payments")
    .set("Authorization", `Bearer ${residentAuth.token}`)
    .set("x-tenant-id", residentAuth.defaultTenantId);
  assert.equal(residentPayments.statusCode, 200);
  assert.equal(residentPayments.body.items.every((item) => item.fractionId === residentFractionId), true);

  const forbiddenIssue = await request(app)
    .post("/api/issues")
    .set("Authorization", `Bearer ${residentAuth.token}`)
    .set("x-tenant-id", residentAuth.defaultTenantId)
    .send({
      fractionId: outsideFractionId,
      title: "Nao deve criar fora do scope",
      description: "Teste",
      category: "ruido",
      priority: "low",
      status: "new",
    });
  assert.equal(forbiddenIssue.statusCode, 403);
});

test("documents endpoint enforces visibility by role", async () => {
  const app = await createServer();
  const managerAuth = await login(app, {
    email: "gestao.demo@condoos.pt",
    password: "Condoos!Gestao2026",
  });
  const residentAuth = await login(app, {
    email: "condomino.demo@condoos.pt",
    password: "Condoos!Condomino2026",
  });

  const managerDocs = await request(app)
    .get("/api/documents")
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId);
  assert.equal(managerDocs.statusCode, 200);
  assert.equal(managerDocs.body.items.length > 0, true);
  assert.equal(managerDocs.body.items.some((item) => item.visibility === "manager_only"), true);
  assert.equal(managerDocs.body.items.some((item) => typeof item.storagePath === "string" && item.storagePath.length > 0), true);

  const residentDocs = await request(app)
    .get("/api/documents")
    .set("Authorization", `Bearer ${residentAuth.token}`)
    .set("x-tenant-id", residentAuth.defaultTenantId);
  assert.equal(residentDocs.statusCode, 200);
  assert.equal(residentDocs.body.items.length > 0, true);
  assert.equal(residentDocs.body.items.some((item) => item.visibility === "manager_only"), false);
  assert.equal(residentDocs.body.items.every((item) => item.storagePath === null), true);
});

test("documents download endpoint enforces visibility and role metadata", async () => {
  const app = await createServer();
  const managerAuth = await login(app, {
    email: "gestao.demo@condoos.pt",
    password: "Condoos!Gestao2026",
  });
  const residentAuth = await login(app, {
    email: "condomino.demo@condoos.pt",
    password: "Condoos!Condomino2026",
  });

  const managerDocs = await request(app)
    .get("/api/documents")
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId);
  assert.equal(managerDocs.statusCode, 200);
  const managerOnlyDoc = managerDocs.body.items.find((item) => item.visibility === "manager_only");
  assert.equal(Boolean(managerOnlyDoc?.id), true);

  const managerDownload = await request(app)
    .get(`/api/documents/${managerOnlyDoc.id}/download`)
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId);
  assert.equal(managerDownload.statusCode, 200);
  assert.equal(String(managerDownload.headers["content-type"]).includes("text/plain"), true);
  assert.equal(String(managerDownload.headers["content-disposition"]).includes("attachment"), true);
  assert.equal(String(managerDownload.text).includes("Caminho interno:"), true);

  const residentDownloadForbidden = await request(app)
    .get(`/api/documents/${managerOnlyDoc.id}/download`)
    .set("Authorization", `Bearer ${residentAuth.token}`)
    .set("x-tenant-id", residentAuth.defaultTenantId);
  assert.equal(residentDownloadForbidden.statusCode, 404);

  const residentDocs = await request(app)
    .get("/api/documents")
    .set("Authorization", `Bearer ${residentAuth.token}`)
    .set("x-tenant-id", residentAuth.defaultTenantId);
  assert.equal(residentDocs.statusCode, 200);
  const residentDoc = residentDocs.body.items.find((item) => item.visibility !== "manager_only");
  assert.equal(Boolean(residentDoc?.id), true);

  const residentDownload = await request(app)
    .get(`/api/documents/${residentDoc.id}/download`)
    .set("Authorization", `Bearer ${residentAuth.token}`)
    .set("x-tenant-id", residentAuth.defaultTenantId);
  assert.equal(residentDownload.statusCode, 200);
  assert.equal(String(residentDownload.text).includes("Caminho interno:"), false);
});

test("auth refresh, logout and password reset flow", async () => {
  const app = await createServer();

  const managerCredentials = {
    email: "gestao.demo@condoos.pt",
    password: "Condoos!Gestao2026",
  };

  const auth = await login(app, managerCredentials);
  assert.equal(typeof auth.refreshToken, "string");
  assert.equal(auth.refreshToken.length > 20, true);

  const refresh = await request(app)
    .post("/api/auth/refresh")
    .send({ refreshToken: auth.refreshToken });
  assert.equal(refresh.statusCode, 200);
  assert.equal(typeof refresh.body.token, "string");
  assert.equal(typeof refresh.body.refreshToken, "string");
  assert.equal(refresh.body.refreshToken !== auth.refreshToken, true);

  const logout = await request(app)
    .post("/api/auth/logout")
    .send({ refreshToken: refresh.body.refreshToken });
  assert.equal(logout.statusCode, 200);
  assert.equal(Number(logout.body.revoked) >= 1, true);

  const refreshAfterLogout = await request(app)
    .post("/api/auth/refresh")
    .send({ refreshToken: refresh.body.refreshToken });
  assert.equal(refreshAfterLogout.statusCode, 401);

  const resetRequest = await request(app)
    .post("/api/auth/password-reset/request")
    .send({ email: managerCredentials.email });
  assert.equal(resetRequest.statusCode, 200);
  assert.equal(typeof resetRequest.body.resetToken, "string");
  assert.equal(resetRequest.body.resetToken.length > 10, true);

  const newPassword = "Condoos!Gestao2026-New";
  const resetConfirm = await request(app)
    .post("/api/auth/password-reset/confirm")
    .send({
      token: resetRequest.body.resetToken,
      newPassword,
    });
  assert.equal(resetConfirm.statusCode, 200);

  const oldPasswordLogin = await request(app)
    .post("/api/auth/login")
    .send(managerCredentials);
  assert.equal(oldPasswordLogin.statusCode, 401);

  const newPasswordLogin = await request(app)
    .post("/api/auth/login")
    .send({
      email: managerCredentials.email,
      password: newPassword,
    });
  assert.equal(newPasswordLogin.statusCode, 200);

  // Restore original password so subsequent tests can login as manager
  const restoreResetRequest = await request(app)
    .post("/api/auth/password-reset/request")
    .send({ email: managerCredentials.email });
  assert.equal(restoreResetRequest.statusCode, 200);

  const restoreConfirm = await request(app)
    .post("/api/auth/password-reset/confirm")
    .send({
      token: restoreResetRequest.body.resetToken,
      newPassword: managerCredentials.password,
    });
  assert.equal(restoreConfirm.statusCode, 200);
});

test("tenant create/update and fractions CSV import work", async () => {
  const app = await createServer();
  const auth = await login(app, {
    email: "gestao.demo@condoos.pt",
    password: "Condoos!Gestao2026",
  });

  const createTenant = await request(app)
    .post("/api/tenants")
    .set("Authorization", `Bearer ${auth.token}`)
    .set("x-tenant-id", auth.defaultTenantId)
    .send({
      name: "Condominio Piloto Norte",
      city: "Porto",
      country: "Portugal",
      managementType: "professional",
    });
  assert.equal(createTenant.statusCode, 201);
  assert.equal(typeof createTenant.body.item.id, "string");

  const patchTenant = await request(app)
    .patch(`/api/tenants/${createTenant.body.item.id}`)
    .set("Authorization", `Bearer ${auth.token}`)
    .set("x-tenant-id", createTenant.body.item.id)
    .send({
      address: "Rua do Piloto, 10",
      postalCode: "4000-123",
    });
  assert.equal(patchTenant.statusCode, 200);
  assert.equal(patchTenant.body.item.postalCode, "4000-123");

  const tenants = await request(app)
    .get("/api/tenants")
    .set("Authorization", `Bearer ${auth.token}`)
    .set("x-tenant-id", auth.defaultTenantId);
  assert.equal(tenants.statusCode, 200);
  assert.equal(tenants.body.items.some((item) => item.id === createTenant.body.item.id), true);

  const csvImport = await request(app)
    .post("/api/fractions/import/csv")
    .set("Authorization", `Bearer ${auth.token}`)
    .set("x-tenant-id", auth.defaultTenantId)
    .send({
      csvText:
        "code;floor_number;type;typology;private_area_m2;permillage;monthly_fee_amount;status\nZP1;9;habitacao;T1;70;21;45;active\nZP2;9;habitacao;T2;95;28;62;active\nZP1;9;habitacao;T1;70;21;45;active",
    });
  assert.equal(csvImport.statusCode, 201);
  assert.equal(csvImport.body.insertedCount, 2);
  assert.equal(csvImport.body.skippedCount >= 1, true);

  const fractions = await request(app)
    .get("/api/fractions?q=ZP")
    .set("Authorization", `Bearer ${auth.token}`)
    .set("x-tenant-id", auth.defaultTenantId);
  assert.equal(fractions.statusCode, 200);
  assert.equal(fractions.body.items.some((item) => item.code === "ZP1"), true);
  assert.equal(fractions.body.items.some((item) => item.code === "ZP2"), true);
});

test("people, fraction parties and fraction profile are server-driven", async () => {
  const app = await createServer();
  const managerAuth = await login(app, {
    email: "gestao.demo@condoos.pt",
    password: "Condoos!Gestao2026",
  });
  const residentAuth = await login(app, {
    email: "condomino.demo@condoos.pt",
    password: "Condoos!Condomino2026",
  });

  const fractions = await request(app)
    .get("/api/fractions")
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId);
  assert.equal(fractions.statusCode, 200);
  const targetFraction = fractions.body.items[0];
  assert.equal(Boolean(targetFraction?.id), true);

  const createPerson = await request(app)
    .post("/api/people")
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId)
    .send({
      fullName: "Titular API Teste",
      roleType: "owner",
      email: "titular.api.teste@condoo.pt",
      phone: "+351910000999",
    });
  assert.equal(createPerson.statusCode, 201);
  const personId = createPerson.body.item.id;

  const createParty = await request(app)
    .post("/api/fraction-parties")
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId)
    .send({
      fractionId: targetFraction.id,
      personId,
      relationship: "owner",
      startDate: "2026-02-01",
      isPrimary: true,
    });
  assert.equal(createParty.statusCode, 201);
  assert.equal(createParty.body.item.personId, personId);
  assert.equal(createParty.body.item.isPrimary, true);

  const parties = await request(app)
    .get(`/api/fraction-parties?fractionId=${encodeURIComponent(targetFraction.id)}`)
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId);
  assert.equal(parties.statusCode, 200);
  assert.equal(parties.body.items.some((item) => item.personId === personId), true);

  const profile = await request(app)
    .get(`/api/fractions/${targetFraction.id}/profile`)
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId);
  assert.equal(profile.statusCode, 200);
  assert.equal(profile.body.item.id, targetFraction.id);
  assert.equal(Array.isArray(profile.body.item.contacts), true);
  assert.equal(profile.body.item.contacts.some((item) => item.personId === personId), true);
  assert.equal(typeof profile.body.item.summary.balance, "number");

  const managerPeople = await request(app)
    .get("/api/people")
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId);
  assert.equal(managerPeople.statusCode, 200);

  const residentPeople = await request(app)
    .get("/api/people")
    .set("Authorization", `Bearer ${residentAuth.token}`)
    .set("x-tenant-id", residentAuth.defaultTenantId);
  assert.equal(residentPeople.statusCode, 200);
  assert.equal(residentPeople.body.items.length <= managerPeople.body.items.length, true);
});

test("documents upload, versioning and download binary flow", async () => {
  const app = await createServer();
  const managerAuth = await login(app, {
    email: "gestao.demo@condoos.pt",
    password: "Condoos!Gestao2026",
  });

  const upload = await request(app)
    .post("/api/documents")
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId)
    .send({
      title: "Regulamento Interno Atualizado",
      category: "legal",
      visibility: "residents",
      mimeType: "text/plain",
      fileName: "regulamento.txt",
      contentBase64: Buffer.from("versao 1", "utf8").toString("base64"),
    });
  assert.equal(upload.statusCode, 201);
  const documentId = upload.body.item.id;
  assert.equal(Boolean(documentId), true);

  const createVersion = await request(app)
    .post(`/api/documents/${documentId}/versions`)
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId)
    .send({
      mimeType: "text/plain",
      fileName: "regulamento-v2.txt",
      contentBase64: Buffer.from("versao 2", "utf8").toString("base64"),
    });
  assert.equal(createVersion.statusCode, 201);
  assert.equal(createVersion.body.item.versionNumber, 2);

  const versions = await request(app)
    .get(`/api/documents/${documentId}/versions`)
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId);
  assert.equal(versions.statusCode, 200);
  assert.equal(versions.body.items.length >= 2, true);

  const download = await request(app)
    .get(`/api/documents/${documentId}/download`)
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId);
  assert.equal(download.statusCode, 200);
  assert.equal(String(download.headers["content-type"]).includes("text/plain"), true);
  assert.equal(Buffer.from(download.text || "").toString("utf8").includes("versao 2"), true);
});

test("payment receipt pdf endpoint and accounting export", async () => {
  const app = await createServer();
  const managerAuth = await login(app, {
    email: "gestao.demo@condoos.pt",
    password: "Condoos!Gestao2026",
  });
  const residentAuth = await login(app, {
    email: "condomino.demo@condoos.pt",
    password: "Condoos!Condomino2026",
  });

  const residentFractions = await request(app)
    .get("/api/fractions")
    .set("Authorization", `Bearer ${residentAuth.token}`)
    .set("x-tenant-id", residentAuth.defaultTenantId);
  assert.equal(residentFractions.statusCode, 200);
  const residentFractionId = residentFractions.body.items[0].id;

  const charges = await request(app)
    .get("/api/finance/charges")
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId);
  assert.equal(charges.statusCode, 200);
  const targetCharge = charges.body.items.find((item) => item.fractionId === residentFractionId);
  assert.equal(Boolean(targetCharge?.id), true);

  const payment = await request(app)
    .post("/api/finance/payments")
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId)
    .send({
      chargeId: targetCharge.id,
      amount: Math.min(Number(targetCharge.amount), 25),
      method: "bank_transfer",
      paidAt: "2026-02-15",
      reference: "PILOT-RECEIPT-001",
      source: "manual",
    });
  assert.equal(payment.statusCode, 201);
  const paymentId = payment.body.item.id;

  const managerReceipt = await request(app)
    .get(`/api/finance/payments/${paymentId}/receipt`)
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId);
  assert.equal(managerReceipt.statusCode, 200);
  assert.equal(String(managerReceipt.headers["content-type"]).includes("application/pdf"), true);
  assert.equal(String(managerReceipt.headers["content-disposition"]).includes(".pdf"), true);

  const residentReceipt = await request(app)
    .get(`/api/finance/payments/${paymentId}/receipt`)
    .set("Authorization", `Bearer ${residentAuth.token}`)
    .set("x-tenant-id", residentAuth.defaultTenantId);
  assert.equal(residentReceipt.statusCode, 200);
  assert.equal(String(residentReceipt.headers["content-type"]).includes("application/pdf"), true);

  const exportCsv = await request(app)
    .get("/api/finance/export/accounting.csv")
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId);
  assert.equal(exportCsv.statusCode, 200);
  assert.equal(String(exportCsv.headers["content-type"]).includes("text/csv"), true);
  assert.equal(String(exportCsv.text).includes("entry_id"), true);
});

test("reconciliation import and auto-match flow", async () => {
  const app = await createServer();
  const managerAuth = await login(app, {
    email: "gestao.demo@condoos.pt",
    password: "Condoos!Gestao2026",
  });

  const charges = await request(app)
    .get("/api/finance/charges")
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId);
  assert.equal(charges.statusCode, 200);
  const targetCharge = charges.body.items[0];
  const amount = Number(targetCharge.amount).toFixed(2).replace(".", ",");

  const importCsv = await request(app)
    .post("/api/finance/reconciliation/import-csv")
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId)
    .send({
      csvText: `booked_at;description;amount;reference\n2026-02-16;Pagamento reconciliação;${amount};AUTO-MATCH-001`,
    });
  assert.equal(importCsv.statusCode, 201);
  assert.equal(importCsv.body.importedCount, 1);

  const autoMatch = await request(app)
    .post("/api/finance/reconciliation/auto-match")
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId)
    .send({});
  assert.equal(autoMatch.statusCode, 200);
  assert.equal(autoMatch.body.scannedCount >= 1, true);
  assert.equal(autoMatch.body.matchedCount >= 1, true);

  const transactions = await request(app)
    .get("/api/finance/reconciliation/transactions?status=matched")
    .set("Authorization", `Bearer ${managerAuth.token}`)
    .set("x-tenant-id", managerAuth.defaultTenantId);
  assert.equal(transactions.statusCode, 200);
  assert.equal(transactions.body.items.length >= 1, true);
});

test("health endpoint includes x-request-id header", async () => {
  const app = await createServer();

  const response = await request(app).get("/health");
  assert.equal(response.statusCode, 200);
  assert.equal(typeof response.headers["x-request-id"], "string");
  assert.equal(response.headers["x-request-id"].length > 8, true);
});

test("auth rate limit blocks excessive attempts", async () => {
  const app = await createServer();

  let status = 0;
  for (let attempt = 0; attempt < 26; attempt += 1) {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: `invalid-${attempt}@condoos.pt`,
        password: "wrong-password",
      });
    status = response.statusCode;
  }

  assert.equal(status, 429);
});
