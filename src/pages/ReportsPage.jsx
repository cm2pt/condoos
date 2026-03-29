import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { formatCurrency, formatDate } from "../lib/formatters.js";
import Icon from "../components/shared/Icon.jsx";
import EmptyState from "../components/shared/EmptyState.jsx";
import {
  fetchAnnualSummary,
  fetchOwnerStatement,
  downloadAnnualSummaryCsv,
  downloadOwnerStatementCsv,
  downloadOwnerStatementPdf,
} from "../services/condoosApi.js";

export default function ReportsPage({ session, fractions }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [annualSummary, setAnnualSummary] = useState(null);
  const [annualLoading, setAnnualLoading] = useState(false);
  const [annualError, setAnnualError] = useState(null);

  const [statementFractionId, setStatementFractionId] = useState("");
  const [ownerStatement, setOwnerStatement] = useState(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState(null);

  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    yearOptions.push(y);
  }

  // Load annual summary when year changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setAnnualLoading(true);
      setAnnualError(null);
      try {
        const data = await fetchAnnualSummary(session, year);
        if (!cancelled) setAnnualSummary(data);
      } catch (err) {
        if (!cancelled) setAnnualError(err.message);
      } finally {
        if (!cancelled) setAnnualLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [session, year]);

  // Load owner statement when fraction or year changes
  useEffect(() => {
    if (!statementFractionId) {
      setOwnerStatement(null);
      return;
    }
    let cancelled = false;
    async function load() {
      setStatementLoading(true);
      setStatementError(null);
      try {
        const data = await fetchOwnerStatement(session, statementFractionId, year);
        if (!cancelled) setOwnerStatement(data);
      } catch (err) {
        if (!cancelled) setStatementError(err.message);
      } finally {
        if (!cancelled) setStatementLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [session, statementFractionId, year]);

  const handleDownloadAnnualCsv = useCallback(async () => {
    try {
      const { blob, filename } = await downloadAnnualSummaryCsv(session, year);
      triggerDownload(blob, filename);
    } catch {
      // silently fail
    }
  }, [session, year]);

  const handleDownloadStatementCsv = useCallback(async () => {
    if (!statementFractionId) return;
    try {
      const { blob, filename } = await downloadOwnerStatementCsv(session, statementFractionId, year);
      triggerDownload(blob, filename);
    } catch {
      // silently fail
    }
  }, [session, statementFractionId, year]);

  const handleDownloadStatementPdf = useCallback(async () => {
    if (!statementFractionId) return;
    try {
      const { blob, filename } = await downloadOwnerStatementPdf(session, statementFractionId, year);
      triggerDownload(blob, filename);
    } catch {
      // silently fail
    }
  }, [session, statementFractionId, year]);

  const maxEmitted = annualSummary
    ? Math.max(...annualSummary.months.map((m) => Math.max(m.emitted, m.collected)), 1)
    : 1;

  return (
    <div className="stack-lg">
      {/* Year selector */}
      <div className="pill-group">
        <div className="search-input-wrap">
          <Icon name="Calendar" size={14} className="search-input-icon" />
          <select
            className="filter-select"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label="Selecionar ano"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Annual summary card */}
      <motion.article
        className="panel"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <header className="panel-header">
          <div className="panel-header-left">
            <Icon name="BarChart3" size={16} className="panel-header-icon" />
            <h3>Resumo anual</h3>
          </div>
          <div className="inline-actions">
            <button type="button" className="mini-btn" onClick={handleDownloadAnnualCsv} disabled={annualLoading}>
              <Icon name="Download" size={12} /> CSV
            </button>
          </div>
        </header>

        {annualLoading && <p className="loading-text">A carregar...</p>}
        {annualError && <p className="error-text">{annualError}</p>}

        {annualSummary && !annualLoading && (
          <>
            <motion.div
              className="kpi-grid"
              style={{ marginBottom: "1rem" }}
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
            >
              <motion.article
                className="kpi-card tone-accent"
                variants={{ hidden: { opacity: 0, y: 12, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } }}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <p className="kpi-label">Emitido</p>
                <strong className="kpi-value">{formatCurrency(annualSummary.totals.emitted)}</strong>
                <span className="kpi-pulse" aria-hidden="true" />
              </motion.article>
              <motion.article
                className="kpi-card tone-success"
                variants={{ hidden: { opacity: 0, y: 12, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } }}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <p className="kpi-label">Cobrado</p>
                <strong className="kpi-value">{formatCurrency(annualSummary.totals.collected)}</strong>
                <span className="kpi-pulse" aria-hidden="true" />
              </motion.article>
              <motion.article
                className="kpi-card tone-warning"
                variants={{ hidden: { opacity: 0, y: 12, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } }}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <p className="kpi-label">Taxa de cobranca</p>
                <strong className="kpi-value">{(annualSummary.totals.rate * 100).toFixed(1)}%</strong>
                <span className="kpi-pulse" aria-hidden="true" />
              </motion.article>
            </motion.div>

            <div className="bar-chart">
              {annualSummary.months.map((m) => (
                <div key={m.month} className="bar-row">
                  <label>{m.label}</label>
                  <div className="bar-track">
                    <div className="bar bar-emitted" style={{ width: `${(m.emitted / maxEmitted) * 100}%` }} />
                  </div>
                  <div className="bar-track">
                    <div className="bar bar-collected" style={{ width: `${(m.collected / maxEmitted) * 100}%` }} />
                  </div>
                  <small>
                    {formatCurrency(m.collected)} / {formatCurrency(m.emitted)}
                  </small>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.article>

      {/* Owner statement card */}
      <motion.article
        className="panel"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <header className="panel-header">
          <div className="panel-header-left">
            <Icon name="FileText" size={16} className="panel-header-icon" />
            <h3>Extrato de proprietario</h3>
          </div>
          <div className="inline-actions">
            <button
              type="button"
              className="mini-btn"
              onClick={handleDownloadStatementCsv}
              disabled={!statementFractionId || statementLoading}
            >
              <Icon name="Download" size={12} /> CSV
            </button>
            <button
              type="button"
              className="mini-btn"
              onClick={handleDownloadStatementPdf}
              disabled={!statementFractionId || statementLoading}
            >
              <Icon name="Download" size={12} /> PDF
            </button>
          </div>
        </header>

        <div className="pill-group">
          <div className="search-input-wrap">
            <Icon name="Building2" size={14} className="search-input-icon" />
            <select
              className="filter-select"
              value={statementFractionId}
              onChange={(e) => setStatementFractionId(e.target.value)}
              aria-label="Selecionar fracao"
            >
              <option value="">Selecionar fracao...</option>
              {fractions.map((f) => (
                <option key={f.id} value={f.id}>{f.code}</option>
              ))}
            </select>
          </div>
        </div>

        {statementLoading && <p className="loading-text">A carregar...</p>}
        {statementError && <p className="error-text">{statementError}</p>}

        {ownerStatement && !statementLoading && (
          <>
            <motion.div
              className="kpi-grid"
              style={{ marginBottom: "1rem" }}
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
            >
              <motion.article
                className="kpi-card tone-accent"
                variants={{ hidden: { opacity: 0, y: 12, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } }}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <p className="kpi-label">Encargos</p>
                <strong className="kpi-value">{formatCurrency(ownerStatement.totalCharges)}</strong>
                <span className="kpi-pulse" aria-hidden="true" />
              </motion.article>
              <motion.article
                className="kpi-card tone-success"
                variants={{ hidden: { opacity: 0, y: 12, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } }}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <p className="kpi-label">Pagamentos</p>
                <strong className="kpi-value">{formatCurrency(ownerStatement.totalPayments)}</strong>
                <span className="kpi-pulse" aria-hidden="true" />
              </motion.article>
              <motion.article
                className="kpi-card tone-warning"
                variants={{ hidden: { opacity: 0, y: 12, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } }}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <p className="kpi-label">Saldo</p>
                <strong className="kpi-value">{formatCurrency(ownerStatement.finalBalance)}</strong>
                <span className="kpi-pulse" aria-hidden="true" />
              </motion.article>
            </motion.div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Descricao</th>
                    <th>Valor</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {ownerStatement.rows.map((row, i) => (
                    <tr key={i}>
                      <td>{formatDate(row.date)}</td>
                      <td>{row.type}</td>
                      <td>{row.description}</td>
                      <td>{formatCurrency(row.amount)}</td>
                      <td>{formatCurrency(row.balance)}</td>
                    </tr>
                  ))}
                  {ownerStatement.rows.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center" }}>Sem movimentos no periodo selecionado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!statementFractionId && !statementLoading && (
          <EmptyState
            icon="Building2"
            title="Seleciona uma fração"
            subtitle="Escolhe uma fração para visualizar o extrato."
          />
        )}
      </motion.article>
    </div>
  );
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
