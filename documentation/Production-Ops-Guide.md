# Production Ops Guide

## Deployment
- One deployable: Next.js app (UI + API routes).
- Ensure all required env vars are set before release.
- Deploy triggers should run lint and e2e checks if available.

## Observability
- Log pipeline failures (transcription, refinement, summarization, embeddings).
- Track latency for transcription status polling endpoints.
- Monitor vector search latency and Neo4j response time.

## Rollback strategy
- Roll back to previous build if core pipelines break.
- Disable auto‑enrichment via feature flags (if added) to isolate issues.

## Data integrity
- Reprocessing endpoint can recover failed summary/entities/embeddings.
- Deep refinement can be reverted via refine DELETE endpoint.

## Common alerts
- ASR job failures (Ivrit/RunPod status = FAILED).
- OpenAI quota errors or rate limit spikes.
- Neo4j connection failures.
- Supabase storage errors for audio/attachments.

---

Note: consider implementing centralized logging + tracing for pipeline stages.
