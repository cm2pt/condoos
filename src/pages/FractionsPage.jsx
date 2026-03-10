import { formatCurrency, formatDate, cleanLabel, statusTone } from "../lib/formatters.js";
import StatusPill from "../components/shared/StatusPill.jsx";
import Icon from "../components/shared/Icon.jsx";

export default function FractionsPage({
  fractions,
  ownerByFraction,
  balances,
  fractionFilter,
  setFractionFilter,
  fractionFloorFilter,
  setFractionFloorFilter,
  floorOptions,
  fractionDebtFilter,
  setFractionDebtFilter,
  fractionQuery,
  setFractionQuery,
  typeSummary,
  selectedFraction,
  selectedFractionCharges,
  selectedFractionPaymentsTotal,
  onSelectFraction,
  onOpenAction,
}) {
  const typePills = [
    { key: "all", label: "Todas", count: Object.values(typeSummary).reduce((sum, value) => sum + value, 0) },
    { key: "habitacao", label: "Habitação", count: typeSummary.habitacao || 0 },
    { key: "loja", label: "Loja", count: typeSummary.loja || 0 },
    { key: "estacionamento", label: "Estacionamento", count: typeSummary.estacionamento || 0 },
    { key: "arrecadacao", label: "Arrecadação", count: typeSummary.arrecadacao || 0 },
  ];

  return (
    <div className="stack-lg">
      <article className="panel">
        <header className="panel-header split-header">
          <div className="panel-header-left">
            <Icon name="SlidersHorizontal" size={16} className="panel-header-icon" />
            <h3>Pesquisa e filtros</h3>
          </div>
          <div className="inline-actions stretch-right">
            <button type="button" className="mini-btn" onClick={() => onOpenAction("fractions")}>
              <Icon name="Plus" size={12} /> Nova fração
            </button>
            <div className="search-wrap compact">
              <Icon name="Search" size={15} className="search-input-icon" />
              <input
                type="search"
                value={fractionQuery}
                onChange={(event) => setFractionQuery(event.target.value)}
                placeholder="Filtrar por fração ou titular"
              />
            </div>
          </div>
        </header>

        <div className="pill-group">
          {typePills.map((pill) => (
            <button
              key={pill.key}
              type="button"
              className={pill.key === fractionFilter ? "filter-pill active" : "filter-pill"}
              onClick={() => setFractionFilter(pill.key)}
            >
              {pill.label}
              <span>{pill.count}</span>
            </button>
          ))}
          <select
            className="filter-select"
            value={fractionFloorFilter}
            onChange={(event) => setFractionFloorFilter(event.target.value)}
            aria-label="Filtrar por piso"
          >
            <option value="all">Todos os pisos</option>
            {floorOptions.map((floor) => (
              <option key={floor} value={floor}>
                Piso {floor}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            value={fractionDebtFilter}
            onChange={(event) => setFractionDebtFilter(event.target.value)}
            aria-label="Filtrar por saldo"
          >
            <option value="all">Com e sem dívida</option>
            <option value="in_debt">Apenas com dívida</option>
            <option value="regular">Apenas regularizadas</option>
          </select>
        </div>
      </article>

      <div className="fractions-layout">
        <article className="panel">
          <header className="panel-header">
            <div className="panel-header-left">
              <Icon name="LayoutGrid" size={16} className="panel-header-icon" />
              <h3>Mapa de frações</h3>
            </div>
            <span>{fractions.length} resultados</span>
          </header>

          {fractions.length === 0 ? (
            <div className="empty-state-box">
              <div className="empty-state-icon-circle">
                <Icon name="Building2" size={28} />
              </div>
              <p className="empty-state-title">Nenhuma fração encontrada</p>
              <p className="empty-state-subtitle">Ajusta os filtros ou cria uma nova fração.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fração</th>
                    <th>Piso</th>
                    <th>Tipo</th>
                    <th>Titologia</th>
                    <th>Titular principal</th>
                    <th>Quota mensal</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {fractions.map((fraction) => {
                    const balance = balances[fraction.id]?.balance || 0;
                    return (
                      <tr
                        key={fraction.id}
                        className={selectedFraction?.id === fraction.id ? "row-selected" : ""}
                        onClick={() => onSelectFraction(fraction.id)}
                      >
                        <td>{fraction.code}</td>
                        <td>{fraction.floorNumber}</td>
                        <td>{cleanLabel(fraction.type)}</td>
                        <td>{fraction.typology}</td>
                        <td>{ownerByFraction[fraction.id] || "Sem titular"}</td>
                        <td>{formatCurrency(fraction.monthlyFee)}</td>
                        <td>
                          <StatusPill
                            label={balance > 0 ? formatCurrency(balance) : "Sem dívida"}
                            tone={balance > 0 ? "warning" : "success"}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="panel fraction-detail-panel">
          {!selectedFraction ? (
            <div className="empty-state-box">
              <div className="empty-state-icon-circle">
                <Icon name="Eye" size={28} />
              </div>
              <p className="empty-state-title">Nenhuma fração selecionada</p>
              <p className="empty-state-subtitle">Seleciona uma fração para ver detalhe.</p>
            </div>
          ) : (
            <>
              <header className="panel-header">
                <div className="panel-header-left">
                  <Icon name="FileText" size={16} className="panel-header-icon" />
                  <h3>Detalhe da fração</h3>
                </div>
                <StatusPill
                  label={formatCurrency(balances[selectedFraction.id]?.balance || 0)}
                  tone={(balances[selectedFraction.id]?.balance || 0) > 0 ? "warning" : "success"}
                />
              </header>

              <div className="issue-meta-grid">
                <span>
                  Fração
                  <strong>{selectedFraction.code}</strong>
                </span>
                <span>
                  Piso
                  <strong>{selectedFraction.floorNumber}</strong>
                </span>
                <span>
                  Tipo
                  <strong>{cleanLabel(selectedFraction.type)}</strong>
                </span>
                <span>
                  Tipologia
                  <strong>{selectedFraction.typology}</strong>
                </span>
                <span>
                  Titular principal
                  <strong>{ownerByFraction[selectedFraction.id] || "Sem titular"}</strong>
                </span>
                <span>
                  Área / Permilagem
                  <strong>
                    {selectedFraction.privateAreaM2} m2 | {selectedFraction.permillage}
                  </strong>
                </span>
                <span>
                  Quota mensal
                  <strong>{formatCurrency(selectedFraction.monthlyFee)}</strong>
                </span>
                <span>
                  Pago acumulado
                  <strong>{formatCurrency(selectedFractionPaymentsTotal)}</strong>
                </span>
              </div>

              <div className="issue-costs">
                <h4><Icon name="Receipt" size={14} className="panel-header-icon" /> Últimos encargos</h4>
                {selectedFractionCharges.length === 0 ? (
                  <div className="empty-state-box">
                    <div className="empty-state-icon-circle">
                      <Icon name="Inbox" size={28} />
                    </div>
                    <p className="empty-state-title">Sem encargos</p>
                    <p className="empty-state-subtitle">Esta fração ainda não tem encargos registados.</p>
                  </div>
                ) : (
                  <ul className="issue-timeline">
                    {selectedFractionCharges.slice(0, 6).map((charge) => (
                      <li key={charge.id}>
                        <div>
                          <p>{charge.period}</p>
                          <small>
                            {formatCurrency(charge.amount)} | Em falta {formatCurrency(charge.missing)}
                          </small>
                        </div>
                        <div className="timeline-side">
                          <small>{formatDate(charge.dueDate)}</small>
                          <StatusPill label={cleanLabel(charge.status)} tone={statusTone(charge.status)} />
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
