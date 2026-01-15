
import type React from "react"

export interface EntityType {
    id: string
    name: string
    nameEn: string
    icon: React.ReactNode
    color: string
    nodeColor: string
    description: string
    count: number
    isDefault?: boolean
}

export interface Entity {
    id: string
    typeId: string
    name: string
    metadata?: Record<string, string>
    mentionCount: number
    meetingCount: number
    lastMeeting: string
    meetings: { id: string; title: string; date: string }[]
    snippets?: { text: string; meetingId: string; timestamp: string }[]
    sentiment?: "positive" | "neutral" | "negative"
    confidence?: number
}

export interface Relationship {
    id: string
    sourceId: string
    targetId: string
    type: string
    label: string
}
