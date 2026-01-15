"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Gauge } from "lucide-react"

export function AudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(48)
  const [duration] = useState(270)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const skipBackward = () => {
    setCurrentTime((prev) => Math.max(0, prev - 15))
  }

  const skipForward = () => {
    setCurrentTime((prev) => Math.min(duration, prev + 15))
  }

  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2]

  return (
    <div className="border-b border-border bg-white px-6 py-3">
      <div className="flex items-center gap-4">
        {/* Playback Controls */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={skipBackward} title="15 שניות אחורה">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setIsPlaying(!isPlaying)}
            className="h-10 w-10 rounded-full bg-teal-600 hover:bg-teal-700 p-0"
          >
            {isPlaying ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white mr-[-2px]" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={skipForward} title="15 שניות קדימה">
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Duration (total time on the left in RTL) */}
        <span className="text-sm text-muted-foreground font-mono w-12" dir="ltr">
          {formatTime(duration)}
        </span>

        {/* Progress Bar */}
        <div className="flex-1" dir="ltr">
          <Slider
            value={[currentTime]}
            max={duration}
            step={1}
            onValueChange={(value) => setCurrentTime(value[0])}
            className="cursor-pointer"
          />
        </div>

        {/* Current Time (on the right in RTL, showing progress from 0:00) */}
        <span className="text-sm text-muted-foreground font-mono w-12" dir="ltr">
          {formatTime(currentTime)}
        </span>
        {/* </CHANGE> */}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
              <Gauge className="h-4 w-4" />
              <span className="text-xs font-mono">{playbackSpeed}x</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {speedOptions.map((speed) => (
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

        {/* Volume */}
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
