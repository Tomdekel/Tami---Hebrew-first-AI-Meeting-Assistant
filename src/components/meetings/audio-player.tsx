"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Gauge } from "lucide-react"

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const SKIP_SECONDS = 15

interface AudioPlayerProps {
  src: string
}

export function AudioPlayer({ src }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  const formatTime = useCallback((seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
      return "--:--"
    }
    const minutes = Math.floor(seconds / 60)
    const remaining = Math.floor(seconds % 60)
    return `${minutes}:${remaining.toString().padStart(2, "0")}`
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoaded = () => {
      if (isFinite(audio.duration)) {
        setDuration(audio.duration)
      }
    }
    const handleDurationChange = () => {
      // WebM files from browser MediaRecorder update duration as they buffer
      if (isFinite(audio.duration)) {
        setDuration(audio.duration)
      }
    }
    const handleTime = () => setCurrentTime(audio.currentTime)
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    audio.addEventListener("loadedmetadata", handleLoaded)
    audio.addEventListener("durationchange", handleDurationChange)
    audio.addEventListener("timeupdate", handleTime)
    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoaded)
      audio.removeEventListener("durationchange", handleDurationChange)
      audio.removeEventListener("timeupdate", handleTime)
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
    }
  }, [])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed
    }
  }, [playbackSpeed])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100
    }
  }, [volume, isMuted])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
  }

  const seek = (value: number[]) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = value[0]
    setCurrentTime(value[0])
  }

  useEffect(() => {
    const seekTo = (time: number) => {
      const audio = audioRef.current
      if (!audio) return
      audio.currentTime = time
      setCurrentTime(time)
    }

    ;(window as unknown as { meetingAudioSeekTo?: (time: number) => void }).meetingAudioSeekTo = seekTo

    return () => {
      delete (window as unknown as { meetingAudioSeekTo?: (time: number) => void }).meetingAudioSeekTo
    }
  }, [])

  const skipBackward = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, audio.currentTime - SKIP_SECONDS)
  }

  const skipForward = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.min(duration, audio.currentTime + SKIP_SECONDS)
  }

  return (
    <div className="bg-white px-2 md:px-4 py-2">
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={skipBackward} title="15 seconds back">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button onClick={togglePlay} className="h-10 w-10 rounded-full bg-teal-600 hover:bg-teal-700 p-0">
            {isPlaying ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white mr-[-2px]" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={skipForward} title="15 seconds forward">
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>

        <span className="text-sm text-muted-foreground font-mono w-12" dir="ltr">
          {formatTime(duration)}
        </span>

        <div className="flex-1" dir="ltr">
          <Slider value={[currentTime]} max={duration || 1} step={1} onValueChange={seek} className="cursor-pointer" />
        </div>

        <span className="text-sm text-muted-foreground font-mono w-12" dir="ltr">
          {formatTime(currentTime)}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
              <Gauge className="h-4 w-4" />
              <span className="text-xs font-mono">{playbackSpeed}x</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SPEEDS.map((speed) => (
              <DropdownMenuItem
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={playbackSpeed === speed ? "bg-teal-50 text-teal-700" : ""}
              >
                {speed}x
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2" dir="ltr">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setIsMuted(!isMuted)}>
            {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            max={100}
            step={1}
            onValueChange={(value) => {
              setVolume(value[0])
              setIsMuted(false)
            }}
            className="w-20 cursor-pointer"
          />
        </div>
      </div>
    </div>
  )
}
