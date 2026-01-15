# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Codebase Summary

**Tami-2** is a Hebrew-first meeting intelligence platform with AI-powered transcription, summaries, entity extraction, and semantic search.

**Stack**: Next.js 16 + React 19, Supabase (Postgres + Auth), Neo4j (knowledge graph), OpenAI + Ivrit AI

**Key Data Flows**:
1. **Transcription**: Audio → Whisper (EN) or Ivrit AI (HE) → Segments → Refinement → Summary → Entities → Embeddings
2. **Q&A**: Question → Query Parser → Keyword/Semantic Search → Evidence → GPT Answer with Citations
3. **Knowledge Graph**: Entities extracted from transcripts → Neo4j → Duplicate detection → Visualization

**For detailed architecture, see [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md).**

## Build & Development Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run start    # Run production server
npm run lint     # Run ESLint
```

## Architecture Overview

Tami-2 is a Hebrew-first meeting intelligence platform built with Next.js 16 (App Router) and Supabase.

### Tech Stack
- **Framework**: Next.js 16 with React 19 Server Components
- **Database/Auth**: Supabase (PostgreSQL + Auth)
- **UI**: shadcn/ui components on Radix UI primitives, styled with Tailwind CSS 4
- **i18n**: next-intl with Hebrew (RTL) as default, English as secondary
- **AI Services**: OpenAI Whisper (English ASR), Ivrit AI via RunPod (Hebrew ASR), GPT-4o-mini (summaries)

### Key Directories
- `src/app/` - Next.js App Router pages and layouts
- `src/components/ui/` - shadcn/ui components (Button, Card, Dialog, Tabs, etc.)
- `src/lib/supabase/` - Supabase clients (client.ts for browser, server.ts for server components)
- `src/lib/types/database.ts` - TypeScript types for all database entities
- `src/i18n/` - Internationalization config (locales: 'he', 'en')
- `messages/` - Translation JSON files (en.json, he.json)
- `supabase/migrations/` - Database schema SQL

### Internationalization (i18n)
- Default locale is Hebrew (`he`) with RTL layout
- Locale stored in `locale` cookie, toggled via `LanguageToggle` component
- Use `useTranslations()` hook in components, translation keys in `messages/*.json`
- RTL-aware utilities in `globals.css` (`.ms-auto`, `.me-auto`, `.start-0`, `.end-0`, etc.)

### Supabase Integration
- Browser client: `import { createClient } from "@/lib/supabase/client"`
- Server client: `import { createClient } from "@/lib/supabase/server"`
- Session refresh handled in `src/middleware.ts`
- Row Level Security (RLS) enabled - all queries filtered by `auth.uid()`

### Database Entities
Core types defined in `src/lib/types/database.ts`:
- `Session` - Meeting recordings with status tracking
- `Transcript` / `TranscriptSegment` - Transcriptions with speaker diarization
- `Summary` / `ActionItem` - AI-generated meeting summaries
- `Entity` / `EntityMention` - Extracted named entities (person, org, project, etc.)
- `Tag` / `SessionTag` - User and auto-generated tags
- `ChatMessage` - Q&A conversation history
- `MemoryEmbedding` - Vector embeddings for semantic search

### Component Conventions
- Server Components by default, add `"use client"` for interactive components
- Use `cn()` from `@/lib/utils` for conditional Tailwind classes
- Path alias `@/*` maps to `./src/*`
- shadcn/ui style: "new-york" variant

### Environment Variables
Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase
- `OPENAI_API_KEY` - English ASR and summaries
- `IVRIT_API_KEY`, `IVRIT_ENDPOINT_ID` - Hebrew ASR via RunPod

## Development Workflow

### Self-Testing Requirements
**IMPORTANT**: Always self-test every feature and UI change before presenting to the user.

1. After implementing any UI change:
   - Use Chrome DevTools MCP or Playwright to navigate to the affected page
   - Take snapshots to verify the UI renders correctly
   - Test user interactions (clicks, form submissions, uploads)
   - Check network requests for errors (especially 4xx/5xx responses)
   - Verify console for JavaScript errors

2. For file uploads:
   - Test with actual files, not just code review
   - Check both small files (<10MB) and large files (>10MB)
   - Verify the complete flow: upload → processing → success/error

3. For API changes:
   - Test the endpoint directly or via UI
   - Check both success and error paths
   - Verify proper error messages are returned

4. Deployment verification:
   - After `vercel --prod`, test the production URL
   - Don't assume local testing is sufficient

## Verification Rules

### The Reality Check (ALL must be YES):
- Did I run the dev server?
- Did I test the exact feature in browser?
- Did I see it work with my own observation?
- Would I bet $100 this works?

### Banned Phrases:
- "This should work now"
- "I've fixed the issue"
- "The logic is correct so..."

### Before Marking Done:
1. npm run typecheck passes
2. Feature verified at localhost:3000
3. No console errors
4. git push succeeds
