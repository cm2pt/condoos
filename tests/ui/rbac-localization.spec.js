import { expect, test } from "@playwright/test";
import { loginWithCredentials } from "./helpers/auth.js";

test.describe("RBAC and localization UX", () => {
  test("resident sees only allowed modules and resident-safe documents view", async ({ page }) => {
    await loginWithCredentials(page, "resident");

    const moduleLabels = (await page.locator(".module-nav .module-btn .module-btn-left span").allTextContents()).map((value) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    );
    expect(moduleLabels).toEqual(["painel", "financeiro", "ocorrencias", "portal condomino", "documentos"]);
    expect(moduleLabels.includes("fracoes")).toBeFalsy();
    expect(moduleLabels.includes("assembleias")).toBeFalsy();
    expect(moduleLabels.includes("compliance")).toBeFalsy();

    // Each module button should have an icon
    const iconCount = await page.locator(".module-nav .module-btn .icon").count();
    expect(iconCount).toBe(moduleLabels.length);

    await page.locator(".module-nav .module-btn", { hasText: "Documentos" }).click();
    await expect(page.locator(".workspace-header h2")).toHaveText(/documental/i);

    await expect(page.locator("table.docs-table thead th", { hasText: /Visibilidade/i })).toHaveCount(0);
    await expect(page.getByText(/Mostramos apenas documentos/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Carregar documento", exact: true })).toHaveCount(0);
  });

  test("ui keeps labels in PT-PT for finance and document visibility", async ({ page }) => {
    await loginWithCredentials(page, "manager");

    await expect(page.locator(".module-nav .module-btn").first()).toBeVisible();
    await page.locator(".module-nav .module-btn", { hasText: "Financeiro" }).click();
    await expect(page.getByRole("heading", { name: /Tesouraria/i })).toBeVisible();

    // Wait for filter select to be rendered (Framer Motion entrance animation)
    await expect(page.locator('select[aria-label="Filtrar por estado financeiro"]')).toBeVisible();

    const financeFilterOptions = await page
      .locator('select[aria-label="Filtrar por estado financeiro"] option')
      .allTextContents();

    expect(financeFilterOptions).toEqual(["Todos os estados", "Em atraso", "Em aberto", "Parcial"]);

    const financeText = (await page.locator("main.workspace").innerText()).toLowerCase();
    expect(financeText.includes("overdue")).toBeFalsy();
    expect(financeText.includes("visibility")).toBeFalsy();

    await page.locator(".module-nav .module-btn", { hasText: "Documentos" }).click();
    await expect(page.locator(".pill-group .stat-pill").first()).toBeVisible();
    const visibilitySummary = (await page.locator(".pill-group .stat-pill").allTextContents()).map((value) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    );
    expect(visibilitySummary.some((entry) => entry.startsWith("gestao"))).toBeTruthy();
    expect(visibilitySummary.some((entry) => entry.startsWith("condominos"))).toBeTruthy();
    expect(visibilitySummary.some((entry) => entry.startsWith("todos"))).toBeTruthy();
  });

  test("resident command palette and quick actions stay restricted", async ({ page }) => {
    await loginWithCredentials(page, "resident");

    await page.getByRole("button", { name: /Comandos/i }).click();
    await expect(page.locator(".command-panel h3")).toHaveText(/Comandos/i);

    await page.getByPlaceholder(/Procurar/i).fill("compliance");
    await expect(page.getByText(/Sem resultados para este termo/i)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator(".command-panel")).toHaveCount(0);

    await page.locator(".header-actions .primary-btn").click();
    await expect(page.getByRole("heading", { name: /Registar nova/i })).toBeVisible();

    const quickActionTypes = (await page.locator(".type-switch .switch-pill").allTextContents()).map((value) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    );
    expect(quickActionTypes).toEqual(["ocorrencia"]);
  });
});
