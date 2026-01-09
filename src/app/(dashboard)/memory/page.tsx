"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useTranslations, useLocale } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Search, Send, Bot, Clock, Calendar, ArrowLeft, Sparkles, User, Trash2 } from "lucide-react"
import Link from "next/link"

interface Source {
  sessionId: string
  sessionTitle: string
  sessionDate?: string
  excerpts: string[]
  speaker?: string
  timestamp?: string
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: Source[]
  time: string
}

export default function MemoryPage() {
  const t = useTranslations()
  const locale = useLocale()
  const isRTL = locale === "he"
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [isClearing, setIsClearing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const suggestedQuestions = [
    t("memory.placeholder"),
    t("memory.suggestedQ1"),
    t("memory.suggestedQ2"),
    t("memory.suggestedQ3"),
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Load chat history on mount
  const loadChatHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    try {
      const response = await fetch("/api/memory/chat?limit=50")
      if (!response.ok) {
        throw new Error("Failed to load chat history")
      }
      const data = await response.json()

      // Transform API response to Message format
      const loadedMessages: Message[] = (data.messages || []).map((msg: {
        id: string
        role: "user" | "assistant"
        content: string
        sources?: Source[]
        created_at: string
      }) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        sources: msg.sources,
        time: new Date(msg.created_at).toLocaleTimeString(isRTL ? "he-IL" : "en-US", {
          hour: "2-digit",
          minute: "2-digit"
        }),
      }))

      setMessages(loadedMessages)
    } catch (error) {
      console.error("Failed to load chat history:", error)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [isRTL])

  // Clear chat history
  const handleClearHistory = async () => {
    if (isClearing || messages.length === 0) return

    // Confirm before clearing
    const confirmed = window.confirm(t("memory.clearConfirm"))
    if (!confirmed) return

    setIsClearing(true)
    try {
      const response = await fetch("/api/memory/chat", {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to clear chat history")
      }

      setMessages([])
    } catch (error) {
      console.error("Failed to clear chat history:", error)
    } finally {
      setIsClearing(false)
    }
  }

  // Load history on mount
  useEffect(() => {
    loadChatHistory()
  }, [loadChatHistory])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (query: string) => {
    if (!query.trim() || isLoading) return

    const question = query.trim()
    setInput("")

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
      time: new Date().toLocaleTimeString(isRTL ? "he-IL" : "en-US", { hour: "2-digit", minute: "2-digit" }),
    }
    setMessages((prev) => [...prev, userMessage])

    setIsLoading(true)

    try {
      const response = await fetch("/api/memory/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          language: document.documentElement.lang || "he",
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get answer")
      }

      const data = await response.json()

      // Add assistant message
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer,
        sources: data.sources,
        time: new Date().toLocaleTimeString(isRTL ? "he-IL" : "en-US", { hour: "2-digit", minute: "2-digit" }),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error("Memory chat error:", error)
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: t("common.error"),
        time: new Date().toLocaleTimeString(isRTL ? "he-IL" : "en-US", { hour: "2-digit", minute: "2-digit" }),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSend(input)
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8 relative">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearHistory}
              disabled={isClearing}
              className={`absolute top-0 ${isRTL ? "left-0" : "right-0"} text-muted-foreground hover:text-destructive`}
            >
              <Trash2 className="w-4 h-4 me-1" aria-hidden="true" />
              {isClearing ? t("common.loading") : t("memory.clearHistory")}
            </Button>
          )}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-100 rounded-2xl mb-4">
            <Sparkles className="w-8 h-8 text-teal-600" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{t("memory.title")}</h1>
          <p className="text-muted-foreground">{t("memory.description")}</p>
        </div>

        {/* Search / Chat Input */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="relative">
            <Search className={`absolute ${isRTL ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground`} aria-hidden="true" />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("memory.placeholder")}
              className={`h-14 ${isRTL ? "pr-12 pl-14" : "pl-12 pr-14"} text-base bg-white border-border shadow-sm`}
              disabled={isLoading}
              aria-label={t("memory.placeholder")}
              dir="ltr"
            />
            <Button
              type="submit"
              size="icon"
              className={`absolute ${isRTL ? "left-2" : "right-2"} top-1/2 -translate-y-1/2 bg-teal-600 hover:bg-teal-700`}
              disabled={isLoading || !input.trim()}
              aria-label={t("memory.askButton")}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </form>

        {/* Loading History State */}
        {isLoadingHistory && (
          <div className="flex justify-center py-8" role="status">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-teal-600 rounded-full motion-safe:animate-bounce" aria-hidden="true" />
              <div
                className="w-2 h-2 bg-teal-600 rounded-full motion-safe:animate-bounce"
                style={{ animationDelay: "0.1s" }}
                aria-hidden="true"
              />
              <div
                className="w-2 h-2 bg-teal-600 rounded-full motion-safe:animate-bounce"
                style={{ animationDelay: "0.2s" }}
                aria-hidden="true"
              />
              <span className="text-sm text-muted-foreground">{t("memory.loadingHistory")}</span>
            </div>
          </div>
        )}

        {/* Suggested Questions (when no messages and not loading) */}
        {!isLoadingHistory && messages.length === 0 && (
          <section className="space-y-4" aria-labelledby="suggested-questions-heading">
            <h2 id="suggested-questions-heading" className="text-sm font-medium text-muted-foreground">{t("memory.suggestedTitle")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSend(question)}
                  className={`p-4 ${isRTL ? "text-right" : "text-left"} bg-white border border-border rounded-lg hover:border-teal-300 hover:bg-teal-50/50 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2`}
                >
                  <p className="text-sm text-foreground">{question}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Chat Messages */}
        {messages.length > 0 && (
          <section
            role="log"
            aria-label={t("memory.chatHistory")}
            aria-live="polite"
            className="space-y-6"
          >
            {messages.map((message) => (
              <div key={message.id} className="space-y-3">
                <div className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarFallback className={message.role === "assistant" ? "bg-teal-100 text-teal-700" : "bg-gray-100"}>
                      {message.role === "assistant" ? (
                        <Bot className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <User className="h-5 w-5" aria-hidden="true" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`max-w-[85%] ${message.role === "user" ? "text-left" : "text-right"}`}>
                    <div
                      className={`rounded-xl px-4 py-3 ${
                        message.role === "user" ? "bg-teal-600 text-white" : "bg-white border border-border"
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1 block">{message.time}</span>
                  </div>
                </div>

                {/* Citations */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mr-13 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">{t("memory.sources")}:</p>
                    {message.sources.map((source, index) => (
                      <Card key={index} className="bg-muted/30 border-border hover:border-teal-300 transition-colors">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                  <Calendar className="w-3 h-3 ml-1" aria-hidden="true" />
                                  {source.sessionTitle}
                                </Badge>
                                {source.sessionDate && (
                                  <span className="text-xs text-muted-foreground">{source.sessionDate}</span>
                                )}
                                {source.timestamp && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1" dir="ltr">
                                    <Clock className="w-3 h-3" aria-hidden="true" />
                                    {source.timestamp}
                                  </span>
                                )}
                              </div>
                              {source.excerpts && source.excerpts.length > 0 && (
                                <p className="text-sm text-foreground mb-1 line-clamp-2">{source.excerpts[0]}</p>
                              )}
                              {source.speaker && (
                                <p className="text-xs text-muted-foreground">— {source.speaker}</p>
                              )}
                            </div>
                            <Button variant="ghost" size="sm" asChild className="flex-shrink-0">
                              <Link href={`/meetings/${source.sessionId}`} aria-label={`${t("memory.viewMeeting")}: ${source.sessionTitle}`}>
                                <ArrowLeft className="w-4 h-4 rotate-180" aria-hidden="true" />
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Loading State */}
            {isLoading && (
              <div className="flex gap-3" role="status" aria-live="polite">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarFallback className="bg-teal-100 text-teal-700">
                    <Bot className="h-5 w-5" aria-hidden="true" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-white border border-border rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-teal-600 rounded-full motion-safe:animate-bounce" aria-hidden="true" />
                    <div
                      className="w-2 h-2 bg-teal-600 rounded-full motion-safe:animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                      aria-hidden="true"
                    />
                    <div
                      className="w-2 h-2 bg-teal-600 rounded-full motion-safe:animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                      aria-hidden="true"
                    />
                    <span className="text-sm text-muted-foreground mr-2">{t("memory.thinking")}</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </section>
        )}
      </div>
    </div>
  )
}
