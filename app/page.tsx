"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useChat } from '@ai-sdk/react'
import { format, subDays, addDays } from "date-fns"
import { ja } from "date-fns/locale"
import { 
  Activity, Zap, MonitorPlay, Flame, Footprints, Moon, Brain, Terminal
} from "lucide-react"
import { KpiBoard, type KpiItem, type KpiStatus } from "@/components/dashboard/kpi-board"
import { ActivityTimeline } from "@/components/dashboard/activity-timeline"
import { AiFeedback } from "@/components/dashboard/ai-feedback"
import { DetailPanel } from "@/components/dashboard/detail-panel"
import { DatePicker } from "@/components/dashboard/date-picker"
import { PeriodSelector, type Period } from "@/components/dashboard/period-selector"

// - 型定義 -
type DailyPayload = {
  activities: any[]
  meals: any | null
  work: any | null
}

type AiFeedbackSlot = "morning" | "noon" | "night"

type AiFeedbackItem = {
  date: string
  slot: AiFeedbackSlot
  generatedAt: string
  messages: {
    type: "positive" | "warning" | "insight"
    message: string
  }[]
}

type AiContext = {
  date: string
  today: {
    sleepHours: number | null
    steps: number | null
    calories: number | null
    workScore: number | null
  }
  comparison: {
    vs7d: string[]
  }
  insights: string[]
}



const sampleFeedback = [
  { type: "positive" as const, message: "作業集中時間が前日比+15%向上。深夜のPC使用を控えた効果が出ています。" },
  { type: "warning" as const, message: "今週の野菜摂取量が目標の60%。夕食にサラダ追加を推奨します。" },
  { type: "insight" as const, message: "睡眠スコアと翌日の作業効率に強い相関を検出。22時就寝が最適パターンです。" },
]


function buildAiContext(currentData: any, fitnessCache: any[], dateStr: string) {
  const today = currentData.fitness

  const sleepHours = today?.sleepMins
    ? today.sleepMins / 60
    : null

  const steps = today?.steps ?? null
  const calories = today?.balance ?? null

  const workScore =
    typeof currentData?.work?.work?.score === "number"
      ? currentData.work.work.score
      : null

  // --- 過去7日平均との差 ---
  const last7 = fitnessCache.slice(-7)

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

  const avgSteps = avg(last7.map((d) => d.steps).filter(Boolean))
  const avgSleep = avg(last7.map((d) => d.sleepMins).filter(Boolean))

  const comparison: string[] = []

  if (steps && avgSteps) {
    if (steps > avgSteps) comparison.push("歩数が平均より多い")
    else comparison.push("歩数が平均より少ない")
  }

  if (sleepHours && avgSleep) {
    const avgSleepH = avgSleep / 60
    if (sleepHours > avgSleepH) comparison.push("睡眠が平均より長い")
    else comparison.push("睡眠が平均より短い")
  }

  // --- 仮説（ここが一番重要） ---
  const insights: string[] = []

  if (sleepHours && sleepHours > 7) {
    insights.push("睡眠が十分で集中力向上に寄与している可能性")
  }

  if (steps && steps < 3000) {
    insights.push("活動量不足でパフォーマンス低下の可能性")
  }

  if (calories && calories < -800) {
    insights.push("エネルギー不足が集中力低下の原因の可能性")
  }

  return {
    date: dateStr,
    today: {
      sleepHours,
      steps,
      calories,
      workScore,
    },
    comparison: {
      vs7d: comparison,
    },
    insights,
  }
}

