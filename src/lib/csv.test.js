import { describe, it, expect } from "vitest";
import { csvEscape, buildCsv, buildDocumentDownloadName } from "./csv.js";

describe("csvEscape", () => {
  it("wraps value in double quotes", () => {
    expect(csvEscape("hello")).toBe('"hello"');
  });

  it("escapes double quotes", () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it("handles null/undefined", () => {
    expect(csvEscape(null)).toBe('""');
    expect(csvEscape(undefined)).toBe('""');
  });
});

describe("buildCsv", () => {
  it("generates CSV with header and rows using semicolons", () => {
    const columns = [
      { key: "name", label: "Nome" },
      { key: "value", label: "Valor" },
    ];
    const rows = [
      { name: "A", value: "1" },
      { name: "B", value: "2" },
    ];
    const csv = buildCsv(columns, rows);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Nome");
    expect(lines[0]).toContain(";");
  });
});

describe("buildDocumentDownloadName", () => {
  it("normalizes title to safe filename", () => {
    expect(buildDocumentDownloadName("Relatório Anual 2026")).toBe("relatorio-anual-2026.txt");
  });

  it("handles empty/null title", () => {
    expect(buildDocumentDownloadName("")).toBe("documento.txt");
    expect(buildDocumentDownloadName(null)).toBe("documento.txt");
  });

  it("strips accents and special characters", () => {
    expect(buildDocumentDownloadName("Ação & Decisão")).toBe("acao-decisao.txt");
  });
});
