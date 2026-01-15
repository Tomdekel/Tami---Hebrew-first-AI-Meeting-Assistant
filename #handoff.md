# Handoff (Tami-2)

Context
- Repo: `/Users/tomdekel/tami-2`
- Design source copied into repo: `tami-pages-and-responsibilities (4)`.
- Major UI redesign already integrated across app (meetings, memory, login, etc).
- Production E2E not executed (needs Playwright network access approval). Last attempt to run Playwright was rejected by sandbox.

What changed recently
1) New meeting flow now uses the design component with real functionality.
- File: `src/components/new-meeting-page.tsx`
- Replaces old `/meetings/new` with new UI + real logic:
  - Audio upload (upload + validate + start transcription)
  - Recording (mic + system audio, chunk upload, fallback to full upload)
  - Transcript file import (uses `/api/sessions/import`)
  - Pasted transcript import (creates a text file and imports it)
  - Calendar import UI with OAuth connect + event picker + draft creation
- `src/app/(dashboard)/meetings/new/page.tsx` now just renders the new component.

2) Calendar draft creation endpoint
- File: `src/app/api/sessions/import/calendar/route.ts`
- Creates a draft session with `processing_state = draft` and stores event metadata in `source_metadata`.

3) Draft status behavior on meeting page
- File: `src/components/meetings-page.tsx`
- `processing_state = draft` shows a yellow banner with “Start processing” (uses existing `startTranscription` and is disabled if no audio).
- Important: for drafts created from calendar with no audio/transcript, “Start processing” will fail (backend requires audio_url). This is intended until calendar import pipeline exists.

4) Integration UI
- Integrated into `src/components/new-meeting-page.tsx`.
- Google/Outlook work via existing OAuth routes. Zoom/Teams are visible but disabled (backend not implemented).
- Connection flow:
  - Connect -> OAuth -> redirected to `/meetings/new?integration=google&connected=1`
  - The new meeting page listens for this and loads events.

Testing status
- Production E2E is required by user but not executed yet.
- Playwright config for prod created:
  - `e2e/prod.config.ts` (baseURL `https://tami-2.vercel.app`)
  - `e2e/prod.smoke.spec.ts` (login + check meetings/new/memory pages)
- To run:
  - `TEST_USER_EMAIL="tom@test.com" TEST_USER_PASSWORD="Test123!" npx playwright test -c e2e/prod.config.ts e2e/prod.smoke.spec.ts`
  - Needs network access approval in this environment.

What must be tested (production UI)
1) Login flow (email/password) to `/login` -> `/meetings`.
2) Meetings page renders new UI and loads sessions; processing card appears when session is processing; draft banner appears for draft.
3) `/meetings/new` shows new design; audio upload and transcript import UI present; calendar import UI present.
4) Memory page is chat-first with sidebar and bottom input.
5) Deep links: `/meetings/:id?t=...&seg=...` should seek audio and highlight transcript segment.

Open gaps / follow-ups
- Zoom/Teams integration backend not implemented (UI disabled).
- Calendar import currently creates drafts only; no pipeline to fetch recordings/transcripts.
- Production E2E pending execution once sandbox/network approval is granted.

Notes
- Credentials provided by user: tom@test.com / Test123!
- Production URL: https://tami-2.vercel.app

