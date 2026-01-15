/**
 * Shared speaker color palette for consistent styling across components
 */

export interface SpeakerColor {
  bg: string
  text: string
  border: string
}

export const SPEAKER_COLORS: SpeakerColor[] = [
  { bg: "bg-teal-200", text: "text-teal-700", border: "border-teal-400" },
  { bg: "bg-blue-200", text: "text-blue-700", border: "border-blue-400" },
  { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-500" },
  { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-500" },
  { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-500" },
  { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-500" },
  { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-500" },
  { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-500" },
]

/**
 * Get a consistent color for a speaker based on their ID
 * Supports formats like "speaker-1", "speaker_1", "speaker1", "Speaker 1", "SPEAKER_2", etc.
 */
export function getSpeakerColor(speakerId: string): SpeakerColor {
  // Extract number from various speaker ID formats:
  // speaker-1, speaker_1, speaker1, "Speaker 1", SPEAKER_2, etc.
  const match = speakerId.match(/speaker[-_\s]?(\d+)/i)
  const index = match ? (parseInt(match[1], 10) - 1) % SPEAKER_COLORS.length : 0
  return SPEAKER_COLORS[Math.max(0, index)]
}

/**
 * Get color by index (for when you have an array index instead of speaker ID)
 */
export function getSpeakerColorByIndex(index: number): SpeakerColor {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length]
}
