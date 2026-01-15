"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import {
  Search,
  Send,
  Bot,
  ExternalLink,
  Sparkles,
  MessageSquare,
  Plus,
  MoreHorizontal,
  Trash2,
  Quote,
  AlertCircle,
  PanelLeft,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { useLanguage } from "@/contexts/language-context"
import { cn } from "@/lib/utils"

interface MemoryThread {
  id: string
  title: string
  lastMessage: string
  timestamp: string
  messageCount: number
}

interface Citation {
  id: string
  quote: string
  speaker?: string
  meetingTitle: string
  meetingId: string
  timestamp: string
  deepLink: string
}

interface ChatMessage {
  id: string
  type: "user" | "ai"
  content: string
  timestamp: string
  exactMentions?: Citation[]
  aiAnswer?: {
    text: string
    citations: { text: string; citationIds: string[] }[]
  }
  noEvidence?: boolean
}

const sampleThreads: MemoryThread[] = [
  { id: "1", title: "פרויקט פניקס - סטטוס", lastMessage: "מה הוחלט לגבי...", timestamp: "היום", messageCount: 5 },
  { id: "2", title: "תמחור Q4", lastMessage: "מה המחירים שהוזכרו?", timestamp: "אתמול", messageCount: 3 },
  { id: "3", title: "פגישות עם TechCorp", lastMessage: "סכם את כל הפגישות...", timestamp: "3 ימים", messageCount: 8 },
]

const suggestedQueries = [
  { type: "lookup", text: "pricing", labelHe: "תמחור", labelEn: "pricing" },
  { type: "lookup", text: "John said", labelHe: "מה אמר דני?", labelEn: "John said" },
  {
    type: "question",
    text: "What did we decide about pricing?",
    labelHe: "מה הוחלט על התמחור?",
    labelEn: "What did we decide about pricing?",
  },
  {
    type: "question",
    text: "Why was the launch postponed?",
    labelHe: "למה ההשקה נדחתה?",
    labelEn: "Why was the launch postponed?",
  },
]

