"use client"

import { cn } from "@/lib/utils"
import { AlertCircle, CheckCircle, AlertTriangle, Sparkles } from "lucide-react"

interface FeedbackItem {
  type: "positive" | "warning" | "danger" | "insight"
  message: string
}

interface AiFeedbackProps {
  feedback: FeedbackItem[]
}

const feedbackConfig = {
  positive: {
    icon: CheckCircle,
    color: "text-[oklch(0.75_0.18_145)]",
    bg: "bg-[oklch(0.7_0.2_145/0.1)]",
    border: "border-[oklch(0.7_0.2_145/0.3)]",
    glow: "shadow-[0_0_8px_oklch(0.7_0.2_145/0.2)]",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-[oklch(0.88_0.15_90)]",
    bg: "bg-[oklch(0.85_0.18_90/0.1)]",
    border: "border-[oklch(0.85_0.18_90/0.3)]",
    glow: "shadow-[0_0_8px_oklch(0.85_0.18_90/0.2)]",
  },
  danger: {
    icon: AlertCircle,
    color: "text-[oklch(0.7_0.2_25)]",
    bg: "bg-[oklch(0.65_0.22_25/0.1)]",
    border: "border-[oklch(0.65_0.22_25/0.3)]",
    glow: "shadow-[0_0_8px_oklch(0.65_0.22_25/0.2)]",
  },
  insight: {
    icon: Sparkles,
    color: "text-[oklch(0.8_0.12_195)]",
    bg: "bg-[oklch(0.75_0.15_195/0.1)]",
    border: "border-[oklch(0.75_0.15_195/0.3)]",
    glow: "shadow-[0_0_8px_oklch(0.75_0.15_195/0.2)]",
  },
}

export function AiFeedback({ feedback }: AiFeedbackProps) {
  return (
    <div className="space-y-1.5">
      {feedback.map((item, index) => {
        const config = feedbackConfig[item.type]
        const Icon = config.icon
        return (
          <div
            key={index}
            className={cn(
              "flex items-start gap-2 p-2 rounded-lg border",
              config.bg,
              config.border,
              config.glow
            )}
          >
            <Icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", config.color)} />
            <span className="text-[11px] text-foreground/90 leading-relaxed">{item.message}</span>
          </div>
        )
      })}
    </div>
  )
}
