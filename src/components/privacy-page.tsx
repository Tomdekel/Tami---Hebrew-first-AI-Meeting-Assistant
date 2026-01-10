"use client"

import { useLocale } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, Lock, Server, Eye, Mic, Brain, Database, Key, CheckCircle2, Zap, Globe } from "lucide-react"

export function PrivacyPage() {
  const locale = useLocale()
  const isRTL = locale === "he"

  const securityFeatures = [
    {
      icon: Lock,
      titleHe: "הצפנה מקצה לקצה",
      titleEn: "End-to-End Encryption",
      descHe: "כל הנתונים מוצפנים בזמן העברה ובאחסון באמצעות תקני הצפנה מתקדמים (AES-256)",
      descEn: "All data encrypted in transit and at rest using advanced encryption standards (AES-256)",
    },
    {
      icon: Server,
      titleHe: "תשתית מאובטחת",
      titleEn: "Secure Infrastructure",
      descHe: "הנתונים שלך מאוחסנים ב-Supabase עם אימות OAuth מאובטח. אף צד שלישי לא יכול לגשת למידע שלך",
      descEn: "Your data is stored on Supabase with secure OAuth authentication. No third party can access your information",
    },
    {
      icon: Eye,
      titleHe: "פרטיות מוחלטת",
      titleEn: "Complete Privacy",
      descHe: "רק אתה יכול לגשת לנתונים שלך. אנחנו לא משתפים, מוכרים או משתמשים בנתונים שלך למטרות אחרות",
      descEn: "Only you can access your data. We don't share, sell, or use your data for other purposes",
    },
    {
      icon: Database,
      titleHe: "Neo4j Aura",
      titleEn: "Neo4j Aura",
      descHe: "גרף הידע שלך מאוחסן בבסיס נתונים מאובטח של Neo4j Aura עם בידוד מלא בין משתמשים",
      descEn: "Your knowledge graph is stored in a secure Neo4j Aura database with complete user isolation",
    },
    {
      icon: Key,
      titleHe: "אימות מאובטח",
      titleEn: "Secure Authentication",
      descHe: "תמיכה ב-OAuth 2.0 עם Google ואימות דו-שלבי לאבטחה מקסימלית",
      descEn: "OAuth 2.0 support with Google and two-factor authentication for maximum security",
    },
    {
      icon: Shield,
      titleHe: "תאימות GDPR",
      titleEn: "GDPR Compliant",
      descHe: "עומדים בתקני הפרטיות האירופאיים. יש לך שליטה מלאה על הנתונים שלך כולל זכות למחיקה",
      descEn: "Compliant with European privacy standards. You have full control over your data including the right to deletion",
    },
  ]

  const technologyFeatures = [
    {
      icon: Mic,
      titleHe: "מודל Ivrit מתקדם",
      titleEn: "Advanced Ivrit Model",
      descHe: "מנוע התמלול שלנו מבוסס על מודל Ivrit - מודל ה-AI המתקדם ביותר לעברית מדוברת, עם דיוק של מעל 95%",
      descEn: "Our transcription engine is based on the Ivrit model - the most advanced AI model for spoken Hebrew, with over 95% accuracy",
    },
    {
      icon: Brain,
      titleHe: "עיבוד הקשרי",
      titleEn: "Contextual Processing",
      descHe: "ארכיטקטורת עיבוד ייחודית שמשתמשת בהקשר הפגישה שאתה מזין כדי לשפר משמעותית את דיוק התמלול והזיהוי",
      descEn: "Unique processing architecture that uses the meeting context you provide to significantly improve transcription and recognition accuracy",
    },
    {
      icon: Zap,
      titleHe: "עיבוד בזמן אמת",
      titleEn: "Real-Time Processing",
      descHe: "תוצאות מופיעות תוך דקות. סיכומים, החלטות ומשימות מזוהים אוטומטית ברגע שהתמלול מוכן",
      descEn: "Results appear within minutes. Summaries, decisions, and tasks are automatically identified as soon as transcription is ready",
    },
    {
      icon: Globe,
      titleHe: "תמיכה רב-לשונית",
      titleEn: "Multilingual Support",
      descHe: "תמיכה מלאה בעברית ואנגלית, כולל פגישות מעורבות. המערכת מזהה אוטומטית מעברי שפה",
      descEn: "Full support for Hebrew and English, including mixed meetings. The system automatically detects language switches",
    },
  ]

  return (
    <div
      className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-br from-slate-50 via-white to-teal-50/30 py-8"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-600 rounded-2xl mb-4 shadow-lg shadow-teal-600/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {isRTL ? "פרטיות ואבטחה" : "Privacy & Security"}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {isRTL
              ? "המידע שלך בטוח איתנו. אנחנו משקיעים בטכנולוגיות האבטחה המתקדמות ביותר כדי להגן על הנתונים שלך."
              : "Your information is safe with us. We invest in the most advanced security technologies to protect your data."}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-10">
          <Badge variant="secondary" className="px-4 py-2 text-sm bg-green-50 text-green-700 border border-green-200">
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            {isRTL ? "אחסון מאובטח" : "Secure Storage"}
          </Badge>
          <Badge variant="secondary" className="px-4 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            {isRTL ? "הצפנת נתונים" : "Data Encryption"}
          </Badge>
          <Badge variant="secondary" className="px-4 py-2 text-sm bg-purple-50 text-purple-700 border border-purple-200">
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            {isRTL ? "תאימות GDPR" : "GDPR Compliant"}
          </Badge>
          <Badge variant="secondary" className="px-4 py-2 text-sm bg-amber-50 text-amber-700 border border-amber-200">
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            {isRTL ? "ללא גישה לצד שלישי" : "No Third Party Access"}
          </Badge>
        </div>

        <div className="mb-10">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-teal-600" />
            {isRTL ? "אבטחה ופרטיות" : "Security & Privacy"}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {securityFeatures.map((feature, index) => (
              <Card key={index} className="border-border/50 bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                      <feature.icon className="w-4 h-4 text-teal-600" />
                    </div>
                    {isRTL ? feature.titleHe : feature.titleEn}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {isRTL ? feature.descHe : feature.descEn}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-10">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-teal-600" />
            {isRTL ? "איך זה עובד" : "How It Works"}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {technologyFeatures.map((feature, index) => (
              <Card key={index} className="border-border/50 bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <feature.icon className="w-4 h-4 text-blue-600" />
                    </div>
                    {isRTL ? feature.titleHe : feature.titleEn}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {isRTL ? feature.descHe : feature.descEn}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-teal-600" />
              {isRTL ? "ארכיטקטורת עיבוד" : "Processing Architecture"}
            </CardTitle>
            <CardDescription>
              {isRTL
                ? "תהליך העיבוד המאובטח של הפגישות שלך"
                : "The secure processing flow of your meetings"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4">
              {[
                { icon: Mic, labelHe: "הקלטה", labelEn: "Recording" },
                { icon: Lock, labelHe: "העלאה מאובטחת", labelEn: "Secure Upload" },
                { icon: Brain, labelHe: "תמלול Ivrit", labelEn: "Ivrit Transcription" },
                { icon: Zap, labelHe: "עיבוד הקשרי", labelEn: "Context Processing" },
                { icon: Database, labelHe: "אחסון מוצפן", labelEn: "Encrypted Storage" },
              ].map((step, index, arr) => (
                <div key={index} className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-white border border-teal-200 flex items-center justify-center">
                    <step.icon className="w-5 h-5 text-teal-600" />
                  </div>
                  <span className="text-xs text-muted-foreground text-center">
                    {isRTL ? step.labelHe : step.labelEn}
                  </span>
                  {index < arr.length - 1 && (
                    <div className="hidden md:block w-12 h-px bg-teal-200" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
