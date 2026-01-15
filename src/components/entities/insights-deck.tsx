"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"
import { TrendingUp, Moon, Sparkles, Activity } from "lucide-react"
import type { Entity } from "@/types/entity"

interface InsightsDeckProps {
    entities: Entity[]
}

export function InsightsDeck({ entities }: InsightsDeckProps) {
    const { isRTL } = useLanguage()

    // --- Insight Logic ---
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // 1. Trending: Most mentions in last 7 days
    const trending = entities
        .map(e => ({
            ...e,
            recentMentions: e.meetings.filter(m => new Date(m.date) > sevenDaysAgo).length
        }))
        .sort((a, b) => b.recentMentions - a.recentMentions)
        .filter(e => e.recentMentions > 0)
        .slice(0, 3)

    // 2. Dormant: High total mentions (top 25%) but zero in last 30 days
    const totalMentionThreshold = 5 // Simple threshold for "significant" entity
    const dormant = entities
        .filter(e => e.mentionCount >= totalMentionThreshold)
        .filter(e => {
            const lastSeen = new Date(e.lastMeeting)
            return lastSeen < thirtyDaysAgo
        })
        .sort((a, b) => new Date(a.lastMeeting).getTime() - new Date(b.lastMeeting).getTime())
        .slice(0, 3)

    // 3. New Sources: First seen in last 7 days (and total meetings involved is small)
    const newEntities = entities
        .filter(e => {
            // If we had "firstSeen" that would be better, but we can approximate:
            // If mentionCount == recentMentions (or strictly all meetings are recent)
            const allRecent = e.meetings.every(m => new Date(m.date) > sevenDaysAgo)
            return allRecent && e.meetings.length > 0
        })
        .sort((a, b) => b.mentionCount - a.mentionCount)
        .slice(0, 3)

    const InsightCard = ({ title, icon: Icon, items, colorClass, emptyMessage }: any) => (
        <Card className="flex-1 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className={`h-4 w-4 ${colorClass}`} />
            </CardHeader>
            <CardContent>
                {items.length > 0 ? (
                    <ul className="space-y-2 mt-2">
                        {items.map((item: any) => (
                            <li key={item.id} className="flex justify-between items-center text-sm">
                                <span className="truncate max-w-[120px] font-medium text-slate-700">{item.name}</span>
                                <span className="text-xs text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded-full">
                                    {item.extraLabel}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-xs text-muted-foreground mt-2">{emptyMessage}</p>
                )}
            </CardContent>
        </Card>
    )

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8" dir={isRTL ? "rtl" : "ltr"}>
            {/* Trending */}
            <InsightCard
                title={isRTL ? "מגמות חמות" : "Trending Now"}
                icon={TrendingUp}
                colorClass="text-orange-500"
                emptyMessage={isRTL ? "אין מספיק נתונים מהשבוע האחרון" : "No trending entities this week"}
                items={trending.map(e => ({
                    id: e.id,
                    name: e.name,
                    extraLabel: isRTL ? `${e.recentMentions} אזכורים` : `${e.recentMentions} mentions`
                }))}
            />

            {/* Dormant */}
            <InsightCard
                title={isRTL ? "נשכחו לאחרונה" : "Dormant Topics"}
                icon={Moon}
                colorClass="text-slate-400"
                emptyMessage={isRTL ? "פעילות עקבית בכל הנושאים" : "No dormant topics found"}
                items={dormant.map(e => ({
                    id: e.id,
                    name: e.name,
                    extraLabel: isRTL ? `נראה לאחרונה ב-${e.lastMeeting}` : `Last seen ${e.lastMeeting}`
                }))}
            />

            {/* New */}
            <InsightCard
                title={isRTL ? "חדש במערכת" : "New Entries"}
                icon={Sparkles}
                colorClass="text-purple-500"
                emptyMessage={isRTL ? "אין ישויות חדשות השבוע" : "No new entities this week"}
                items={newEntities.map(e => ({
                    id: e.id,
                    name: e.name,
                    extraLabel: isRTL ? "חדש" : "New"
                }))}
            />

            {/* Activity Summary (Fixed stat) */}
            <Card className="flex-1 shadow-sm bg-gradient-to-br from-teal-50 to-white border-teal-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-teal-900">{isRTL ? "פעילות כוללת" : "Total Activity"}</CardTitle>
                    <Activity className="h-4 w-4 text-teal-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-teal-700">{entities.length}</div>
                    <p className="text-xs text-teal-600/80 mt-1">
                        {isRTL ? "ישויות מזוהות במאגר הידע שלך" : "Entities tracked in your knowledge base"}
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
