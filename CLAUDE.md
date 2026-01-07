# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
