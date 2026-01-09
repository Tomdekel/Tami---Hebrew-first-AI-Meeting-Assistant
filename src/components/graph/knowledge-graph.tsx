"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Loader2 } from "lucide-react";

// Dynamically import ForceGraph2D to avoid SSR issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  mention_count?: number;
  x?: number;
  y?: number;
  [key: string]: unknown;
}

export interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  [key: string]: unknown;
}

interface KnowledgeGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (node: GraphNode) => void;
  selectedNodeId?: string;
  height?: number;
}

const TYPE_COLORS: Record<string, string> = {
  Person: "#3B82F6", // blue
  Organization: "#8B5CF6", // purple
  Project: "#F97316", // orange
  Topic: "#10B981", // green
  Technology: "#06B6D4", // cyan
  Product: "#EC4899", // pink
  Location: "#EAB308", // yellow
  Date: "#F59E0B", // amber
  Meeting: "#6B7280", // gray
  ActionItem: "#22C55E", // green
  Decision: "#F59E0B", // amber
  Other: "#9CA3AF", // gray
};

const TYPE_LABELS_HE: Record<string, string> = {
  Person: "אנשים",
  Organization: "ארגונים",
  Project: "פרויקטים",
  Topic: "נושאים",
  Technology: "טכנולוגיות",
  Product: "מוצרים",
  Location: "מיקומים",
  Date: "תאריכים",
  Meeting: "פגישות",
  ActionItem: "משימות",
  Decision: "החלטות",
  Other: "אחר",
};

function getNodeColor(node: GraphNode, selectedNodeId?: string): string {
  if (node.id === selectedNodeId) return "#FFFFFF";
  const type = node.type?.charAt(0).toUpperCase() + node.type?.slice(1);
  return TYPE_COLORS[type] || TYPE_COLORS.Other;
}

function getNodeSize(node: GraphNode): number {
  const base = 6;
  const count = node.mention_count || 1;
  return base + Math.log(count + 1) * 2;
}

export function KnowledgeGraph({
  nodes,
  edges,
  onNodeClick,
  selectedNodeId,
  height = 600,
}: KnowledgeGraphProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [dimensions, setDimensions] = useState({ width: 800, height });

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [height]);

  const nodeColor = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any) => getNodeColor(node as GraphNode, selectedNodeId),
    [selectedNodeId]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeSize = useCallback((node: any) => getNodeSize(node as GraphNode), []);

  const handleNodeClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any) => {
      onNodeClick?.(node as GraphNode);
    },
    [onNodeClick]
  );

  const drawNodeLabel = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const graphNode = node as GraphNode;
      const label = graphNode.label;
      const fontSize = Math.min(12 / globalScale, 14);

      // Don't render label if too zoomed out
      if (fontSize < 3) return;

      ctx.font = `${fontSize}px Sans-Serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = theme === "dark" ? "#F3F4F6" : "#1F2937";

      // Draw label below node
      const yOffset = getNodeSize(graphNode) + fontSize + 2;
      ctx.fillText(label, node.x || 0, (node.y || 0) + yOffset);
    },
    [theme]
  );

  const handleEngineStop = useCallback(() => {
    // Center the graph after it settles
    if (graphRef.current) {
      graphRef.current.zoomToFit(400);
    }
  }, []);

  // Get unique types for legend
  const uniqueTypes = Array.from(new Set(nodes.map((n) => n.type))).filter(
    Boolean
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full border rounded-lg overflow-hidden bg-background"
      style={{ height }}
    >
      {nodes.length > 0 ? (
        <ForceGraph2D
          ref={graphRef}
          graphData={{ nodes, links: edges }}
          width={dimensions.width}
          height={dimensions.height}
          nodeLabel="label"
          nodeColor={nodeColor}
          nodeVal={nodeSize}
          linkColor={() => (theme === "dark" ? "#4B5563" : "#D1D5DB")}
          linkWidth={1}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={1}
          onNodeClick={handleNodeClick}
          nodeCanvasObjectMode={() => "after"}
          nodeCanvasObject={drawNodeLabel}
          cooldownTicks={100}
          onEngineStop={handleEngineStop}
        />
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          אין נתונים להצגה
        </div>
      )}

      {/* Legend */}
      {uniqueTypes.length > 0 && (
        <div className="absolute bottom-4 start-4 bg-background/90 backdrop-blur-sm p-3 rounded-lg border shadow-sm">
          <div className="text-xs text-muted-foreground mb-2 font-medium">
            סוגים
          </div>
          <div className="flex flex-wrap gap-2 max-w-[200px]">
            {uniqueTypes.slice(0, 8).map((type) => {
              const capitalType = type.charAt(0).toUpperCase() + type.slice(1);
              return (
                <div key={type} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        TYPE_COLORS[capitalType] || TYPE_COLORS.Other,
                    }}
                  />
                  <span className="text-xs">
                    {TYPE_LABELS_HE[capitalType] || type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Controls hint */}
      <div className="absolute bottom-4 end-4 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
        גרור להזיז • גלול לזום
      </div>
    </div>
  );
}

export default KnowledgeGraph;
