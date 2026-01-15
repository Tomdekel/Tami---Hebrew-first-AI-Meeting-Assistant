"use client"

import { useEffect, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ConnectionStatus {
  provider: "google" | "outlook"
  connected: boolean
  connectedAt: string | null
  expiresAt: string | null
  expired: boolean
}

interface IntegrationsResponse {
  connections: ConnectionStatus[]
  error?: string
}

export function IntegrationsSettings() {
  const t = useTranslations("settings.integrations")
  const [connections, setConnections] = useState<ConnectionStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/status")
      if (res.ok) {
        const data: IntegrationsResponse = await res.json()
        setConnections(data.connections || [])
      }
    } catch {
      // Silently fail - user not logged in or API error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleConnect = async (provider: "google" | "outlook") => {
    setActionLoading(provider)
    try {
      const res = await fetch(`/api/integrations/${provider}/connect`)
      if (res.ok) {
        const data = await res.json()
        if (data.authUrl) {
          window.location.href = data.authUrl
        }
      }
    } catch {
      // Handle error
    } finally {
      setActionLoading(null)
    }
  }

  const handleDisconnect = async (provider: "google" | "outlook") => {
    setActionLoading(`disconnect-${provider}`)
    try {
      const res = await fetch(`/api/integrations/${provider}/disconnect`, {
        method: "POST",
      })
      if (res.ok) {
        await fetchStatus()
      }
    } catch {
      // Handle error
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return ""
    return new Date(dateStr).toLocaleDateString()
  }

  const getStatusBadge = (conn: ConnectionStatus) => {
    if (conn.expired) {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          {t("expired")}
        </span>
      )
    }
    if (conn.connected) {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          {t("connected")}
        </span>
      )
    }
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
        {t("notConnected")}
      </span>
    )
  }

  const providers: Array<{ key: "google" | "outlook"; icon: React.ReactNode }> = [
    {
      key: "google",
      icon: (
        <svg className="size-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      ),
    },
    {
      key: "outlook",
      icon: (
        <svg className="size-5" viewBox="0 0 24 24">
          <path
            fill="#0078D4"
            d="M24 7.387v10.478c0 .23-.08.424-.238.576-.158.152-.352.229-.582.229h-8.36v-6.744l1.983 1.463 1.166.93c.14.103.31.155.51.155a.73.73 0 0 0 .51-.155l.007-.006 1.16-.925 1.983-1.463V5.66h-.002c0-.128-.024-.24-.072-.34a.555.555 0 0 0-.233-.243l-2.839-1.633-2.173-1.253v4.127l2.832 2.136-.833.623a.3.3 0 0 1-.177.055.3.3 0 0 1-.177-.055l-2.832-2.136V.232c.002-.077.025-.144.069-.2a.24.24 0 0 1 .17-.089h8.285c.23 0 .424.076.582.229.158.152.238.345.238.576v1.174h.003V7.387zM8.878 6.142c.878 0 1.587.353 2.126 1.059.539.706.809 1.59.809 2.652 0 1.144-.284 2.072-.851 2.786-.568.713-1.293 1.07-2.178 1.07-.894 0-1.607-.345-2.137-1.035-.531-.69-.796-1.59-.796-2.703 0-1.123.275-2.028.826-2.715.551-.688 1.28-1.031 2.188-1.031l.013-.083zm-.117 1.455c-.358 0-.648.22-.87.66-.221.44-.332 1.01-.332 1.714 0 .756.107 1.352.322 1.787.214.435.499.653.853.653.353 0 .64-.211.858-.633.219-.423.328-.997.328-1.723 0-.753-.106-1.338-.318-1.756-.213-.418-.495-.627-.848-.627l.007-.075zM0 4.54v14.91c0 .105.04.195.12.27.08.075.175.113.285.113h8.878V4.167H.405c-.11 0-.205.038-.285.113-.08.076-.12.165-.12.27v-.01z"
          />
        </svg>
      ),
    },
  ]

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-lg border animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="size-5 bg-muted rounded" />
                  <div className="h-4 w-32 bg-muted rounded" />
                </div>
                <div className="h-9 w-24 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {providers.map(({ key, icon }) => {
            const conn = connections.find((c) => c.provider === key) || {
              provider: key,
              connected: false,
              connectedAt: null,
              expiresAt: null,
              expired: false,
            }
            const isConnectLoading = actionLoading === key
            const isDisconnectLoading = actionLoading === `disconnect-${key}`

            return (
              <div
                key={key}
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border",
                  conn.connected && !conn.expired && "border-green-200 dark:border-green-900/50",
                  conn.expired && "border-amber-200 dark:border-amber-900/50"
                )}
              >
                <div className="flex items-center gap-3">
                  {icon}
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {t(key)}
                      {getStatusBadge(conn)}
                    </div>
                    {conn.connected && conn.connectedAt && (
                      <p className="text-xs text-muted-foreground">
                        {t("lastConnected", { date: formatDate(conn.connectedAt) })}
                      </p>
                    )}
                  </div>
                </div>

                {conn.connected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnect(key)}
                    disabled={isDisconnectLoading}
                  >
                    {isDisconnectLoading ? t("disconnecting") : t("disconnect")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleConnect(key)}
                    disabled={isConnectLoading}
                  >
                    {isConnectLoading ? t("connectingTo", { provider: t(key) }) : t("connect")}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
