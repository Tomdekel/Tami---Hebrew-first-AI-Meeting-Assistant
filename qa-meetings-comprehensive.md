# Comprehensive QA Test Report - Meetings Page
Generated: $(date)

## Test Environment
- URL: http://localhost:3000/meetings
- Browser: Chromium (Playwright)
- Authentication: Required (see e2e/auth.setup.ts)

## Test Scenarios

### 1. Delete Meeting Flow
**Steps:**
1. Navigate to /meetings
2. Select a meeting
3. Click dropdown menu (three dots icon)
4. Click "Delete" option
5. Verify confirmation dialog appears with:
   - Title: "Delete Meeting" / "מחיקת פגישה"
   - Description showing meeting title
   - Cancel button
   - Delete button (destructive style)
6. Test Cancel button - should close without deleting
7. Test Delete button - should delete and show toast

**Code Location:** 
- Dialog: lines 1347-1366 in meetings-page.tsx
- Trigger: lines 751-754
- Handler: lines 468-486

**Edge Cases to Test:**
- [ ] Delete while meeting is processing
- [ ] Delete the last meeting in the list
- [ ] Delete with other panels open (chat, documents)
- [ ] Rapid double-click on delete button
- [ ] Delete when meeting is selected but not fully loaded

**Potential Bugs:**
🐛 No loading state on delete button - could allow double submission
🐛 No optimistic UI update - deleted meeting stays visible until refetch
🐛 If delete fails, error dialog should show but success toast might already show

---

### 2. Speaker Management

#### 2.1 Speaker Name Inline Editing
**Steps:**
1. Scroll to Speakers card (line 1159-1253)
2. Click on a speaker chip
3. Click the dropdown menu (MoreHorizontal icon)
4. Select "Rename" / "שנה שם"
5. Input field should appear with current name
6. Type new name
7. Press Enter or click green checkmark
8. Name should update

**Edge Cases:**
- [ ] Empty name (should not save)
- [ ] Very long name (100+ characters)
- [ ] Special characters: emojis, RTL text, punctuation
- [ ] Name with leading/trailing spaces (should be trimmed)
- [ ] Press Escape to cancel - should revert
- [ ] Click outside while editing - what happens?
- [ ] Edit speaker name that appears in multiple segments

**Potential Bugs:**
🐛 Line 1189: Input width fixed at w-28 (7rem) - long names will overflow
🐛 No validation for minimum name length
🐛 Datalist suggestions might not work on all browsers
⚠️ On mobile (line 1212), hover-based dropdown trigger won't work - uses opacity-0

#### 2.2 Merge Speakers Dialog
**Steps:**
1. Click speaker dropdown → "Merge with another"
2. Dialog opens showing all other speakers
3. Select target speaker via radio button
4. Click "Merge" button
5. Should merge and show toast

**Code Location:** lines 1369-1416

**Edge Cases:**
- [ ] Merge source has no segments
- [ ] Merge target has no segments  
- [ ] Merge when only 2 speakers exist
- [ ] Select no target and click Merge (button should be disabled)
- [ ] Close dialog mid-merge
- [ ] Merge speaker that was just renamed

**Potential Bugs:**
🐛 Line 408: TODO comment - merge is not implemented, just shows toast
🐛 No loading state during merge operation
🐛 Radio button uses native input - styling might be inconsistent
⚠️ No confirmation after selecting - clicking outside will lose selection

---

### 3. Decisions CRUD

**Code Location:** lines 170-176 (state), 326-351 (handlers), 914-1010 (UI)

#### 3.1 Add Decision
**Steps:**
1. Click + button next to "Decisions" heading
2. Input field appears
3. Type decision text
4. Press Enter or click "Add" button

**Edge Cases:**
- [ ] Empty input (validation line 328: requires trim())
- [ ] Very long text (500+ characters)
- [ ] Press Escape to cancel
- [ ] Add while in edit mode for another decision
- [ ] Add multiple decisions rapidly
- [ ] Special characters and newlines

**Potential Bugs:**
🐛 No character limit - could create giant decisions
🐛 Line 329: No API persistence - only local state
🐛 No loading/success feedback beyond state update
⚠️ Decisions sync from session on mount (line 300-304) - could overwrite local edits

#### 3.2 Edit Decision
**Steps:**
1. Hover over decision item
2. Edit button appears (pencil icon)
3. Click edit button
4. Input field replaces text
5. Modify text
6. Press Enter or click green checkmark

