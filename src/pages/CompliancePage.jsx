import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { formatDate, cleanLabel, statusTone } from "../lib/formatters.js";
import { COMPLIANCE_TASKS } from "../lib/constants.js";
import StatusPill from "../components/shared/StatusPill.jsx";
import Icon from "../components/shared/Icon.jsx";
import EmptyState from "../components/shared/EmptyState.jsx";

function TemplateEditor({ template, onSave, onDelete, onPreview }) {
  const [subjectTemplate, setSubjectTemplate] = useState(template.subjectTemplate || "");
  const [bodyTemplate, setBodyTemplate] = useState(template.bodyTemplate || "");
  const [previewHtml, setPreviewHtml] = useState(null);
  const [saving, setSaving] = useState(false);
  const iframeRef = useRef(null);
  const isEmail = template.templateType === "email";

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(template.templateKey, {
        subjectTemplate: isEmail ? subjectTemplate : null,
        bodyTemplate,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    const result = await onPreview(template.templateKey, {
      recipientName: "Maria Silva",
      condominiumName: "Condominio Exemplo",
      fractionCode: "A1",
      chargeKind: "quota",
      period: "2026-03",
      amount: "125.00",
      dueDate: "2026-03-31",
      method: "Multibanco",
      paidAt: "2026-03-15",
      issueTitle: "Infiltracao na garagem",
      newStatus: "em_progresso",
      comment: "Reparacao agendada para segunda-feira.",
      assemblyTitle: "Assembleia Geral Ordinaria",
      assemblyDate: "2026-04-15",
      assemblyLocation: "Sala de reunioes do condominio",
      agenda: "1. Aprovacao de contas\n2. Orcamento 2026",
      portalUrl: "https://app.condoos.pt",
    });
    if (result && result.preview) {
      setPreviewHtml(result.preview.html);
    }
  }

  function handleDelete() {
    if (!template.isCustom) return;
    onDelete(template.templateKey);
    setPreviewHtml(null);
  }

  return (
    <div style={{ padding: "12px 0" }}>
      {isEmail && (
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: "0.85rem" }}>
            Assunto
          </label>
          <input
            type="text"
            value={subjectTemplate}
            onChange={(e) => setSubjectTemplate(e.target.value)}
            placeholder="Assunto do e-mail (use {{variavel}} para interpolacao)"
            style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </div>
      )}
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: "0.85rem" }}>
          Corpo {isEmail ? "(HTML)" : "(texto)"}
        </label>
        <textarea
          value={bodyTemplate}
          onChange={(e) => setBodyTemplate(e.target.value)}
          rows={10}
          placeholder="Conteudo do template (use {{variavel}} para interpolacao)"
          style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 4, fontFamily: "monospace", fontSize: "0.8rem" }}
        />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-accent" onClick={handleSave} disabled={saving || !bodyTemplate.trim()}>
          {saving ? "A guardar..." : "Guardar"}
        </button>
        <button className="btn" onClick={handlePreview} disabled={!bodyTemplate.trim()}>
          Pre-visualizar
        </button>
        {template.isCustom && (
          <button className="btn btn-danger" onClick={handleDelete}>
            Repor padrao
          </button>
        )}
      </div>
      {previewHtml && (
        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: "0.85rem" }}>
            Pre-visualizacao
          </label>
          <iframe
            ref={iframeRef}
            srcDoc={previewHtml}
            title="Pre-visualizacao do template"
            style={{ width: "100%", height: 300, border: "1px solid var(--border)", borderRadius: 4, background: "#fff" }}
            sandbox=""
          />
        </div>
      )}
    </div>
  );
}

