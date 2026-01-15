"use client"

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Calendar, FileText, CheckSquare, Link2, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useLanguage } from "@/contexts/language-context"
import type { Entity, EntityType } from "@/types/entity"

interface EntitySheetProps {
    entity: Entity | null
    isOpen: boolean
    onClose: () => void
    getTypeColor: (typeId: string) => string
}

export function EntitySheet({ entity, isOpen, onClose, getTypeColor }: EntitySheetProps) {
    const { isRTL } = useLanguage()

    if (!entity) return null

    // Sort meetings by date descending
    const sortedMeetings = [...entity.meetings].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="sm:max-w-xl w-full overflow-y-auto" side={isRTL ? "left" : "right"}>
                <SheetHeader className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className={`${getTypeColor(entity.typeId)}`}>
                            {entity.typeId}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                            ID: {entity.id.slice(0, 8)}
                        </span>
                    </div>
                    <SheetTitle className="text-2xl font-bold flex items-center gap-2">
                        {entity.name}
                    </SheetTitle>
                    <SheetDescription>
                        {isRTL
                            ? `נראה ${entity.mentionCount} פעמים לאורך ${entity.meetingCount} פגישות.`
                            : `Seen ${entity.mentionCount} times across ${entity.meetingCount} meetings.`
                        }
                    </SheetDescription>
                </SheetHeader>

                <Tabs defaultValue="timeline" dir={isRTL ? "rtl" : "ltr"}>
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="timeline">{isRTL ? "ציר זמן" : "Timeline"}</TabsTrigger>
                        <TabsTrigger value="mentions">{isRTL ? "אזכורים" : "Context"}</TabsTrigger>
                        <TabsTrigger value="tasks">{isRTL ? "משימות" : "Tasks"}</TabsTrigger>
                    </TabsList>

                    {/* Timeline Tab */}
                    <TabsContent value="timeline" className="space-y-4">
                        <div className="relative border-s border-muted py-2 ms-3">
                            {sortedMeetings.map((meeting) => (
                                <div key={meeting.id} className="mb-6 ms-4 relative">
                                    <div className="absolute -start-[21px] mt-1.5 h-3 w-3 rounded-full border border-white bg-slate-300 ring-4 ring-white" />
                                    <h3 className="flex items-center mb-1 text-sm font-semibold text-slate-900">
                                        {meeting.title || "Untitled Meeting"}
                                    </h3>
                                    <time className="block mb-2 text-xs font-normal leading-none text-muted-foreground">
                                        {meeting.date}
                                    </time>
                                    <Link
                                        href={`/meetings/${meeting.id}`}
                                        className="inline-flex items-center text-xs font-medium text-teal-600 hover:underline"
                                    >
                                        {isRTL ? "עבור לפגישה" : "Go to meeting"}
                                        <ExternalLink className="w-3 h-3 ms-1" />
                                    </Link>
                                </div>
                            ))}

                            {sortedMeetings.length === 0 && (
                                <p className="text-sm text-muted-foreground px-4">
                                    {isRTL ? "אין היסטוריית פגישות." : "No meeting history found."}
                                </p>
                            )}
                        </div>
                    </TabsContent>

                    {/* Context/Snippets Tab */}
                    <TabsContent value="mentions">
                        <ScrollArea className="h-[500px] w-full pr-4">
                            <div className="space-y-4">
                                {entity.snippets && entity.snippets.length > 0 ? (
                                    entity.snippets.map((snip, idx) => (
                                        <div key={idx} className="p-4 rounded-lg bg-muted/50 border border-border">
                                            <p className="text-sm italic text-slate-700 leading-relaxed mb-2">
                                                "{snip.text}"
                                            </p>
                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <span>{snip.timestamp || "Unknown time"}</span>
                                                <Link href={`/meetings/${snip.meetingId}`} className="hover:text-teal-600 flex items-center gap-1">
                                                    <Link2 className="w-3 h-3" />
                                                    {isRTL ? "מקור" : "Source"}
                                                </Link>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                        <p>{isRTL ? "אין הקשרים טקסטואליים זמינים." : "No text snippets available."}</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    {/* Tasks Tab (Placeholder) */}
                    <TabsContent value="tasks">
                        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg border-muted">
                            <CheckSquare className="w-10 h-10 text-muted-foreground mb-3 opacity-30" />
                            <h3 className="text-lg font-medium text-foreground">
                                {isRTL ? "אין משימות מקושרות" : "No Linked Tasks"}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1 max-w-[250px]">
                                {isRTL
                                    ? "בעתיד, משימות והחלטות הקשורות לישות זו יופיעו כאן."
                                    : "In the future, tasks and decisions related to this entity will appear here."}
                            </p>
                        </div>
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    )
}
