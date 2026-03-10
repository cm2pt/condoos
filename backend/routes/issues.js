import { Router } from "express";
import {
  ISSUE_STATUS_FLOW,
  ISSUE_PRIORITY_VALUES,
  toNumber,
  getAllowedFractionIdsForRequest,
  requireResidentFractionAccess,
} from "../helpers.js";
import { authorize } from "../auth.js";
import { getKnex } from "../db-knex.js";
import { recordAuditLog } from "../audit.js";
import crypto from "node:crypto";

const router = Router();

router.get("/issues", authorize("issues", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const allowedFractionIds = await getAllowedFractionIdsForRequest(req);
  const status = String(req.query.status || "").trim();
  const priority = String(req.query.priority || "").trim();

  if (allowedFractionIds && allowedFractionIds.length === 0) {
    return res.json({ items: [] });
  }

  let q = knex("issues")
    .where("tenant_id", tenantId)
    .select(
      "id",
      "tenant_id as tenantId",
      "fraction_id as fractionId",
      "created_by_person_id as createdByPersonId",
      "assigned_supplier_person_id as assignedSupplierPersonId",
      "category",
      "priority",
      "status",
      "title",
      "description",
      "opened_at as openedAt",
      "closed_at as closedAt"
    );

  if (allowedFractionIds) {
    q = q.whereIn("fraction_id", allowedFractionIds);
  }

  if (status) {
    q = q.where("status", status);
  }

  if (priority) {
    q = q.where("priority", priority);
  }

  const items = await q.orderBy("opened_at", "desc");
  res.json({ items });
});

router.post("/issues", authorize("issues", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const body = req.body || {};
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();

  if (!title || !description) {
    return res.status(400).json({ error: "Campos title e description sao obrigatorios." });
  }

  const status = String(body.status || "new");
  if (!ISSUE_STATUS_FLOW.includes(status)) {
    return res.status(400).json({ error: "Status de ocorrencia invalido." });
  }

  const priority = String(body.priority || "medium");
  if (!ISSUE_PRIORITY_VALUES.includes(priority)) {
    return res.status(400).json({ error: "Prioridade de ocorrencia invalida." });
  }

  const requestedFractionId = body.fractionId ? String(body.fractionId).trim() : "";
  const fractionId = requestedFractionId || null;

  const residentScopeCheck = await requireResidentFractionAccess(req, fractionId);
  if (!residentScopeCheck.ok) {
    return res.status(residentScopeCheck.status).json({ error: residentScopeCheck.error });
  }

  if (fractionId) {
    const fraction = await knex("fractions")
      .where({ id: fractionId, tenant_id: tenantId })
      .select("id")
      .first();

    if (!fraction) {
      return res.status(404).json({ error: "Fracao nao encontrada no condominio atual." });
    }
  }

  const issue = {
    id: `issue-${crypto.randomUUID()}`,
    tenantId,
    fractionId,
    createdByPersonId: body.createdByPersonId ? String(body.createdByPersonId) : null,
    assignedSupplierPersonId: body.assignedSupplierPersonId ? String(body.assignedSupplierPersonId) : null,
    category: String(body.category || "geral"),
    priority,
    status,
    title,
    description,
    openedAt: new Date().toISOString(),
    closedAt: null,
  };

  await knex("issues").insert({
    id: issue.id,
    tenant_id: issue.tenantId,
    fraction_id: issue.fractionId,
    created_by_person_id: issue.createdByPersonId,
    assigned_supplier_person_id: issue.assignedSupplierPersonId,
    category: issue.category,
    priority: issue.priority,
    status: issue.status,
    title: issue.title,
    description: issue.description,
    opened_at: issue.openedAt,
    closed_at: issue.closedAt,
    created_at: issue.openedAt,
    updated_at: issue.openedAt,
  });

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "issue.create",
    entityType: "issue",
    entityId: issue.id,
    after: issue,
  });

  res.status(201).json({ item: issue });
});

