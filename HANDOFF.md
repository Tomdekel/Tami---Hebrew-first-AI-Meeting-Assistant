# Tami-2 Handoff Document

## Project Overview
Tami-2 is a Hebrew-first meeting intelligence platform for recording, transcribing, summarizing, and analyzing meetings. Built with Next.js 16, Supabase, and AI services (OpenAI Whisper, Ivrit AI, GPT-4o-mini).

**Live URL**: https://tami-2.vercel.app

---

## Current Session Progress (January 7, 2026)

### Completed Tasks

#### 1. Home Page Hebrew Translation
- **Issue**: Mixed Hebrew/English text on landing page
- **Fix**: Updated `src/app/page.tsx` to use translation keys instead of hardcoded English
- **Files changed**:
  - `src/app/page.tsx`
  - `messages/he.json` (added home page translations)
  - `messages/en.json` (added matching English keys)

#### 2. System Audio Inline Explainer
- **Issue**: No explanation for how system audio recording works
- **Fix**: Added blue info card that appears when "שמע מערכת" mode is selected
- **Files changed**:
  - `src/components/recording/mode-selector.tsx` - Added inline explainer card
  - `messages/he.json` - Added `systemAudio` section with step-by-step instructions
  - `messages/en.json` - Added matching English translations

#### 3. Idle Waveform Animation
- **Issue**: No audio visualization before recording starts
- **Fix**: Created `IdleWaveform` component showing animated sine wave when mode is selected
- **Files created/changed**:
  - `src/components/recording/idle-waveform.tsx` (new)
  - `src/components/recording/recorder.tsx` - Added idle waveform display
  - `src/components/recording/index.ts` - Export new component

#### 4. Recording Validation Error Fix
- **Issue**: "Failed to analyze audio: Unable to decode audio data" when starting recording
- **Root cause**: WebM/Opus files from MediaRecorder cannot be decoded by Web Audio API's `decodeAudioData`
- **Fix**: Skip Web Audio validation for WebM files, use size-based validation instead
- **Files changed**:
  - `src/lib/audio.ts` - Added WebM detection and bypass in `validateAudioForSpeech()`

#### 5. Dashboard Header/Navigation Hebrew Translation
- **Issue**: Dashboard header had hardcoded English strings ("Meetings", "New Meeting", "Sign In", etc.)
- **Fix**: Updated dashboard layout and UserMenu component to use translation keys
- **Files changed**:
  - `src/app/(dashboard)/layout.tsx` - Added `useTranslations()`, replaced hardcoded strings
  - `src/components/user-menu.tsx` - Added `useTranslations()`, replaced all hardcoded strings
  - `messages/he.json` - Added `auth.profile`, `auth.signedOutSuccess`, `auth.signOutFailed`
  - `messages/en.json` - Added matching English keys

#### 6. Meetings List Page Hebrew Translation
- **Issue**: Meetings list page had many hardcoded English strings (status labels, empty states, etc.)
- **Fix**: Comprehensive translation of all user-facing strings
- **Files changed**:
  - `src/app/(dashboard)/meetings/page.tsx` - All strings now use translation keys
  - `messages/he.json` - Added ~50 new translation keys for meetings
  - `messages/en.json` - Added matching English keys

#### 7. Meeting Detail Page Hebrew Translation
- **Issue**: Meeting detail page had extensive hardcoded English (dialogs, tabs, status messages, etc.)
- **Fix**: Full translation coverage for all UI elements
- **Files changed**:
  - `src/app/(dashboard)/meetings/[id]/page.tsx` - All strings now use translation keys
  - Includes: dialogs (delete, create tag, rename speaker), status messages, tab labels, empty states, form placeholders

#### 8. New Meeting Page UX Improvements
- **Issues**:
  - No place to add meeting context/description
  - Upload required manual click after file selection
  - Upload copy wasn't clear
  - Recording button layout issues for RTL
  - No hint when recording mode not selected
- **Fixes**:
  - Added "Meeting Context" field to both Record and Upload tabs
  - Implemented auto-upload: file uploads automatically after selection
  - Redesigned upload UI with drag-drop area and clearer copy
  - Made Start Recording button larger and more prominent
  - Added helpful hint text when no recording mode selected
  - Used flex-row-reverse for RTL-friendly button layout
  - Added stream check for waveform display
- **Files changed**:
  - `src/app/(dashboard)/meetings/new/page.tsx` - Major refactor with context field and auto-upload
  - `src/components/recording/recorder.tsx` - Improved button layout and visibility
  - `messages/he.json` - Added upload context and recording hint translations
  - `messages/en.json` - Added matching English translations

#### 9. Meeting Detail Page Status Badge Translation
- **Issue**: Status badge showed "failed" in English instead of Hebrew "נכשל"
- **Fix**: Changed `{session.status}` to use translation keys for each status
- **Files changed**:
  - `src/app/(dashboard)/meetings/[id]/page.tsx` - Status badge now uses `t("meeting.completed")`, `t("meeting.failed")`, etc.

#### 10. Login Page Hebrew Translation
- **Issue**: Login page had hardcoded English strings ("Tami", "Sign in to your account", "Don't have an account?")
- **Fix**: Full translation of all login page text and toast messages
- **Files changed**:
  - `src/app/(auth)/login/page.tsx` - All strings now use translation keys
  - `messages/he.json` - Added `brand`, `auth.signInDescription`, `auth.noAccount`, `auth.signInSuccess`, `auth.signInFailed`, `auth.invalidCredentials`, `auth.googleSignInFailed`, `auth.unknownError`
  - `messages/en.json` - Added matching English keys

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
├── hooks/                 # Custom hooks (use-recording, use-waveform, etc.)
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
2. **M4A file uploads**: May fail validation in some browsers (workaround: convert to MP3)

---

## Next Steps / Potential Improvements

### High Priority
- [x] Fix remaining English strings in dashboard header/navigation (COMPLETED)
- [x] Add Hebrew translations for dashboard pages (meetings list, meeting detail) (COMPLETED)
- [x] Fix status badge translation on meeting detail page (COMPLETED)
- [x] Add Hebrew translations for login page (COMPLETED)
- [ ] Test recording flow end-to-end with actual microphone

### Medium Priority
- [ ] Add upload progress indicator for large files
- [ ] Implement drag-and-drop file upload
- [ ] Add recording quality indicator (audio levels)

### Low Priority
- [ ] Add dark mode support
- [ ] Implement keyboard shortcuts for recording controls
- [ ] Add export functionality (transcript as text/PDF)

---

## Testing

### Test Account
- **Email**: tom@test.com
- **Password**: Test123!

### E2E Test Coverage (Completed)
- Authentication flow (login/logout)
- Meeting list page
- Audio upload flow
- Meeting detail page with tabs
- Summary generation
- Chat/Q&A feature
- Session deletion

---

## Deployment

```bash
# Deploy to Vercel
vercel deploy --prod

# Local development
npm run dev

# Build
npm run build
```

**Environment Variables Required**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `IVRIT_API_KEY`
- `IVRIT_ENDPOINT_ID`
