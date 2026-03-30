"use client"

import { cn } from "@/lib/utils"

export type Period = "day" | "week" | "month"

interface PeriodSelectorProps {
  value: Period
  onChange: (value: Period) => void
  size?: "sm" | "md"
}

export function PeriodSelector({ value, onChange, size = "md" }: PeriodSelectorProps) {
  return (
    <div className={cn(
      "flex bg-[oklch(0.12_0.015_250)] rounded-lg",
      size === "sm" ? "gap-0.5 p-0.5" : "gap-1 p-1"
    )}>
      {(["day", "week", "month"] as const).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            "rounded-md font-medium transition-all",
            size === "sm" ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs",
            value === p 
              ? "bg-[oklch(0.75_0.15_195/0.25)] text-[oklch(0.8_0.12_195)] shadow-[0_0_10px_oklch(0.75_0.15_195/0.2)]" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {p === "day" ? "Today" : p === "week" ? "Week" : "Month"}
        </button>
      ))}
    </div>
  )
}
