"use client";

import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const locale = useLocale();

  const toggleLocale = () => {
    const newLocale = locale === "he" ? "en" : "he";
    // Set cookie for locale preference
    document.cookie = `locale=${newLocale};path=/;max-age=31536000`;
    // Full page reload to apply new locale (router.refresh() doesn't work with next-intl)
    window.location.reload();
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
