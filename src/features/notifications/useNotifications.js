import { useMemo } from "react";
import { ISSUE_STATUS_LABEL } from "../../lib/constants.js";
import { formatCurrency, formatDate } from "../../lib/formatters.js";

/**
 * Computa a lista de notificações a partir dos dados de runtime.
 *
 * @param {object} params
 * @param {Array} params.openCharges - finance.openCharges
 * @param {Array} params.issues - issuesData
 * @param {Array} params.assemblies - assembliesData
 * @param {Array} params.activityLog - activityLog
 * @param {object} params.fractionCodeById - mapa fractionId -> code
 * @param {object} params.profileCapability - capability do perfil ativo
 * @returns {Array} lista de notificações ordenadas por prioridade
 */
export function useNotifications({
  openCharges,
  issues,
  assemblies,
  activityLog,
  fractionCodeById,
  profileCapability,
}) {
  return useMemo(() => {
    const canSeeModule = (moduleId) => profileCapability.modules.includes(moduleId);
    const now = Date.now();
    const in30Days = now + 30 * 24 * 60 * 60 * 1000;

    const overdueChargeAlerts = openCharges
      .filter((charge) => charge.status === "overdue")
      .slice(0, 5)
      .map((charge) => ({
        id: `notif-charge-${charge.id}`,
        title: `Quota em atraso (${fractionCodeById[charge.fractionId] || charge.fractionId})`,
        detail: `${formatCurrency(charge.missing)} | Venceu em ${formatDate(charge.dueDate)}`,
        when: charge.dueDate,
        tone: "danger",
        module: "finance",
        targetId: charge.id,
        targetType: "charge",
        priorityScore: 4,
      }));

    const criticalIssueAlerts = issues
      .filter((issue) => issue.priority === "critical" && !["resolved", "closed"].includes(issue.status))
      .slice(0, 5)
      .map((issue) => ({
        id: `notif-issue-${issue.id}`,
        title: `Ocorrência crítica: ${issue.title}`,
        detail: `${ISSUE_STATUS_LABEL[issue.status]} | ${issue.fractionId ? fractionCodeById[issue.fractionId] : "Área comum"}`,
        when: issue.openedAt,
        tone: "warning",
        module: "issues",
        targetId: issue.id,
        targetType: "issue",
        priorityScore: 3,
      }));

    const assemblyAlerts = assemblies
      .filter((assembly) => {
        const time = new Date(assembly.scheduledAt).getTime();
        return time >= now && time <= in30Days;
      })
      .slice(0, 4)
      .map((assembly) => ({
        id: `notif-assembly-${assembly.id}`,
        title: `Assembleia ${assembly.meetingType === "ordinary" ? "ordinária" : "extraordinária"} próxima`,
        detail: `${formatDate(assembly.scheduledAt)} | ${assembly.location}`,
        when: assembly.scheduledAt,
        tone: "neutral",
        module: "assemblies",
        targetId: assembly.id,
        targetType: "assembly",
        priorityScore: 2,
      }));

    const activityAlerts = activityLog.slice(0, 5).map((item) => ({
      id: `notif-activity-${item.id}`,
      title: item.title,
      detail: item.detail,
      when: item.createdAt,
      tone: item.tone || "neutral",
      module: "dashboard",
      targetId: "",
      targetType: "activity",
      priorityScore: 1,
    }));

    return [...overdueChargeAlerts, ...criticalIssueAlerts, ...assemblyAlerts, ...activityAlerts]
      .filter((notification) => canSeeModule(notification.module))
      .sort((a, b) => {
        if (a.priorityScore !== b.priorityScore) {
          return b.priorityScore - a.priorityScore;
        }
        return new Date(b.when).getTime() - new Date(a.when).getTime();
      })
      .slice(0, 12);
  }, [openCharges, issues, assemblies, activityLog, fractionCodeById, profileCapability]);
}
