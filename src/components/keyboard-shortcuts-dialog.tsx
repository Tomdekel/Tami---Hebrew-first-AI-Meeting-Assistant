"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

export function KeyboardShortcutsDialog() {
  const t = useTranslations();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const shortcutGroups: ShortcutGroup[] = [
    {
      title: t("shortcuts.navigation") || "Navigation",
      shortcuts: [
        { keys: ["N"], description: t("shortcuts.newMeeting") || "New meeting" },
        { keys: ["M"], description: t("shortcuts.goToMeetings") || "Go to meetings" },
        { keys: ["/"], description: t("shortcuts.focusSearch") || "Focus search" },
        { keys: ["?"], description: t("shortcuts.showShortcuts") || "Show shortcuts" },
      ],
    },
    {
      title: t("shortcuts.audioPlayer") || "Audio Player",
      shortcuts: [
        { keys: ["Space"], description: t("shortcuts.playPause") || "Play / Pause" },
        { keys: ["J"], description: t("shortcuts.rewind") || "Rewind 10 seconds" },
        { keys: ["L"], description: t("shortcuts.forward") || "Forward 10 seconds" },
        { keys: ["←"], description: t("shortcuts.rewind5") || "Rewind 5 seconds" },
        { keys: ["→"], description: t("shortcuts.forward5") || "Forward 5 seconds" },
      ],
    },
    {
      title: t("shortcuts.panels") || "Panels",
      shortcuts: [
        { keys: ["1"], description: t("shortcuts.toggleSummary") || "Toggle summary" },
        { keys: ["2"], description: t("shortcuts.toggleSpeakers") || "Toggle speakers" },
        { keys: ["3"], description: t("shortcuts.toggleEntities") || "Toggle entities" },
        { keys: ["4"], description: t("shortcuts.toggleChat") || "Toggle chat" },
      ],
    },
  ];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger if user is typing in an input
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    // Show shortcuts dialog on ? key
    if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
      e.preventDefault();
      setIsOpen(true);
      return;
    }

    // Escape closes the dialog
    if (e.key === "Escape" && isOpen) {
      setIsOpen(false);
      return;
    }

    // Navigation shortcuts (only when dialog is closed)
    if (!isOpen) {
      switch (e.key.toLowerCase()) {
        case "n":
          e.preventDefault();
          router.push("/meetings/new");
          break;
        case "m":
          e.preventDefault();
          router.push("/meetings");
          break;
        case "/":
          e.preventDefault();
          // Try to focus the search input on the search page or navigate to it
          const searchInput = document.querySelector('input[type="search"], input[placeholder*="חפש"], input[placeholder*="Search"]') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
          } else {
            router.push("/search");
          }
          break;
      }
    }
  }, [isOpen, router]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            {t("shortcuts.title") || "Keyboard Shortcuts"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                {group.title}
              </h4>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <kbd
                          key={i}
                          className="px-2 py-1 text-xs font-medium bg-muted border rounded"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {t("shortcuts.hint") || "Press ? anytime to show this dialog"}
        </p>
      </DialogContent>
    </Dialog>
  );
}
