import Icon from "./Icon.jsx";

/**
 * Fallback de loading para React.lazy() Suspense.
 * Mostrado enquanto o chunk da página é carregado.
 */
export default function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-label="A carregar módulo">
      <Icon name="Loader2" size={24} className="page-loader-spinner" />
      <span className="page-loader-text">A carregar...</span>
    </div>
  );
}
