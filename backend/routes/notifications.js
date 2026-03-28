import { Router } from "express";
import { authorize } from "../auth.js";
import { getKnex } from "../db-knex.js";

const router = Router();

// ── Listar notificações não lidas do utilizador atual ─────────────────
router.get("/notifications", authorize("notifications", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const userId = req.user.id;

  const items = await knex("notifications")
    .where("tenant_id", tenantId)
    .where(function () {
      this.where("user_id", userId).orWhereNull("user_id");
    })
    .whereNull("read_at")
    .select(
      "id",
      "tenant_id as tenantId",
      "user_id as userId",
      "type",
      "title",
      "detail",
      "tone",
      "module",
      "target_id as targetId",
      "target_type as targetType",
      "read_at as readAt",
      "created_at as createdAt"
    )
    .orderBy("created_at", "desc");

  res.json({ items });
});

// ── Contagem de não lidas (para badge) ────────────────────────────────
router.get("/notifications/count", authorize("notifications", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const userId = req.user.id;

  const result = await knex("notifications")
    .where("tenant_id", tenantId)
    .where(function () {
      this.where("user_id", userId).orWhereNull("user_id");
    })
    .whereNull("read_at")
    .count("id as unread")
    .first();

  res.json({ unread: Number(result?.unread || 0) });
});

// ── Marcar uma notificação como lida ──────────────────────────────────
router.patch("/notifications/:id/read", authorize("notifications", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const userId = req.user.id;
  const notifId = String(req.params.id || "").trim();

  const notification = await knex("notifications")
    .where("id", notifId)
    .where("tenant_id", tenantId)
    .where(function () {
      this.where("user_id", userId).orWhereNull("user_id");
    })
    .first();

  if (!notification) {
    return res.status(404).json({ error: "Notificacao nao encontrada." });
  }

  const now = new Date().toISOString();
  await knex("notifications")
    .where("id", notifId)
    .where("tenant_id", tenantId)
    .update({ read_at: now });

  res.json({ item: { ...notification, read_at: now } });
});

// ── Marcar todas como lidas ───────────────────────────────────────────
router.post("/notifications/mark-all-read", authorize("notifications", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const userId = req.user.id;
  const now = new Date().toISOString();

  const updated = await knex("notifications")
    .where("tenant_id", tenantId)
    .where(function () {
      this.where("user_id", userId).orWhereNull("user_id");
    })
    .whereNull("read_at")
    .update({ read_at: now });

  res.json({ updated });
});

export default router;
