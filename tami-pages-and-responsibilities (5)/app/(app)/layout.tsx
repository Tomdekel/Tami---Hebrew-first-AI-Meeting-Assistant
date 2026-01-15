import type React from "react"
import { AppShell } from "@/components/app-shell"
import { LanguageProvider } from "@/contexts/language-context"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <LanguageProvider>
      <AppShell>{children}</AppShell>
    </LanguageProvider>
  )
}
