import express from "express";
import { ASSEMBLY_STATUS_VALUES } from "../helpers.js";
import { authorize } from "../auth.js";
import { getKnex } from "../db-knex.js";
import { recordAuditLog } from "../audit.js";
import { sendNotification } from "../services/email/index.js";

const router = express.Router();

router.get("/assemblies", authorize("assemblies", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const status = String(req.query.status || "").trim();

  let q = knex("assemblies")
    .where("tenant_id", tenantId)
    .select("id", "tenant_id as tenantId", "meeting_type as meetingType",
      "scheduled_at as scheduledAt", "location", "call_notice_sent_at as callNoticeSentAt",
      "minutes_document_id as minutesDocumentId", "status",
      "vote_items_json as voteItemsJson",
      "created_at as createdAt", "updated_at as updatedAt")
    .orderBy("scheduled_at", "desc");

  if (status) q = q.where("status", status);

  const items = await q;
  res.json({
    items: items.map((a) => ({
      ...a,
      voteItems: a.voteItemsJson ? JSON.parse(a.voteItemsJson) : [],
      voteItemsJson: undefined,
    })),
  });
});

router.post("/assemblies", authorize("assemblies", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const body = req.body || {};

  const meetingType = String(body.meetingType || "ordinary").trim();
  const scheduledAt = String(body.scheduledAt || "").trim();
  const location = String(body.location || "").trim();

  if (!scheduledAt || !location) {
    return res.status(400).json({ error: "Campos scheduledAt e location sao obrigatorios." });
  }

  const nowIso = new Date().toISOString();
  const assembly = {
    id: `assembly-${crypto.randomUUID()}`,
    tenant_id: tenantId,
    meeting_type: meetingType,
    scheduled_at: scheduledAt,
    location,
    call_notice_sent_at: null,
    minutes_document_id: null,
    status: "scheduled",
    vote_items_json: body.voteItems ? JSON.stringify(body.voteItems) : null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  await knex("assemblies").insert(assembly);

  await recordAuditLog({
    tenantId, actorUserId: req.user.id, action: "assembly.create",
    entityType: "assembly", entityId: assembly.id, after: assembly,
  });

  res.status(201).json({
    item: {
      id: assembly.id, tenantId, meetingType, scheduledAt, location,
      callNoticeSentAt: null, minutesDocumentId: null, status: "scheduled",
      voteItems: body.voteItems || [], createdAt: nowIso, updatedAt: nowIso,
    },
  });
});

router.patch("/assemblies/:assemblyId", authorize("assemblies", "update"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const assemblyId = String(req.params.assemblyId).trim();
  const body = req.body || {};

  const assembly = await knex("assemblies")
    .where({ id: assemblyId, tenant_id: tenantId }).first();
  if (!assembly) {
    return res.status(404).json({ error: "Assembleia nao encontrada." });
  }

  const updates = {};
  if (body.meetingType !== undefined) updates.meeting_type = String(body.meetingType).trim();
  if (body.scheduledAt !== undefined) updates.scheduled_at = String(body.scheduledAt).trim();
  if (body.location !== undefined) updates.location = String(body.location).trim();
  if (body.status !== undefined) {
    if (!ASSEMBLY_STATUS_VALUES.includes(body.status)) {
      return res.status(400).json({ error: "Status de assembleia invalido." });
    }
    updates.status = body.status;
  }
  if (body.voteItems !== undefined) updates.vote_items_json = JSON.stringify(body.voteItems);
  if (body.minutesDocumentId !== undefined) updates.minutes_document_id = body.minutesDocumentId || null;
  updates.updated_at = new Date().toISOString();

  await knex("assemblies").where({ id: assemblyId, tenant_id: tenantId }).update(updates);

  const updated = await knex("assemblies")
    .where({ id: assemblyId, tenant_id: tenantId })
    .select("id", "tenant_id as tenantId", "meeting_type as meetingType",
      "scheduled_at as scheduledAt", "location", "call_notice_sent_at as callNoticeSentAt",
      "minutes_document_id as minutesDocumentId", "status",
      "vote_items_json as voteItemsJson",
      "created_at as createdAt", "updated_at as updatedAt")
    .first();

  await recordAuditLog({
    tenantId, actorUserId: req.user.id, action: "assembly.update",
    entityType: "assembly", entityId: assemblyId, before: assembly, after: updated,
  });

  res.json({
    item: {
      ...updated,
      voteItems: updated.voteItemsJson ? JSON.parse(updated.voteItemsJson) : [],
      voteItemsJson: undefined,
    },
  });
});

// ── Assembly attendees ─────────────────────────────────────────────────
router.get("/assemblies/:assemblyId/attendees", authorize("assemblies", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const assemblyId = String(req.params.assemblyId).trim();

  const items = await knex("assembly_attendees as aa")
    .join("people as p", "p.id", "aa.person_id")
    .where({ "aa.tenant_id": tenantId, "aa.assembly_id": assemblyId })
    .select("aa.id", "aa.assembly_id as assemblyId", "aa.person_id as personId",
      "p.name as personName", "aa.representation_type as representationType",
      "aa.proxy_document_id as proxyDocumentId", "aa.presence_status as presenceStatus",
      "aa.created_at as createdAt")
    .orderBy("p.name", "asc");

  res.json({ items });
});

router.post("/assemblies/:assemblyId/attendees", authorize("assemblies", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const assemblyId = String(req.params.assemblyId).trim();
  const body = req.body || {};
  const personId = String(body.personId || "").trim();

  if (!personId) {
    return res.status(400).json({ error: "Campo personId e obrigatorio." });
  }

  const assembly = await knex("assemblies").where({ id: assemblyId, tenant_id: tenantId }).select("id").first();
  if (!assembly) {
    return res.status(404).json({ error: "Assembleia nao encontrada." });
  }

  const person = await knex("people").where({ id: personId, tenant_id: tenantId }).select("id", "name").first();
  if (!person) {
    return res.status(404).json({ error: "Pessoa nao encontrada." });
  }

  const existing = await knex("assembly_attendees")
    .where({ assembly_id: assemblyId, person_id: personId }).first();
  if (existing) {
    return res.status(409).json({ error: "Pessoa ja registada nesta assembleia." });
  }

  const attendee = {
    id: `attendee-${crypto.randomUUID()}`,
    tenant_id: tenantId,
    assembly_id: assemblyId,
    person_id: personId,
    representation_type: String(body.representationType || "self"),
    proxy_document_id: body.proxyDocumentId || null,
    presence_status: String(body.presenceStatus || "present"),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await knex("assembly_attendees").insert(attendee);

  res.status(201).json({
    item: {
      id: attendee.id, assemblyId, personId, personName: person.name,
      representationType: attendee.representation_type,
      proxyDocumentId: attendee.proxy_document_id,
      presenceStatus: attendee.presence_status, createdAt: attendee.created_at,
    },
  });
});

router.delete("/assemblies/:assemblyId/attendees/:attendeeId", authorize("assemblies", "delete"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const { assemblyId, attendeeId } = req.params;

  const deleted = await knex("assembly_attendees")
    .where({ id: attendeeId, tenant_id: tenantId, assembly_id: assemblyId })
    .del();

  if (!deleted) {
    return res.status(404).json({ error: "Participante nao encontrado." });
  }

  res.json({ ok: true });
});

// ── Send convocation email ─────────────────────────────────────────────
router.post("/assemblies/:assemblyId/send-convocation", authorize("assemblies", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const assemblyId = String(req.params.assemblyId).trim();

  const assembly = await knex("assemblies")
    .where({ id: assemblyId, tenant_id: tenantId })
    .first();
  if (!assembly) {
    return res.status(404).json({ error: "Assembleia nao encontrada." });
  }

  // Get all owners/residents with email
  const recipients = await knex("people")
    .where({ tenant_id: tenantId })
    .whereIn("role", ["owner", "resident"])
    .whereNotNull("email")
    .select("id", "name", "email");

  let sent = 0;
  for (const person of recipients) {
    try {
      await sendNotification(tenantId, {
        template: "assembly-convocation",
        recipientEmail: person.email,
        recipientName: person.name,
        data: {
          title: `Assembleia ${assembly.meeting_type}`,
          date: assembly.scheduled_at,
          location: assembly.location,
          agenda: assembly.vote_items_json ? JSON.parse(assembly.vote_items_json).map((v) => v.title || v).join(", ") : "",
        },
      });
      sent++;
    } catch {
      // continue sending to others
    }
  }

  const nowIso = new Date().toISOString();
  await knex("assemblies")
    .where({ id: assemblyId, tenant_id: tenantId })
    .update({ call_notice_sent_at: nowIso, status: "convened", updated_at: nowIso });

  res.json({ sent, total: recipients.length });
});

export default router;
