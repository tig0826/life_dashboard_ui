"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { format, subDays, addDays } from "date-fns"
import { ja } from "date-fns/locale"
import { 
  Activity, Zap, MonitorPlay, Flame, Footprints, Moon, Brain
} from "lucide-react"
import { KpiBoard, type KpiItem, type KpiStatus } from "@/components/dashboard/kpi-board"
import { ActivityTimeline } from "@/components/dashboard/activity-timeline"
import { AiFeedback } from "@/components/dashboard/ai-feedback"
import { AiChatPanel } from "@/components/dashboard/ai-chat-panel"
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

type FeedbackMessage = {
  type: "positive" | "warning" | "insight"
  message: string
}

type AiFeedbackBySlot = Record<AiFeedbackSlot, {
  generatedAt: string
  messages: FeedbackMessage[]
  model: string
} | undefined>

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





function buildAiContext(currentData: any, fitnessCache: any[], dateStr: string) {
  const today = currentData.fitness

  const round1 = (v: number | null | undefined) =>
    v != null ? Math.round(v * 10) / 10 : null

  // 今日
  const todayCtx = {
    sleep_hours: today?.sleepMins ? round1(today.sleepMins / 60) : null,
    steps: today?.steps ?? null,
    calorie_balance: today?.balance ?? null,
    resting_hr: today?.restingHr ?? null,
    work_score: typeof currentData?.work?.work?.score === "number" ? currentData.work.work.score : null,
    dev_score: typeof currentData?.work?.dev?.score === "number" ? currentData.work.dev.score : null,
  }

  // 過去14日の日別データ（日付降順）
  const sorted = [...fitnessCache].sort((a, b) => b.date.localeCompare(a.date))
  const past14 = sorted.slice(0, 14).map((d) => ({
    date: d.date,
    sleep_hours: d.sleepMins ? round1(d.sleepMins / 60) : null,
    steps: d.steps ?? null,
    calorie_balance: d.balance ?? null,
    resting_hr: d.restingHr ?? null,
  }))

  // 過去7日平均
  const last7 = sorted.slice(0, 7)
  const avg = (vals: (number | null)[]) => {
    const valid = vals.filter((v): v is number => v != null)
    return valid.length ? round1(valid.reduce((a, b) => a + b, 0) / valid.length) : null
  }

  return {
    target_date: dateStr,
    today: todayCtx,
    past_14_days: past14,
    averages_7d: {
      sleep_hours: avg(last7.map((d) => d.sleepMins ? d.sleepMins / 60 : null)),
      steps: avg(last7.map((d) => d.steps)),
      calorie_balance: avg(last7.map((d) => d.balance)),
      resting_hr: avg(last7.map((d) => d.restingHr)),
    },
  }
}

