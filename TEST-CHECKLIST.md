# Meetings Page Test Checklist

Quick reference for manual testing. Check off as you test.

## Setup
- [ ] Dev server running: `npm run dev`
- [ ] Authenticated to http://localhost:3000
- [ ] At least 3 test meetings exist with varied data
- [ ] Browser DevTools open (Console + Network tabs)

---

## 1. Delete Meeting (30 min)

### Happy Path
- [ ] Click dropdown menu (three dots)
- [ ] Click "Delete" option
- [ ] Confirmation dialog appears
- [ ] Dialog shows correct meeting title
- [ ] Cancel button closes dialog without deleting
- [ ] Delete button removes meeting and shows toast
- [ ] Redirects to another meeting or meetings list

### Edge Cases
- [ ] Delete while meeting is processing
- [ ] Delete the only/last meeting
- [ ] Delete with chat/docs panel open
- [ ] Rapid double-click delete button
- [ ] Network offline during delete
- [ ] Check Console for errors
- [ ] Check Network tab for API calls

### Bugs to Watch For
- Double submission (no loading state)
- Deleted meeting stays visible
- Error handling

---

## 2. Speaker Management (45 min)

### Inline Editing
- [ ] Click speaker dropdown → Rename
- [ ] Input appears with current name
- [ ] Type new name and press Enter
- [ ] Name updates in speakers list
- [ ] Name updates in transcript
- [ ] Edit another speaker
- [ ] Press Escape to cancel edit
- [ ] Try empty name (should not save)
- [ ] Try very long name (50+ chars)
- [ ] Try special characters: @#$%
- [ ] Try emoji: 🎉
- [ ] Try RTL text: עברית

### Merge Dialog
- [ ] Click speaker dropdown → Merge
- [ ] Dialog shows all other speakers
- [ ] Select target with radio button
- [ ] Visual feedback on selection
- [ ] Merge button disabled when no selection
- [ ] Click Merge (NOTE: Not implemented, just shows toast)
- [ ] Verify toast appears
- [ ] Close dialog with X or Cancel

### Bugs to Watch For
- Input width overflow (w-28)
- Hover dropdown not working on mobile
- Merge doesn't actually work (TODO)

---

## 3. Decisions CRUD (45 min)

### Add Decision
- [ ] Click + button
- [ ] Input field appears
- [ ] Type decision text
- [ ] Press Enter to save
- [ ] Decision appears in list
- [ ] Try adding with empty input (should not add)
- [ ] Add multiple decisions rapidly
- [ ] Add very long text (500+ chars)
- [ ] Special characters and emoji

### Edit Decision
- [ ] Hover over decision
- [ ] Edit button appears (pencil icon)
- [ ] Click edit
- [ ] Input replaces text
- [ ] Modify text
- [ ] Press Enter to save
- [ ] Changes appear
- [ ] Try editing to empty (should not save)
- [ ] Press Escape to cancel
- [ ] Edit while another is in add mode

### Delete Decision
- [ ] Hover over decision
- [ ] Trash icon appears
- [ ] Click trash icon
- [ ] Decision removed immediately
- [ ] Try deleting last decision
- [ ] Try rapid delete clicks

### Refresh Test
- [ ] Add 2 new decisions
- [ ] DO NOT REFRESH YET
- [ ] Verify they appear in UI
- [ ] NOW REFRESH PAGE
- [ ] **BUG:** Decisions should be lost (no API persistence)

### Bugs to Watch For
- No API calls (check Network tab)
- No confirmation on delete
- Changes lost on refresh
- Hover buttons on mobile

---

## 4. Tasks CRUD (45 min)

### Add Task
- [ ] Click + button on Tasks
- [ ] Form appears with 3 fields
- [ ] Fill description only
- [ ] Click Add
- [ ] Task appears
- [ ] Add task with all fields
- [ ] Try empty description (should not add)
- [ ] Try very long description
- [ ] Try past deadline date
- [ ] Try special characters in assignee

### Toggle Completion
- [ ] Click checkbox on a task
- [ ] Task gets line-through styling
- [ ] Checkbox is checked
- [ ] Click again to uncheck
- [ ] Line-through removed
- [ ] Toggle multiple tasks
- [ ] Refresh page
- [ ] **BUG:** All tasks reset to incomplete

### Edit Task
- [ ] Hover over task
- [ ] Pencil icon appears
- [ ] Click edit
- [ ] All 3 fields editable
- [ ] Modify fields
- [ ] Click Save
- [ ] Changes appear
- [ ] Try editing to empty description
- [ ] Click Cancel to revert
- [ ] Edit while in add mode

### Delete Task
- [ ] Hover over task
- [ ] Trash icon appears
- [ ] Click trash
- [ ] Task removed immediately
- [ ] Delete completed task
- [ ] Delete last task

### Refresh Test
- [ ] Add a new task
- [ ] Toggle one to complete
- [ ] Edit another
- [ ] REFRESH PAGE
- [ ] **BUG:** All changes lost (no API persistence)

### Bugs to Watch For
- No API calls
- No confirmation on delete
- Completion state not persisted
- Form inputs on mobile

---

## 5. Transcript Panel (30 min)

### Desktop Collapse/Expand
- [ ] Panel visible on right by default
- [ ] Click chevron button
- [ ] Panel collapses to vertical text
- [ ] Click vertical text area
- [ ] Panel expands again
- [ ] Collapse while search active
- [ ] Collapse while editing speaker

### Mobile Sheet
- [ ] Resize to mobile width (< 768px)
- [ ] Transcript panel hidden
- [ ] Click "Transcript" button in header
- [ ] Sheet opens from side
- [ ] Full transcript visible
- [ ] Click X to close
- [ ] Swipe to close (if supported)
- [ ] Search in mobile sheet
- [ ] Edit speaker in mobile sheet

