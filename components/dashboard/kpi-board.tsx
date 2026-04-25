"use client"

import { cn } from "@/lib/utils"
import { 
  Zap, MonitorPlay, Flame, Footprints, Moon, Brain, 
  AlertCircle, CheckCircle2, ArrowUpRight, ArrowDownRight 
} from "lucide-react"

export type KpiStatus = "good" | "warning" | "critical" | "neutral"

export interface KpiItem {
  id: string
  label: string
  value: string | number
  unit: string
  status: KpiStatus
  action: string
  trend?: "up" | "down"
  trendValue?: string
  icon: any
  color: string
}

export function KpiBoard({ kpis }: { kpis: KpiItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 h-full">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.id} {...kpi} />
      ))}
    </div>
  )
}

function KpiCard({ label, value, unit, status, action, trend, trendValue, icon: Icon, color }: KpiItem) {
  // ステータスに応じた発光色の定義
  const statusColors = {
    good: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_15px_oklch(0.7_0.2_145/0.1)]",
    warning: "text-amber-400 border-amber-500/30 bg-amber-500/5 shadow-[0_0_15px_oklch(0.85_0.18_90/0.1)]",
    critical: "text-rose-400 border-rose-500/30 bg-rose-500/5 shadow-[0_0_15px_oklch(0.65_0.22_25/0.1)]",
    neutral: "text-indigo-400 border-indigo-500/30 bg-indigo-500/5 shadow-[0_0_15px_oklch(0.6_0.18_250/0.1)]",
  }

  return (
    <div className={cn(
      "relative group rounded-xl p-3 border transition-all duration-500 flex flex-col justify-between overflow-hidden",
      statusColors[status]
    )}>
      {/* 背景の極小グリッド演出 */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] opacity-70 flex items-center gap-1.5">
            <Icon className="w-3 h-3" /> {label}
          </span>
          {status === "good" ? (
            <CheckCircle2 className="w-3 h-3 opacity-50" />
          ) : status !== "neutral" ? (
            <AlertCircle className="w-3 h-3 animate-pulse" />
          ) : null}
        </div>

        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-2xl font-black font-mono tracking-tighter tabular-nums leading-none">
            {value}
          </span>
          <span className="text-[10px] font-medium opacity-50 uppercase">{unit}</span>
          
          {trend && (
            <div className={cn(
              "ml-auto flex items-center text-[9px] font-mono",
              trend === "up" ? "text-emerald-400" : "text-rose-400"
            )}>
              {trend === "up" ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
              {trendValue}
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 mt-3 pt-2 border-t border-white/5">
        <div className="text-[9px] leading-relaxed opacity-80 font-medium">
          {action}
        </div>
      </div>
      
      {/* 底部にステータスバーを配置 */}
      <div className={cn(
        "absolute bottom-0 left-0 h-[2px] transition-all duration-700",
        status === "good" ? "bg-emerald-500 w-full" : 
        status === "warning" ? "bg-amber-500 w-2/3" : 
        status === "critical" ? "bg-rose-500 w-1/3 shadow-[0_0_10px_#f43f5e]" : "bg-indigo-500 w-full"
      )} />
    </div>
  )
}
