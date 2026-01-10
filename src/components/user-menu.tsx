"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { User, LogOut, Loader2, ChevronDown, Settings, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export function UserMenu() {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const isRTL = locale === "he";
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success(t("auth.signedOutSuccess"));
      router.push("/");
      router.refresh();
    } catch (error) {
      toast.error(t("auth.signOutFailed"));
    } finally {
      setIsSigningOut(false);
    }
  };

  if (isLoading) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (!user) {
    return (
      <Button variant="outline" size="sm" onClick={() => router.push("/login")}>
        {t("auth.signIn")}
      </Button>
    );
  }

  const initials = user.email
    ? user.email
        .split("@")[0]
        .slice(0, 2)
        .toUpperCase()
    : "U";

  const avatarUrl = user.user_metadata?.avatar_url;

  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2">
          <Avatar className="h-8 w-8">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={user.email || "User"} />}
            <AvatarFallback className="bg-teal-100 text-teal-700 text-sm">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium hidden sm:inline-block">{displayName}</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align={isRTL ? "start" : "end"} forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.user_metadata?.full_name || user.email?.split("@")[0]}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/profile")}>
          <User className={isRTL ? "ml-2 h-4 w-4" : "mr-2 h-4 w-4"} />
          <span>{t("auth.profile")}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className={isRTL ? "ml-2 h-4 w-4" : "mr-2 h-4 w-4"} />
          <span>{t("nav.settings")}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/privacy")}>
          <Shield className={isRTL ? "ml-2 h-4 w-4" : "mr-2 h-4 w-4"} />
          <span>{t("nav.privacy")}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
          {isSigningOut ? (
            <Loader2 className={isRTL ? "ml-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4 animate-spin"} />
          ) : (
            <LogOut className={isRTL ? "ml-2 h-4 w-4" : "mr-2 h-4 w-4"} />
          )}
          <span>{t("auth.signOut")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
