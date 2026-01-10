# First Week Runbook

Goal: get a new engineer running locally with minimal friction.

## 1) Repo setup
- Clone repo and install dependencies with `npm install`.
- Confirm Node.js and npm versions align with project expectations.

## 2) Environment variables
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Supabase admin (optional): `SUPABASE_SERVICE_ROLE_KEY`.
- OpenAI: `OPENAI_API_KEY`.
- Ivrit/RunPod: `IVRIT_API_KEY`, `IVRIT_ENDPOINT_ID`.
- Neo4j: `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`.

## 3) Run locally
- Start dev server: `npm run dev`.
- Confirm `/login` and `/meetings` load.

## 4) Smoke checklist
- Create a session and upload an audio file.
- Confirm transcription status transitions.
- Open a session and verify summary and action items appear.
- Ask a meeting question in chat.
- Upload an attachment and verify semantic search picks it up.

## 5) Troubleshooting
- Transcription stuck in processing: check RunPod job status and logs.
- Embeddings missing: re-run embeddings endpoint for the session.
- Graph empty: ensure Neo4j credentials are set and entity extraction ran.
- Auth issues: verify Supabase URL/keys and cookie handling.

---

Owners: backend + infra leads should keep this in sync with deployment.
