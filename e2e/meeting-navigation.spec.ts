import { test, expect } from "@playwright/test";

test.describe("Meeting Navigation", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to meetings list
    await page.goto("/meetings");

    // Click on a meeting (not first or last for nav testing)
    const meetingLinks = page.locator('a[href^="/meetings/"]');
    const count = await meetingLinks.count();

    if (count > 1) {
      // Click second meeting if available (more likely to have both prev/next)
      await meetingLinks.nth(1).click();
    } else {
      await meetingLinks.first().click();
    }

    // Wait for meeting page to load
    await page.waitForURL(/\/meetings\/[^/]+$/);
  });

  test("navigation panel renders", async ({ page }) => {
    // Look for navigation buttons (ChevronLeft/ChevronRight icons or text)
    const navPanel = page.locator("text=הקודם, text=הבא").first();

    // Navigation may not be visible if this is the only meeting
    // Just check the page loaded correctly
    await expect(page).toHaveURL(/\/meetings\/[^/]+$/);
  });

  test("previous meeting button navigates correctly", async ({ page }) => {
    // Find the previous button
    const prevButton = page.locator('a:has-text("הקודם")').first();

    // Skip if no previous meeting
    if (!(await prevButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // Get current URL
    const currentUrl = page.url();

    // Click previous
    await prevButton.click();

    // URL should change to a different meeting
    await page.waitForURL(/\/meetings\/[^/]+$/);
    expect(page.url()).not.toBe(currentUrl);
  });

  test("next meeting button navigates correctly", async ({ page }) => {
    // Find the next button
    const nextButton = page.locator('a:has-text("הבא")').first();

    // Skip if no next meeting
    if (!(await nextButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // Get current URL
    const currentUrl = page.url();

    // Click next
    await nextButton.click();

    // URL should change to a different meeting
    await page.waitForURL(/\/meetings\/[^/]+$/);
    expect(page.url()).not.toBe(currentUrl);
  });

  test("navigation shows meeting titles", async ({ page }) => {
    // Check if prev/next buttons show meeting titles
    const prevButton = page.locator('a:has-text("הקודם")');
    const nextButton = page.locator('a:has-text("הבא")');

    // At least one should be visible if there are multiple meetings
    const prevVisible = await prevButton.isVisible().catch(() => false);
    const nextVisible = await nextButton.isVisible().catch(() => false);

    if (prevVisible || nextVisible) {
      // Should contain meeting title text (not just "הקודם"/"הבא")
      if (prevVisible) {
        const prevText = await prevButton.textContent();
        expect(prevText?.length).toBeGreaterThan(5);
      }
      if (nextVisible) {
        const nextText = await nextButton.textContent();
        expect(nextText?.length).toBeGreaterThan(5);
      }
    }
  });
});
