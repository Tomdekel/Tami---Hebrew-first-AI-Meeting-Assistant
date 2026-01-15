'use client'

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function MeetingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Audio player skeleton */}
      <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-2 w-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded" />
      </div>

      {/* Summary and cards grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Summary card */}
        <Card>
          <CardContent className="p-4 md:p-6 space-y-3">
            <Skeleton className="h-5 w-24 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>

        {/* Decisions card */}
        <Card>
          <CardContent className="p-4 md:p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-10 w-full rounded" />
              <Skeleton className="h-10 w-full rounded" />
            </div>
          </CardContent>
        </Card>

        {/* Action items card */}
        <Card>
          <CardContent className="p-4 md:p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded" />
              <Skeleton className="h-16 w-full rounded" />
            </div>
          </CardContent>
        </Card>

        {/* Transcript card - spans 2 columns */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4 md:p-6 space-y-4">
            {/* Search bar skeleton */}
            <Skeleton className="h-8 w-full max-w-xs" />
            {/* Transcript items skeleton */}
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
