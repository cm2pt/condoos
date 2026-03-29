import { motion } from "framer-motion";
import Icon from "./Icon.jsx";

const VARIANTS = {
  default: {
    icon: "Inbox",
    title: "Sem dados",
    subtitle: "Não existem registos para apresentar.",
  },
  search: {
    icon: "Search",
    title: "Sem resultados",
    subtitle: "Nenhum resultado encontrado. Tente ajustar os filtros.",
  },
  issues: {
    icon: "Wrench",
    title: "Sem ocorrências",
    subtitle: "Não existem ocorrências registadas de momento.",
  },
  finance: {
    icon: "Wallet",
    title: "Sem movimentos",
    subtitle: "Ainda não existem movimentos financeiros.",
  },
  documents: {
    icon: "FolderOpen",
    title: "Sem documentos",
    subtitle: "Nenhum documento carregado. Utilize o botão de upload.",
  },
  notifications: {
    icon: "Bell",
    title: "Sem notificações",
    subtitle: "Está tudo em dia — não existem notificações pendentes.",
  },
  fractions: {
    icon: "Building2",
    title: "Sem frações",
    subtitle: "Nenhuma fração encontrada para os filtros selecionados.",
  },
  assemblies: {
    icon: "Vote",
    title: "Sem assembleias",
    subtitle: "Não existem assembleias agendadas.",
  },
};

/**
 * Empty state contextual — mostra ícone grande + título + descrição.
 * Anima com fade-in via Framer Motion.
 */
export default function EmptyState({
  variant = "default",
  icon,
  title,
  subtitle,
  action,
  className = "",
}) {
  const v = VARIANTS[variant] || VARIANTS.default;
  const displayIcon = icon || v.icon;
  const displayTitle = title || v.title;
  const displaySubtitle = subtitle || v.subtitle;

  return (
    <motion.div
      className={`empty-state-box ${className}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="empty-state-icon-circle">
        <Icon name={displayIcon} size={24} />
      </div>
      <p className="empty-state-title">{displayTitle}</p>
      <p className="empty-state-subtitle">{displaySubtitle}</p>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </motion.div>
  );
}
