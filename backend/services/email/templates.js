/**
 * Email templates for Condoos notifications.
 * Simple string interpolation — no external template engine needed.
 * Supports custom templates from DB with fallback to hardcoded defaults.
 */
import { getKnex } from "../../db-knex.js";

const TEMPLATES = {
  "payment-reminder": {
    subject: (data) => `Condoos - Lembrete de pagamento: ${data.period || "quota mensal"}`,
    html: (data) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">Lembrete de Pagamento</h2>
        <p>Estimado(a) ${data.recipientName || "Condomino"},</p>
        <p>Informamos que tem um pagamento pendente para a fracao <strong>${data.fractionCode || ""}</strong>:</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr style="background: #f1f5f9;">
            <td style="padding: 8px; border: 1px solid #e2e8f0;">Tipo</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${data.chargeKind || "quota"}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">Periodo</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${data.period || ""}</td>
          </tr>
          <tr style="background: #f1f5f9;">
            <td style="padding: 8px; border: 1px solid #e2e8f0;">Valor</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>${data.amount || "0.00"} EUR</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">Data limite</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${data.dueDate || ""}</td>
          </tr>
        </table>
        ${data.multibancoEntity ? `
        <p><strong>Dados Multibanco:</strong></p>
        <p>Entidade: ${data.multibancoEntity} | Referencia: ${data.multibancoReference} | Valor: ${data.amount} EUR</p>
        ` : ""}
        <p>Obrigado,<br/><strong>${data.condominiumName || "Condoos"}</strong></p>
      </div>
    `,
  },

  "payment-confirmation": {
    subject: (data) => `Condoos - Pagamento recebido: ${data.amount || "0.00"} EUR`,
    html: (data) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Pagamento Recebido</h2>
        <p>Estimado(a) ${data.recipientName || "Condomino"},</p>
        <p>Confirmamos a rececao do seu pagamento:</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr style="background: #f0fdf4;">
            <td style="padding: 8px; border: 1px solid #bbf7d0;">Valor</td>
            <td style="padding: 8px; border: 1px solid #bbf7d0;"><strong>${data.amount || "0.00"} EUR</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #bbf7d0;">Metodo</td>
            <td style="padding: 8px; border: 1px solid #bbf7d0;">${data.method || ""}</td>
          </tr>
          <tr style="background: #f0fdf4;">
            <td style="padding: 8px; border: 1px solid #bbf7d0;">Data</td>
            <td style="padding: 8px; border: 1px solid #bbf7d0;">${data.paidAt || ""}</td>
          </tr>
        </table>
        <p>Obrigado,<br/><strong>${data.condominiumName || "Condoos"}</strong></p>
      </div>
    `,
  },

  "issue-update": {
    subject: (data) => `Condoos - Ocorrencia atualizada: ${data.issueTitle || ""}`,
    html: (data) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">Atualizacao de Ocorrencia</h2>
        <p>Estimado(a) ${data.recipientName || "Condomino"},</p>
        <p>A ocorrencia <strong>"${data.issueTitle || ""}"</strong> foi atualizada:</p>
        <p>Novo estado: <strong>${data.newStatus || ""}</strong></p>
        ${data.comment ? `<p>Comentario: ${data.comment}</p>` : ""}
        <p>Obrigado,<br/><strong>${data.condominiumName || "Condoos"}</strong></p>
      </div>
    `,
  },

  "assembly-convocation": {
    subject: (data) => `Condoos - Convocatoria: ${data.assemblyTitle || "Assembleia de Condominos"}`,
    html: (data) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">Convocatoria de Assembleia</h2>
        <p>Estimado(a) ${data.recipientName || "Condomino"},</p>
        <p>Fica convocado(a) para a assembleia:</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr style="background: #f1f5f9;">
            <td style="padding: 8px; border: 1px solid #e2e8f0;">Titulo</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${data.assemblyTitle || ""}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">Data</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${data.assemblyDate || ""}</td>
          </tr>
          <tr style="background: #f1f5f9;">
            <td style="padding: 8px; border: 1px solid #e2e8f0;">Local</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${data.assemblyLocation || ""}</td>
          </tr>
        </table>
        ${data.agenda ? `<p><strong>Ordem de trabalhos:</strong></p><p>${data.agenda}</p>` : ""}
        <p>Obrigado,<br/><strong>${data.condominiumName || "Condoos"}</strong></p>
      </div>
    `,
  },

  "welcome": {
    subject: () => "Bem-vindo ao Condoos",
    html: (data) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">Bem-vindo ao Condoos!</h2>
        <p>Estimado(a) ${data.recipientName || ""},</p>
        <p>A sua conta no portal do condominio <strong>${data.condominiumName || ""}</strong> foi criada com sucesso.</p>
        <p>Pode aceder ao portal em: <a href="${data.portalUrl || "#"}">${data.portalUrl || "condoos.pt"}</a></p>
        <p>Obrigado,<br/><strong>${data.condominiumName || "Condoos"}</strong></p>
      </div>
    `,
  },
};

/** All valid template keys (email + legal). */
export const TEMPLATE_KEYS = [
  "payment-reminder",
  "payment-confirmation",
  "issue-update",
  "assembly-convocation",
  "welcome",
  "privacy-policy",
  "terms-of-service",
  "dpa",
];

/** Human-readable labels for each template key. */
export const TEMPLATE_LABELS = {
  "payment-reminder": "Lembrete de pagamento",
  "payment-confirmation": "Confirmacao de pagamento",
  "issue-update": "Atualizacao de ocorrencia",
  "assembly-convocation": "Convocatoria de assembleia",
  "welcome": "Boas-vindas",
  "privacy-policy": "Politica de privacidade",
  "terms-of-service": "Termos de utilizacao",
  "dpa": "DPA subcontratante",
};

/** Default type for each template key. */
export const TEMPLATE_TYPES = {
  "payment-reminder": "email",
  "payment-confirmation": "email",
  "issue-update": "email",
  "assembly-convocation": "email",
  "welcome": "email",
  "privacy-policy": "legal",
  "terms-of-service": "legal",
  "dpa": "legal",
};

/**
 * Get custom template from DB if available, fallback to hardcoded default.
 * @param {string} tenantId
 * @param {string} templateKey
 * @param {object|null} db - Knex instance or transaction
 * @returns {Promise<{ subject: string|null, body: string, isCustom: boolean, templateType: string }>}
 */
export async function getTemplate(tenantId, templateKey, db = null) {
  const knex = db || getKnex();

  const custom = await knex("custom_templates")
    .where({ tenant_id: tenantId, template_key: templateKey, is_active: 1 })
    .first();

  if (custom) {
    return {
      subject: custom.subject_template || null,
      body: custom.body_template,
      isCustom: true,
      templateType: custom.template_type,
    };
  }

  // Fallback to hardcoded default
  const defaultTpl = TEMPLATES[templateKey];
  if (defaultTpl) {
    return {
      subject: null, // Subject is a function in defaults, handled by renderTemplate
      body: null,    // Body is a function in defaults, handled by renderTemplate
      isCustom: false,
      templateType: TEMPLATE_TYPES[templateKey] || "email",
    };
  }

  return null;
}

/**
 * Simple variable interpolation for custom templates.
 * Replaces {{variableName}} with data[variableName].
 */
function interpolate(templateStr, data) {
  if (!templateStr) return "";
  return templateStr.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = data[key];
    return value !== undefined && value !== null ? String(value) : "";
  });
}

/**
 * Render a template (custom or default) with the given data.
 * @param {string} templateName
 * @param {object} data
 * @param {string|null} tenantId - if provided, checks for custom template first
 * @param {object|null} db - Knex instance or transaction
 */
export async function renderTemplate(templateName, data, tenantId = null, db = null) {
  // Try custom template if tenantId is provided
  if (tenantId) {
    const knex = db || getKnex();
    const custom = await knex("custom_templates")
      .where({ tenant_id: tenantId, template_key: templateName, is_active: 1 })
      .first();

    if (custom) {
      return {
        subject: custom.subject_template ? interpolate(custom.subject_template, data) : "",
        html: interpolate(custom.body_template, data),
      };
    }
  }

  // Fallback to hardcoded default
  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(`Email template '${templateName}' not found.`);
  }

  return {
    subject: template.subject(data),
    html: template.html(data),
  };
}

/**
 * Render a preview from raw template strings (for the preview endpoint).
 */
export function renderPreview(subjectTemplate, bodyTemplate, variables) {
  return {
    subject: subjectTemplate ? interpolate(subjectTemplate, variables) : "",
    html: interpolate(bodyTemplate, variables),
  };
}

export function getAvailableTemplates() {
  return Object.keys(TEMPLATES);
}

/**
 * Get default template body as HTML string (for display purposes).
 */
export function getDefaultTemplateBody(templateKey) {
  const tpl = TEMPLATES[templateKey];
  if (!tpl) return null;

  // Render with sample data for display
  const sampleData = {
    recipientName: "{{recipientName}}",
    condominiumName: "{{condominiumName}}",
    fractionCode: "{{fractionCode}}",
    chargeKind: "{{chargeKind}}",
    period: "{{period}}",
    amount: "{{amount}}",
    dueDate: "{{dueDate}}",
    method: "{{method}}",
    paidAt: "{{paidAt}}",
    issueTitle: "{{issueTitle}}",
    newStatus: "{{newStatus}}",
    comment: "{{comment}}",
    assemblyTitle: "{{assemblyTitle}}",
    assemblyDate: "{{assemblyDate}}",
    assemblyLocation: "{{assemblyLocation}}",
    agenda: "{{agenda}}",
    portalUrl: "{{portalUrl}}",
    multibancoEntity: "",
    multibancoReference: "",
  };

  return tpl.html(sampleData);
}

/**
 * Get default template subject as a string with placeholders.
 */
export function getDefaultTemplateSubject(templateKey) {
  const tpl = TEMPLATES[templateKey];
  if (!tpl) return null;

  const sampleData = {
    period: "{{period}}",
    amount: "{{amount}}",
    issueTitle: "{{issueTitle}}",
    assemblyTitle: "{{assemblyTitle}}",
  };

  return tpl.subject(sampleData);
}
