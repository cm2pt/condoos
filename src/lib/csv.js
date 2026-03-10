export function csvEscape(value) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

export function buildCsv(columns, rows) {
  const head = columns.map((column) => csvEscape(column.label)).join(";");
  const body = rows
    .map((row) => columns.map((column) => csvEscape(row[column.key])).join(";"))
    .join("\n");
  return `${head}\n${body}\n`;
}

export function downloadBlob(filename, blob) {
  if (typeof window === "undefined") {
    return;
  }

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename, csvText) {
  downloadBlob(filename, new Blob([csvText], { type: "text/csv;charset=utf-8;" }));
}

export function buildDocumentDownloadName(title) {
  const normalized = String(title || "documento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalized || "documento"}.txt`;
}
