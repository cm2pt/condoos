/**
 * Email transporter.
 * Uses nodemailer for SMTP transport or logs to console in development.
 */
import nodemailer from "nodemailer";
import { logger } from "../../logger.js";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || "noreply@condoos.pt";

let transporter = null;

export function getTransporter() {
  if (transporter) return transporter;

  if (SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  } else {
    // Console transport for development
    transporter = {
      async sendMail(options) {
        logger.info("Email sent (dev)", { to: options.to, subject: options.subject });
        return { messageId: `dev-${Date.now()}`, accepted: [options.to] };
      },
    };
  }

  return transporter;
}

export function getFromAddress() {
  return SMTP_FROM;
}

/**
 * Returns true when SMTP is configured (i.e. not using dev console fallback).
 */
export function isEmailConfigured() {
  return !!SMTP_HOST;
}
