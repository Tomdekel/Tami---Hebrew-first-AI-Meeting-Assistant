"use client"

import { useTranslations } from "next-intl"

export default function SettingsPage() {
  const t = useTranslations()

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground mb-2">{t("nav.settings")}</h1>
        <p className="text-muted-foreground">{t("common.comingSoon")}</p>
      </div>
    </div>
  )
}
