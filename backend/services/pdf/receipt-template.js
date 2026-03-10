/**
 * Branded PDF receipt template for payment confirmations.
 * Uses pdfkit to generate A4 receipts with Condoos branding.
 */
import PDFDocument from "pdfkit";

/**
 * Render a payment receipt as a PDF buffer.
 * @param {Object} payload
 * @param {string} payload.receiptNumber
 * @param {string} payload.generatedAt
 * @param {string} payload.tenantName
 * @param {string} [payload.tenantAddress]
 * @param {string} [payload.tenantNif]
 * @param {string} payload.fractionCode
 * @param {string} payload.chargePeriod
 * @param {string} [payload.chargeKind]
 * @param {string} payload.chargeDueDate
 * @param {string} payload.paidAt
 * @param {string} payload.method
 * @param {string} payload.reference
 * @param {string} payload.amountFormatted
 * @returns {Promise<Buffer>}
 */
export async function renderPaymentReceiptPdfBuffer(payload) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: "A4",
      });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width - 100;
      const blue = "#1e40af";
      const gray = "#6b7280";
      const dark = "#111827";

      // Header with brand
      doc.fontSize(22).fillColor(blue).text("CONDOOS", { align: "left" });
      doc.fontSize(9).fillColor(gray).text("Gestao de Condominios", { align: "left" });
      doc.moveDown(0.5);

      // Horizontal line
      doc.strokeColor("#e2e8f0").lineWidth(1)
        .moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
      doc.moveDown(0.8);

      // Receipt number and date
      doc.fillColor(dark).fontSize(16).text("Recibo de Pagamento", { align: "left" });
      doc.moveDown(0.3);
      doc.fontSize(12).fillColor(blue).text(`N.º ${payload.receiptNumber}`, { align: "left" });
      doc.fontSize(9).fillColor(gray).text(`Emitido em ${new Date(payload.generatedAt).toLocaleString("pt-PT")}`, { align: "left" });
      doc.moveDown(1);

      // Condominium info box
      const boxTop = doc.y;
      doc.rect(50, boxTop, pageWidth, 60).fill("#f8fafc");
      doc.fillColor(dark).fontSize(10);
      doc.text(`Condominio: ${payload.tenantName}`, 62, boxTop + 10);
      if (payload.tenantAddress) {
        doc.text(payload.tenantAddress, 62, boxTop + 24);
      }
      if (payload.tenantNif) {
        doc.text(`NIF: ${payload.tenantNif}`, 62, boxTop + 38);
      }
      doc.y = boxTop + 72;
      doc.moveDown(0.5);

      // Payment details table
      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 220;
      const rowHeight = 24;

      const rows = [
        ["Fracao", payload.fractionCode || "-"],
        ["Encargo", `${payload.chargePeriod || ""} | ${payload.chargeKind || "quota"}`],
        ["Vencimento", payload.chargeDueDate || "-"],
        ["Data de pagamento", payload.paidAt || "-"],
        ["Metodo", payload.method || "-"],
        ["Referencia", payload.reference || "-"],
      ];

      rows.forEach((row, i) => {
        const y = tableTop + i * rowHeight;
        if (i % 2 === 0) {
          doc.rect(col1, y, pageWidth, rowHeight).fill("#f1f5f9");
        }
        doc.fillColor(gray).fontSize(9).text(row[0], col1 + 10, y + 7, { width: 160 });
        doc.fillColor(dark).fontSize(9).text(row[1], col2, y + 7, { width: pageWidth - 170 });
      });

      doc.y = tableTop + rows.length * rowHeight + 8;

      // Amount highlight
      doc.rect(col1, doc.y, pageWidth, 36).fill(blue);
      doc.fillColor("#ffffff").fontSize(13)
        .text("VALOR PAGO", col1 + 10, doc.y + 10, { width: 160 });
      doc.text(payload.amountFormatted, col2, doc.y - 13, { width: pageWidth - 170, align: "left" });
      doc.y += 48;

      // Footer
      doc.moveDown(2);
      doc.strokeColor("#e2e8f0").lineWidth(0.5)
        .moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(8).fillColor(gray);
      doc.text("Documento gerado automaticamente pela plataforma Condoos.", { align: "center" });
      doc.text("Este recibo integra o historico auditavel do condominio e tem validade como comprovativo de pagamento.", { align: "center" });
      doc.text(`Verificacao: ${payload.receiptNumber}`, { align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
