import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export async function expectNoHighImpactA11yViolations(page, options = {}) {
  // Wait for entrance animations to finish so axe doesn't flag opacity:0 elements
  await page.waitForTimeout(800);

  const builder = new AxeBuilder({ page });

  if (Array.isArray(options.include)) {
    for (const selector of options.include) {
      builder.include(selector);
    }
  }

  if (Array.isArray(options.exclude)) {
    for (const selector of options.exclude) {
      builder.exclude(selector);
    }
  }

  const results = await builder.analyze();
  const highImpact = results.violations.filter((violation) => {
    return violation.impact === "critical" || violation.impact === "serious";
  });

  expect(
    highImpact,
    highImpact
      .map((violation) => `${violation.id}: ${violation.help}`)
      .join("\n")
  ).toEqual([]);
}
