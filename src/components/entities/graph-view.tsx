"use client"

import React, { useState, useRef, useEffect } from "react"
import type { Entity, EntityType, Relationship } from "@/types/entity"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react"

interface GraphNode {
    id: string
    x: number
    y: number
    vx: number
    vy: number
    entity: Entity
    type: EntityType
}

export function GraphView({
    entities,
    entityTypes,
    relationships,
    onSelectEntity,
    selectedEntityId,
    filterTypes,
}: {
    entities: Entity[]
    entityTypes: EntityType[]
    relationships: Relationship[]
    onSelectEntity: (entity: Entity | null) => void
    selectedEntityId: string | null
    filterTypes: string[]
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [nodes, setNodes] = useState<GraphNode[]>([])
    const [zoom, setZoom] = useState(1)
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragNode, setDragNode] = useState<GraphNode | null>(null)
    const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })
    // const animationRef = useRef<number | undefined>(undefined) // Unused now

    // Relationship type colors for semantic visualization
    const relationshipColors: Record<string, string> = {
        WORKS_AT: "#3B82F6",       // Blue
        COLLABORATES_WITH: "#22C55E", // Green
        MANAGES: "#A855F7",        // Purple
        REPORTS_TO: "#A855F7",     // Purple
        USES: "#F97316",           // Orange
        DEPENDS_ON: "#F97316",     // Orange
        LOCATED_IN: "#06B6D4",     // Cyan
        RELATED_TO: "#94A3B8",     // Gray
        MENTIONED_TOGETHER: "#64748B", // Slate
    }

    // Handle canvas resizing with DPI scaling
    useEffect(() => {
        const updateCanvasSize = () => {
            const container = containerRef.current
            const canvas = canvasRef.current
            if (!container || !canvas) return

            const rect = container.getBoundingClientRect()
            const dpr = window.devicePixelRatio || 1

            // Set canvas size with DPI scaling for crisp rendering
            canvas.width = rect.width * dpr
            canvas.height = rect.height * dpr
            canvas.style.width = `${rect.width}px`
            canvas.style.height = `${rect.height}px`

            setCanvasSize({ width: rect.width, height: rect.height })
        }

        updateCanvasSize()
        window.addEventListener("resize", updateCanvasSize)
        return () => window.removeEventListener("resize", updateCanvasSize)
    }, [])

    // Filter entities by type
    const filteredEntities = filterTypes.length > 0 ? entities.filter((e) => filterTypes.includes(e.typeId)) : entities

    // RADIAL LAYOUT - Deterministic, no physics, always readable
    // Groups entities by type and places them in wedges around center
    useEffect(() => {
        const centerX = canvasSize.width / 2
        const centerY = canvasSize.height / 2
        const padding = 60 // Padding from edges
        const baseRadius = Math.min(canvasSize.width, canvasSize.height) / 2 - padding

        // Group entities by type
        const entitiesByType = new Map<string, Entity[]>()
        for (const entity of filteredEntities) {
            const typeId = entity.typeId
            if (!entitiesByType.has(typeId)) {
                entitiesByType.set(typeId, [])
            }
            entitiesByType.get(typeId)!.push(entity)
        }

        // Calculate positions
        const typeIds = Array.from(entitiesByType.keys())
        const totalTypes = typeIds.length || 1
        const anglePerType = (2 * Math.PI) / totalTypes

        const newNodes: GraphNode[] = []
        let typeIndex = 0

        for (const [typeId, typeEntities] of entitiesByType) {
            const startAngle = typeIndex * anglePerType - Math.PI / 2 // Start from top
            const entityCount = typeEntities.length

            // Sort entities by mention count (most mentioned = closer to center)
            typeEntities.sort((a, b) => b.mentionCount - a.mentionCount)

            typeEntities.forEach((entity, i) => {
                // Multiple rings if many entities of same type
                const ring = Math.floor(i / 8) // 8 entities per ring
                const posInRing = i % 8
                const entitiesInThisRing = Math.min(8, entityCount - ring * 8)

                // Radius: inner rings for high-mention entities
                const minRadius = baseRadius * 0.3
                const maxRadius = baseRadius * 0.9
                const radius = minRadius + (ring * (maxRadius - minRadius) / Math.max(1, Math.ceil(entityCount / 8)))

                // Angle within the type's wedge
                const angleSpread = anglePerType * 0.8 // Use 80% of wedge
                const angleStart = startAngle + anglePerType * 0.1 // 10% padding
                const angleStep = entitiesInThisRing > 1 ? angleSpread / (entitiesInThisRing - 1) : 0
                const angle = angleStart + posInRing * angleStep

                const x = centerX + Math.cos(angle) * radius
                const y = centerY + Math.sin(angle) * radius

                newNodes.push({
                    id: entity.id,
                    x,
                    y,
                    vx: 0,
                    vy: 0,
                    entity,
                    type: entityTypes.find((t) => t.id === typeId) || entityTypes[0],
                })
            })

            typeIndex++
        }

        setNodes(newNodes)
    }, [filteredEntities, entityTypes, canvasSize])

    // Draw canvas
    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")
        if (!canvas || !ctx) return

        const dpr = window.devicePixelRatio || 1
        let frameId: number

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.save()

            // Apply DPI scaling
            ctx.scale(dpr, dpr)
            ctx.translate(offset.x, offset.y)
            ctx.scale(zoom, zoom)

            // Draw edges - ONLY for selected/hovered node to reduce clutter
            const activeNodeId = selectedEntityId || hoveredNode?.id

            for (const rel of relationships) {
                const source = nodes.find((n) => n.id === rel.sourceId)
                const target = nodes.find((n) => n.id === rel.targetId)
                if (!source || !target) continue

                // Only show edges connected to active node, or show all very faintly
                const isActiveEdge = activeNodeId && (rel.sourceId === activeNodeId || rel.targetId === activeNodeId)

                if (!activeNodeId) {
                    // No selection - show edges at moderate opacity
                    ctx.beginPath()
                    ctx.moveTo(source.x, source.y)
                    ctx.lineTo(target.x, target.y)
                    ctx.strokeStyle = "rgba(100, 116, 139, 0.6)" // Visible but not overwhelming
                    ctx.lineWidth = 1
                    ctx.stroke()
                } else if (isActiveEdge) {
                    // Active edge - draw curved line with color
                    const edgeColor = relationshipColors[rel.type] || "#64748B"

                    // Curved edge (quadratic bezier)
                    const midX = (source.x + target.x) / 2
                    const midY = (source.y + target.y) / 2
                    const dx = target.x - source.x
                    const dy = target.y - source.y
                    // Curve control point perpendicular to line
                    const curvature = 0.2
                    const ctrlX = midX - dy * curvature
                    const ctrlY = midY + dx * curvature

                    ctx.beginPath()
                    ctx.moveTo(source.x, source.y)
                    ctx.quadraticCurveTo(ctrlX, ctrlY, target.x, target.y)
                    ctx.strokeStyle = edgeColor
                    ctx.lineWidth = 2
                    ctx.stroke()
                }
                // Non-active edges when something is selected: hide completely
            }

            // Draw nodes
            for (const node of nodes) {
                const isSelected = selectedEntityId === node.id
                const isHovered = hoveredNode?.id === node.id
                const radius = 20 + node.entity.mentionCount / 10

                // Node glow effect
                if (isSelected || isHovered) {
                    ctx.beginPath()
                    ctx.arc(node.x, node.y, radius + 8, 0, Math.PI * 2)
                    ctx.fillStyle = node.type.nodeColor + "30"
                    ctx.fill()
                }

                // Node circle
                ctx.beginPath()
                ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
                ctx.fillStyle = isSelected ? node.type.nodeColor : node.type.nodeColor + "CC"
                ctx.fill()

                // Node border
                ctx.strokeStyle = isSelected || isHovered ? node.type.nodeColor : "#FFFFFF"
                ctx.lineWidth = isSelected || isHovered ? 3 : 2
                ctx.stroke()

                // Node label - truncate long names
                const displayName = node.entity.name.length > 20 ? node.entity.name.slice(0, 18) + "…" : node.entity.name
                ctx.fillStyle = "#1E293B"
                ctx.font = "bold 12px system-ui"
                ctx.textAlign = "center"
                ctx.fillText(displayName, node.x, node.y + radius + 16)

                // Type label
                ctx.fillStyle = "#64748B"
                ctx.font = "10px system-ui"
                ctx.fillText(node.type.name, node.x, node.y + radius + 28)
            }

            ctx.restore()
            frameId = requestAnimationFrame(draw)
        }

        frameId = requestAnimationFrame(draw)

        return () => {
            cancelAnimationFrame(frameId)
        }
    }, [nodes, relationships, zoom, offset, selectedEntityId, hoveredNode, relationshipColors])

    // Mouse handlers
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return

        const x = (e.clientX - rect.left - offset.x) / zoom
        const y = (e.clientY - rect.top - offset.y) / zoom

        // Check if clicking on a node
        for (const node of nodes) {
            const radius = 20 + node.entity.mentionCount / 10
            const dx = x - node.x
            const dy = y - node.y
            if (dx * dx + dy * dy < radius * radius) {
                setDragNode(node)
                onSelectEntity(node.entity)
                return
            }
        }

        setIsDragging(true)
        onSelectEntity(null)
    }

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return

        const x = (e.clientX - rect.left - offset.x) / zoom
        const y = (e.clientY - rect.top - offset.y) / zoom

        if (dragNode) {
            setNodes((prev) => prev.map((n) => (n.id === dragNode.id ? { ...n, x, y, vx: 0, vy: 0 } : n)))
        } else if (isDragging) {
            setOffset((prev) => ({
                x: prev.x + e.movementX,
                y: prev.y + e.movementY,
            }))
        } else {
            // Check hover
            let found = false
            for (const node of nodes) {
                const radius = 20 + node.entity.mentionCount / 10
                const dx = x - node.x
                const dy = y - node.y
                if (dx * dx + dy * dy < radius * radius) {
                    setHoveredNode(node)
                    found = true
                    break
                }
            }
            if (!found) setHoveredNode(null)
        }
    }

    const handleMouseUp = () => {
        setDragNode(null)
        setIsDragging(false)
    }

    const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.2, 3))
    const handleZoomOut = () => setZoom((prev) => Math.max(prev / 1.2, 0.3))
    const handleReset = () => {
        setZoom(1)
        setOffset({ x: 0, y: 0 })
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full h-[600px] bg-slate-50 rounded-xl overflow-hidden border border-border"
        >
            <canvas
                ref={canvasRef}
                className="cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            />

            {/* Zoom controls */}
            <div className="absolute bottom-4 left-4 flex flex-col gap-2">
                <Button variant="outline" size="icon" className="bg-white" onClick={handleZoomIn}>
                    <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" className="bg-white" onClick={handleZoomOut}>
                    <ZoomOut className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" className="bg-white" onClick={handleReset}>
                    <Maximize2 className="w-4 h-4" />
                </Button>
            </div>

            {/* Legend */}
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur rounded-lg p-3 shadow-sm border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">מקרא</p>
                <div className="space-y-1.5">
                    {entityTypes
                        .filter((t) => filterTypes.length === 0 || filterTypes.includes(t.id))
                        .map((type) => (
                            <div key={type.id} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.nodeColor }} />
                                <span className="text-xs">{type.name}</span>
                            </div>
                        ))}
                </div>
            </div>

            {/* Stats and Instructions */}
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur rounded-lg px-3 py-2 shadow-sm border border-border">
                <p className="text-xs font-medium text-foreground mb-1">
                    {nodes.length} צמתים • {relationships.length} קשרים
                </p>
                <p className="text-xs text-muted-foreground">גרור לזזז • לחץ על צומת לפרטים • גלגל לזום</p>
            </div>
        </div>
    )
}
