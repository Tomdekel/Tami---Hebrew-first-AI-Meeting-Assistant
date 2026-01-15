"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Send, Bot, ExternalLink, MessageSquare, Plus, MoreHorizontal, Trash2, Quote, AlertCircle, PanelLeft } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { cn } from "@/lib/utils"

interface MemoryChat {
  id: string
  title: string
  last_message_at: string | null
  lastMessage?: string
}

interface ExactMention {
  quoteId: string
  text: string
  speaker?: string | null
  meetingId: string
  meetingTitle: string
  meetingDate?: string
  tStart?: number | null
  tEnd?: number | null
  segmentId?: string | null
  sourceType: "meeting" | "doc"
  docId?: string | null
  page?: number | null
  chunkId?: string | null
  deepLink: string
}

interface AiAnswerParagraph {
  text: string
  citations: Array<{ quoteId?: string; chunkId?: string }>
}

interface AiAnswer {
  paragraphs: AiAnswerParagraph[]
}

interface MemoryMessage {
  id: string
  role: "user" | "assistant"
  content: string
  created_at: string
  evidence_json?: {
    exactMentions?: ExactMention[]
    aiAnswer?: AiAnswer | null
  }
}

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

function formatTimestamp(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return ""
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes}:${remaining.toString().padStart(2, "0")}`
}

export function MemoryPage() {
  const { isRTL } = useLanguage()
  const [threads, setThreads] = useState<MemoryChat[]>([])
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [messages, setMessages] = useState<MemoryMessage[]>([])
  const [input, setInput] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [isCreatingThread, setIsCreatingThread] = useState(false)

  const loadThreads = async () => {
    try {
      const response = await fetch("/api/memory/chats")
      if (!response.ok) return
      const data = await response.json()
      const chats = data.chats || []
      setThreads(chats)
      // Don't auto-select latest thread - let user start fresh or choose a thread
      if (!chats.length && !isCreatingThread) {
        setIsCreatingThread(true)
        const createResponse = await fetch("/api/memory/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: isRTL ? "שיחה חדשה" : "New Chat" }),
        })
        if (createResponse.ok) {
          const created = await createResponse.json()
          setThreads([created.chat])
          setSelectedThread(created.chat.id)
        }
        setIsCreatingThread(false)
      }
    } catch (error) {
      console.error("Failed to load memory chats:", error)
    }
  }

  const loadMessages = async (chatId: string) => {
    try {
      const response = await fetch(`/api/memory/chat?chatId=${chatId}&limit=100`)
      if (!response.ok) return
      const data = await response.json()
      setMessages((data.messages || []) as MemoryMessage[])
    } catch (error) {
      console.error("Failed to load memory messages:", error)
    }
  }

  useEffect(() => {
    loadThreads()
  }, [])

  useEffect(() => {
    if (selectedThread) {
      loadMessages(selectedThread)
    }
  }, [selectedThread])

  const handleSend = async (query: string) => {
    if (!query.trim()) return

    // Auto-create thread if none selected
    let threadId = selectedThread
    if (!threadId) {
      try {
        const response = await fetch("/api/memory/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: isRTL ? "שיחה חדשה" : "New Chat" }),
        })
        if (!response.ok) return
        const data = await response.json()
        threadId = data.chat.id
        setSelectedThread(threadId)
      } catch (error) {
        console.error("Failed to create thread:", error)
        return
      }
    }

    const userMessage: MemoryMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: query.trim(),
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsSearching(true)

    try {
      const response = await fetch("/api/memory/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: query.trim(),
          chatId: threadId,
          language: document.documentElement.lang || "he",
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to search")
      }

      const data = await response.json()
      const assistantMessage: MemoryMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.answer || "",
        created_at: new Date().toISOString(),
        evidence_json: {
          exactMentions: data.exactMentions || [],
          aiAnswer: data.aiAnswer || null,
        },
      }

      setMessages((prev) => [...prev, assistantMessage])
      loadThreads()
    } catch (error) {
      console.error("Memory search error:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    handleSend(input)
  }

  const handleNewThread = async () => {
    try {
      const response = await fetch("/api/memory/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: isRTL ? "שיחה חדשה" : "New Chat" }),
      })
      if (!response.ok) return
      const data = await response.json()
      setSelectedThread(data.chat.id)
      setMessages([])
      loadThreads()
    } catch (error) {
      console.error("Failed to create memory chat:", error)
    }
  }

  const handleDeleteThread = async (id: string) => {
    try {
      const response = await fetch(`/api/memory/chats?id=${id}`, { method: "DELETE" })
      if (!response.ok) return
      setThreads((prev) => prev.filter((thread) => thread.id !== id))
      if (selectedThread === id) {
        setSelectedThread(null)
        setMessages([])
      }
    } catch (error) {
      console.error("Failed to delete memory chat:", error)
    }
  }

  const mentionIndex = useMemo(() => {
    const index = new Map<string, number>()
    messages.forEach((message) => {
      message.evidence_json?.exactMentions?.forEach((mention, idx) => {
        if (!index.has(mention.quoteId)) {
          index.set(mention.quoteId, idx + 1)
        }
        if (mention.chunkId && !index.has(mention.chunkId)) {
          index.set(mention.chunkId, idx + 1)
        }
      })
    })
    return index
  }, [messages])

  const renderExactMentions = (mentions: ExactMention[]) => {
    if (!mentions.length) return null

    return (
      <div className="mt-2 rounded-lg border border-border bg-white p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Quote className="h-4 w-4 text-teal-600" />
          <span>{isRTL ? "מקורות" : "Sources"}</span>
        </div>
        <div className="mt-3 space-y-3">
          {mentions.map((mention) => (
            <div key={mention.quoteId} className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-sm text-foreground">{mention.text}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{mention.speaker || (isRTL ? "דובר" : "Speaker")}</span>
                <span>·</span>
                <span>{mention.meetingTitle}</span>
                {mention.tStart !== null && mention.tStart !== undefined && (
                  <>
                    <span>·</span>
                    <span dir="ltr">{formatTimestamp(mention.tStart)}</span>
                  </>
                )}
              </div>
              <Link
                href={mention.deepLink}
                className="mt-2 inline-flex items-center gap-1 text-xs text-teal-600 hover:underline"
              >
                {isRTL ? "פתח בפגישה" : "Open in meeting"}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderAiAnswer = (mentions: ExactMention[], aiAnswer?: AiAnswer | null) => {
    if (!aiAnswer?.paragraphs?.length) return null

    const paragraphs = aiAnswer.paragraphs.filter((paragraph) => paragraph.citations?.length)
    if (!paragraphs.length) return null

    return (
      <div className="mt-3 rounded-lg border border-border bg-white p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Bot className="h-4 w-4 text-teal-600" />
          <span>{isRTL ? "תשובת AI" : "AI-generated answer"}</span>
        </div>
        <div className="mt-3 space-y-3">
          {paragraphs.map((paragraph, index) => (
            <div key={`${paragraph.text}-${index}`} className="space-y-2">
              <p className="text-sm text-foreground leading-relaxed">{paragraph.text}</p>
              <div className="flex flex-wrap gap-2">
                {paragraph.citations.map((citation, citationIndex) => {
                  const refId = citation.quoteId || citation.chunkId
                  if (!refId) return null
                  const mention = mentions.find((item) => item.quoteId === refId || item.chunkId === refId)
                  if (!mention) return null
                  const label = mentionIndex.get(refId) || citationIndex + 1
                  return (
                    <Link
                      key={`${refId}-${citationIndex}`}
                      href={mention.deepLink}
                      className="text-xs text-teal-600 hover:underline"
                    >
                      [{label}]
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
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
                <p className="text-xs text-muted-foreground truncate">{thread.lastMessage || ""}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isRTL ? "start" : "end"}>
                  <DropdownMenuItem onClick={() => handleDeleteThread(thread.id)} className="text-red-600">
                    <Trash2 className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
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
      <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
        <SheetContent side={isRTL ? "right" : "left"} className="w-80 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <div className="hidden md:block w-72 border-l border-border bg-sidebar">
        <SidebarContent />
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Header - only show when has messages or searching */}
        {(messages.length > 0 || isSearching) && (
          <div className="border-b border-border px-4 py-3 flex items-center gap-2">
            <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setShowMobileSidebar(true)}>
              <PanelLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-sm font-semibold">{isRTL ? "זיכרון" : "Memory"}</h2>
          </div>
        )}

        {/* NEW CONVERSATION: ChatGPT-like centered layout */}
        {messages.length === 0 && !isSearching ? (
          <div className="flex-1 flex flex-col">
            {/* Mobile sidebar button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden absolute top-16 start-4"
              onClick={() => setShowMobileSidebar(true)}
            >
              <PanelLeft className="w-4 h-4" />
            </Button>

            {/* Centered content area */}
            <div className="flex-1 flex items-center justify-center px-4">
              <div className="w-full max-w-2xl text-center space-y-4">
                <div className="space-y-3">
                  <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                    <Bot className="w-7 h-7 text-white" />
                  </div>
                  <h1 className="text-2xl font-semibold text-foreground">
                    {isRTL ? "מה תרצה למצוא?" : "What do you want to find?"}
                  </h1>
                  <p className="text-muted-foreground">
                    {isRTL ? "חפש בתמלולים שלך או שאל שאלות" : "Search your transcripts or ask questions"}
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom input area - ChatGPT style */}
            <div className="py-4 px-4 md:py-8">
              <div className="max-w-2xl mx-auto space-y-4">
                {/* Input bar */}
                <form onSubmit={handleSubmit}>
                  <div className="flex items-center gap-3 bg-white border border-border rounded-2xl px-4 py-2.5 shadow-sm hover:shadow-md transition-shadow">
                    <Input
                      placeholder={isRTL ? "שאל את הזיכרון..." : "Ask anything"}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      className="flex-1 border-0 focus-visible:ring-0 bg-transparent text-sm h-9 px-0"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="bg-teal-600 hover:bg-teal-700 rounded-full h-8 w-8 p-0 flex-shrink-0"
                      disabled={!input.trim()}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </form>

                {/* Suggested queries as pills */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestedQueries.map((query) => (
                    <button
                      key={query.text}
                      type="button"
                      onClick={() => handleSend(query.text)}
                      className="px-3 py-1.5 text-sm border border-border rounded-full hover:bg-muted transition-colors"
                    >
                      {isRTL ? query.labelHe : query.labelEn}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  {isRTL ? "החיפוש מתבסס על תמלולי הפגישות שלך" : "Search is based on your meeting transcripts"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* ONGOING CONVERSATION: ChatGPT-like centered layout */
          <div className="flex-1 flex flex-col">
            {/* Messages area - centered with max-width */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                {messages.map((message) => {
                  const mentions = message.evidence_json?.exactMentions || []
                  const aiAnswer = message.evidence_json?.aiAnswer
                  const hasEvidence = mentions.length > 0 || aiAnswer?.paragraphs?.length

                  if (message.role === "user") {
                    return (
                      <div key={message.id} className="flex justify-end">
                        <div className="max-w-[85%] md:max-w-[70%]">
                          <div className="rounded-2xl px-4 py-2.5 text-sm bg-teal-600 text-white">
                            {message.content}
                          </div>
                          <span className="text-xs text-muted-foreground mt-1 block text-end">
                            {new Date(message.created_at).toLocaleTimeString(isRTL ? "he-IL" : "en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={message.id} className="flex gap-3">
                      <Avatar className="h-7 w-7 flex-shrink-0 mt-1">
                        <AvatarFallback className="bg-teal-100 text-teal-700">
                          <Bot className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        {renderExactMentions(mentions)}
                        {renderAiAnswer(mentions, aiAnswer)}
                        {!hasEvidence && (
                          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" />
                              <span>...</span>
                            </div>
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground mt-1.5 block">
                          {new Date(message.created_at).toLocaleTimeString(isRTL ? "he-IL" : "en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  )
                })}

                {isSearching && (
                  <div className="flex gap-3">
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarFallback className="bg-teal-100 text-teal-700">
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="rounded-lg px-3 py-2 text-sm bg-muted animate-pulse">
                      {isRTL ? "..." : "..."}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ChatGPT-style input bar - centered, shorter, raised */}
            <div className="py-4 px-4 md:py-6">
              <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
                <div className="flex items-center gap-3 bg-white border border-border rounded-2xl px-4 py-2 shadow-sm hover:shadow-md transition-shadow">
                  <Input
                    placeholder={isRTL ? "שאל את הזיכרון..." : "Ask anything"}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    className="flex-1 border-0 focus-visible:ring-0 bg-transparent text-sm h-9 px-0"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700 rounded-full h-8 w-8 p-0 flex-shrink-0"
                    disabled={!input.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  {isRTL ? "החיפוש מתבסס על תמלולי הפגישות שלך" : "Search is based on your meeting transcripts"}
                </p>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
