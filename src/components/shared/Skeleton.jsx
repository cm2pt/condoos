/**
 * Skeletons para loading states — formas específicas por contexto.
 * Usam a animação skeleton-shimmer definida em index.css.
 */

export function SkeletonText({ width = "80%", height = 14, className = "" }) {
  return (
    <div
      className={`skeleton skeleton-text ${className}`}
      style={{ width, height }}
    />
  );
}

export function SkeletonCard({ height = 120, className = "" }) {
  return (
    <div
      className={`skeleton skeleton-card ${className}`}
      style={{ height }}
    />
  );
}

export function SkeletonRow({ className = "" }) {
  return <div className={`skeleton skeleton-row ${className}`} />;
}

export function SkeletonKPI({ count = 4, className = "" }) {
  return (
    <div className={`kpi-grid ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton skeleton-card" style={{ height: 140 }} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, className = "" }) {
  return (
    <div className={`table-wrap ${className}`} style={{ padding: 0 }}>
      <div className="skeleton" style={{ height: 44, borderRadius: "12px 12px 0 0" }} />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton skeleton-row" style={{ margin: "0 0 1px" }} />
      ))}
    </div>
  );
}

export function SkeletonPanel({ className = "" }) {
  return (
    <div className={`panel ${className}`}>
      <div style={{ display: "grid", gap: 12 }}>
        <SkeletonText width="50%" height={18} />
        <SkeletonText width="100%" />
        <SkeletonText width="70%" />
        <SkeletonCard height={80} />
      </div>
    </div>
  );
}
