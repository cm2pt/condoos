/**
 * Email notification service.
 * Sends emails and logs to email_log table.
 */
import crypto from "node:crypto";
import { getKnex } from "../../db-knex.js";
import { getTransporter, getFromAddress } from "./transporter.js";
import { renderTemplate } from "./templates.js";

/**
 * Send a templated email notification.
 * @param {{ tenantId: string, template: string, recipientEmail: string, recipientName?: string, data: object }} params
 * @returns {Promise<{ id: string, status: string, messageId?: string }>}
 */
export async function sendNotification({ tenantId, template, recipientEmail, recipientName, data }) {
  const knex = getKnex();
  const logId = `email-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const { subject, html } = renderTemplate(template, { ...data, recipientName });

  await knex("email_log").insert({
    id: logId,
    tenant_id: tenantId,
    template,
    recipient_email: recipientEmail,
    recipient_name: recipientName || null,
    subject,
    status: "queued",
    metadata_json: JSON.stringify(data),
    created_at: now,
  });

  try {
    const transporter = getTransporter();
    const result = await transporter.sendMail({
      from: getFromAddress(),
      to: recipientEmail,
      subject,
      html,
    });

    await knex("email_log")
      .where({ id: logId })
      .update({ status: "sent", sent_at: new Date().toISOString() });

    return { id: logId, status: "sent", messageId: result.messageId };
  } catch (error) {
    await knex("email_log")
      .where({ id: logId })
      .update({ status: "failed", error_message: error.message });

    return { id: logId, status: "failed", error: error.message };
  }
}

/**
 * Send payment reminder emails for charges due within N days or overdue.
 * @param {{ tenantId: string, daysBeforeDue?: number }} params
 */
export async function sendPaymentReminders({ tenantId, daysBeforeDue = 7 }) {
  const knex = getKnex();
  const today = new Date();
  const reminderDate = new Date(today.getTime() + daysBeforeDue * 86_400_000).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const charges = await knex("charges as c")
    .join("fractions as f", "f.id", "c.fraction_id")
    .where("c.tenant_id", tenantId)
    .whereIn("c.status", ["open", "overdue"])
    .where("c.due_date", "<=", reminderDate)
    .select("c.id as chargeId", "c.amount", "c.due_date as dueDate", "c.kind", "c.period",
      "f.id as fractionId", "f.code as fractionCode");

  const tenant = await knex("tenants").where({ id: tenantId }).select("name").first();
  const results = [];

  for (const charge of charges) {
    const owners = await knex("fraction_parties as fp")
      .join("people as p", "p.id", "fp.person_id")
      .where("fp.tenant_id", tenantId)
      .where("fp.fraction_id", charge.fractionId)
      .where("fp.relationship", "owner")
      .where("fp.is_primary", 1)
      .whereNull("fp.end_date")
      .select("p.email", "p.full_name as fullName");

    for (const owner of owners) {
      if (!owner.email) continue;

      const result = await sendNotification({
        tenantId,
        template: "payment-reminder",
        recipientEmail: owner.email,
        recipientName: owner.fullName,
        data: {
          condominiumName: tenant?.name || "Condoos",
          fractionCode: charge.fractionCode,
          chargeKind: charge.kind,
          period: charge.period,
          amount: Number(charge.amount).toFixed(2),
          dueDate: charge.dueDate,
        },
      });
      results.push(result);
    }
  }

  return { sentCount: results.filter((r) => r.status === "sent").length, totalCount: results.length };
}
