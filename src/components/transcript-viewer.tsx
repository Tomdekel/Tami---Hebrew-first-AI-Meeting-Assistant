"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface TranscriptSegment {
  speakerId: string;
  speakerName: string;
  text: string;
  startTime: number;
  endTime: number;
  segmentOrder: number;
}

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  currentTime?: number;
  onSegmentClick?: (segment: TranscriptSegment) => void;
  className?: string;
}

// Speaker colors for visual distinction
const SPEAKER_COLORS = [
  "border-l-blue-500",
  "border-l-green-500",
  "border-l-purple-500",
  "border-l-orange-500",
  "border-l-pink-500",
  "border-l-cyan-500",
  "border-l-yellow-500",
  "border-l-red-500",
];

const SPEAKER_BG_COLORS = [
  "bg-blue-50 dark:bg-blue-950/30",
  "bg-green-50 dark:bg-green-950/30",
  "bg-purple-50 dark:bg-purple-950/30",
  "bg-orange-50 dark:bg-orange-950/30",
  "bg-pink-50 dark:bg-pink-950/30",
  "bg-cyan-50 dark:bg-cyan-950/30",
  "bg-yellow-50 dark:bg-yellow-950/30",
  "bg-red-50 dark:bg-red-950/30",
];

export function TranscriptViewer({
  segments,
  currentTime = 0,
  onSegmentClick,
  className,
}: TranscriptViewerProps) {
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Build speaker color map
  const speakerColorMap = useCallback(() => {
    const map = new Map<string, number>();
    let colorIndex = 0;
    segments.forEach((seg) => {
      if (!map.has(seg.speakerId)) {
        map.set(seg.speakerId, colorIndex % SPEAKER_COLORS.length);
        colorIndex++;
      }
    });
    return map;
  }, [segments]);

  const colorMap = speakerColorMap();

  // Update active segment based on current time
  useEffect(() => {
    if (currentTime === undefined || currentTime < 0) return;

    const activeIndex = segments.findIndex(
      (seg) => currentTime >= seg.startTime && currentTime < seg.endTime
    );

    if (activeIndex !== activeSegmentIndex) {
      setActiveSegmentIndex(activeIndex);

      // Auto-scroll to active segment
      if (activeIndex >= 0 && segmentRefs.current[activeIndex]) {
        segmentRefs.current[activeIndex]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [currentTime, segments, activeSegmentIndex]);

  const handleSegmentClick = useCallback(
    (segment: TranscriptSegment) => {
      // Try to use the global seekTo function
      const seekFn = (window as unknown as { audioPlayerSeekTo?: (time: number) => void }).audioPlayerSeekTo;
      if (seekFn) {
        seekFn(segment.startTime);
      }
      onSegmentClick?.(segment);
    },
    [onSegmentClick]
  );

  const formatTime = useCallback((seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  // Group consecutive segments by speaker
  const groupedSegments = segments.reduce<
    Array<{ speakerId: string; speakerName: string; segments: TranscriptSegment[] }>
  >((groups, segment) => {
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.speakerId === segment.speakerId) {
      lastGroup.segments.push(segment);
    } else {
      groups.push({
        speakerId: segment.speakerId,
        speakerName: segment.speakerName,
        segments: [segment],
      });
    }

    return groups;
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("space-y-4 max-h-[600px] overflow-y-auto", className)}
    >
      {groupedSegments.map((group, groupIndex) => {
        const colorIndex = colorMap.get(group.speakerId) ?? 0;
        const borderColor = SPEAKER_COLORS[colorIndex];
        const bgColor = SPEAKER_BG_COLORS[colorIndex];

        return (
          <div
            key={`${group.speakerId}-${groupIndex}`}
            className={cn(
              "border-l-4 rounded-r-lg p-3 transition-colors",
              borderColor,
              bgColor
            )}
          >
            {/* Speaker Name */}
            <div className="font-medium text-sm mb-2">{group.speakerName}</div>

            {/* Segments */}
            <div className="space-y-2">
              {group.segments.map((segment, segIndex) => {
                const flatIndex = segments.findIndex(
                  (s) => s.segmentOrder === segment.segmentOrder
                );
                const isActive = flatIndex === activeSegmentIndex;

                return (
                  <div
                    key={segment.segmentOrder}
                    ref={(el) => {
                      segmentRefs.current[flatIndex] = el;
                    }}
                    onClick={() => handleSegmentClick(segment)}
                    className={cn(
                      "p-2 rounded cursor-pointer transition-all text-sm",
                      "hover:bg-accent/50",
                      isActive && "bg-primary/10 ring-2 ring-primary/30"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "text-xs text-muted-foreground shrink-0 font-mono mt-0.5",
                          isActive && "text-primary font-medium"
                        )}
                      >
                        {formatTime(segment.startTime)}
                      </span>
                      <p className="flex-1 leading-relaxed">{segment.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {segments.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          No transcript available
        </div>
      )}
    </div>
  );
}
