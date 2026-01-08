"use client";

import { useCallback, useEffect, useState, useRef, useMemo } from "react";
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

// Timestamp interval in seconds (show timestamp markers every 30 seconds)
const TIMESTAMP_INTERVAL = 30;

// Subtle speaker colors with tinted backgrounds
const SPEAKER_STYLES = [
  { border: "border-l-blue-500/60", bg: "bg-blue-500/5 dark:bg-blue-500/10" },
  { border: "border-l-emerald-500/60", bg: "bg-emerald-500/5 dark:bg-emerald-500/10" },
  { border: "border-l-violet-500/60", bg: "bg-violet-500/5 dark:bg-violet-500/10" },
  { border: "border-l-amber-500/60", bg: "bg-amber-500/5 dark:bg-amber-500/10" },
  { border: "border-l-rose-500/60", bg: "bg-rose-500/5 dark:bg-rose-500/10" },
  { border: "border-l-cyan-500/60", bg: "bg-cyan-500/5 dark:bg-cyan-500/10" },
  { border: "border-l-orange-500/60", bg: "bg-orange-500/5 dark:bg-orange-500/10" },
  { border: "border-l-pink-500/60", bg: "bg-pink-500/5 dark:bg-pink-500/10" },
];

interface TimestampedParagraph {
  timestamp: number;
  endTime: number;
  text: string;
  startSegmentIndex: number;
  endSegmentIndex: number;
}

export function TranscriptViewer({
  segments,
  currentTime = 0,
  onSegmentClick,
  className,
}: TranscriptViewerProps) {
  const [activeParagraphKey, setActiveParagraphKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const paragraphRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Detect RTL content (Hebrew)
  const isRTL = useMemo(() => {
    const fullText = segments.map((s) => s.text).join("");
    const hebrewPattern = /[\u0590-\u05FF]/g;
    const hebrewChars = (fullText.match(hebrewPattern) || []).length;
    return hebrewChars > fullText.length * 0.3;
  }, [segments]);

  // Build speaker color map
  const speakerStyleMap = useMemo(() => {
    const map = new Map<string, number>();
    let styleIndex = 0;
    segments.forEach((seg) => {
      if (!map.has(seg.speakerId)) {
        map.set(seg.speakerId, styleIndex % SPEAKER_STYLES.length);
        styleIndex++;
      }
    });
    return map;
  }, [segments]);

  // Group consecutive segments by speaker
  const groupedSegments = useMemo(() => {
    return segments.reduce<
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
  }, [segments]);

  // Build paragraphs from segments within each group (merge by time intervals)
  const buildParagraphs = useCallback(
    (groupSegments: TranscriptSegment[]): TimestampedParagraph[] => {
      const paragraphs: TimestampedParagraph[] = [];
      let currentParagraph: TimestampedParagraph | null = null;

      groupSegments.forEach((seg) => {
        const globalIdx = segments.findIndex((s) => s.segmentOrder === seg.segmentOrder);

        if (
          !currentParagraph ||
          seg.startTime - currentParagraph.timestamp >= TIMESTAMP_INTERVAL
        ) {
          // Start new paragraph
          if (currentParagraph) paragraphs.push(currentParagraph);
          currentParagraph = {
            timestamp: seg.startTime,
            endTime: seg.endTime,
            text: seg.text,
            startSegmentIndex: globalIdx,
            endSegmentIndex: globalIdx,
          };
        } else {
          // Append to current paragraph
          currentParagraph.text += " " + seg.text;
          currentParagraph.endTime = seg.endTime;
          currentParagraph.endSegmentIndex = globalIdx;
        }
      });

      if (currentParagraph) paragraphs.push(currentParagraph);
      return paragraphs;
    },
    [segments]
  );

  // Update active paragraph based on current time
  useEffect(() => {
    if (currentTime === undefined || currentTime < 0) return;

    // Find the active paragraph by checking all groups
    let foundKey: string | null = null;

    groupedSegments.forEach((group, groupIndex) => {
      const paragraphs = buildParagraphs(group.segments);
      paragraphs.forEach((para, paraIndex) => {
        if (currentTime >= para.timestamp && currentTime < para.endTime) {
          foundKey = `${group.speakerId}-${groupIndex}-${paraIndex}`;
        }
      });
    });

    if (foundKey !== activeParagraphKey) {
      setActiveParagraphKey(foundKey);

      // Auto-scroll to active paragraph
      if (foundKey && paragraphRefs.current.get(foundKey)) {
        paragraphRefs.current.get(foundKey)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [currentTime, groupedSegments, buildParagraphs, activeParagraphKey]);

  const handleParagraphClick = useCallback(
    (para: TimestampedParagraph) => {
      // Try to use the global seekTo function
      const seekFn = (window as unknown as { audioPlayerSeekTo?: (time: number) => void })
        .audioPlayerSeekTo;
      if (seekFn) {
        seekFn(para.timestamp);
      }
      // Also call the segment click handler with the first segment
      if (onSegmentClick && para.startSegmentIndex >= 0) {
        const segment = segments[para.startSegmentIndex];
        if (segment) onSegmentClick(segment);
      }
    },
    [onSegmentClick, segments]
  );

  const formatTime = useCallback((seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  return (
    <div
      ref={containerRef}
      dir={isRTL ? "rtl" : "ltr"}
      className={cn("space-y-4 max-h-[600px] overflow-y-auto", className)}
    >
      {groupedSegments.map((group, groupIndex) => {
        const styleIndex = speakerStyleMap.get(group.speakerId) ?? 0;
        const style = SPEAKER_STYLES[styleIndex];
        const paragraphs = buildParagraphs(group.segments);

        return (
          <div
            key={`${group.speakerId}-${groupIndex}`}
            className={cn(
              "border-l-4 rounded-lg p-4 transition-colors",
              style.border,
              style.bg
            )}
          >
            {/* Speaker Name */}
            <div className="font-medium text-sm mb-3 text-muted-foreground">
              {group.speakerName}
            </div>

            {/* Paragraphs */}
            <div className="space-y-4">
              {paragraphs.map((para, paraIndex) => {
                const paraKey = `${group.speakerId}-${groupIndex}-${paraIndex}`;
                const isActive = paraKey === activeParagraphKey;

                return (
                  <div
                    key={paraKey}
                    ref={(el) => {
                      paragraphRefs.current.set(paraKey, el);
                    }}
                    onClick={() => handleParagraphClick(para)}
                    className={cn(
                      "cursor-pointer transition-all rounded-md p-2 -mx-2",
                      "hover:bg-foreground/5",
                      isActive && "bg-primary/10 ring-1 ring-primary/30"
                    )}
                  >
                    {/* Timestamp */}
                    <div
                      className={cn(
                        "text-xs text-muted-foreground font-mono mb-1",
                        isActive && "text-primary font-medium"
                      )}
                    >
                      {formatTime(para.timestamp)}
                    </div>

                    {/* Merged text */}
                    <p className="leading-relaxed text-foreground">{para.text}</p>
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
