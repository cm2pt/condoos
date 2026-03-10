import { formatDate, cleanLabel } from "../lib/formatters.js";
import { TEMPLATE_CHECKLIST } from "../lib/constants.js";
import StatusPill from "../components/shared/StatusPill.jsx";
import Icon from "../components/shared/Icon.jsx";

export default function AssembliesPage({ assemblies, onOpenAction }) {
  return (
    <div className="stack-lg">
      <div className="split-grid">
        <article className="panel">
          <header className="panel-header">
            <div className="panel-header-left">
              <Icon name="Vote" size={16} className="panel-header-icon" />
              <h3>Agenda de assembleias</h3>
            </div>
            <div className="inline-actions">
              <span>Planeamento 2026</span>
              <button type="button" className="mini-btn" onClick={() => onOpenAction("assemblies")}>
                <Icon name="Plus" size={14} /> Nova assembleia
              </button>
            </div>
          </header>
          {assemblies.length === 0 ? (
            <div className="empty-state-box">
              <div className="empty-state-icon-circle"><Icon name="Inbox" size={28} /></div>
              <p className="empty-state-title">Sem assembleias</p>
              <p className="empty-state-subtitle">Não existem assembleias agendadas.</p>
            </div>
          ) : (
            <ul className="timeline-list">
              {assemblies.map((assembly) => (
                <li key={assembly.id}>
                  <div>
                    <p>{assembly.meetingType === "ordinary" ? "Assembleia ordinária" : "Assembleia extraordinária"}</p>
                    <small>{formatDate(assembly.scheduledAt)}</small>
                  </div>
                  <div className="timeline-side">
                    <strong>{assembly.voteItems.length} pontos</strong>
                    <StatusPill label="Planeada" tone="neutral" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="panel">
          <header className="panel-header">
            <div className="panel-header-left">
              <Icon name="FileText" size={16} className="panel-header-icon" />
              <h3>Estado de templates legais</h3>
            </div>
            <span>Prontos para gerar PDF</span>
          </header>
          <ul className="check-list">
            {TEMPLATE_CHECKLIST.map((item) => (
              <li key={item.id}>
                <span>{item.label}</span>
                <StatusPill label={item.status === "ready" ? "Pronto" : "Em falta"} tone="success" />
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="panel">
        <header className="panel-header">
          <div className="panel-header-left">
            <Icon name="Vote" size={16} className="panel-header-icon" />
            <h3>Resumo de votações previstas</h3>
          </div>
          <span>Com base no seed de demo</span>
        </header>

        <div className="vote-grid">
          {assemblies.flatMap((assembly) =>
            assembly.voteItems.map((item) => (
              <article key={item.id} className="vote-card">
                <h4>{item.description}</h4>
                <p>{cleanLabel(item.votingRule)}</p>
                <div>
                  <span>A favor: {item.summary.for}</span>
                  <span>Contra: {item.summary.against}</span>
                  <span>Abstenção: {item.summary.abstention}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </article>
    </div>
  );
}
