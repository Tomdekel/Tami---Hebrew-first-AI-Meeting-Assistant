"use client"

import { useState, useEffect } from "react"
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
import { Calendar, FileText, CheckSquare, Link2, ExternalLink, Pencil, Trash2, Check, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import Link from "next/link"
import { useLanguage } from "@/contexts/language-context"
import type { Entity, EntityType } from "@/types/entity"

interface EntitySheetProps {
    entity: Entity | null
    isOpen: boolean
    onClose: () => void
    getTypeColor: (typeId: string) => string
    onEntityUpdated?: (entity: Entity) => void
    onEntityDeleted?: (id: string) => void
}

export function EntitySheet({
    entity,
    isOpen,
    onClose,
    getTypeColor,
    onEntityUpdated,
    onEntityDeleted
}: EntitySheetProps) {
    const { isRTL } = useLanguage()

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false)
    const [editName, setEditName] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    // Delete State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    // Reset state when entity changes
    useEffect(() => {
        if (entity) {
            setEditName(entity.name)
            setIsEditing(false)
            setShowDeleteConfirm(false)
        }
    }, [entity])

    if (!entity) return null

    // Handlers
    const handleSave = async () => {
        if (!editName.trim() || editName === entity.name) {
            setIsEditing(false)
            return
        }

        try {
            setIsSaving(true)
            const res = await fetch(`/api/entities/${entity.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editName })
            })

            if (!res.ok) throw new Error("Failed to update")

            const data = await res.json()
            if (data.entity && onEntityUpdated) {
                // Merge the updated fields into the current entity for optimistic feel
                // (though api returns full entity usually)
                onEntityUpdated({ ...entity, name: data.entity.value })
            }
            setIsEditing(false)
        } catch (error) {
            console.error(error)
            // Could show toast error here
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        try {
            setIsDeleting(true)
            const res = await fetch(`/api/entities/${entity.id}`, {
                method: "DELETE"
            })

            if (!res.ok) throw new Error("Failed to delete")

            if (onEntityDeleted) {
                onEntityDeleted(entity.id)
            }
            onClose()
        } catch (error) {
            console.error(error)
        } finally {
            setIsDeleting(false)
            setShowDeleteConfirm(false)
        }
    }

    // Sort meetings by date descending
    const sortedMeetings = [...entity.meetings].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="sm:max-w-xl w-full overflow-y-auto" side={isRTL ? "left" : "right"}>
                <SheetHeader className="mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`${getTypeColor(entity.typeId)}`}>
                                {entity.typeId}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                                ID: {entity.id.slice(0, 8)}
                            </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                            {!isEditing ? (
                                <>
                                    <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
                                        <Pencil className="w-4 h-4 text-muted-foreground" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setShowDeleteConfirm(true)}>
                                        <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                                    </Button>
                                </>
                            ) : (
                                // Editing Actions are inline with Input usually, but can be here too? 
                                // No, better next to input if possible, but header is fine.
                                null
                            )}
                        </div>
                    </div>

                    {/* Title Area */}
                    <div className="flex items-center gap-2 min-h-[40px]">
                        {isEditing ? (
                            <div className="flex items-center gap-2 w-full">
                                <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="text-lg font-bold h-10"
                                    autoFocus
                                />
                                <Button size="icon" variant="default" onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => setIsEditing(false)} disabled={isSaving}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        ) : (
                            <SheetTitle className="text-2xl font-bold flex items-center gap-2 break-all">
                                {entity.name}
                            </SheetTitle>
                        )}
                    </div>

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

            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{isRTL ? "למחוק את הישות?" : "Delete this entity?"}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {isRTL
                                ? "פעולה זו לא ניתנת לביטול. הישות תימחק מהגרף ומאגר הידע (הפגישות עצמן יישארו)."
                                : "This action cannot be undone. The entity will be removed from the graph and knowledge base (meetings will remain)."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{isRTL ? "ביטול" : "Cancel"}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            {isDeleting
                                ? (isRTL ? "מוחק..." : "Deleting...")
                                : (isRTL ? "מחק" : "Delete")
                            }
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </Sheet>
    )
}
