import express from "express";
import { authorize } from "../auth.js";
import { getKnex } from "../db-knex.js";
import { parseAuditJson } from "../helpers.js";

const router = express.Router();

router.get("/audit-log", authorize("audit", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || "50"), 10), 1), 200);

  const rawRows = await knex("audit_logs")
    .where("tenant_id", tenantId)
    .select(
      "id",
      "tenant_id as tenantId",
      "actor_user_id as actorUserId",
      "action",
      "entity_type as entityType",
      "entity_id as entityId",
      "before_json as beforeJson",
      "after_json as afterJson",
      "metadata_json as metadataJson",
      "created_at as createdAt"
    )
    .orderBy("id", "desc")
    .limit(limit);

  const rows = rawRows.map((row) => ({
    ...row,
    before: parseAuditJson(row.beforeJson),
    after: parseAuditJson(row.afterJson),
    metadata: parseAuditJson(row.metadataJson),
  }));

  res.json({ items: rows });
});

export default router;
