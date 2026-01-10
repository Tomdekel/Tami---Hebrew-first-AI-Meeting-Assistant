"use client"

import { useTranslations, useLocale } from "next-intl"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Brain, Calendar, Search, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog"
import { UserMenu } from "@/components/user-menu"
import { cn } from "@/lib/utils"

const navigation = [
  { nameKey: "nav.meetings", href: "/meetings", icon: Calendar },
  { nameKey: "nav.memory", href: "/memory", icon: Search },
  { nameKey: "nav.entities", href: "/entities", icon: Users },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const isRTL = locale === "he"

  const handleLanguageChange = (nextLocale: "he" | "en") => {
    document.cookie = `locale=${nextLocale};path=/;max-age=31536000`
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="flex h-14 items-center px-4 gap-4">
          {/* Logo */}
          <Link href="/meetings" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-teal-600 rounded-lg">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg text-foreground">Tami</span>
          </Link>

          {/* Main Navigation */}
          <nav className="hidden md:flex items-center gap-1 mx-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-teal-50 text-teal-700"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{t(item.nameKey)}</span>
                </Link>
              )
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          <div className="flex items-center gap-1 bg-muted rounded-full p-1">
            <button
              onClick={() => handleLanguageChange("he")}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                locale === "he" ? "bg-teal-600 text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              עב
            </button>
            <button
              onClick={() => handleLanguageChange("en")}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                locale === "en" ? "bg-teal-600 text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              EN
            </button>
          </div>

          {/* New Meeting Button */}
          <Button asChild className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
            <Link href="/meetings/new">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t("nav.newMeeting")}</span>
            </Link>
          </Button>

          {/* User Menu */}
          <UserMenu />
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog />
    </div>
  );
}
