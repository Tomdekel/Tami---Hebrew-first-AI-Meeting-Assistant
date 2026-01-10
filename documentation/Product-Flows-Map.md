# Product Flows Map

## 1) Record → Summarize → Act
- User records/upload meeting audio.
- Transcription runs (Hebrew async, English sync).
- Summary and action items appear for follow‑up.

## 2) Memory → Ask → Learn
- User asks a question about one meeting.
- RAG uses transcript + attachments to answer.
- User can ask across all meetings (global memory).

## 3) Knowledge Graph → Explore
- Entities extracted after transcription.
- Relationships inferred and stored in Neo4j.
- Graph UI visualizes key connections.

## 4) Organize → Search → Export
- Tags and keyword search organize meetings.
- Semantic search finds fuzzy content matches.
- Export summaries for sharing.

---

Each flow is backed by a dedicated API surface and stored data model.
