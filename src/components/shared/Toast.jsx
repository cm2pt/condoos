import { AnimatePresence, motion } from "framer-motion";
import Icon from "./Icon.jsx";

const TOAST_ICON = {
  success: "CheckCircle2",
  warning: "AlertTriangle",
  danger: "AlertCircle",
  accent: "Info",
  neutral: "Info",
};

export default function Toast({ message, tone }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className={`toast-note${tone ? ` tone-${tone}` : ""}`}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          <Icon name={TOAST_ICON[tone] || "Info"} size={15} className="toast-icon" />
          <span>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
