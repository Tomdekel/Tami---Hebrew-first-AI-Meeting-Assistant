import { test, expect } from "@playwright/test";

const EMAIL = process.env.TEST_USER_EMAIL;
const PASSWORD = process.env.TEST_USER_PASSWORD;

test("production smoke: login and core pages", async ({ page }) => {
  if (!EMAIL || !PASSWORD) {
    throw new Error("Missing TEST_USER_EMAIL or TEST_USER_PASSWORD env vars");
  }

  await page.goto("/login");

  const loginButton = page.getByRole("button", { name: /התחבר|login/i }).first();
  if (await loginButton.isVisible()) {
    await loginButton.click();
  }

  await page.getByPlaceholder("yourname@company.com").fill(EMAIL);
  await page.getByPlaceholder(/Enter password|הזן סיסמה/).fill(PASSWORD);
  await page.getByRole("button", { name: /Login|התחבר/ }).click();

  await page.waitForURL(/\/meetings/, { timeout: 20000 });
  await expect(page.getByPlaceholder(/Search meetings|חיפוש פגישות/)).toBeVisible();

  await page.goto("/meetings/new");
  await expect(page.getByText(/New Meeting|פגישה חדשה/)).toBeVisible();
  await expect(page.getByText(/Import from calendar|ייבוא מהיומן/)).toBeVisible();

  await page.goto("/memory");
  await expect(page.getByPlaceholder(/Ask memory|שאל את הזיכרון/)).toBeVisible();
});
