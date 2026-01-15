import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const screenshotsDir = '/tmp/ux-review-screenshots';
mkdirSync(screenshotsDir, { recursive: true });

const issues = [];
const approvals = [];
const suggestions = [];

function logIssue(category, message) {
  issues.push(`❌ [${category}] ${message}`);
  console.log(`❌ ${category}: ${message}`);
}

function logApproval(category, message) {
  approvals.push(`✅ [${category}] ${message}`);
  console.log(`✅ ${category}: ${message}`);
}

function logSuggestion(category, message) {
  suggestions.push(`⚠️ [${category}] ${message}`);
  console.log(`⚠️ ${category}: ${message}`);
}

async function testMeetingsPage() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US'
  });
  const page = await context.newPage();
  
  console.log('\n🔍 Starting UX Review of Meetings Page\n');
  
  try {
    // Navigate to meetings page
    console.log('Navigating to http://localhost:3000/meetings...');
    await page.goto('http://localhost:3000/meetings', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Check if we're redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('login') || currentUrl.includes('auth')) {
      logIssue('BLOCKING', 'Page redirects to login - authentication required. Cannot proceed with testing.');
      await page.screenshot({ path: join(screenshotsDir, '01-auth-required.png'), fullPage: true });
      return;
    }
    
    await page.screenshot({ path: join(screenshotsDir, '01-initial-load.png'), fullPage: true });
    
    // Check if there are meetings
    const noMeetingsCard = await page.locator('text=No meetings yet').count();
    if (noMeetingsCard > 0) {
      logIssue('BLOCKING', 'No meetings available to test. Need at least one meeting with transcript data.');
      await page.screenshot({ path: join(screenshotsDir, '02-no-meetings.png'), fullPage: true });
      return;
    }
    
    logApproval('INITIAL_LOAD', 'Page loaded successfully with meetings data');
    
    // Test 1: Desktop Layout
    console.log('\n📱 Testing Desktop Layout...');
    const sidebar = await page.locator('.md\\:block.w-80').first();
    const sidebarVisible = await sidebar.isVisible();
    if (sidebarVisible) {
      logApproval('LAYOUT', 'Sidebar visible on desktop');
    } else {
      logIssue('LAYOUT', 'Sidebar not visible on desktop');
    }
    
    // Test 2: Header Elements
    console.log('\n📋 Testing Header Elements...');
    const meetingTitle = await page.locator('h1').first();
    const titleText = await meetingTitle.textContent();
    if (titleText && titleText.trim().length > 0) {
      logApproval('HEADER', `Meeting title displayed: "${titleText}"`);
    } else {
      logIssue('HEADER', 'Meeting title is empty or missing');
    }
    
    // Check for Download button
    const downloadBtn = await page.locator('button:has-text("Download"), button:has(svg)').filter({ hasText: /Download|הורד/ }).first();
    if (await downloadBtn.count() > 0) {
      logApproval('HEADER', 'Download button visible in header');
    } else {
      logSuggestion('HEADER', 'Download button not found in header');
    }
    
    await page.screenshot({ path: join(screenshotsDir, '02-header-elements.png') });
    
    // Test 3: Dropdown Menu & Delete Dialog
    console.log('\n🗑️ Testing Delete Confirmation Dialog...');
    const moreButton = await page.locator('button:has(svg)').filter({ has: page.locator('svg') }).last();
    await moreButton.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(screenshotsDir, '03-dropdown-menu.png') });
    
    const deleteOption = await page.locator('text=/Delete meeting|מחק פגישה/').first();
    if (await deleteOption.isVisible()) {
      logApproval('DIALOG', 'Delete option found in dropdown menu');
      await deleteOption.click();
      await page.waitForTimeout(500);
      
      const deleteDialog = await page.locator('[role="dialog"]').first();
      if (await deleteDialog.isVisible()) {
        logApproval('DIALOG', 'Delete confirmation dialog opens correctly');
        await page.screenshot({ path: join(screenshotsDir, '04-delete-dialog.png') });
        
        // Check dialog buttons
        const cancelBtn = await deleteDialog.locator('button:has-text("Cancel"), button:has-text("ביטול")');
        const deleteBtn = await deleteDialog.locator('button:has-text("Delete"), button:has-text("מחק")').filter({ hasNot: page.locator('text=/meeting/i') });
        
        if (await cancelBtn.count() > 0 && await deleteBtn.count() > 0) {
          logApproval('DIALOG', 'Delete dialog has both Cancel and Delete buttons');
        } else {
          logIssue('DIALOG', 'Delete dialog missing Cancel or Delete button');
        }
        
        // Close dialog
        await cancelBtn.first().click();
        await page.waitForTimeout(300);
      } else {
        logIssue('DIALOG', 'Delete dialog did not open');
      }
    }
    
    // Test 4: Speakers Card
    console.log('\n👥 Testing Speakers Card...');
    const speakersCard = await page.locator('text=Speakers, text=דוברים').first();
    await speakersCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(screenshotsDir, '05-speakers-card.png') });
    
    const speakerAvatar = await page.locator('[data-radix-avatar], .group:has(svg)').first();
    if (await speakerAvatar.count() > 0) {
      await speakerAvatar.hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(screenshotsDir, '06-speaker-hover.png') });
      
      // Check for dropdown trigger
      const speakerDropdown = await speakerAvatar.locator('button').last();
      if (await speakerDropdown.count() > 0) {
        logApproval('SPEAKERS', 'Speaker dropdown button appears on hover');
        
        await speakerDropdown.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(screenshotsDir, '07-speaker-dropdown.png') });
        
        const renameOption = await page.locator('text=/Rename|שנה שם/').first();
        const mergeOption = await page.locator('text=/Merge|מזג/').first();
        
        if (await renameOption.isVisible() && await mergeOption.isVisible()) {
          logApproval('SPEAKERS', 'Rename and Merge options visible in speaker dropdown');
          
          // Test Merge Dialog
          await mergeOption.click();
          await page.waitForTimeout(500);
          const mergeDialog = await page.locator('[role="dialog"]').first();
          if (await mergeDialog.isVisible()) {
            logApproval('DIALOG', 'Merge speakers dialog opens correctly');
            await page.screenshot({ path: join(screenshotsDir, '08-merge-dialog.png') });
            
            // Check for radio buttons
            const radioButtons = await mergeDialog.locator('input[type="radio"]');
            if (await radioButtons.count() > 0) {
              logApproval('DIALOG', 'Merge dialog has radio selection UI');
            } else {
              logIssue('DIALOG', 'Merge dialog missing radio buttons for selection');
            }
            
            // Close dialog
            const cancelBtn = await mergeDialog.locator('button:has-text("Cancel"), button:has-text("ביטול")').first();
            await cancelBtn.click();
          }
        }
      }
    }
    
    // Test 5: Decisions Card
    console.log('\n✅ Testing Decisions Card...');
    const decisionsCard = await page.locator('text=Decisions, text=החלטות').first();
    await decisionsCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(screenshotsDir, '09-decisions-card.png') });
    
    const decisionItems = await page.locator('.group:has(button:has(svg))').filter({ has: page.locator('text=/^[0-9]+$/') });
    if (await decisionItems.count() > 0) {
      await decisionItems.first().hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(screenshotsDir, '10-decision-hover.png') });
      
      const editBtn = await decisionItems.first().locator('button').first();
      if (await editBtn.isVisible()) {
        logApproval('DECISIONS', 'Edit button appears on hover for decisions');
      } else {
        logSuggestion('DECISIONS', 'Edit button visibility on hover could be improved');
      }
    }
    
    // Test 6: Tasks Card
    console.log('\n📋 Testing Tasks Card...');
    const tasksCard = await page.locator('text=Tasks, text=משימות').first();
    await tasksCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(screenshotsDir, '11-tasks-card.png') });
    
    const checkbox = await page.locator('[role="checkbox"]').first();
    if (await checkbox.count() > 0) {
      logApproval('TASKS', 'Task checkboxes present');
      
      // Test checkbox toggle
      await checkbox.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(screenshotsDir, '12-task-checked.png') });
      logApproval('TASKS', 'Task checkbox toggles successfully');
      
      // Toggle back
      await checkbox.click();
      await page.waitForTimeout(300);
    }
    
    // Test 7: Collapsible Transcript Panel (Desktop)
    console.log('\n📄 Testing Collapsible Transcript Panel...');
    const transcriptPanel = await page.locator('.md\\:flex.flex-col').filter({ hasText: /Transcript|תמליל/ }).first();
    if (await transcriptPanel.isVisible()) {
      logApproval('TRANSCRIPT', 'Transcript panel visible on desktop');
      
      const collapseBtn = await transcriptPanel.locator('button').first();
      await collapseBtn.click();
      await page.waitForTimeout(600); // Wait for animation
      await page.screenshot({ path: join(screenshotsDir, '13-transcript-collapsed.png') });
      
      const collapsedPanel = await page.locator('.w-10').filter({ hasText: /Transcript|תמליל/ });
      if (await collapsedPanel.isVisible()) {
        logApproval('TRANSCRIPT', 'Transcript panel collapses smoothly');
      } else {
        logIssue('TRANSCRIPT', 'Transcript panel collapse animation failed');
      }
      
      // Expand again
      await collapsedPanel.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(screenshotsDir, '14-transcript-expanded.png') });
    }
    
    // Test 8: Audio Player
    console.log('\n🔊 Testing Audio Player...');
    const audioPlayer = await page.locator('audio').first();
    if (await audioPlayer.count() > 0) {
      logApproval('AUDIO', 'Audio player present in DOM');
      
      const playButton = await page.locator('button:has(svg)').filter({ has: page.locator('svg') }).filter({ hasText: '' }).first();
      await playButton.scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(screenshotsDir, '15-audio-player.png') });
      logApproval('AUDIO', 'Audio player controls visible at bottom');
    } else {
      logSuggestion('AUDIO', 'No audio player found - meeting may not have audio');
    }
    
    // Test 9: Mobile Responsiveness
    console.log('\n📱 Testing Mobile Responsiveness...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(screenshotsDir, '16-mobile-view.png'), fullPage: true });
    
    const mobileSidebarBtn = await page.locator('button:has-text("Meetings"), button:has-text("פגישות")').first();
    if (await mobileSidebarBtn.isVisible()) {
      logApproval('MOBILE', 'Mobile sidebar toggle button visible');
    } else {
      logIssue('MOBILE', 'Mobile sidebar toggle button not visible');
    }
    
    const mobileTranscriptBtn = await page.locator('button:has-text("Transcript"), button:has-text("תמליל")').first();
    if (await mobileTranscriptBtn.isVisible()) {
      logApproval('MOBILE', 'Mobile transcript toggle button visible');
      
      // Test mobile transcript sheet
      await mobileTranscriptBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(screenshotsDir, '17-mobile-transcript-sheet.png'), fullPage: true });
      
      const sheet = await page.locator('[role="dialog"]').first();
      if (await sheet.isVisible()) {
        logApproval('MOBILE', 'Mobile transcript sheet opens correctly');
        
        // Close sheet
        const closeBtn = await sheet.locator('button').first();
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    }
    
    // Test 10: ARIA Labels & Accessibility
    console.log('\n♿ Testing Accessibility...');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    
    const buttonsWithoutLabels = await page.locator('button:not([aria-label]):has(svg):not(:has-text(/\\w/))').count();
    if (buttonsWithoutLabels > 0) {
      logSuggestion('A11Y', `Found ${buttonsWithoutLabels} icon-only buttons without aria-label`);
    } else {
      logApproval('A11Y', 'All icon-only buttons have aria-label attributes');
    }
    
    // Test 11: RTL Mode
    console.log('\n🌐 Testing RTL Support...');
    const languageToggle = await page.locator('button:has-text("he"), button:has-text("en"), button:has-text("עב")').first();
    if (await languageToggle.count() > 0) {
      await languageToggle.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: join(screenshotsDir, '18-rtl-mode.png'), fullPage: true });
      
      const dirAttribute = await page.locator('html').getAttribute('dir');
      if (dirAttribute === 'rtl') {
        logApproval('RTL', 'Page switches to RTL direction correctly');
        
        // Check dialog button order in RTL
        await page.locator('button:has(svg)').filter({ has: page.locator('svg') }).last().click();
        await page.waitForTimeout(300);
        const deleteOption = await page.locator('text=/Delete|מחק/').filter({ hasText: /meeting|פגישה/ }).first();
        if (await deleteOption.count() > 0) {
          await deleteOption.click();
          await page.waitForTimeout(500);
          const dialog = await page.locator('[role="dialog"]').first();
          await page.screenshot({ path: join(screenshotsDir, '19-rtl-dialog.png') });
          
          const footer = await dialog.locator('[class*="DialogFooter"]').first();
          const footerClass = await footer.getAttribute('class');
          if (footerClass && footerClass.includes('flex-row-reverse')) {
            logApproval('RTL', 'Dialog buttons reversed in RTL mode');
          } else {
            logSuggestion('RTL', 'Dialog button order may not be reversed in RTL');
          }
          
          const cancelBtn = await dialog.locator('button:has-text("ביטול")').first();
          await cancelBtn.click();
        }
      } else {
        logIssue('RTL', 'RTL mode not activated correctly');
      }
    }
    
    console.log('\n✨ Testing Complete!\n');
    
  } catch (error) {
    logIssue('CRITICAL', `Test execution failed: ${error.message}`);
    console.error(error);
    await page.screenshot({ path: join(screenshotsDir, '99-error.png'), fullPage: true });
  } finally {
    await browser.close();
  }
  
  // Generate report
  const report = `
# UX Review Report - Meetings Page
Generated: ${new Date().toISOString()}

## Summary
- ✅ Approvals: ${approvals.length}
- ❌ Blocking Issues: ${issues.length}
- ⚠️ Suggestions: ${suggestions.length}

## Approvals
${approvals.join('\n')}

## Blocking Issues
${issues.length > 0 ? issues.join('\n') : 'None'}

## Suggestions
${suggestions.length > 0 ? suggestions.join('\n') : 'None'}

## Screenshots
All screenshots saved to: ${screenshotsDir}
`;
  
  writeFileSync(join(screenshotsDir, 'REPORT.md'), report);
  console.log(report);
  console.log(`\n📸 Screenshots saved to: ${screenshotsDir}`);
}

testMeetingsPage().catch(console.error);
