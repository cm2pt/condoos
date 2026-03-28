import { describe, it, expect, vi } from "vitest";
import { csvEscape, buildCsv, buildDocumentDownloadName, downloadBlob, downloadCsv } from "./csv.js";

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

describe("downloadBlob", () => {
  it("creates a link, clicks it, and revokes the URL", () => {
    const clickSpy = vi.fn();
    const createElementSpy = vi.spyOn(document, "createElement").mockReturnValue({
      set href(v) { this._href = v; },
      get href() { return this._href; },
      set download(v) { this._download = v; },
      get download() { return this._download; },
      click: clickSpy,
    });
    const appendSpy = vi.spyOn(document.body, "appendChild").mockImplementation(() => {});
    const removeSpy = vi.spyOn(document.body, "removeChild").mockImplementation(() => {});
    const revokeUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");

    downloadBlob("test.csv", new Blob(["data"]));

    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(clickSpy).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith("blob:test");

    createElementSpy.mockRestore();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
    revokeUrl.mockRestore();
    createUrl.mockRestore();
  });
});

describe("downloadCsv", () => {
  it("delegates to downloadBlob with a CSV blob", () => {
    const clickSpy = vi.fn();
    vi.spyOn(document, "createElement").mockReturnValue({
      set href(v) { this._href = v; },
      set download(v) { this._download = v; },
      click: clickSpy,
    });
    vi.spyOn(document.body, "appendChild").mockImplementation(() => {});
    vi.spyOn(document.body, "removeChild").mockImplementation(() => {});
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:csv");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    downloadCsv("export.csv", "a;b\n1;2\n");
    expect(clickSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
