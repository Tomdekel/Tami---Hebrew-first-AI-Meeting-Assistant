"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Search,
  Plus,
  Users,
  Building2,
  FolderKanban,
  Tag,
  MapPin,
  DollarSign,
  Cpu,
  Calendar,
  Settings2,
  Pencil,
  Trash2,
  MoreHorizontal,
  LayoutGrid,
  GitBranch,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  GitMerge,
  CheckSquare,
  MessageSquare,
  ExternalLink,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { useLanguage } from "@/contexts/language-context"
import { cn } from "@/lib/utils"

// Types
interface EntityType {
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

interface Entity {
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

interface Relationship {
  id: string
  sourceId: string
  targetId: string
  type: string
  label: string
}

interface GraphNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  entity: Entity
  type: EntityType
}

// Data
const defaultEntityTypes: EntityType[] = [
  {
    id: "people",
    name: "אנשים",
    nameEn: "People",
    icon: <Users className="w-5 h-5" />,
    color: "bg-blue-100 text-blue-700",
    nodeColor: "#3B82F6",
    description: "אנשים שהוזכרו בפגישות",
    count: 12,
    isDefault: true,
  },
  {
    id: "organizations",
    name: "ארגונים",
    nameEn: "Organizations",
    icon: <Building2 className="w-5 h-5" />,
    color: "bg-purple-100 text-purple-700",
    nodeColor: "#8B5CF6",
    description: "חברות וארגונים",
    count: 5,
    isDefault: true,
  },
  {
    id: "projects",
    name: "פרויקטים",
    nameEn: "Projects",
    icon: <FolderKanban className="w-5 h-5" />,
    color: "bg-amber-100 text-amber-700",
    nodeColor: "#F59E0B",
    description: "פרויקטים ויוזמות",
    count: 8,
    isDefault: true,
  },
  {
    id: "action-items",
    name: "משימות",
    nameEn: "Action Items",
    icon: <CheckSquare className="w-5 h-5" />,
    color: "bg-green-100 text-green-700",
    nodeColor: "#10B981",
    description: "משימות והחלטות",
    count: 15,
    isDefault: true,
  },
  {
    id: "topics",
    name: "נושאים",
    nameEn: "Topics",
    icon: <MessageSquare className="w-5 h-5" />,
    color: "bg-teal-100 text-teal-700",
    nodeColor: "#14B8A6",
    description: "נושאים שנדונו",
    count: 20,
    isDefault: true,
  },
  {
    id: "locations",
    name: "מיקומים",
    nameEn: "Locations",
    icon: <MapPin className="w-5 h-5" />,
    color: "bg-cyan-100 text-cyan-700",
    nodeColor: "#06B6D4",
    description: "מקומות גיאוגרפיים",
    count: 0,
    isDefault: true,
  },
  {
    id: "dates",
    name: "תאריכים",
    nameEn: "Dates",
    icon: <Calendar className="w-5 h-5" />,
    color: "bg-rose-100 text-rose-700",
    nodeColor: "#F43F5E",
    description: "תאריכים ואירועים",
    count: 0,
    isDefault: true,
  },
]

const additionalEntityTypeOptions = [
  {
    id: "commercial-terms",
    name: "מונחים מסחריים",
    nameEn: "Commercial Terms",
    icon: <Tag className="w-5 h-5" />,
    color: "bg-pink-100 text-pink-700",
    nodeColor: "#EC4899",
  },
  {
    id: "prices",
    name: "מחירים",
    nameEn: "Prices",
    icon: <DollarSign className="w-5 h-5" />,
    color: "bg-emerald-100 text-emerald-700",
    nodeColor: "#059669",
  },
  {
    id: "tech-stacks",
    name: "טכנולוגיות",
    nameEn: "Tech Stacks",
    icon: <Cpu className="w-5 h-5" />,
    color: "bg-indigo-100 text-indigo-700",
    nodeColor: "#6366F1",
  },
]

// Map API entity types to UI typeIds
const typeMapping: Record<string, string> = {
  person: "people",
  organization: "organizations",
  project: "projects",
  topic: "topics",
  location: "locations",
  date: "dates",
  product: "products",
  technology: "tech-stacks",
  other: "topics",
}

// Graph View Component
function GraphView({
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
  const animationRef = useRef<number | undefined>(undefined)

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

  // Initialize nodes spread across the canvas
  useEffect(() => {
    const centerX = canvasSize.width / 2
    const centerY = canvasSize.height / 2
    const nodeCount = filteredEntities.length

    // Calculate grid-like initial positions for better spread
    const cols = Math.ceil(Math.sqrt(nodeCount * (canvasSize.width / canvasSize.height)))
    const rows = Math.ceil(nodeCount / cols)
    const spacingX = canvasSize.width / (cols + 1)
    const spacingY = canvasSize.height / (rows + 1)

    const initialNodes: GraphNode[] = filteredEntities.map((entity, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      // Grid position with some randomness to avoid perfect alignment
      const x = spacingX * (col + 1) + (Math.random() - 0.5) * spacingX * 0.5
      const y = spacingY * (row + 1) + (Math.random() - 0.5) * spacingY * 0.5

      return {
        id: entity.id,
        x,
        y,
        vx: 0,
        vy: 0,
        entity,
        type: entityTypes.find((t) => t.id === entity.typeId) || entityTypes[0],
      }
    })
    setNodes(initialNodes)
  }, [filteredEntities, entityTypes, canvasSize])

  // Force simulation with alpha decay (simulation cools down and stops)
  const alphaRef = useRef(1) // Simulation energy - decays over time
  const alphaDecay = 0.01 // Slower decay - gives time to spread out
  const alphaMin = 0.001 // When to stop simulation completely

  useEffect(() => {
    // Reset alpha when nodes change (restart simulation)
    alphaRef.current = 1
  }, [filteredEntities])

  useEffect(() => {
    const simulate = () => {
      // If simulation has cooled down, stop animating
      if (alphaRef.current < alphaMin) {
        return
      }

      // Decay alpha each frame (simulation cools down)
      alphaRef.current *= (1 - alphaDecay)

      setNodes((prevNodes) => {
        const newNodes = prevNodes.map((node) => ({ ...node }))
        const alpha = alphaRef.current // Current simulation energy

        // Minimum distance between nodes (prevents overlap)
        const minDistance = 80

        // Apply forces (scaled by alpha so they weaken as simulation cools)
        for (let i = 0; i < newNodes.length; i++) {
          const node = newNodes[i]

          // Repulsion from other nodes - STRONG to spread them out
          for (let j = 0; j < newNodes.length; j++) {
            if (i === j) continue
            const other = newNodes[j]
            const dx = node.x - other.x
            const dy = node.y - other.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1

            // Strong repulsion when too close, weaker at distance
            if (dist < minDistance * 3) {
              // Collision avoidance - very strong when overlapping
              const force = (3000 / (dist * dist)) * alpha
              node.vx += (dx / dist) * force
              node.vy += (dy / dist) * force
            }

            // Hard separation - push apart if within minimum distance
            if (dist < minDistance) {
              const overlap = minDistance - dist
              node.vx += (dx / dist) * overlap * 0.5
              node.vy += (dy / dist) * overlap * 0.5
            }
          }

          // Attraction along edges - WEAK to prevent clustering
          const nodeRelationships = relationships.filter((r) => r.sourceId === node.id || r.targetId === node.id)
          for (const rel of nodeRelationships) {
            const otherId = rel.sourceId === node.id ? rel.targetId : rel.sourceId
            const other = newNodes.find((n) => n.id === otherId)
            if (other) {
              const dx = other.x - node.x
              const dy = other.y - node.y
              const dist = Math.sqrt(dx * dx + dy * dy) || 1
              // Only attract if nodes are far apart (>200px)
              if (dist > 200) {
                const force = (dist - 200) * 0.002 * alpha
                node.vx += (dx / dist) * force
                node.vy += (dy / dist) * force
              }
            }
          }

          // Very weak center gravity (just to keep graph on screen)
          const centerX = canvasSize.width / 2
          const centerY = canvasSize.height / 2
          node.vx += (centerX - node.x) * 0.0001 * alpha
          node.vy += (centerY - node.y) * 0.0001 * alpha

          // Moderate damping (0.8 = lose 20% velocity per frame)
          node.vx *= 0.8
          node.vy *= 0.8

          // Higher velocity cap to allow spreading
          const maxVelocity = 6
          const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy)
          if (speed > maxVelocity) {
            node.vx = (node.vx / speed) * maxVelocity
            node.vy = (node.vy / speed) * maxVelocity
          }

          // Stop slow nodes (higher threshold)
          if (Math.abs(node.vx) < 0.3) node.vx = 0
          if (Math.abs(node.vy) < 0.3) node.vy = 0

          // Apply velocity
          if (!dragNode || dragNode.id !== node.id) {
            node.x += node.vx
            node.y += node.vy
          }
        }

        return newNodes
      })

      // Only continue animation if simulation is still active
      if (alphaRef.current >= alphaMin) {
        animationRef.current = requestAnimationFrame(simulate)
      }
    }

    // Reheat simulation when dragging (so graph settles after drag)
    if (dragNode) {
      alphaRef.current = Math.max(alphaRef.current, 0.3)
    }

    animationRef.current = requestAnimationFrame(simulate)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [relationships, dragNode, canvasSize])

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

      // Draw edges with semantic colors
      for (const rel of relationships) {
        const source = nodes.find((n) => n.id === rel.sourceId)
        const target = nodes.find((n) => n.id === rel.targetId)
        if (source && target) {
          // Get color based on relationship type
          const edgeColor = relationshipColors[rel.type] || "#94A3B8"

          ctx.beginPath()
          ctx.moveTo(source.x, source.y)
          ctx.lineTo(target.x, target.y)
          ctx.strokeStyle = edgeColor
          ctx.lineWidth = 2
          ctx.stroke()

          // Draw edge label with background for readability
          const midX = (source.x + target.x) / 2
          const midY = (source.y + target.y) / 2
          const label = rel.label || rel.type.replace(/_/g, " ").toLowerCase()

          // Label background
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
          const labelWidth = ctx.measureText(label).width + 8
          ctx.fillRect(midX - labelWidth / 2, midY - 12, labelWidth, 16)

          // Label text
          ctx.fillStyle = edgeColor
          ctx.font = "10px system-ui"
          ctx.textAlign = "center"
          ctx.fillText(label, midX, midY)
        }
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

// Main Component
export function EntitiesPage() {
  const { isRTL } = useLanguage()
  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState<"list" | "graph">("list")
  const [entityTypes, setEntityTypes] = useState<EntityType[]>(defaultEntityTypes)
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [entities, setEntities] = useState<Entity[]>([])
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [isLoadingEntities, setIsLoadingEntities] = useState(true)
  const [showAddTypeDialog, setShowAddTypeDialog] = useState(false)
  // const [showAddEntityDialog, setShowAddEntityDialog] = useState(false) // This state is now managed in the updates
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [filterTypes, setFilterTypes] = useState<string[]>([])
  const [showRelationshipDialog, setShowRelationshipDialog] = useState(false)
  // const [showMergeDialog, setShowMergeDialog] = useState(false) // This state is now managed in the updates
  // const [mergeTarget, setMergeTarget] = useState<string>("") // This state is now managed in the updates
  const [newEntityType, setNewEntityType] = useState({ name: "", nameEn: "", description: "" })
  // const [newEntity, setNewEntity] = useState({ name: "", metadata: "" }) // This state is now managed in the updates
  const [newRelationship, setNewRelationship] = useState({ targetId: "", type: "", label: "" })

  const [editingEntityId, setEditingEntityId] = useState<string | null>(null)
  const [editingEntityName, setEditingEntityName] = useState("")
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [mergeSource, setMergeSource] = useState<Entity | null>(null)
  const [mergeTarget, setMergeTarget] = useState<string>("")
  const [showAddEntityDialog, setShowAddEntityDialog] = useState(false)
  const [newEntity, setNewEntity] = useState({ name: "", typeId: "", metadata: "" })

  // Fetch real entities from API
  useEffect(() => {
    async function fetchEntities() {
      try {
        setIsLoadingEntities(true)
        const response = await fetch("/api/entities")
        if (!response.ok) {
          throw new Error("Failed to fetch entities")
        }
        const data = await response.json()

        // Transform API response to Entity format
        const transformedEntities: Entity[] = []

        for (const [type, items] of Object.entries(data.entities || {})) {
          const typeId = typeMapping[type] || "topics"
          for (const item of items as Array<{
            id: string
            value: string
            mentionCount: number
            sessions: Array<{ id: string; title: string | null; createdAt: string; context: string | null }>
          }>) {
            transformedEntities.push({
              id: item.id,
              typeId,
              name: item.value,
              metadata: {},
              mentionCount: item.mentionCount,
              meetingCount: item.sessions.length,
              lastMeeting: item.sessions[0]?.createdAt?.split("T")[0] || "",
              meetings: item.sessions.map((s) => ({
                id: s.id,
                title: s.title || "Untitled",
                date: s.createdAt?.split("T")[0] || "",
              })),
              snippets: item.sessions
                .filter((s) => s.context)
                .map((s) => ({
                  text: s.context || "",
                  meetingId: s.id,
                  timestamp: "",
                })),
            })
          }
        }

        setEntities(transformedEntities)

        // Update entity type counts
        const typeCounts: Record<string, number> = data.typeCounts || {}
        setEntityTypes((prev) =>
          prev.map((t) => {
            const apiType = Object.entries(typeMapping).find(([, v]) => v === t.id)?.[0]
            return {
              ...t,
              count: apiType ? typeCounts[apiType] || 0 : 0,
            }
          })
        )
      } catch (error) {
        console.error("Failed to fetch entities:", error)
      } finally {
        setIsLoadingEntities(false)
      }
    }

    fetchEntities()
  }, [])

  // Fetch relationships from Neo4j graph API
  useEffect(() => {
    async function fetchRelationships() {
      try {
        const response = await fetch("/api/graph/visualize?limit=100")
        if (!response.ok) {
          console.error("Failed to fetch graph data:", response.status)
          return
        }
        const data = await response.json()

        // Transform edges to Relationship format
        const transformedRelationships: Relationship[] = (data.edges || []).map(
          (edge: { source: string; target: string; type: string }, index: number) => ({
            id: `rel-${index}`,
            sourceId: edge.source,
            targetId: edge.target,
            type: edge.type,
            label: edge.type.replace(/_/g, " ").toLowerCase(),
          })
        )

        setRelationships(transformedRelationships)
        console.log(`Loaded ${transformedRelationships.length} relationships for graph`)
      } catch (error) {
        console.error("Failed to fetch relationships:", error)
      }
    }

    fetchRelationships()
  }, [])

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
  }

  const filteredEntities = entities.filter((e) => {
    const matchesType = selectedTypeId ? e.typeId === selectedTypeId : true
    const matchesSearch = search
      ? e.name.toLowerCase().includes(search.toLowerCase()) ||
        Object.values(e.metadata || {}).some((v) => v.toLowerCase().includes(search.toLowerCase()))
      : true
    return matchesType && matchesSearch
  })

  const selectedType = entityTypes.find((t) => t.id === selectedTypeId)

  const handleAddEntityType = (preset?: (typeof additionalEntityTypeOptions)[0]) => {
    if (preset) {
      setEntityTypes([...entityTypes, { ...preset, description: "", count: 0 }])
    } else if (newEntityType.name) {
      setEntityTypes([
        ...entityTypes,
        {
          id: `custom-${Date.now()}`,
          name: newEntityType.name,
          nameEn: newEntityType.nameEn || newEntityType.name,
          icon: <Tag className="w-5 h-5" />,
          color: "bg-gray-100 text-gray-700",
          nodeColor: "#6B7280",
          description: newEntityType.description,
          count: 0,
        },
      ])
      setNewEntityType({ name: "", nameEn: "", description: "" })
    }
    setShowAddTypeDialog(false)
  }

  const handleAddEntity = () => {
    if (newEntity.name.trim() && newEntity.typeId) {
      const entity: Entity = {
        id: `e${Date.now()}`,
        typeId: newEntity.typeId,
        name: newEntity.name.trim(),
        metadata: newEntity.metadata ? { note: newEntity.metadata } : {},
        mentionCount: 0,
        meetingCount: 0,
        lastMeeting: new Date().toISOString().split("T")[0],
        meetings: [],
        confidence: 1.0,
      }
      setEntities((prev) => [entity, ...prev])
      setShowAddEntityDialog(false)
      setNewEntity({ name: "", typeId: "", metadata: "" })
    }
  }

  const handleDeleteEntityType = (typeId: string) => {
    setEntityTypes(entityTypes.filter((t) => t.id !== typeId))
    setEntities(entities.filter((e) => e.typeId !== typeId))
    if (selectedTypeId === typeId) {
      setSelectedTypeId(null)
    }
  }

  const handleDeleteEntity = (id: string) => {
    setEntities((prev) => prev.filter((e) => e.id !== id))
    setRelationships(relationships.filter((r) => r.sourceId !== id && r.targetId !== id))
    if (selectedEntity?.id === id) {
      setSelectedEntity(null)
    }
  }

  const handleAddRelationship = () => {
    if (selectedEntity && newRelationship.targetId && newRelationship.label) {
      const newRel: Relationship = {
        id: `rel-${Date.now()}`,
        sourceId: selectedEntity.id,
        targetId: newRelationship.targetId,
        type: newRelationship.type || "RELATED_TO",
        label: newRelationship.label,
      }
      setRelationships([...relationships, newRel])
      setNewRelationship({ targetId: "", type: "", label: "" })
      setShowRelationshipDialog(false)
    }
  }

  const handleMergeEntities = () => {
    if (mergeSource && mergeTarget) {
      // Merge the source into target
      const targetEntity = entities.find((e) => e.id === mergeTarget)
      if (targetEntity) {
        setEntities((prev) =>
          prev
            .filter((e) => e.id !== mergeSource.id)
            .map((e) =>
              e.id === mergeTarget
                ? {
                    ...e,
                    mentionCount: e.mentionCount + mergeSource.mentionCount,
                    meetingCount: Math.max(e.meetingCount, mergeSource.meetingCount),
                    meetings: [...e.meetings, ...mergeSource.meetings].slice(0, 5),
                  }
                : e,
            ),
        )
      }
      setShowMergeDialog(false)
      setMergeSource(null)
      setMergeTarget("")
    }
  }

  const toggleFilterType = (typeId: string) => {
    setFilterTypes((prev) => (prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]))
  }

  const availablePresets = additionalEntityTypeOptions.filter((opt) => !entityTypes.find((t) => t.id === opt.id))

  const entityRelationships = selectedEntity
    ? relationships.filter((r) => r.sourceId === selectedEntity.id || r.targetId === selectedEntity.id)
    : []

  const getRelatedEntity = (rel: Relationship) => {
    const otherId = rel.sourceId === selectedEntity?.id ? rel.targetId : rel.sourceId
    return entities.find((e) => e.id === otherId)
  }

  const getEntityType = (typeId: string) => entityTypes.find((t) => t.id === typeId)

  const handleEditEntity = (entity: Entity) => {
    setEditingEntityId(entity.id)
    setEditingEntityName(entity.name)
  }

  const handleSaveEntity = () => {
    if (editingEntityName.trim()) {
      setEntities((prev) => prev.map((e) => (e.id === editingEntityId ? { ...e, name: editingEntityName.trim() } : e)))
      setEditingEntityId(null)
      setEditingEntityName("")
    }
  }

  const handleOpenMerge = (entity: Entity) => {
    setMergeSource(entity)
    setMergeTarget("")
    setShowMergeDialog(true)
  }

  return (
    <div className={`flex h-[calc(100vh-3.5rem)] ${isRTL ? "dir-rtl" : "dir-ltr"}`} dir={isRTL ? "rtl" : "ltr"}>
      {/* Sidebar - Entity Types */}
      <div className="w-64 flex-shrink-0 border-l border-border bg-sidebar flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground mb-1">{isRTL ? "סוגי ישויות" : "Entity Types"}</h2>
          <p className="text-xs text-muted-foreground">{isRTL ? "לחץ לסינון לפי סוג" : "Click to filter by type"}</p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            <button
              onClick={() => setSelectedTypeId(null)}
              className={cn(
                "w-full p-3 rounded-lg transition-colors text-right",
                selectedTypeId === null ? "bg-teal-50 border border-teal-200" : "hover:bg-muted",
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                  <LayoutGrid className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{isRTL ? "הכל" : "All"}</p>
                  <p className="text-xs text-muted-foreground">
                    {entities.length} {isRTL ? "ישויות" : "entities"}
                  </p>
                </div>
              </div>
            </button>

            {entityTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedTypeId(type.id)}
                className={cn(
                  "w-full p-3 rounded-lg transition-colors text-right",
                  selectedTypeId === type.id ? "bg-teal-50 border border-teal-200" : "hover:bg-muted",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded flex items-center justify-center", type.color)}>{type.icon}</div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{isRTL ? type.name : type.nameEn}</p>
                    <p className="text-xs text-muted-foreground">
                      {entities.filter((e) => e.typeId === type.id).length} {isRTL ? "ישויות" : "entities"}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-border">
          <Button variant="outline" size="sm" className="w-full bg-transparent">
            <Settings2 className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
            {isRTL ? "ניהול סוגים" : "Manage Types"}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b border-border bg-white px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground",
                    isRTL ? "right-3" : "left-3",
                  )}
                />
                <Input
                  placeholder={isRTL ? "חפש ישויות..." : "Search entities..."}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={cn("bg-white", isRTL ? "pr-9" : "pl-9")}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "graph")}>
                <TabsList className="h-9">
                  <TabsTrigger value="list" className="px-3">
                    <LayoutGrid className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="graph" className="px-3">
                    <GitBranch className="w-4 h-4" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button onClick={() => setShowAddEntityDialog(true)} className="bg-teal-600 hover:bg-teal-700">
                <Plus className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                {isRTL ? "הוסף ישות" : "Add Entity"}
              </Button>
            </div>
          </div>
        </div>

        {/* Entity List / Graph */}
        <div className="flex-1 flex overflow-hidden">
          {viewMode === "graph" ? (
            <div className="flex-1 p-6">
              <GraphView
                entities={entities}
                entityTypes={entityTypes}
                relationships={relationships}
                onSelectEntity={setSelectedEntity}
                selectedEntityId={selectedEntity?.id || null}
                filterTypes={filterTypes}
              />
            </div>
          ) : (
          <ScrollArea className="flex-1 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEntities.map((entity) => {
                const type = getEntityType(entity.typeId)
                return (
                  <Card
                    key={entity.id}
                    className={cn(
                      "cursor-pointer hover:border-teal-300 transition-colors",
                      selectedEntity?.id === entity.id && "border-teal-500",
                    )}
                    onClick={() => setSelectedEntity(entity)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", type?.color)}>
                            {type?.icon}
                          </div>
                          <div>
                            {editingEntityId === entity.id ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={editingEntityName}
                                  onChange={(e) => setEditingEntityName(e.target.value)}
                                  className="h-7 text-sm w-32"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveEntity()
                                    if (e.key === "Escape") setEditingEntityId(null)
                                  }}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSaveEntity()
                                  }}
                                >
                                  <CheckSquare className="w-3 h-3 text-green-600" />
                                </Button>
                              </div>
                            ) : (
                              <h3 className="font-medium text-foreground">{entity.name}</h3>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {entity.mentionCount} {isRTL ? "אזכורים" : "mentions"}
                            </p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditEntity(entity)
                              }}
                            >
                              <Pencil className="w-3 h-3 mr-2" />
                              {isRTL ? "ערוך" : "Edit"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenMerge(entity)
                              }}
                            >
                              <GitMerge className="w-3 h-3 mr-2" />
                              {isRTL ? "מזג" : "Merge"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteEntity(entity.id)
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="w-3 h-3 mr-2" />
                              {isRTL ? "מחק" : "Delete"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {entity.snippets && entity.snippets.length > 0 && (
                        <div className="mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                          "{entity.snippets[0].text}"
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{entity.lastMeeting}</span>
                        <span>·</span>
                        <span>
                          {entity.meetingCount} {isRTL ? "פגישות" : "meetings"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </ScrollArea>
          )}

          {/* Detail Panel */}
          {selectedEntity && (
            <div className="w-80 flex-shrink-0 border-l border-border bg-white p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{isRTL ? "פרטים" : "Details"}</h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedEntity(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-lg flex items-center justify-center",
                      getEntityType(selectedEntity.typeId)?.color,
                    )}
                  >
                    {getEntityType(selectedEntity.typeId)?.icon}
                  </div>
                  <div>
                    <h4 className="font-medium text-lg">{selectedEntity.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {isRTL
                        ? getEntityType(selectedEntity.typeId)?.name
                        : getEntityType(selectedEntity.typeId)?.nameEn}
                    </p>
                  </div>
                </div>

                {selectedEntity.metadata && Object.keys(selectedEntity.metadata).length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-muted-foreground">
                      {isRTL ? "מידע נוסף" : "Additional Info"}
                    </h5>
                    {Object.entries(selectedEntity.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{key}</span>
                        <span>{value}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-muted-foreground">{isRTL ? "ציטוטים" : "Quotes"}</h5>
                  {selectedEntity.snippets?.map((snippet, i) => (
                    <Card key={i} className="bg-muted/30">
                      <CardContent className="p-3">
                        <p className="text-sm">"{snippet.text}"</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground" dir="ltr">
                            {snippet.timestamp}
                          </span>
                          <Button variant="ghost" size="sm" className="h-6 text-xs" asChild>
                            <Link href={`/meetings/${snippet.meetingId}?t=${snippet.timestamp}`}>
                              <ExternalLink className="w-3 h-3 mr-1" />
                              {isRTL ? "פתח" : "Open"}
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-muted-foreground">
                    {isRTL ? "פגישות קשורות" : "Related Meetings"}
                  </h5>
                  {selectedEntity.meetings.map((meeting) => (
                    <Link
                      key={meeting.id}
                      href={`/meetings/${meeting.id}`}
                      className="block p-2 rounded hover:bg-muted transition-colors"
                    >
                      <p className="text-sm font-medium">{meeting.title}</p>
                      <p className="text-xs text-muted-foreground">{meeting.date}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Entity Dialog */}
      <Dialog open={showAddEntityDialog} onOpenChange={setShowAddEntityDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? "הוספת ישות" : "Add Entity"}</DialogTitle>
            <DialogDescription>{isRTL ? "הוסף ישות חדשה לזיכרון" : "Add a new entity to memory"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{isRTL ? "סוג" : "Type"}</Label>
              <Select value={newEntity.typeId} onValueChange={(v) => setNewEntity({ ...newEntity, typeId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={isRTL ? "בחר סוג" : "Select type"} />
                </SelectTrigger>
                <SelectContent>
                  {entityTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {isRTL ? type.name : type.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "שם" : "Name"}</Label>
              <Input
                value={newEntity.name}
                onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })}
                placeholder={isRTL ? "שם הישות" : "Entity name"}
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "הערות (אופציונלי)" : "Notes (optional)"}</Label>
              <Textarea
                value={newEntity.metadata}
                onChange={(e) => setNewEntity({ ...newEntity, metadata: e.target.value })}
                placeholder={isRTL ? "מידע נוסף..." : "Additional info..."}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEntityDialog(false)}>
              {isRTL ? "ביטול" : "Cancel"}
            </Button>
            <Button onClick={handleAddEntity} disabled={!newEntity.name.trim() || !newEntity.typeId}>
              {isRTL ? "הוסף" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? "מיזוג ישויות" : "Merge Entities"}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? `בחר את הישות שאליה תרצה למזג את "${mergeSource?.name}"`
                : `Select which entity to merge "${mergeSource?.name}" into`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-64 overflow-y-auto">
            {entities
              .filter((e) => e.id !== mergeSource?.id && e.typeId === mergeSource?.typeId)
              .map((e) => (
                <label
                  key={e.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    mergeTarget === e.id ? "border-teal-500 bg-teal-50" : "border-border hover:bg-muted/50",
                  )}
                >
                  <input
                    type="radio"
                    name="mergeTarget"
                    value={e.id}
                    checked={mergeTarget === e.id}
                    onChange={() => setMergeTarget(e.id)}
                    className="sr-only"
                  />
                  <span className="font-medium text-sm">{e.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.mentionCount} {isRTL ? "אזכורים" : "mentions"}
                  </span>
                </label>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>
              {isRTL ? "ביטול" : "Cancel"}
            </Button>
            <Button onClick={handleMergeEntities} disabled={!mergeTarget}>
              {isRTL ? "מזג" : "Merge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
