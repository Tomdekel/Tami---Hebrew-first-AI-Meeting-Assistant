import { useTranslations } from "next-intl";
import { LanguageToggle } from "@/components/language-toggle";
import { UserMenu } from "@/components/user-menu";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/meetings" className="text-2xl font-bold">
              תמי
            </Link>
            <nav className="hidden md:flex items-center gap-4">
              <Link
                href="/meetings"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("nav.meetings")}
              </Link>
              <Link
                href="/memory"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("nav.memory")}
              </Link>
              <Link
                href="/search"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("nav.search")}
              </Link>
              <Link
                href="/entities"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("nav.entities")}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild size="sm">
              <Link href="/meetings/new" className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{t("nav.newMeeting")}</span>
              </Link>
            </Button>
            <LanguageToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog />
    </div>
  );
}
