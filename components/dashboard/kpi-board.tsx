"use client"

import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface KpiItem {
  label: string
  value: string | number
  unit?: string
  source?: string
  trend?: "up" | "down" | "neutral"
  trendValue?: string
  color?: "cyan" | "green" | "yellow" | "orange" | "red" | "pink"
}

interface KpiBoardProps {
  kpis: KpiItem[]
}

const colorMap = {
  cyan: {
    text: "text-[oklch(0.8_0.12_195)]",
    glow: "shadow-[0_0_15px_oklch(0.75_0.15_195/0.4)]",
    border: "border-[oklch(0.75_0.15_195/0.3)]",
    bg: "bg-[oklch(0.75_0.15_195/0.08)]",
  },
  green: {
    text: "text-[oklch(0.75_0.18_145)]",
    glow: "shadow-[0_0_15px_oklch(0.7_0.2_145/0.4)]",
    border: "border-[oklch(0.7_0.2_145/0.3)]",
    bg: "bg-[oklch(0.7_0.2_145/0.08)]",
  },
  yellow: {
    text: "text-[oklch(0.88_0.15_90)]",
    glow: "shadow-[0_0_15px_oklch(0.85_0.18_90/0.4)]",
    border: "border-[oklch(0.85_0.18_90/0.3)]",
    bg: "bg-[oklch(0.85_0.18_90/0.08)]",
  },
  orange: {
    text: "text-[oklch(0.75_0.18_60)]",
    glow: "shadow-[0_0_15px_oklch(0.7_0.2_60/0.4)]",
    border: "border-[oklch(0.7_0.2_60/0.3)]",
    bg: "bg-[oklch(0.7_0.2_60/0.08)]",
  },
  red: {
    text: "text-[oklch(0.7_0.2_25)]",
    glow: "shadow-[0_0_15px_oklch(0.65_0.22_25/0.4)]",
    border: "border-[oklch(0.65_0.22_25/0.3)]",
    bg: "bg-[oklch(0.65_0.22_25/0.08)]",
  },
  pink: {
    text: "text-[oklch(0.75_0.15_340)]",
    glow: "shadow-[0_0_15px_oklch(0.7_0.18_340/0.4)]",
    border: "border-[oklch(0.7_0.18_340/0.3)]",
    bg: "bg-[oklch(0.7_0.18_340/0.08)]",
  },
}

export function KpiBoard({ kpis }: KpiBoardProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {kpis.map((kpi, index) => {
        const colors = colorMap[kpi.color || "cyan"]
        return (
          <div
            key={index}
            className={cn(
              "rounded-lg p-3 border",
              colors.bg,
              colors.border,
              colors.glow
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
              {kpi.trend && (
                <div className={cn(
                  "flex items-center gap-1 text-xs",
                  kpi.trend === "up" && "text-[oklch(0.7_0.2_145)]",
                  kpi.trend === "down" && "text-[oklch(0.65_0.22_25)]",
                  kpi.trend === "neutral" && "text-muted-foreground"
                )}>
                  {kpi.trend === "up" && <TrendingUp className="w-3 h-3" />}
                  {kpi.trend === "down" && <TrendingDown className="w-3 h-3" />}
                  {kpi.trend === "neutral" && <Minus className="w-3 h-3" />}
                  <span className="font-mono">{kpi.trendValue}</span>
                </div>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className={cn("text-2xl font-bold font-mono", colors.text)}>
                {kpi.value}
              </span>
              {kpi.unit && (
                <span className="text-sm text-muted-foreground">{kpi.unit}</span>
              )}
            </div>
            {kpi.source && (
              <span className="text-[10px] text-muted-foreground/60 font-mono">
                via {kpi.source}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
