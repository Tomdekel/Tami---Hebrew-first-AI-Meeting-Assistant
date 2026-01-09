# Tami-2 Handoff Document

## Project Overview
Tami-2 is a Hebrew-first meeting intelligence platform for recording, transcribing, summarizing, and analyzing meetings. Built with Next.js 16, Supabase, and AI services (OpenAI Whisper, Ivrit AI, GPT-4o-mini).

**Live URL**: https://tami-2.vercel.app

---

## Current Session Progress (January 8, 2026)

### Major Feature: Meeting Page 3-Column Redesign

Completely redesigned the meeting detail page (`/meetings/[id]`) from a 2-column to 3-column layout based on user mockups.

#### New Layout Structure

**LEFT Column - Transcript:**
- Transcript viewer with speaker color-coding
- Search box to filter and highlight transcript segments
- Click-to-seek functionality for jumping to timestamps

**CENTER Column - Details:**
- Audio player with playback controls
- Editable summary panel (overview, key points, decisions)
- Action items editor (add, edit, delete, toggle completion)
- Q&A chat panel

**RIGHT Column - Meetings Sidebar:**
- Scrollable list of all user meetings
- Search functionality to filter meetings
- Status badges and language indicators
- Highlights current meeting

#### Files Created
1. `src/components/meetings-sidebar.tsx` - Right column meetings list with search
2. `src/components/action-items-editor.tsx` - Full CRUD for action items
3. `src/components/ui/scroll-area.tsx` - Radix UI scroll area component

#### Files Modified
- `src/app/(dashboard)/meetings/[id]/page.tsx` - Changed to 3-column grid layout
- `src/components/transcript-viewer.tsx` - Added `searchQuery` prop with filtering/highlighting
- `src/components/summary-panel.tsx` - Added edit mode for overview, key points, decisions
- `src/app/api/sessions/[id]/summarize/route.ts` - Added PATCH endpoint for editing summaries
- `src/app/page.tsx` - Added "My Meetings" button with orange styling and NEW badge
- `messages/he.json` - Added `nav.myMeetings` translation
- `messages/en.json` - Added `nav.myMeetings` translation
- `package.json` - Added `@radix-ui/react-scroll-area` dependency

### Features Implemented

1. **Transcript Search**
   - Search input above transcript
   - Filters segments containing search term
   - Highlights matching text with yellow background
   - Shows "No matches" message when no results

2. **Editable Summary**
   - Pencil icon to enter edit mode
   - Textarea for overview editing
   - Add/remove key points
   - Add/remove decisions
   - Save/Cancel buttons
   - PATCH API endpoint at `/api/sessions/[id]/summarize`

3. **Action Items Editor**
   - Toggle completion with checkbox
   - Inline editing of descriptions
   - Add new action items with input field
   - Delete items with trash icon
   - Optimistic updates for smooth UX

4. **Meetings Sidebar**
   - Fetches all user sessions
   - Search to filter by title
   - Shows status, date, language, duration
   - Current meeting highlighted with primary color
   - Click to navigate to different meeting

5. **Home Page "My Meetings" Button**
   - Orange button with calendar icon
   - "NEW" badge to draw attention
   - Links to `/meetings` page

---

## Project Architecture

### Key Directories
```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Login, signup, password reset
│   ├── (dashboard)/       # Protected routes (meetings, profile)
│   └── api/               # API routes
├── components/
│   ├── ui/                # shadcn/ui components
│   └── recording/         # Recorder, Waveform, ModeSelector
├── hooks/                 # Custom hooks (use-recording, use-session, etc.)
├── lib/
│   ├── supabase/          # Supabase clients
│   └── audio.ts           # Audio upload/validation utilities
└── i18n/                  # Internationalization config

messages/
├── he.json                # Hebrew translations (default)
└── en.json                # English translations
```

### Database (Supabase)
- `sessions` - Meeting recordings with status tracking
- `transcripts` / `transcript_segments` - Transcriptions with speaker diarization
- `summaries` / `action_items` - AI-generated summaries
- `entities` / `entity_mentions` - Extracted named entities
- `tags` / `session_tags` - User and auto-generated tags
- `chat_messages` - Q&A conversation history

### External Services
- **Ivrit AI** (RunPod) - Hebrew speech recognition
- **OpenAI Whisper** - English speech recognition
- **GPT-4o-mini** - Summaries and chat

---

## Known Issues / Tech Debt

1. **Middleware deprecation warning**: Next.js 16 warns about "middleware" convention, suggests using "proxy"
2. **No git remote configured**: Commits are local only, deployment via `vercel --prod` CLI
3. **Mobile responsiveness**: 3-column layout hides right sidebar on mobile - may need mobile-friendly alternative

---

## Potential Next Steps

### High Priority
- [ ] Add mobile-friendly way to access meetings list (drawer/modal)
- [ ] Add speaker name editing UI (infrastructure exists in TranscriptViewer editMode)
- [ ] Test full flow: record -> transcribe -> summarize -> edit

### Medium Priority
- [ ] Real-time sync for collaborative editing
- [ ] Auto-generate summary when transcription completes
- [ ] Add keyboard shortcuts for transcript search, panel navigation

### Low Priority
- [ ] Migrate middleware to "proxy" convention
- [ ] Set up git remote for version control
- [ ] Add dark mode toggle

---

## Key Commands

```bash
# Local development
npm run dev

# Build (TypeScript check)
npm run build

# Deploy to Vercel
vercel --prod

# Check deployment logs
vercel logs <deployment-url>
```

---

## Important Files Reference

| File | Purpose |
|------|---------|
| `src/app/(dashboard)/meetings/[id]/page.tsx` | Meeting detail page (3-column layout) |
| `src/components/transcript-viewer.tsx` | Transcript display with search |
| `src/components/summary-panel.tsx` | Editable summary component |
| `src/components/action-items-editor.tsx` | Action items CRUD |
| `src/components/meetings-sidebar.tsx` | Meetings list sidebar |
| `src/hooks/use-session.ts` | Session data fetching hook |
| `src/app/api/sessions/[id]/summarize/route.ts` | Summary API (GET, POST, PATCH) |
| `src/app/api/sessions/[id]/action-items/route.ts` | Action items API |
| `messages/he.json` | Hebrew translations |
| `messages/en.json` | English translations |

---

## Last Deployment
- **Date**: January 8, 2026
- **URL**: https://tami-2.vercel.app
- **Commit**: "Redesign meeting page with 3-column layout"
