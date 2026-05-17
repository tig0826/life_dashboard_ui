"use client"

import { useState, useEffect, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Terminal, Trash2 } from "lucide-react"

interface AiChatPanelProps {
  dateStr: string
  contextData: any
  initialMessages: any[]
  onMessagesChange?: (messages: any[]) => void
}

export function AiChatPanel({ dateStr, contextData, initialMessages, onMessagesChange }: AiChatPanelProps) {
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevStatusRef = useRef<string>("ready")
  const locallyActiveRef = useRef(false)  // このセッションでメッセージを送ったか

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    messages: initialMessages,
  })

  // ローカルで未送信の間はinitialMessages(Trino/localStorage)を常に反映
  useEffect(() => {
    if (!locallyActiveRef.current && initialMessages.length > 0) {
      setMessages(initialMessages)
    }
  }, [initialMessages, setMessages])

  const isLoading = status === "submitted" || status === "streaming"

  // ストリーム完了時にlocalStorageへ保存（Trinoは不要）
  useEffect(() => {
    if (prevStatusRef.current === "streaming" && status === "ready" && messages.length > 0) {
      onMessagesChange?.(messages)
    }
    prevStatusRef.current = status
  }, [status, messages, onMessagesChange])

  // 新メッセージ時にスクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleClear = () => {
    setMessages([])
    onMessagesChange?.([])
  }

  return (
    <>
      <div className="text-[10px] text-[oklch(0.75_0.15_195)] mb-2 font-semibold flex items-center justify-between shrink-0">
        <span>Ask AI Assistant</span>
        <div className="flex items-center gap-2">
          {isLoading && <span className="text-[oklch(0.7_0.2_60)] animate-pulse">Thinking...</span>}
          {messages.length > 0 && !isLoading && (
            <button
              onClick={handleClear}
              title="履歴を消去"
              className="text-muted-foreground hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto mb-3 space-y-3 pr-2">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            What insights do you need from today&apos;s log?
          </p>
        )}
        {messages.map((m) => {
          const text =
            m.parts
              ?.filter((p: any) => p.type === "text")
              .map((p: any) => p.text)
              .join("") ?? ""
          return (
            <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`inline-block p-2.5 rounded-lg text-xs leading-relaxed max-w-[90%] whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-[oklch(0.75_0.15_195/0.15)] text-[oklch(0.75_0.15_195)] border border-[oklch(0.75_0.15_195/0.3)]"
                    : "bg-[oklch(0.12_0.02_250)] text-foreground/90 border border-[oklch(0.25_0.03_250)]"
                }`}
              >
                {text}
              </div>
            </div>
          )
        })}
        {error && (
          <div className="text-xs text-rose-400 border border-rose-500/30 rounded p-2">
            AI API error: {error.message}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const text = input.trim()
          if (!text || isLoading || status !== "ready") return
          locallyActiveRef.current = true
          sendMessage(
            { role: "user", parts: [{ type: "text", text }] },
            { body: { contextData } }
          )
          setInput("")
        }}
        className="flex gap-2 shrink-0"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Why was my focus low yesterday?"
          className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-xs text-foreground focus:outline-none focus:border-[oklch(0.75_0.15_195/0.5)] transition-colors"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-3 py-2 bg-[oklch(0.75_0.15_195/0.15)] text-[oklch(0.75_0.15_195)] border border-[oklch(0.75_0.15_195/0.3)] rounded-md hover:bg-[oklch(0.75_0.15_195/0.25)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Terminal className="w-4 h-4" />
        </button>
      </form>
    </>
  )
}
