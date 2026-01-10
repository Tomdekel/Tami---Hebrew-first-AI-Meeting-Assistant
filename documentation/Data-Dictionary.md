# Data Dictionary

## sessions
- id: UUID, primary key.
- user_id: owner in Supabase Auth.
- title: meeting title.
- context: free text context for summarization.
- status: pending | recording | processing | refining | completed | failed.
- audio_url: Supabase Storage URL.
- detected_language: he | en | auto.
- duration_seconds: meeting duration.
- created_at, updated_at: timestamps.

## transcripts
- id: UUID, primary key.
- session_id: FK to sessions.
- language: transcript language.
- full_text: full transcript text.

## transcript_segments
- id: UUID, primary key.
- transcript_id: FK.
- speaker_id: diarization speaker label.
- speaker_name: editable display name.
- text: segment text.
- start_time, end_time: seconds.
- segment_order: ordering index.
- original_text: pre‑refinement text.
- is_deleted: soft delete flag.

## summaries
- id: UUID.
- session_id: FK.
- overview: summary paragraph.
- key_points: JSON array.
- decisions: JSON array.
- edited_at: last user edit timestamp.

## action_items
- id: UUID.
- summary_id: FK.
- description: task text.
- assignee: person.
- deadline: date.
- completed: boolean.
- created_at, updated_at.

## entities
- id: UUID.
- user_id: owner.
- type: person | org | project | topic | location | date | product | technology | other.
- value: raw text.
- normalized_value: canonical form.
- mention_count: integer.

## entity_mentions
- id: UUID.
- entity_id: FK.
- session_id: FK.
- context: snippet or note.

## tags
- id: UUID.
- user_id: owner.
- name: tag name.
- color: hex color.
- source: manual | auto:topic | auto:person | auto:project | auto:org.
- is_visible: boolean.

## session_tags
- session_id: FK.
- tag_id: FK.

## memory_embeddings
- id: UUID.
- user_id: owner.
- session_id: FK.
- content: chunk text.
- embedding: vector(1536).
- metadata: JSON (speaker, timestamps, attachment info).

## attachments
- id: UUID.
- session_id: FK.
- user_id: owner.
- name: file name.
- file_url: public URL.
- file_type: MIME type.
- file_size: bytes.
- storage_path: storage key.

## chat_messages
- id: UUID.
- session_id: FK.
- role: user | assistant.
- content: text.

## memory_chat_messages
- id: UUID.
- user_id: owner.
- role: user | assistant.
- content: text.
- sources: JSON array of citations.

---

Neo4j: Entity nodes + relationship edges (WORKS_AT, MANAGES, USES, etc.).
