"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Brain, Calendar, Search, Users, Plus, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/language-context"
import { useState } from "react"
import { UserMenu } from "@/components/user-menu"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const { isRTL, t } = useLanguage()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navigation = [
    { name: t("meetings"), href: "/meetings", icon: Calendar },
    { name: t("memory"), href: "/memory", icon: Search },
    { name: t("entities"), href: "/entities", icon: Users },
  ]

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="flex h-14 items-center px-4 gap-2 md:gap-4">
          {/* Mobile Menu Button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side={isRTL ? "right" : "left"} className="w-72 p-0">
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 bg-teal-600 rounded-lg">
                      <Brain className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-semibold text-lg text-foreground">Tami</span>
                  </div>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                  {navigation.map((item) => {
                    const isActive = pathname.startsWith(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-colors",
                          isActive
                            ? "bg-teal-50 text-teal-700"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted",
                        )}
                      >
                        <item.icon className="w-5 h-5" />
                        <span>{item.name}</span>
                      </Link>
                    )
                  })}
                </nav>
                <div className="p-4 border-t border-border">
                  <Button asChild className="w-full bg-teal-600 hover:bg-teal-700 text-white gap-2">
                    <Link href="/meetings/new" onClick={() => setMobileMenuOpen(false)}>
                      <Plus className="w-4 h-4" />
                      <span>{t("newMeeting")}</span>
                    </Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link href="/meetings" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-teal-600 rounded-lg">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg text-foreground hidden sm:inline">Tami</span>
          </Link>

          {/* Main Navigation - Hidden on Mobile */}
          <nav className="hidden md:flex items-center gap-1 mx-4">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href)
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
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* New Meeting Button - Hidden on Mobile (shown in sheet) */}
          <Button asChild className="hidden md:flex bg-teal-600 hover:bg-teal-700 text-white gap-2">
            <Link href="/meetings/new">
              <Plus className="w-4 h-4" />
              <span>{t("newMeeting")}</span>
            </Link>
          </Button>

          {/* Mobile New Meeting Icon Button */}
          <Button asChild size="icon" className="md:hidden bg-teal-600 hover:bg-teal-700 text-white">
            <Link href="/meetings/new">
              <Plus className="w-5 h-5" />
            </Link>
          </Button>

          {/* User Menu */}
          <UserMenu />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>
    </div>
  )
}
