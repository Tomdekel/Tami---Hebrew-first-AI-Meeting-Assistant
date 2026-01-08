"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search as SearchIcon,
  FileText,
  Brain,
  Loader2,
  Clock,
  User as UserIcon,
  Building2,
  FolderKanban,
  Hash,
  MapPin,
  Calendar,
  Package,
  Cpu,
  HelpCircle,
  X,
  Filter,
} from "lucide-react";
import Link from "next/link";
import type { EntityType } from "@/lib/types/database";

interface TextSearchResult {
  sessionId: string;
  sessionTitle: string;
  sessionDate: string;
  matchCount: number;
  matches: Array<{
    segmentId: string;
    speakerName: string | null;
    text: string;
    highlightedText: string;
    startTime: number | null;
  }>;
}

interface SemanticSearchResult {
  id: string;
  sessionId: string;
  sessionTitle: string;
  content: string;
  speakerName: string | null;
  startTime: number | null;
  similarity: number;
}

// Entity type icons and labels
const entityTypeConfig: Record<EntityType, { icon: React.ReactNode; labelKey: string }> = {
  person: { icon: <UserIcon className="h-3 w-3" />, labelKey: "entities.types.person" },
  organization: { icon: <Building2 className="h-3 w-3" />, labelKey: "entities.types.organization" },
  project: { icon: <FolderKanban className="h-3 w-3" />, labelKey: "entities.types.project" },
  topic: { icon: <Hash className="h-3 w-3" />, labelKey: "entities.types.topic" },
  location: { icon: <MapPin className="h-3 w-3" />, labelKey: "entities.types.location" },
  date: { icon: <Calendar className="h-3 w-3" />, labelKey: "entities.types.date" },
  product: { icon: <Package className="h-3 w-3" />, labelKey: "entities.types.product" },
  technology: { icon: <Cpu className="h-3 w-3" />, labelKey: "entities.types.technology" },
  other: { icon: <HelpCircle className="h-3 w-3" />, labelKey: "entities.types.other" },
};

