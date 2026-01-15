"use client"

import { useTranslations } from "next-intl"
import { IntegrationsSettings } from "@/components/settings/integrations-settings"

export default function SettingsPage() {
  const t = useTranslations("settings")

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="container max-w-3xl py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        </div>

        <IntegrationsSettings />
      </div>
    </div>
  )
}