export default function CompliancePage({
  auditEntries,
  auditQuery,
  setAuditQuery,
  auditDomain,
  setAuditDomain,
  templates,
  onSaveTemplate,
  onDeleteTemplate,
  onPreviewTemplate,
}) {
  const [expandedKey, setExpandedKey] = useState(null);
  const templateList = templates || [];

  return (
    <div className="stack-lg">
      <div className="split-grid">
        <motion.article
          className="panel"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <header className="panel-header">
            <div className="panel-header-left">
              <Icon name="ShieldCheck" size={16} className="panel-header-icon" />
              <h3>Checklist RGPD operacional</h3>
            </div>
            <span>Prioridade de lancamento</span>
          </header>
          <ul className="check-list">
            {COMPLIANCE_TASKS.map((task) => (
              <li key={task.title}>
                <div>
                  <p>{task.title}</p>
                  <small>{task.owner}</small>
                </div>
                <div className="timeline-side">
                  <small>{formatDate(task.dueDate)}</small>
                  <StatusPill label={task.status} tone={statusTone(task.status)} />
                </div>
              </li>
            ))}
          </ul>
        </motion.article>

        <motion.article
          className="panel"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <header className="panel-header">
            <div className="panel-header-left">
              <Icon name="FileText" size={16} className="panel-header-icon" />
              <h3>Templates juridicos</h3>
            </div>
            <span>Pre-validados para edicao</span>
          </header>
          <ul className="simple-list">
            <li>
              <span>Politica de privacidade</span>
              <strong>v0.1</strong>
            </li>
            <li>
              <span>Termos de utilizacao</span>
              <strong>v0.1</strong>
            </li>
            <li>
              <span>DPA subcontratante</span>
              <strong>v0.1</strong>
            </li>
            <li>
              <span>Registo de incidente</span>
              <strong>v0.1</strong>
            </li>
            <li>
              <span>Resposta ao titular</span>
              <strong>v0.1</strong>
            </li>
          </ul>
        </motion.article>
      </div>

      {templateList.length > 0 && (
        <motion.article
          className="panel"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <header className="panel-header">
            <div className="panel-header-left">
              <Icon name="FileText" size={16} className="panel-header-icon" />
              <h3>Modelos personalizaveis</h3>
            </div>
            <span>{templateList.length} modelos disponiveis</span>
          </header>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {templateList.map((tpl) => (
                  <tr key={tpl.templateKey} style={{ cursor: "pointer" }}>
                    <td onClick={() => setExpandedKey(expandedKey === tpl.templateKey ? null : tpl.templateKey)}>
                      {tpl.label}
                    </td>
                    <td onClick={() => setExpandedKey(expandedKey === tpl.templateKey ? null : tpl.templateKey)}>
                      <StatusPill
                        label={tpl.templateType === "email" ? "E-mail" : "Juridico"}
                        tone={tpl.templateType === "email" ? "accent" : "neutral"}
                      />
                    </td>
                    <td onClick={() => setExpandedKey(expandedKey === tpl.templateKey ? null : tpl.templateKey)}>
                      <StatusPill
                        label={tpl.isCustom ? "Personalizado" : "Padrao"}
                        tone={tpl.isCustom ? "success" : "neutral"}
                      />
                    </td>
                    <td>
                      <button
                        className="btn btn-sm"
                        onClick={() => setExpandedKey(expandedKey === tpl.templateKey ? null : tpl.templateKey)}
                      >
                        {expandedKey === tpl.templateKey ? "Fechar" : "Editar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {expandedKey && templateList.find((t) => t.templateKey === expandedKey) && (
            <div style={{ padding: "0 16px 16px" }}>
              <TemplateEditor
                key={expandedKey}
                template={templateList.find((t) => t.templateKey === expandedKey)}
                onSave={onSaveTemplate || (() => {})}
                onDelete={onDeleteTemplate || (() => {})}
                onPreview={onPreviewTemplate || (async () => ({}))}
              />
            </div>
          )}
        </motion.article>
      )}

      <motion.article
        className="panel"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <header className="panel-header">
          <div className="panel-header-left">
            <Icon name="ShieldCheck" size={16} className="panel-header-icon" />
            <h3>Trilho de auditoria operacional</h3>
          </div>
          <span>{auditEntries.length} eventos filtrados</span>
        </header>
        <div className="audit-toolbar">
          <select
            className="filter-select"
            value={auditDomain}
            onChange={(event) => setAuditDomain(event.target.value)}
            aria-label="Filtrar dominio de auditoria"
          >
            <option value="all">Todos os dominios</option>
            <option value="financeiro">Financeiro</option>
            <option value="operacional">Operacional</option>
            <option value="governance">Governacao</option>
            <option value="cadastros">Cadastros</option>
            <option value="compliance">Conformidade</option>
            <option value="sistema">Sistema</option>
          </select>
          <div className="search-wrap compact">
            <Icon name="Search" size={15} className="search-input-icon" />
            <input
              type="search"
              value={auditQuery}
              onChange={(event) => setAuditQuery(event.target.value)}
              placeholder="Pesquisar por acao, detalhe ou ator"
            />
          </div>
        </div>
        {auditEntries.length === 0 ? (
          <EmptyState
            variant="search"
            title="Sem eventos de auditoria"
            subtitle="Nenhum evento encontrado para os filtros selecionados."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Ator</th>
                  <th>Dominio</th>
                  <th>Acao</th>
                  <th>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {auditEntries.slice(0, 40).map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.when)}</td>
                    <td>{entry.actor}</td>
                    <td>
                      <StatusPill label={cleanLabel(entry.domain)} tone={entry.tone} />
                    </td>
                    <td>{entry.action}</td>
                    <td>{entry.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.article>

      <motion.article
        className="panel"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <header className="panel-header">
          <div className="panel-header-left">
            <Icon name="ShieldCheck" size={16} className="panel-header-icon" />
            <h3>Trilho de auditoria recomendado para V1</h3>
          </div>
          <span>Campos minimos</span>
        </header>
        <div className="audit-grid">
          {[
            {
              title: "Financeiro",
              text: "Criacao/edicao de encargos, alteracao de valores, conciliacao manual e anulacoes de pagamentos devem ser auditados com before/after.",
            },
            {
              title: "Governance",
              text: "Convocatorias, alteracoes de ordem de trabalhos, votacoes e atas publicadas exigem registo de ator, timestamp e justificacao.",
            },
            {
              title: "Dados pessoais",
              text: "Operacoes de exportacao, apagamento e retificacao de dados devem ter trilho completo para resposta a pedidos do titular.",
            },
          ].map((card, i) => (
            <motion.article
              key={card.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
                delay: i * 0.08,
              }}
            >
              <h4>{card.title}</h4>
              <p>{card.text}</p>
            </motion.article>
          ))}
        </div>
      </motion.article>
    </div>
  );
}