export default function LifeDashboard() {
  // 🚀 1. ステート管理
  const [dailyCache, setDailyCache] = useState<Record<string, DailyPayload>>({})
  const [fitnessCache, setFitnessCache] = useState<any[]>([])
  const [feedbackCache, setFeedbackCache] = useState<Record<string, AiFeedbackBySlot>>({})
  const [selectedFeedbackSlot, setSelectedFeedbackSlot] = useState<AiFeedbackSlot | null>(null)
  const [chatHistory, setChatHistory] = useState<any[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const saved = localStorage.getItem("chat-messages")
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // 🚀 2. ロック機構
  const fetchedDaily = useRef<Set<string>>(new Set())
  const fetchingDaily = useRef<Set<string>>(new Set())
  const fetchedFitnessDates = useRef<Set<string>>(new Set())
  const fetchingFitness = useRef<Set<string>>(new Set())
  const fetchedFeedback = useRef<Set<string>>(new Set())

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

  const fetchFeedback = useCallback(async (dateStr: string) => {
    if (fetchedFeedback.current.has(dateStr)) return

    fetchedFeedback.current.add(dateStr)
    try {
      const res = await fetch(`/api/feedback?date=${dateStr}`)
      if (!res.ok) return
      const data = await res.json()
      setFeedbackCache(prev => ({ ...prev, [dateStr]: data }))
      const latest = (["night", "noon", "morning"] as const).find(s => data[s])
      if (latest) setSelectedFeedbackSlot(latest)
    } catch (e) {
      console.error(`Feedback fetch error for ${dateStr}:`, e)
    }
  }, [])

  const handleMessagesChange = useCallback((messages: any[]) => {
    setChatHistory(messages)
    try {
      localStorage.setItem("chat-messages", JSON.stringify(messages.slice(-100)))
    } catch {}
  }, [])

  useEffect(() => {
    if (!mounted) return

    const loadData = async () => {
      const dStr = format(selectedDate, "yyyy-MM-dd")

      setIsLoading(true)
      await Promise.all([
        fetchDailyBulk(dStr, 14),
        fetchFitnessBulk(dStr),
        fetchFeedback(dStr),
      ])
      setIsLoading(false)

      setTimeout(() => {
        const pastDateStr = format(subDays(selectedDate, 14), "yyyy-MM-dd")
        fetchDailyBulk(pastDateStr, 14)
      }, 3000)
    }

    loadData()
  }, [selectedDate, mounted, fetchDailyBulk, fetchFitnessBulk, fetchFeedback])

  useEffect(() => {
    const dStr = format(selectedDate, "yyyy-MM-dd")
    const fb = feedbackCache[dStr]
    const latest = fb && (["night", "noon", "morning"] as const).find(s => fb[s])
    setSelectedFeedbackSlot(latest ?? null)
  }, [selectedDate, feedbackCache])

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
    const base = buildAiContext(currentData, fitnessCache, dStr)

    // 今日のAI FBメッセージを含める
    const fb = feedbackCache[dStr]
    const aiFeedbackToday = fb
      ? (["morning", "noon", "night"] as const)
          .filter(s => fb[s])
          .map(s => ({ slot: s, messages: fb[s]!.messages }))
      : []

    // 直近20件のチャット履歴（アシスタントに記憶させる）
    const recentChat = chatHistory.slice(-20).map(m => ({
      role: m.role,
      text: m.parts?.filter((p: any) => p.type === "text").map((p: any) => p.text).join("") ?? "",
    }))

    return { ...base, ai_feedback_today: aiFeedbackToday, recent_chat: recentChat }
  }, [selectedDate, currentData, fitnessCache, feedbackCache, chatHistory])



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

    const ENT_KPI_CATS: Record<string, string> = { MEDIA: "動画", MANGA: "漫画", GAME: "ゲーム", SOCIAL: "SNS" }
    const ENT_KPI_COLORS: Record<string, string> = {
      MEDIA: "oklch(0.60 0.25 20)", MANGA: "oklch(0.65 0.25 340)",
      GAME: "oklch(0.60 0.25 300)", SOCIAL: "oklch(0.45 0.10 290)",
    }
    const entByCat: Record<string, number> = {}
    for (const act of currentData.activities) {
      if (!(act.cat_main in ENT_KPI_CATS)) continue
      entByCat[act.cat_main] = (entByCat[act.cat_main] ?? 0) + (act.endHour - act.startHour) * 60
    }
    const totalMediaMins = Math.round(Object.values(entByCat).reduce((a, b) => a + b, 0))
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
        label: "Leisure",
        titleColor: "oklch(0.60 0.25 20)",
        value: totalMediaMins === 0 ? "-" : (totalMediaMins / 60).toFixed(1),
        unit: totalMediaMins === 0 ? undefined : "h",
        status: totalMediaMins === 0 ? "neutral" : totalMediaMins < 120 ? "good" : totalMediaMins < 240 ? "warning" : "critical",
        behavior: "negative",
        progress: mediaProgress,
        action: totalMediaMins === 0 ? "No leisure today." : (
          <div className="flex items-center gap-1.5 font-mono text-[8px]">
            {Object.entries(entByCat).sort((a, b) => b[1] - a[1]).map(([cat, min]) => (
              <span key={cat} className="whitespace-nowrap" style={{ color: ENT_KPI_COLORS[cat] }}>
                {ENT_KPI_CATS[cat]}{(min / 60).toFixed(1)}h
              </span>
            ))}
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

          <div className="cyber-card-green rounded-xl p-3 shrink-0" style={{ maxHeight: '32%' }}>
            {(() => {
              const dStr = format(selectedDate, "yyyy-MM-dd")
              const fb = feedbackCache[dStr]
              const slotLabels: { key: AiFeedbackSlot; label: string }[] = [
                { key: "morning", label: "朝" },
                { key: "noon",    label: "昼" },
                { key: "night",   label: "夜" },
              ]
              const activeSlot = selectedFeedbackSlot
              const messages = activeSlot ? fb?.[activeSlot]?.messages ?? [] : []
              const generatedAt = activeSlot ? fb?.[activeSlot]?.generatedAt : null
              return (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-semibold text-[oklch(0.7_0.2_145)]">AI Feedback</h2>
                    <div className="flex items-center gap-1">
                      {slotLabels.map(({ key, label }) => {
                        const available = !!fb?.[key]
                        const active = activeSlot === key
                        return (
                          <button
                            key={key}
                            disabled={!available}
                            onClick={() => setSelectedFeedbackSlot(key)}
                            className={[
                              "text-[10px] px-2 py-0.5 rounded border transition-all",
                              active
                                ? "border-[oklch(0.7_0.2_145/0.8)] bg-[oklch(0.7_0.2_145/0.15)] text-[oklch(0.85_0.18_145)] shadow-[0_0_6px_oklch(0.7_0.2_145/0.3)]"
                                : available
                                  ? "border-[oklch(0.7_0.2_145/0.3)] text-[oklch(0.7_0.2_145/0.7)] hover:border-[oklch(0.7_0.2_145/0.6)] hover:text-[oklch(0.8_0.2_145)]"
                                  : "border-[oklch(0.5_0.05_145/0.2)] text-[oklch(0.5_0.05_145/0.3)] cursor-not-allowed",
                            ].join(" ")}
                          >
                            {label}
                          </button>
                        )
                      })}
                      {generatedAt && (
                        <span className="text-[9px] text-muted-foreground font-mono ml-1">{String(generatedAt).slice(11, 16)}</span>
                      )}
                    </div>
                  </div>
                  {isLoading ? (
                    <p className="text-[11px] text-muted-foreground italic">Loading...</p>
                  ) : !activeSlot || messages.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic">未生成 (朝8時・昼13時・夜22時)</p>
                  ) : (
                    <AiFeedback feedback={messages} />
                  )}
                </>
              )
            })()}
          </div>

          <div className="flex-1 cyber-card rounded-xl p-3 flex flex-col min-h-0">
            <AiChatPanel
              dateStr={format(selectedDate, "yyyy-MM-dd")}
              contextData={aiContext}
              initialMessages={chatHistory}
              onMessagesChange={handleMessagesChange}
            />
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
              activities={currentData.activities}
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