router.patch("/issues/:issueId/status", authorize("issues", "update"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const issueId = String(req.params.issueId || "").trim();
  const status = String(req.body?.status || "").trim();

  if (!ISSUE_STATUS_FLOW.includes(status)) {
    return res.status(400).json({ error: "Status de ocorrencia invalido." });
  }

  const issue = await knex("issues")
    .where({ id: issueId, tenant_id: tenantId })
    .select("id", "status", "closed_at")
    .first();
  if (!issue) {
    return res.status(404).json({ error: "Ocorrencia nao encontrada." });
  }

  const nowIso = new Date().toISOString();
  const closedAt = status === "resolved" || status === "closed" ? nowIso : null;

  await knex("issues")
    .where({ id: issueId, tenant_id: tenantId })
    .update({
      status,
      closed_at: closedAt,
      updated_at: nowIso,
    });

  const updated = await knex("issues")
    .where({ id: issueId, tenant_id: tenantId })
    .select(
      "id",
      "tenant_id as tenantId",
      "fraction_id as fractionId",
      "created_by_person_id as createdByPersonId",
      "assigned_supplier_person_id as assignedSupplierPersonId",
      "category",
      "priority",
      "status",
      "title",
      "description",
      "opened_at as openedAt",
      "closed_at as closedAt"
    )
    .first();

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "issue.status.update",
    entityType: "issue",
    entityId: issueId,
    before: issue,
    after: updated,
    metadata: {
      allowedStatuses: ISSUE_STATUS_FLOW,
    },
  });

  res.json({ item: updated });
});

// ── Issue full update (PATCH) ──────────────────────────────────────────
router.patch("/issues/:issueId", authorize("issues", "update"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const issueId = String(req.params.issueId || "").trim();
  const body = req.body || {};

  const issue = await knex("issues")
    .where({ id: issueId, tenant_id: tenantId })
    .first();
  if (!issue) {
    return res.status(404).json({ error: "Ocorrencia nao encontrada." });
  }

  const updates = {};
  if (body.title !== undefined) updates.title = String(body.title).trim();
  if (body.description !== undefined) updates.description = String(body.description).trim();
  if (body.category !== undefined) updates.category = String(body.category).trim();
  if (body.priority !== undefined) {
    if (!ISSUE_PRIORITY_VALUES.includes(body.priority)) {
      return res.status(400).json({ error: "Prioridade invalida." });
    }
    updates.priority = body.priority;
  }
  if (body.assignedSupplierPersonId !== undefined) {
    updates.assigned_supplier_person_id = body.assignedSupplierPersonId || null;
  }
  if (body.fractionId !== undefined) {
    updates.fraction_id = body.fractionId || null;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "Nenhum campo para atualizar." });
  }

  updates.updated_at = new Date().toISOString();

  await knex("issues").where({ id: issueId, tenant_id: tenantId }).update(updates);

  const updated = await knex("issues")
    .where({ id: issueId, tenant_id: tenantId })
    .select("id", "tenant_id as tenantId", "fraction_id as fractionId",
      "created_by_person_id as createdByPersonId", "assigned_supplier_person_id as assignedSupplierPersonId",
      "category", "priority", "status", "title", "description",
      "opened_at as openedAt", "closed_at as closedAt")
    .first();

  await recordAuditLog({
    tenantId, actorUserId: req.user.id, action: "issue.update",
    entityType: "issue", entityId: issueId, before: issue, after: updated,
  });

  res.json({ item: updated });
});

// ── Issue comments ─────────────────────────────────────────────────────
router.get("/issues/:issueId/comments", authorize("issues", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const issueId = String(req.params.issueId).trim();

  const comments = await knex("issue_comments")
    .where({ tenant_id: tenantId, issue_id: issueId })
    .select("id", "issue_id as issueId", "author_user_id as authorUserId", "body", "created_at as createdAt")
    .orderBy("created_at", "asc");

  res.json({ items: comments });
});

