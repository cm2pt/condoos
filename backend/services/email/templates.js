/**
 * Email templates for Condoos notifications.
 * Simple string interpolation — no external template engine needed.
 */

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

export function renderTemplate(templateName, data) {
  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(`Email template '${templateName}' not found.`);
  }

  return {
    subject: template.subject(data),
    html: template.html(data),
  };
}

export function getAvailableTemplates() {
  return Object.keys(TEMPLATES);
}