### Search Functionality
- [ ] Click search input
- [ ] Type query (e.g., "meeting")
- [ ] Results highlight in yellow
- [ ] Navigation shows "Result X of Y"
- [ ] Press Enter for next result
- [ ] Press Shift+Enter for previous
- [ ] Try query with no results
- [ ] Try special characters: ()[]{}
- [ ] Try very long query
- [ ] Click X to clear search
- [ ] Navigate with only 1 result

### Bugs to Watch For
- Regex escaping issues
- Smooth scroll compatibility
- Vertical text in RTL
- Click target on collapsed panel

---

## 6. Mobile Responsive (45 min)

### Test Each Width
Resize browser to:
- [ ] 320px (very narrow)
- [ ] 375px (iPhone SE)
- [ ] 414px (iPhone Pro)
- [ ] 768px (tablet breakpoint)
- [ ] 1024px (landscape tablet)

### At Each Width Check
- [ ] Header buttons accessible
- [ ] Title doesn't overflow
- [ ] Metadata wraps properly
- [ ] Sidebar toggle works
- [ ] Transcript toggle works
- [ ] Edit/delete buttons visible
- [ ] Task form inputs stack
- [ ] Dialogs are readable
- [ ] Touch targets 44x44px minimum

### Landscape Orientation
- [ ] Rotate device to landscape
- [ ] All features still work
- [ ] No horizontal scroll
- [ ] Buttons remain accessible

### Bugs to Watch For
- Button overflow on small screens
- Hidden overflow on title
- Form layout on mobile
- Touch target sizes

---

## 7. RTL Testing (30 min)

### Switch to Hebrew
- [ ] Find language toggle
- [ ] Switch to Hebrew (he)
- [ ] Entire page switches direction
- [ ] dir="rtl" on root elements

### Test Each Element
- [ ] Dialog buttons in correct order
- [ ] Dropdown menus align correctly
- [ ] Search icon on correct side
- [ ] Button icons have correct margin
- [ ] Transcript panel on correct side
- [ ] Sheet opens from correct side
- [ ] Chevrons point correct direction
- [ ] Timestamps remain LTR (correct)
- [ ] Date inputs remain LTR (correct)

### Mixed Content
- [ ] Type English in Hebrew interface
- [ ] Type Hebrew in English interface
- [ ] Numbers in RTL context
- [ ] Emoji in RTL context
- [ ] Mixed LTR/RTL in same field

### Bugs to Watch For
- Vertical text in RTL
- Hardcoded spacing classes
- Button icon margins
- Dialog button order

---

## 8. Edge Cases (60 min)

### Empty States
- [ ] No meetings (connection prompts)
- [ ] No summary (empty state)
- [ ] No decisions (empty state)
- [ ] No tasks (empty state)
- [ ] No transcript (empty state)
- [ ] Meeting processing (stepper shows)
- [ ] Meeting failed (error banner)
- [ ] Meeting draft (draft banner)

### Long Text Overflow
- [ ] Title with 200 characters
- [ ] Decision with 1000 characters
- [ ] Task description with 500 chars
- [ ] Speaker name with 50 chars
- [ ] Transcript segment very long

### Special Characters
Test in all inputs:
- [ ] HTML: `<script>alert('xss')</script>`
- [ ] SQL: `' OR '1'='1`
- [ ] Emoji: 🎉 💻 👨‍👩‍👧‍👦
- [ ] RTL: עברית العربية
- [ ] Symbols: @#$%^&*()
- [ ] Newlines and tabs
- [ ] Unicode: ñ ö ü ø

### Concurrent Actions
- [ ] Edit title while deleting meeting
- [ ] Add decision while editing another
- [ ] Toggle multiple tasks rapidly
- [ ] Try opening multiple dialogs
- [ ] Edit speaker in two places

### Network Failures
- [ ] Go offline (DevTools → Network → Offline)
- [ ] Try deleting meeting
- [ ] Try saving title
- [ ] Try updating speaker
- [ ] Check error messages
- [ ] Go back online
- [ ] Verify retry works

### Console Errors
- [ ] Check Console throughout testing
- [ ] No red errors (warnings OK)
- [ ] No 404s in Network tab
- [ ] No 500 errors
- [ ] API calls succeed

---

## Post-Testing

### Document Findings
- [ ] Screenshot any visual bugs
- [ ] Note all Console errors
- [ ] List failed Network requests
- [ ] Write up reproduction steps
- [ ] Rate severity (Critical/High/Medium/Low)

### File Locations for Bugs
- Main component: `/Users/tomdekel/tami-2/src/components/meetings-page.tsx`
- Transcript: `/Users/tomdekel/tami-2/src/components/meetings/transcript-panel.tsx`
- Page wrapper: `/Users/tomdekel/tami-2/src/app/(dashboard)/meetings/[id]/page.tsx`

---

## Known Issues (From Code Analysis)

Don't be surprised if you find:

1. Decisions/tasks not persisting (no API calls)
2. No confirmation on decision/task delete
3. Speaker merge doesn't work (TODO)
4. No loading states on delete/save
5. Decisions overwritten by session sync
6. Input validation missing
7. Fixed input widths overflow
8. Hover interactions inconsistent on mobile

**These are EXPECTED bugs based on code review.**

---

## Time Budget

- Delete Meeting: 30 min
- Speaker Management: 45 min
- Decisions CRUD: 45 min
- Tasks CRUD: 45 min
- Transcript Panel: 30 min
- Mobile Testing: 45 min
- RTL Testing: 30 min
- Edge Cases: 60 min

**Total: 4.5 hours**

---

Generated: 2026-01-14
For use with: http://localhost:3000/meetings
