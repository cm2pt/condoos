import { expect, test } from "@playwright/test";
import { loginWithCredentials } from "./helpers/auth.js";

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

test.describe("Core UX workflows", () => {
  test("command palette and notifications improve navigation flow", async ({ page }) => {
    await loginWithCredentials(page, "manager");

    await page.getByRole("button", { name: /Comandos/i }).click();
    await expect(page.locator(".command-panel h3")).toHaveText(/Comandos/i);

    // Command palette items should have module icons
    await expect(page.locator(".command-list .command-item-icon").first()).toBeVisible();

    await page.getByPlaceholder(/Procurar/i).fill("documentos");
    await page.getByRole("button", { name: /Abrir Documentos/i }).click();
    await expect(page.locator(".workspace-header h2")).toHaveText(/documental/i);

    await page.getByRole("button", { name: /Alertas/i }).click();
    await expect(page.locator(".notification-panel h3")).toHaveText(/Centro de alertas/i);

    // Notification items should have tone icons
    const notifItems = page.locator(".notification-list li");
    const notifCount = await notifItems.count();
    if (notifCount > 0) {
      await expect(notifItems.first().locator(".notif-icon-wrap .icon")).toBeVisible();
    }

    await page.getByRole("button", { name: /Marcar tudo lido/i }).click();
    await expect(page.locator(".notif-badge")).toHaveText("0");
    await page.getByRole("button", { name: "Fechar" }).click();

    await expect(page.locator(".notification-btn .notification-count")).toHaveCount(0);
  });

  test("manager can upload, version, and download documents", async ({ page }) => {
    await loginWithCredentials(page, "manager");
    await page.getByRole("button", { name: "Documentos" }).click();
    await expect(page.locator(".workspace-header h2")).toHaveText(/documental/i);

    const documentTitle = "Documento UX Playwright";
    const promptAnswers = [documentTitle, "geral", "all"];
    const dialogHandler = async (dialog) => {
      if (dialog.type() === "prompt") {
        await dialog.accept(promptAnswers.shift() ?? "");
        return;
      }
      await dialog.dismiss();
    };

    page.on("dialog", dialogHandler);
    try {
      const initialFilePicker = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "Carregar documento", exact: true }).click();
      const fileChooser = await initialFilePicker;
      await fileChooser.setFiles({
        name: "documento-ux-playwright.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("documento para testes de ux e branding", "utf8"),
      });

      await expect(page.locator(".toast-note")).toHaveText(/carregado com sucesso/i);

      const uploadedRow = page.locator("table.docs-table tbody tr", { hasText: documentTitle }).first();
      await expect(uploadedRow).toBeVisible();

      const downloadPromise = page.waitForEvent("download");
      await uploadedRow.getByRole("button", { name: /Descarregar documento/i }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename().length).toBeGreaterThan(5);

      const versionPickerPromise = page.waitForEvent("filechooser");
      await uploadedRow.getByRole("button", { name: /Nova vers/i }).click();
      const versionChooser = await versionPickerPromise;
      await versionChooser.setFiles({
        name: "documento-ux-playwright-v2.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("nova versao do documento", "utf8"),
      });

      await expect(page.locator(".toast-note")).toHaveText(/Nova vers.*carregada/i);
    } finally {
      page.off("dialog", dialogHandler);
    }
  });

  test("finance flow allows receipt download in pdf", async ({ page }) => {
    await loginWithCredentials(page, "manager");

    // Wait for sidebar to be interactive, then navigate to finance
    await expect(page.locator(".module-nav .module-btn").first()).toBeVisible();
    await page.getByRole("button", { name: "Financeiro" }).click();
    await expect(page.getByRole("heading", { name: /Tesouraria/i })).toBeVisible();

    // Wait for finance table to load
    await expect(page.locator(".finance-layout .table-wrap")).toBeVisible();
    const chargeRows = page.locator(".finance-layout .table-wrap tbody tr");
    const rowCount = await chargeRows.count();

    let targetButton = null;
    const maxScan = Math.min(rowCount, 12);
    for (let index = 0; index < maxScan; index += 1) {
      await chargeRows.nth(index).click();
      const receiptButton = page.getByRole("button", { name: /Recibo PDF/i }).first();
      const visible = await receiptButton
        .isVisible()
        .catch(() => false);
      if (visible) {
        targetButton = receiptButton;
        break;
      }
    }

    expect(targetButton, "Nenhum pagamento com recibo visivel para teste.").not.toBeNull();

    const receiptDownloadPromise = page.waitForEvent("download");
    await targetButton.click();
    const receiptDownload = await receiptDownloadPromise;

    const receiptFileName = normalizeText(receiptDownload.suggestedFilename());
    expect(receiptFileName.includes("recibo")).toBeTruthy();
    expect(receiptFileName.endsWith(".pdf")).toBeTruthy();
  });
});
