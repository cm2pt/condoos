import { Router } from "express";
import {
  toNumber,
  toIsoDate,
  toBool,
  firstDefinedValue,
  normalizeEmail,
  PERSON_ROLE_VALUES,
  FRACTION_PARTY_RELATIONSHIP_VALUES,
  getAllowedFractionIdsForRequest,
  getScopedPeopleIdsForResident,
  clearPrimaryOwnerForFraction,
  readFractionById,
  readPersonById,
} from "../helpers.js";
import { authorize } from "../auth.js";
import { getKnex } from "../db-knex.js";
import { recordAuditLog } from "../audit.js";
import crypto from "node:crypto";

const router = Router();

router.get("/people", authorize("people", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const roleType = String(req.query.roleType || "").trim().toLowerCase();
  const query = String(req.query.q || "").trim().toLowerCase();
  const allowedFractionIds = await getAllowedFractionIdsForRequest(req);

  if (roleType && !PERSON_ROLE_VALUES.includes(roleType)) {
    return res.status(400).json({ error: "roleType invalido." });
  }

  if (allowedFractionIds && allowedFractionIds.length === 0) {
    return res.json({ items: [] });
  }

  let q = knex("people as p")
    .where("p.tenant_id", tenantId)
    .select(
      "p.id",
      "p.tenant_id as tenantId",
      "p.full_name as fullName",
      "p.role_type as roleType",
      "p.tax_number as taxNumber",
      "p.email",
      "p.phone"
    );

  if (allowedFractionIds) {
    const allowedPeopleIds = await getScopedPeopleIdsForResident(tenantId, allowedFractionIds);
    if (allowedPeopleIds.length === 0) {
      return res.json({ items: [] });
    }
    q = q.whereIn("p.id", allowedPeopleIds);
  }

  if (roleType) {
    q = q.where("p.role_type", roleType);
  }
  if (query) {
    q = q.where(function () {
      this.whereRaw("LOWER(p.full_name) LIKE ?", [`%${query}%`])
        .orWhereRaw("LOWER(COALESCE(p.email, '')) LIKE ?", [`%${query}%`]);
    });
  }

  const items = await q.orderBy("p.full_name", "asc");
  return res.json({ items });
});

router.post("/people", authorize("people", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const body = req.body || {};
  const fullName = String(body.fullName || "").trim();
  const roleType = String(body.roleType || "").trim().toLowerCase();

  if (!fullName) {
    return res.status(400).json({ error: "Campo fullName e obrigatorio." });
  }
  if (!PERSON_ROLE_VALUES.includes(roleType)) {
    return res.status(400).json({ error: "roleType invalido." });
  }

  const person = {
    id: `person-${crypto.randomUUID()}`,
    tenantId,
    fullName,
    roleType,
    taxNumber: String(body.taxNumber || "").trim() || null,
    email: normalizeEmail(body.email) || null,
    phone: String(body.phone || "").trim() || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await knex("people").insert({
    id: person.id,
    tenant_id: person.tenantId,
    full_name: person.fullName,
    role_type: person.roleType,
    tax_number: person.taxNumber,
    email: person.email,
    phone: person.phone,
    created_at: person.createdAt,
    updated_at: person.updatedAt,
  });

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "person.create",
    entityType: "person",
    entityId: person.id,
    after: person,
  });

  return res.status(201).json({ item: person });
});

router.patch("/people/:personId", authorize("people", "update"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const personId = String(req.params.personId || "").trim();
  const body = req.body || {};
  const current = await readPersonById(tenantId, personId);

  if (!current) {
    return res.status(404).json({ error: "Pessoa nao encontrada." });
  }

  const next = {
    ...current,
    fullName: firstDefinedValue([body.fullName, current.fullName]),
    roleType: String(firstDefinedValue([body.roleType, current.roleType]) || "")
      .trim()
      .toLowerCase(),
    taxNumber: firstDefinedValue([body.taxNumber, current.taxNumber]) || null,
    email: normalizeEmail(firstDefinedValue([body.email, current.email])) || null,
    phone: firstDefinedValue([body.phone, current.phone]) || null,
    updatedAt: new Date().toISOString(),
  };

  if (!next.fullName || !PERSON_ROLE_VALUES.includes(next.roleType)) {
    return res.status(400).json({ error: "Dados da pessoa invalidos." });
  }

  await knex("people")
    .where({ id: personId, tenant_id: tenantId })
    .update({
      full_name: next.fullName,
      role_type: next.roleType,
      tax_number: next.taxNumber,
      email: next.email,
      phone: next.phone,
      updated_at: next.updatedAt,
    });

  const updated = await readPersonById(tenantId, personId);
  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "person.update",
    entityType: "person",
    entityId: personId,
    before: current,
    after: updated,
  });

  return res.json({ item: updated });
});

