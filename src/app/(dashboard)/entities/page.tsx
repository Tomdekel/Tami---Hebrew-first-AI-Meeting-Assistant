"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Loader2,
  AlertCircle,
  User,
  Building2,
  FolderKanban,
  Hash,
  MapPin,
  Calendar,
  Package,
  Cpu,
  HelpCircle,
  Search,
  ArrowLeft,
  Plus,
  Settings2,
  Pencil,
  Trash2,
  MoreHorizontal,
  Tag,
  DollarSign,
  LayoutGrid,
  GitBranch,
  Filter,
  X,
  Link2,
  GitMerge,
  CheckSquare,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DuplicateReviewModal } from "@/components/entities/duplicate-review-modal";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GraphNode, GraphEdge } from "@/components/graph/knowledge-graph";

// Dynamically import the graph component to avoid SSR issues
const KnowledgeGraph = dynamic(
  () => import("@/components/graph/knowledge-graph").then((mod) => mod.KnowledgeGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

// Types
interface EntityType {
  id: string;
  name: string;
  nameEn: string;
  icon: React.ReactNode;
  color: string;
  nodeColor: string;
  description: string;
  count: number;
  isDefault?: boolean;
}

interface Entity {
  id: string;
  typeId: string;
  name: string;
  display_value?: string;
  normalized_value?: string;
  metadata?: Record<string, string>;
  mentionCount: number;
  meetingCount: number;
  lastMeeting?: string;
  meetings?: { id: string; title: string; date: string }[];
  snippets?: { text: string; meetingId: string; timestamp: string }[];
  sentiment?: "positive" | "neutral" | "negative";
  confidence?: number;
  aliases?: string[];
  description?: string;
}

interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  sourceName?: string;
  targetName?: string;
  type: string;
  label: string;
  confidence?: number;
  source?: string;
}

// Default entity types
const defaultEntityTypes: EntityType[] = [
  {
    id: "person",
    name: "אנשים",
    nameEn: "People",
    icon: <User className="w-5 h-5" />,
    color: "bg-blue-100 text-blue-700",
    nodeColor: "#3B82F6",
    description: "אנשים שהוזכרו בפגישות",
    count: 0,
    isDefault: true,
  },
  {
    id: "organization",
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
    id: "project",
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
    id: "topic",
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
    id: "technology",
    name: "טכנולוגיות",
    nameEn: "Technologies",
    icon: <Cpu className="w-5 h-5" />,
    color: "bg-indigo-100 text-indigo-700",
    nodeColor: "#6366F1",
    description: "טכנולוגיות וכלים",
    count: 0,
    isDefault: true,
  },
  {
    id: "product",
    name: "מוצרים",
    nameEn: "Products",
    icon: <Package className="w-5 h-5" />,
    color: "bg-orange-100 text-orange-700",
    nodeColor: "#F97316",
    description: "מוצרים ושירותים",
    count: 0,
    isDefault: true,
  },
  {
    id: "location",
    name: "מיקומים",
    nameEn: "Locations",
    icon: <MapPin className="w-5 h-5" />,
    color: "bg-green-100 text-green-700",
    nodeColor: "#10B981",
    description: "מיקומים גיאוגרפיים",
    count: 0,
    isDefault: true,
  },
  {
    id: "date",
    name: "תאריכים",
    nameEn: "Dates",
    icon: <Calendar className="w-5 h-5" />,
    color: "bg-rose-100 text-rose-700",
    nodeColor: "#F43F5E",
    description: "תאריכים וזמנים",
    count: 0,
    isDefault: true,
  },
  {
    id: "other",
    name: "אחר",
    nameEn: "Other",
    icon: <HelpCircle className="w-5 h-5" />,
    color: "bg-gray-100 text-gray-700",
    nodeColor: "#6B7280",
    description: "ישויות אחרות",
    count: 0,
    isDefault: true,
  },
];

const additionalEntityTypeOptions = [
  {
    id: "action-items",
    name: "משימות",
    nameEn: "Action Items",
    icon: <CheckSquare className="w-5 h-5" />,
    color: "bg-green-100 text-green-700",
    nodeColor: "#10B981",
  },
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
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("he-IL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

export default function EntitiesPage() {
  const t = useTranslations();
  const locale = useLocale();
  const isRTL = locale === "he";

  // Helper function to format dates based on locale
  const formatDateLocalized = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString(isRTL ? "he-IL" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Helper function to get localized entity type name
  const getTypeName = (type: EntityType): string => {
    return isRTL ? type.name : type.nameEn;
  };

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");
  const [entityTypes, setEntityTypes] = useState<EntityType[]>(defaultEntityTypes);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);

  // Dialog states
  const [showAddTypeDialog, setShowAddTypeDialog] = useState(false);
  const [showAddEntityDialog, setShowAddEntityDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [showRelationshipDialog, setShowRelationshipDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showDuplicateReviewDialog, setShowDuplicateReviewDialog] = useState(false);

  // Form states
  const [mergeTarget, setMergeTarget] = useState("");
  const [newEntityType, setNewEntityType] = useState({ name: "", nameEn: "", description: "" });
  const [newEntity, setNewEntity] = useState({ name: "", description: "" });
  const [newRelationship, setNewRelationship] = useState({ targetId: "", type: "RELATED_TO", label: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load entities from Neo4j
  const loadEntities = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/graph/entities");
      if (!response.ok) {
        throw new Error("Failed to load entities");
      }
      const data = await response.json();

      // Transform grouped entities to flat array
      const flatEntities: Entity[] = [];
      const typeCounts: Record<string, number> = {};

      for (const [type, typeEntities] of Object.entries(data.entities || {})) {
        typeCounts[type] = (typeEntities as unknown[]).length;
        for (const e of typeEntities as Record<string, unknown>[]) {
          flatEntities.push({
            id: e.id as string,
            typeId: type,
            name: (e.display_value as string) || (e.normalized_value as string) || "",
            display_value: e.display_value as string,
            normalized_value: e.normalized_value as string,
            mentionCount: (e.mention_count as number) || 0,
            meetingCount: (e.meetingCount as number) || 0,
            confidence: e.confidence as number,
            aliases: e.aliases as string[],
            description: e.description as string,
          });
        }
      }

      setEntities(flatEntities);

      // Update type counts
      setEntityTypes((prev) =>
        prev.map((type) => ({
          ...type,
          count: typeCounts[type.id] || 0,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load graph visualization data
  const loadGraphData = useCallback(async () => {
    try {
      const response = await fetch("/api/graph/visualize");
      if (!response.ok) return;

      const data = await response.json();
      setGraphNodes(data.nodes || []);
      setGraphEdges(data.edges || []);
    } catch (err) {
      console.error("Failed to load graph data:", err);
    }
  }, []);

  // Load relationships for selected entity
  const loadRelationships = useCallback(async (entityId: string) => {
    try {
      const response = await fetch(`/api/graph/relationships?entityId=${entityId}`);
      if (!response.ok) return;

      const data = await response.json();
      setRelationships(data.relationships || []);
    } catch (err) {
      console.error("Failed to load relationships:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadEntities();
    loadGraphData();
  }, [loadEntities, loadGraphData]);

  // Load relationships when entity is selected
  useEffect(() => {
    if (selectedEntity) {
      loadRelationships(selectedEntity.id);
    } else {
      setRelationships([]);
    }
  }, [selectedEntity, loadRelationships]);

  // Handlers
  const handleAddEntityType = (preset?: typeof additionalEntityTypeOptions[0]) => {
    if (preset) {
      setEntityTypes([...entityTypes, { ...preset, description: "", count: 0 }]);
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
      ]);
      setNewEntityType({ name: "", nameEn: "", description: "" });
    }
    setShowAddTypeDialog(false);
  };

  const handleAddEntity = async () => {
    if (!newEntity.name || !selectedTypeId) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/graph/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedTypeId,
          value: newEntity.name,
          description: newEntity.description,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create entity");
      }

      const data = await response.json();
      const newEntityObj: Entity = {
        id: data.entity.id,
        typeId: selectedTypeId,
        name: data.entity.display_value,
        mentionCount: 0,
        meetingCount: 0,
        description: data.entity.description,
      };

      setEntities([...entities, newEntityObj]);
      setEntityTypes((prev) =>
        prev.map((t) => (t.id === selectedTypeId ? { ...t, count: t.count + 1 } : t))
      );
      setNewEntity({ name: "", description: "" });
      setShowAddEntityDialog(false);
    } catch (err) {
      console.error("Error creating entity:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntityType = (typeId: string) => {
    setEntityTypes(entityTypes.filter((t) => t.id !== typeId));
    setEntities(entities.filter((e) => e.typeId !== typeId));
    if (selectedTypeId === typeId) {
      setSelectedTypeId(null);
    }
  };

  const handleDeleteEntity = async (entityId: string) => {
    try {
      const response = await fetch(`/api/graph/entities/${entityId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete entity");
      }

      const deletedEntity = entities.find((e) => e.id === entityId);
      setEntities(entities.filter((e) => e.id !== entityId));
      setRelationships(relationships.filter((r) => r.sourceId !== entityId && r.targetId !== entityId));

      if (deletedEntity) {
        setEntityTypes((prev) =>
          prev.map((t) => (t.id === deletedEntity.typeId ? { ...t, count: Math.max(0, t.count - 1) } : t))
        );
      }

      if (selectedEntity?.id === entityId) {
        setSelectedEntity(null);
      }

      // Refresh graph data
      loadGraphData();
    } catch (err) {
      console.error("Error deleting entity:", err);
    }
  };

  const handleAddRelationship = async () => {
    if (!selectedEntity || !newRelationship.targetId || !newRelationship.label) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/graph/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: selectedEntity.id,
          targetId: newRelationship.targetId,
          type: newRelationship.type,
          label: newRelationship.label,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create relationship");
      }

      const data = await response.json();
      setRelationships([...relationships, data.relationship]);
      setNewRelationship({ targetId: "", type: "RELATED_TO", label: "" });
      setShowRelationshipDialog(false);

      // Refresh graph data
      loadGraphData();
    } catch (err) {
      console.error("Error creating relationship:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMergeEntities = async () => {
    if (!selectedEntity || !mergeTarget) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/graph/entities/${mergeTarget}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: selectedEntity.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to merge entities");
      }

      // Remove merged entity and update target
      setEntities(entities.filter((e) => e.id !== selectedEntity.id));
      setSelectedEntity(null);
      setMergeTarget("");
      setShowMergeDialog(false);

      // Refresh data
      loadEntities();
      loadGraphData();
    } catch (err) {
      console.error("Error merging entities:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFilterType = (typeId: string) => {
    setFilterTypes((prev) =>
      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]
    );
  };

  const handleGraphNodeClick = useCallback((node: GraphNode) => {
    const entity = entities.find((e) => e.id === node.id);
    if (entity) {
      setSelectedEntity(entity);
    }
  }, [entities]);

  // Filtered entities
  const filteredEntities = entities.filter((e) => {
    const matchesType = selectedTypeId ? e.typeId === selectedTypeId : true;
    const matchesSearch = search
      ? e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.description?.toLowerCase().includes(search.toLowerCase())
      : true;
    return matchesType && matchesSearch;
  });

  // Filtered graph data
  const filteredGraphNodes = filterTypes.length > 0
    ? graphNodes.filter((n) => filterTypes.includes(n.type.toLowerCase()))
    : graphNodes;

  const filteredGraphEdges = filterTypes.length > 0
    ? graphEdges.filter((e) => {
        const sourceNode = graphNodes.find((n) => n.id === e.source);
        const targetNode = graphNodes.find((n) => n.id === e.target);
        return (
          sourceNode &&
          targetNode &&
          filterTypes.includes(sourceNode.type.toLowerCase()) &&
          filterTypes.includes(targetNode.type.toLowerCase())
        );
      })
    : graphEdges;

  const selectedType = entityTypes.find((t) => t.id === selectedTypeId);
  const availablePresets = additionalEntityTypeOptions.filter(
    (opt) => !entityTypes.find((t) => t.id === opt.id)
  );

  const entityRelationships = selectedEntity
    ? relationships.filter((r) => r.sourceId === selectedEntity.id || r.targetId === selectedEntity.id)
    : [];

  const getRelatedEntity = (rel: Relationship) => {
    const otherId = rel.sourceId === selectedEntity?.id ? rel.targetId : rel.sourceId;
    return entities.find((e) => e.id === otherId);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex h-full">
        {/* Main Content */}
        <div className={`flex-1 ${selectedEntity ? "max-w-4xl" : ""} border-l border-border`}>
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">{t("entities.title")}</h1>
                <p className="text-muted-foreground">{t("entities.description")}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="gap-2 bg-transparent"
                  onClick={() => setShowDuplicateReviewDialog(true)}
                >
                  <GitMerge className="w-4 h-4" />
                  {isRTL ? "כפילויות" : "Duplicates"}
                </Button>
                <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 bg-transparent">
                      <Settings2 className="w-4 h-4" />
                      {t("entities.settings")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{t("entities.settingsTitle")}</DialogTitle>
                      <DialogDescription>{t("entities.settingsDesc")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {entityTypes.map((type) => (
                        <div key={type.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg ${type.color} flex items-center justify-center`}>
                              {type.icon}
                            </div>
                            <div>
                              <p className="font-medium">{getTypeName(type)}</p>
                              <p className="text-xs text-muted-foreground">{type.count} {t("entities.entitiesCount")}</p>
                            </div>
                          </div>
                          {!type.isDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteEntityType(type.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
                        {t("entities.close")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("entities.searchPlaceholder")}
                className={`${isRTL ? "pr-10" : "pl-10"} bg-white`}
              />
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12 text-destructive">
                  <AlertCircle className="h-5 w-5 me-2" />
                  {error}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Entity Types Horizontal Scroll */}
                <div className="mb-6">
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                    {entityTypes.map((type) => (
                      <Card
                        key={type.id}
                        className={`cursor-pointer transition-all hover:shadow-md flex-shrink-0 w-36 ${
                          selectedTypeId === type.id ? "ring-2 ring-teal-500 bg-teal-50/30" : ""
                        }`}
                        onClick={() => setSelectedTypeId(selectedTypeId === type.id ? null : type.id)}
                      >
                        <CardContent className="p-4">
                          <div className={`w-10 h-10 rounded-xl ${type.color} flex items-center justify-center mb-2`}>
                            {type.icon}
                          </div>
                          <h3 className="font-medium text-foreground text-sm">{getTypeName(type)}</h3>
                          <p className="text-xs text-muted-foreground">{type.count} {t("entities.entitiesCount")}</p>
                        </CardContent>
                      </Card>
                    ))}

                    {/* Add New Entity Type */}
                    <Dialog open={showAddTypeDialog} onOpenChange={setShowAddTypeDialog}>
                      <DialogTrigger asChild>
                        <Card className="cursor-pointer transition-all hover:shadow-md border-dashed hover:border-teal-300 flex-shrink-0 w-36">
                          <CardContent className="p-4 flex flex-col items-center justify-center h-full">
                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-2">
                              <Plus className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <p className="text-xs text-muted-foreground">{t("entities.addType")}</p>
                          </CardContent>
                        </Card>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t("entities.addTypeTitle")}</DialogTitle>
                          <DialogDescription>{t("entities.addTypeDesc")}</DialogDescription>
                        </DialogHeader>

                        {availablePresets.length > 0 && (
                          <div className="space-y-2">
                            <Label>{t("entities.presetTypes")}</Label>
                            <div className="grid grid-cols-2 gap-2">
                              {availablePresets.map((preset) => (
                                <Button
                                  key={preset.id}
                                  variant="outline"
                                  className="justify-start gap-2 h-auto py-3 bg-transparent"
                                  onClick={() => handleAddEntityType(preset)}
                                >
                                  <div className={`w-8 h-8 rounded-lg ${preset.color} flex items-center justify-center`}>
                                    {preset.icon}
                                  </div>
                                  <span>{isRTL ? preset.name : preset.nameEn}</span>
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">{t("entities.orCreateNew")}</span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>{t("entities.hebrewName")}</Label>
                            <Input
                              value={newEntityType.name}
                              onChange={(e) => setNewEntityType({ ...newEntityType, name: e.target.value })}
                              placeholder={isRTL ? "לדוגמה: מותגים" : "e.g., Brands (Hebrew)"}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("entities.englishName")}</Label>
                            <Input
                              value={newEntityType.nameEn}
                              onChange={(e) => setNewEntityType({ ...newEntityType, nameEn: e.target.value })}
                              placeholder="e.g., Brands"
                              dir="ltr"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("entities.typeDescription")}</Label>
                            <Textarea
                              value={newEntityType.description}
                              onChange={(e) => setNewEntityType({ ...newEntityType, description: e.target.value })}
                              placeholder={isRTL ? "תאר מה סוג הישות הזה מייצג..." : "Describe what this entity type represents..."}
                              rows={2}
                            />
                          </div>
                        </div>

                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowAddTypeDialog(false)}>
                            {t("common.cancel")}
                          </Button>
                          <Button onClick={() => handleAddEntityType()} disabled={!newEntityType.name}>
                            {t("entities.createType")}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* View Toggle */}
                <div className="flex items-center justify-between mb-6">
                  <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "graph")}>
                    <TabsList>
                      <TabsTrigger value="list" className="gap-2">
                        <LayoutGrid className="w-4 h-4" />
                        {t("entities.listView")}
                      </TabsTrigger>
                      <TabsTrigger value="graph" className="gap-2">
                        <GitBranch className="w-4 h-4" />
                        {t("entities.graphView")}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {viewMode === "graph" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className={`gap-2 ${showFilterPanel ? "bg-teal-50" : ""}`}
                      onClick={() => setShowFilterPanel(!showFilterPanel)}
                    >
                      <Filter className="w-4 h-4" />
                      {t("entities.filter")}
                      {filterTypes.length > 0 && (
                        <Badge variant="secondary" className={isRTL ? "mr-1" : "ml-1"}>
                          {filterTypes.length}
                        </Badge>
                      )}
                    </Button>
                  )}
                </div>

                {/* Filter Panel for Graph View */}
                {viewMode === "graph" && showFilterPanel && (
                  <Card className="mb-6">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-sm">{t("entities.filterByType")}</h3>
                        {filterTypes.length > 0 && (
                          <Button variant="ghost" size="sm" onClick={() => setFilterTypes([])}>
                            {t("entities.clearAll")}
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {entityTypes.map((type) => (
                          <Button
                            key={type.id}
                            variant={filterTypes.includes(type.id) ? "default" : "outline"}
                            size="sm"
                            className="gap-2"
                            onClick={() => toggleFilterType(type.id)}
                          >
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.nodeColor }} />
                            {getTypeName(type)}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Content Area */}
                {viewMode === "list" ? (
                  /* List View */
                  selectedTypeId ? (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg ${selectedType?.color} flex items-center justify-center`}>
                            {selectedType?.icon}
                          </div>
                          {selectedType && getTypeName(selectedType)}
                        </h2>
                        <Dialog open={showAddEntityDialog} onOpenChange={setShowAddEntityDialog}>
                          <DialogTrigger asChild>
                            <Button size="sm" className="gap-2">
                              <Plus className="w-4 h-4" />
                              {t("entities.add")}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{t("entities.addEntity")}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>{t("entities.name")}</Label>
                                <Input
                                  value={newEntity.name}
                                  onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })}
                                  placeholder={t("entities.enterName")}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>{t("entities.descriptionOptional")}</Label>
                                <Textarea
                                  value={newEntity.description}
                                  onChange={(e) => setNewEntity({ ...newEntity, description: e.target.value })}
                                  placeholder={t("entities.addDescriptionPlaceholder")}
                                  rows={2}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setShowAddEntityDialog(false)}>
                                {t("common.cancel")}
                              </Button>
                              <Button onClick={handleAddEntity} disabled={!newEntity.name || isSubmitting}>
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t("entities.add")}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>

                      <div className="space-y-3">
                        {filteredEntities.map((entity) => {
                          const type = entityTypes.find((t) => t.id === entity.typeId);
                          return (
                            <Card
                              key={entity.id}
                              className={`cursor-pointer transition-colors hover:border-teal-300 ${
                                selectedEntity?.id === entity.id ? "border-teal-500 bg-teal-50/30" : ""
                              }`}
                              onClick={() => setSelectedEntity(entity)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center gap-4">
                                  {entity.typeId === "person" ? (
                                    <Avatar className="h-12 w-12">
                                      <AvatarFallback className={type?.color}>{getInitials(entity.name)}</AvatarFallback>
                                    </Avatar>
                                  ) : (
                                    <div className={`w-12 h-12 rounded-lg ${type?.color} flex items-center justify-center`}>
                                      {type?.icon}
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <h3 className="font-medium text-foreground">{entity.name}</h3>
                                    {entity.description && (
                                      <p className="text-sm text-muted-foreground">{entity.description}</p>
                                    )}
                                  </div>
                                  <div className={isRTL ? "text-left" : "text-right"}>
                                    <Badge variant="secondary">{entity.meetingCount} {t("entities.meetings")}</Badge>
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                      <Button variant="ghost" size="sm">
                                        <MoreHorizontal className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem>
                                        <Pencil className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                                        {t("entities.edit")}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="text-red-600"
                                        onClick={() => handleDeleteEntity(entity.id)}
                                      >
                                        <Trash2 className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                                        {t("entities.delete")}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}

                        {filteredEntities.length === 0 && (
                          <Card>
                            <CardContent className="p-8 text-center">
                              <p className="text-muted-foreground">{t("entities.noEntitiesOfType")}</p>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <p className="text-muted-foreground">{t("entities.selectTypePrompt")}</p>
                      </CardContent>
                    </Card>
                  )
                ) : (
                  /* Graph View */
                  <KnowledgeGraph
                    nodes={filteredGraphNodes}
                    edges={filteredGraphEdges}
                    onNodeClick={handleGraphNodeClick}
                    selectedNodeId={selectedEntity?.id}
                    height={600}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedEntity && (
          <div className="w-96 bg-white p-6 border-l border-border overflow-y-auto">
            <div className="space-y-6">
              {/* Close button */}
              <div className="flex justify-between items-start">
                <Button variant="ghost" size="icon" onClick={() => setSelectedEntity(null)}>
                  <X className="w-4 h-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem>
                      <Pencil className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                      {t("entities.editEntity")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowMergeDialog(true)}>
                      <GitMerge className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                      {t("entities.mergeWith")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteEntity(selectedEntity.id)}>
                      <Trash2 className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                      {t("entities.deleteEntity")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Entity Header */}
              <div className="text-center">
                {selectedEntity.typeId === "person" ? (
                  <Avatar className="h-20 w-20 mx-auto mb-3">
                    <AvatarFallback className={entityTypes.find((t) => t.id === selectedEntity.typeId)?.color}>
                      {getInitials(selectedEntity.name)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div
                    className={`w-20 h-20 rounded-xl ${entityTypes.find((t) => t.id === selectedEntity.typeId)?.color} flex items-center justify-center mx-auto mb-3`}
                  >
                    {entityTypes.find((t) => t.id === selectedEntity.typeId)?.icon}
                  </div>
                )}
                <h2 className="text-xl font-semibold">{selectedEntity.name}</h2>
                <Badge variant="outline" className="mt-2">
                  {(() => {
                    const type = entityTypes.find((t) => t.id === selectedEntity.typeId);
                    return type ? getTypeName(type) : selectedEntity.typeId;
                  })()}
                </Badge>
                {selectedEntity.description && (
                  <p className="text-muted-foreground mt-2">{selectedEntity.description}</p>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xl font-bold text-teal-600">{selectedEntity.mentionCount}</p>
                  <p className="text-xs text-muted-foreground">{t("entities.mentions")}</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xl font-bold text-teal-600">{selectedEntity.meetingCount}</p>
                  <p className="text-xs text-muted-foreground">{t("entities.meetings")}</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">
                    {selectedEntity.confidence ? `${Math.round(selectedEntity.confidence * 100)}%` : "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("entities.accuracy")}</p>
                </div>
              </div>

              {/* Relationships */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">{t("entities.relationships")}</h3>
                  <Dialog open={showRelationshipDialog} onOpenChange={setShowRelationshipDialog}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-1">
                        <Plus className="w-3 h-3" />
                        {t("entities.addRelationship")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("entities.addRelationshipTitle")}</DialogTitle>
                        <DialogDescription>{t("entities.addRelationshipDesc")} {selectedEntity.name} {t("entities.andAnotherEntity")}</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>{t("entities.targetEntity")}</Label>
                          <Select
                            value={newRelationship.targetId}
                            onValueChange={(v) => setNewRelationship({ ...newRelationship, targetId: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t("entities.selectEntity")} />
                            </SelectTrigger>
                            <SelectContent>
                              {entities
                                .filter((e) => e.id !== selectedEntity.id)
                                .map((e) => (
                                  <SelectItem key={e.id} value={e.id}>
                                    {e.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{t("entities.relationshipType")}</Label>
                          <Select
                            value={newRelationship.type}
                            onValueChange={(v) => setNewRelationship({ ...newRelationship, type: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="RELATED_TO">{t("entities.relatedTo")}</SelectItem>
                              <SelectItem value="WORKS_AT">{t("entities.worksAt")}</SelectItem>
                              <SelectItem value="MANAGES">{t("entities.manages")}</SelectItem>
                              <SelectItem value="COLLABORATES_WITH">{t("entities.collaboratesWith")}</SelectItem>
                              <SelectItem value="ASSIGNED_TO">{t("entities.assignedTo")}</SelectItem>
                              <SelectItem value="USES">{t("entities.uses")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{t("entities.relationshipLabel")}</Label>
                          <Input
                            value={newRelationship.label}
                            onChange={(e) => setNewRelationship({ ...newRelationship, label: e.target.value })}
                            placeholder={t("entities.exampleLabel")}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRelationshipDialog(false)}>
                          {t("common.cancel")}
                        </Button>
                        <Button
                          onClick={handleAddRelationship}
                          disabled={!newRelationship.targetId || !newRelationship.label || isSubmitting}
                        >
                          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t("entities.addRelationship")}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="space-y-2">
                  {entityRelationships.length > 0 ? (
                    entityRelationships.map((rel) => {
                      const related = getRelatedEntity(rel);
                      const relatedType = entityTypes.find((t) => t.id === related?.typeId);
                      const confidence = rel.confidence ?? 1.0;
                      const confidenceColor = confidence >= 0.8 ? "bg-green-100 text-green-700" :
                                             confidence >= 0.5 ? "bg-yellow-100 text-yellow-700" :
                                             "bg-red-100 text-red-700";
                      return (
                        <div key={rel.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                          <Link2 className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-sm">
                              <span className="text-muted-foreground">{rel.label}</span>{" "}
                              <span className="font-medium">{related?.name || rel.targetName || rel.sourceName}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {rel.source === "ai" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
                                AI
                              </span>
                            )}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${confidenceColor}`}>
                              {Math.round(confidence * 100)}%
                            </span>
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: relatedType?.nodeColor }} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">{t("entities.noRelationshipsYet")}</p>
                  )}
                </div>
              </div>

              {/* Snippets */}
              {selectedEntity.snippets && selectedEntity.snippets.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">{t("entities.quotes")}</h3>
                  <div className="space-y-2">
                    {selectedEntity.snippets.map((snippet, i) => (
                      <div key={i} className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-foreground">&ldquo;{snippet.text}&rdquo;</p>
                        <p className="text-xs text-muted-foreground mt-1" dir="ltr">
                          {snippet.timestamp}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Meetings */}
              {selectedEntity.meetings && selectedEntity.meetings.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">{t("entities.relatedMeetings")}</h3>
                  <div className="space-y-2">
                    {selectedEntity.meetings.map((meeting) => (
                      <Link
                        key={meeting.id}
                        href={`/meetings/${meeting.id}`}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors group"
                      >
                        <div>
                          <p className="text-sm font-medium">{meeting.title}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1" dir="ltr">
                            <Calendar className="w-3 h-3" />
                            {meeting.date}
                          </p>
                        </div>
                        <ArrowLeft className={`w-4 h-4 text-muted-foreground group-hover:text-teal-600 ${isRTL ? "rotate-180" : ""}`} />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Merge Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("entities.mergeEntities")}</DialogTitle>
            <DialogDescription>
              {t("entities.mergeDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>{t("entities.selectTargetForMerge")}</Label>
            <Select value={mergeTarget} onValueChange={setMergeTarget}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={t("entities.selectEntity")} />
              </SelectTrigger>
              <SelectContent>
                {entities
                  .filter((e) => e.id !== selectedEntity?.id && e.typeId === selectedEntity?.typeId)
                  .map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleMergeEntities} disabled={!mergeTarget || isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t("entities.merge")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Review Modal */}
      <DuplicateReviewModal
        open={showDuplicateReviewDialog}
        onOpenChange={setShowDuplicateReviewDialog}
        onMergeComplete={() => {
          loadEntities();
          loadGraphData();
        }}
      />
    </div>
  );
}
