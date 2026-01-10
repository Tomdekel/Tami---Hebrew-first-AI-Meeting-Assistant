# Architecture Decision Records (ADRs)

Purpose: capture key architectural choices, why they were made, and tradeoffs.

## ADR-001: Next.js App Router for UI + API
- Decision: Use Next.js App Router to host both UI and backend API routes.
- Why: Single deployment surface, shared types, easy auth/session handling.
- Tradeoff: API routes can become monolithic; must enforce modular structure.

## ADR-002: Supabase for Auth, Postgres, Storage
- Decision: Use Supabase for auth, database, and file storage.
- Why: Rapid setup, RLS security, built‑in storage for audio/attachments.
- Tradeoff: Vendor coupling and platform constraints for long‑running tasks.

## ADR-003: pgvector for semantic search
- Decision: Store embeddings in Postgres with pgvector + HNSW.
- Why: Co‑locate data with app DB, simple infra footprint.
- Tradeoff: Tuning required for large corpora and latency.

## ADR-004: RunPod Ivrit for Hebrew ASR
- Decision: Hebrew transcription via Ivrit AI on RunPod.
- Why: High‑quality Hebrew diarization and ASR accuracy.
- Tradeoff: Async job handling and external dependency.

## ADR-005: OpenAI Whisper for English ASR
- Decision: English transcription via OpenAI Whisper API.
- Why: Strong accuracy and simple sync API.
- Tradeoff: Per‑minute cost, file upload overhead.

## ADR-006: GPT-4o + GPT-4o-mini for enrichment
- Decision: Use GPT‑4o for deep refinement and GPT‑4o‑mini for summary/Q&A/IE.
- Why: Balance quality and cost for different tasks.
- Tradeoff: Multiple model paths increase maintenance.

## ADR-007: Neo4j for knowledge graph
- Decision: Use Neo4j for entity relationships and visualization.
- Why: Rich graph queries and visualization support.
- Tradeoff: Separate datastore and consistency coordination.

---

Guideline: add new ADRs when changing infra, storage, AI models, or pipeline behavior.
