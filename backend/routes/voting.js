import express from "express";
import crypto from "node:crypto";
import { authorize } from "../auth.js";
import { getKnex } from "../db-knex.js";
import { recordAuditLog } from "../audit.js";

const VALID_VOTES = ["favor", "contra", "abstencao"];

const router = express.Router();

// ── Open voting ──────────────────────────────────────────────────────────
router.post("/assemblies/:id/open-voting", authorize("voting", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const assemblyId = String(req.params.id).trim();

  if (req.user.role !== "manager") {
    return res.status(403).json({ error: "Apenas gestores podem abrir votacao." });
  }

  const assembly = await knex("assemblies")
    .where({ id: assemblyId, tenant_id: tenantId })
    .first();

  if (!assembly) {
    return res.status(404).json({ error: "Assembleia nao encontrada." });
  }

  if (assembly.status === "voting") {
    return res.status(409).json({ error: "Votacao ja esta aberta." });
  }

  if (!assembly.vote_items_json) {
    return res.status(400).json({ error: "Assembleia nao tem pontos de votacao definidos." });
  }

  const nowIso = new Date().toISOString();
  await knex("assemblies")
    .where({ id: assemblyId, tenant_id: tenantId })
    .update({ status: "voting", updated_at: nowIso });

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "assembly.open_voting",
    entityType: "assembly",
    entityId: assemblyId,
    before: { status: assembly.status },
    after: { status: "voting" },
  });

  res.json({ ok: true, status: "voting" });
});

// ── Close voting ─────────────────────────────────────────────────────────
router.post("/assemblies/:id/close-voting", authorize("voting", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const assemblyId = String(req.params.id).trim();

  if (req.user.role !== "manager") {
    return res.status(403).json({ error: "Apenas gestores podem encerrar votacao." });
  }

  const assembly = await knex("assemblies")
    .where({ id: assemblyId, tenant_id: tenantId })
    .first();

  if (!assembly) {
    return res.status(404).json({ error: "Assembleia nao encontrada." });
  }

  if (assembly.status !== "voting") {
    return res.status(409).json({ error: "Votacao nao esta aberta." });
  }

  const nowIso = new Date().toISOString();
  await knex("assemblies")
    .where({ id: assemblyId, tenant_id: tenantId })
    .update({ status: "held", updated_at: nowIso });

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "assembly.close_voting",
    entityType: "assembly",
    entityId: assemblyId,
    before: { status: "voting" },
    after: { status: "held" },
  });

  res.json({ ok: true, status: "held" });
});

