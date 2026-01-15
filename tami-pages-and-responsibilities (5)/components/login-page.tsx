"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Brain, Mail, Eye, EyeOff, Lock, Mic, Shield, MessageSquare } from "lucide-react"

export function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [language, setLanguage] = useState<"he" | "en">("he")
  const [showLogin, setShowLogin] = useState(false)

  const content = {
    he: {
      heroHeadline: "הזיכרון שלך לכל שיחה.",
      heroSubheadline: "תמי מקליטה שיחות והופכת אותן לידע מובנה וחיפושי לאורך זמן.",
      heroSupport: "לא רק תמלילים. לא רק סיכומים.",
      startRecording: "התחל להקליט",
      noBots: "ללא בוטים. ללא הגדרות.",
      // Problem section
      problemHeadline: "שיחות נעלמות. החלטות לא.",
      problemBody: "פגישות קורות. החלטות מתקבלות. ואז ההקשר נעלם.",
      // Difference section
      differenceHeadline: "תמי היא מערכת זיכרון.",
      differenceBody1: "הזיכרון מצטבר",
      differenceBody2: "הידע מתעצם",
      differenceBody3: "התשובות מבוססות על מה שנאמר בפועל",
      differenceKey: "אתה לא גoller קבצים. אתה שואל שאלות.",
      // Fit section
      fitDiscreet: "דיסקרטי",
      fitDiscreetDesc: "ללא בוטים. ללא אורחים לפגישה.",
      fitFlexible: "גמיש",
      fitFlexibleDesc: "הקלט כפי שאתה כבר נפגש.",
      fitLanguage: "שפה",
      fitLanguageDesc: "עברית ואנגלית, כולל שיחות מעורבות.",
      // How section
      howHeadline: "איך זה עובד",
      how1: "הקלט שיחה",
      how2: "תמי מבנה את מה שנאמר",
      how3: "הזיכרון שלך גדל ונשאר חיפושי",
      // Trust section
      trustHeadline: "שליטה מלאה",
      trust1: "אתה יכול לבדוק ולערוך הכל",
      trust2: "שום דבר לא מוסתר",
      trust3: "שום דבר לא נעול",
      // CTA
      ctaHeadline: "אם שיחות חשובות, זיכרון חשוב.",
      ctaButton: "נסה את תמי",
      ctaSubtext: "התחל עם שיחה אחת.",
      // Login
      loginHeadline: "התחברות",
      emailLabel: "כתובת אימייל",
      emailPlaceholder: "yourname@company.com",
      passwordLabel: "סיסמה",
      passwordPlaceholder: "הזן סיסמה",
      login: "התחבר",
      orContinueWith: "או המשך עם",
      continueWithGoogle: "המשך עם Google",
      noAccount: "אין לך חשבון?",
      signUp: "הרשמה",
      enterDemo: "כניסה לדמו",
      back: "חזרה",
    },
    en: {
      heroHeadline: "Your memory for every conversation.",
      heroSubheadline: "Tami captures conversations and turns them into structured, searchable memory over time.",
      heroSupport: "Not just transcripts. Not just summaries.",
      startRecording: "Start Recording",
      noBots: "No bots. No setup.",
      problemHeadline: "Conversations disappear. Decisions don't.",
      problemBody: "Meetings happen. Decisions are made. Then context fades.",
      differenceHeadline: "Tami is a memory system.",
      differenceBody1: "Memory accumulates",
      differenceBody2: "Knowledge compounds",
      differenceBody3: "Answers are grounded in what was actually said",
      differenceKey: "You don't scroll through files. You ask questions.",
      fitDiscreet: "Discreet",
      fitDiscreetDesc: "No bots. No meeting guests.",
      fitFlexible: "Flexible",
      fitFlexibleDesc: "Record however you already meet.",
      fitLanguage: "Language",
      fitLanguageDesc: "Supports Hebrew and English, including mixed conversations.",
      howHeadline: "How it works",
      how1: "Capture a conversation",
      how2: "Tami structures what was said",
      how3: "Your memory grows and stays searchable",
      trustHeadline: "Full Control",
      trust1: "You can review and edit everything",
      trust2: "Nothing is hidden",
      trust3: "Nothing is locked",
      ctaHeadline: "If conversations matter, memory matters.",
      ctaButton: "Try Tami",
      ctaSubtext: "Start with one conversation.",
      loginHeadline: "Login",
      emailLabel: "Email address",
      emailPlaceholder: "yourname@company.com",
      passwordLabel: "Password",
      passwordPlaceholder: "Enter password",
      login: "Login",
      orContinueWith: "or continue with",
      continueWithGoogle: "Continue with Google",
      noAccount: "Don't have an account?",
      signUp: "Sign up",
      enterDemo: "Enter Demo",
      back: "Back",
    },
  }

  const t = content[language]
  const isRTL = language === "he"

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
  }

  // Login modal/page - responsive
  if (showLogin) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50 flex items-center justify-center p-4"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="absolute top-4 left-4">
          <div className="flex items-center justify-center w-16 h-16 bg-white/80 backdrop-blur-sm rounded-full p-1 shadow-sm border border-gray-200">
            <button
              onClick={() => setLanguage("he")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                language === "he" ? "bg-teal-600 text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              עב
            </button>
            <button
              onClick={() => setLanguage("en")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                language === "en" ? "bg-teal-600 text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              EN
            </button>
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-600 rounded-2xl mb-4 shadow-lg shadow-teal-600/20">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Tami</h1>
            <p className="text-lg text-teal-700 font-medium">{t.loginHeadline}</p>
          </div>

          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 font-medium text-base border-gray-200 bg-white hover:bg-gray-50"
                >
                  <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24">
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
                  {t.continueWithGoogle}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white/80 px-2 text-gray-500">{t.orContinueWith}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{t.emailLabel}</label>
                  <div className="relative">
                    <Mail
                      className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 ${isRTL ? "right-3" : "left-3"}`}
                    />
                    <Input
                      type="email"
                      placeholder={t.emailPlaceholder}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`h-12 ${isRTL ? "pr-10 text-right" : "pl-10"} bg-white border-gray-200`}
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{t.passwordLabel}</label>
                  <div className="relative">
                    <Lock
                      className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 ${isRTL ? "right-3" : "left-3"}`}
                    />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={t.passwordPlaceholder}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`h-12 ${isRTL ? "pr-10 pl-10 text-right" : "pl-10 pr-10"} bg-white border-gray-200`}
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 ${isRTL ? "left-3" : "right-3"}`}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-medium text-base"
                >
                  {t.login}
                </Button>

                <div className="text-center text-sm text-gray-600">
                  {t.noAccount}{" "}
                  <button type="button" className="text-teal-600 hover:text-teal-700 font-medium">
                    {t.signUp}
                  </button>
                </div>

                <div className="pt-2 space-y-2">
                  <Button
                    asChild
                    variant="outline"
                    className="w-full sm:w-auto h-12 font-medium text-base border-teal-200 text-teal-700 hover:bg-teal-50 bg-transparent"
                  >
                    <Link href="/meetings">{t.enterDemo}</Link>
                  </Button>
                  <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setShowLogin(false)}>
                    {t.back}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white" dir={isRTL ? "rtl" : "ltr"}>
      {/* Nav - responsive */}
      <header className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg">Tami</span>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
              <button
                onClick={() => setLanguage("he")}
                className={`px-2 md:px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  language === "he" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
                }`}
              >
                עב
              </button>
              <button
                onClick={() => setLanguage("en")}
                className={`px-2 md:px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  language === "en" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
                }`}
              >
                EN
              </button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowLogin(true)} className="hidden sm:flex">
              {t.login}
            </Button>
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-xs md:text-sm"
              onClick={() => setShowLogin(true)}
            >
              <span className="hidden sm:inline">{t.startRecording}</span>
              <Mic className="w-4 h-4 sm:hidden" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero - responsive */}
      <section className="pt-24 md:pt-32 pb-12 md:pb-20 px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 md:mb-6 leading-tight text-balance">
            {t.heroHeadline}
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-2 md:mb-3 text-pretty">{t.heroSubheadline}</p>
          <p className="text-xs md:text-sm text-gray-500 mb-6 md:mb-8">{t.heroSupport}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white px-8 h-12 text-base"
              onClick={() => setShowLogin(true)}
            >
              <Mic className={`w-5 h-5 ${isRTL ? "ml-2" : "mr-2"}`} />
              {t.startRecording}
            </Button>
            <p className="text-sm text-gray-500">{t.noBots}</p>
          </div>
        </div>
      </section>

      {/* Problem - responsive */}
      <section className="py-12 md:py-20 px-4 md:px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-3 md:mb-4">{t.problemHeadline}</h2>
          <p className="text-base md:text-lg text-gray-600">{t.problemBody}</p>
        </div>
      </section>

      {/* Difference - responsive */}
      <section className="py-12 md:py-20 px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-6 md:mb-8">
            {t.differenceHeadline}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
            <div className="p-4 md:p-6 rounded-xl bg-teal-50 border border-teal-100">
              <p className="font-medium text-teal-900 text-sm md:text-base">{t.differenceBody1}</p>
            </div>
            <div className="p-4 md:p-6 rounded-xl bg-teal-50 border border-teal-100">
              <p className="font-medium text-teal-900 text-sm md:text-base">{t.differenceBody2}</p>
            </div>
            <div className="p-4 md:p-6 rounded-xl bg-teal-50 border border-teal-100">
              <p className="font-medium text-teal-900 text-sm md:text-base">{t.differenceBody3}</p>
            </div>
          </div>
          <p className="text-base md:text-lg text-gray-700 font-medium">{t.differenceKey}</p>
        </div>
      </section>

      {/* Fit */}
      <section className="py-12 md:py-20 px-4 md:px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 text-center">
            <div>
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-gray-700" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{t.fitDiscreet}</h3>
              <p className="text-sm md:text-base text-gray-600">{t.fitDiscreetDesc}</p>
            </div>
            <div>
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center mx-auto mb-4">
                <Mic className="w-6 h-6 text-gray-700" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{t.fitFlexible}</h3>
              <p className="text-sm md:text-base text-gray-600">{t.fitFlexibleDesc}</p>
            </div>
            <div>
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-6 h-6 text-gray-700" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{t.fitLanguage}</h3>
              <p className="text-sm md:text-base text-gray-600">{t.fitLanguageDesc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* How */}
      <section className="py-12 md:py-20 px-4 md:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6 md:mb-8">{t.howHeadline}</h2>
          <div className="space-y-4">
            <p className="text-gray-700">
              <span className="text-teal-600 font-semibold">1.</span> {t.how1}
            </p>
            <p className="text-gray-700">
              <span className="text-teal-600 font-semibold">2.</span> {t.how2}
            </p>
            <p className="text-gray-700">
              <span className="text-teal-600 font-semibold">3.</span> {t.how3}
            </p>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-12 md:py-20 px-4 md:px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6 md:mb-8">{t.trustHeadline}</h2>
          <div className="space-y-2 text-gray-600">
            <p>{t.trust1}</p>
            <p>{t.trust2}</p>
            <p>{t.trust3}</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6 md:mb-8">{t.ctaHeadline}</h2>
          <Button
            size="lg"
            className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white px-8 h-12 text-base"
            onClick={() => setShowLogin(true)}
          >
            {t.ctaButton}
          </Button>
          <p className="text-sm md:text-base text-gray-500 mt-4 md:mt-6">{t.ctaSubtext}</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 md:px-6 border-t border-gray-100">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-teal-600 rounded flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm md:text-base text-gray-600">Tami</span>
          </div>
          <p className="text-xs md:text-sm text-gray-500">© 2026</p>
        </div>
      </footer>
    </div>
  )
}
