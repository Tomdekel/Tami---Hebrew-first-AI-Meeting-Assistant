# Tami: Your Hebrew-First Memory Engine for Conversations

I built Tami because I simply couldn't find what I needed: a reliable, discreet way to transcribe and make sense of meetings conducted mostly in Hebrew.

Existing tools were either inaccurate with Israeli accents, slang, and Hebrew-English mixing, or they required clunky bots/agents that felt intrusive. So, I decided to create one myself.

What started as a focused transcription solution quickly grew into something much bigger — a true **long-term memory engine** that turns scattered conversations into structured, searchable knowledge you can actually use over time.

## Why It Excels at Hebrew Transcription

Tami delivers outstanding accuracy thanks to:

- **Integration with state-of-the-art models from [ivrit.ai](https://ivrit.ai)** (the leading open Hebrew ASR effort, with massive crowd-sourced Israeli data — often outperforming vanilla Whisper in real-world Hebrew benchmarks by 10–20%).
- **A clever post-processing layer using GPT-4o**: it corrects errors, normalizes names/terms, fixes grammar, removes hallucinations, and leverages the full meeting context for near-human quality.

The result? Clean, trustworthy Hebrew transcripts that feel native and reliable — no more frustrating manual fixes.

## The Bigger Vision: From Transcripts to Insights & Memory

The real breakthrough isn't just transcription — it's what happens next.

Tami transforms raw conversations into actionable insights:

- **You can attach context directly to any meeting**: upload the Google Sheet you discussed, the presentation slides, graphs, PDFs — everything becomes part of the same conversation thread.
- **Advanced entity extraction** pulls out key elements (people, projects, dates, prices, organizations) and stores them in a structured knowledge base — turning a simple blurb into meaningful, connected insights.
- **Ask Tami anything** about what was discussed, and it answers with full context and relationships — because it remembers everything.

It's no longer about one-off summaries.

**Tami builds your private, evolving second brain** — a long-term memory that accumulates knowledge across months or years.

## Standout Features (Especially Powerful for Hebrew Users)

- **No external agents or bots** — discreet in-person recording or online meeting listening, all handled inside the app.
- **Entity knowledge base** (with graph-like relations) — search and connect across people, projects, decisions.
- **Per-conversation chat** — drill deep into one specific meeting.
- **Global memory chat** — query your entire history (e.g., "What pricing details did we agree on with Dan last quarter?") with clear citations.
- **Beautiful, intuitive UI** — live waveform, synced audio player, editable speakers, tags, file attachments — designed to feel trustworthy and effortless.
- **Privacy-focused** — your data stays secure, with affordable unlimited plans tailored for real users.

## Tech Stack

Built with:
- **Next.js** — React framework with App Router
- **Supabase** — Database, auth, and storage
- **ivrit.ai ASR** — Hebrew speech recognition via RunPod
- **OpenAI Whisper** — English speech recognition
- **GPT-4o** — Post-processing, summaries, and chat
- **Gemini** — Embeddings for semantic search
- **Neo4j** — Knowledge graph for entity relationships

## Getting Started

```bash
# Clone the repository
git clone https://github.com/Tomdekel/Tami---Hebrew-first-AI-Meeting-Assistant.git
cd Tami---Hebrew-first-AI-Meeting-Assistant

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
npm run dev
```

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
- `OPENAI_API_KEY` — OpenAI API key (for Whisper & GPT-4o)
- `IVRIT_API_KEY` — ivrit.ai RunPod API key
- `IVRIT_ENDPOINT_ID` — ivrit.ai RunPod endpoint ID
- `NEO4J_URI` — Neo4j database URI
- `NEO4J_USERNAME` — Neo4j username
- `NEO4J_PASSWORD` — Neo4j password

---

Tami isn't just another transcription app.

**It's a personal knowledge companion that truly remembers for you** — especially valuable in Hebrew-heavy professional environments where accuracy and context matter most.

Open for contributions — excited to see where this goes!
