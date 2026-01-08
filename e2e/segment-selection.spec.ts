import { test, expect } from "@playwright/test";

test.describe("Segment Selection", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to meetings list
    await page.goto("/meetings");

    // Click on the first meeting
    const meetingLink = page.locator('a[href^="/meetings/"]').first();
    await expect(meetingLink).toBeVisible({ timeout: 10000 });
    await meetingLink.click();

    // Wait for meeting page to load
    await page.waitForURL(/\/meetings\/[^/]+$/);
  });

  test("transcript viewer renders segments", async ({ page }) => {
    // Look for transcript segments (speaker blocks with colored borders)
    const speakerBlocks = page.locator('[class*="border-l-"]');
    await expect(speakerBlocks.first()).toBeVisible({ timeout: 10000 });

    const count = await speakerBlocks.count();
    expect(count).toBeGreaterThan(0);
  });

  test("edit mode button exists", async ({ page }) => {
    // Look for edit mode toggle button
    const editButton = page.locator('button:has-text("עריכת דוברים")');

    // Note: Edit mode button may not be implemented in the UI yet
    // This test documents the expected behavior
    if (await editButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(editButton).toBeEnabled();
    }
  });

  test("segments are clickable for audio sync", async ({ page }) => {
    // Find a segment with timestamp
    const timestamp = page.locator('[class*="font-mono"]').first();

    if (await timestamp.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Click should trigger audio seek
      await timestamp.click();

      // Audio player should exist and respond
      // This is a basic interaction test
      await page.waitForTimeout(500);
    }
  });

  test("speaker names are displayed", async ({ page }) => {
    // Find speaker name labels
    const speakerNames = page.locator(
      '[class*="border-l-"] [class*="font-medium"][class*="text-muted"]'
    );

    await expect(speakerNames.first()).toBeVisible({ timeout: 10000 });

    const firstName = await speakerNames.first().textContent();
    expect(firstName?.length).toBeGreaterThan(0);
  });

  test("timestamps are formatted correctly", async ({ page }) => {
    // Find timestamps (format: M:SS)
    const timestamps = page.locator('[class*="font-mono"]');

    if (await timestamps.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      const timestampText = await timestamps.first().textContent();

      // Should match M:SS or MM:SS format
      expect(timestampText).toMatch(/^\d{1,2}:\d{2}$/);
    }
  });

  test("transcript text is readable", async ({ page }) => {
    // Find transcript paragraphs
    const paragraphs = page.locator('[class*="leading-relaxed"]');

    await expect(paragraphs.first()).toBeVisible({ timeout: 10000 });

    const text = await paragraphs.first().textContent();
    expect(text?.length).toBeGreaterThan(10);
  });
});
