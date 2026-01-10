# AI Safety & Quality Guide

## Prompting guidelines
- Keep system prompts explicit about format, scope, and constraints.
- Prefer structured outputs (JSON/function‑call) for summaries/entities.
- Minimize hallucinations by requiring “unknown/not present” responses.

## Quality checks
- Summaries: verify decisions vs action items separation.
- Refinement: ensure no meaning changes; preserve speaker identity.
- Entities: ensure normalization doesn’t merge unrelated items.
- Relationships: only accept explicit relations in text.

## Cost controls
- Use GPT‑4o only for deep refinement.
- Use GPT‑4o‑mini for summarization and extraction.
- Avoid re‑running embeddings unless transcript changed.

## Failure modes
- ASR hallucinations → use deep refinement deletion rules.
- Over‑aggressive refinement → revert via refine DELETE.
- Embedding drift → regenerate embeddings after large edits.

## Monitoring signals
- Rate of refinement deletions spikes.
- Summary error counts or empty outputs.
- Relationship extraction returns too many generic relations.

---

These safeguards should be revisited after model upgrades.
