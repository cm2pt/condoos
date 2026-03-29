import { motion, AnimatePresence } from "framer-motion";
import { formatDate } from "../../lib/formatters.js";
import StatusPill from "../../components/shared/StatusPill.jsx";
import Icon from "../../components/shared/Icon.jsx";
import EmptyState from "../../components/shared/EmptyState.jsx";

const TONE_ICON = {
  danger: "AlertTriangle",
  warning: "Clock",
  success: "CheckCircle2",
  accent: "Bell",
  neutral: "Info",
};

export default function NotificationCenter({ open, notifications, readIds, unreadCount, onClose, onMarkAllRead, onSelectNotification }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="drawer-backdrop notification-layer"
          role="dialog"
          aria-modal="true"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.aside
            className="notification-panel"
            onClick={(event) => event.stopPropagation()}
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
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
              <EmptyState
                variant="notifications"
                title="Sem alertas ativos"
                subtitle="Não existem notificações no momento."
              />
            ) : (
              <ul className="notification-list">
                {notifications.map((notification, i) => {
                  const isUnread = !readIds.includes(notification.id);
                  return (
                    <motion.li
                      key={notification.id}
                      className={isUnread ? "unread" : ""}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.03 }}
                    >
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
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
