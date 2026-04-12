"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { Activity } from "lucide-react"
import { KpiBoard } from "@/components/dashboard/kpi-board"
import { ActivityTimeline } from "@/components/dashboard/activity-timeline"
import { AiFeedback } from "@/components/dashboard/ai-feedback"
import { DetailPanel } from "@/components/dashboard/detail-panel"
import { DatePicker } from "@/components/dashboard/date-picker"
import { AiChatInput } from "@/components/dashboard/ai-chat-input"
import { PeriodSelector, type Period } from "@/components/dashboard/period-selector"

// Activity type definition matching components/dashboard/activity-timeline.tsx
interface ActivityBlock {
  type: string
  startHour: number
  endHour: number
}

const sampleFeedback = [
  {
    type: "positive" as const,
    message: "作業集中時間が前日比+15%向上。深夜のPC使用を控えた効果が出ています。",
  },
  {
    type: "warning" as const,
    message: "今週の野菜摂取量が目標の60%。夕食にサラダ追加を推奨します。",
  },
  {
    type: "insight" as const,
    message: "睡眠スコアと翌日の作業効率に強い相関を検出。22時就寝が最適パターンです。",
  },
]

const kpiData = [
  { label: "睡眠スコア", value: 72, unit: "pt", source: "Fitbit", trend: "up" as const, trendValue: "+5", color: "cyan" as const },
  { label: "作業集中度", value: 88, unit: "%", source: "ActivityWatch", trend: "up" as const, trendValue: "+12%", color: "green" as const },
  { label: "摂取カロリー", value: 2100, unit: "kcal", source: "Asken", color: "orange" as const },
  { label: "消費カロリー", value: 2340, unit: "kcal", source: "Fitbit", color: "red" as const },
  { label: "体重", value: "68.2", unit: "kg", source: "体組成計", trend: "down" as const, trendValue: "-0.3", color: "yellow" as const },
  { label: "移動距離", value: "3.5", unit: "km", source: "OwnTracks", color: "pink" as const },
]

export default function LifeDashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [activities, setActivities] = useState<ActivityBlock[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [summaryPeriod, setSummaryPeriod] = useState<Period>("day")
  const [timelinePeriod, setTimelinePeriod] = useState<Period>("day")
  const [detailPeriod, setDetailPeriod] = useState<Period>("day")
  const [aiResponse, setAiResponse] = useState<string | null>(null)

  useEffect(() => {
    async function fetchActivities() {
      setIsLoading(true)
      try {
        const dateStr = format(selectedDate, "yyyy-MM-dd")
        const res = await fetch(`/api/activities?date=${dateStr}`)
        if (!res.ok) throw new Error("Failed to fetch activities")
        const data = await res.json()
        setActivities(data)
      } catch (error) {
        console.error("Error fetching activities:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchActivities()
  }, [selectedDate])

  const handleAiQuestion = (message: string) => {
    setAiResponse(`「${message}」について分析中...\n\n昨日の集中力低下の主な要因として、以下が考えられます：\n1. 睡眠時間が通常より1.5時間短かった\n2. 14時以降のAFK率が通常の2倍\n3. 昼食後のYouTube視聴時間が増加`)
  }

  return (
    <div className="h-screen w-screen bg-background p-3 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[oklch(0.75_0.15_195/0.15)] neon-border-cyan flex items-center justify-center">
              <Activity className="w-4 h-4 text-[oklch(0.75_0.15_195)]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground glow-text-cyan tracking-tight">
                Life Dashboard
              </h1>
              <p className="text-[10px] text-muted-foreground font-mono">
                {format(selectedDate, "yyyy/MM/dd (E)", { locale: ja })}
              </p>
            </div>
          </div>
          <span className="text-[10px] text-[oklch(0.75_0.15_195/0.8)] font-mono">v3.2</span>
        </div>
        <DatePicker date={selectedDate} onDateChange={setSelectedDate} />
      </header>

      {/* Main Layout: Left 30% / Right 70% */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Left Column - 30% */}
        <div className="w-[30%] flex flex-col gap-2 min-h-0">
          <div className="cyber-card rounded-xl p-3 flex flex-col min-h-0" style={{ flex: '0 0 auto', maxHeight: '42%' }}>
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h2 className="text-xs font-semibold text-[oklch(0.75_0.15_195)]">
                AI Summary & KPI
              </h2>
              <PeriodSelector value={summaryPeriod} onChange={setSummaryPeriod} size="sm" />
            </div>
            <div className="flex-1 overflow-auto">
              <KpiBoard kpis={kpiData} />
            </div>
          </div>

          <div className="cyber-card-green rounded-xl p-3 flex flex-col min-h-0" style={{ flex: '0 0 auto', maxHeight: '26%' }}>
            <h2 className="text-xs font-semibold text-[oklch(0.7_0.2_145)] mb-2 shrink-0">
              Today&apos;s AI Feedback
            </h2>
            <div className="flex-1 overflow-auto">
              <AiFeedback feedback={sampleFeedback} />
            </div>
          </div>

          <div className="flex-1 cyber-card rounded-xl p-3 flex flex-col min-h-0">
            <AiChatInput onSend={handleAiQuestion} />
            {aiResponse && (
              <div className="mt-2 flex-1 overflow-auto">
                <div className="bg-[oklch(0.15_0.02_250)] rounded-lg p-3 border border-[oklch(0.75_0.15_195/0.2)]">
                  <div className="text-[10px] text-[oklch(0.75_0.15_195)] mb-1 font-semibold">AI Response</div>
                  <p className="text-xs text-foreground/85 whitespace-pre-line leading-relaxed">{aiResponse}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - 70% */}
        <div className="w-[70%] flex flex-col gap-3 min-h-0">
          <div className="h-[32%] cyber-card rounded-xl p-3 flex flex-col">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h2 className="text-xs font-semibold text-[oklch(0.75_0.15_195)]">
                Daily Activity Log
              </h2>
              <div className="flex items-center gap-3">
                {isLoading && <span className="text-[10px] text-orange-400 animate-pulse font-mono">LOADING...</span>}
                <span className="text-[10px] text-muted-foreground font-mono">15min intervals</span>
                <PeriodSelector value={timelinePeriod} onChange={setTimelinePeriod} size="sm" />
              </div>
            </div>
            <div className="flex-1 flex items-center">
              <ActivityTimeline date={selectedDate} activities={activities} />
            </div>
          </div>

          <div className="flex-1 cyber-card rounded-xl p-3 flex flex-col min-h-0">
            <DetailPanel period={detailPeriod} onPeriodChange={setDetailPeriod} />
          </div>
        </div>
      </div>

      <footer className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground shrink-0 px-1">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-orange-400 animate-pulse' : 'bg-[oklch(0.7_0.2_145)]'} shadow-[0_0_6px_currentColor]`} />
            <span className="font-mono">{isLoading ? 'SYNCING' : 'SYNCED'}</span>
          </span>
          <span className="font-mono">Last Update: {format(new Date(), "HH:mm:ss")}</span>
        </div>
        <div className="flex items-center gap-4 font-mono">
          <span className="text-[oklch(0.7_0.2_145)]">Trino: Connected</span>
          <span className="text-[oklch(0.75_0.15_195)]">ActivityWatch: OK</span>
          <span className="text-[oklch(0.7_0.2_60)]">OwnTracks: OK</span>
        </div>
      </footer>
    </div>
  )
}
