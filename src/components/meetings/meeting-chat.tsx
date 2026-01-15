"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, Bot, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/language-context"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  created_at: string
}

interface MeetingChatProps {
  sessionId: string
  isProcessing?: boolean
}

export function MeetingChat({ sessionId, isProcessing = false }: MeetingChatProps) {
  const { isRTL } = useLanguage()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/chat`)
        if (!response.ok) return
        const data = await response.json()
        setMessages(data.messages || [])
      } catch (error) {
        console.error("Failed to load meeting chat:", error)
      }
    }

    if (!isProcessing) {
      loadChatHistory()
    }
  }, [sessionId, isProcessing])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!input.trim() || isSending) return

    const question = input.trim()
    setInput("")
    setIsSending(true)

    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
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
        throw new Error("Failed to send message")
      }

      const data = await response.json()

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.answer || "",
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error("Meeting chat error:", error)
    } finally {
      setIsSending(false)
    }
  }

  if (isProcessing) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <p className="text-sm text-muted-foreground">
          {isRTL ? "הצ'אט יופיע לאחר סיום העיבוד" : "Chat will appear once processing is complete"}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isSending && (
          <div className={cn("flex gap-3", isRTL ? "flex-row-reverse" : "")}> 
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="bg-teal-100 text-teal-700">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className={cn("max-w-[80%]", isRTL ? "text-right" : "text-left")}> 
              <div className="rounded-lg px-3 py-2 text-sm bg-muted">
                {isRTL ? "אפשר לשאול על הפגישה הזו" : "Ask anything about this meeting"}
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={cn("flex gap-3", message.role === "user" ? "flex-row-reverse" : "")}>
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback
                className={message.role === "assistant" ? "bg-teal-100 text-teal-700" : "bg-gray-100"}
              >
                {message.role === "assistant" ? <Bot className="h-4 w-4" /> : "ME"}
              </AvatarFallback>
            </Avatar>
            <div className={cn("max-w-[80%]", message.role === "user" ? "text-left" : "text-right")}>
              <div className={cn(
                "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                message.role === "user" ? "bg-teal-600 text-white" : "bg-muted"
              )}>
                {message.content}
              </div>
              <span className="mt-1 block text-xs text-muted-foreground">
                {new Date(message.created_at).toLocaleTimeString(isRTL ? "he-IL" : "en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        ))}

        {isSending && (
          <div className={cn("flex gap-3", isRTL ? "flex-row-reverse" : "")}>
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="bg-teal-100 text-teal-700">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="max-w-[80%]">
              <div className="rounded-lg px-3 py-2 text-sm bg-muted flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{isRTL ? "חושב..." : "Thinking..."}</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={isRTL ? "שאל שאלה על הפגישה..." : "Ask about the meeting..."}
            className="flex-1"
          />
          <Button type="submit" size="icon" className="bg-teal-600 hover:bg-teal-700" disabled={isSending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}