const entityTypeOrder: EntityType[] = [
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

export default function SearchPage() {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("text");
  const [textResults, setTextResults] = useState<TextSearchResult[]>([]);
  const [semanticResults, setSemanticResults] = useState<SemanticSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<EntityType[]>([]);
  const [availableEntityTypes, setAvailableEntityTypes] = useState<EntityType[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(true);

  // Fetch available entity types on mount
  useEffect(() => {
    const fetchEntityTypes = async () => {
      try {
        const response = await fetch("/api/entities");
        if (response.ok) {
          const data = await response.json();
          // Get entity types that have at least one entity
          const types = Object.keys(data.entities || {}).filter(
            (type) => data.entities[type]?.length > 0
          ) as EntityType[];
          setAvailableEntityTypes(types);
        }
      } catch (error) {
        console.error("Failed to fetch entities:", error);
      } finally {
        setEntitiesLoading(false);
      }
    };
    fetchEntityTypes();
  }, []);

  const toggleEntityType = (type: EntityType) => {
    setSelectedEntityTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const clearEntityFilters = () => {
    setSelectedEntityTypes([]);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isSearching) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      if (activeTab === "text") {
        // Text search with entity filters
        const params = new URLSearchParams({
          q: query.trim(),
        });
        if (selectedEntityTypes.length > 0) {
          params.set("entityTypes", selectedEntityTypes.join(","));
        }
        const response = await fetch(`/api/search?${params}`);
        if (response.ok) {
          const data = await response.json();
          // API returns groupedResults for global search
          setTextResults(data.groupedResults || []);
        }
      } else {
        // Semantic search with entity filters
        const response = await fetch("/api/search/semantic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: query.trim(),
            limit: 20,
            threshold: 0.3,
            entityTypes: selectedEntityTypes,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          setSemanticResults(data.results || []);
        }
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const formatTime = (seconds: number | null): string => {
    if (seconds === null) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const highlightMatch = (text: string, searchQuery: string): React.ReactNode => {
    if (!searchQuery.trim()) return text;

    const regex = new RegExp(`(${searchQuery.trim()})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <SearchIcon className="h-8 w-8" />
          {t("search.title")}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t("search.description")}
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2">
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="flex-1"
            disabled={isSearching}
          />
          <Button type="submit" disabled={isSearching || !query.trim()}>
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SearchIcon className="h-4 w-4" />
            )}
            <span className="ms-2 hidden sm:inline">{t("search.searchButton")}</span>
          </Button>
        </div>
      </form>

      {/* Entity Type Filters */}
      {!entitiesLoading && availableEntityTypes.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground me-1">
            {t("search.filterByEntity")}:
          </span>
          {entityTypeOrder
            .filter((type) => availableEntityTypes.includes(type))
            .map((type) => {
              const config = entityTypeConfig[type];
              const isSelected = selectedEntityTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleEntityType(type)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  {config.icon}
                  {t(config.labelKey)}
                  {isSelected && <X className="h-3 w-3 ms-0.5" />}
                </button>
              );
            })}
          {selectedEntityTypes.length > 0 && (
            <button
              type="button"
              onClick={clearEntityFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline ms-2"
            >
              {t("common.clear") || "Clear all"}
            </button>
          )}
        </div>
      )}

      {/* Search Type Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="text" className="gap-2">
            <FileText className="h-4 w-4" />
            Text Search
          </TabsTrigger>
          <TabsTrigger value="semantic" className="gap-2">
            <Brain className="h-4 w-4" />
            Semantic Search
          </TabsTrigger>
        </TabsList>

        {/* Text Search Results */}
        <TabsContent value="text">
          {!hasSearched ? (
            <div className="text-center py-12 text-muted-foreground">
              <SearchIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("search.description")}</p>
            </div>
          ) : textResults.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="font-medium">{t("search.noResults")}</p>
              <p className="text-sm mt-2">{t("search.noResultsDesc")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {textResults.reduce((acc, r) => acc + r.matches.length, 0)} {t("search.results")}
              </p>
              {textResults.map((result) => (
                <Card key={result.sessionId}>
                  <CardContent className="pt-4">
                    <Link
                      href={`/meetings/${result.sessionId}`}
                      className="font-medium hover:underline text-lg"
                    >
                      {result.sessionTitle}
                    </Link>
                    <div className="mt-3 space-y-2">
                      {result.matches.slice(0, 3).map((match, index) => (
                        <div
                          key={index}
                          className="text-sm bg-muted/50 rounded-lg p-3"
                        >
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            {match.speakerName && (
                              <>
                                <UserIcon className="h-3 w-3" />
                                <span>{match.speakerName}</span>
                              </>
                            )}
                            {match.startTime !== null && (
                              <>
                                <Clock className="h-3 w-3" />
                                <span>{formatTime(match.startTime)}</span>
                              </>
                            )}
                          </div>
                          <p className="text-foreground">
                            {highlightMatch(match.text, query)}
                          </p>
                        </div>
                      ))}
                      {result.matches.length > 3 && (
                        <p className="text-xs text-muted-foreground">
                          +{result.matches.length - 3} more matches
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Semantic Search Results */}
        <TabsContent value="semantic">
          {!hasSearched ? (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Find semantically similar content across your meetings</p>
            </div>
          ) : semanticResults.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="font-medium">{t("search.noResults")}</p>
              <p className="text-sm mt-2">{t("search.noResultsDesc")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {semanticResults.length} {t("search.results")}
              </p>
              {semanticResults.map((result) => (
                <Card key={result.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <Link
                          href={`/meetings/${result.sessionId}`}
                          className="font-medium hover:underline"
                        >
                          {result.sessionTitle}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          {result.speakerName && (
                            <>
                              <UserIcon className="h-3 w-3" />
                              <span>{result.speakerName}</span>
                            </>
                          )}
                          {result.startTime !== null && (
                            <>
                              <Clock className="h-3 w-3" />
                              <span>{formatTime(result.startTime)}</span>
                            </>
                          )}
                        </div>
                        <p className="text-sm mt-2 text-muted-foreground line-clamp-3">
                          {result.content}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {Math.round(result.similarity * 100)}% match
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
