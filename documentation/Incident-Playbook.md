# Incident Playbook

## Severity levels
- Sev 1: core transcription or summaries broken for all users.
- Sev 2: partial outages (graph, memory chat, embeddings).
- Sev 3: minor UI issues or isolated user failures.

## First response steps
- Confirm scope: which endpoints and which users.
- Check recent deploys and revert if needed.
- Inspect logs for ASR/LLM provider errors.
- Validate Supabase and Neo4j connectivity.

## Common incidents
- Transcription stuck: verify job status and RunPod API errors.
- Summaries empty: check model errors or invalid transcript data.
- Embeddings missing: re‑run embeddings endpoint, verify pgvector index.
- Graph empty: check Neo4j credentials and entity extraction pipeline.

## Communication
- Update internal status channel every 30–60 minutes.
- Log post‑mortem with timeline, impact, fix, and follow‑ups.

---

This playbook should evolve based on incident history.
