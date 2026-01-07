import { LanguageToggle } from "@/components/language-toggle";
import Link from "next/link";

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
          <Link href="/" className="text-2xl font-bold">
            Tami
          </Link>
          <div className="flex items-center gap-4">
            <LanguageToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
