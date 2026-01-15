"use client"

import type React from "react"
import { createContext, useContext, useState, useCallback, useEffect } from "react"

type Language = "he" | "en"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  isRTL: boolean
  t: (key: string) => string
}

const translations: Record<Language, Record<string, string>> = {
  he: {
    // Navigation
    meetings: "פגישות",
    memory: "זיכרון",
    entities: "ישויות",
    newMeeting: "פגישה חדשה",
    profile: "פרופיל",
    settings: "הגדרות",
    logout: "התנתק",
    privacy: "פרטיות ואבטחה",

    // Meetings page
    meetingDetails: "פרטי פגישה",
    transcript: "תמליל",
    summary: "סיכום",
    decisions: "החלטות",
    tasks: "משימות",
    speakers: "דוברים",
    documents: "מסמכים",
    chat: "צ׳אט",
    download: "הורד",
    downloadTranscript: "הורד תמליל",
    search: "חיפוש",
    searchTranscript: "חיפוש בתמליל...",
    searchMeetings: "חיפוש פגישות...",
    participants: "משתתפים",
    editSpeakerName: "לחץ על שם הדובר כדי לערוך",
    noTranscript: "אין תמליל זמין",
    noSummary: "אין עדיין סיכום",

    // Meeting context
    meetingContext: "הקשר לפגישה",
    meetingContextHelp: "הוסף שמות משתתפים והקשר לשיפור דיוק התמלול",
    meetingContextPlaceholder: "פגישה בין בן ומאיה על יוזמת שיווק חדשה בגרמניה. אני מציג גישת גרילה מרקטינג ל-CMO.",

    // New Meeting
    newMeetingTitle: "פגישה חדשה",
    newMeetingSubtitle: "הקלט פגישה חדשה או העלה הקלטה קיימת",
    meetingTitle: "כותרת הפגישה",
    meetingTitleRequired: "שדה חובה",
    meetingTitlePlaceholder: "לדוגמה: פגישת צוות שבועית",
    uploadRecording: "העלאת הקלטה",
    liveRecording: "הקלטה חיה",
    inPersonMeeting: "פגישה פיזית",
    onlineMeeting: "פגישה מקוונת",
    selectRecordingType: "בחר את סוג ההקלטה",
    directMicRecording: "הקלטה ישירה מהמיקרופון",
    dragFilesHere: "גרור קבצים לכאן",
    or: "או",
    selectFiles: "בחר קבצים",
    supportedFormats: "MP3, WAV, M4A, MP4, WebM עד 500MB",
    supportedLanguages: "תומך בעברית, אנגלית ושפות נוספות",
    startRecording: "התחל הקלטה",
    stopRecording: "עצור הקלטה",
    back: "חזרה",
    recording: "מקליט...",
    proceedToMeeting: "המשך לפגישה",

    // Online recording instructions
    onlineRecordingTitle: "הקלטת פגישה מקוונת",
    onlineRecordingInstructions: "הוראות:",
    onlineStep1: "לחצו על 'התחל הקלטה'",
    onlineStep2: "בחלון שייפתח, בחרו את המסך או החלון שברצונכם לשתף",
    onlineStep3Important: "חשוב:",
    onlineStep3: "סמנו את האפשרות 'שתף שמע' (Share audio) בתחתית החלון",
    onlineStep4: "לחצו 'שתף' להתחלת ההקלטה",

    // Processing states
    uploading: "מעלה...",
    processing: "מעבד...",
    transcribing: "מתמלל...",
    analyzing: "מנתח...",
    extractingEntities: "מזהה ישויות...",
    completed: "הושלם",
    failed: "נכשל",
    retry: "נסה שוב",
    viewMeeting: "צפה בפגישה",

    // Processing clarity
    processingTitle: "מעבד את הפגישה שלך",
    processingStep1: "מעלה את הקובץ לשרתים המאובטחים שלנו",
    processingStep2: "מתמלל באמצעות מודל Ivrit מתקדם",
    processingStep3: "מנתח ומפיק תובנות",
    processingStep4: "מזהה ישויות וקשרים",
    processingTime: "זמן עיבוד משוער: 2-5 דקות",
    processingStuck: "העיבוד תקוע? לחץ לנסות שוב",
    processingError: "אירעה שגיאה בעיבוד",
    processingErrorHelp: "נסה שוב או פנה לתמיכה אם הבעיה נמשכת",

    // Actions
    save: "שמור",
    cancel: "ביטול",
    delete: "מחק",
    edit: "ערוך",
    add: "הוסף",
    rename: "שנה שם",
    merge: "מזג",
    close: "סגור",
    confirm: "אישור",

    // Entities
    people: "אנשים",
    organizations: "ארגונים",
    projects: "פרויקטים",
    actionItems: "משימות",
    topics: "נושאים",

    // Privacy page
    privacyTitle: "פרטיות ואבטחה",
    privacySubtitle: "המידע שלך מאובטח ומוגן",
  },
  en: {
    // Navigation
    meetings: "Meetings",
    memory: "Memory",
    entities: "Entities",
    newMeeting: "New Meeting",
    profile: "Profile",
    settings: "Settings",
    logout: "Log out",
    privacy: "Privacy & Security",

    // Meetings page
    meetingDetails: "Meeting Details",
    transcript: "Transcript",
    summary: "Summary",
    decisions: "Decisions",
    tasks: "Tasks",
    speakers: "Speakers",
    documents: "Documents",
    chat: "Chat",
    download: "Download",
    downloadTranscript: "Download Transcript",
    search: "Search",
    searchTranscript: "Search transcript...",
    searchMeetings: "Search meetings...",
    participants: "Participants",
    editSpeakerName: "Click speaker name to edit",
    noTranscript: "No transcript available",
    noSummary: "No summary yet",

    // Meeting context
    meetingContext: "Meeting Context",
    meetingContextHelp: "Add participant names and context to improve transcription accuracy",
    meetingContextPlaceholder:
      "Meeting between Ben and Maya about a new marketing initiative in Germany. I'm presenting a guerilla marketing approach to the CMO.",

    // New Meeting
    newMeetingTitle: "New Meeting",
    newMeetingSubtitle: "Record a new meeting or upload an existing recording",
    meetingTitle: "Meeting Title",
    meetingTitleRequired: "Required field",
    meetingTitlePlaceholder: "e.g., Weekly team meeting",
    uploadRecording: "Upload Recording",
    liveRecording: "Live Recording",
    inPersonMeeting: "In-Person Meeting",
    onlineMeeting: "Online Meeting",
    selectRecordingType: "Select recording type",
    directMicRecording: "Direct microphone recording",
    dragFilesHere: "Drag files here",
    or: "or",
    selectFiles: "Select Files",
    supportedFormats: "MP3, WAV, M4A, MP4, WebM up to 500MB",
    supportedLanguages: "Supports Hebrew, English and more",
    startRecording: "Start Recording",
    stopRecording: "Stop Recording",
    back: "Back",
    recording: "Recording...",
    proceedToMeeting: "Proceed to Meeting",

    // Online recording instructions
    onlineRecordingTitle: "Online Meeting Recording",
    onlineRecordingInstructions: "Instructions:",
    onlineStep1: "Click 'Start Recording'",
    onlineStep2: "In the window that opens, select the screen or window you want to share",
    onlineStep3Important: "Important:",
    onlineStep3: "Check 'Share audio' option at the bottom of the window",
    onlineStep4: "Click 'Share' to start recording",

    // Processing states
    uploading: "Uploading...",
    processing: "Processing...",
    transcribing: "Transcribing...",
    analyzing: "Analyzing...",
    extractingEntities: "Extracting entities...",
    completed: "Completed",
    failed: "Failed",
    retry: "Retry",
    viewMeeting: "View Meeting",

    // Processing clarity
    processingTitle: "Processing your meeting",
    processingStep1: "Uploading to our secure servers",
    processingStep2: "Transcribing with advanced Ivrit model",
    processingStep3: "Analyzing and extracting insights",
    processingStep4: "Identifying entities and relationships",
    processingTime: "Estimated processing time: 2-5 minutes",
    processingStuck: "Processing stuck? Click to retry",
    processingError: "An error occurred during processing",
    processingErrorHelp: "Try again or contact support if the issue persists",

    // Actions
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    rename: "Rename",
    merge: "Merge",
    close: "Close",
    confirm: "Confirm",

    // Entities
    people: "People",
    organizations: "Organizations",
    projects: "Projects",
    actionItems: "Action Items",
    topics: "Topics",

    // Privacy page
    privacyTitle: "Privacy & Security",
    privacySubtitle: "Your data is secure and protected",
  },
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("he")

  useEffect(() => {
    const documentLang = document?.documentElement?.lang
    if (documentLang === "he" || documentLang === "en") {
      setLanguage(documentLang)
    }
  }, [])

  const t = useCallback(
    (key: string) => {
      return translations[language][key] || key
    },
    [language],
  )

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        isRTL: language === "he",
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