**Edge Cases:**
- [ ] Edit to empty string (should validate line 341)
- [ ] Edit while another decision is being added
- [ ] Click delete while in edit mode
- [ ] Press Escape to cancel edit
- [ ] Edit on mobile (hover won't work - buttons always visible)

**Potential Bugs:**
🐛 Line 963: Uses `md:opacity-0` - mobile users see buttons always, desktop on hover
⚠️ Edit uses index as key (line 336) - could cause issues if decisions reorder
⚠️ No API call - changes only local

#### 3.3 Delete Decision
**Steps:**
1. Hover over decision
2. Click red trash icon
3. Decision immediately removed

**Edge Cases:**
- [ ] Delete while editing
- [ ] Delete the last decision
- [ ] Delete with empty decisions list
- [ ] Rapid delete clicks

**Potential Bugs:**
🐛 No confirmation dialog - accidental deletes are unrecoverable
🐛 No undo functionality
🐛 No API persistence

---

### 4. Tasks CRUD

**Code Location:** lines 177-183 (state), 353-384 (handlers), 1012-1156 (UI)

#### 4.1 Add Task
**Steps:**
1. Click + button on Tasks card
2. Form appears with: description, assignee, deadline fields
3. Fill description (required)
4. Fill assignee (optional)
5. Select deadline (optional)
6. Click "Add" button

**Edge Cases:**
- [ ] Description only (no assignee/deadline)
- [ ] All fields filled
- [ ] Empty description (should not add - line 355)
- [ ] Very long description
- [ ] Invalid date format
- [ ] Past deadline date
- [ ] Assignee with special characters

**Potential Bugs:**
🐛 Line 356: TODO - no API call, just shows toast
🐛 No validation on assignee or deadline
🐛 Date input is type="date" but no min/max constraints
🐛 On mobile (line 1130), fields stack but no width adjustment
⚠️ Line 1048-1062: Inputs stack on sm breakpoint but date input stays sm:w-32

#### 4.2 Toggle Task Completion
**Steps:**
1. Click checkbox next to task
2. Task should show line-through (line 1083)
3. Checkbox should be checked

**Edge Cases:**
- [ ] Toggle multiple tasks rapidly
- [ ] Toggle while editing a task
- [ ] Toggle while in add mode
- [ ] Completed tasks persist across page reload?

**Potential Bugs:**
🐛 Completion state is local only (useState line 182) - not persisted
🐛 No API call to mark complete
⚠️ On refresh, all tasks reset to incomplete

#### 4.3 Edit Task
**Steps:**
1. Hover over task
2. Click pencil icon
3. Edit mode shows all fields
4. Modify fields
5. Click "Save"

**Edge Cases:**
- [ ] Edit description to empty (line 373 validates)
- [ ] Remove assignee/deadline
- [ ] Click Cancel to revert
- [ ] Edit while another task is in add mode

**Potential Bugs:**
🐛 Line 374: TODO - no API call
🐛 editingTask state (line 179) could get stale if task list changes
🐛 Lines 1093-1112: Hover-only buttons on desktop - mobile always shows

#### 4.4 Delete Task
**Steps:**
1. Hover over task
2. Click red trash icon  
3. Task removed

**Edge Cases:**
- [ ] Delete while editing
- [ ] Delete completed task
- [ ] Delete last task

**Potential Bugs:**
🐛 No confirmation dialog
🐛 Line 382: TODO - no API call
🐛 No undo

---

### 5. Transcript Panel

**Code Location:** TranscriptPanel component (transcript-panel.tsx)

#### 5.1 Collapse/Expand Desktop
**Steps:**
1. On desktop (hidden on mobile, line 1298)
2. Panel visible by default on right side
3. Click chevron button to collapse (line 1309)
4. Panel collapses to 10px width showing vertical "Transcript" text
5. Click vertical text to expand

**Edge Cases:**
- [ ] Collapse while search is active
- [ ] Collapse while editing speaker name
- [ ] Collapse/expand rapidly
- [ ] Transcript state persists across meeting changes?

**Potential Bugs:**
🐛 Line 1333: Button is full height but click target might be awkward
⚠️ No keyboard shortcut to toggle
⚠️ State not persisted - resets on page reload

#### 5.2 Mobile Transcript Sheet
**Steps:**
1. Resize to mobile (<768px, line 1298)
2. Click "Transcript" button in header (line 617-620)
3. Sheet opens from right (or left in RTL)
4. Shows full transcript
5. Click X or swipe to close

**Edge Cases:**
- [ ] Open sheet while other panels are open
- [ ] Rotate device while sheet is open
- [ ] Search in mobile sheet
- [ ] Edit speaker in mobile sheet

**Potential Bugs:**
🐛 Lines 554-580: Duplicate TranscriptPanel rendering (desktop + mobile)
⚠️ Sheet animation might conflict with RTL

#### 5.3 Search in Transcript
**Code Location:** lines 44-215 in transcript-panel.tsx

**Steps:**
1. Click search input in transcript panel
2. Type query
3. Results highlight in yellow (line 142-144)
4. Navigation shows "Result X of Y" (line 183-186)
5. Press Enter for next result
6. Press Shift+Enter for previous result

**Edge Cases:**
- [ ] Search with no results (line 211-215)
- [ ] Search for special regex characters (escaped line 134)
- [ ] Search in RTL text
- [ ] Very long search query
- [ ] Clear search (X button line 170-178)
- [ ] Navigate with 1 result (buttons disabled line 193)

**Potential Bugs:**
🐛 Line 138: Regex escaping might miss edge cases
🐛 Search is case-insensitive (line 78) - no option to change
⚠️ Line 86-90: Index clamping might cause unexpected behavior
⚠️ Smooth scroll (line 99) might not work in all browsers

---

### 6. Mobile Responsiveness

#### 6.1 Mobile Breakpoints
**Test at widths:** 375px, 414px, 768px, 1024px

**Elements to check:**
- [ ] Line 612-620: Mobile sidebar/transcript toggles appear
- [ ] Line 628: Title input full width on mobile
- [ ] Line 653-665: Metadata wraps properly
- [ ] Line 681-757: Header buttons remain accessible
- [ ] Line 963, 1093: Edit/delete always visible on mobile
- [ ] Line 1048, 1130: Task form inputs stack

**Edge Cases:**
- [ ] Landscape orientation
- [ ] Tablet sizes (768-1024px)
- [ ] Very narrow (320px)
- [ ] Touch target sizes (minimum 44x44px)

**Potential Bugs:**
🐛 Line 614: ChevronLeft might be confusing - should it be menu icon?
🐛 Buttons at line 686-722 might overflow on small screens
⚠️ Hidden overflow on meeting title (line 644) - no way to see full text

---

### 7. RTL Testing

**Prerequisites:** Switch to Hebrew via language toggle

**Elements to test:**
- [ ] Dialog buttons order (line 1357: flex-row-reverse)
- [ ] Dropdown menu alignment (line 730: align start/end)
- [ ] Search icon position (line 158: right-3 vs left-3)
- [ ] Button icon margins (isRTL ? "ml-2" : "mr-2")
- [ ] Transcript panel side (line 555: left vs right)
- [ ] Sheet side (line 584: right vs left)
- [ ] Chevron directions (line 1311)

**Edge Cases:**
- [ ] Mixed LTR/RTL text in inputs
- [ ] English numbers in RTL layout
- [ ] Time stamps (forced LTR, line 280)
- [ ] Date inputs (forced LTR, line 1060)

**Potential Bugs:**
🐛 Line 1338: vertical-rl writing mode might not work in RTL
⚠️ Many hardcoded spacing classes might break in RTL
⚠️ Emoji/special chars might not render correctly in RTL

---

### 8. Edge Cases & Error Scenarios

#### 8.1 Empty States
- [ ] No meetings (lines 844-881 - shows connection prompts)
- [ ] No summary (line 910: StatusEmptyState)
- [ ] No decisions (line 989: StatusEmptyState)  
- [ ] No tasks (line 1119: StatusEmptyState)
- [ ] No transcript (line 1326: StatusEmptyState)
- [ ] Processing state (lines 762-783)
- [ ] Failed state (lines 816-841)
- [ ] Draft state (lines 785-814)

**Test each empty state for:**
- [ ] Proper messaging
- [ ] Action buttons work
- [ ] Icons render
- [ ] RTL layout correct

#### 8.2 Long Text/Overflow
- [ ] Meeting title 200+ characters
- [ ] Decision text 1000+ characters
- [ ] Task description 500+ characters
- [ ] Speaker name 50+ characters
- [ ] Very long transcript segments

**Expected behavior:**
- Line 644: Title uses line-clamp-1
- Line 677: Context uses line-clamp-2
- No other explicit truncation found - potential overflow issues

#### 8.3 Special Characters
Test in all inputs:
- Emoji: 🎉 💻 👨‍👩‍👧‍👦
- RTL: עברית العربية
- Symbols: @#$%^&*()
- HTML: <script>alert('xss')</script>
- SQL: ' OR '1'='1
- Newlines and tabs

#### 8.4 Concurrent Actions
- [ ] Edit title while deleting meeting
- [ ] Add decision while editing another
- [ ] Toggle multiple tasks rapidly
- [ ] Open multiple dialogs (should not be possible)
- [ ] Edit speaker in transcript and speakers card simultaneously

#### 8.5 Network Failures
- [ ] Delete meeting with network offline
- [ ] Save title with 500 error
- [ ] Update speaker with timeout
- [ ] Load meetings with auth error

**Expected:** Error toasts (lines 460-465, 479-484, 519-523)

#### 8.6 Loading States
- [ ] Meeting data loading (line 883: MeetingSkeleton)
- [ ] Delete in progress (no loading state - bug)
- [ ] Title save in progress (no loading state - bug)
- [ ] Processing state banner (lines 762-783)

---

## Critical Bugs Found (Code Analysis)

### High Priority
1. **No API persistence for Decisions** (lines 326-351)
   - Changes are local-only, lost on refresh
   - Should call API to persist

2. **No API persistence for Task CRUD** (lines 353-384)
   - Add/Edit/Delete only show toasts, no actual persistence
   - Completion state (line 182) is also local-only

3. **No confirmation on destructive deletes**
   - Decision delete (line 350): immediate, no undo
   - Task delete (line 382): immediate, no undo
   - Meeting delete has confirmation (line 1347) ✅

4. **Speaker merge not implemented** (line 408)
   - Shows toast but doesn't actually merge
   - Dialog works but handler is TODO

5. **No loading states on async actions**
   - Delete meeting button (line 1361)
   - Save title button (line 635)
   - Could allow double-submission

### Medium Priority
6. **Mobile hover interactions** (lines 963, 1093, 1212)
   - Edit/delete buttons use opacity-0 on desktop
   - Mobile always shows (correct) but inconsistent UX

7. **Fixed input widths overflow risk**
   - Speaker name input w-28 (line 1189)
   - Should be flexible or use maxlength

8. **Search regex escaping incomplete** (line 134)
   - Escapes common chars but might miss edge cases
   - Could crash on malformed patterns

9. **Optimistic UI updates missing**
   - Delete meeting: no immediate UI update
   - Should remove from list, then revert if fails

10. **Session decisions sync overwrites local** (lines 300-304)
    - useEffect syncs on session change
    - Could overwrite unsaved local edits

### Low Priority
11. **No keyboard shortcuts**
    - Transcript toggle (line 1309)
    - Quick actions (save, cancel)

12. **Accessibility issues**
    - aria-labels present but incomplete
    - Focus management in dialogs needs testing
    - Keyboard navigation in dropdowns

13. **Vertical text in collapsed panel** (line 1338)
    - writing-mode: vertical-rl might not work everywhere
    - No fallback for unsupported browsers

---

## Test Execution Checklist

### Prerequisites
- [ ] Dev server running (npm run dev)
- [ ] Authenticated (see e2e/auth.setup.ts)
- [ ] Test data: at least 3 meetings with varied states
- [ ] Browser DevTools open (Console + Network tabs)

### Execution
1. **Delete Meeting Flow** (30 min)
2. **Speaker Management** (45 min)
3. **Decisions CRUD** (45 min)
4. **Tasks CRUD** (45 min)
5. **Transcript Panel** (30 min)
6. **Mobile Testing** (45 min)
7. **RTL Testing** (30 min)
8. **Edge Cases** (60 min)

**Total Estimated Time:** 4.5 hours

---

## Recommended Fixes Priority

1. **Immediate (Before Production)**
   - Add API persistence for decisions
   - Add API persistence for tasks
   - Add loading states on delete/save buttons
   - Implement speaker merge or remove UI

2. **Short Term (Next Sprint)**
   - Add confirmation dialogs for decision/task deletes
   - Fix mobile hover interactions
   - Add optimistic UI updates
   - Improve error handling with retry options

3. **Medium Term (Technical Debt)**
   - Add keyboard shortcuts
   - Improve accessibility
   - Add undo functionality
   - Validate all inputs
   - Add character limits where appropriate

---

## Test Automation Recommendations

Create Playwright tests for:
1. Critical path: Delete meeting with confirmation
2. Happy path: Add/edit/delete decision
3. Happy path: Add/edit/toggle task
4. Speaker rename flow
5. Mobile responsive checks (viewport tests)
6. RTL layout checks

**See:** e2e/ directory for existing test patterns

