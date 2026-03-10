import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { authorize } from "../auth.js";
import { getKnex } from "../db-knex.js";
import { recordAuditLog } from "../audit.js";
import {
  getAllowedDocumentVisibilitiesForRole,
  readVisibleDocumentById,
  readLatestDocumentVersionRecord,
  createDocumentVersionFile,
  decodeBase64FileContent,
  sanitizeFileName,
  buildDownloadFilename,
  extensionFromMimeType,
  DOCUMENT_VISIBILITY_VALUES,
  getAllowedFractionIdsForRequest,
} from "../helpers.js";

const router = express.Router();

router.get("/documents", authorize("documents", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const query = String(req.query.q || "").trim().toLowerCase();
  const allowedVisibilities = getAllowedDocumentVisibilitiesForRole(req.user.role);
  const includeStoragePath = req.user.role === "manager";

  if (allowedVisibilities.length === 0) {
    return res.json({ items: [] });
  }

  const columns = [
    "id",
    "tenant_id as tenantId",
    "category",
    "title",
    "visibility",
    "uploaded_by_person_id as uploadedByPersonId",
    "uploaded_at as uploadedAt",
  ];
  if (includeStoragePath) {
    columns.push("storage_path as storagePath");
  } else {
    columns.push(knex.raw("NULL as storagePath"));
  }

  let q = knex("documents")
    .where("tenant_id", tenantId)
    .whereIn("visibility", allowedVisibilities)
    .select(columns);

  if (query) {
    q = q.where(function () {
      this.whereRaw("LOWER(title) LIKE ?", [`%${query}%`])
        .orWhereRaw("LOWER(category) LIKE ?", [`%${query}%`])
        .orWhereRaw("LOWER(visibility) LIKE ?", [`%${query}%`]);
    });
  }

  const items = await q.orderBy("uploaded_at", "desc").orderBy("title", "asc");
  return res.json({ items });
});

router.post("/documents", authorize("documents", "create"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const body = req.body || {};
  const title = String(body.title || "").trim();
  const category = String(body.category || "general").trim().toLowerCase();
  const visibility = String(body.visibility || "residents").trim().toLowerCase();
  const mimeType = String(body.mimeType || "application/octet-stream").trim().toLowerCase();
  const uploadedByPersonId = body.uploadedByPersonId ? String(body.uploadedByPersonId).trim() : null;

  if (!title) {
    return res.status(400).json({ error: "Campo title e obrigatorio." });
  }
  if (!DOCUMENT_VISIBILITY_VALUES.includes(visibility)) {
    return res.status(400).json({ error: "visibility invalida." });
  }
  if (!getAllowedDocumentVisibilitiesForRole(req.user.role).includes(visibility)) {
    return res.status(403).json({ error: "Perfil atual nao pode publicar documento com esta visibilidade." });
  }

  let fileBuffer;
  try {
    fileBuffer = decodeBase64FileContent(body.contentBase64);
  } catch {
    return res.status(400).json({ error: "contentBase64 invalido." });
  }

  if (fileBuffer.length === 0) {
    fileBuffer = Buffer.from("Documento sem conteudo binario. Versao criada no Condoos.", "utf8");
  }
  if (fileBuffer.length > 15 * 1024 * 1024) {
    return res.status(413).json({ error: "Ficheiro acima do limite de 15MB." });
  }

  const documentId = `doc-${crypto.randomUUID()}`;
  const nowIso = new Date().toISOString();
  const versionNumber = 1;
  const originalFileName = sanitizeFileName(body.fileName || title, "documento");
  const persistedFile = createDocumentVersionFile({
    tenantId,
    documentId,
    versionNumber,
    contentBuffer: fileBuffer,
    originalFileName,
    mimeType,
  });

  await knex.transaction(async (trx) => {
    await trx("documents").insert({
      id: documentId,
      tenant_id: tenantId,
      category,
      title,
      visibility,
      uploaded_by_person_id: uploadedByPersonId,
      uploaded_at: nowIso,
      storage_path: persistedFile.storagePath,
      created_at: nowIso,
      updated_at: nowIso,
    });

    await trx("document_versions").insert({
      id: `docv-${crypto.randomUUID()}`,
      tenant_id: tenantId,
      document_id: documentId,
      version_number: versionNumber,
      storage_path: persistedFile.storagePath,
      original_file_name: originalFileName,
      mime_type: mimeType,
      file_size_bytes: persistedFile.fileSizeBytes,
      checksum_sha256: persistedFile.checksumSha256,
      created_by_user_id: req.user.id,
      created_at: nowIso,
    });
  });

  const created = await knex("documents")
    .where({ id: documentId, tenant_id: tenantId })
    .select(
      "id",
      "tenant_id as tenantId",
      "category",
      "title",
      "visibility",
      "uploaded_by_person_id as uploadedByPersonId",
      "uploaded_at as uploadedAt",
      "storage_path as storagePath"
    )
    .first();

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "document.create",
    entityType: "document",
    entityId: documentId,
    after: {
      ...created,
      versionNumber,
      mimeType,
      fileSizeBytes: persistedFile.fileSizeBytes,
    },
  });

  return res.status(201).json({
    item: created,
    version: {
      documentId,
      versionNumber,
      mimeType,
      fileSizeBytes: persistedFile.fileSizeBytes,
    },
  });
});

