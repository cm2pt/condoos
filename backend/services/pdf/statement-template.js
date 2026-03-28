/**
 * PDF template for owner/fraction financial statements.
 * Uses pdfkit to generate A4 statements with Condoos branding.
 */
import PDFDocument from "pdfkit";

/**
 * Render a fraction financial statement as a PDF buffer.
 * @param {Object} payload
 * @param {string} payload.tenantName
 * @param {string} payload.fractionCode
 * @param {number} payload.year
 * @param {Array<{date: string, type: string, description: string, amount: number, balance: number}>} payload.rows
 * @param {number} payload.totalCharges
 * @param {number} payload.totalPayments
 * @param {number} payload.finalBalance
 * @returns {Promise<Buffer>}
 */
export async function renderStatementPdfBuffer(payload) {
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

      const formatEur = (value) =>
        new Intl.NumberFormat("pt-PT", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 2,
        }).format(Number(value || 0));

      // Header with brand
      doc.fontSize(22).fillColor(blue).text("CONDOOS", { align: "left" });
      doc.fontSize(9).fillColor(gray).text("Gestao de Condominios", { align: "left" });
      doc.moveDown(0.5);

      // Horizontal line
      doc.strokeColor("#e2e8f0").lineWidth(1)
        .moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
      doc.moveDown(0.8);

      // Title
      doc.fillColor(dark).fontSize(16).text("Extrato de Proprietario", { align: "left" });
      doc.moveDown(0.3);
      doc.fontSize(9).fillColor(gray).text(
        `Emitido em ${new Date().toLocaleString("pt-PT")}`,
        { align: "left" }
      );
      doc.moveDown(1);

      // Info box
      const boxTop = doc.y;
      doc.rect(50, boxTop, pageWidth, 48).fill("#f8fafc");
      doc.fillColor(dark).fontSize(10);
      doc.text(`Condominio: ${payload.tenantName}`, 62, boxTop + 10);
      doc.text(`Fracao: ${payload.fractionCode}  |  Periodo: ${payload.year}`, 62, boxTop + 28);
      doc.y = boxTop + 60;
      doc.moveDown(0.5);

      // Table header
      const col = { date: 50, type: 130, desc: 210, amount: 370, balance: 450 };
      const headerY = doc.y;
      doc.rect(50, headerY, pageWidth, 20).fill(blue);
      doc.fillColor("#ffffff").fontSize(8);
      doc.text("Data", col.date + 6, headerY + 6, { width: 70 });
      doc.text("Tipo", col.type + 6, headerY + 6, { width: 70 });
      doc.text("Descricao", col.desc + 6, headerY + 6, { width: 150 });
      doc.text("Valor", col.amount + 6, headerY + 6, { width: 70 });
      doc.text("Saldo", col.balance + 6, headerY + 6, { width: 70 });
      doc.y = headerY + 22;

      // Table rows
      const rows = payload.rows || [];
      rows.forEach((row, i) => {
        const y = doc.y;

        // Check if we need a new page
        if (y > doc.page.height - 100) {
          doc.addPage();
        }

        const currentY = doc.y;
        if (i % 2 === 0) {
          doc.rect(50, currentY, pageWidth, 18).fill("#f1f5f9");
        }
        doc.fillColor(dark).fontSize(7);
        doc.text(row.date || "-", col.date + 6, currentY + 5, { width: 70 });
        doc.text(row.type || "-", col.type + 6, currentY + 5, { width: 70 });
        doc.text(row.description || "-", col.desc + 6, currentY + 5, { width: 150 });
        doc.text(formatEur(row.amount), col.amount + 6, currentY + 5, { width: 70 });
        doc.text(formatEur(row.balance), col.balance + 6, currentY + 5, { width: 70 });
        doc.y = currentY + 18;
      });

      doc.moveDown(0.5);

      // Totals
      const totalsY = doc.y;
      doc.rect(50, totalsY, pageWidth, 54).fill("#f8fafc");
      doc.fillColor(dark).fontSize(9);
      doc.text(`Total encargos: ${formatEur(payload.totalCharges)}`, 62, totalsY + 8);
      doc.text(`Total pagamentos: ${formatEur(payload.totalPayments)}`, 62, totalsY + 22);
      doc.fillColor(blue).fontSize(10);
      doc.text(`Saldo final: ${formatEur(payload.finalBalance)}`, 62, totalsY + 38);
      doc.y = totalsY + 66;

      // Footer
      doc.moveDown(2);
      doc.strokeColor("#e2e8f0").lineWidth(0.5)
        .moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(8).fillColor(gray);
      doc.text("Documento gerado automaticamente pela plataforma Condoos.", { align: "center" });
      doc.text("Este extrato integra o historico auditavel do condominio.", { align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