export default function LifeDashboard() {
  // 🚀 1. ステート管理
  const [dailyCache, setDailyCache] = useState<Record<string, DailyPayload>>({})
  const [fitnessCache, setFitnessCache] = useState<any[]>([])

  // 🚀 2. ロック機構
  const fetchedDaily = useRef<Set<string>>(new Set())
  const fetchingDaily = useRef<Set<string>>(new Set())
  const fetchedFitnessDates = useRef<Set<string>>(new Set()) 
  const fetchingFitness = useRef<Set<string>>(new Set())

  // 🚀 3. UI制御ステート
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isLoading, setIsLoading] = useState(true)
  const [summaryPeriod, setSummaryPeriod] = useState<Period>("day")
  const [timelinePeriod, setTimelinePeriod] = useState<Period>("day")
  const [detailPeriod, setDetailPeriod] = useState<Period>("day")
  const [mounted, setMounted] = useState(false)
  const [lastUpdate, setLastUpdate] = useState("")

  const fetchDailyBulk = useCallback(async (targetDateStr: string, days: number = 14) => {
    if (fetchedDaily.current.has(targetDateStr)) return
    if (fetchingDaily.current.has(targetDateStr)) return

    fetchingDaily.current.add(targetDateStr)

    try {
      const res = await fetch(`/api/bulk?endDate=${targetDateStr}&days=${days}`)
      if (!res.ok) throw new Error(`Daily bulk failed: ${res.status}`)

      const dataArray = await res.json()

      setDailyCache(prev => {
        const nextCache = { ...prev }
        dataArray.forEach((dayData: any) => {
          if (!dayData.date) return
          nextCache[dayData.date] = {
            activities: dayData.activities || [],
            meals: dayData.meals || null,
            work: dayData.work || null,
          }
          fetchedDaily.current.add(dayData.date)
          fetchingDaily.current.delete(dayData.date)
        })
        return nextCache
      })
    } catch (e) {
      console.error("Daily bulk fetch error:", e)
      fetchingDaily.current.delete(targetDateStr)
    }
  }, [])

  const fetchFitnessBulk = useCallback(async (endDateStr: string) => {
    if (fetchedFitnessDates.current.has(endDateStr)) return
    if (fetchingFitness.current.has(endDateStr)) return

    fetchingFitness.current.add(endDateStr)

    try {
      const res = await fetch(`/api/fitness?date=${endDateStr}&days=90`)
      if (!res.ok) throw new Error(`Fitness bulk failed: ${res.status}`)

      const data = await res.json()
      const arr = Array.isArray(data) ? data : [data]

      arr.forEach(d => fetchedFitnessDates.current.add(d.date))

      setFitnessCache(prev => {
        const byDate = new Map<string, any>()
        for (const row of prev) byDate.set(row.date, row)
        for (const row of arr) byDate.set(row.date, row)
        return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
      })
    } catch (e) {
      console.error(`Fitness fetch error for ${endDateStr}:`, e)
    } finally {
      fetchingFitness.current.delete(endDateStr)
    }
  }, [])

  useEffect(() => {
    if (!mounted) return

    const loadData = async () => {
      const dStr = format(selectedDate, "yyyy-MM-dd")

      setIsLoading(true)
      await Promise.all([
        fetchDailyBulk(dStr, 14), 
        fetchFitnessBulk(dStr) 
      ])
      setIsLoading(false)

      setTimeout(() => {
        const pastDateStr = format(subDays(selectedDate, 14), "yyyy-MM-dd")
        fetchDailyBulk(pastDateStr, 14)
      }, 3000)
    }

    loadData()
  }, [selectedDate, mounted, fetchDailyBulk, fetchFitnessBulk])

  const currentData = useMemo(() => {
    const dStr = format(selectedDate, "yyyy-MM-dd")
    const pastStr = format(subDays(selectedDate, 90), "yyyy-MM-dd")

    const daily = dailyCache[dStr] || { activities: [], meals: null, work: null }
    const fitness = fitnessCache.find(d => d.date === dStr) || null
    const chartData = fitnessCache
      .filter(d => d.date >= pastStr && d.date <= dStr)
      .sort((a, b) => a.date.localeCompare(b.date))

    return { ...daily, fitness, fitnessChartData: chartData }
  }, [selectedDate, dailyCache, fitnessCache])

  const aiContext = useMemo(() => {
    const dStr = format(selectedDate, "yyyy-MM-dd")
    return buildAiContext(currentData, fitnessCache, dStr)
  }, [selectedDate, currentData, fitnessCache])


  // 🚀【重要】真の v5 アーキテクチャ：入力は自前で管理し、sendMessage と messages のみをフックから抽出する
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    api: "/api/chat",
  })

  const isChatLoading = status === 'submitted' || status === 'streaming';

  const kpiData: KpiItem[] = useMemo(() => {
    const { fitness, work, meals } = currentData

    const workScore = typeof work?.work?.score === 'number' ? work.work.score : "-"
    const devScore = typeof work?.dev?.score === 'number' ? work.dev.score : "-"
    const maxScore = Math.max(
      typeof workScore === 'number' ? workScore : 0, 
      typeof devScore === 'number' ? devScore : 0
    )
    
    const getScoreStatus = (s: number): KpiStatus => {
      if (s === 0 && workScore === "-") return "neutral"
      if (s >= 85) return "good"
      if (s >= 70) return "stable"
      if (s >= 50) return "warning"
      return "critical"
    }

    const totalMediaMins = 168 
    const mediaProgress = Math.max(0, 100 - (totalMediaMins / 240) * 100)

    const netCal = fitness?.balance ?? "-"
    const intake = fitness?.intake ?? "-"
    const burned = fitness?.burned ?? "-"
    
    const getCalStatus = (val: number | string): KpiStatus => {
      if (val === "-") return "neutral"
      const v = Number(val)
      if (v > 200) return "critical" 
      if (v > 0) return "warning"    
      if (v >= -800) return "good"   
      if (v >= -1200) return "stable" 
      if (v >= -1500) return "warning"
      return "critical"              
    }
    
    const calProgress = netCal !== "-" 
      ? Math.max(0, 100 - (Math.abs(Number(netCal) + 400) / 10)) 
      : 0

    const sleepMins = fitness?.sleepMins ?? 0
    const timeInBed = fitness?.timeInBed ?? 0
    const sleepH = sleepMins > 0 ? (sleepMins / 60).toFixed(1) : "-"
    
    const sleepEfficiency = timeInBed > 0 ? Math.round((sleepMins / timeInBed) * 100) : 0

    const getSleepStatus = (mins: number): KpiStatus => {
      if (mins === 0) return "neutral"
      if (mins >= 420) return "good"    
      if (mins >= 360) return "stable"  
      if (mins >= 300) return "warning" 
      return "critical"                 
    }

    const rhr = fitness?.restingHr ?? 0
    const rhrDisplay = rhr > 0 ? rhr : "-"
    
    const getStressStatus = (val: number): KpiStatus => {
      if (val === 0) return "neutral"
      if (val <= 65) return "good"
      if (val <= 72) return "stable"
      if (val <= 78) return "warning"
      return "critical"
    }

    return [
      { 
        id: "work", 
        label: "Concentration", 
        titleColor: "oklch(0.7 0.2 60)",
        value: (
          <div className="flex items-center gap-4">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono">{workScore}</span>
              <span className="text-[9px] opacity-40 uppercase tracking-wider">WRK</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono">{devScore}</span>
              <span className="text-[9px] opacity-40 uppercase tracking-wider">DEV</span>
            </div>
          </div>
        ), 
        status: getScoreStatus(maxScore),
        behavior: "positive",
        progress: maxScore,
        action: maxScore >= 85 ? "High performance maintained." : "Room for deep focus.", 
        icon: Zap
      },
      { 
        id: "media", 
        label: "Media", 
        titleColor: "oklch(0.75 0.15 195)",
        value: (totalMediaMins / 60).toFixed(1), 
        unit: "h", 
        status: totalMediaMins < 120 ? "good" : totalMediaMins < 240 ? "warning" : "critical",
        behavior: "negative",
        progress: mediaProgress,
        action: (
          <div className="flex items-center gap-2 font-mono text-[8px]">
            <span className="text-rose-400">YT:1.2h</span>
            <span className="text-cyan-400">UN:1.0h</span>
            <span className="text-lime-400">DZ:0.3h</span>
          </div>
        ), 
        icon: MonitorPlay 
      },
      { 
        id: "calorie", 
        label: "Metabolic", 
        titleColor: "oklch(0.65 0.22 25)",
        value: netCal !== "-" ? (Number(netCal) > 0 ? `+${netCal}` : netCal) : "-", 
        unit: "kcal", 
        status: getCalStatus(netCal),
        behavior: "balanced",
        progress: calProgress,
        action: (
          <div className="flex items-center justify-between w-full font-mono text-[8px]">
            <span>IN:<span className="text-emerald-400 ml-1">{intake}</span></span>
            <span>OUT:<span className="text-orange-400 ml-1">{burned}</span></span>
          </div>
        ), 
        icon: Flame 
      },
      { 
        id: "steps", 
        label: "Steps", 
        titleColor: "oklch(0.7 0.2 145)",
        value: fitness?.steps?.toLocaleString() ?? "-", 
        unit: "steps", 
        status: !fitness ? "neutral" : (fitness.steps > 8000 ? "good" : fitness.steps > 5000 ? "stable" : "warning"),
        behavior: "positive",
        progress: fitness ? Math.min(100, (fitness.steps / 10000) * 100) : 0,
        action: `Target: 10,000 steps`, 
        icon: Footprints 
      },
      { 
        id: "sleep", 
        label: "Sleep", 
        value: sleepH, 
        unit: "h", 
        status: getSleepStatus(sleepMins),
        behavior: "positive",
        progress: Math.min(100, (sleepMins / 480) * 100),
        action: sleepEfficiency > 0 ? `Sleep Efficiency: ${sleepEfficiency}%` : "No sleep data", 
        icon: Moon 
      },
      { 
        id: "mental", 
        label: "Stress", 
        value: rhrDisplay, 
        unit: "bpm", 
        status: getStressStatus(rhr),
        behavior: "balanced",
        progress: rhr > 0 ? Math.min(100, Math.max(0, 100 - ((rhr - 50) / 40) * 100)) : 0, 
        action: rhr > 72 ? "Elevated heart rate detected." : "Physiological state stable.", 
        icon: Brain 
      }
    ]
  }, [currentData])

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setLastUpdate(new Date().toLocaleTimeString('ja-JP')), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const REFRESH_INTERVAL_MS = 1000 * 60 * 15 

    const timer = setInterval(() => {
      const todayStr = format(new Date(), "yyyy-MM-dd")
      const currentSelectedStr = format(selectedDate, "yyyy-MM-dd")

      if (currentSelectedStr === todayStr) {
        console.log(`[Auto Refresh] Fetching latest data for ${todayStr}...`)
        
        fetchedDaily.current.delete(todayStr)
        fetchedFitnessDates.current.delete(todayStr)

        fetchDailyBulk(todayStr, 1)
        fetchFitnessBulk(todayStr) 
      }
    }, REFRESH_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [mounted, selectedDate, fetchDailyBulk, fetchFitnessBulk])

  if (!mounted) return <div className="h-screen w-screen bg-background" />

  return (
    <div className="h-screen w-screen bg-background p-3 flex flex-col overflow-hidden">
      <header className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[oklch(0.75_0.15_195/0.15)] neon-border-cyan flex items-center justify-center">
              <Activity className="w-4 h-4 text-[oklch(0.75_0.15_195)]" suppressHydrationWarning />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground glow-text-cyan tracking-tight">Life Log Dashboard</h1>
              <p className="text-[10px] text-muted-foreground font-mono">
                {format(selectedDate, "yyyy/MM/dd (E)", { locale: ja })}
              </p>
            </div>
          </div>
          <span className="text-[10px] text-[oklch(0.75_0.15_195/0.8)] font-mono">v1.0</span>
        </div>
        <DatePicker date={selectedDate} onDateChange={setSelectedDate} />
      </header>

      <div className="flex-1 flex gap-3 min-h-0">
        <div className="w-[30%] flex flex-col gap-2 min-h-0">
          <div className="cyber-card rounded-xl p-3 flex flex-col min-h-0" style={{ flex: '0 0 auto', maxHeight: '42%' }}>
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h2 className="text-xs font-semibold text-[oklch(0.75_0.15_195)]">KPI</h2>
              <PeriodSelector value={summaryPeriod} onChange={setSummaryPeriod} size="sm" />
            </div>
            <div className="flex-1 overflow-auto">
              <KpiBoard kpis={kpiData} />
            </div>
          </div>

          <div className="cyber-card-green rounded-xl p-3 flex flex-col min-h-0" style={{ flex: '0 0 auto', maxHeight: '26%' }}>
            <h2 className="text-xs font-semibold text-[oklch(0.7_0.2_145)] mb-2 shrink-0">Today&apos;s AI Feedback</h2>
            <div className="flex-1 overflow-auto">
              <AiFeedback feedback={sampleFeedback} />
            </div>
          </div>

          <div className="flex-1 cyber-card rounded-xl p-3 flex flex-col min-h-0">
            <div className="text-[10px] text-[oklch(0.75_0.15_195)] mb-2 font-semibold flex items-center justify-between">
              <span>Ask AI Assistant</span>
              {isChatLoading && <span className="text-[oklch(0.7_0.2_60)] animate-pulse">Thinking...</span>}
            </div>
            
            {/* メッセージ履歴エリア */}
            <div className="flex-1 overflow-auto mb-3 space-y-3 pr-2">
              {messages.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  What insights do you need from today's log?
                </p>
              )}

              {messages.map((m) => {
                const text =
                  m.parts
                    ?.filter((part) => part.type === "text")
                    .map((part: any) => part.text)
                    .join("") ?? ""

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`
                        inline-block p-2.5 rounded-lg text-xs leading-relaxed max-w-[90%] whitespace-pre-wrap
                        ${
                          m.role === "user"
                            ? "bg-[oklch(0.75_0.15_195/0.15)] text-[oklch(0.75_0.15_195)] border border-[oklch(0.75_0.15_195/0.3)]"
                            : "bg-[oklch(0.12_0.02_250)] text-foreground/90 border border-[oklch(0.25_0.03_250)]"
                        }
                      `}
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
                  if (!text) return
                  if (isChatLoading) return
                  if (status !== "ready") return

                  sendMessage(
                    {
                      role: "user",
                      parts: [{ type: "text", text }],
                    },
                    {
                      body: {
                        contextData: aiContext,
                      },
                    }
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
                disabled={isChatLoading}
              />
              <button 
                type="submit" 
                disabled={isChatLoading || !input.trim()} 
                className="px-3 py-2 bg-[oklch(0.75_0.15_195/0.15)] text-[oklch(0.75_0.15_195)] border border-[oklch(0.75_0.15_195/0.3)] rounded-md hover:bg-[oklch(0.75_0.15_195/0.25)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Terminal className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        <div className="w-[70%] flex flex-col gap-3 min-h-0">
          <div className="h-[32%] cyber-card rounded-xl p-3 flex flex-col">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h2 className="text-xs font-semibold text-[oklch(0.75_0.15_195)]">Daily Activity Log</h2>
              <div className="flex items-center gap-3">
                {isLoading && <span className="text-[10px] text-orange-400 animate-pulse font-mono">LOADING...</span>}
                <span className="text-[10px] text-muted-foreground font-mono">15min intervals</span>
                <PeriodSelector value={timelinePeriod} onChange={setTimelinePeriod} size="sm" />
              </div>
            </div>
            <div className="flex-1 flex items-center">
              <ActivityTimeline date={selectedDate} activities={currentData.activities} />
            </div>
          </div>

          <div className="flex-1 cyber-card rounded-xl p-3 flex flex-col min-h-0">
            <DetailPanel 
              date={selectedDate} 
              period={detailPeriod} 
              onPeriodChange={setDetailPeriod} 
              mealData={currentData.meals} 
              workData={currentData.work} 
              fitnessData={currentData.fitnessChartData} 
            />
          </div>
        </div>
      </div>

      <footer className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground shrink-0 px-1">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-orange-400 animate-pulse' : 'bg-[oklch(0.7_0.2_145)]'} shadow-[0_0_6px_currentColor]`} />
            <span className="font-mono">{isLoading ? 'SYNCING' : 'SYNCED'}</span>
          </span>
          <span className="font-mono text-muted-foreground ml-2">Last Update: {lastUpdate}</span>
        </div>
        <div className="flex items-center gap-4 font-mono">
          <span className="text-[oklch(0.7_0.2_145)]">Trino Bulk Cache: Active</span>
          <span className="text-[oklch(0.75_0.15_195)]">ActivityWatch: OK</span>
          <span className="text-[oklch(0.7_0.2_60)]">OwnTracks: OK</span>
        </div>
      </footer>
    </div>
  )
}