// ── Get vote items with tally ────────────────────────────────────────────
router.get("/assemblies/:id/vote-items", authorize("voting", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const assemblyId = String(req.params.id).trim();

  const assembly = await knex("assemblies")
    .where({ id: assemblyId, tenant_id: tenantId })
    .select("id", "vote_items_json", "status")
    .first();

  if (!assembly) {
    return res.status(404).json({ error: "Assembleia nao encontrada." });
  }

  const voteItems = assembly.vote_items_json ? JSON.parse(assembly.vote_items_json) : [];

  // Get all votes for this assembly
  const votes = await knex("assembly_votes")
    .where({ assembly_id: assemblyId, tenant_id: tenantId })
    .select("vote_item_index", "vote", "permillage_weight", "fraction_id");

  // Get total permillage for quorum calculation
  const totalPermillageRow = await knex("fractions")
    .where({ tenant_id: tenantId })
    .sum("permillage as total")
    .first();
  const totalPermillage = Number(totalPermillageRow?.total || 0);

  // Build tally per item
  const items = voteItems.map((item, index) => {
    const itemVotes = votes.filter((v) => v.vote_item_index === index);
    const favor = itemVotes.filter((v) => v.vote === "favor");
    const contra = itemVotes.filter((v) => v.vote === "contra");
    const abstencao = itemVotes.filter((v) => v.vote === "abstencao");

    const favorPermillage = favor.reduce((sum, v) => sum + Number(v.permillage_weight), 0);
    const contraPermillage = contra.reduce((sum, v) => sum + Number(v.permillage_weight), 0);
    const abstencaoPermillage = abstencao.reduce((sum, v) => sum + Number(v.permillage_weight), 0);
    const votedPermillage = favorPermillage + contraPermillage + abstencaoPermillage;

    return {
      index,
      question: item.question || item.description || "",
      type: item.type || item.votingRule || "ordinary",
      tally: {
        favor: { count: favor.length, permillage: favorPermillage },
        contra: { count: contra.length, permillage: contraPermillage },
        abstencao: { count: abstencao.length, permillage: abstencaoPermillage },
      },
      votedPermillage,
      totalPermillage,
      quorumPercent: totalPermillage > 0 ? Math.round((votedPermillage / totalPermillage) * 1000) / 10 : 0,
      quorumMet: totalPermillage > 0 && (votedPermillage / totalPermillage) >= 0.5,
    };
  });

  // Get user's own votes for this assembly
  const userVotes = await knex("assembly_votes")
    .where({ assembly_id: assemblyId, tenant_id: tenantId, user_id: req.user.id })
    .select("vote_item_index", "fraction_id", "vote");

  res.json({
    assemblyId,
    status: assembly.status,
    items,
    userVotes: userVotes.map((v) => ({
      voteItemIndex: v.vote_item_index,
      fractionId: v.fraction_id,
      vote: v.vote,
    })),
  });
});

// ── Cast vote ────────────────────────────────────────────────────────────
router.post("/assemblies/:id/votes", authorize("voting", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const assemblyId = String(req.params.id).trim();
  const body = req.body || {};

  const voteItemIndex = Number(body.voteItemIndex);
  const fractionId = String(body.fractionId || "").trim();
  const vote = String(body.vote || "").trim();

  if (!Number.isInteger(voteItemIndex) || voteItemIndex < 0) {
    return res.status(400).json({ error: "Campo voteItemIndex invalido." });
  }
  if (!fractionId) {
    return res.status(400).json({ error: "Campo fractionId e obrigatorio." });
  }
  if (!VALID_VOTES.includes(vote)) {
    return res.status(400).json({ error: "Voto invalido. Valores permitidos: favor, contra, abstencao." });
  }

  // Validate assembly exists and is in voting status
  const assembly = await knex("assemblies")
    .where({ id: assemblyId, tenant_id: tenantId })
    .first();

  if (!assembly) {
    return res.status(404).json({ error: "Assembleia nao encontrada." });
  }

  if (assembly.status !== "voting") {
    return res.status(409).json({ error: "Assembleia nao esta em periodo de votacao." });
  }

  // Validate vote item index
  const voteItems = assembly.vote_items_json ? JSON.parse(assembly.vote_items_json) : [];
  if (voteItemIndex >= voteItems.length) {
    return res.status(400).json({ error: "Indice de ponto de votacao invalido." });
  }

  // Validate user has access to the fraction
  const fraction = await knex("fractions")
    .where({ id: fractionId, tenant_id: tenantId })
    .select("id", "permillage")
    .first();

  if (!fraction) {
    return res.status(404).json({ error: "Fracao nao encontrada." });
  }

  // For residents, check fraction scope
  if (req.user.role === "resident") {
    const scope = await knex("user_fraction_scopes")
      .where({ user_id: req.user.id, tenant_id: tenantId, fraction_id: fractionId })
      .first();

    if (!scope) {
      return res.status(403).json({ error: "Sem acesso a fracao selecionada." });
    }
  }

  // Check for existing vote (one vote per fraction per item)
  const existingVote = await knex("assembly_votes")
    .where({ assembly_id: assemblyId, vote_item_index: voteItemIndex, fraction_id: fractionId })
    .first();

  if (existingVote) {
    return res.status(409).json({ error: "Ja existe um voto registado para esta fracao neste ponto." });
  }

  const nowIso = new Date().toISOString();
  const voteRecord = {
    id: `vote-${crypto.randomUUID()}`,
    tenant_id: tenantId,
    assembly_id: assemblyId,
    vote_item_index: voteItemIndex,
    user_id: req.user.id,
    fraction_id: fractionId,
    vote,
    permillage_weight: Number(fraction.permillage),
    cast_at: nowIso,
  };

  await knex("assembly_votes").insert(voteRecord);

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "assembly.cast_vote",
    entityType: "assembly_vote",
    entityId: voteRecord.id,
    after: voteRecord,
  });

  res.status(201).json({
    item: {
      id: voteRecord.id,
      assemblyId,
      voteItemIndex,
      fractionId,
      vote,
      permillageWeight: Number(fraction.permillage),
      castAt: nowIso,
    },
  });
});

