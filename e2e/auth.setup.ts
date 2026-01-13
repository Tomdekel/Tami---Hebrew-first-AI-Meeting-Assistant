import { test as setup, expect } from "@playwright/test";
import { seedTestMeeting, getTestMeetingId } from "./helpers/seed-data";

const authFile = "e2e/.auth/user.json";

// Export for other tests to use
export const TEST_MEETING_ID = getTestMeetingId();

setup("authenticate", async ({ page }) => {
  // Go to login page
  await page.goto("/login");

  // Wait for the page to load
  await expect(page.locator('input[type="email"]')).toBeVisible();

  // Fill in credentials from environment variables or use manual login
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (email && password) {
    // Automated login with env vars
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL("/meetings", { timeout: 10000 });
  } else {
    // Manual login - pause for user to login
    console.log("\n===========================================");
    console.log("Please login manually in the browser window.");
    console.log("Press Enter in the terminal when done...");
    console.log("===========================================\n");

    // Wait up to 2 minutes for manual login
    await page.waitForURL("/meetings", { timeout: 120000 });
  }

  // Verify we're logged in
  await expect(page).toHaveURL(/\/meetings/);

  // Seed test data for E2E tests
  if (email) {
    console.log("[auth.setup] Seeding test data...");
    const seededData = await seedTestMeeting(email);
    if (seededData) {
      console.log(`[auth.setup] Test meeting seeded: ${seededData.sessionId}`);
    } else {
      console.warn("[auth.setup] Failed to seed test data - tests may fail");
    }
  }

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
