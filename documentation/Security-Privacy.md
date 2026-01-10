# Security & Privacy

## Auth & access
- Supabase Auth manages identity and sessions.
- Middleware enforces protected routes and redirects.
- API routes validate ownership for all resources.

## Data boundaries
- Per‑user data enforced with RLS policies.
- Attachments and audio stored in per‑user buckets.
- Sensitive transcripts can be soft‑deleted at segment level.

## Data deletion
- Account deletion endpoint removes all related data.
- Storage cleanup is performed for attachments and audio paths.

## PII considerations
- Meeting content may contain PII; treat transcripts as sensitive.
- Avoid logging raw transcript content in production.
- Scrub or redact logs where feasible.

---

Security posture should be reviewed for each new integration.
