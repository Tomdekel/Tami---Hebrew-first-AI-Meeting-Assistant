import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTranslations, getLocale } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/language-toggle";
import { Brain } from "lucide-react";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Authenticated users go straight to meetings
  if (user) {
    redirect("/meetings");
  }

  // Show minimal login page for unauthenticated users
  const t = await getTranslations();
  const locale = await getLocale();
  const isRTL = locale === "he";

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="border-b border-teal-100 bg-white/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-teal-600 rounded-lg">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg">Tami</span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <Button variant="ghost" asChild>
              <Link href="/login">{t("auth.signIn")}</Link>
            </Button>
            <Button asChild className="bg-teal-600 hover:bg-teal-700">
              <Link href="/signup">{t("auth.signUp")}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center mb-8">
            <div className="flex items-center justify-center w-20 h-20 bg-teal-600 rounded-2xl shadow-lg">
              <Brain className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-gray-900">
            {t("home.title")}
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            {isRTL
              ? "הזיכרון הארגוני שלך מפגישות – Tami"
              : "Your organizational memory from meetings – Tami"
            }
          </p>
          <p className="mt-4 text-base text-gray-500">
            {t("home.subtitle")}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" asChild className="bg-teal-600 hover:bg-teal-700 text-white px-8">
              <Link href="/signup">{t("auth.signUp")}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">{t("auth.signIn")}</Link>
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          {t("home.footer")}
        </div>
      </footer>
    </div>
  );
}
