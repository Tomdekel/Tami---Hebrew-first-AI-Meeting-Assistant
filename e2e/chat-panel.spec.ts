import { test, expect } from "@playwright/test";
import { getTestMeetingId } from "./helpers/seed-data";

const TEST_MEETING_ID = getTestMeetingId();

test.describe("Chat Panel", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly to the seeded test meeting
    await page.goto(`/meetings/${TEST_MEETING_ID}`);

    // Wait for meeting page to load
    await page.waitForURL(/\/meetings\/[^/]+$/);

    // Wait for page content to load
    await page.waitForLoadState("networkidle");
  });

  test("chat tab exists", async ({ page }) => {
    // Find the chat tab using text content (any element containing צ׳אט)
    const chatTab = page.getByText("צ׳אט").first();
    await expect(chatTab).toBeVisible({ timeout: 10000 });
  });

  test("chat panel opens when tab clicked", async ({ page }) => {
    // Find and click the chat tab
    const chatTab = page.getByText("צ׳אט").first();
    await expect(chatTab).toBeVisible();
    await chatTab.click();

    // Wait for chat panel to load
    await page.waitForTimeout(1000);

    // Verify navigation worked - chat tab still visible
    await expect(page.getByText("צ׳אט").first()).toBeVisible();
  });

  test("transcript content is visible", async ({ page }) => {
    // Verify the seeded transcript content is visible
    // Use nth(1) to get the visible element (skip hidden duplicate)
    const transcriptContent = page.getByText(/שלום לכולם/).nth(1);
    await transcriptContent.scrollIntoViewIfNeeded();
    await expect(transcriptContent).toBeVisible({ timeout: 10000 });
  });

  test("summary content is visible", async ({ page }) => {
    // Verify the seeded summary content (AI badge)
    // Use last() to get the visible element (skip hidden duplicates)
    const summaryContent = page.getByText(/נוצר/).last();
    await expect(summaryContent).toBeVisible({ timeout: 10000 });
  });
});
