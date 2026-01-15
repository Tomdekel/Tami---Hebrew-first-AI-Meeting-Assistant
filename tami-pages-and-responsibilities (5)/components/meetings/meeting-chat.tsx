"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, Bot, Clock } from "lucide-react"

interface ChatMessage {
  id: string
  type: "user" | "ai"
  content: string
  timestamp: string
  citation?: { time: string; speaker: string }
}

const initialMessages: ChatMessage[] = [
  {
    id: "1",
    type: "ai",
    content: "שלום! אני יכול לענות על שאלות לגבי הפגישה הזו. מה תרצה לדעת?",
    timestamp: "14:45",
  },
]

export function MeetingChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState("")

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }),
    }

    const aiResponse: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: "ai",
      content: "על פי הפגישה, מיכל לוי עובדת על תיקון בעיית האימות ב-API. יוסי אברהם יסייע לה אחרי שיסיים את הבדיקות.",
      timestamp: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }),
      citation: { time: "01:02", speaker: "מיכל לוי" },
    }

    setMessages([...messages, userMessage, aiResponse])
    setInput("")
  }

  return (
    <div className="flex flex-col h-[calc(100%-60px)]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex gap-3 ${message.type === "user" ? "flex-row-reverse" : ""}`}>
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className={message.type === "ai" ? "bg-teal-100 text-teal-700" : "bg-gray-100"}>
                {message.type === "ai" ? <Bot className="h-4 w-4" /> : "דכ"}
              </AvatarFallback>
            </Avatar>
            <div className={`max-w-[80%] ${message.type === "user" ? "text-left" : "text-right"}`}>
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  message.type === "user" ? "bg-teal-600 text-white" : "bg-muted"
                }`}
              >
                {message.content}
              </div>
              {message.citation && (
                <button className="flex items-center gap-1 mt-1 text-xs text-teal-600 hover:underline">
                  <Clock className="h-3 w-3" />
                  <span dir="ltr">{message.citation.time}</span>
                  <span>- {message.citation.speaker}</span>
                </button>
              )}
              <span className="text-xs text-muted-foreground mt-1 block">{message.timestamp}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="שאל שאלה על הפגישה..."
            className="flex-1"
          />
          <Button type="submit" size="icon" className="bg-teal-600 hover:bg-teal-700">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}
