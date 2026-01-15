"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { LayoutGrid, Network } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import {
  Users,
  Building2,
  FolderKanban,
  CheckSquare,
  MessageSquare,
  MapPin,
  Calendar,
} from "lucide-react"

// Import sub-components
import { InsightsDeck } from "@/components/entities/insights-deck"
import { KnowledgeTable } from "@/components/entities/knowledge-table"
import { EntitySheet } from "@/components/entities/entity-sheet"
import { GraphView } from "@/components/entities/graph-view"

import type { Entity, EntityType, Relationship } from "@/types/entity"

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
    count: 0,
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
    count: 0,
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
    count: 0,
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
    count: 0,
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
    count: 0,
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

// Main Component
export function EntitiesPage() {
  const { isRTL } = useLanguage()
  const [viewMode, setViewMode] = useState<"dashboard" | "graph">("dashboard")
  const [entityTypes, setEntityTypes] = useState<EntityType[]>(defaultEntityTypes)
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [entities, setEntities] = useState<Entity[]>([])
  const [relationships, setRelationships] = useState<Relationship[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLoadingEntities, setIsLoadingEntities] = useState(true)

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
      } catch (error) {
        console.error("Failed to fetch relationships:", error)
      }
    }

    fetchRelationships()
  }, [])

  const getTypeColor = (typeId: string) => {
    const t = entityTypes.find(type => type.id === typeId)
    return t ? t.color : "bg-gray-100 text-gray-700" // Fallback
  }

  return (
    <div className={`container mx-auto p-6 space-y-6 ${isRTL ? "font-hebrew" : ""}`} dir={isRTL ? "rtl" : "ltr"}>
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isRTL ? "מאגר ידע" : "Knowledge Base"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isRTL
              ? "עקוב אחרי נושאים, אנשים ומגמות בפגישות שלך."
              : "Track topics, people, and trends across your meetings."}
          </p>
        </div>

        {/* View Toggle */}
        <div className="bg-muted p-1 rounded-lg flex items-center gap-1">
          <Button
            variant={viewMode === "dashboard" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("dashboard")}
            className="gap-2"
          >
            <LayoutGrid className="w-4 h-4" />
            {isRTL ? "לוח בקרה" : "Dashboard"}
          </Button>
          <Button
            variant={viewMode === "graph" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("graph")}
            className="gap-2"
          >
            <Network className="w-4 h-4" />
            {isRTL ? "רשת הקשרים" : "Graph"}
          </Button>
        </div>
      </div>

      {viewMode === "dashboard" ? (
        <>
          <InsightsDeck entities={entities} />
          <KnowledgeTable
            entities={entities}
            entityTypes={entityTypes}
            onSelectEntity={setSelectedEntity}
          />
        </>
      ) : (
        <GraphView
          entities={entities}
          entityTypes={entityTypes}
          relationships={relationships}
          onSelectEntity={setSelectedEntity}
          selectedEntityId={selectedEntity?.id || null}
          filterTypes={[]}
        />
      )}

      <EntitySheet
        entity={selectedEntity}
        isOpen={!!selectedEntity}
        onClose={() => setSelectedEntity(null)}
        getTypeColor={getTypeColor}
      />
    </div>
  )
}
