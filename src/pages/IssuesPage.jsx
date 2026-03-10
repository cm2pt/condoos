import { formatCurrency, formatDate, cleanLabel, statusTone } from "../lib/formatters.js";
import { ISSUE_COLUMNS, PRIORITY_LABEL, ISSUE_STATUS_LABEL } from "../lib/constants.js";
import StatusPill from "../components/shared/StatusPill.jsx";
import Icon from "../components/shared/Icon.jsx";

export default function IssuesPage({
  issuesByStatus,
  peopleById,
  onOpenAction,
  selectedIssue,
  selectedIssueTimeline,
  selectedIssueAttachments,
  selectedIssueWorkOrder,
  selectedIssueNextStatus,
  onSelectIssue,
  onAdvanceIssueStatus,
  fractionCodeById,
}) {
  return (
    <div className="stack-lg">
      <div className="issues-layout">
        <article className="panel">
          <header className="panel-header">
            <div className="panel-header-left">
              <Icon name="Wrench" size={16} className="panel-header-icon" />
              <h3>Painel Kanban de manutenção</h3>
            </div>
            <div className="inline-actions">
              <span>Fluxo operacional em tempo real</span>
              <button type="button" className="mini-btn" onClick={() => onOpenAction("issues")}>
                <Icon name="Plus" size={14} /> Nova ocorrencia
              </button>
            </div>
          </header>

          <div className="kanban-grid">
            {ISSUE_COLUMNS.map((column) => (
              <div key={column.key} className="kanban-column">
                <div className="kanban-head">
                  <h4>{column.label}</h4>
                  <span>{issuesByStatus[column.key].length}</span>
                </div>

                <div className="kanban-cards">
                  {issuesByStatus[column.key].map((issue) => (
                    <article
                      key={issue.id}
                      className={selectedIssue?.id === issue.id ? "kanban-card selected" : "kanban-card"}
                      data-priority={issue.priority || undefined}
                      onClick={() => onSelectIssue(issue.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectIssue(issue.id);
                        }
                      }}
                    >
                      <header>
                        <StatusPill label={PRIORITY_LABEL[issue.priority]} tone={statusTone(issue.priority)} />
                        <small>{cleanLabel(issue.category)}</small>
                      </header>
                      <p>{issue.title}</p>
                      <footer>
                        <span>{issue.fractionId ? fractionCodeById[issue.fractionId] || issue.fractionId : "Area comum"}</span>
                        <small>
                          {issue.assignedSupplierPersonId
                            ? peopleById[issue.assignedSupplierPersonId]?.fullName || "Fornecedor"
                            : "Sem atribuição"}
                        </small>
                      </footer>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel issue-detail-panel">
          {!selectedIssue ? (
            <div className="empty-state-box">
              <div className="empty-state-icon-circle"><Icon name="Inbox" size={28} /></div>
              <p className="empty-state-title">Sem seleção</p>
              <p className="empty-state-subtitle">Seleciona uma ocorrência para ver detalhes.</p>
            </div>
          ) : (
            <>
              <header className="panel-header">
                <div className="panel-header-left">
                  <Icon name="Wrench" size={16} className="panel-header-icon" />
                  <h3>Detalhe da ocorrencia</h3>
                </div>
                <StatusPill label={ISSUE_STATUS_LABEL[selectedIssue.status] || cleanLabel(selectedIssue.status)} tone={statusTone(selectedIssue.status)} />
              </header>

              <div className="issue-head">
                <strong>{selectedIssue.title}</strong>
                <p>{selectedIssue.description}</p>
              </div>

              <div className="issue-meta-grid">
                <span>
                  Fração
                  <strong>{selectedIssue.fractionId ? fractionCodeById[selectedIssue.fractionId] || selectedIssue.fractionId : "Area comum"}</strong>
                </span>
                <span>
                  Categoria
                  <strong>{cleanLabel(selectedIssue.category)}</strong>
                </span>
                <span>
                  Prioridade
                  <strong>{PRIORITY_LABEL[selectedIssue.priority]}</strong>
                </span>
                <span>
                  Fornecedor
                  <strong>
                    {selectedIssue.assignedSupplierPersonId
                      ? peopleById[selectedIssue.assignedSupplierPersonId]?.fullName || "Fornecedor"
                      : "Sem atribuição"}
                  </strong>
                </span>
              </div>

              <div className="issue-costs">
                <h4>Custo estimado/final</h4>
                <p>
                  {selectedIssueWorkOrder
                    ? `${formatCurrency(selectedIssueWorkOrder.estimatedCost || 0)} / ${formatCurrency(
                        selectedIssueWorkOrder.finalCost || selectedIssueWorkOrder.estimatedCost || 0
                      )}`
                    : "Sem ordem de trabalho associada"}
                </p>
              </div>

              <div className="issue-costs">
                <h4>Anexos</h4>
                <ul className="attachment-list">
                  {selectedIssueAttachments.map((attachment) => (
                    <li key={attachment}>
                      <code>{attachment}</code>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="issue-costs">
                <h4>Timeline</h4>
                <ul className="issue-timeline">
                  {selectedIssueTimeline.map((entry) => (
                    <li key={entry.id}>
                      <div>
                        <p>{entry.label}</p>
                        <small>{entry.detail}</small>
                      </div>
                      <div className="timeline-side">
                        <small>{formatDate(entry.when)}</small>
                        <StatusPill label={cleanLabel(entry.tone)} tone={entry.tone} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="inline-actions">
                <button type="button" className="mini-btn" onClick={() => onOpenAction("issues")}>
                  <Icon name="Plus" size={14} /> Nova ocorrencia
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => onAdvanceIssueStatus(selectedIssue.id)}
                  disabled={!selectedIssueNextStatus}
                >
                  {selectedIssueNextStatus
                    ? `Mover para ${ISSUE_STATUS_LABEL[selectedIssueNextStatus]}`
                    : "Estado final"}
                </button>
              </div>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