export function MemoryPage() {
  const { isRTL } = useLanguage()
  const [threads, setThreads] = useState(sampleThreads)
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)

  const handleSend = (query: string) => {
    if (!query.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsSearching(true)

    setTimeout(() => {
      const isLookup = query.length < 20 || !query.includes("?")

      const exactMentions: Citation[] = [
        {
          id: "c1",
          quote: "המחיר החדש יהיה 50 דולר לחודש למשתמש",
          speaker: "דני כהן",
          meetingTitle: "סיכום פגישת פיתוח Q4",
          meetingId: "1",
          timestamp: "00:15:30",
          deepLink: "/meetings/1?t=930&seg=seg_15",
        },
        {
          id: "c2",
          quote: "נדון בתמחור שוב בפגישה הבאה עם כל הנתונים",
          speaker: "מיכל לוי",
          meetingTitle: "תכנון ספרינט 12",
          meetingId: "2",
          timestamp: "00:22:45",
          deepLink: "/meetings/2?t=1365&seg=seg_22",
        },
      ]

      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: "",
        timestamp: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }),
        exactMentions,
        aiAnswer: !isLookup
          ? {
              text: "על פי הפגישות שלך, הוחלט לתמחר את המוצר ב-50 דולר לחודש למשתמש. ההחלטה התקבלה בפגישה מיום 7 בינואר, אך צוין שיתכנו שינויים לאחר בחינת נתונים נוספים.",
              citations: [
                { text: "הוחלט לתמחר את המוצר ב-50 דולר לחודש למשתמש", citationIds: ["c1"] },
                { text: "יתכנו שינויים לאחר בחינת נתונים נוספים", citationIds: ["c2"] },
              ],
            }
          : undefined,
      }

      setMessages((prev) => [...prev, aiResponse])
      setIsSearching(false)
    }, 1500)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSend(input)
  }

  const handleNewThread = () => {
    setSelectedThread(null)
    setMessages([])
  }

  const handleDeleteThread = (id: string) => {
    setThreads((prev) => prev.filter((t) => t.id !== id))
    if (selectedThread === id) {
      setSelectedThread(null)
      setMessages([])
    }
  }

  const SidebarContent = () => (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border">
        <Button onClick={handleNewThread} className="w-full bg-teal-600 hover:bg-teal-700">
          <Plus className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
          {isRTL ? "שיחה חדשה" : "New Chat"}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {threads.map((thread) => (
            <div
              key={thread.id}
              className={cn(
                "group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors",
                selectedThread === thread.id ? "bg-teal-50 border border-teal-200" : "hover:bg-muted",
              )}
              onClick={() => {
                setSelectedThread(thread.id)
                setShowMobileSidebar(false)
              }}
            >
              <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{thread.title}</p>
                <p className="text-xs text-muted-foreground truncate">{thread.lastMessage}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteThread(thread.id)
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    {isRTL ? "מחק" : "Delete"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )

  return (
    <div className="flex h-[calc(100vh-3.5rem)]" dir={isRTL ? "rtl" : "ltr"}>
      {/* Mobile Sidebar Sheet */}
      <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
        <SheetContent side={isRTL ? "right" : "left"} className="w-72 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar - Hidden on Mobile */}
      <div className="hidden md:block w-64 flex-shrink-0 border-l border-border bg-sidebar">
        <SidebarContent />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header with sidebar toggle */}
        <div className="md:hidden flex items-center gap-2 p-3 border-b border-border bg-white">
          <Button variant="ghost" size="sm" onClick={() => setShowMobileSidebar(true)}>
            <PanelLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium">
            {selectedThread ? threads.find((t) => t.id === selectedThread)?.title : isRTL ? "שיחה חדשה" : "New Chat"}
          </span>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4 md:p-6">
          <div className="max-w-3xl mx-auto">
            {messages.length === 0 ? (
              <div className="text-center py-8 md:py-16">
                <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 bg-teal-100 rounded-2xl mb-4">
                  <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-teal-600" />
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground mb-2">
                  {isRTL ? "הזיכרון הארגוני שלך" : "Your Organizational Memory"}
                </h1>
                <p className="text-sm md:text-base text-muted-foreground mb-6 md:mb-8 px-4">
                  {isRTL
                    ? "חפש מידע או שאל שאלה - כל תשובה מגובה בראיות מהפגישות שלך"
                    : "Search for info or ask a question - every answer is backed by evidence from your meetings"}
                </p>

                {/* Responsive grid for suggestions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 max-w-lg mx-auto px-4">
                  {suggestedQueries.map((q, index) => (
                    <button
                      key={index}
                      onClick={() => handleSend(isRTL ? q.labelHe : q.labelEn)}
                      className={cn(
                        "p-3 md:p-4 text-right rounded-lg border transition-colors",
                        q.type === "lookup"
                          ? "bg-white border-border hover:border-blue-300 hover:bg-blue-50/50"
                          : "bg-white border-border hover:border-teal-300 hover:bg-teal-50/50",
                      )}
                    >
                      <Badge
                        variant="secondary"
                        className={cn(
                          "mb-2 text-xs",
                          q.type === "lookup" ? "bg-blue-100 text-blue-700" : "bg-teal-100 text-teal-700",
                        )}
                      >
                        {q.type === "lookup" ? (isRTL ? "חיפוש" : "Lookup") : isRTL ? "שאלה" : "Question"}
                      </Badge>
                      <p className="text-xs md:text-sm text-foreground">{isRTL ? q.labelHe : q.labelEn}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 md:space-y-6">
                {messages.map((message) => (
                  <div key={message.id} className="space-y-3">
                    {/* User message */}
                    {message.type === "user" && (
                      <div className={cn("flex gap-3", isRTL ? "flex-row" : "flex-row-reverse")}>
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarFallback className="bg-gray-100">דכ</AvatarFallback>
                        </Avatar>
                        <div className={cn("max-w-[85%]", isRTL ? "text-right" : "text-left")}>
                          <div className="rounded-xl px-4 py-3 bg-teal-600 text-white">
                            <p className="text-sm leading-relaxed">{message.content}</p>
                          </div>
                          <span className="text-xs text-muted-foreground mt-1 block">{message.timestamp}</span>
                        </div>
                      </div>
                    )}

                    {/* AI Response with evidence-first structure */}
                    {message.type === "ai" && (
                      <div className={cn("flex gap-3", isRTL ? "flex-row" : "flex-row-reverse")}>
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarFallback className="bg-teal-100 text-teal-700">
                            <Bot className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 max-w-[85%] space-y-3">
                          {message.exactMentions && message.exactMentions.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Quote className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-700">
                                  {isRTL ? "אזכורים מדויקים" : "Exact Mentions"}
                                </span>
                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                  {message.exactMentions.length}
                                </Badge>
                              </div>
                              {message.exactMentions.map((citation) => (
                                <Card
                                  key={citation.id}
                                  className="bg-blue-50/50 border-blue-100 hover:border-blue-300 transition-colors"
                                >
                                  <CardContent className="p-3">
                                    <p className="text-sm text-foreground mb-2 font-medium">"{citation.quote}"</p>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        {citation.speaker && <span>— {citation.speaker}</span>}
                                        <span>·</span>
                                        <span>{citation.meetingTitle}</span>
                                        <span>·</span>
                                        <span dir="ltr">{citation.timestamp}</span>
                                      </div>
                                      <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                                        <Link href={citation.deepLink}>
                                          <ExternalLink className="w-3 h-3 mr-1" />
                                          {isRTL ? "פתח בפגישה" : "Open in meeting"}
                                        </Link>
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}

                          {message.aiAnswer && (
                            <div className="bg-white border border-border rounded-xl p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-4 h-4 text-teal-600" />
                                <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                                  {isRTL ? "תשובה מבוססת AI" : "AI-Generated Answer"}
                                </span>
                              </div>
                              <p className="text-sm text-foreground leading-relaxed">{message.aiAnswer.text}</p>
                            </div>
                          )}

                          {message.noEvidence && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-600" />
                                <span className="text-sm text-amber-800">
                                  {isRTL
                                    ? "לא נמצאו ראיות רלוונטיות בפגישות שלך"
                                    : "No relevant evidence found in your meetings"}
                                </span>
                              </div>
                            </div>
                          )}

                          <span className="text-xs text-muted-foreground block">{message.timestamp}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area - Touch-friendly */}
        <div className="border-t border-border p-3 md:p-4 bg-white">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="relative">
              <Search
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground",
                  isRTL ? "right-3 md:right-4" : "left-3 md:left-4",
                )}
              />
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isRTL ? "חפש או שאל שאלה..." : "Search or ask a question..."}
                className={cn(
                  "h-11 md:h-12 text-base bg-muted/50 border-border",
                  isRTL ? "pr-10 md:pr-12 pl-12 md:pl-14" : "pl-10 md:pl-12 pr-12 md:pr-14",
                )}
              />
              <Button
                type="submit"
                size="icon"
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 bg-teal-600 hover:bg-teal-700 h-8 w-8",
                  isRTL ? "left-1.5 md:left-2" : "right-1.5 md:right-2",
                )}
                disabled={isSearching}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center hidden sm:block">
              {isRTL
                ? "כל תשובה מגובה בציטוטים מדויקים מהפגישות שלך"
                : "Every answer is backed by exact quotes from your meetings"}
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
