"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { format, subDays, addDays } from "date-fns"
import { ja } from "date-fns/locale"
import { 
  Activity, Zap, MonitorPlay, Flame, Footprints, Moon, Brain 
} from "lucide-react" 
import { KpiBoard, type KpiItem } from "@/components/dashboard/kpi-board"
import { ActivityTimeline } from "@/components/dashboard/activity-timeline"
import { AiFeedback } from "@/components/dashboard/ai-feedback"
import { DetailPanel } from "@/components/dashboard/detail-panel"
import { DatePicker } from "@/components/dashboard/date-picker"
import { AiChatInput } from "@/components/dashboard/ai-chat-input"
import { PeriodSelector, type Period } from "@/components/dashboard/period-selector"

// --- 型定義 ---
type DailyPayload = {
  activities: any[]
  meals: any | null
  work: any | null
}

const sampleFeedback = [
  { type: "positive" as const, message: "作業集中時間が前日比+15%向上。深夜のPC使用を控えた効果が出ています。" },
  { type: "warning" as const, message: "今週の野菜摂取量が目標の60%。夕食にサラダ追加を推奨します。" },
  { type: "insight" as const, message: "睡眠スコアと翌日の作業効率に強い相関を検出。22時就寝が最適パターンです。" },
]

export default function LifeDashboard() {
  // 🚀 1. ステート管理
  const [dailyCache, setDailyCache] = useState<Record<string, DailyPayload>>({})
  const [fitnessCache, setFitnessCache] = useState<any[]>([])

  // 🚀 2. ロック機構（ChatGPT案を採用 ＋ 離散ジャンプ対応のSet）
  const fetchedDaily = useRef<Set<string>>(new Set())
  const fetchingDaily = useRef<Set<string>>(new Set())
  const fetchedFitnessDates = useRef<Set<string>>(new Set()) // 取得済みのフィットネス日を全て記録
  const fetchingFitness = useRef<Set<string>>(new Set())

  // 🚀 3. UI制御ステート
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isLoading, setIsLoading] = useState(true)
  const [summaryPeriod, setSummaryPeriod] = useState<Period>("day")
  const [timelinePeriod, setTimelinePeriod] = useState<Period>("day")
  const [detailPeriod, setDetailPeriod] = useState<Period>("day")
  const [aiResponse, setAiResponse] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [lastUpdate, setLastUpdate] = useState("")

  // 🚀 4. 【日次フェッチャー】毒キャッシュを防止し、確実なデータのみ保存
