import { test, expect } from "@playwright/test";

test.describe("Chat Panel", () => {
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

  test("chat panel renders with title", async ({ page }) => {
    // Find the chat panel by its title (שאלות)
    const chatHeader = page.locator("text=שאלות").first();
    await expect(chatHeader).toBeVisible({ timeout: 10000 });
  });

  test("chat panel expands when clicked", async ({ page }) => {
    // Find and click the chat panel header
    const chatHeader = page.locator("text=שאלות").first();
    await expect(chatHeader).toBeVisible();

    // Click to expand
    await chatHeader.click();

    // Input field should be visible when expanded
    const chatInput = page.locator('input[placeholder*="שאל"]');
    await expect(chatInput).toBeVisible({ timeout: 5000 });
  });

  test("chat input accepts text", async ({ page }) => {
    // Expand chat panel
    const chatHeader = page.locator("text=שאלות").first();
    await chatHeader.click();

    // Find and type in the input
    const chatInput = page.locator('input[placeholder*="שאל"]');
    await expect(chatInput).toBeVisible();

    await chatInput.fill("מה הנושא העיקרי?");
    await expect(chatInput).toHaveValue("מה הנושא העיקרי?");
  });

  test("send button is disabled when input is empty", async ({ page }) => {
    // Expand chat panel
    const chatHeader = page.locator("text=שאלות").first();
    await chatHeader.click();

    // Find send button
    const sendButton = page.locator('button:has(svg[class*="lucide-send"])');
    await expect(sendButton).toBeVisible();
    await expect(sendButton).toBeDisabled();

    // Type something
    const chatInput = page.locator('input[placeholder*="שאל"]');
    await chatInput.fill("שאלה");

    // Button should be enabled now
    await expect(sendButton).toBeEnabled();
  });
});
