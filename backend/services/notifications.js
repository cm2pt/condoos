import crypto from "node:crypto";
import { getKnex } from "../db-knex.js";

/**
 * Cria uma notificação.
 * @param {object} opts
 * @param {string} opts.tenantId
 * @param {string|null} opts.userId - null = todos os utilizadores do tenant
 * @param {string} opts.type
 * @param {string} opts.title
 * @param {string} [opts.detail]
 * @param {string} [opts.tone]
 * @param {string} [opts.module]
 * @param {string} [opts.targetId]
 * @param {string} [opts.targetType]
 * @param {import('knex').Knex} [opts.db] - Transação opcional (evitar deadlocks SQLite)
 * @returns {Promise<object>} A notificação criada
 */
export async function createNotification({
  tenantId,
  userId = null,
  type,
  title,
  detail = null,
  tone = "neutral",
  module = null,
  targetId = null,
  targetType = null,
  db = null,
}) {
  const knex = db || getKnex();
  const now = new Date().toISOString();
  const row = {
    id: `notif-${crypto.randomUUID()}`,
    tenant_id: tenantId,
    user_id: userId,
    type,
    title,
    detail,
    tone,
    module,
    target_id: targetId,
    target_type: targetType,
    read_at: null,
    created_at: now,
  };

  await knex("notifications").insert(row);
  return row;
}

/**
 * Cria notificações em lote.
 * @param {Array<object>} notifications - Array de objetos com os mesmos campos de createNotification (sem db)
 * @param {import('knex').Knex} [db] - Transação opcional
 * @returns {Promise<Array<object>>} As notificações criadas
 */
export async function createBulkNotifications(notifications, db = null) {
  const knex = db || getKnex();
  const now = new Date().toISOString();

  const rows = notifications.map((n) => ({
    id: `notif-${crypto.randomUUID()}`,
    tenant_id: n.tenantId,
    user_id: n.userId ?? null,
    type: n.type,
    title: n.title,
    detail: n.detail ?? null,
    tone: n.tone ?? "neutral",
    module: n.module ?? null,
    target_id: n.targetId ?? null,
    target_type: n.targetType ?? null,
    read_at: null,
    created_at: now,
  }));

  if (rows.length > 0) {
    await knex("notifications").insert(rows);
  }

  return rows;
}
