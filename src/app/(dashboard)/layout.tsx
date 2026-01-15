"use client"

import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog"
import { QueryProvider } from "@/components/providers/query-provider"
import { LanguageProvider } from "@/contexts/language-context"
import { AppShell } from "@/components/app-shell"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <LanguageProvider>
        <AppShell>{children}</AppShell>
        <KeyboardShortcutsDialog />
      </LanguageProvider>
    </QueryProvider>
  );
}
