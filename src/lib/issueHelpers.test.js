import { describe, it, expect } from "vitest";
import { nextIssueStatus, buildIssueTimeline, buildIssueAttachments } from "./issueHelpers.js";

describe("nextIssueStatus", () => {
  it("advances through the status flow", () => {
    expect(nextIssueStatus("new")).toBe("triage");
    expect(nextIssueStatus("triage")).toBe("in_progress");
    expect(nextIssueStatus("in_progress")).toBe("waiting_supplier");
    expect(nextIssueStatus("waiting_supplier")).toBe("resolved");
    expect(nextIssueStatus("resolved")).toBe("closed");
  });

  it("returns null for the final status", () => {
    expect(nextIssueStatus("closed")).toBeNull();
  });

  it("returns null for unknown status", () => {
    expect(nextIssueStatus("nonexistent")).toBeNull();
  });
});

describe("buildIssueTimeline", () => {
  it("returns empty array for null issue", () => {
    expect(buildIssueTimeline(null, null)).toEqual([]);
  });

  it("creates opened entry for new issue", () => {
    const issue = {
      id: "issue-001",
      status: "new",
      category: "infiltracao",
      priority: "high",
      openedAt: "2026-01-15T10:00:00Z",
      closedAt: null,
    };
    const timeline = buildIssueTimeline(issue, null);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].label).toBe("Ocorrência criada");
  });

  it("includes work order entries when present", () => {
    const issue = {
      id: "issue-002",
      status: "in_progress",
      category: "canalizacao",
      priority: "medium",
      openedAt: "2026-01-10T10:00:00Z",
      closedAt: null,
    };
    const workOrder = {
      requestedAt: "2026-01-11T10:00:00Z",
      scheduledAt: "2026-01-15T10:00:00Z",
      completedAt: null,
      estimatedCost: 500,
      finalCost: null,
    };
    const timeline = buildIssueTimeline(issue, workOrder);
    expect(timeline.length).toBeGreaterThanOrEqual(3);
    expect(timeline.some((e) => e.label === "Ordem de trabalho emitida")).toBe(true);
    expect(timeline.some((e) => e.label === "Intervenção agendada")).toBe(true);
  });

  it("includes closed entry when issue is closed", () => {
    const issue = {
      id: "issue-003",
      status: "closed",
      category: "elevador",
      priority: "low",
      openedAt: "2026-01-01T10:00:00Z",
      closedAt: "2026-02-01T10:00:00Z",
    };
    const timeline = buildIssueTimeline(issue, null);
    expect(timeline.some((e) => e.label === "Ocorrência fechada")).toBe(true);
  });
});

describe("buildIssueAttachments", () => {
  it("returns empty array for null issue", () => {
    expect(buildIssueAttachments(null)).toEqual([]);
  });

  it("generates attachment filenames from issue", () => {
    const issue = { id: "issue-abc-xyz", category: "infiltracao" };
    const attachments = buildIssueAttachments(issue);
    expect(attachments).toHaveLength(2);
    expect(attachments[0]).toContain("foto_infiltracao");
    expect(attachments[1]).toContain("relatorio_infiltracao");
  });
});
