import { ISSUE_STATUS_FLOW, PRIORITY_LABEL } from "./constants.js";
import { cleanLabel, formatCurrency, statusTone } from "./formatters.js";

export function nextIssueStatus(currentStatus) {
  const index = ISSUE_STATUS_FLOW.indexOf(currentStatus);
  if (index === -1 || index === ISSUE_STATUS_FLOW.length - 1) {
    return null;
  }

  return ISSUE_STATUS_FLOW[index + 1];
}

export function buildIssueTimeline(issue, workOrder) {
  if (!issue) {
    return [];
  }

  const timeline = [
    {
      id: `${issue.id}-opened`,
      label: "Ocorrência criada",
      when: issue.openedAt,
      detail: `${cleanLabel(issue.category)} | ${PRIORITY_LABEL[issue.priority]}`,
      tone: statusTone(issue.priority),
    },
  ];

  if (issue.status !== "new") {
    timeline.push({
      id: `${issue.id}-triage`,
      label: "Triagem iniciada",
      when: issue.openedAt,
      detail: "Ocorrência analisada pela gestão.",
      tone: "neutral",
    });
  }

  if (workOrder?.requestedAt) {
    timeline.push({
      id: `${issue.id}-wo-request`,
      label: "Ordem de trabalho emitida",
      when: workOrder.requestedAt,
      detail: `Estimativa ${formatCurrency(workOrder.estimatedCost)}`,
      tone: "warning",
    });
  }

  if (workOrder?.scheduledAt) {
    timeline.push({
      id: `${issue.id}-wo-scheduled`,
      label: "Intervenção agendada",
      when: workOrder.scheduledAt,
      detail: "Fornecedor notificado e janela reservada.",
      tone: "neutral",
    });
  }

  if (workOrder?.completedAt) {
    timeline.push({
      id: `${issue.id}-wo-completed`,
      label: "Intervenção concluída",
      when: workOrder.completedAt,
      detail: `Custo final ${formatCurrency(workOrder.finalCost || 0)}`,
      tone: "success",
    });
  }

  if (issue.closedAt) {
    timeline.push({
      id: `${issue.id}-closed`,
      label: issue.status === "closed" ? "Ocorrência fechada" : "Ocorrência resolvida",
      when: issue.closedAt,
      detail: "Registo encerrado no sistema.",
      tone: "success",
    });
  }

  return timeline.sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime());
}

export function buildIssueAttachments(issue) {
  if (!issue) {
    return [];
  }

  const idSuffix = issue.id.split("-").slice(-1)[0];
  return [
    `foto_${issue.category}_${idSuffix}.jpg`,
    `relatorio_${issue.category}_${idSuffix}.pdf`,
  ];
}
