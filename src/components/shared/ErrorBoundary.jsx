import { Component } from "react";
import Icon from "./Icon.jsx";

/**
 * Error boundary genérico — captura erros em qualquer sub-árvore React.
 * Mostra UI de recuperação com botão para recarregar o módulo.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Em produção, enviar para serviço de logging (Sentry, etc.)
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary-fallback" role="alert">
          <div className="error-boundary-icon">
            <Icon name="AlertTriangle" size={32} />
          </div>
          <h2 className="error-boundary-title">Algo correu mal</h2>
          <p className="error-boundary-message">
            {this.state.error?.message || "Ocorreu um erro inesperado neste módulo."}
          </p>
          <button type="button" className="primary-btn" onClick={this.handleRetry}>
            <Icon name="RefreshCw" size={15} />
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
