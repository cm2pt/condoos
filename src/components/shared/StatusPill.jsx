import Icon from "./Icon.jsx";

const TONE_ICONS = {
  success: "CheckCircle2",
  warning: "Clock",
  danger: "AlertTriangle",
  neutral: "CircleDot",
  accent: "Info",
};

export default function StatusPill({ label, tone = "neutral" }) {
  return (
    <span className={`pill tone-${tone}`}>
      {TONE_ICONS[tone] ? <Icon name={TONE_ICONS[tone]} size={12} /> : null}
      {label}
    </span>
  );
}
