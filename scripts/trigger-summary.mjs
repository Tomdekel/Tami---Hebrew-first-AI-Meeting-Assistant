import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const SESSION_ID = "f0e3436a-f9f5-426c-a8d2-8fba58e98c54";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiKey });

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins + ":" + String(secs).padStart(2, "0");
}

async function main() {
  console.log("Fetching transcript segments...");

  // Get transcript
  const { data: transcript } = await supabase
    .from("transcripts")
    .select("id, language")
    .eq("session_id", SESSION_ID)
    .single();

  if (!transcript) {
    console.error("No transcript found");
    return;
  }

  // Get segments
  const { data: segments } = await supabase
    .from("transcript_segments")
    .select("speaker_name, text, start_time")
    .eq("transcript_id", transcript.id)
    .order("segment_order");

  if (!segments || segments.length === 0) {
    console.error("No segments found");
    return;
  }

  console.log("Found " + segments.length + " segments");

  // Format for GPT
  const formattedTranscript = segments
    .map((seg) => {
      const ts = seg.start_time ? "[" + formatTime(seg.start_time) + "] " : "";
      return ts + seg.speaker_name + ": " + seg.text;
    })
    .join("\n");

  console.log("Generating summary...");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a meeting summarization expert. Analyze meeting transcripts and provide comprehensive summaries.

Your task is to create:

1. **Overview**: A comprehensive paragraph (4-6 sentences) summarizing the main topics, participants, key outcomes, and overall purpose of the meeting.

2. **Notes**: Divide the meeting into 4-8 major topic sections. Each section needs:
   - A descriptive title (in Hebrew)
   - An appropriate emoji from this list:
     🤝 Introductions/personal updates
     📈 Business achievements/results
     🏗️ Roles/team structure
     🤖 AI/technology discussions
     💼 Business opportunities
     💰 Compensation/salary terms
     🎯 Goals/strategy
     📋 Projects/deliverables
     💡 Ideas/brainstorming
     ❓ Q&A/discussions
   - Time range (start - end) based on transcript timestamps
   - 2-4 bullet points summarizing key information in that section

3. **Action Items**: Tasks that need to be done, grouped by assignee. Include:
   - Clear task description
   - Who is responsible
   - Deadline if specified

4. **Decisions**: Conclusions or agreements reached during the meeting.

5. **Key Points**: 3-5 most important takeaways.

6. **Topics**: Main subjects discussed (for tagging).

IMPORTANT: Output all text content in Hebrew (matching the transcript language).`
      },
      { role: "user", content: "Transcript:\n" + formattedTranscript }
    ],
    functions: [{
      name: "save_summary",
      parameters: {
        type: "object",
        properties: {
          overview: { type: "string" },
          notes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                emoji: { type: "string" },
                startTime: { type: "string" },
                endTime: { type: "string" },
                bullets: { type: "array", items: { type: "string" } }
              },
              required: ["title", "emoji", "startTime", "endTime", "bullets"]
            }
          },
          keyPoints: { type: "array", items: { type: "string" } },
          actionItems: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                assignee: { type: "string" },
                deadline: { type: "string" }
              },
              required: ["description"]
            }
          },
          decisions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                context: { type: "string" }
              },
              required: ["description"]
            }
          },
          topics: { type: "array", items: { type: "string" } }
        },
        required: ["overview", "notes", "keyPoints", "actionItems", "decisions", "topics"]
      }
    }],
    function_call: { name: "save_summary" },
    temperature: 0.3
  });

  const args = JSON.parse(response.choices[0].message.function_call.arguments);
  console.log("Summary generated:", args.overview.substring(0, 100) + "...");
  console.log("Notes sections:", args.notes?.length || 0);
  console.log("Action items:", args.actionItems?.length || 0);

  // Get session user_id
  const { data: session } = await supabase
    .from("sessions")
    .select("user_id")
    .eq("id", SESSION_ID)
    .single();

  if (!session) {
    console.error("Session not found");
    return;
  }

  // Insert summary (existing columns: overview, key_points, decisions)
  // Note: 'notes' column doesn't exist in DB yet - migration pending
  const { data: summary, error: insertError } = await supabase
    .from("summaries")
    .insert({
      session_id: SESSION_ID,
      overview: args.overview,
      key_points: args.keyPoints || [],
      decisions: (args.decisions || []).map(d => ({
        description: d.description,
        context: d.context || null
      }))
    })
    .select()
    .single();

  if (insertError) {
    console.error("Insert error:", insertError);
    return;
  }

  console.log("Summary inserted with ID:", summary.id);

  // Insert action items into separate table
  if (args.actionItems && args.actionItems.length > 0) {
    const actionItems = args.actionItems.map(item => ({
      summary_id: summary.id,
      description: item.description,
      assignee: item.assignee || null,
      deadline: item.deadline || null,
      completed: false
    }));

    const { error: actionError } = await supabase
      .from("action_items")
      .insert(actionItems);

    if (actionError) {
      console.error("Action items error:", actionError);
    } else {
      console.log("Action items saved:", actionItems.length);
    }
  }

  // Create tags from topics
  if (args.topics && args.topics.length > 0) {
    for (const topic of args.topics) {
      // Check if tag exists
      const { data: existingTag } = await supabase
        .from("tags")
        .select("id")
        .eq("user_id", session.user_id)
        .eq("name", topic)
        .single();

      let tagId = existingTag?.id;

      if (!tagId) {
        const { data: newTag } = await supabase
          .from("tags")
          .insert({
            user_id: session.user_id,
            name: topic,
            color: "#6366f1",
            source: "auto:topic",
            is_visible: true
          })
          .select("id")
          .single();
        tagId = newTag?.id;
      }

      if (tagId) {
        await supabase
          .from("session_tags")
          .upsert({ session_id: SESSION_ID, tag_id: tagId });
      }
    }
    console.log("Topics saved as tags:", args.topics.length);
  }

  // Update session status
  await supabase
    .from("sessions")
    .update({ status: "completed" })
    .eq("id", SESSION_ID);

  console.log("Summary saved successfully!");
}

main().catch(console.error);
