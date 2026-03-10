import { formatCurrency, formatDate, cleanLabel, statusTone } from "../lib/formatters.js";
import StatusPill from "../components/shared/StatusPill.jsx";
import Icon from "../components/shared/Icon.jsx";

const KPI_TONE_ICON = {
  accent: "TrendingUp",
  warning: "Wallet",
  danger: "AlertTriangle",
  neutral: "Clock",
  success: "CheckCircle2",
};

const FINANCE_KPIS = [
  { tone: "accent", label: "Emitido (período)", key: "emitted", detail: "Quotas e encargos totais" },
  { tone: "success", label: "Cobrado", key: "collected", detail: "Pagamentos registados" },
  { tone: "danger", label: "Em atraso", key: "overdue", detail: "Quotas vencidas" },
  { tone: "warning", label: "Saldo em aberto", key: "openBalance", detail: "Inclui parcial e vencido" },
];

export default function FinancePage({
  finance,
  fractions,
  financeRows,
  financePeriods,
  financeStatusFilter,
  setFinanceStatusFilter,
  financePeriodFilter,
  setFinancePeriodFilter,
  selectedFinanceCharge,
  selectedFinanceChargePayments,
  onSelectCharge,
  onOpenAction,
  onRegisterPayment,
  onDownloadReceipt,
}) {
  const byMonth = Object.entries(finance.monthly).sort(([a], [b]) => (a < b ? -1 : 1));
  const maxMonthly = Math.max(
    ...byMonth.map(([, values]) => Math.max(values.emitted, values.collected)),
    1
  );

  const fractionCodeById = Object.fromEntries(fractions.map((fraction) => [fraction.id, fraction.code]));

  return (
    <div className="stack-lg">
      <div className="kpi-grid finance-kpi-grid">
        {FINANCE_KPIS.map((card) => (
          <article key={card.key} className={`kpi-card tone-${card.tone}`}>
            <div className="kpi-card-header">
              <div className="kpi-icon-circle">
                <Icon name={KPI_TONE_ICON[card.tone] || "BarChart3"} size={18} />
              </div>
            </div>
            <p className="kpi-label">{card.label}</p>
            <strong className="kpi-value">{formatCurrency(finance[card.key])}</strong>
            <span className="kpi-detail">{card.detail}</span>
            <span className="kpi-pulse" aria-hidden="true" />
          </article>
        ))}
      </div>

      <div className="split-grid">
        <article className="panel">
          <header className="panel-header">
            <div className="panel-header-left">
              <Icon name="BarChart3" size={16} className="panel-header-icon" />
              <h3>Cobrança mensal</h3>
            </div>
            <span>Emitido vs recebido</span>
          </header>

          <div className="bar-chart">
            {byMonth.map(([month, values]) => (
              <div key={month} className="bar-row">
                <label>{month}</label>
                <div className="bar-track">
                  <div className="bar bar-emitted" style={{ width: `${(values.emitted / maxMonthly) * 100}%` }} />
                </div>
                <div className="bar-track">
                  <div className="bar bar-collected" style={{ width: `${(values.collected / maxMonthly) * 100}%` }} />
                </div>
                <small>
                  {formatCurrency(values.collected)} / {formatCurrency(values.emitted)}
                </small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <header className="panel-header">
            <div className="panel-header-left">
              <Icon name="PieChart" size={16} className="panel-header-icon" />
              <h3>Distribuição por método</h3>
            </div>
            <span>Pagamentos recebidos</span>
          </header>
          <ul className="simple-list">
            {Object.entries(finance.byMethod)
              .sort(([, a], [, b]) => b - a)
              .map(([method, total]) => (
                <li key={method}>
                  <span>{cleanLabel(method)}</span>
                  <strong>{formatCurrency(total)}</strong>
                </li>
              ))}
          </ul>
        </article>
      </div>

      <div className="finance-layout">
        <article className="panel">
          <header className="panel-header">
            <div className="panel-header-left">
              <Icon name="FileText" size={16} className="panel-header-icon" />
              <h3>Encargos pendentes</h3>
            </div>
            <div className="inline-actions">
              <span>{financeRows.length} linhas</span>
              <button type="button" className="mini-btn" onClick={() => onOpenAction("finance")}>
                <Icon name="Plus" size={12} /> Novo encargo
              </button>
            </div>
          </header>

          <div className="pill-group">
            <div className="search-input-wrap">
              <Icon name="Filter" size={14} className="search-input-icon" />
              <select
                className="filter-select"
                value={financeStatusFilter}
                onChange={(event) => setFinanceStatusFilter(event.target.value)}
                aria-label="Filtrar por estado financeiro"
              >
                <option value="all">Todos os estados</option>
                <option value="overdue">Em atraso</option>
                <option value="open">Em aberto</option>
                <option value="partially_paid">Parcial</option>
              </select>
            </div>
            <div className="search-input-wrap">
              <Icon name="Calendar" size={14} className="search-input-icon" />
              <select
                className="filter-select"
                value={financePeriodFilter}
                onChange={(event) => setFinancePeriodFilter(event.target.value)}
                aria-label="Filtrar por período"
              >
                <option value="all">Todos os períodos</option>
                {financePeriods.map((period) => (
                  <option key={period} value={period}>
                    {period}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fração</th>
                  <th>Período</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Em falta</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {financeRows.slice(0, 18).map((charge) => (
                  <tr
                    key={charge.id}
                    className={selectedFinanceCharge?.id === charge.id ? "row-selected" : ""}
                    onClick={() => onSelectCharge(charge.id)}
                  >
                    <td>{fractionCodeById[charge.fractionId]}</td>
                    <td>{charge.period}</td>
                    <td>{formatDate(charge.dueDate)}</td>
                    <td>{formatCurrency(charge.amount)}</td>
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

        <article className="panel finance-detail-panel">
          {!selectedFinanceCharge ? (
            <div className="empty-state-box">
              <div className="empty-state-icon-circle"><Icon name="Inbox" size={28} /></div>
              <p className="empty-state-title">Nenhum encargo selecionado</p>
              <p className="empty-state-subtitle">Seleciona um encargo na tabela para ver o detalhe.</p>
            </div>
          ) : (
            <>
              <header className="panel-header">
                <div className="panel-header-left">
                  <Icon name="Receipt" size={16} className="panel-header-icon" />
                  <h3>Detalhe do encargo</h3>
                </div>
                <div className="inline-actions">
                  <StatusPill label={cleanLabel(selectedFinanceCharge.status)} tone={statusTone(selectedFinanceCharge.status)} />
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => onRegisterPayment(selectedFinanceCharge.id)}
                    disabled={selectedFinanceCharge.missing <= 0.009}
                  >
                    <Icon name="Plus" size={12} /> Registar pagamento
                  </button>
                </div>
              </header>

              <div className="issue-meta-grid">
                <span>
                  Fração
                  <strong>{fractionCodeById[selectedFinanceCharge.fractionId] || selectedFinanceCharge.fractionId}</strong>
                </span>
                <span>
                  Período
                  <strong>{selectedFinanceCharge.period}</strong>
                </span>
                <span>
                  Vencimento
                  <strong>{formatDate(selectedFinanceCharge.dueDate)}</strong>
                </span>
                <span>
                  Valor
                  <strong>{formatCurrency(selectedFinanceCharge.amount)}</strong>
                </span>
                <span>
                  Pago
                  <strong>{formatCurrency(selectedFinanceCharge.amount - selectedFinanceCharge.missing)}</strong>
                </span>
                <span>
                  Em falta
                  <strong>{formatCurrency(selectedFinanceCharge.missing)}</strong>
                </span>
              </div>

              <div className="issue-costs">
                <h4>Pagamentos associados</h4>
                {selectedFinanceChargePayments.length === 0 ? (
                  <div className="empty-state-box">
                    <div className="empty-state-icon-circle"><Icon name="Inbox" size={28} /></div>
                    <p className="empty-state-title">Sem pagamentos</p>
                    <p className="empty-state-subtitle">Sem pagamentos registados para este encargo.</p>
                  </div>
                ) : (
                  <ul className="issue-timeline">
                    {selectedFinanceChargePayments.map((payment) => (
                      <li key={payment.id}>
                        <div>
                          <p>{formatCurrency(payment.amount)}</p>
                          <small>
                            {cleanLabel(payment.method)} | Ref. {payment.reference}
                            {payment.hasReceipt ? " | Recibo disponível" : ""}
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
                              <Icon name="Download" size={12} /> Recibo PDF
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
