import { LanguageToggle } from "@/components/language-toggle";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/meetings" className="text-2xl font-bold">
              Tami
            </Link>
            <nav className="hidden md:flex items-center gap-4">
              <Link
                href="/meetings"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Meetings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Button asChild size="sm">
              <Link href="/meetings/new" className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Meeting</span>
              </Link>
            </Button>
            <LanguageToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
