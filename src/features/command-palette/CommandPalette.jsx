import { useEffect, useRef, useState } from "react";
import Icon from "../../components/shared/Icon.jsx";

const MODULE_ICON_MAP = {
  dashboard: "LayoutDashboard",
  fractions: "Building2",
  finance: "Wallet",
  issues: "Wrench",
  assemblies: "Vote",
  portal: "Users",
  documents: "FolderOpen",
  compliance: "ShieldCheck",
};

export default function CommandPalette({ open, query, actions, onQueryChange, onClose, onSelectAction }) {
  const inputRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 16);
  }, [open, query]);

  useEffect(() => {
    if (!open || actions.length === 0) {
      return;
    }

    setActiveIndex((previous) => Math.min(previous, actions.length - 1));
  }, [actions, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((previous) => (actions.length === 0 ? 0 : (previous + 1) % actions.length));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((previous) => (actions.length === 0 ? 0 : (previous - 1 + actions.length) % actions.length));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const action = actions[activeIndex];
        if (action) {
          onSelectAction(action.id);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, actions, activeIndex, onClose, onSelectAction]);

  if (!open) {
    return null;
  }

  return (
    <div className="drawer-backdrop command-layer" role="dialog" aria-modal="true" onClick={onClose}>
      <section className="command-panel" onClick={(event) => event.stopPropagation()}>
        <header className="panel-header">
          <div className="panel-header-left">
            <Icon name="Command" size={16} className="panel-header-icon" />
            <h3>Comandos rápidos</h3>
          </div>
          <span>Navegação com setas e Enter</span>
        </header>
        <div className="search-wrap command-search-wrap">
          <Icon name="Search" size={15} className="command-search-icon" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Procurar módulo, ação ou utilitário"
          />
        </div>
        <ul className="command-list">
          {actions.map((action, index) => (
            <li key={action.id}>
              <button
                type="button"
                className={index === activeIndex ? "active" : ""}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onSelectAction(action.id)}
              >
                <Icon name={MODULE_ICON_MAP[action.module] || "Zap"} size={15} className="command-item-icon" />
                <div>
                  <strong>{action.label}</strong>
                  <small>{action.detail}</small>
                </div>
              </button>
            </li>
          ))}
        </ul>
        {actions.length === 0 ? (
          <div className="empty-state-box" style={{ padding: "20px" }}>
            <Icon name="Search" size={20} className="empty-state-icon-circle" style={{ width: 40, height: 40 }} />
            <p className="empty-state-subtitle">Sem resultados para este termo.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
