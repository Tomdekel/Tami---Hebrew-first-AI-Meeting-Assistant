import { test, expect } from "@playwright/test";
import { getTestMeetingId } from "./helpers/seed-data";

const TEST_MEETING_ID = getTestMeetingId();

test.describe("Speakers Panel", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly to the seeded test meeting
    await page.goto(`/meetings/${TEST_MEETING_ID}`);

    // Wait for meeting page to load
    await page.waitForURL(/\/meetings\/[^/]+$/);

    // Wait for page content to load
    await page.waitForLoadState("networkidle");
  });

  test("speakers are shown in transcript", async ({ page }) => {
    // Find speaker names from seeded data - David and Sarah
    // Use last() to get the visible element (skip hidden duplicates)
    const speakerDavid = page.getByText("דוד").last();
    const speakerSarah = page.getByText("שרה").last();

    await expect(speakerDavid).toBeVisible({ timeout: 10000 });
    await expect(speakerSarah).toBeVisible({ timeout: 10000 });
  });

  test("speaker count shows 2 speakers", async ({ page }) => {
    // Look for the 2 speakers indicator
    const speakerCount = page.getByText(/2 דוברים/).first();
    await expect(speakerCount).toBeVisible({ timeout: 10000 });
  });

  test("meeting title is visible", async ({ page }) => {
    // Verify the seeded meeting title
    const title = page.getByText("E2E Test Meeting").first();
    await expect(title).toBeVisible({ timeout: 10000 });
  });

  test("meeting context is visible", async ({ page }) => {
    // Verify the seeded meeting context
    const context = page.getByText("פגישה לבדיקת המערכת").first();
    await expect(context).toBeVisible({ timeout: 10000 });
  });
});
