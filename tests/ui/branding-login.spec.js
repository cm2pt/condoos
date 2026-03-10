import { expect, test } from "@playwright/test";
import { expectNoHighImpactA11yViolations } from "./helpers/accessibility.js";
import { loginWithDemoShortcut, gotoLogin } from "./helpers/auth.js";
import { BRAND_ASSETS, BRAND_TOKENS, readRootBrandTokens, readWatermarkBackgroundImage } from "./helpers/branding.js";

test.describe("Branding and login UX", () => {
  test("login screen follows branding kit and customer copy", async ({ page }) => {
    await gotoLogin(page);

    const wordmark = page.locator(".login-brand-wordmark");
    await expect(wordmark).toBeVisible();
    await expect(wordmark).toHaveAttribute("src", BRAND_ASSETS.wordmark);

    const cardSymbol = page.locator(".login-card-symbol");
    await expect(cardSymbol).toBeVisible();
    await expect(cardSymbol).toHaveAttribute("src", BRAND_ASSETS.symbol);

    const tokens = await readRootBrandTokens(page);
    expect(tokens.deep).toBe(BRAND_TOKENS.deep);
    expect(tokens.mid).toBe(BRAND_TOKENS.mid);
    expect(tokens.sand).toBe(BRAND_TOKENS.sand);
    expect(tokens.highlight).toBe(BRAND_TOKENS.highlight);
    expect(tokens.fontUi).toContain("Outfit");
    expect(tokens.fontAccent).toContain("Instrument Serif");

    await expect(page.getByRole("heading", { level: 1, name: /preparada para crescer/i })).toBeVisible();
    await expect(page.getByText(/assembleias e documentos/i)).toBeVisible();

    await expect(page.locator(".login-demo-banner strong")).toHaveText(/Acesso de demonstra.*tempor/i);
    await expect(page.locator(".demo-profile-btn .demo-chip")).toHaveCount(4);

    const loginText = (await page.locator(".login-shell").innerText()).toLowerCase();
    expect(loginText.includes("rbac")).toBeFalsy();
    expect(loginText.includes("endpoint")).toBeFalsy();
  });

  test("login screen passes high impact accessibility checks", async ({ page }) => {
    await gotoLogin(page);
    await expectNoHighImpactA11yViolations(page, {
      include: [".login-shell"],
    });
  });

  test("authenticated shell preserves branding assets and sidebar structure", async ({ page }) => {
    await loginWithDemoShortcut(page, "manager");

    const sidebarWordmark = page.locator(".brand-wordmark");
    await expect(sidebarWordmark).toBeVisible();
    await expect(sidebarWordmark).toHaveAttribute("src", BRAND_ASSETS.wordmark);

    await expect(page.getByText(/Lisboa/)).toBeVisible();

    const brandIcon = page.locator(".workspace-brand-icon");
    await expect(brandIcon).toBeVisible();
    await expect(brandIcon).toHaveAttribute("src", BRAND_ASSETS.symbol);

    const watermarkBackground = await readWatermarkBackgroundImage(page);
    expect(watermarkBackground).toContain("condoo-symbol.svg");

    const faviconHref = await page
      .locator('link[rel="icon"]')
      .getAttribute("href");
    expect(faviconHref).toContain("condoo-symbol.svg");

    // Sidebar icon-enriched module navigation
    await expect(page.locator(".sidebar .module-nav .module-btn")).toHaveCount(8);
    await expect(page.locator(".sidebar .module-btn .icon").first()).toBeVisible();

    // Sidebar section label
    await expect(page.locator(".sidebar-section-label")).toHaveText(/Módulos/i);

    // Sidebar tenant card
    await expect(page.locator(".sidebar-tenant-card")).toBeVisible();

    // User section at bottom
    await expect(page.locator(".sidebar-user")).toBeVisible();
    await expect(page.locator(".sidebar-avatar")).toBeVisible();
    await expect(page.locator(".sidebar-logout-btn")).toBeVisible();
  });

  test("dashboard shell has no high impact accessibility violations", async ({ page }) => {
    await loginWithDemoShortcut(page, "manager");
    await expectNoHighImpactA11yViolations(page, {
      include: [".workspace"],
      exclude: [".orb"],
    });
  });
});
