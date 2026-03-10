import express from "express";
import { authorize } from "../auth.js";
import { getKnex } from "../db-knex.js";
import { getAllowedFractionIdsForRequest, toNumber } from "../helpers.js";

const router = express.Router();

router.get("/dashboard/summary", authorize("dashboard", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const allowedFractionIds = await getAllowedFractionIdsForRequest(req);

  if (allowedFractionIds && allowedFractionIds.length === 0) {
    return res.json({
      tenantId,
      metrics: {
        fractions: 0,
        emitted: 0,
        collected: 0,
        overdueCharges: 0,
        openIssues: 0,
        collectionRate: 0,
      },
    });
  }

  const applyScope = (query, column = "fraction_id") => {
    if (allowedFractionIds) {
      return query.whereIn(column, allowedFractionIds);
    }
    return query;
  };

  const fractions = await applyScope(
    knex("fractions").where("tenant_id", tenantId), "id"
  ).count("* as total").first();

  const charges = await applyScope(
    knex("charges").where("tenant_id", tenantId)
  ).sum("amount as emitted").first();

  const payments = await applyScope(
    knex("payments").where("tenant_id", tenantId)
  ).sum("amount as collected").first();

  const overdueCharges = await applyScope(
    knex("charges").where({ tenant_id: tenantId, status: "overdue" })
  ).count("* as total").first();

  const openIssues = await applyScope(
    knex("issues").where("tenant_id", tenantId).whereNotIn("status", ["resolved", "closed"])
  ).count("* as total").first();

  const emitted = toNumber(charges?.emitted);
  const collected = toNumber(payments?.collected);
  const collectionRate = emitted > 0 ? Number(((collected / emitted) * 100).toFixed(2)) : 0;

  res.json({
    tenantId,
    metrics: {
      fractions: Number(fractions?.total || 0),
      emitted,
      collected,
      overdueCharges: Number(overdueCharges?.total || 0),
      openIssues: Number(openIssues?.total || 0),
      collectionRate,
    },
  });
});

export default router;
