import { useState } from "react";
import { formatDate, cleanLabel } from "../lib/formatters.js";
import { TEMPLATE_CHECKLIST } from "../lib/constants.js";
import StatusPill from "../components/shared/StatusPill.jsx";
import Icon from "../components/shared/Icon.jsx";

// ── Voting Section ──────────────────────────────────────────────────────
function VotingSection({ assembly, voteItems, voteResults, userRole, onOpenVoting, onCloseVoting, onCastVote }) {
  const isManager = userRole === "manager";
  const isVoting = assembly.status === "voting";
  const isHeld = assembly.status === "held" || assembly.status === "completed";

  if (!isVoting && !isHeld && !isManager) return null;

  return (
    <article className="panel">
      <header className="panel-header">
        <div className="panel-header-left">
          <Icon name="Vote" size={16} className="panel-header-icon" />
          <h3>
            {isVoting ? "Votação em curso" : isHeld ? "Resultados da votação" : "Votação"}
          </h3>
        </div>
        <div className="inline-actions">
          {isManager && !isVoting && !isHeld && (
            <button type="button" className="mini-btn" onClick={() => onOpenVoting(assembly.id)}>
              Abrir votação
            </button>
          )}
          {isManager && isVoting && (
            <button type="button" className="mini-btn" onClick={() => onCloseVoting(assembly.id)}>
              Encerrar votação
            </button>
          )}
        </div>
      </header>

      {(isVoting || isHeld) && voteItems?.items?.length > 0 && (
        <div className="stack-md" style={{ padding: "var(--space-md)" }}>
          {voteItems.items.map((item) => (
            <VoteItemCard
              key={item.index}
              item={item}
              assemblyId={assembly.id}
              isVoting={isVoting}
              userVotes={voteItems.userVotes || []}
              onCastVote={onCastVote}
            />
          ))}

          {/* Quorum global */}
          {voteItems.items.length > 0 && (
            <div style={{ padding: "var(--space-sm) 0", borderTop: "1px solid var(--border)" }}>
              <QuorumIndicator
                votedPermillage={voteItems.items[0]?.votedPermillage || 0}
                totalPermillage={voteItems.items[0]?.totalPermillage || 1}
                quorumMet={voteItems.items[0]?.quorumMet || false}
              />
            </div>
          )}
        </div>
      )}

      {isHeld && voteResults?.results?.length > 0 && (
        <div className="stack-md" style={{ padding: "var(--space-md)" }}>
          <h4 style={{ margin: 0 }}>Resumo final</h4>
          {voteResults.results.map((result) => (
            <VoteResultCard key={result.index} result={result} />
          ))}
        </div>
      )}
    </article>
  );
}

