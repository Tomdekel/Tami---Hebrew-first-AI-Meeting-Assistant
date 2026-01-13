import { test, expect } from "@playwright/test";
import { getTestMeetingId } from "./helpers/seed-data";

const TEST_MEETING_ID = getTestMeetingId();

test.describe("Segment Selection", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly to the seeded test meeting
    await page.goto(`/meetings/${TEST_MEETING_ID}`);

    // Wait for meeting page to load
    await page.waitForURL(/\/meetings\/[^/]+$/);

    // Wait for page content to load
    await page.waitForLoadState("networkidle");
  });

  test("transcript viewer renders segments", async ({ page }) => {
    // Look for transcript text within the transcript panel
    // Use nth(1) to skip any hidden duplicate elements
    const transcriptText = page.getByText(/שלום לכולם/).nth(1);
    await transcriptText.scrollIntoViewIfNeeded();
    await expect(transcriptText).toBeVisible({ timeout: 10000 });
  });

  test("multiple segments are visible", async ({ page }) => {
    // Check that multiple segments from seeded data are visible
    const segment1 = page.getByText(/שלום לכולם/).nth(1);
    const segment2 = page.getByText(/בוקר טוב/).nth(1);

    await segment1.scrollIntoViewIfNeeded();
    await expect(segment1).toBeVisible({ timeout: 10000 });

    await segment2.scrollIntoViewIfNeeded();
    await expect(segment2).toBeVisible({ timeout: 10000 });
  });

  test("speaker names are displayed", async ({ page }) => {
    // Find speaker names from seeded data (דוד and שרה)
    // Use last() to get the visible element (skip hidden duplicates)
    const speakerDavid = page.getByText("דוד").last();
    await expect(speakerDavid).toBeVisible({ timeout: 10000 });
  });

  test("timestamps are visible", async ({ page }) => {
    // Find timestamp elements (format like 0:00, 0:04, etc.)
    const timestamp = page.getByText(/^\d{1,2}:\d{2}$/).first();
    await expect(timestamp).toBeVisible({ timeout: 10000 });
  });

  test("transcript search exists", async ({ page }) => {
    // Find the search input for transcript by role or placeholder
    const searchInput = page.locator('input[type="search"], input[placeholder*="חיפוש"]').last();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });
});
