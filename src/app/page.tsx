import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageToggle } from "@/components/language-toggle";
import { Mic, Upload, MessageSquare, FileText } from "lucide-react";

export default function Home() {
  const t = useTranslations();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <h1 className="text-2xl font-bold">Tami</h1>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <Button>{t("auth.signIn")}</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Meeting Intelligence
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Hebrew-first meeting transcription, summarization, and AI-powered analysis.
            Record, upload, and get insights from your meetings.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" className="gap-2" asChild>
              <Link href="/meetings/new">
                <Mic className="h-5 w-5" />
                {t("recording.start")}
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="gap-2" asChild>
              <Link href="/meetings/new?tab=upload">
                <Upload className="h-5 w-5" />
                {t("upload.title")}
              </Link>
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="mx-auto mt-24 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <Mic className="h-10 w-10 text-primary" />
              <CardTitle className="mt-4">{t("recording.microphone")}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                {t("recording.microphoneDesc")}
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Upload className="h-10 w-10 text-primary" />
              <CardTitle className="mt-4">{t("recording.systemAudio")}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                {t("recording.systemAudioDesc")}
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <FileText className="h-10 w-10 text-primary" />
              <CardTitle className="mt-4">{t("meeting.transcript")}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Automatic transcription with speaker detection in Hebrew and English.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <MessageSquare className="h-10 w-10 text-primary" />
              <CardTitle className="mt-4">{t("meeting.questions")}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Ask questions about your meetings and get AI-powered answers.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Tami - Meeting Intelligence Platform
        </div>
      </footer>
    </div>
  );
}
