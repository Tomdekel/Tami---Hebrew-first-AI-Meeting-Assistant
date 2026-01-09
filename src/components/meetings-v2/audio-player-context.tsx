"use client"

import { createContext, useContext, useRef, useCallback, type ReactNode } from "react"

interface AudioPlayerContextValue {
  seekTo: (time: number) => void
  registerSeekHandler: (handler: (time: number) => void) => void
  unregisterSeekHandler: () => void
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null)

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const seekHandlerRef = useRef<((time: number) => void) | null>(null)

  const registerSeekHandler = useCallback((handler: (time: number) => void) => {
    seekHandlerRef.current = handler
  }, [])

  const unregisterSeekHandler = useCallback(() => {
    seekHandlerRef.current = null
  }, [])

  const seekTo = useCallback((time: number) => {
    if (seekHandlerRef.current) {
      seekHandlerRef.current(time)
    }
  }, [])

  return (
    <AudioPlayerContext.Provider
      value={{
        seekTo,
        registerSeekHandler,
        unregisterSeekHandler,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  )
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext)
  if (!context) {
    throw new Error("useAudioPlayer must be used within AudioPlayerProvider")
  }
  return context
}

// Optional hook that doesn't throw if context is missing (for components that may be outside provider)
export function useAudioPlayerOptional() {
  return useContext(AudioPlayerContext)
}
