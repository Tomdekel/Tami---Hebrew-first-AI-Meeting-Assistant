# UX Fix Checklist
**Quick Reference for Developers**

## BLOCKING ISSUES (Must Fix Before Deploy)

### 1. Task Management API Calls
**Files to modify:** `src/components/meetings-page.tsx`

**Lines to fix:**
- Line 354-361: `handleAddTask`
- Line 372-379: `handleSaveTask`
- Line 381-384: `handleDeleteTask`

**What to do:**
```typescript
// Replace TODO comments with actual API calls
const handleAddTask = async () => {
  if (newTask.description.trim()) {
    try {
      const response = await fetch(`/api/sessions/${session.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      })
      if (!response.ok) throw new Error('Failed to add task')
      invalidateSession(session.id)
      toast({ title: isRTL ? "משימה נוספה" : "Task added" })
      setNewTask({ description: "", assignee: "", deadline: "" })
      setShowNewTask(false)
    } catch (error) {
      toast({ 
        title: isRTL ? "שגיאה" : "Error", 
        variant: "destructive" 
      })
    }
  }
}
```

---

### 2. Speaker Merge API Call
**File:** `src/components/meetings-page.tsx`
**Line:** 406-414

**What to do:**
```typescript
const handleMergeParticipants = async () => {
  if (mergeSource && mergeTarget && session) {
    try {
      const response = await fetch(`/api/sessions/${session.id}/speakers/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: mergeSource.speakerId,
          targetId: mergeTarget
        })
      })
      if (!response.ok) throw new Error('Failed to merge speakers')
      invalidateSession(session.id)
      toast({ title: isRTL ? "דוברים מוזגו" : "Speakers merged" })
      setShowMergeDialog(false)
      setMergeSource(null)
      setMergeTarget("")
    } catch (error) {
      toast({ 
        title: isRTL ? "שגיאה במיזוג" : "Merge failed", 
        variant: "destructive" 
      })
    }
  }
}
```

---

### 3. Audio Player Accessibility
**File:** `src/components/meetings/audio-player.tsx`
**Lines:** 114-122

**What to do:**
```typescript
// Add aria-label to skip buttons
<Button 
  variant="ghost" 
  size="sm" 
  className="h-8 w-8 p-0" 
  onClick={skipBackward} 
  title="15 seconds back"
  aria-label="Skip backward 15 seconds"
>
  <RotateCcw className="h-4 w-4" />
</Button>

// Add aria-label to play button (line 117)
<Button 
  onClick={togglePlay} 
  className="h-10 w-10 rounded-full bg-teal-600 hover:bg-teal-700 p-0"
  aria-label={isPlaying ? "Pause audio" : "Play audio"}
>
  {isPlaying ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white mr-[-2px]" />}
</Button>

// Add aria-label to skip forward button (line 120)
<Button 
  variant="ghost" 
  size="sm" 
  className="h-8 w-8 p-0" 
  onClick={skipForward} 
  title="15 seconds forward"
  aria-label="Skip forward 15 seconds"
>
  <RotateCw className="h-4 w-4" />
</Button>
```

---

### 4. Merge Dialog Radio Accessibility
**File:** `src/components/meetings-page.tsx`
**Line:** 1390-1396

**What to do:**
```typescript
<input
  type="radio"
  name="mergeTarget"
  value={p.speakerId}
  checked={mergeTarget === p.speakerId}
  onChange={() => setMergeTarget(p.speakerId)}
  className="sr-only"
  aria-label={isRTL ? `מזג עם ${p.speakerName}` : `Merge into ${p.speakerName}`}
/>
```

---

### 5. Keyboard Navigation Testing
**Manual testing required:**

```bash
# Test these scenarios:
1. Tab through entire page - verify logical order
2. Open delete dialog - press Escape to close
3. Open merge dialog - press Tab to navigate radios, press Enter to select
4. Focus on decision item - press Tab to edit button, press Enter
5. While editing - press Enter to save, Escape to cancel
6. Focus on task checkbox - press Space to toggle
7. Focus on collapsible transcript - press Enter to toggle
8. Verify all buttons have visible focus ring
```

---

## TESTING COMMANDS

### Run Accessibility Audit
```bash
# Install axe DevTools Chrome extension
# Or use this in browser console:
npm install -D @axe-core/cli
npx axe http://localhost:3000/meetings --chrome-options="--headless" > axe-report.json
```

### Keyboard Testing Script
```javascript
// Paste in browser console to log focus events
document.addEventListener('focus', (e) => {
  console.log('Focused:', e.target.tagName, e.target.className, e.target.getAttribute('aria-label'))
}, true)
```

---

## VERIFICATION CHECKLIST

After making fixes, verify:

- [ ] Tasks can be created, edited, and deleted (check network tab)
- [ ] Speaker merge actually merges segments
- [ ] Audio player buttons announce correctly in VoiceOver (Cmd+F5 on Mac)
- [ ] Merge dialog radios announce options in screen reader
- [ ] Tab order is logical (no focus traps except in dialogs)
- [ ] All interactive elements have visible focus ring
- [ ] No console errors or warnings
- [ ] Toast messages appear for all actions

---

## SUGGESTED IMPROVEMENTS (Optional)

### Add Error Boundaries
```typescript
// Add to meetings-page.tsx
const [error, setError] = useState<string | null>(null)

// In API calls:
catch (error) {
  console.error(error)
  setError(error.message)
  toast({ title: "Error", description: error.message, variant: "destructive" })
}
```

### Add Loading States
```typescript
const [isLoading, setIsLoading] = useState(false)

// In API calls:
try {
  setIsLoading(true)
  const response = await fetch(...)
  // ...
} finally {
  setIsLoading(false)
}

// In UI:
<Button disabled={isLoading}>
  {isLoading ? <Loader2 className="animate-spin" /> : "Save"}
</Button>
```

### Wire Up Decisions Persistence
```typescript
// Add API call to save decisions
const handleSaveDecisions = async () => {
  await fetch(`/api/sessions/${session.id}/decisions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisions: localDecisions })
  })
}

// Call after adding/editing/deleting decision
useEffect(() => {
  if (session) {
    handleSaveDecisions()
  }
}, [localDecisions])
```

---

## QUESTIONS?

Refer to:
- `UX_REVIEW_REPORT.md` - Full detailed findings
- `UX_REVIEW_SUMMARY.md` - Executive summary
- Lines referenced above in source files

**After fixing, request re-review from UX team.**
