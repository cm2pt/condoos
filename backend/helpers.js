import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getKnex } from "./db-knex.js";

const STORAGE_ROOT_DIR = path.resolve(process.cwd(), "backend/data/storage");
export const DOCUMENT_STORAGE_DIR = path.join(STORAGE_ROOT_DIR, "documents");
export const RECEIPT_STORAGE_DIR = path.join(STORAGE_ROOT_DIR, "receipts");

export const ISSUE_STATUS_FLOW = ["new", "triage", "in_progress", "waiting_supplier", "resolved", "closed"];
export const ISSUE_PRIORITY_VALUES = ["low", "medium", "high", "critical"];
export const CHARGE_STATUS_VALUES = ["open", "partially_paid", "paid", "overdue"];
export const FRACTION_STATUS_VALUES = ["active", "inactive"];
export const TENANT_MANAGEMENT_TYPE_VALUES = ["internal", "professional"];
export const PERSON_ROLE_VALUES = ["owner", "tenant", "resident", "manager", "supplier"];
export const FRACTION_PARTY_RELATIONSHIP_VALUES = ["owner", "tenant", "resident"];
export const DOCUMENT_VISIBILITY_VALUES = ["manager_only", "residents", "all"];
export const DOCUMENT_VISIBILITY_SCOPE = {
  manager: ["manager_only", "residents", "all"],
  accounting: ["residents", "all"],
  operations: ["residents", "all"],
  resident: ["residents", "all"],
};
export const ASSEMBLY_STATUS_VALUES = ["scheduled", "convened", "voting", "in_progress", "held", "completed", "cancelled"];

export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toIsoDate(value) {
  return String(value || "").slice(0, 10);
}

export function toIsoDateTime(value) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

export function toBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on", "sim"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "nao", "não"].includes(normalized)) return false;
  return fallback;
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeKey(value) {
  return String(value || "").trim().toLowerCase().replaceAll("-", "_").replace(/\s+/g, "_");
}

export function hashSecretToken(rawToken) {
  return crypto.createHash("sha256").update(String(rawToken || "")).digest("hex");
}

export function parseCsvLine(line, delimiter) {
  const values = [];
  let current = "";
  let index = 0;
  let inQuotes = false;

  while (index < line.length) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && next === "\"") { current += "\""; index += 2; continue; }
    if (char === "\"") { inQuotes = !inQuotes; index += 1; continue; }
    if (char === delimiter && !inQuotes) { values.push(current.trim()); current = ""; index += 1; continue; }
    current += char;
    index += 1;
  }

  values.push(current.trim());
  return values;
}

export function parseCsvText(csvText, delimiterHint = "") {
  const raw = String(csvText || "").replace(/^\uFEFF/, "").trim();
  if (!raw) return { header: [], rows: [] };
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const firstLine = lines[0];
  const inferredDelimiter = delimiterHint || (firstLine.split(";").length > firstLine.split(",").length ? ";" : ",");
  const header = parseCsvLine(firstLine, inferredDelimiter).map((value) => normalizeKey(value));
  const rows = lines.slice(1).map((line) => parseCsvLine(line, inferredDelimiter));
  return { header, rows };
}

export function firstDefinedValue(values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return undefined;
}

