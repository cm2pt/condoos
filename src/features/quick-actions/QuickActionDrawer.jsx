import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cleanLabel } from "../../lib/formatters.js";
import Icon from "../../components/shared/Icon.jsx";

const TYPE_ICON = {
  fractions: "Building2",
  finance: "Wallet",
  issues: "Wrench",
  assemblies: "Vote",
};

export default function QuickActionDrawer({
  open,
  actionType,
  allowedActionTypes,
  onActionTypeChange,
  onClose,
  onSubmit,
  fractions,
  allowCommonIssueArea = true,
  issueCategories = [],
}) {
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fractionForm, setFractionForm] = useState({
    code: "",
    floorNumber: "1",
    type: "habitacao",
    typology: "T2",
    monthlyFee: "65",
    privateAreaM2: "82",
    permillage: "32",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    ownerTaxNumber: "",
  });
  const [chargeForm, setChargeForm] = useState({
    fractionId: fractions[0]?.id || "",
    kind: "quota",
    period: "2026-03",
    dueDate: "2026-03-08",
    amount: "60",
  });
  const [issueForm, setIssueForm] = useState({
    title: "",
    category: "infiltracao",
    priority: "medium",
    fractionId: allowCommonIssueArea ? "common" : fractions[0]?.id || "",
    description: "",
  });
  const [assemblyForm, setAssemblyForm] = useState({
    meetingType: "ordinary",
    scheduledAt: "2026-03-25T20:30",
    location: "Sala comum do condomínio",
  });

  const orderedFractions = useMemo(() => {
    return [...fractions].sort((a, b) =>
      a.floorNumber === b.floorNumber ? a.code.localeCompare(b.code) : a.floorNumber - b.floorNumber
    );
  }, [fractions]);

  useEffect(() => {
    if (!open || allowedActionTypes.length === 0) {
      return;
    }

    if (!allowedActionTypes.some((item) => item.id === actionType)) {
      onActionTypeChange(allowedActionTypes[0].id);
    }
  }, [open, actionType, allowedActionTypes, onActionTypeChange]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormError("");
    if (!chargeForm.fractionId && orderedFractions[0]?.id) {
      setChargeForm((previous) => ({ ...previous, fractionId: orderedFractions[0].id }));
    }
    if (!allowCommonIssueArea && issueForm.fractionId === "common" && orderedFractions[0]?.id) {
      setIssueForm((previous) => ({ ...previous, fractionId: orderedFractions[0].id }));
    }
  }, [open, orderedFractions, chargeForm.fractionId, issueForm.fractionId, allowCommonIssueArea]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open, onClose]);

  const submitCurrentForm = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError("");

    try {
      if (actionType === "fractions") {
        await onSubmit({ type: actionType, values: fractionForm });
      }

      if (actionType === "finance") {
        await onSubmit({ type: actionType, values: chargeForm });
      }

      if (actionType === "issues") {
        await onSubmit({ type: actionType, values: issueForm });
      }

      if (actionType === "assemblies") {
        await onSubmit({ type: actionType, values: assemblyForm });
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível guardar esta ação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
    <motion.div
      className="drawer-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.aside
        className="quick-drawer"
        onClick={(event) => event.stopPropagation()}
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        <header className="drawer-header">
          <div>
          <p className="eyebrow">Ações rápidas</p>
          <h3>Registar nova ação operacional</h3>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Fechar painel">
            <Icon name="X" size={16} />
          </button>
        </header>

        <div className="type-switch">
          {allowedActionTypes.map((typeOption) => (
            <button
              key={typeOption.id}
              type="button"
              className={typeOption.id === actionType ? "switch-pill active" : "switch-pill"}
              onClick={() => {
                setFormError("");
                onActionTypeChange(typeOption.id);
              }}
            >
              <Icon name={TYPE_ICON[typeOption.id] || "Plus"} size={14} />
              {typeOption.label}
            </button>
          ))}
        </div>

        {allowedActionTypes.length === 0 ? (
        <p className="form-error">Este perfil não tem permissões para criar novos registos.</p>
        ) : null}

        <form className="drawer-form" onSubmit={submitCurrentForm}>
          {actionType === "fractions" && (
            <div className="field-grid two-cols">
              <label className="field">
              <span>Código da fração</span>
                <input
                  required
                  value={fractionForm.code}
                  onChange={(event) => setFractionForm((previous) => ({ ...previous, code: event.target.value }))}
                  placeholder="Ex: 11A"
                />
              </label>
              <label className="field">
                <span>Piso</span>
                <input
                  required
                  type="number"
                  value={fractionForm.floorNumber}
                  onChange={(event) =>
                    setFractionForm((previous) => ({ ...previous, floorNumber: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Tipo</span>
                <select
                  value={fractionForm.type}
                  onChange={(event) => setFractionForm((previous) => ({ ...previous, type: event.target.value }))}
                >
                <option value="habitacao">Habitação</option>
                  <option value="loja">Loja</option>
                  <option value="estacionamento">Estacionamento</option>
                  <option value="arrecadacao">Arrecadação</option>
                </select>
              </label>
              <label className="field">
                <span>Tipologia</span>
                <input
                  value={fractionForm.typology}
                  onChange={(event) =>
                    setFractionForm((previous) => ({ ...previous, typology: event.target.value }))
                  }
                  placeholder="Ex: T2"
                />
              </label>
              <label className="field">
                <span>Quota mensal (EUR)</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={fractionForm.monthlyFee}
                  onChange={(event) =>
                    setFractionForm((previous) => ({ ...previous, monthlyFee: event.target.value }))
                  }
                />
              </label>
              <label className="field">
              <span>Área privativa (m2)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={fractionForm.privateAreaM2}
                  onChange={(event) =>
                    setFractionForm((previous) => ({ ...previous, privateAreaM2: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Permilagem</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={fractionForm.permillage}
                  onChange={(event) =>
                    setFractionForm((previous) => ({ ...previous, permillage: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Titular principal</span>
                <input
                  value={fractionForm.ownerName}
                  onChange={(event) =>
                    setFractionForm((previous) => ({ ...previous, ownerName: event.target.value }))
                  }
                  placeholder="Nome do proprietário"
                />
              </label>
              <label className="field">
                <span>Email titular</span>
                <input
                  type="email"
                  value={fractionForm.ownerEmail}
                  onChange={(event) =>
                    setFractionForm((previous) => ({ ...previous, ownerEmail: event.target.value }))
                  }
                  placeholder="owner@example.pt"
                />
              </label>
              <label className="field">
                <span>Telemóvel titular</span>
                <input
                  value={fractionForm.ownerPhone}
                  onChange={(event) =>
                    setFractionForm((previous) => ({ ...previous, ownerPhone: event.target.value }))
                  }
                  placeholder="+3519..."
                />
              </label>
              <label className="field">
                <span>NIF titular</span>
                <input
                  value={fractionForm.ownerTaxNumber}
                  onChange={(event) =>
                    setFractionForm((previous) => ({ ...previous, ownerTaxNumber: event.target.value }))
                  }
                  placeholder="9XXXXXXXX"
                />
              </label>
            </div>
          )}

          {actionType === "finance" && (
            <div className="field-grid">
              <label className="field">
              <span>Fração</span>
                <select
                  required
                  value={chargeForm.fractionId}
                  onChange={(event) => setChargeForm((previous) => ({ ...previous, fractionId: event.target.value }))}
                >
                  {orderedFractions.map((fraction) => (
                    <option key={fraction.id} value={fraction.id}>
                      {fraction.code} - Piso {fraction.floorNumber}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Tipo de encargo</span>
                <select
                  value={chargeForm.kind}
                  onChange={(event) => setChargeForm((previous) => ({ ...previous, kind: event.target.value }))}
                >
                  <option value="quota">Quota</option>
                  <option value="reserve_fund">Fundo de reserva</option>
                  <option value="adjustment">Acerto</option>
                  <option value="penalty">Penalização</option>
                </select>
              </label>
              <label className="field">
              <span>Período</span>
                <input
                  required
                  type="month"
                  value={chargeForm.period}
                  onChange={(event) => setChargeForm((previous) => ({ ...previous, period: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>Data de vencimento</span>
                <input
                  required
                  type="date"
                  value={chargeForm.dueDate}
                  onChange={(event) => setChargeForm((previous) => ({ ...previous, dueDate: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>Valor (EUR)</span>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={chargeForm.amount}
                  onChange={(event) => setChargeForm((previous) => ({ ...previous, amount: event.target.value }))}
                />
              </label>
            </div>
          )}

          {actionType === "issues" && (
            <div className="field-grid">
              <label className="field">
              <span>Título</span>
                <input
                  required
                  value={issueForm.title}
                  onChange={(event) => setIssueForm((previous) => ({ ...previous, title: event.target.value }))}
                  placeholder="Ex: Infiltração na cobertura"
                />
              </label>
              <label className="field">
                <span>Categoria</span>
                <select
                  value={issueForm.category}
                  onChange={(event) => setIssueForm((previous) => ({ ...previous, category: event.target.value }))}
                >
                  {issueCategories.map((category) => (
                    <option key={category} value={category}>
                      {cleanLabel(category)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
              <span>Prioridade</span>
                <select
                  value={issueForm.priority}
                  onChange={(event) => setIssueForm((previous) => ({ ...previous, priority: event.target.value }))}
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </label>
              <label className="field">
              <span>Fração</span>
                <select
                  value={issueForm.fractionId}
                  onChange={(event) => setIssueForm((previous) => ({ ...previous, fractionId: event.target.value }))}
                >
                {allowCommonIssueArea ? <option value="common">Área comum</option> : null}
                  {orderedFractions.map((fraction) => (
                    <option key={fraction.id} value={fraction.id}>
                      {fraction.code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field full-row">
              <span>Descrição</span>
                <textarea
                  rows={4}
                  value={issueForm.description}
                  onChange={(event) =>
                    setIssueForm((previous) => ({ ...previous, description: event.target.value }))
                  }
                  placeholder="Detalhes iniciais para triagem."
                />
              </label>
            </div>
          )}

          {actionType === "assemblies" && (
            <div className="field-grid">
              <label className="field">
                <span>Tipo</span>
                <select
                  value={assemblyForm.meetingType}
                  onChange={(event) =>
                    setAssemblyForm((previous) => ({ ...previous, meetingType: event.target.value }))
                  }
                >
                <option value="ordinary">Ordinária</option>
                <option value="extraordinary">Extraordinária</option>
                </select>
              </label>
              <label className="field">
                <span>Data e hora</span>
                <input
                  required
                  type="datetime-local"
                  value={assemblyForm.scheduledAt}
                  onChange={(event) =>
                    setAssemblyForm((previous) => ({ ...previous, scheduledAt: event.target.value }))
                  }
                />
              </label>
              <label className="field full-row">
                <span>Local</span>
                <input
                  value={assemblyForm.location}
                  onChange={(event) => setAssemblyForm((previous) => ({ ...previous, location: event.target.value }))}
                />
              </label>
            </div>
          )}

          {formError ? <p className="form-error">{formError}</p> : null}

          <footer className="drawer-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary-btn" disabled={allowedActionTypes.length === 0 || isSubmitting}>
              {isSubmitting ? "A guardar..." : "Guardar ação"}
            </button>
          </footer>
        </form>
      </motion.aside>
    </motion.div>
      )}
    </AnimatePresence>
  );
}
