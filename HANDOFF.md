# Handoff

## Status
- UI updates implemented for New Meeting + Entities (plus meeting detail/transcript/insights earlier).
- Dev server runs locally after resolving Next.js lock/port issues.
- Mock data in Entities added for review, with suggestions/duplicates behavior scoped to 0.8–0.88 confidence.
- No tests or builds run by me.

## What Was Done (recent)
- New Meeting page:
  - Layout matched to reference, single card with tabs and bottom context + CTA.
  - Upload tab shows files + status; added “Add another file” button when files exist.
  - Recording tab includes in-person/online modes; online instructions now short single-line helper.
  - Fixed layout overflow with scrollable tab content.
  - File: `src/app/(dashboard)/meetings/new/page.tsx`
- Entities page:
  - Header shows Suggestions/Duplicates/Settings; suggestions only if confidence in 0.8–0.88 band.
  - Suggestions button disabled with muted style when none; auto-applied hint text shown.
  - Delete actions now require confirmation dialog and display entity name in prompt.
  - Mock entities, relationships, graph nodes/edges, suggestions seeded when API fails or empty.
  - File: `src/app/(dashboard)/entities/page.tsx`
- Duplicate review modal:
  - Mock duplicate groups and summary shown if API returns none or errors.
  - File: `src/components/entities/duplicate-review-modal.tsx`
- Other fixes:
  - `src/components/meetings-v2/transcript-panel.tsx` parse error fixed earlier (extra brace).
  - `src/app/(dashboard)/meetings/[id]/page.tsx` docsOpen -> showDocuments.
  - Suggestions button restored on Entities.
- i18n:
  - Added `entities.suggestions.autoAppliedHint` to `messages/en.json` + `messages/he.json`.

## UX Decisions Implemented
- Suggestions review only in 0.8–0.88 confidence band.
- Below 0.8 ignored; above 0.88 assumed auto-applied (no modal).
- Suggestions button shows muted disabled state + hint text when none.
- Delete actions require confirmation to avoid accidental removal.
- Online recording instructions shortened to a single line to avoid pushing content down.

## Current Behavior
- Entities page shows mock data if `/api/graph/*` endpoints fail or return empty.
- Suggestions modal shows only review-band items (0.8–0.88).
- Duplicates modal shows mock duplicates if API fails or returns none.

## Known Gaps / Optional Follow-ups
- Auto-applied >0.88 items are only hinted via text; no activity log.
- Suggestions button text uses “No pending suggestions” even when disabled; this was requested but might be restyled if needed.
- Mock data is always used when entities API fails; consider a feature flag to disable mocks in production.

## Build / Deploy Notes
- User requested Claude Code to handle build + Vercel deploy.
- Suggested pre-deploy commands:
  - `npm run lint`
  - `npm run build`
- Deploy via Vercel CLI or Git integration (not run here).

## Dev Server Notes
- If Next.js complains about lock: remove `/Users/tomdekel/tami-2/.next/dev/lock` or delete `.next`.
- Port 3000 was in use earlier; killing PID or using another port resolved.

## Files Touched (main)
- `src/app/(dashboard)/meetings/new/page.tsx`
- `src/app/(dashboard)/entities/page.tsx`
- `src/components/entities/duplicate-review-modal.tsx`
- `src/components/meetings-v2/transcript-panel.tsx`
- `src/app/(dashboard)/meetings/[id]/page.tsx`
- `messages/en.json`
- `messages/he.json`

