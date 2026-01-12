"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Gauge } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAudioPlayerOptional } from "./audio-player-context"

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const SKIP_SECONDS = 15

interface AudioPlayerProps {
  src: string
  className?: string
  onTimeUpdate?: (currentTime: number) => void
}

export function AudioPlayer({ src, className, onTimeUpdate }: AudioPlayerProps) {
  const t = useTranslations()
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioPlayerContext = useAudioPlayerOptional()
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const formatTime = useCallback((seconds: number): string => {
    if (isNaN(seconds) || !isFinite(seconds)) return "0:00"
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    }
    return `${m}:${s.toString().padStart(2, "0")}`
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration)
        setIsLoaded(true)
      }
    }

    const handleDurationChange = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration)
        setIsLoaded(true)
      }
    }

    const handleCanPlay = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration)
        setIsLoaded(true)
      }
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      onTimeUpdate?.(audio.currentTime)
    }

    const handleEnded = () => setIsPlaying(false)
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    audio.addEventListener("loadedmetadata", handleLoadedMetadata)
    audio.addEventListener("durationchange", handleDurationChange)
    audio.addEventListener("canplay", handleCanPlay)
    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("ended", handleEnded)
    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)

    // Check if already loaded (for cached audio)
    if (audio.readyState >= 1 && audio.duration && isFinite(audio.duration)) {
      setDuration(audio.duration)
      setIsLoaded(true)
    }

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
      audio.removeEventListener("durationchange", handleDurationChange)
      audio.removeEventListener("canplay", handleCanPlay)
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
    }
  }, [onTimeUpdate])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed
    }
  }, [playbackSpeed])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
  }, [isPlaying])

  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current
    if (!audio) return

    const newTime = value[0]
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }, [])

  const skipBackward = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, audio.currentTime - SKIP_SECONDS)
  }, [])

  const skipForward = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.min(audio.duration, audio.currentTime + SKIP_SECONDS)
  }, [])

  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = time
    setCurrentTime(time)
  }, [])

  // Register seekTo method with context for transcript sync
  useEffect(() => {
    if (audioPlayerContext) {
      audioPlayerContext.registerSeekHandler(seekTo)
      return () => {
        audioPlayerContext.unregisterSeekHandler()
      }
    }
  }, [seekTo, audioPlayerContext])

  return (
    <div className={cn(
      "border-b border-border bg-white px-4 py-3 lg:px-6",
      // Sticky on mobile, relative on desktop
      "sticky bottom-0 lg:relative z-10",
      className
    )}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center gap-2 lg:gap-4">
        {/* Playback Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-11 w-11 lg:h-8 lg:w-8 p-0"
            onClick={skipBackward}
            disabled={!isLoaded}
            aria-label={t("audio.skipBack15")}
          >
            <RotateCcw className="h-5 w-5 lg:h-4 lg:w-4" />
          </Button>
          <Button
            onClick={togglePlay}
            className="h-12 w-12 lg:h-10 lg:w-10 rounded-full bg-teal-600 hover:bg-teal-700 p-0"
            disabled={!isLoaded}
            aria-label={isPlaying ? t("audio.pause") : t("audio.play")}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 lg:h-4 lg:w-4 text-white" />
            ) : (
              <Play className="h-5 w-5 lg:h-4 lg:w-4 text-white me-[-2px]" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-11 w-11 lg:h-8 lg:w-8 p-0"
            onClick={skipForward}
            disabled={!isLoaded}
            aria-label={t("audio.skipForward15")}
          >
            <RotateCw className="h-5 w-5 lg:h-4 lg:w-4" />
          </Button>
        </div>

        {/* Duration (total time) - hidden on mobile to save space */}
        <span className="hidden lg:inline text-sm text-muted-foreground font-mono w-12" dir="ltr" aria-label={t("audio.duration")}>
          {formatTime(duration)}
        </span>

        {/* Progress Bar */}
        <div className="flex-1 min-w-0" dir="ltr">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            disabled={!isLoaded}
            className="cursor-pointer"
            aria-label={t("audio.progress")}
          />
        </div>

        {/* Current Time / Duration on mobile, just Current Time on desktop */}
        <span className="text-xs lg:text-sm text-muted-foreground font-mono whitespace-nowrap" dir="ltr" aria-label={t("audio.currentTime")}>
          <span>{formatTime(currentTime)}</span>
          <span className="lg:hidden">/{formatTime(duration)}</span>
        </span>

        {/* Speed Control */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-11 min-w-11 lg:h-8 lg:min-w-0 gap-1 px-2"
              aria-label={t("audio.playbackSpeed", { speed: playbackSpeed })}
            >
              <Gauge className="h-5 w-5 lg:h-4 lg:w-4" />
              <span className="text-xs font-mono">{playbackSpeed}x</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {PLAYBACK_SPEEDS.map((speed) => (
              <DropdownMenuItem
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={cn(
                  "min-h-11 lg:min-h-0",
                  playbackSpeed === speed ? "bg-teal-50 text-teal-700" : ""
                )}
              >
                {speed}x
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Volume - hidden on mobile (use device controls instead) */}
        <div className="hidden lg:flex items-center gap-2" dir="ltr">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setIsMuted(!isMuted)}
            aria-label={isMuted ? t("audio.unmute") : t("audio.mute")}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume * 100]}
            max={100}
            step={1}
            onValueChange={(value) => {
              setVolume(value[0] / 100)
              setIsMuted(false)
            }}
            className="w-20 cursor-pointer"
            aria-label={t("audio.volume")}
          />
        </div>
      </div>
    </div>
  )
}
