"use client"

import { useState } from "react"
import { Send, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AiChatInputProps {
  onSend?: (message: string) => void
}

export function AiChatInput({ onSend }: AiChatInputProps) {
  const [message, setMessage] = useState("")

  const handleSend = () => {
    if (message.trim() && onSend) {
      onSend(message.trim())
      setMessage("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-[oklch(0.75_0.15_195)] flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5" />
        Ask AI Assistant
      </h4>
      <div className="flex gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Why was my focus low yesterday?"
          className="flex-1 h-8 px-3 text-xs bg-[oklch(0.15_0.02_250)] border border-[oklch(0.3_0.03_250/0.5)] rounded-lg placeholder:text-muted-foreground/50 focus:outline-none focus:border-[oklch(0.75_0.15_195/0.5)] focus:shadow-[0_0_10px_oklch(0.75_0.15_195/0.2)] transition-all"
        />
        <Button 
          size="icon" 
          className="h-8 w-8 bg-[oklch(0.75_0.15_195/0.8)] hover:bg-[oklch(0.75_0.15_195)] shrink-0 shadow-[0_0_15px_oklch(0.75_0.15_195/0.4)]"
          onClick={handleSend}
          disabled={!message.trim()}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