const fetchDailyBulk = useCallback(async (endDateStr: string, days: number = 14) => {
    // 基準日がすでに取得済みならスキップ
    if (fetchedDaily.current.has(endDateStr)) return
    if (fetchingDaily.current.has(endDateStr)) return

    fetchingDaily.current.add(endDateStr)

    try {
      const res = await fetch(`/api/dashboard/bulk?endDate=${endDateStr}&days=${days}`)
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
        })
        return nextCache
      })
    } catch (e) {
      console.error("Daily bulk fetch error:", e)
    } finally {
      fetchingDaily.current.delete(endDateStr)
    }
  }, [])

  // 🚀 5. 【フィットネス・バルク】重複リクエストを完全に殺す O(1) ガード
  const fetchFitnessBulk = useCallback(async (endDateStr: string) => {
    // ターゲットの日付が既にSetにあるなら、90日クエリは絶対に走らせない
    if (fetchedFitnessDates.current.has(endDateStr)) return
    if (fetchingFitness.current.has(endDateStr)) return

    fetchingFitness.current.add(endDateStr)

    try {
      const res = await fetch(`/api/fitness?date=${endDateStr}&days=90`)
      if (!res.ok) throw new Error(`Fitness bulk failed: ${res.status}`)

      const data = await res.json()
      const arr = Array.isArray(data) ? data : [data]

      // 取得した90日分の日付を "全て" 取得済みとしてマークする
      arr.forEach(d => fetchedFitnessDates.current.add(d.date))

      // ChatGPT提案の Map を使った美しいマージ・ソートロジック
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

  // 🚀 6. 【メインオーケストレーター】連帯責任の解除
  useEffect(() => {
    if (!mounted) return

    const loadData = async () => {
      const dStr = format(selectedDate, "yyyy-MM-dd")

      // 1. 今見ている日が含まれる「過去14日間」をドカッと取る
      setIsLoading(true)
      await Promise.all([
        fetchDailyBulk(dStr, 14), 
        fetchFitnessBulk(dStr) // こちらは120日分
      ])
      setIsLoading(false)

      // 2. 画面が表示された3秒後に、さらに「その前の14日間」を裏でこっそり取得する
      setTimeout(() => {
        const pastDateStr = format(subDays(selectedDate, 14), "yyyy-MM-dd")
        fetchDailyBulk(pastDateStr, 14)
      }, 3000)
    }

    loadData()
  }, [selectedDate, mounted, fetchDailyBulk, fetchFitnessBulk])

  // 🚀 7. データ抽出 & KPI計算
  const currentData = useMemo(() => {
    const dStr = format(selectedDate, "yyyy-MM-dd")
    const daily = dailyCache[dStr] || { activities: [], meals: null, work: null }
    const fitness = fitnessCache.find(d => d.date === dStr) || null
    
    const chartData = fitnessCache
      .filter(d => new Date(d.date) <= selectedDate && new Date(d.date) >= subDays(selectedDate, 90))
      .sort((a, b) => a.date.localeCompare(b.date))

    return { ...daily, fitness, fitnessChartData: chartData }
  }, [selectedDate, dailyCache, fitnessCache])

  const kpiData: KpiItem[] = useMemo(() => {
    const { fitness, work, meals } = currentData
    const workIQ = work?.work?.focusRate ?? "---"
    const mediaMins = 165
    const netCal = (meals?.nutrition?.find((n: any) => n.name === 'calories')?.current ?? 0) - (fitness?.burned ?? 0)
    const stressRhr = fitness?.resting_heart_rate
    const avgRhr = 72

    return [
      { id: "work", label: "Focus IQ", value: workIQ, unit: "%", status: workIQ === "---" ? "neutral" : (workIQ > 80 ? "good" : workIQ > 50 ? "neutral" : "warning"), action: workIQ === "---" ? "Syncing..." : (workIQ > 80 ? "Perfect. Keep this flow." : "Deep work session needed."), icon: Zap, color: "oklch(0.85 0.18 90)" },
      { id: "media", label: "Media Usage", value: mediaMins ? (mediaMins / 60).toFixed(1) : "---", unit: "h", status: !mediaMins ? "neutral" : (mediaMins < 120 ? "good" : mediaMins < 240 ? "warning" : "critical"), action: !mediaMins ? "Syncing..." : (mediaMins < 120 ? "Good time management." : "Switching to Dev mode."), icon: MonitorPlay, color: "oklch(0.65 0.18 340)" },
      { id: "calorie", label: "Metabolic", value: isNaN(netCal) ? "---" : (netCal > 0 ? `+${netCal}` : netCal), unit: "kcal", status: isNaN(netCal) ? "neutral" : (netCal < 100 ? "good" : netCal < 500 ? "warning" : "critical"), action: isNaN(netCal) ? "Syncing..." : (netCal < 100 ? "On track for goals." : "Night walk required."), icon: Flame, color: "oklch(0.65 0.22 25)" },
      { id: "steps", label: "Vitality", value: fitness?.steps?.toLocaleString() ?? "---", unit: "steps", status: !fitness ? "neutral" : (fitness.steps > 8000 ? "good" : "warning"), action: !fitness ? "Syncing..." : (fitness.steps > 8000 ? "Active day." : "Need a short walk."), icon: Footprints, color: "oklch(0.6 0.18 250)" },
      { id: "sleep", label: "Recovery", value: fitness?.sleepMins ? (fitness.sleepMins / 60).toFixed(1) : "---", unit: "h", status: !fitness ? "neutral" : (fitness.sleepMins > 420 ? "good" : "critical"), action: !fitness ? "Syncing..." : (fitness.sleepMins > 420 ? "Fully charged." : "Prioritize sleep tonight."), icon: Moon, color: "oklch(0.55 0.18 250)" },
      { id: "mental", label: "Stress", value: stressRhr ? stressRhr - avgRhr : "---", unit: "bpm", status: !stressRhr ? "neutral" : ((stressRhr - avgRhr) < 3 ? "good" : (stressRhr - avgRhr) < 6 ? "warning" : "critical"), action: !stressRhr ? "Syncing..." : ((stressRhr - avgRhr) < 3 ? "State stable." : "Take a deep breath."), icon: Brain, color: "oklch(0.8 0.15 20)" }
    ]
  }, [currentData])

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setLastUpdate(new Date().toLocaleTimeString('ja-JP')), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleAiQuestion = (message: string) => {
    setAiResponse(`「${message}」について分析中...\n\n昨日の集中力低下の主な要因として、以下が考えられます：\n1. 睡眠時間が通常より1.5時間短かった\n2. 14時以降のAFK率が通常の2倍\n3. 昼食後のYouTube視聴時間が増加`)
  }
  
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
              <h1 className="text-base font-bold text-foreground glow-text-cyan tracking-tight">Life Dashboard</h1>
              <p className="text-[10px] text-muted-foreground font-mono">
                {format(selectedDate, "yyyy/MM/dd (E)", { locale: ja })}
              </p>
            </div>
          </div>
          <span className="text-[10px] text-[oklch(0.75_0.15_195/0.8)] font-mono">v3.2</span>
        </div>
        <DatePicker date={selectedDate} onDateChange={setSelectedDate} />
      </header>

      <div className="flex-1 flex gap-3 min-h-0">
        <div className="w-[30%] flex flex-col gap-2 min-h-0">
          <div className="cyber-card rounded-xl p-3 flex flex-col min-h-0" style={{ flex: '0 0 auto', maxHeight: '42%' }}>
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h2 className="text-xs font-semibold text-[oklch(0.75_0.15_195)]">AI Summary & KPI</h2>
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
