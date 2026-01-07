"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();

  const toggleLocale = () => {
    const newLocale = locale === "he" ? "en" : "he";
    // Set cookie for locale preference
    document.cookie = `locale=${newLocale};path=/;max-age=31536000`;
    // Refresh to apply new locale
    router.refresh();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLocale}
      className="font-medium"
    >
      {locale === "he" ? "EN" : "עב"}
    </Button>
  );
}
