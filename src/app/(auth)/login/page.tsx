"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import { Loader2, Mail, Eye, EyeOff, Lock, Brain } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const t = useTranslations()
  const currentLocale = useLocale()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [language, setLanguage] = useState<"he" | "en">(currentLocale as "he" | "en")

  const isRTL = language === "he"

  const features = language === "he"
    ? ["תמלול אוטומטי בעברית ואנגלית", "סיכומים, החלטות ומשימות בלחיצה", "חיפוש חכם על פני כל הפגישות"]
    : ["Automatic transcription in Hebrew & English", "Summaries, decisions & tasks in one click", "Smart search across all meetings"]

  const content = {
    he: {
      tagline: "הזיכרון הארגוני שלך",
      subtitle: "תמי מקליטה, מתמללת ומפיקה תובנות מכל פגישה. כדי שתוכלו להתמקד במה שחשוב.",
    },
    en: {
      tagline: "Your Organizational Memory",
      subtitle: "Tami records, transcribes, and extracts insights from every meeting. So you can focus on what matters.",
    },
  }

  const localContent = content[language]

  const handleLanguageChange = (newLang: "he" | "en") => {
    setLanguage(newLang)
    document.cookie = `locale=${newLang}; path=/; max-age=${60 * 60 * 24 * 365}`
    router.refresh()
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      toast.success(t("auth.signInSuccess"))
      router.push("/meetings")
      router.refresh()
    } catch (error) {
      toast.error(t("auth.signInFailed"), {
        description: error instanceof Error ? error.message : t("auth.invalidCredentials"),
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        throw error
      }
    } catch (error) {
      toast.error(t("auth.googleSignInFailed"), {
        description: error instanceof Error ? error.message : t("auth.unknownError"),
      })
      setIsGoogleLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 flex items-center justify-center p-4"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Language Toggle */}
      <div className="absolute top-4 left-4">
        <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm rounded-full p-1 shadow-sm border border-gray-200">
          <button
            type="button"
            onClick={() => handleLanguageChange("he")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
              language === "he" ? "bg-teal-600 text-white" : "text-gray-600 hover:text-gray-900"
            }`}
            aria-label="עברית"
          >
            עב
          </button>
          <button
            type="button"
            onClick={() => handleLanguageChange("en")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
              language === "en" ? "bg-teal-600 text-white" : "text-gray-600 hover:text-gray-900"
            }`}
            aria-label="English"
          >
            EN
          </button>
        </div>
      </div>

      <div className="w-full max-w-md">
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-600 rounded-2xl mb-4 shadow-lg shadow-teal-600/20">
            <Brain className="w-8 h-8 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("brand")}</h1>
          <p className="text-lg text-teal-700 font-medium">{localContent.tagline}</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <CardDescription className="text-gray-600 text-base leading-relaxed">
              {localContent.subtitle}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailLogin} className="space-y-4">
              {/* Google OAuth */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 font-medium text-base border-gray-200 bg-white hover:bg-gray-50"
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading}
              >
                {isGoogleLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <svg className="w-5 h-5 ms-2" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                {t("auth.google")}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white/80 px-2 text-gray-500">{t("auth.orContinueWith")}</span>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  {t("auth.email")}
                </Label>
                <div className="relative">
                  <Mail
                    className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 ${isRTL ? "right-3" : "left-3"}`}
                    aria-hidden="true"
                  />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className={`h-12 ${isRTL ? "pr-10" : "pl-10"} bg-white border-gray-200 focus:border-teal-500 focus:ring-teal-500`}
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    {t("auth.password")}
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    {t("auth.forgotPassword")}
                  </Link>
                </div>
                <div className="relative">
                  <Lock
                    className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 ${isRTL ? "right-3" : "left-3"}`}
                    aria-hidden="true"
                  />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className={`h-12 ${isRTL ? "pr-10 pl-10" : "pl-10 pr-10"} bg-white border-gray-200 focus:border-teal-500 focus:ring-teal-500`}
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500 rounded ${isRTL ? "left-3" : "right-3"}`}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" aria-hidden="true" />
                    ) : (
                      <Eye className="w-5 h-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-medium text-base shadow-lg shadow-teal-600/20"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : null}
                {t("auth.signIn")}
              </Button>

              {/* Sign Up Link */}
              <div className="text-center text-sm text-gray-600">
                {t("auth.noAccount")}{" "}
                <Link href="/signup" className="text-teal-600 hover:text-teal-700 font-medium">
                  {t("auth.signUp")}
                </Link>
              </div>

            </form>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="mt-8 space-y-3">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-3 text-gray-600">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" aria-hidden="true" />
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
