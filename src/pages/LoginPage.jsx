import { motion } from "framer-motion";
import { BRAND_WORDMARK_SRC, BRAND_SYMBOL_SRC, PROFILE_CAPABILITIES, DEMO_PROFILE_COPY } from "../lib/constants.js";

export default function LoginPage({
  apiLoginForm,
  setApiLoginForm,
  apiLoginError,
  isApiSyncing,
  showDemoProfiles = false,
  demoProfiles = [],
  onSubmit,
  onLoginAsProfile,
}) {
  return (
    <div className="login-shell">
      <div className="login-grid-mask" aria-hidden="true" />
      <div className="login-glow login-glow-one" aria-hidden="true" />
      <div className="login-glow login-glow-two" aria-hidden="true" />

      <motion.section
        className="login-hero"
        initial={{ opacity: 0, x: -22 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="login-brand">
          <img className="login-brand-wordmark" src={BRAND_WORDMARK_SRC} alt="Condoo" />
          <p className="login-kicker">Plataforma para gestão condominial moderna</p>
        </div>
        <h1 className="login-title">Gestão de condomínio simples, clara e preparada para crescer.</h1>
        <p className="login-subtitle">
          Reúne quotas, ocorrências, assembleias e documentos num único espaço para administração e condóminos.
        </p>

        <div className="login-benefits-grid">
          <article>
            <strong>Mais transparência</strong>
            <span>Todos veem o que interessa, no momento certo.</span>
          </article>
          <article>
            <strong>Menos fricção diária</strong>
            <span>Processos e tarefas organizados sem confusão.</span>
          </article>
          <article>
            <strong>Experiência para todos</strong>
            <span>Administração, fornecedores e condóminos alinhados.</span>
          </article>
        </div>

        <div className="login-pill-row">
          <span className="login-pill">Comunicação transparente</span>
          <span className="login-pill">Dados sempre atualizados</span>
          <span className="login-pill">Fluxos práticos no dia a dia</span>
        </div>
      </motion.section>

      <motion.section
        className="login-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="login-card-head">
          <div className="login-card-brand">
            <img className="login-card-symbol" src={BRAND_SYMBOL_SRC} alt="" aria-hidden="true" />
            <p className="eyebrow">Área reservada</p>
          </div>
          <h2>Entrar na sua conta</h2>
          <p>Use o seu email e password para aceder ao Condoo.</p>
        </div>

        <form className="login-form" onSubmit={onSubmit} autoComplete="on">
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={apiLoginForm.email}
              onChange={(event) =>
                setApiLoginForm((previous) => ({ ...previous, email: event.target.value }))
              }
              placeholder="nome@empresa.pt"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={apiLoginForm.password}
              onChange={(event) =>
                setApiLoginForm((previous) => ({ ...previous, password: event.target.value }))
              }
              placeholder="A sua password"
            />
          </label>

          <button type="submit" className="primary-btn wide login-submit-btn" disabled={isApiSyncing}>
            {isApiSyncing ? "A entrar..." : "Entrar"}
          </button>

          {apiLoginError ? <p className="form-error">{apiLoginError}</p> : null}
        </form>

        {showDemoProfiles ? (
          <>
            <div className="login-demo-banner">
              <strong>Acesso de demonstração (temporário)</strong>
              <small>Estes acessos servem apenas para demonstrações comerciais durante o período de demo.</small>
            </div>

            <div className="login-demo-grid">
              {demoProfiles.map((profile) => {
                const capability = PROFILE_CAPABILITIES[profile.id] || { modules: [], quickActions: [] };
                const profileCopy = DEMO_PROFILE_COPY[profile.id] || "Perfil de validação";

                return (
                  <button
                    key={profile.id}
                    type="button"
                    className="demo-profile-btn"
                    onClick={() => onLoginAsProfile(profile.id)}
                    disabled={isApiSyncing}
                  >
                    <strong className="demo-profile-title">
                      {profile.label}
                      <span className="demo-chip">DEMO</span>
                    </strong>
                    <small>{profileCopy}</small>
                    <span>{capability.modules.length} módulos | {capability.quickActions.length} ações</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </motion.section>
    </div>
  );
}
