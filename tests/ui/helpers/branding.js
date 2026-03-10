export const BRAND_TOKENS = {
  deep: "#0f4c47",
  mid: "#1a6b62",
  sand: "#f5ede0",
  highlight: "#d4a24c",
};

export const BRAND_ASSETS = {
  symbol: "/brand/condoo-symbol.svg",
  wordmark: "/brand/condoo-wordmark.svg",
};

export async function readRootBrandTokens(page) {
  return page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      deep: style.getPropertyValue("--brand-deep").trim().toLowerCase(),
      mid: style.getPropertyValue("--brand-mid").trim().toLowerCase(),
      sand: style.getPropertyValue("--brand-sand").trim().toLowerCase(),
      highlight: style.getPropertyValue("--brand-highlight").trim().toLowerCase(),
      fontUi: style.getPropertyValue("--font-ui").trim(),
      fontAccent: style.getPropertyValue("--font-accent").trim(),
    };
  });
}

export async function readWatermarkBackgroundImage(page) {
  return page.evaluate(() => {
    const app = document.querySelector(".condo-app");
    if (!app) {
      return "";
    }
    return getComputedStyle(app, "::after").backgroundImage || "";
  });
}