// ── Vote results ─────────────────────────────────────────────────────────
router.get("/assemblies/:id/vote-results", authorize("voting", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const assemblyId = String(req.params.id).trim();

  const assembly = await knex("assemblies")
    .where({ id: assemblyId, tenant_id: tenantId })
    .select("id", "vote_items_json", "status")
    .first();

  if (!assembly) {
    return res.status(404).json({ error: "Assembleia nao encontrada." });
  }

  const voteItems = assembly.vote_items_json ? JSON.parse(assembly.vote_items_json) : [];

  const votes = await knex("assembly_votes")
    .where({ assembly_id: assemblyId, tenant_id: tenantId })
    .select("vote_item_index", "vote", "permillage_weight", "fraction_id", "user_id", "cast_at");

  // Total permillage of all fractions
  const totalPermillageRow = await knex("fractions")
    .where({ tenant_id: tenantId })
    .sum("permillage as total")
    .first();
  const totalPermillage = Number(totalPermillageRow?.total || 0);

  const results = voteItems.map((item, index) => {
    const itemVotes = votes.filter((v) => v.vote_item_index === index);
    const favor = itemVotes.filter((v) => v.vote === "favor");
    const contra = itemVotes.filter((v) => v.vote === "contra");
    const abstencao = itemVotes.filter((v) => v.vote === "abstencao");

    const favorPermillage = favor.reduce((sum, v) => sum + Number(v.permillage_weight), 0);
    const contraPermillage = contra.reduce((sum, v) => sum + Number(v.permillage_weight), 0);
    const abstencaoPermillage = abstencao.reduce((sum, v) => sum + Number(v.permillage_weight), 0);
    const votedPermillage = favorPermillage + contraPermillage + abstencaoPermillage;

    const quorumPercent = totalPermillage > 0
      ? Math.round((votedPermillage / totalPermillage) * 1000) / 10
      : 0;

    return {
      index,
      question: item.question || item.description || "",
      type: item.type || item.votingRule || "ordinary",
      tally: {
        favor: {
          count: favor.length,
          permillage: favorPermillage,
          percent: votedPermillage > 0 ? Math.round((favorPermillage / votedPermillage) * 1000) / 10 : 0,
        },
        contra: {
          count: contra.length,
          permillage: contraPermillage,
          percent: votedPermillage > 0 ? Math.round((contraPermillage / votedPermillage) * 1000) / 10 : 0,
        },
        abstencao: {
          count: abstencao.length,
          permillage: abstencaoPermillage,
          percent: votedPermillage > 0 ? Math.round((abstencaoPermillage / votedPermillage) * 1000) / 10 : 0,
        },
      },
      totalVotes: itemVotes.length,
      votedPermillage,
      totalPermillage,
      quorumPercent,
      quorumMet: totalPermillage > 0 && (votedPermillage / totalPermillage) >= 0.5,
    };
  });

  res.json({
    assemblyId,
    status: assembly.status,
    totalPermillage,
    results,
  });
});

export default router;
