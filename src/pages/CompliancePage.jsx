import { formatDate, cleanLabel, statusTone } from "../lib/formatters.js";
import { COMPLIANCE_TASKS } from "../lib/constants.js";
import StatusPill from "../components/shared/StatusPill.jsx";
import Icon from "../components/shared/Icon.jsx";

export default function CompliancePage({ auditEntries, auditQuery, setAuditQuery, auditDomain, setAuditDomain }) {
  return (
    <div className="stack-lg">
      <div className="split-grid">
        <article className="panel">
          <header className="panel-header">
            <div className="panel-header-left">
              <Icon name="ShieldCheck" size={16} className="panel-header-icon" />
              <h3>Checklist RGPD operacional</h3>
            </div>
            <span>Prioridade de lançamento</span>
          </header>
          <ul className="check-list">
            {COMPLIANCE_TASKS.map((task) => (
              <li key={task.title}>
                <div>
                  <p>{task.title}</p>
                  <small>{task.owner}</small>
                </div>
                <div className="timeline-side">
                  <small>{formatDate(task.dueDate)}</small>
                  <StatusPill label={task.status} tone={statusTone(task.status)} />
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <header className="panel-header">
            <div className="panel-header-left">
              <Icon name="FileText" size={16} className="panel-header-icon" />
              <h3>Templates jurídicos</h3>
            </div>
            <span>Pré-validados para edição</span>
          </header>
          <ul className="simple-list">
            <li>
              <span>Política de privacidade</span>
              <strong>v0.1</strong>
            </li>
            <li>
              <span>Termos de utilização</span>
              <strong>v0.1</strong>
            </li>
            <li>
              <span>DPA subcontratante</span>
              <strong>v0.1</strong>
            </li>
            <li>
              <span>Registo de incidente</span>
              <strong>v0.1</strong>
            </li>
            <li>
              <span>Resposta ao titular</span>
              <strong>v0.1</strong>
            </li>
          </ul>
        </article>
      </div>

      <article className="panel">
        <header className="panel-header">
          <div className="panel-header-left">
            <Icon name="ShieldCheck" size={16} className="panel-header-icon" />
            <h3>Trilho de auditoria operacional</h3>
          </div>
          <span>{auditEntries.length} eventos filtrados</span>
        </header>
        <div className="audit-toolbar">
          <select
            className="filter-select"
            value={auditDomain}
            onChange={(event) => setAuditDomain(event.target.value)}
            aria-label="Filtrar domínio de auditoria"
          >
            <option value="all">Todos os domínios</option>
            <option value="financeiro">Financeiro</option>
            <option value="operacional">Operacional</option>
            <option value="governance">Governação</option>
            <option value="cadastros">Cadastros</option>
            <option value="compliance">Conformidade</option>
            <option value="sistema">Sistema</option>
          </select>
          <div className="search-wrap compact">
            <Icon name="Search" size={15} className="search-input-icon" />
            <input
              type="search"
              value={auditQuery}
              onChange={(event) => setAuditQuery(event.target.value)}
              placeholder="Pesquisar por ação, detalhe ou ator"
            />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Ator</th>
                <th>Domínio</th>
                <th>Ação</th>
                <th>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {auditEntries.slice(0, 40).map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDate(entry.when)}</td>
                  <td>{entry.actor}</td>
                  <td>
                    <StatusPill label={cleanLabel(entry.domain)} tone={entry.tone} />
                  </td>
                  <td>{entry.action}</td>
                  <td>{entry.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel">
        <header className="panel-header">
          <div className="panel-header-left">
            <Icon name="ShieldCheck" size={16} className="panel-header-icon" />
            <h3>Trilho de auditoria recomendado para V1</h3>
          </div>
          <span>Campos mínimos</span>
        </header>
        <div className="audit-grid">
          <article>
            <h4>Financeiro</h4>
            <p>
              Criação/edição de encargos, alteração de valores, conciliação manual e anulações de pagamentos devem ser
              auditados com before/after.
            </p>
          </article>
          <article>
            <h4>Governance</h4>
            <p>
              Convocatórias, alterações de ordem de trabalhos, votações e atas publicadas exigem registo de ator,
              timestamp e justificação.
            </p>
          </article>
          <article>
            <h4>Dados pessoais</h4>
            <p>
              Operações de exportação, apagamento e retificação de dados devem ter trilho completo para resposta a
              pedidos do titular.
            </p>
          </article>
        </div>
      </article>
    </div>
  );
}
