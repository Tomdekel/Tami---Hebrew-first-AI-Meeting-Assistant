"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
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
  ChevronDown,
  ChevronUp,
  Brain,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface EntitySession {
  id: string;
  title: string | null;
  createdAt: string;
  context: string | null;
}

interface Entity {
  id: string;
  value: string;
  normalizedValue: string;
  mentionCount: number;
  sessions: EntitySession[];
}

interface GroupedEntities {
  [type: string]: Entity[];
}

const typeIcons: Record<string, React.ReactNode> = {
  person: <User className="h-5 w-5" />,
  organization: <Building2 className="h-5 w-5" />,
  project: <FolderKanban className="h-5 w-5" />,
  topic: <Hash className="h-5 w-5" />,
  location: <MapPin className="h-5 w-5" />,
  date: <Calendar className="h-5 w-5" />,
  product: <Package className="h-5 w-5" />,
  technology: <Cpu className="h-5 w-5" />,
  other: <HelpCircle className="h-5 w-5" />,
};

const typeOrder = [
  "person",
  "organization",
  "project",
  "topic",
  "technology",
  "product",
  "location",
  "date",
  "other",
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function EntityCard({ entity }: { entity: Entity }) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors">
          <div className="flex items-center gap-3">
            <span className="font-medium">{entity.value}</span>
            <Badge variant="secondary" className="text-xs">
              {entity.mentionCount} {t("entities.mentions")}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 ms-4 space-y-2">
          {entity.sessions.map((session) => (
            <Link
              key={session.id}
              href={`/meetings/${session.id}`}
              className="block p-2 rounded border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {session.title || t("meeting.untitled")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(session.createdAt)}
                </span>
              </div>
              {session.context && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  &ldquo;{session.context}&rdquo;
                </p>
              )}
            </Link>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function EntityTypeSection({
  type,
  entities,
}: {
  type: string;
  entities: Entity[];
}) {
  const t = useTranslations();
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {typeIcons[type] || typeIcons.other}
                </div>
                <div>
                  <CardTitle className="text-lg">{t(`entities.types.${type}`)}</CardTitle>
                  <CardDescription>
                    {entities.length} {t("entities.items")}
                  </CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-2">
            {entities.map((entity) => (
              <EntityCard key={entity.id} entity={entity} />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function EntitiesPage() {
  const t = useTranslations();
  const [entities, setEntities] = useState<GroupedEntities>({});
  const [totalEntities, setTotalEntities] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEntities() {
      try {
        const response = await fetch("/api/entities");
        if (!response.ok) {
          throw new Error("Failed to load entities");
        }
        const data = await response.json();
        setEntities(data.entities || {});
        setTotalEntities(data.totalEntities || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }
    loadEntities();
  }, []);

  // Sort types by predefined order
  const sortedTypes = Object.keys(entities).sort((a, b) => {
    const aIndex = typeOrder.indexOf(a);
    const bIndex = typeOrder.indexOf(b);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("entities.title")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("entities.description")}
        </p>
      </div>

      {/* Content */}
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
      ) : totalEntities === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Brain className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t("entities.noEntitiesYet")}</h3>
            <p className="text-muted-foreground text-center mb-4">
              {t("entities.noEntitiesDesc")}
            </p>
            <Button asChild>
              <Link href="/meetings">{t("nav.meetings")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              {totalEntities} {t("entities.totalEntities")}
            </span>
            <span>|</span>
            <span>
              {sortedTypes.length} {t("entities.categories")}
            </span>
          </div>

          {/* Entity sections by type */}
          {sortedTypes.map((type) => (
            <EntityTypeSection
              key={type}
              type={type}
              entities={entities[type]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