router.post("/documents/:documentId/versions", authorize("documents", "update"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const documentId = String(req.params.documentId || "").trim();
  const body = req.body || {};
  const mimeType = String(body.mimeType || "application/octet-stream").trim().toLowerCase();
  const originalFileName = sanitizeFileName(body.fileName || "documento", "documento");

  if (!documentId) {
    return res.status(400).json({ error: "documentId invalido." });
  }

  const document = await readVisibleDocumentById(tenantId, documentId, req.user.role);
  if (!document) {
    return res.status(404).json({ error: "Documento nao encontrado." });
  }

  let fileBuffer;
  try {
    fileBuffer = decodeBase64FileContent(body.contentBase64);
  } catch {
    return res.status(400).json({ error: "contentBase64 invalido." });
  }

  if (fileBuffer.length === 0) {
    return res.status(400).json({ error: "A nova versao precisa de conteudo binario." });
  }
  if (fileBuffer.length > 15 * 1024 * 1024) {
    return res.status(413).json({ error: "Ficheiro acima do limite de 15MB." });
  }

  const maxVersionRow = await knex("document_versions")
    .where({ tenant_id: tenantId, document_id: documentId })
    .max("version_number as maxVersion")
    .first();
  const nextVersion = Number(maxVersionRow?.maxVersion || 0) + 1;
  const nowIso = new Date().toISOString();
  const persistedFile = createDocumentVersionFile({
    tenantId,
    documentId,
    versionNumber: nextVersion,
    contentBuffer: fileBuffer,
    originalFileName,
    mimeType,
  });

  await knex.transaction(async (trx) => {
    await trx("document_versions").insert({
      id: `docv-${crypto.randomUUID()}`,
      tenant_id: tenantId,
      document_id: documentId,
      version_number: nextVersion,
      storage_path: persistedFile.storagePath,
      original_file_name: originalFileName,
      mime_type: mimeType,
      file_size_bytes: persistedFile.fileSizeBytes,
      checksum_sha256: persistedFile.checksumSha256,
      created_by_user_id: req.user.id,
      created_at: nowIso,
    });

    await trx("documents")
      .where({ id: documentId, tenant_id: tenantId })
      .update({ storage_path: persistedFile.storagePath, updated_at: nowIso });
  });

  await recordAuditLog({
    tenantId,
    actorUserId: req.user.id,
    action: "document.version.create",
    entityType: "document_version",
    entityId: documentId,
    metadata: {
      versionNumber: nextVersion,
      mimeType,
      fileSizeBytes: persistedFile.fileSizeBytes,
    },
  });

  return res.status(201).json({
    item: {
      documentId,
      versionNumber: nextVersion,
      mimeType,
      fileSizeBytes: persistedFile.fileSizeBytes,
    },
  });
});

router.get("/documents/:documentId/versions", authorize("documents", "read"), async (req, res) => {
  const knex = getKnex();
  const tenantId = req.tenant.id;
  const documentId = String(req.params.documentId || "").trim();

  if (!documentId) {
    return res.status(400).json({ error: "documentId invalido." });
  }

  const document = await readVisibleDocumentById(tenantId, documentId, req.user.role);
  if (!document) {
    return res.status(404).json({ error: "Documento nao encontrado." });
  }

  const items = await knex("document_versions")
    .where({ tenant_id: tenantId, document_id: documentId })
    .select(
      "id",
      "document_id as documentId",
      "version_number as versionNumber",
      "original_file_name as originalFileName",
      "mime_type as mimeType",
      "file_size_bytes as fileSizeBytes",
      "checksum_sha256 as checksumSha256",
      "created_at as createdAt"
    )
    .orderBy("version_number", "desc");

  return res.json({ items });
});

router.get("/documents/:documentId/download", authorize("documents", "read"), async (req, res) => {
  const tenantId = req.tenant.id;
  const documentId = String(req.params.documentId || "").trim();

  if (!documentId) {
    return res.status(400).json({ error: "Documento invalido." });
  }

  const item = await readVisibleDocumentById(tenantId, documentId, req.user.role);

  if (!item) {
    return res.status(404).json({ error: "Documento nao encontrado." });
  }

  const latestVersion = await readLatestDocumentVersionRecord(tenantId, documentId);
  if (latestVersion) {
    const absolutePath = path.resolve(process.cwd(), latestVersion.storagePath);
    if (fs.existsSync(absolutePath)) {
      const extension = path.extname(latestVersion.originalFileName || "") || extensionFromMimeType(latestVersion.mimeType, ".bin");
      const baseName = sanitizeFileName(item.title || "documento", "documento");
      const fileName = `${baseName}${extension.startsWith(".") ? extension : `.${extension}`}`;

      res.setHeader("Content-Type", latestVersion.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.status(200).send(fs.readFileSync(absolutePath));
    }
  }

  const includeStoragePath = req.user.role === "manager";
  const lines = [
    "Condoos | Documento de demonstração",
    `Titulo: ${item.title}`,
    `Categoria: ${item.category}`,
    `Visibilidade: ${item.visibility}`,
    `Data de upload: ${item.uploadedAt}`,
  ];

  if (includeStoragePath) {
    lines.push(`Caminho interno: ${item.storagePath}`);
  }

  lines.push("", "Nota: ficheiro de demonstração para validação funcional.");

  const filename = buildDownloadFilename(item.title);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.status(200).send(lines.join("\n"));
});

export default router;
