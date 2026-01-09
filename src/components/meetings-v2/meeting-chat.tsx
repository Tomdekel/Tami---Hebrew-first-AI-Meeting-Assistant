"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, Bot, Loader2 } from "lucide-react"
import type { ChatMessage } from "@/lib/types/database"

interface MeetingChatProps {
  sessionId: string
  isProcessing?: boolean
  onSeek?: (time: number) => void
}

export function MeetingChat({ sessionId, isProcessing = false, onSeek }: MeetingChatProps) {
  const t = useTranslations()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadChatHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/chat`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
        setIsLoaded(true)
      }
    } catch (err) {
      console.error("Failed to load chat history:", err)
    }
  }, [sessionId])

  useEffect(() => {
    if (!isLoaded && !isProcessing) {
      loadChatHistory()
    }
  }, [isLoaded, isProcessing, loadChatHistory])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isSending) return

    const question = input.trim()
    setInput("")
    setIsSending(true)

    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: "user",
      content: question,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])

    try {
      const response = await fetch(`/api/sessions/${sessionId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to get answer")
      }

      const data = await response.json()

      const assistantMessage: ChatMessage = {
        id: data.messageId || `temp-${Date.now()}-response`,
        session_id: sessionId,
        role: "assistant",
        content: data.answer,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      console.error("Chat error:", err)
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))
      setInput(question)
    } finally {
      setIsSending(false)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
  }

  const getInitials = () => "דכ" // Default user initials

  if (isProcessing) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">
            {t("meeting.chatWillBeAvailable")}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isSending && (
          <div className="flex gap-3">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="bg-teal-100 text-teal-700">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="max-w-[80%] text-right">
              <div className="rounded-lg px-3 py-2 text-sm bg-muted">
                שלום! אני יכול לענות על שאלות לגבי הפגישה הזו. מה תרצה לדעת?
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback
                className={
                  message.role === "assistant"
                    ? "bg-teal-100 text-teal-700"
                    : "bg-gray-100"
                }
              >
                {message.role === "assistant" ? (
                  <Bot className="h-4 w-4" />
                ) : (
                  getInitials()
                )}
              </AvatarFallback>
            </Avatar>
            <div
              className={`max-w-[80%] ${
                message.role === "user" ? "text-left" : "text-right"
              }`}
            >
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "bg-teal-600 text-white"
                    : "bg-muted"
                }`}
              >
                {message.content}
              </div>
              <span className="text-xs text-muted-foreground mt-1 block">
                {formatTime(message.created_at)}
              </span>
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex gap-3">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="bg-teal-100 text-teal-700">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="max-w-[80%] text-right">
              <div className="rounded-lg px-3 py-2 text-sm bg-muted flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>מחפש בפגישה...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("meeting.askQuestion")}
            className="flex-1"
            disabled={isSending}
          />
          <Button
            type="submit"
            size="icon"
            className="bg-teal-600 hover:bg-teal-700"
            disabled={isSending || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}
