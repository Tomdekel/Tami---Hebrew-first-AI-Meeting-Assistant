"use client"

import { create } from "zustand"

// UUID v4 regex pattern for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface UIStore {
  selectedMeetingId: string | null
  setSelectedMeetingId: (id: string | null, updateUrl?: boolean) => void
}

export const useUIStore = create<UIStore>((set) => ({
  selectedMeetingId: null,
  setSelectedMeetingId: (id, updateUrl = true) => {
    // Validate ID is a valid UUID to prevent injection
    if (id && !UUID_REGEX.test(id)) {
      console.error("Invalid meeting ID format:", id)
      return
    }

    set({ selectedMeetingId: id })

    // Sync URL without causing navigation - only on client
    if (typeof window !== "undefined" && id && updateUrl) {
      try {
        window.history.pushState({}, "", `/meetings/${id}`)
      } catch (e) {
        console.error("Failed to update history:", e)
      }
    }
  },
}))
