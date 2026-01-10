# API Usage Cookbook

Short, task‑oriented API flows for common operations.

## 1) Create a meeting and transcribe
- Create session with optional title/context.
- Upload audio to storage and update session audio_url.
- Trigger transcription.
- Poll transcription status until completed.

## 2) Generate a summary
- Call summarize endpoint for a session.
- Retrieve summary + action items for display.

## 3) Ask a meeting question
- POST chat question to `/api/sessions/:id/chat`.
- Read answer and store chat history.

## 4) Ask a global memory question
- POST question to `/api/memory/chat`.
- Answer includes sources per session.

## 5) Generate embeddings
- POST `/api/sessions/:id/embeddings`.
- Confirm chunk count and token usage.

## 6) Extract entities + relationships
- POST `/api/sessions/:id/entities`.
- POST `/api/sessions/:id/relationships`.

## 7) Attach a document
- Upload via `/api/sessions/:id/attachments`.
- If supported type, embeddings are auto‑created.

## 8) Reprocess pipeline
- POST `/api/sessions/:id/reprocess` with steps.

---

Tip: if a pipeline step fails, rerun only that step to avoid unnecessary cost.
