import { describe, it, expect } from "vitest";
import {
  normalizeKey,
  formatCurrency,
  formatDate,
  statusTone,
  cleanLabel,
  getModuleTitle,
  getProfileCapability,
  normalizeCapabilityForProfile,
  getDocumentVisibilityScope,
  canProfileReadDocument,
  getExportPresetKeys,
  toEnvText,
  toEnvBool,
} from "./formatters.js";

describe("normalizeKey", () => {
  it("lowercases and replaces hyphens/spaces with underscores", () => {
    expect(normalizeKey("Hello-World Test")).toBe("hello_world_test");
  });

  it("handles null/undefined gracefully", () => {
    expect(normalizeKey(null)).toBe("");
    expect(normalizeKey(undefined)).toBe("");
  });

  it("trims whitespace", () => {
    expect(normalizeKey("  paid  ")).toBe("paid");
  });
});

describe("formatCurrency", () => {
  it("formats positive numbers as EUR", () => {
    const result = formatCurrency(1234.5);
    expect(result).toContain("1");
    expect(result).toContain("234");
  });

  it("handles zero", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0");
  });

  it("handles null/undefined as zero", () => {
    expect(formatCurrency(null)).toContain("0");
    expect(formatCurrency(undefined)).toContain("0");
  });
});

describe("formatDate", () => {
  it("formats a date string", () => {
    const result = formatDate("2026-03-15");
    expect(result).not.toBe("-");
    expect(result).toContain("2026");
  });

  it("returns dash for falsy input", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate("")).toBe("-");
    expect(formatDate(undefined)).toBe("-");
  });
});

describe("statusTone", () => {
  it("returns success for paid/resolved/closed", () => {
    expect(statusTone("paid")).toBe("success");
    expect(statusTone("resolved")).toBe("success");
    expect(statusTone("closed")).toBe("success");
  });

  it("returns danger for overdue/critical", () => {
    expect(statusTone("overdue")).toBe("danger");
    expect(statusTone("critical")).toBe("danger");
  });

  it("returns warning for in_progress/partially_paid", () => {
    expect(statusTone("in_progress")).toBe("warning");
    expect(statusTone("partially_paid")).toBe("warning");
  });

  it("returns neutral for unknown status", () => {
    expect(statusTone("unknown")).toBe("neutral");
    expect(statusTone("")).toBe("neutral");
  });

  it("normalizes hyphens to underscores", () => {
    expect(statusTone("in-progress")).toBe("warning");
    expect(statusTone("partially-paid")).toBe("warning");
  });
});

describe("cleanLabel", () => {
  it("converts underscored keys to readable labels", () => {
    expect(cleanLabel("reserve_fund")).toBe("Fundo de reserva");
  });

  it("applies Portuguese overrides", () => {
    expect(cleanLabel("habitacao")).toBe("Habitação");
    expect(cleanLabel("infiltracao")).toBe("Infiltração");
  });

  it("applies label overrides", () => {
    expect(cleanLabel("overdue")).toBe("Em atraso");
    expect(cleanLabel("paid")).toBe("Pago");
  });

  it("handles null/undefined gracefully", () => {
    expect(cleanLabel(null)).toBe("");
    expect(cleanLabel(undefined)).toBe("");
  });
});

describe("getModuleTitle", () => {
  it("returns title for known modules", () => {
    expect(getModuleTitle("dashboard")).toBe("Painel de controlo");
    expect(getModuleTitle("finance")).toBe("Tesouraria e cobrança");
  });

  it("returns undefined for unknown modules", () => {
    expect(getModuleTitle("nonexistent")).toBeUndefined();
  });
});

describe("getProfileCapability", () => {
  it("returns capabilities for known profiles", () => {
    const cap = getProfileCapability("manager");
    expect(cap.modules).toContain("dashboard");
    expect(cap.quickActions).toContain("fractions");
  });

  it("falls back to manager for unknown profiles", () => {
    const cap = getProfileCapability("nonexistent");
    expect(cap.modules).toContain("dashboard");
  });
});

describe("normalizeCapabilityForProfile", () => {
  it("filters out invalid module ids", () => {
    const cap = normalizeCapabilityForProfile(
      { modules: ["dashboard", "nonexistent"], quickActions: [] },
      "manager"
    );
    expect(cap.modules).toContain("dashboard");
    expect(cap.modules).not.toContain("nonexistent");
  });

  it("falls back to profile defaults when modules missing", () => {
    const cap = normalizeCapabilityForProfile({}, "resident");
    const fallback = getProfileCapability("resident");
    expect(cap.modules).toEqual(fallback.modules);
  });

  it("deduplicates module entries", () => {
    const cap = normalizeCapabilityForProfile(
      { modules: ["dashboard", "dashboard"], quickActions: ["fractions"] },
      "manager"
    );
    expect(cap.modules.filter((m) => m === "dashboard")).toHaveLength(1);
  });
});

describe("getExportPresetKeys", () => {
  it("returns keys for manager dashboard", () => {
    const keys = getExportPresetKeys("dashboard", "manager");
    expect(keys).toContain("section");
    expect(keys).toContain("value");
  });

  it("returns keys for resident finance", () => {
    const keys = getExportPresetKeys("finance", "resident");
    expect(keys).toContain("fracao");
    expect(keys).toContain("estado");
  });

  it("falls back to manager for unknown profile", () => {
    const keys = getExportPresetKeys("dashboard", "unknown");
    const managerKeys = getExportPresetKeys("dashboard", "manager");
    expect(keys).toEqual(managerKeys);
  });
});

describe("getDocumentVisibilityScope", () => {
  it("returns all visibilities for manager", () => {
    const scope = getDocumentVisibilityScope("manager");
    expect(scope).toContain("manager_only");
    expect(scope).toContain("residents");
    expect(scope).toContain("all");
  });

  it("does not include manager_only for resident", () => {
    const scope = getDocumentVisibilityScope("resident");
    expect(scope).not.toContain("manager_only");
    expect(scope).toContain("residents");
  });

  it("returns empty for unknown profiles", () => {
    expect(getDocumentVisibilityScope("unknown")).toEqual([]);
  });
});

describe("canProfileReadDocument", () => {
  it("manager can read manager_only documents", () => {
    expect(canProfileReadDocument("manager", "manager_only")).toBe(true);
  });

  it("resident cannot read manager_only documents", () => {
    expect(canProfileReadDocument("resident", "manager_only")).toBe(false);
  });

  it("resident can read residents documents", () => {
    expect(canProfileReadDocument("resident", "residents")).toBe(true);
  });
});

describe("toEnvText", () => {
  it("returns the value as string", () => {
    expect(toEnvText("hello")).toBe("hello");
  });

  it("returns empty string for falsy", () => {
    expect(toEnvText(undefined)).toBe("");
    expect(toEnvText(null)).toBe("");
  });
});

describe("toEnvBool", () => {
  it("returns true for truthy string values", () => {
    expect(toEnvBool("true")).toBe(true);
    expect(toEnvBool("1")).toBe(true);
    expect(toEnvBool("yes")).toBe(true);
  });

  it("returns false for falsy values", () => {
    expect(toEnvBool("false")).toBe(false);
    expect(toEnvBool("0")).toBe(false);
    expect(toEnvBool(undefined)).toBe(false);
  });

  it("uses fallback when value is undefined", () => {
    expect(toEnvBool(undefined, true)).toBe(true);
  });
});
