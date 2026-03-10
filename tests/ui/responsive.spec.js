import { expect, test } from "@playwright/test";
import { gotoLogin, loginWithCredentials } from "./helpers/auth.js";

test.describe("Responsive UX", () => {
  test("login is usable on mobile viewport without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoLogin(page);

    await expect(page.locator(".login-card")).toBeVisible();
    await expect(page.locator(".login-demo-grid")).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });

    expect(hasHorizontalOverflow).toBeFalsy();
  });

  test("authenticated app exposes mobile navigation with icons and module switching", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginWithCredentials(page, "manager");

    await expect(page.locator(".mobile-nav")).toBeVisible();
    await expect(page.locator(".sidebar")).toBeHidden();

    // Mobile nav buttons have icons + labels (vertical layout)
    const mobileNavButtons = page.locator(".mobile-nav .mobile-nav-btn");
    await expect(mobileNavButtons.first()).toBeVisible();
    await expect(mobileNavButtons.first().locator(".icon")).toBeVisible();

    await page.getByRole("button", { name: "Docs" }).click();
    await expect(page.locator(".workspace-header h2")).toHaveText(/documental/i);

    await page.getByRole("button", { name: "Portal" }).click();
    await expect(page.getByRole("heading", { name: /Portal do cond/i })).toBeVisible();
  });
});
