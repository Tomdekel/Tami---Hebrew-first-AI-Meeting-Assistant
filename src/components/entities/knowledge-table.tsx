"use client"

import { useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { ChevronRight, ChevronLeft, Calendar, FileText, Activity } from "lucide-react"
import type { Entity, EntityType } from "@/types/entity"

interface KnowledgeTableProps {
    entities: Entity[]
    entityTypes: EntityType[]
    onSelectEntity: (entity: Entity) => void
}

export function KnowledgeTable({ entities, entityTypes, onSelectEntity }: KnowledgeTableProps) {
    const { isRTL } = useLanguage()
    const [page, setPage] = useState(1)
    const pageSize = 15

    const start = (page - 1) * pageSize
    const paginated = entities.slice(start, start + pageSize)
    const totalPages = Math.ceil(entities.length / pageSize)

    const getTypeInfo = (typeId: string) => {
        return entityTypes.find(t => t.id === typeId) || entityTypes[0]
    }

    return (
        <div className="space-y-4">
            <div className="rounded-md border border-border bg-white shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[200px]">{isRTL ? "ישות" : "Entity"}</TableHead>
                            <TableHead className="w-[120px]">{isRTL ? "סוג" : "Category"}</TableHead>
                            <TableHead className="hidden md:table-cell">{isRTL ? "הקשר אחרון" : "Last Context"}</TableHead>
                            <TableHead className="w-[100px] text-center">{isRTL ? "אזכורים" : "Mentions"}</TableHead>
                            <TableHead className="w-[120px] text-end">{isRTL ? "נראה לאחרונה" : "Last Seen"}</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginated.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    {isRTL ? "לא נמצאו תוצאות" : "No results found"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginated.map((entity) => {
                                const type = getTypeInfo(entity.typeId)
                                const lastSnippet = entity.snippets?.[0]?.text || ""

                                return (
                                    <TableRow
                                        key={entity.id}
                                        className="cursor-pointer hover:bg-muted/50 transition-colors group"
                                        onClick={() => onSelectEntity(entity)}
                                    >
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-3">
                                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600">
                                                    {/* Use type icon in future, fallback for now */}
                                                    {entity.name.slice(0, 1).toUpperCase()}
                                                </span>
                                                <span className="truncate max-w-[150px] text-slate-900 group-hover:text-teal-700 transition-colors">
                                                    {entity.name}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="secondary"
                                                className="font-normal"
                                                style={{ backgroundColor: type.color.split(" ")[0].replace("bg-", "") /* Hacky class parsing or verify types */ }}
                                            >
                                                <span className={type.color}>
                                                    {type.name}
                                                </span>
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            {lastSnippet ? (
                                                <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-[400px]">
                                                    <FileText className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-50" />
                                                    <span className="truncate">"{lastSnippet}"</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic opacity-50">
                                                    {isRTL ? "אין הקשר זמין" : "No context available"}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-1.5" title={`${entity.mentionCount} mentions`}>
                                                <Activity className="w-3 h-3 text-slate-400" />
                                                <span className="text-sm font-semibold text-slate-700">{entity.mentionCount}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-end text-sm text-muted-foreground">
                                            <div className="flex items-center justify-end gap-2">
                                                <span>{entity.lastMeeting}</span>
                                                <Calendar className="w-3 h-3 opacity-50" />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {isRTL ? (
                                                <ChevronLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 text-sm">
                    <span className="text-muted-foreground">
                        {isRTL
                            ? `עמוד ${page} מתוך ${totalPages}`
                            : `Page ${page} of ${totalPages}`}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        {isRTL ? "הקודם" : "Previous"}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                    >
                        {isRTL ? "הבא" : "Next"}
                    </Button>
                </div>
            )}
        </div>
    )
}
