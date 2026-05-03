"use client"

import { cn } from "@/lib/utils"
import { 
  Zap, MonitorPlay, Flame, Footprints, Moon, Brain, 
  AlertCircle, CheckCircle2, ArrowUpRight, ArrowDownRight 
} from "lucide-react"

export type KpiStatus = "good" | "stable" | "warning" | "critical" | "neutral"
export type KpiBehavior = "positive" | "negative" | "balanced"

export interface KpiItem {
  id: string
  label: string
  value: React.ReactNode 
  unit?: string 
  status: KpiStatus
  behavior: KpiBehavior
  progress: number // 0 to 100
  action: React.ReactNode 
  icon: any
}

export function KpiBoard({ kpis }: { kpis: KpiItem[] }) {
  return (
    // 🚀 `h-full` を削除し、中身の高さぴったりで止まるようにした
    <div className="grid grid-cols-3 gap-2">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.id} {...kpi} />
      ))}
    </div>
  )
}

function KpiCard({ label, value, unit, status, behavior, progress, action, icon: Icon }: KpiItem) {
  const statusStyles = {
    good: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_15px_oklch(0.7_0.2_145/0.05)]",
    stable: "text-lime-400 border-lime-500/30 bg-lime-500/5 shadow-[0_0_15px_oklch(0.8_0.2_145/0.05)]",
    warning: "text-amber-400 border-amber-500/30 bg-amber-500/5 shadow-[0_0_15px_oklch(0.85_0.18_90/0.05)]",
    critical: "text-rose-400 border-rose-500/30 bg-rose-500/5 shadow-[0_0_15px_oklch(0.65_0.22_25/0.08)]",
    neutral: "text-slate-500 border-slate-500/20 bg-slate-500/5",
  }

  const barColors = {
    good: "bg-emerald-500 shadow-[0_0_8px_#10b981]",
    stable: "bg-lime-500 shadow-[0_0_8px_#84cc16]",
    warning: "bg-amber-500 shadow-[0_0_8px_#f59e0b]",
    critical: "bg-rose-500 shadow-[0_0_10px_#f43f5e]",
    neutral: "bg-slate-600",
  }

  return (
    <div className={cn(
      "relative group rounded-xl p-2 border transition-all duration-500 flex flex-col overflow-hidden pb-2.5", // 🚀 さらに p-2.5 から p-2 に削って極限まで圧縮
      statusStyles[status]
    )}>
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '8px 8px' }} />
      
      <div className="relative z-10 flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold uppercase tracking-[0.1em] flex items-center gap-1.5 opacity-70">
            <Icon className="w-3 h-3" /> {/* アイコンも少し小さく(w-3) */}
            {label}
          </span>
          {status === "good" ? (
            <CheckCircle2 className="w-3 h-3 opacity-40" />
          ) : (status === "warning" || status === "critical") ? (
            <AlertCircle className="w-3 h-3 animate-pulse" />
          ) : null}
        </div>

        <div className="flex items-baseline">
          {typeof value === "string" || typeof value === "number" ? (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono tracking-tighter tabular-nums leading-none">
                {value}
              </span>
              {unit && <span className="text-[10px] font-medium opacity-40 uppercase ml-0.5">{unit}</span>}
            </div>
          ) : (
            value
          )}
        </div>
      </div>

      <div className="relative z-10 mt-1.5 pt-1 border-t border-white/5">
        <div className="text-[9px] leading-tight opacity-70 font-medium h-3.5 overflow-hidden">
          {action}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 h-[2.5px] w-full bg-white/5" />
      <div 
        className={cn(
          "absolute bottom-0 left-0 h-[2.5px] transition-all duration-1000 ease-out",
          barColors[status]
        )}
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  )
}
