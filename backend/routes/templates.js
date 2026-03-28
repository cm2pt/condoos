import express from "express";
import crypto from "node:crypto";
import { authorize } from "../auth.js";
import { getKnex } from "../db-knex.js";
import { recordAuditLog } from "../audit.js";
import {
  TEMPLATE_KEYS,
  TEMPLATE_LABELS,
  TEMPLATE_TYPES,
  getDefaultTemplateBody,
  getDefaultTemplateSubject,
  renderPreview,
} from "../services/email/templates.js";

const router = express.Router();

/**
 * GET /templates — lista todos os templates para o tenant (inclui defaults sem override).
 */
router.get("/templates", authorize("templates", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;

  const customRows = await knex("custom_templates")
    .where({ tenant_id: tenantId })
    .select(
      "id",
      "template_key as templateKey",
      "subject_template as subjectTemplate",
      "body_template as bodyTemplate",
      "template_type as templateType",
      "is_active as isActive",
      "created_at as createdAt",
      "updated_at as updatedAt"
    );

  const customByKey = new Map(customRows.map((r) => [r.templateKey, r]));

  const items = TEMPLATE_KEYS.map((key) => {
    const custom = customByKey.get(key);
    if (custom) {
      return {
        templateKey: key,
        label: TEMPLATE_LABELS[key] || key,
        templateType: custom.templateType,
        isCustom: true,
        isActive: custom.isActive,
        subjectTemplate: custom.subjectTemplate,
        bodyTemplate: custom.bodyTemplate,
        createdAt: custom.createdAt,
        updatedAt: custom.updatedAt,
      };
    }
    return {
      templateKey: key,
      label: TEMPLATE_LABELS[key] || key,
      templateType: TEMPLATE_TYPES[key] || "email",
      isCustom: false,
      isActive: 1,
      subjectTemplate: getDefaultTemplateSubject(key),
      bodyTemplate: getDefaultTemplateBody(key),
      createdAt: null,
      updatedAt: null,
    };
  });

  return res.json({ items });
});

/**
 * GET /templates/:key — obter template específico (custom se existir, senão default).
 */
router.get("/templates/:key", authorize("templates", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const key = String(req.params.key || "").trim();

  if (!TEMPLATE_KEYS.includes(key)) {
    return res.status(400).json({ error: "Template key invalida." });
  }

  const custom = await knex("custom_templates")
    .where({ tenant_id: tenantId, template_key: key })
    .first();

  if (custom) {
    return res.json({
      item: {
        templateKey: key,
        label: TEMPLATE_LABELS[key] || key,
        templateType: custom.template_type,
        isCustom: true,
        isActive: custom.is_active,
        subjectTemplate: custom.subject_template,
        bodyTemplate: custom.body_template,
        createdAt: custom.created_at,
        updatedAt: custom.updated_at,
      },
    });
  }

  return res.json({
    item: {
      templateKey: key,
      label: TEMPLATE_LABELS[key] || key,
      templateType: TEMPLATE_TYPES[key] || "email",
      isCustom: false,
      isActive: 1,
      subjectTemplate: getDefaultTemplateSubject(key),
      bodyTemplate: getDefaultTemplateBody(key),
      createdAt: null,
      updatedAt: null,
    },
  });
});

/**
 * PUT /templates/:key — criar ou atualizar template custom (upsert).
 */
router.put("/templates/:key", authorize("templates", "update"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const key = String(req.params.key || "").trim();
  const body = req.body || {};

  if (!TEMPLATE_KEYS.includes(key)) {
    return res.status(400).json({ error: "Template key invalida." });
  }

  const bodyTemplate = String(body.bodyTemplate || "").trim();
  if (!bodyTemplate) {
    return res.status(400).json({ error: "Campo bodyTemplate e obrigatorio." });
  }

  const subjectTemplate = body.subjectTemplate != null ? String(body.subjectTemplate).trim() : null;
  const templateType = TEMPLATE_TYPES[key] || "email";
  const nowIso = new Date().toISOString();

  const existing = await knex("custom_templates")
    .where({ tenant_id: tenantId, template_key: key })
    .first();

  if (existing) {
    await knex("custom_templates")
      .where({ id: existing.id })
      .update({
        subject_template: subjectTemplate,
        body_template: bodyTemplate,
        updated_at: nowIso,
      });
  } else {
    await knex("custom_templates").insert({
      id: `tpl-${crypto.randomUUID()}`,
      tenant_id: tenantId,
      template_key: key,
      subject_template: subjectTemplate,
      body_template: bodyTemplate,
      template_type: templateType,
      is_active: 1,
      created_at: nowIso,
      updated_at: nowIso,
    });
  }

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: existing ? "template.update" : "template.create",
    entityType: "custom_template",
    entityId: key,
    after: { templateKey: key, subjectTemplate, bodyTemplate: bodyTemplate.slice(0, 200) },
  });

  const saved = await knex("custom_templates")
    .where({ tenant_id: tenantId, template_key: key })
    .first();

  return res.json({
    item: {
      templateKey: key,
      label: TEMPLATE_LABELS[key] || key,
      templateType: saved.template_type,
      isCustom: true,
      isActive: saved.is_active,
      subjectTemplate: saved.subject_template,
      bodyTemplate: saved.body_template,
      createdAt: saved.created_at,
      updatedAt: saved.updated_at,
    },
  });
});

/**
 * DELETE /templates/:key — remover template custom (reverte para default).
 */
router.delete("/templates/:key", authorize("templates", "delete"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const key = String(req.params.key || "").trim();

  if (!TEMPLATE_KEYS.includes(key)) {
    return res.status(400).json({ error: "Template key invalida." });
  }

  const existing = await knex("custom_templates")
    .where({ tenant_id: tenantId, template_key: key })
    .first();

  if (!existing) {
    return res.status(404).json({ error: "Template personalizado nao encontrado." });
  }

  await knex("custom_templates").where({ id: existing.id }).del();

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "template.delete",
    entityType: "custom_template",
    entityId: key,
    before: { templateKey: key },
  });

  return res.json({
    item: {
      templateKey: key,
      label: TEMPLATE_LABELS[key] || key,
      templateType: TEMPLATE_TYPES[key] || "email",
      isCustom: false,
      isActive: 1,
      subjectTemplate: getDefaultTemplateSubject(key),
      bodyTemplate: getDefaultTemplateBody(key),
      createdAt: null,
      updatedAt: null,
    },
  });
});

/**
 * POST /templates/:key/preview — pré-visualizar template com variáveis de exemplo.
 */
router.post("/templates/:key/preview", authorize("templates", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const key = String(req.params.key || "").trim();
  const body = req.body || {};
  const variables = body.variables || {};

  if (!TEMPLATE_KEYS.includes(key)) {
    return res.status(400).json({ error: "Template key invalida." });
  }

  // Check if custom template exists
  const custom = await knex("custom_templates")
    .where({ tenant_id: tenantId, template_key: key, is_active: 1 })
    .first();

  if (custom) {
    const preview = renderPreview(custom.subject_template, custom.body_template, variables);
    return res.json({ preview });
  }

  // Use default template with the provided variables
  const defaultBody = getDefaultTemplateBody(key);
  const defaultSubject = getDefaultTemplateSubject(key);

  if (!defaultBody && !defaultSubject) {
    return res.status(404).json({ error: "Template nao encontrado." });
  }

  // For default templates, render the body by interpolating variables into the placeholder version
  const preview = renderPreview(defaultSubject, defaultBody, variables);
  return res.json({ preview });
});

export default router;
