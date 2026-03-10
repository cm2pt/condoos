import express from "express";
import crypto from "node:crypto";
import { authorize } from "../auth.js";
import { getKnex } from "../db-knex.js";
import { recordAuditLog } from "../audit.js";
import { TENANT_MANAGEMENT_TYPE_VALUES, firstDefinedValue } from "../helpers.js";

const router = express.Router();

router.get("/tenants", authorize("tenants", "read"), (req, res) => {
  res.json({ items: req.tenants });
});

router.post("/tenants", authorize("tenants", "create"), async (req, res) => {
  const knex = getKnex();
  const body = req.body || {};
  const name = String(body.name || "").trim();

  if (!name) {
    return res.status(400).json({ error: "Campo name e obrigatorio." });
  }

  const tenant = {
    id: `condo-${crypto.randomUUID()}`,
    name,
    taxNumber: String(body.taxNumber || "").trim() || null,
    address: String(body.address || "").trim() || null,
    postalCode: String(body.postalCode || "").trim() || null,
    city: String(body.city || "").trim() || null,
    country: String(body.country || "Portugal").trim() || "Portugal",
    managementType: String(body.managementType || "professional").trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!TENANT_MANAGEMENT_TYPE_VALUES.includes(tenant.managementType)) {
    return res.status(400).json({ error: "managementType invalido." });
  }

  await knex.transaction(async (trx) => {
    await trx("tenants").insert({
      id: tenant.id,
      name: tenant.name,
      tax_number: tenant.taxNumber,
      address: tenant.address,
      postal_code: tenant.postalCode,
      city: tenant.city,
      country: tenant.country,
      management_type: tenant.managementType,
      created_at: tenant.createdAt,
      updated_at: tenant.updatedAt,
    });

    await trx("user_tenants")
      .insert({ user_id: req.user.id, tenant_id: tenant.id })
      .onConflict(["user_id", "tenant_id"])
      .ignore();
  });

  await recordAuditLog({
    tenantId: tenant.id,
    actorUserId: req.user.id,
    action: "tenant.create",
    entityType: "tenant",
    entityId: tenant.id,
    after: tenant,
  });

  return res.status(201).json({ item: tenant });
});

router.patch("/tenants/:tenantId", authorize("tenants", "update"), async (req, res) => {
  const knex = getKnex();
  const tenantId = String(req.params.tenantId || "").trim();
  const body = req.body || {};

  if (!tenantId) {
    return res.status(400).json({ error: "tenantId invalido." });
  }

  const membership = req.tenants.find((tenant) => tenant.id === tenantId);
  if (!membership) {
    return res.status(403).json({ error: "Sem acesso ao condominio pedido." });
  }

  const tenantCols = ["id", "name", "tax_number as taxNumber", "address", "postal_code as postalCode", "city", "country", "management_type as managementType"];
  const current = await knex("tenants").where({ id: tenantId }).select(tenantCols).first();
  if (!current) {
    return res.status(404).json({ error: "Condominio nao encontrado." });
  }

  const next = {
    ...current,
    name: firstDefinedValue([body.name, current.name]),
    taxNumber: firstDefinedValue([body.taxNumber, current.taxNumber]) || null,
    address: firstDefinedValue([body.address, current.address]) || null,
    postalCode: firstDefinedValue([body.postalCode, current.postalCode]) || null,
    city: firstDefinedValue([body.city, current.city]) || null,
    country: firstDefinedValue([body.country, current.country]) || null,
    managementType: firstDefinedValue([body.managementType, current.managementType]),
    updatedAt: new Date().toISOString(),
  };

  if (!next.name) {
    return res.status(400).json({ error: "Campo name e obrigatorio." });
  }

  if (!TENANT_MANAGEMENT_TYPE_VALUES.includes(String(next.managementType || "").trim())) {
    return res.status(400).json({ error: "managementType invalido." });
  }

  await knex("tenants").where({ id: tenantId }).update({
    name: String(next.name).trim(),
    tax_number: next.taxNumber,
    address: next.address,
    postal_code: next.postalCode,
    city: next.city,
    country: next.country,
    management_type: String(next.managementType).trim(),
    updated_at: next.updatedAt,
  });

  const updated = await knex("tenants").where({ id: tenantId }).select(tenantCols).first();

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "tenant.update",
    entityType: "tenant",
    entityId: tenantId,
    before: current,
    after: updated,
  });

  return res.json({ item: updated });
});

export default router;