export function buildDownloadFilename(title) {
  const normalized = String(title || "documento").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${normalized || "documento"}.txt`;
}

export function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

export function sanitizeFileName(value, fallback = "ficheiro") {
  const normalized = String(value || fallback).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

export function extensionFromMimeType(mimeType, fallback = ".bin") {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.includes("pdf")) return ".pdf";
  if (normalized.includes("png")) return ".png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return ".jpg";
  if (normalized.includes("plain")) return ".txt";
  if (normalized.includes("json")) return ".json";
  if (normalized.includes("csv")) return ".csv";
  if (normalized.includes("zip")) return ".zip";
  return fallback;
}

export function decodeBase64FileContent(rawContentBase64) {
  const raw = String(rawContentBase64 || "").trim();
  if (!raw) return Buffer.from("", "utf8");
  const sanitized = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
  return Buffer.from(sanitized, "base64");
}

export function createDocumentVersionFile({ tenantId, documentId, versionNumber, contentBuffer, originalFileName, mimeType }) {
  const tenantDir = path.join(DOCUMENT_STORAGE_DIR, sanitizeFileName(tenantId, "tenant"));
  ensureDirectory(tenantDir);
  const originalExtension = path.extname(originalFileName || "");
  const extension = originalExtension || extensionFromMimeType(mimeType, ".bin");
  const safeExtension = extension.startsWith(".") ? extension : `.${extension}`;
  const originalBaseName = path.basename(originalFileName || `documento-${documentId}-v${versionNumber}`, originalExtension);
  const safeBaseName = sanitizeFileName(originalBaseName, "documento");
  const fileName = `${sanitizeFileName(documentId, "documento")}-v${versionNumber}-${safeBaseName}${safeExtension}`;
  const absolutePath = path.join(tenantDir, fileName);
  fs.writeFileSync(absolutePath, contentBuffer);
  const checksumSha256 = crypto.createHash("sha256").update(contentBuffer).digest("hex");
  return { absolutePath, storagePath: path.relative(process.cwd(), absolutePath), checksumSha256, fileSizeBytes: contentBuffer.length, originalFileName: safeBaseName };
}

export async function readLatestDocumentVersionRecord(tenantId, documentId) {
  const knex = getKnex();
  return knex("document_versions").where({ tenant_id: tenantId, document_id: documentId })
    .select("id", "document_id as documentId", "version_number as versionNumber", "storage_path as storagePath",
      "original_file_name as originalFileName", "mime_type as mimeType", "file_size_bytes as fileSizeBytes",
      "checksum_sha256 as checksumSha256", "created_at as createdAt")
    .orderBy("version_number", "desc").first();
}

export function parseAuditJson(rawValue) {
  if (!rawValue) return null;
  try { return JSON.parse(rawValue); } catch { return null; }
}

export async function getAllowedFractionIdsForRequest(req) {
  if (req.user?.role !== "resident") return null;
  const knex = getKnex();
  const rows = await knex("user_fraction_scopes as ufs")
    .join("fractions as f", function () { this.on("f.id", "ufs.fraction_id").andOn("f.tenant_id", "ufs.tenant_id"); })
    .where({ "ufs.user_id": req.user.id, "ufs.tenant_id": req.tenant.id })
    .orderBy("f.floor_number", "asc").orderBy("f.code", "asc")
    .select("ufs.fraction_id as fractionId");
  return rows.map((row) => row.fractionId);
}

export async function requireResidentFractionAccess(req, fractionId) {
  if (req.user?.role !== "resident") return { ok: true };
  if (!fractionId) return { ok: false, status: 400, error: "Perfil condomino deve selecionar a sua fracao." };
  const allowedFractionIds = await getAllowedFractionIdsForRequest(req);
  if (!allowedFractionIds.includes(fractionId)) return { ok: false, status: 403, error: "Sem acesso a fracao selecionada." };
  return { ok: true };
}

export function getAllowedDocumentVisibilitiesForRole(role) {
  return DOCUMENT_VISIBILITY_SCOPE[role] || [];
}

export async function getScopedPeopleIdsForResident(tenantId, allowedFractionIds) {
  if (!Array.isArray(allowedFractionIds) || allowedFractionIds.length === 0) return [];
  const knex = getKnex();
  const rows = await knex("fraction_parties").where("tenant_id", tenantId)
    .whereIn("fraction_id", allowedFractionIds).distinct("person_id as personId");
  return rows.map((row) => row.personId).filter(Boolean);
}

export async function clearPrimaryOwnerForFraction(tenantId, fractionId, excludedPartyId = null, db = null) {
  const knex = db || getKnex();
  let query = knex("fraction_parties")
    .where({ tenant_id: tenantId, fraction_id: fractionId, relationship: "owner" })
    .whereNull("end_date").update({ is_primary: 0, updated_at: new Date().toISOString() });
  if (excludedPartyId) query = query.whereNot("id", excludedPartyId);
  await query;
}

export async function readFractionById(tenantId, fractionId) {
  const knex = getKnex();
  return knex("fractions").where({ id: fractionId, tenant_id: tenantId })
    .select("id", "tenant_id as tenantId", "code", "floor_number as floorNumber", "type", "typology",
      "private_area_m2 as privateAreaM2", "permillage", "monthly_fee_amount as monthlyFeeAmount", "status")
    .first();
}

export async function readPersonById(tenantId, personId) {
  const knex = getKnex();
  return knex("people").where({ id: personId, tenant_id: tenantId })
    .select("id", "tenant_id as tenantId", "full_name as fullName", "role_type as roleType",
      "tax_number as taxNumber", "email", "phone")
    .first();
}

export async function readVisibleDocumentById(tenantId, documentId, role) {
  const allowedVisibilities = getAllowedDocumentVisibilitiesForRole(role);
  if (allowedVisibilities.length === 0) return null;
  const knex = getKnex();
  return knex("documents").where({ tenant_id: tenantId, id: documentId })
    .whereIn("visibility", allowedVisibilities)
    .select("id", "tenant_id as tenantId", "category", "title", "visibility",
      "uploaded_by_person_id as uploadedByPersonId", "uploaded_at as uploadedAt", "storage_path as storagePath")
    .first();
}

export async function readPaymentContext(tenantId, paymentId) {
  const knex = getKnex();
  return knex("payments as p")
    .leftJoin("charges as c", function () { this.on("c.id", "p.charge_id").andOn("c.tenant_id", "p.tenant_id"); })
    .leftJoin("fractions as f", function () { this.on("f.id", "p.fraction_id").andOn("f.tenant_id", "p.tenant_id"); })
    .join("tenants as t", "t.id", "p.tenant_id")
    .where({ "p.id": paymentId, "p.tenant_id": tenantId })
    .select(
      "p.id", "p.tenant_id as tenantId", "p.fraction_id as fractionId", "f.code as fractionCode",
      "p.charge_id as chargeId", "p.method", "p.amount", "p.paid_at as paidAt", "p.reference",
      "c.kind as chargeKind", "c.period as chargePeriod", "c.due_date as chargeDueDate",
      "t.name as tenantName", "t.tax_number as tenantNif", "t.address as tenantAddress",
      "t.postal_code as tenantPostalCode", "t.city as tenantCity"
    ).first();
}
