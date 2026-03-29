import { motion } from "framer-motion";
import { formatCurrency, formatDate, cleanLabel, statusTone } from "../lib/formatters.js";
import StatusPill from "../components/shared/StatusPill.jsx";
import Icon from "../components/shared/Icon.jsx";
import EmptyState from "../components/shared/EmptyState.jsx";
import ProgressRing from "../components/shared/ProgressRing.jsx";

const KPI_TONE_ICON = {
  accent: "TrendingUp",
  warning: "Wallet",
  danger: "AlertTriangle",
  neutral: "Clock",
  success: "CheckCircle2",
};

export default function DashboardPage({
  cards,
  floorMatrix,
  nextDeadlines,
  disableMotion = false,
  activityLog,
  onboardingChecklist,
  onboardingCompletion,
  onOpenAction,
}) {
  const renderKpiCard = (card, Wrapper = "article", extraProps = {}) => (
    <Wrapper key={card.label} className={`kpi-card tone-${card.tone}`} {...extraProps}>
      <div className="kpi-card-header">
        <div className="kpi-icon-circle">
          <Icon name={KPI_TONE_ICON[card.tone] || "BarChart3"} size={18} />
        </div>
      </div>
      <p className="kpi-label">{card.label}</p>
      <strong className="kpi-value">{card.value}</strong>
      <span className="kpi-detail">{card.detail}</span>
      <span className="kpi-pulse" aria-hidden="true" />
    </Wrapper>
  );

  return (
    <div className="stack-lg">
      {disableMotion ? (
        <div className="kpi-grid">
          {cards.map((card) => renderKpiCard(card))}
        </div>
      ) : (
        <motion.div
          className="kpi-grid"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.07 } },
          }}
        >
          {cards.map((card) =>
            renderKpiCard(card, motion.article, {
              variants: {
                hidden: { opacity: 0, y: 20, scale: 0.95 },
                show: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { type: "spring", stiffness: 400, damping: 25 },
                },
              },
              whileHover: { y: -4, scale: 1.02, transition: { type: "spring", stiffness: 400, damping: 20 } },
              whileTap: { scale: 0.98 },
            })
          )}
        </motion.div>
      )}

      <div className="split-grid">
        <motion.article
          className="panel"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <header className="panel-header">
            <div className="panel-header-left">
              <Icon name="Calendar" size={16} className="panel-header-icon" />
              <h3>Agenda de execução</h3>
            </div>
            <span>Próximos 30 dias</span>
          </header>
          <ul className="timeline-list">
            {nextDeadlines.map((item) => (
              <li key={`${item.type}-${item.title}`}>
                <div>
                  <p>{item.title}</p>
                  <small>{formatDate(item.date)}</small>
                </div>
                <div className="timeline-side">
                  {item.amount ? <strong>{formatCurrency(item.amount)}</strong> : <strong>{cleanLabel(item.type)}</strong>}
                  <StatusPill label={cleanLabel(item.status)} tone={statusTone(item.status)} />
                </div>
              </li>
            ))}
          </ul>
        </motion.article>

        <motion.article
          className="panel"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.06 }}
        >
          <header className="panel-header">
            <div className="panel-header-left">
              <Icon name="Layers" size={16} className="panel-header-icon" />
              <h3>Mapa por piso</h3>
            </div>
            <span>Habitação vs não habitação</span>
          </header>
          <div className="building-map">
            {floorMatrix.map((floor) => (
              <div key={floor.floor} className="floor-row">
                <span>Piso {floor.floor}</span>
                <div>
                  {Array.from({ length: floor.total }).map((_, index) => {
                    const isResidential = index < floor.residential;
                    return (
                      <i
                        key={`${floor.floor}-${index}`}
                        className={isResidential ? "slot residential" : "slot mixed"}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </motion.article>
      </div>

      <motion.article
        className="panel"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <header className="panel-header">
          <div className="panel-header-left">
            <ProgressRing
              progress={(onboardingCompletion / Math.max(onboardingChecklist.length, 1)) * 100}
              size={36}
              strokeWidth={3}
            >
              <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--brand-deep)" }}>
                {onboardingCompletion}/{onboardingChecklist.length}
              </span>
            </ProgressRing>
            <h3>Checklist de onboarding</h3>
          </div>
          <span>
            {onboardingCompletion}/{onboardingChecklist.length} concluídos
          </span>
        </header>
        <div className="onboarding-progress" role="presentation">
          <i style={{ width: `${(onboardingCompletion / Math.max(onboardingChecklist.length, 1)) * 100}%` }} />
        </div>
        <ul className="onboarding-list">
          {onboardingChecklist.map((item) => (
            <li key={item.id} className={item.done ? "done" : ""}>
              <div>
                <p>{item.label}</p>
                <small>{item.detail}</small>
              </div>
              <div className="timeline-side">
                <StatusPill label={item.done ? "Concluído" : "Em falta"} tone={item.done ? "success" : "warning"} />
                <button type="button" className="mini-btn" onClick={item.action}>
                  {item.done ? "Ver" : item.cta}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </motion.article>

      <motion.article
        className="panel"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <header className="panel-header">
          <div className="panel-header-left">
            <Icon name="Activity" size={16} className="panel-header-icon" />
            <h3>Atividade recente</h3>
          </div>
          <div className="inline-actions">
            <button type="button" className="mini-btn" onClick={() => onOpenAction("issues")}>
              <Icon name="Wrench" size={12} /> Ocorrência
            </button>
            <button type="button" className="mini-btn" onClick={() => onOpenAction("finance")}>
              <Icon name="Wallet" size={12} /> Encargo
            </button>
            <button type="button" className="mini-btn" onClick={() => onOpenAction("fractions")}>
              <Icon name="Building2" size={12} /> Fração
            </button>
          </div>
        </header>
        {activityLog.length === 0 ? (
          <EmptyState
            variant="default"
            title="Ainda sem registos"
            subtitle="Usa os botões acima para criar uma fração, encargo ou ocorrência."
          />
        ) : (
          <ul className="activity-list">
            {activityLog.slice(0, 6).map((item) => (
              <li key={item.id}>
                <div>
                  <p>{item.title}</p>
                  <small>{item.detail}</small>
                </div>
                <div className="timeline-side">
                  <small>{formatDate(item.createdAt)}</small>
                  <StatusPill label={cleanLabel(item.tone)} tone={item.tone} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </motion.article>
    </div>
  );
}
