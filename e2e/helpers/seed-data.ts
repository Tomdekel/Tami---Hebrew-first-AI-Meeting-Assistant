/**
 * E2E Test Data Seeding
 *
 * Creates a complete test meeting with transcript, segments, and summary
 * for E2E tests to use.
 */
import { createAdminClient, getUserIdByEmail } from "./supabase-admin";

// Valid UUIDs for test data (using v4 UUID format)
const TEST_SESSION_ID = "e2e00001-0000-4000-8000-000000000001";
const TEST_TRANSCRIPT_ID = "e2e00002-0000-4000-8000-000000000001";

export interface SeededMeetingData {
  sessionId: string;
  transcriptId: string;
  userId: string;
}

/**
 * Seeds a complete test meeting for E2E tests
 */
export async function seedTestMeeting(userEmail: string): Promise<SeededMeetingData | null> {
  const admin = createAdminClient();

  // Get user ID from email
  const userId = await getUserIdByEmail(userEmail);
  if (!userId) {
    console.error(`User not found for email: ${userEmail}`);
    return null;
  }

  console.log(`[seed-data] Seeding test meeting for user: ${userId}`);

  try {
    // Clean up any existing test data first
    await cleanupTestData(userId);

    // 1. Create session
    const { error: sessionError } = await admin.from("sessions").insert({
      id: TEST_SESSION_ID,
      user_id: userId,
      title: "פגישת בדיקה - E2E Test Meeting",
      context: "פגישה לבדיקת המערכת",
      status: "completed",
      audio_url: "https://example.com/test-audio.mp3",
      detected_language: "he",
      duration_seconds: 120,
      source_type: "recorded",
      has_timestamps: true,
      ingestion_confidence: "high",
    });

    if (sessionError) {
      console.error("[seed-data] Session creation error:", sessionError);
      throw sessionError;
    }

    // 2. Create transcript
    const { error: transcriptError } = await admin.from("transcripts").insert({
      id: TEST_TRANSCRIPT_ID,
      session_id: TEST_SESSION_ID,
      language: "he",
      full_text: "שלום לכולם. בוקר טוב, נתחיל? תודה, אני מצטרף. בואו נדבר על הפרויקט החדש. יש לנו כמה נושאים חשובים לדון בהם.",
      origin: "asr",
    });

    if (transcriptError) {
      console.error("[seed-data] Transcript creation error:", transcriptError);
      throw transcriptError;
    }

    // 3. Create transcript segments
    const segments = [
      {
        transcript_id: TEST_TRANSCRIPT_ID,
        speaker_id: "speaker-1",
        speaker_name: "דוד",
        text: "שלום לכולם, בואו נתחיל את הפגישה.",
        start_time: 0,
        end_time: 3.5,
        segment_order: 0,
      },
      {
        transcript_id: TEST_TRANSCRIPT_ID,
        speaker_id: "speaker-2",
        speaker_name: "שרה",
        text: "בוקר טוב! יש לי כמה עדכונים חשובים מהשבוע.",
        start_time: 4.0,
        end_time: 8.2,
        segment_order: 1,
      },
      {
        transcript_id: TEST_TRANSCRIPT_ID,
        speaker_id: "speaker-1",
        speaker_name: "דוד",
        text: "מצוין, בואי נשמע. מה קרה עם הפרויקט החדש?",
        start_time: 8.5,
        end_time: 12.0,
        segment_order: 2,
      },
      {
        transcript_id: TEST_TRANSCRIPT_ID,
        speaker_id: "speaker-2",
        speaker_name: "שרה",
        text: "התחלנו לעבוד על המודול הראשון וסיימנו את 80% מהעבודה.",
        start_time: 12.5,
        end_time: 17.0,
        segment_order: 3,
      },
      {
        transcript_id: TEST_TRANSCRIPT_ID,
        speaker_id: "speaker-1",
        speaker_name: "דוד",
        text: "נהדר! מה הצעדים הבאים שלנו?",
        start_time: 17.5,
        end_time: 20.0,
        segment_order: 4,
      },
    ];

    const { error: segmentsError } = await admin.from("transcript_segments").insert(segments);

    if (segmentsError) {
      console.error("[seed-data] Segments creation error:", segmentsError);
      throw segmentsError;
    }

    // 4. Create summary
    const { error: summaryError } = await admin.from("summaries").insert({
      session_id: TEST_SESSION_ID,
      overview: "פגישת צוות שבועית לדיון על התקדמות הפרויקט החדש. שרה דיווחה על סיום 80% מהמודול הראשון.",
      key_points: [
        "המודול הראשון הושלם ב-80%",
        "הצוות ממשיך לעבוד על הפרויקט",
        "נקבעו צעדים הבאים להמשך",
      ],
    });

    if (summaryError) {
      console.error("[seed-data] Summary creation error:", summaryError);
      throw summaryError;
    }

    // 5. Create action items
    const { data: summaryData } = await admin
      .from("summaries")
      .select("id")
      .eq("session_id", TEST_SESSION_ID)
      .single();

    if (summaryData) {
      await admin.from("action_items").insert([
        {
          summary_id: summaryData.id,
          description: "להשלים את המודול הראשון",
          assignee: "שרה",
          completed: false,
        },
        {
          summary_id: summaryData.id,
          description: "לתכנן את המודול השני",
          assignee: "דוד",
          completed: false,
        },
      ]);
    }

    console.log("[seed-data] Test meeting seeded successfully");

    return {
      sessionId: TEST_SESSION_ID,
      transcriptId: TEST_TRANSCRIPT_ID,
      userId,
    };
  } catch (error) {
    console.error("[seed-data] Failed to seed test meeting:", error);
    // Attempt cleanup on failure
    await cleanupTestData(userId);
    return null;
  }
}

/**
 * Removes test data for a user
 */
export async function cleanupTestData(userId: string): Promise<void> {
  const admin = createAdminClient();

  console.log(`[seed-data] Cleaning up test data for user: ${userId}`);

  try {
    // Delete in reverse order of dependencies
    // Action items are cascade deleted with summaries
    await admin.from("summaries").delete().eq("session_id", TEST_SESSION_ID);
    await admin.from("transcript_segments").delete().eq("transcript_id", TEST_TRANSCRIPT_ID);
    await admin.from("transcripts").delete().eq("id", TEST_TRANSCRIPT_ID);
    await admin.from("sessions").delete().eq("id", TEST_SESSION_ID);

    console.log("[seed-data] Cleanup completed");
  } catch (error) {
    console.error("[seed-data] Cleanup error:", error);
  }
}

/**
 * Gets the test meeting ID (for tests to use)
 */
export function getTestMeetingId(): string {
  return TEST_SESSION_ID;
}
