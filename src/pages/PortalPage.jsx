import { formatCurrency, formatDate, cleanLabel, statusTone } from "../lib/formatters.js";
import { PRIORITY_LABEL, ISSUE_STATUS_LABEL } from "../lib/constants.js";
import StatusPill from "../components/shared/StatusPill.jsx";
import Icon from "../components/shared/Icon.jsx";

export default function PortalPage({
  selectedFraction,
  fractions,
  ownerByFraction,
  balances,
  portalChargeRows,
  portalPayments,
  portalOpenIssues,
  portalVisibleDocuments,
  portalNextCharge,
  portalCollectedYear,
  onSelectFraction,
  onOpenAction,
  onExport,
  onDownloadDocument,
  onDownloadReceipt,
}) {
  return (
    <div className="stack-lg">
      <article className="panel">
        <header className="panel-header split-header">
          <div className="panel-header-left">
            <Icon name="Users" size={16} className="panel-header-icon" />
            <h3>Conta corrente do condómino</h3>
          </div>
          <div className="inline-actions stretch-right">
            <select
              className="filter-select"
              value={selectedFraction?.id || ""}
              onChange={(event) => onSelectFraction(event.target.value)}
              aria-label="Selecionar fração do portal"
            >
              {fractions.map((fraction) => (
                <option key={fraction.id} value={fraction.id}>
                  {fraction.code} | {ownerByFraction[fraction.id] || "Sem titular"}
                </option>
              ))}
            </select>
            <button type="button" className="mini-btn" onClick={() => onOpenAction("issues")}>
              <Icon name="Plus" size={14} /> Abrir ocorrência
            </button>
            <button type="button" className="ghost-btn" onClick={onExport}>
              <Icon name="Download" size={14} /> Exportar extrato
            </button>
          </div>
        </header>

        {selectedFraction ? (
          <div className="kpi-grid portal-kpi-grid">
            <article className="kpi-card tone-warning">
              <div className="kpi-card-header">
                <div className="kpi-icon-circle tone-warning"><Icon name="Wallet" size={18} /></div>
                <span className="kpi-label">Saldo atual</span>
              </div>
              <span className="kpi-value">{formatCurrency(balances[selectedFraction.id]?.balance || 0)}</span>
              <span className="kpi-detail">{ownerByFraction[selectedFraction.id] || "Sem titular"}</span>
              <span className="kpi-pulse tone-warning" />
            </article>
            <article className="kpi-card tone-accent">
              <div className="kpi-card-header">
                <div className="kpi-icon-circle tone-accent"><Icon name="TrendingUp" size={18} /></div>
                <span className="kpi-label">Próxima quota</span>
              </div>
              <span className="kpi-value">{portalNextCharge ? formatCurrency(portalNextCharge.missing) : formatCurrency(0)}</span>
              <span className="kpi-detail">{portalNextCharge ? formatDate(portalNextCharge.dueDate) : "Sem encargos pendentes"}</span>
              <span className="kpi-pulse tone-accent" />
            </article>
            <article className="kpi-card tone-success">
              <div className="kpi-card-header">
                <div className="kpi-icon-circle tone-success"><Icon name="CheckCircle2" size={18} /></div>
                <span className="kpi-label">Pagamentos no período</span>
              </div>
              <span className="kpi-value">{formatCurrency(portalCollectedYear)}</span>
              <span className="kpi-detail">{portalPayments.length} movimentos registados</span>
              <span className="kpi-pulse tone-success" />
            </article>
            <article className="kpi-card tone-danger">
              <div className="kpi-card-header">
                <div className="kpi-icon-circle tone-danger"><Icon name="AlertTriangle" size={18} /></div>
                <span className="kpi-label">Ocorrências ativas</span>
              </div>
              <span className="kpi-value">{portalOpenIssues.length}</span>
              <span className="kpi-detail">Inclui área comum e fração</span>
              <span className="kpi-pulse tone-danger" />
            </article>
          </div>
        ) : (
          <div className="empty-state-box">
            <div className="empty-state-icon-circle"><Icon name="Inbox" size={28} /></div>
            <p className="empty-state-title">Sem fração</p>
            <p className="empty-state-subtitle">Sem fração selecionada.</p>
          </div>
        )}
      </article>

      <div className="split-grid">
        <article className="panel">
          <header className="panel-header">
            <div className="panel-header-left">
              <Icon name="Wallet" size={16} className="panel-header-icon" />
              <h3>Extrato de encargos</h3>
            </div>
            <span>{portalChargeRows.length} movimentos</span>
          </header>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                <th>Período</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Pago</th>
                  <th>Em falta</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {portalChargeRows.slice(0, 12).map((charge) => (
                  <tr key={charge.id}>
                    <td>{charge.period}</td>
                    <td>{formatDate(charge.dueDate)}</td>
                    <td>{formatCurrency(charge.amount)}</td>
                    <td>{formatCurrency(charge.paid)}</td>
                    <td>{formatCurrency(charge.missing)}</td>
                    <td>
                      <StatusPill label={cleanLabel(charge.status)} tone={statusTone(charge.status)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <header className="panel-header">
            <div className="panel-header-left">
              <Icon name="Clock" size={16} className="panel-header-icon" />
              <h3>Pagamentos recentes</h3>
            </div>
            <span>Últimos lançamentos</span>
          </header>
          {portalPayments.length === 0 ? (
            <div className="empty-state-box">
              <div className="empty-state-icon-circle"><Icon name="Inbox" size={28} /></div>
              <p className="empty-state-title">Sem pagamentos</p>
              <p className="empty-state-subtitle">Ainda sem pagamentos registados.</p>
            </div>
          ) : (
            <ul className="timeline-list">
              {portalPayments.slice(0, 8).map((payment) => (
                <li key={payment.id}>
                  <div>
                    <p>{formatCurrency(payment.amount)}</p>
                    <small>
                      {cleanLabel(payment.method)} | Ref. {payment.reference}
                    </small>
                  </div>
                  <div className="timeline-side">
                    <small>{formatDate(payment.paidAt)}</small>
                    <div className="inline-actions">
                      <StatusPill label="Pago" tone="success" />
                      <button
                        type="button"
                        className="mini-btn"
                        onClick={() => onDownloadReceipt?.(payment.id)}
                        disabled={!onDownloadReceipt}
                      >
                        <Icon name="Download" size={14} /> Recibo
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <div className="split-grid">
        <article className="panel">
          <header className="panel-header">
            <div className="panel-header-left">
              <Icon name="Wrench" size={16} className="panel-header-icon" />
              <h3>Ocorrências acompanhadas</h3>
            </div>
            <span>{portalOpenIssues.length} em curso</span>
          </header>
          {portalOpenIssues.length === 0 ? (
            <div className="empty-state-box">
              <div className="empty-state-icon-circle"><Icon name="Inbox" size={28} /></div>
              <p className="empty-state-title">Sem ocorrências</p>
              <p className="empty-state-subtitle">Sem ocorrências abertas para esta fração.</p>
            </div>
          ) : (
            <ul className="issue-timeline">
              {portalOpenIssues.slice(0, 6).map((issue) => (
                <li key={issue.id}>
                  <div>
                    <p>{issue.title}</p>
                    <small>
                      {cleanLabel(issue.category)} | {PRIORITY_LABEL[issue.priority]}
                    </small>
                  </div>
                  <div className="timeline-side">
                    <small>{formatDate(issue.openedAt)}</small>
                    <StatusPill label={ISSUE_STATUS_LABEL[issue.status]} tone={statusTone(issue.status)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="panel">
          <header className="panel-header">
            <div className="panel-header-left">
              <Icon name="FolderOpen" size={16} className="panel-header-icon" />
              <h3>Documentos do portal</h3>
            </div>
            <span>{portalVisibleDocuments.length} visíveis</span>
          </header>
          <ul className="simple-list">
            {portalVisibleDocuments.slice(0, 8).map((document) => (
              <li key={document.id} className="simple-list-item-action">
                <div className="doc-list-copy">
                  <span>{document.title}</span>
                  <small>
                    {cleanLabel(document.category)} | {formatDate(document.uploadedAt)}
                  </small>
                </div>
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => onDownloadDocument?.(document)}
                  disabled={!onDownloadDocument}
                  aria-label={`Descarregar documento ${document.title}`}
                >
                  <Icon name="Download" size={14} /> Descarregar
                </button>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </div>
  );
}