router.post("/issues/:issueId/comments", authorize("issues", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const issueId = String(req.params.issueId).trim();
  const body = String(req.body?.body || "").trim();

  if (!body) {
    return res.status(400).json({ error: "Campo body e obrigatorio." });
  }

  const issue = await knex("issues").where({ id: issueId, tenant_id: tenantId }).select("id").first();
  if (!issue) {
    return res.status(404).json({ error: "Ocorrencia nao encontrada." });
  }

  const comment = {
    id: `comment-${crypto.randomUUID()}`,
    tenant_id: tenantId,
    issue_id: issueId,
    author_user_id: req.user.id,
    body,
    created_at: new Date().toISOString(),
  };

  await knex("issue_comments").insert(comment);

  res.status(201).json({
    item: { id: comment.id, issueId, authorUserId: req.user.id, body, createdAt: comment.created_at },
  });
});

// ── Work orders ────────────────────────────────────────────────────────
router.get("/issues/:issueId/work-orders", authorize("issues", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const issueId = String(req.params.issueId).trim();

  const items = await knex("work_orders")
    .where({ tenant_id: tenantId, issue_id: issueId })
    .select("id", "issue_id as issueId", "supplier_person_id as supplierPersonId",
      "description", "status", "estimated_cost as estimatedCost", "final_cost as finalCost",
      "scheduled_at as scheduledAt", "completed_at as completedAt",
      "created_at as createdAt", "updated_at as updatedAt")
    .orderBy("created_at", "desc");

  res.json({ items });
});

router.post("/issues/:issueId/work-orders", authorize("issues", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const issueId = String(req.params.issueId).trim();
  const body = req.body || {};

  const issue = await knex("issues").where({ id: issueId, tenant_id: tenantId }).select("id").first();
  if (!issue) {
    return res.status(404).json({ error: "Ocorrencia nao encontrada." });
  }

  const description = String(body.description || "").trim();
  if (!description) {
    return res.status(400).json({ error: "Campo description e obrigatorio." });
  }

  const wo = {
    id: `wo-${crypto.randomUUID()}`,
    tenant_id: tenantId,
    issue_id: issueId,
    supplier_person_id: body.supplierPersonId || null,
    description,
    status: "pending",
    estimated_cost: toNumber(body.estimatedCost, null),
    final_cost: null,
    scheduled_at: body.scheduledAt || null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await knex("work_orders").insert(wo);

  await recordAuditLog({
    tenantId, actorUserId: req.user.id, action: "work_order.create",
    entityType: "work_order", entityId: wo.id, after: wo,
  });

  res.status(201).json({
    item: {
      id: wo.id, issueId, supplierPersonId: wo.supplier_person_id,
      description, status: wo.status, estimatedCost: wo.estimated_cost,
      finalCost: wo.final_cost, scheduledAt: wo.scheduled_at,
      completedAt: wo.completed_at, createdAt: wo.created_at, updatedAt: wo.updated_at,
    },
  });
});

router.patch("/issues/:issueId/work-orders/:workOrderId", authorize("issues", "update"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const { issueId, workOrderId } = req.params;
  const body = req.body || {};

  const wo = await knex("work_orders")
    .where({ id: workOrderId, tenant_id: tenantId, issue_id: issueId })
    .first();
  if (!wo) {
    return res.status(404).json({ error: "Ordem de trabalho nao encontrada." });
  }

  const updates = {};
  if (body.description !== undefined) updates.description = String(body.description).trim();
  if (body.status !== undefined) updates.status = String(body.status).trim();
  if (body.estimatedCost !== undefined) updates.estimated_cost = toNumber(body.estimatedCost, null);
  if (body.finalCost !== undefined) updates.final_cost = toNumber(body.finalCost, null);
  if (body.scheduledAt !== undefined) updates.scheduled_at = body.scheduledAt || null;
  if (body.completedAt !== undefined) updates.completed_at = body.completedAt || null;
  updates.updated_at = new Date().toISOString();

  await knex("work_orders").where({ id: workOrderId, tenant_id: tenantId }).update(updates);

  const updated = await knex("work_orders")
    .where({ id: workOrderId, tenant_id: tenantId })
    .select("id", "issue_id as issueId", "supplier_person_id as supplierPersonId",
      "description", "status", "estimated_cost as estimatedCost", "final_cost as finalCost",
      "scheduled_at as scheduledAt", "completed_at as completedAt",
      "created_at as createdAt", "updated_at as updatedAt")
    .first();

  res.json({ item: updated });
});

export default router;
