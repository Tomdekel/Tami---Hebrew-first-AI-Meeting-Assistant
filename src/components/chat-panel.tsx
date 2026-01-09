"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { MessageSquare, Loader2, ChevronDown, ChevronUp, Send, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import type { ChatMessage } from "@/lib/types/database";

interface ChatPanelProps {
  sessionId: string;
  isProcessing?: boolean;
}

export function ChatPanel({ sessionId, isProcessing = false }: ChatPanelProps) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadChatHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/chat`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setIsLoaded(true);
      }
    } catch (err) {
      console.error("Failed to load chat history:", err);
    }
  }, [sessionId]);

  // Load chat history when opened
  useEffect(() => {
    if (isOpen && !isLoaded) {
      loadChatHistory();
    }
  }, [isOpen, isLoaded, loadChatHistory]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async () => {
    if (!input.trim() || isSending) return;

    const question = input.trim();
    setInput("");
    setIsSending(true);

    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: "user",
      content: question,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to get answer");
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: data.messageId || `temp-${Date.now()}-response`,
        session_id: sessionId,
        role: "assistant",
        content: data.answer,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      toast.error("Failed to get answer", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      setInput(question);
    } finally {
      setIsSending(false);
    }
  };

  // Get last 2 messages for collapsed preview
  const previewMessages = messages.slice(-2);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 hover:text-foreground cursor-pointer flex-1">
                <MessageSquare className="h-4 w-4" />
                <CardTitle className="text-sm">{t("meeting.questions")}</CardTitle>
                {messages.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({messages.length})
                  </span>
                )}
              </button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-1">
              {isOpen && !isProcessing && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  title={isExpanded ? t("common.minimize") || "Minimize" : t("common.expand") || "Expand"}
                >
                  {isExpanded ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </button>
              )}
              <CollapsibleTrigger asChild>
                <button className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        {/* Collapsed Preview */}
        {!isOpen && previewMessages.length > 0 && (
          <CardContent className="pt-0 pb-3">
            <div className="space-y-1">
              {previewMessages.map((msg) => (
                <p
                  key={msg.id}
                  className="text-xs text-muted-foreground truncate"
                >
                  <span className="font-medium">
                    {msg.role === "user" ? "Q:" : "A:"}
                  </span>{" "}
                  {msg.content}
                </p>
              ))}
            </div>
          </CardContent>
        )}

        <CollapsibleContent>
          <CardContent className="pt-0">
            {isProcessing ? (
              <p className="text-muted-foreground text-center py-4 text-sm">
                {t("meeting.chatWillBeAvailable") || "יהיה זמין לאחר סיום התמלול"}
              </p>
            ) : (
            <>
            {/* Messages */}
            <div className={`overflow-y-auto space-y-2 mb-3 border rounded-lg p-2 bg-muted/30 transition-all ${isExpanded ? "h-96" : "h-48"}`}>
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  <p>{t("meeting.askAboutMeeting")}</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background border"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))
              )}
              {isSending && (
                <div className="flex justify-start">
                  <div className="bg-background border rounded-lg px-3 py-1.5">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <Input
                placeholder={t("meeting.askQuestion")}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isSending}
                className="text-sm"
              />
              <Button
                size="icon"
                onClick={handleSendMessage}
                disabled={isSending || !input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