router.delete("/people/:personId", authorize("people", "delete"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const personId = String(req.params.personId || "").trim();
  const current = await readPersonById(tenantId, personId);

  if (!current) {
    return res.status(404).json({ error: "Pessoa nao encontrada." });
  }

  await knex("people").where({ id: personId, tenant_id: tenantId }).del();

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "person.delete",
    entityType: "person",
    entityId: personId,
    before: current,
  });

  return res.status(204).send();
});

router.get("/fraction-parties", authorize("people", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const fractionId = String(req.query.fractionId || "").trim();
  const allowedFractionIds = await getAllowedFractionIdsForRequest(req);

  if (allowedFractionIds && allowedFractionIds.length === 0) {
    return res.json({ items: [] });
  }

  let q = knex("fraction_parties as fp")
    .join("people as p", "p.id", "fp.person_id")
    .where("fp.tenant_id", tenantId)
    .select(
      "fp.id",
      "fp.tenant_id as tenantId",
      "fp.fraction_id as fractionId",
      "fp.person_id as personId",
      "fp.relationship",
      "fp.start_date as startDate",
      "fp.end_date as endDate",
      "fp.is_primary as isPrimary",
      "p.full_name as personFullName",
      "p.role_type as personRoleType"
    );

  if (allowedFractionIds) {
    q = q.whereIn("fp.fraction_id", allowedFractionIds);
  }

  if (fractionId) {
    if (allowedFractionIds && !allowedFractionIds.includes(fractionId)) {
      return res.status(403).json({ error: "Sem acesso a fracao selecionada." });
    }
    q = q.where("fp.fraction_id", fractionId);
  }

  const rawItems = await q.orderBy([
    { column: "fp.fraction_id", order: "asc" },
    { column: "fp.is_primary", order: "desc" },
    { column: "fp.relationship", order: "asc" },
  ]);
  const items = rawItems.map((item) => ({
    ...item,
    isPrimary: Number(item.isPrimary) === 1,
  }));
  return res.json({ items });
});

router.post("/fraction-parties", authorize("people", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const body = req.body || {};
  const fractionId = String(body.fractionId || "").trim();
  const personId = String(body.personId || "").trim();
  const relationship = String(body.relationship || "").trim().toLowerCase();
  const startDate = toIsoDate(body.startDate || new Date().toISOString());
  const endDateRaw = String(body.endDate || "").trim();
  const endDate = endDateRaw ? toIsoDate(endDateRaw) : null;
  const isPrimary = toBool(body.isPrimary, false);

  if (!fractionId || !personId) {
    return res.status(400).json({ error: "fractionId e personId sao obrigatorios." });
  }
  if (!FRACTION_PARTY_RELATIONSHIP_VALUES.includes(relationship)) {
    return res.status(400).json({ error: "relationship invalido." });
  }

  const fraction = await readFractionById(tenantId, fractionId);
  if (!fraction) {
    return res.status(404).json({ error: "Fracao nao encontrada no condominio atual." });
  }
  const person = await readPersonById(tenantId, personId);
  if (!person) {
    return res.status(404).json({ error: "Pessoa nao encontrada no condominio atual." });
  }

  const relation = {
    id: `fp-${crypto.randomUUID()}`,
    tenantId,
    fractionId,
    personId,
    relationship,
    startDate,
    endDate,
    isPrimary,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await knex.transaction(async (trx) => {
    if (relation.relationship === "owner" && relation.isPrimary && !relation.endDate) {
      await clearPrimaryOwnerForFraction(tenantId, fractionId, null, trx);
    }

    await trx("fraction_parties").insert({
      id: relation.id,
      tenant_id: relation.tenantId,
      fraction_id: relation.fractionId,
      person_id: relation.personId,
      relationship: relation.relationship,
      start_date: relation.startDate,
      end_date: relation.endDate,
      is_primary: relation.isPrimary ? 1 : 0,
      created_at: relation.createdAt,
      updated_at: relation.updatedAt,
    });
  });

  const created = await knex("fraction_parties as fp")
    .join("people as p", "p.id", "fp.person_id")
    .where("fp.id", relation.id)
    .where("fp.tenant_id", tenantId)
    .select(
      "fp.id",
      "fp.tenant_id as tenantId",
      "fp.fraction_id as fractionId",
      "fp.person_id as personId",
      "fp.relationship",
      "fp.start_date as startDate",
      "fp.end_date as endDate",
      "fp.is_primary as isPrimary",
      "p.full_name as personFullName",
      "p.role_type as personRoleType"
    )
    .first();

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "fraction_party.create",
    entityType: "fraction_party",
    entityId: relation.id,
    after: {
      ...created,
      isPrimary: Number(created?.isPrimary) === 1,
    },
  });

  return res.status(201).json({
    item: {
      ...created,
      isPrimary: Number(created?.isPrimary) === 1,
    },
  });
});

