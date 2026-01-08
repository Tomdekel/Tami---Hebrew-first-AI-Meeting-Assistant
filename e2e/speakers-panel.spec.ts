import { test, expect } from "@playwright/test";

test.describe("Speakers Panel", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to meetings list
    await page.goto("/meetings");

    // Click on the first meeting that has a transcript
    const meetingLink = page.locator('a[href^="/meetings/"]').first();
    await expect(meetingLink).toBeVisible({ timeout: 10000 });
    await meetingLink.click();

    // Wait for meeting page to load
    await page.waitForURL(/\/meetings\/[^/]+$/);
  });

  test("speakers panel renders with speaker list", async ({ page }) => {
    // Find the speakers panel by its title
    const speakersPanel = page.locator("text=דוברים").first();
    await expect(speakersPanel).toBeVisible({ timeout: 10000 });

    // Check that speaker items exist (colored dots)
    const speakerDots = page.locator('[class*="rounded-full"][class*="w-3"]');
    const count = await speakerDots.count();
    expect(count).toBeGreaterThan(0);
  });

  test("speakers panel can be collapsed and expanded", async ({ page }) => {
    // Find the speakers panel header (clickable to collapse)
    const speakersHeader = page.locator("text=דוברים").first();
    await expect(speakersHeader).toBeVisible();

    // Get the collapsible content
    const speakerContent = page.locator('[data-state="open"]').filter({
      has: page.locator("text=קטעים"),
    });

    // If content is visible, click to collapse
    if (await speakerContent.isVisible()) {
      await speakersHeader.click();
      // Content should be hidden after collapse
      await expect(speakerContent).not.toBeVisible();

      // Click again to expand
      await speakersHeader.click();
      await expect(speakerContent).toBeVisible();
    }
  });

  test("rename speaker dialog opens", async ({ page }) => {
    // Find and click the edit button (pencil icon)
    const editButton = page.locator('button[title="ערוך"]').first();

    // Skip if no edit button found (no speakers)
    if (!(await editButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await editButton.click();

    // Dialog should open with speaker name input
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const nameInput = dialog.locator('input[id="speakerName"]');
    await expect(nameInput).toBeVisible();

    // Close dialog
    await page.locator('button:has-text("ביטול")').click();
    await expect(dialog).not.toBeVisible();
  });

  test("merge speaker dropdown opens", async ({ page }) => {
    // Find and click the merge button (git-merge icon)
    const mergeButton = page.locator('button[title*="מזג"]').first();

    // Skip if no merge button found (only one speaker)
    if (!(await mergeButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await mergeButton.click();

    // Dropdown menu should appear
    const dropdown = page.locator('[role="menu"]');
    await expect(dropdown).toBeVisible();

    // Should show "Merge into..." text
    await expect(dropdown.locator("text=מזג לתוך")).toBeVisible();

    // Close dropdown by clicking elsewhere
    await page.keyboard.press("Escape");
  });
});
