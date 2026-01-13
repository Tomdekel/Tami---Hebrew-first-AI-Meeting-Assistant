import { test, expect } from "@playwright/test";
import { getTestMeetingId } from "./helpers/seed-data";

const TEST_MEETING_ID = getTestMeetingId();

test.describe("Summary Panel", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly to the seeded test meeting
    await page.goto(`/meetings/${TEST_MEETING_ID}`);

    // Wait for meeting page to load
    await page.waitForURL(/\/meetings\/[^/]+$/);

    // Wait for page content to load
    await page.waitForLoadState("networkidle");
  });

  test("summary panel shows AI generated badge", async ({ page }) => {
    // Find the AI generated badge in summary
    // Use last() to get the visible element (skip hidden duplicates)
    const aiBadge = page.getByText(/נוצר/).last();
    await expect(aiBadge).toBeVisible({ timeout: 10000 });
  });

  test("summary panel shows key points header", async ({ page }) => {
    // Find the key points section
    const keyPointsHeader = page.getByText("נקודות מפתח").nth(1);
    await keyPointsHeader.scrollIntoViewIfNeeded();
    await expect(keyPointsHeader).toBeVisible({ timeout: 10000 });
  });

  test("summary overview is visible", async ({ page }) => {
    // Look for part of the overview text
    const overviewText = page.getByText(/פגישת צוות שבועית/).nth(1);
    await overviewText.scrollIntoViewIfNeeded();
    await expect(overviewText).toBeVisible({ timeout: 10000 });
  });

  test("action items section exists", async ({ page }) => {
    // Look for משימות (tasks) section
    const tasksHeader = page.getByText("משימות").nth(1);
    await tasksHeader.scrollIntoViewIfNeeded();
    await expect(tasksHeader).toBeVisible({ timeout: 10000 });
  });

  test("seeded action item is visible", async ({ page }) => {
    // Look for one of the seeded action items
    const actionItem = page.getByText(/להשלים את המודול/).nth(1);
    await actionItem.scrollIntoViewIfNeeded();
    await expect(actionItem).toBeVisible({ timeout: 10000 });
  });
});