router.patch("/fraction-parties/:partyId", authorize("people", "update"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const partyId = String(req.params.partyId || "").trim();
  const body = req.body || {};

  const current = await knex("fraction_parties")
    .where({ id: partyId, tenant_id: tenantId })
    .select(
      "id",
      "tenant_id as tenantId",
      "fraction_id as fractionId",
      "person_id as personId",
      "relationship",
      "start_date as startDate",
      "end_date as endDate",
      "is_primary as isPrimary"
    )
    .first();

  if (!current) {
    return res.status(404).json({ error: "Associacao nao encontrada." });
  }

  const next = {
    ...current,
    fractionId: String(firstDefinedValue([body.fractionId, current.fractionId]) || "").trim(),
    personId: String(firstDefinedValue([body.personId, current.personId]) || "").trim(),
    relationship: String(firstDefinedValue([body.relationship, current.relationship]) || "")
      .trim()
      .toLowerCase(),
    startDate: toIsoDate(firstDefinedValue([body.startDate, current.startDate]) || new Date().toISOString()),
    endDate: firstDefinedValue([body.endDate, current.endDate])
      ? toIsoDate(firstDefinedValue([body.endDate, current.endDate]))
      : null,
    isPrimary: toBool(firstDefinedValue([body.isPrimary, Number(current.isPrimary) === 1]), Number(current.isPrimary) === 1),
    updatedAt: new Date().toISOString(),
  };

  if (!next.fractionId || !next.personId || !FRACTION_PARTY_RELATIONSHIP_VALUES.includes(next.relationship)) {
    return res.status(400).json({ error: "Dados da associacao invalidos." });
  }

  const fraction = await readFractionById(tenantId, next.fractionId);
  if (!fraction) {
    return res.status(404).json({ error: "Fracao nao encontrada." });
  }
  const person = await readPersonById(tenantId, next.personId);
  if (!person) {
    return res.status(404).json({ error: "Pessoa nao encontrada." });
  }

  await knex.transaction(async (trx) => {
    if (next.relationship === "owner" && next.isPrimary && !next.endDate) {
      await clearPrimaryOwnerForFraction(tenantId, next.fractionId, partyId, trx);
    }

    await trx("fraction_parties")
      .where({ id: partyId, tenant_id: tenantId })
      .update({
        fraction_id: next.fractionId,
        person_id: next.personId,
        relationship: next.relationship,
        start_date: next.startDate,
        end_date: next.endDate,
        is_primary: next.isPrimary ? 1 : 0,
        updated_at: next.updatedAt,
      });
  });

  const updated = await knex("fraction_parties as fp")
    .join("people as p", "p.id", "fp.person_id")
    .where("fp.id", partyId)
    .where("fp.tenant_id", tenantId)
    .select(
      "fp.id",
      "fp.tenant_id as tenantId",
      "fp.fraction_id as fractionId",
      "fp.person_id as personId",
      "fp.relationship",
      "fp.start_date as startDate",
      "fp.end_date as endDate",
      "fp.is_primary as isPrimary",
      "p.full_name as personFullName",
      "p.role_type as personRoleType"
    )
    .first();

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "fraction_party.update",
    entityType: "fraction_party",
    entityId: partyId,
    before: {
      ...current,
      isPrimary: Number(current.isPrimary) === 1,
    },
    after: {
      ...updated,
      isPrimary: Number(updated?.isPrimary) === 1,
    },
  });

  return res.json({
    item: {
      ...updated,
      isPrimary: Number(updated?.isPrimary) === 1,
    },
  });
});

router.delete("/fraction-parties/:partyId", authorize("people", "delete"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const partyId = String(req.params.partyId || "").trim();

  const current = await knex("fraction_parties")
    .where({ id: partyId, tenant_id: tenantId })
    .select(
      "id",
      "tenant_id as tenantId",
      "fraction_id as fractionId",
      "person_id as personId",
      "relationship",
      "start_date as startDate",
      "end_date as endDate",
      "is_primary as isPrimary"
    )
    .first();
  if (!current) {
    return res.status(404).json({ error: "Associacao nao encontrada." });
  }

  await knex("fraction_parties").where({ id: partyId, tenant_id: tenantId }).del();

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "fraction_party.delete",
    entityType: "fraction_party",
    entityId: partyId,
    before: {
      ...current,
      isPrimary: Number(current.isPrimary) === 1,
    },
  });

  return res.status(204).send();
});

export default router;