// ── Vote Item Card ──────────────────────────────────────────────────────
function VoteItemCard({ item, assemblyId, isVoting, userVotes, onCastVote }) {
  const [casting, setCasting] = useState(false);

  const existingVote = userVotes.find((v) => v.voteItemIndex === item.index);
  const totalVoted = item.tally.favor.permillage + item.tally.contra.permillage + item.tally.abstencao.permillage;
  const maxPermillage = Math.max(totalVoted, 1);

  const handleVote = async (vote) => {
    if (casting || existingVote) return;
    setCasting(true);
    try {
      await onCastVote(assemblyId, item.index, vote);
    } finally {
      setCasting(false);
    }
  };

  return (
    <div style={{ padding: "var(--space-sm)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
      <p style={{ fontWeight: 600, margin: "0 0 var(--space-xs) 0" }}>{item.question}</p>

      {/* Tally bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "var(--space-sm)" }}>
        <TallyBar label="A favor" count={item.tally.favor.count} permillage={item.tally.favor.permillage} max={maxPermillage} color="var(--success)" />
        <TallyBar label="Contra" count={item.tally.contra.count} permillage={item.tally.contra.permillage} max={maxPermillage} color="var(--danger, #dc3545)" />
        <TallyBar label="Abstenção" count={item.tally.abstencao.count} permillage={item.tally.abstencao.permillage} max={maxPermillage} color="var(--muted)" />
      </div>

      {/* Vote buttons */}
      {isVoting && !existingVote && (
        <div style={{ display: "flex", gap: "var(--space-xs)" }}>
          <button type="button" className="mini-btn" disabled={casting} onClick={() => handleVote("favor")}
            style={{ backgroundColor: "var(--success)", color: "#fff" }}>
            Favor
          </button>
          <button type="button" className="mini-btn" disabled={casting} onClick={() => handleVote("contra")}
            style={{ backgroundColor: "var(--danger, #dc3545)", color: "#fff" }}>
            Contra
          </button>
          <button type="button" className="mini-btn" disabled={casting} onClick={() => handleVote("abstencao")}>
            Abstenção
          </button>
        </div>
      )}

      {existingVote && (
        <p style={{ margin: 0, fontSize: "0.85em", color: "var(--muted)" }}>
          Votou: <strong>{existingVote.vote === "favor" ? "A favor" : existingVote.vote === "contra" ? "Contra" : "Abstenção"}</strong>
        </p>
      )}
    </div>
  );
}

// ── Tally Bar ───────────────────────────────────────────────────────────
function TallyBar({ label, count, permillage, max, color }) {
  const widthPercent = max > 0 ? Math.max((permillage / max) * 100, 0) : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", fontSize: "0.85em" }}>
      <span style={{ minWidth: 70 }}>{label}</span>
      <div style={{ flex: 1, height: 8, backgroundColor: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${widthPercent}%`, height: "100%", backgroundColor: color, borderRadius: 4, transition: "width 0.3s ease" }} />
      </div>
      <span style={{ minWidth: 80, textAlign: "right", fontSize: "0.8em" }}>{count} ({permillage}‰)</span>
    </div>
  );
}

// ── Quorum Indicator ────────────────────────────────────────────────────
function QuorumIndicator({ votedPermillage, totalPermillage, quorumMet }) {
  const percent = totalPermillage > 0 ? Math.round((votedPermillage / totalPermillage) * 1000) / 10 : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", fontSize: "0.9em" }}>
      <span style={{ fontWeight: 600 }}>Quórum:</span>
      <div style={{ flex: 1, maxWidth: 200, height: 8, backgroundColor: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(percent, 100)}%`, height: "100%", backgroundColor: quorumMet ? "var(--success)" : "var(--warning, #f0ad4e)", borderRadius: 4 }} />
      </div>
      <span>{percent}%</span>
      <StatusPill label={quorumMet ? "Atingido" : "Não atingido"} tone={quorumMet ? "success" : "warning"} />
    </div>
  );
}

// ── Vote Result Card ────────────────────────────────────────────────────
function VoteResultCard({ result }) {
  return (
    <div style={{ padding: "var(--space-sm)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
      <p style={{ fontWeight: 600, margin: "0 0 var(--space-xs) 0" }}>{result.question}</p>
      <div style={{ display: "flex", gap: "var(--space-md)", fontSize: "0.85em", flexWrap: "wrap" }}>
        <span>A favor: {result.tally.favor.count} ({result.tally.favor.percent}%)</span>
        <span>Contra: {result.tally.contra.count} ({result.tally.contra.percent}%)</span>
        <span>Abstenção: {result.tally.abstencao.count} ({result.tally.abstencao.percent}%)</span>
      </div>
      <div style={{ marginTop: "var(--space-xs)", fontSize: "0.8em", color: "var(--muted)" }}>
        Total: {result.totalVotes} votos | Permilagem votada: {result.votedPermillage}‰ / {result.totalPermillage}‰
        {" | "}Quórum: {result.quorumPercent}% {result.quorumMet ? "(atingido)" : "(não atingido)"}
      </div>
    </div>
  );
}

// ── Status label helper ─────────────────────────────────────────────────
function assemblyStatusLabel(status) {
  const map = {
    scheduled: "Planeada",
    convened: "Convocada",
    voting: "Em votação",
    in_progress: "Em curso",
    held: "Realizada",
    completed: "Concluída",
    cancelled: "Cancelada",
  };
  return map[status] || status;
}

function assemblyStatusTone(status) {
  const map = {
    scheduled: "neutral",
    convened: "info",
    voting: "warning",
    in_progress: "warning",
    held: "success",
    completed: "success",
    cancelled: "danger",
  };
  return map[status] || "neutral";
}

// ── Main Page ───────────────────────────────────────────────────────────
export default function AssembliesPage({
  assemblies,
  onOpenAction,
  userRole,
  onOpenVoting,
  onCloseVoting,
  onCastVote,
  voteItems,
  voteResults,
}) {
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
                    <StatusPill label={assemblyStatusLabel(assembly.status)} tone={assemblyStatusTone(assembly.status)} />
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

      {/* Voting sections for assemblies in voting or held status */}
      {assemblies
        .filter((a) => a.status === "voting" || a.status === "held" || a.status === "completed" || userRole === "manager")
        .map((assembly) => (
          <VotingSection
            key={`voting-${assembly.id}`}
            assembly={assembly}
            voteItems={voteItems?.[assembly.id] || null}
            voteResults={voteResults?.[assembly.id] || null}
            userRole={userRole}
            onOpenVoting={onOpenVoting || (() => {})}
            onCloseVoting={onCloseVoting || (() => {})}
            onCastVote={onCastVote || (() => {})}
          />
        ))}

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
                <h4>{item.question || item.description}</h4>
                <p>{cleanLabel(item.votingRule || item.type)}</p>
                <div>
                  <span>A favor: {item.summary?.for ?? 0}</span>
                  <span>Contra: {item.summary?.against ?? 0}</span>
                  <span>Abstenção: {item.summary?.abstention ?? 0}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </article>
    </div>
  );
}
