import { formatDate } from "../../lib/formatters.js";
import StatusPill from "../../components/shared/StatusPill.jsx";
import Icon from "../../components/shared/Icon.jsx";

const TONE_ICON = {
  danger: "AlertTriangle",
  warning: "Clock",
  success: "CheckCircle2",
  accent: "Bell",
  neutral: "Info",
};

export default function NotificationCenter({ open, notifications, readIds, unreadCount, onClose, onMarkAllRead, onSelectNotification }) {
  if (!open) {
    return null;
  }

  return (
    <div className="drawer-backdrop notification-layer" role="dialog" aria-modal="true" onClick={onClose}>
      <aside className="notification-panel" onClick={(event) => event.stopPropagation()}>
        <header className="panel-header">
          <div className="panel-header-left">
            <Icon name="Bell" size={16} className="panel-header-icon" />
            <h3>Centro de alertas</h3>
            <span className="notif-badge">{unreadCount}</span>
          </div>
          <div className="inline-actions">
            <button type="button" className="mini-btn" onClick={onMarkAllRead}>
              <Icon name="CheckCircle2" size={12} />
              Marcar tudo lido
            </button>
            <button type="button" className="close-btn" onClick={onClose} aria-label="Fechar">
              <Icon name="X" size={16} />
            </button>
          </div>
        </header>
        {notifications.length === 0 ? (
          <div className="empty-state-box">
            <div className="empty-state-icon-circle">
              <Icon name="Bell" size={28} />
            </div>
            <p className="empty-state-title">Sem alertas ativos</p>
            <p className="empty-state-subtitle">Não existem notificações no momento.</p>
          </div>
        ) : (
          <ul className="notification-list">
            {notifications.map((notification) => {
              const isUnread = !readIds.includes(notification.id);
              return (
                <li key={notification.id} className={isUnread ? "unread" : ""}>
                  <button type="button" onClick={() => onSelectNotification(notification)}>
                    <div className="notif-icon-wrap">
                      <Icon name={TONE_ICON[notification.tone] || "Info"} size={15} />
                    </div>
                    <div className="notif-content">
                      <p>{notification.title}</p>
                      <small>{notification.detail}</small>
                    </div>
                    <div className="timeline-side">
                      <small>{formatDate(notification.when)}</small>
                      <StatusPill label={isUnread ? "Novo" : "Lido"} tone={isUnread ? notification.tone : "neutral"} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}
