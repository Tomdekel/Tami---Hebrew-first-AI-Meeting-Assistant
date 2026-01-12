"use client"

import { useState, useEffect, useCallback, useSyncExternalStore } from "react"

/**
 * Hook to detect media query matches
 * Uses useSyncExternalStore for proper SSR handling
 * @param query - CSS media query string (e.g., "(max-width: 1023px)")
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const matchMedia = window.matchMedia(query)
      matchMedia.addEventListener("change", callback)
      return () => matchMedia.removeEventListener("change", callback)
    },
    [query]
  )

  const getSnapshot = useCallback(() => {
    return window.matchMedia(query).matches
  }, [query])

  // For SSR, return false (desktop-first approach)
  const getServerSnapshot = useCallback(() => {
    return false
  }, [])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * Hook to detect mobile viewport (below lg breakpoint)
 * Mobile: < 1024px
 * Desktop: >= 1024px
 */
export function useMobile(): boolean {
  return useMediaQuery("(max-width: 1023px)")
}

/**
 * Hook to detect tablet viewport
 * Tablet: 768px - 1023px
 */
export function useTablet(): boolean {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023px)")
}
