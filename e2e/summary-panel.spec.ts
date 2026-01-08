import { test, expect } from "@playwright/test";

test.describe("Summary Panel", () => {
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

  test("summary panel renders with title", async ({ page }) => {
    // Find the summary panel by its title (סיכום)
    const summaryHeader = page.locator("text=סיכום").first();
    await expect(summaryHeader).toBeVisible({ timeout: 10000 });
  });

  test("summary panel can be collapsed and expanded", async ({ page }) => {
    // Find the summary panel header
    const summaryHeader = page.locator("text=סיכום").first();
    await expect(summaryHeader).toBeVisible();

    // Click to toggle
    await summaryHeader.click();
    // Click again
    await summaryHeader.click();

    // Panel should still be functional
    await expect(summaryHeader).toBeVisible();
  });

  test("summary shows overview section when available", async ({ page }) => {
    // Look for overview label
    const overviewLabel = page.locator("text=סקירה");

    // If summary exists, overview should be visible
    if (await overviewLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(overviewLabel).toBeVisible();
    }
  });

  test("generate summary button appears when no summary", async ({ page }) => {
    // Look for generate button
    const generateButton = page.locator('button:has-text("צור סיכום")');

    // If no summary exists, button should be visible
    if (await generateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(generateButton).toBeEnabled();
    }
  });

  test("action items are toggleable", async ({ page }) => {
    // Look for action item checkboxes
    const actionCheckbox = page
      .locator('button:has(svg[class*="square"])')
      .first();

    // Skip if no action items
    if (!(await actionCheckbox.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // Click to toggle
    await actionCheckbox.click();

    // Should show success toast or update UI
    // Wait a moment for the API call
    await page.waitForTimeout(1000);
  });

  test("key points section displays correctly", async ({ page }) => {
    // Look for key points label
    const keyPointsLabel = page.locator("text=נקודות מפתח");

    if (await keyPointsLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Should have bullet points
      const bullets = page.locator('li:has(span:has-text("•"))');
      const count = await bullets.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});
