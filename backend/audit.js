import { getKnex } from "./db-knex.js";

function stringifyOrNull(value) {
  if (value === undefined || value === null) {
    return null;
  }

  return JSON.stringify(value);
}

export async function recordAuditLog({
  tenantId,
  actorUserId,
  action,
  entityType,
  entityId = null,
  before = null,
  after = null,
  metadata = null,
}) {
  const knex = getKnex();
  await knex("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: actorUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    before_json: stringifyOrNull(before),
    after_json: stringifyOrNull(after),
    metadata_json: stringifyOrNull(metadata),
  });
}
