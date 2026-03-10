import { expect } from "@playwright/test";

export const DEMO_CREDENTIALS = {
  manager: {
    demoButtonIndex: 0,
    email: "gestao.demo@condoos.pt",
    password: "Condoos!Gestao2026",
  },
  accounting: {
    demoButtonIndex: 1,
    email: "contabilidade.demo@condoos.pt",
    password: "Condoos!Contabilidade2026",
  },
  operations: {
    demoButtonIndex: 2,
    email: "operacoes.demo@condoos.pt",
    password: "Condoos!Operacoes2026",
  },
  resident: {
    demoButtonIndex: 3,
    email: "condomino.demo@condoos.pt",
    password: "Condoos!Condomino2026",
  },
};

export async function gotoLogin(page) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /Entrar na sua conta/i })).toBeVisible();
}

async function waitForWorkspace(page) {
  await expect(page.locator(".login-shell")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Painel de controlo/i })).toBeVisible();
}

export async function loginWithCredentials(page, role = "manager") {
  const credentials = DEMO_CREDENTIALS[role];
  if (!credentials) {
    throw new Error(`Unknown role for test login: ${role}`);
  }

  await gotoLogin(page);
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: /^Entrar$/ }).click();
  await waitForWorkspace(page);
}

export async function loginWithDemoShortcut(page, role = "manager") {
  const credentials = DEMO_CREDENTIALS[role];
  if (!credentials) {
    throw new Error(`Unknown role for shortcut login: ${role}`);
  }

  await gotoLogin(page);
  const profileButton = page.locator(".demo-profile-btn").nth(credentials.demoButtonIndex ?? 0);

  await expect(profileButton).toBeVisible();
  await profileButton.click();
  await waitForWorkspace(page);
}
