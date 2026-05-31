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
import { DetailPanel, type LocationData, type EntertainmentData } from "@/components/dashboard/detail-panel"
import { DatePicker } from "@/components/dashboard/date-picker"
import { PeriodSelector, type Period } from "@/components/dashboard/period-selector"

// --- localStorage キャッシュユーティリティ ---
const CACHE_V = 2

const ck = (type: string, id: string) => `ldb_v${CACHE_V}_${type}_${id}`

function saveCache(key: string, data: unknown) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })) } catch {}
}

function loadCache<T>(key: string): { data: T; ts: number } | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function isCacheStale(ts: number, dateStr: string): boolean {
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`
  const maxAge = dateStr >= todayStr ? 15 * 60_000
    : dateStr >= yesterdayStr ? 2 * 60 * 60_000
    : 6 * 60 * 60_000
  return Date.now() - ts > maxAge
}

// - 型定義 -
type DailyPayload = {
  activities: any[]
  meals: any | null
  work: any | null
  feedback: AiFeedbackBySlot
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





function buildAiContext(currentData: any, fitnessCache: any[], dailyCache: Record<string, any>, dateStr: string) {
  const fitness = currentData.fitness
  const round1 = (v: number | null | undefined) =>
    v != null ? Math.round(v * 10) / 10 : null

  // ── 活動タイムライン集計（時間帯別・カテゴリ別）──────────────────
  const activityByPeriod: Record<string, Record<string, number>> = {
    morning: {}, afternoon: {}, evening: {}, night: {}
  }
  const activityTotal: Record<string, number> = {}
  for (const act of currentData.activities ?? []) {
    if (!act.cat_main || act.cat_main === "UNKNOWN" || act.cat_main === "UNOBSERVED") continue
    const h = act.startHour
    const period = h < 12 ? "morning" : h < 18 ? "afternoon" : h < 22 ? "evening" : "night"
    const mins = (act.overlapSec || 0) / 60
    activityByPeriod[period][act.cat_main] = (activityByPeriod[period][act.cat_main] ?? 0) + mins
    activityTotal[act.cat_main] = (activityTotal[act.cat_main] ?? 0) + mins
  }
  const roundMins = (obj: Record<string, number>) =>
    Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, Math.round(v)]).filter(([, v]) => v > 0))

  // ── 食事詳細 ──────────────────────────────────────────────────────
  const meals = currentData.meals?.meals
  const nutrition = currentData.meals?.nutrition
  const mealsCtx = meals ? {
    breakfast: meals.breakfast?.items?.length ? `${meals.breakfast.items.join("・")} (${meals.breakfast.calories}kcal)` : null,
    lunch: meals.lunch?.items?.length ? `${meals.lunch.items.join("・")} (${meals.lunch.calories}kcal)` : null,
    dinner: meals.dinner?.items?.length ? `${meals.dinner.items.join("・")} (${meals.dinner.calories}kcal)` : null,
    snack: meals.snack?.items?.length ? `${meals.snack.items.join("・")} (${meals.snack.calories}kcal)` : null,
    nutrition: nutrition ? Object.fromEntries(
      nutrition.map((n: any) => [n.name, `${n.current}${n.unit} (target:${n.target})`])
    ) : null,
  } : null

  // ── 仕事・開発アプリ内訳 ──────────────────────────────────────────
  const workApps = currentData.work?.work?.apps?.slice(0, 5).map((a: any) =>
    `${a.name}(${Math.round(a.value / 60)}min)`) ?? []
  const devApps = currentData.work?.dev?.apps?.slice(0, 5).map((a: any) =>
    `${a.name}(${Math.round(a.value / 60)}min)`) ?? []

  // ── 今日のコンテキスト ────────────────────────────────────────────
  const todayCtx = {
    sleep_hours: fitness?.sleepMins ? round1(fitness.sleepMins / 60) : null,
    sleep_deep_min: fitness?.deepMins ?? null,
    sleep_rem_min: fitness?.remMins ?? null,
    sleep_efficiency_pct: fitness?.timeInBed > 0
      ? Math.round((fitness.sleepMins / fitness.timeInBed) * 100) : null,
    steps: fitness?.steps ?? null,
    calorie_balance: fitness?.balance ?? null,
    calories_in: fitness?.intake ?? null,
    resting_hr: fitness?.restingHr ?? null,
    weight_kg: fitness?.weightKg ?? null,
    work_score: currentData?.work?.work?.score ?? null,
    dev_score: currentData?.work?.dev?.score ?? null,
    work_focus_pct: currentData?.work?.work?.focusRate ?? null,
    work_hours: currentData?.work?.work?.coreSec ? round1(currentData.work.work.coreSec / 3600) : null,
    dev_hours: currentData?.work?.dev?.coreSec ? round1(currentData.work.dev.coreSec / 3600) : null,
    work_apps: workApps.length ? workApps : null,
    dev_apps: devApps.length ? devApps : null,
    activity_total_minutes: roundMins(activityTotal),
    activity_by_period: {
      morning: roundMins(activityByPeriod.morning),
      afternoon: roundMins(activityByPeriod.afternoon),
      evening: roundMins(activityByPeriod.evening),
      night: roundMins(activityByPeriod.night),
    },
    meals: mealsCtx,
  }

  // ── 過去14日トレンド（fitness + work を結合）────────────────────────
  const sorted = [...fitnessCache].sort((a, b) => b.date.localeCompare(a.date))
  const past14 = sorted.slice(0, 14).map((d) => ({
    date: d.date,
    sleep_hours: d.sleepMins ? round1(d.sleepMins / 60) : null,
    steps: d.steps ?? null,
    calorie_balance: d.balance ?? null,
    resting_hr: d.restingHr ?? null,
    work_score: dailyCache[d.date]?.work?.work?.score ?? null,
    dev_score: dailyCache[d.date]?.work?.dev?.score ?? null,
    work_focus_pct: dailyCache[d.date]?.work?.work?.focusRate ?? null,
    work_hours: dailyCache[d.date]?.work?.work?.coreSec
      ? round1(dailyCache[d.date].work.work.coreSec / 3600) : null,
  }))

  const last7 = sorted.slice(0, 7)
  const avg = (vals: (number | null)[]) => {
    const valid = vals.filter((v): v is number => v != null)
    return valid.length ? round1(valid.reduce((a, b) => a + b, 0) / valid.length) : null
  }

  const last7Work = last7.map((d) => dailyCache[d.date]?.work?.work?.score ?? null)
  const last7Dev  = last7.map((d) => dailyCache[d.date]?.work?.dev?.score ?? null)

  return {
    target_date: dateStr,
    today: todayCtx,
    past_14_days: past14,
    averages_7d: {
      sleep_hours: avg(last7.map((d) => d.sleepMins ? d.sleepMins / 60 : null)),
      steps: avg(last7.map((d) => d.steps)),
      calorie_balance: avg(last7.map((d) => d.balance)),
      resting_hr: avg(last7.map((d) => d.restingHr)),
      work_score: avg(last7Work),
      dev_score: avg(last7Dev),
    },
  }
}

export default function LifeDashboard() {
  // 🚀 1. ステート管理
  const [dailyCache, setDailyCache] = useState<Record<string, DailyPayload>>({})
  const [fitnessCache, setFitnessCache] = useState<any[]>([])
  const [locationCache, setLocationCache] = useState<Record<string, LocationData>>({})
  // stateの最新値をrefで追跡（useEffect内からdepsなしで参照するため）
  useEffect(() => { dailyCacheRef.current = dailyCache }, [dailyCache])
  useEffect(() => { fitnessCacheRef.current = fitnessCache }, [fitnessCache])
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

  // 並列リクエスト重複防止（同一キーの同時fetch防止のみ、再fetchはキャッシュ鮮度で制御）
  const fetchingDaily = useRef<Set<string>>(new Set())
  const fetchingFitness = useRef<Set<string>>(new Set())
  // dailyCacheの最新値をエフェクト内から安全に参照するためのref
  const dailyCacheRef = useRef(dailyCache)
  const fitnessCacheRef = useRef(fitnessCache)

  // 🚀 3. UI制御ステート
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isLoading, setIsLoading] = useState(true)
  const [summaryPeriod, setSummaryPeriod] = useState<Period>("day")
  const [timelinePeriod, setTimelinePeriod] = useState<Period>("day")
  const [detailPeriod, setDetailPeriod] = useState<Period>("day")
  const [activeTab, setActiveTab] = useState("work")
  const [mounted, setMounted] = useState(false)
  const [lastUpdate, setLastUpdate] = useState("")

  const fetchDailyBulk = useCallback(async (targetDateStr: string, days: number = 14) => {
    if (fetchingDaily.current.has(targetDateStr)) return

    const key = ck('bulk', `${targetDateStr}_${days}`)
    const cached = loadCache<any[]>(key)

    if (cached?.data) {
      setDailyCache(prev => {
        const next = { ...prev }
        cached.data.forEach((d: any) => {
          if (d.date) next[d.date] = { activities: d.activities || [], meals: d.meals || null, work: d.work || null, feedback: d.feedback || {} }
        })
        return next
      })
      if (!isCacheStale(cached.ts, targetDateStr)) return
    }

    fetchingDaily.current.add(targetDateStr)
    try {
      const res = await fetch(`/api/bulk?endDate=${targetDateStr}&days=${days}`)
      if (!res.ok) throw new Error(`Daily bulk failed: ${res.status}`)
      const dataArray = await res.json()
      saveCache(key, dataArray)
      setDailyCache(prev => {
        const next = { ...prev }
        dataArray.forEach((d: any) => {
          if (d.date) next[d.date] = { activities: d.activities || [], meals: d.meals || null, work: d.work || null, feedback: d.feedback || {} }
        })
        return next
      })
    } catch (e) {
      console.error("Daily bulk fetch error:", e)
    } finally {
      fetchingDaily.current.delete(targetDateStr)
    }
  }, [])

  const fetchFitnessBulk = useCallback(async (endDateStr: string) => {
    if (fetchingFitness.current.has(endDateStr)) return

    const key = ck('fitness', endDateStr)
    const cached = loadCache<any[]>(key)

    if (cached?.data) {
      setFitnessCache(prev => {
        const byDate = new Map<string, any>()
        for (const row of prev) byDate.set(row.date, row)
        for (const row of cached.data) byDate.set(row.date, row)
        return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
      })
      if (!isCacheStale(cached.ts, endDateStr)) return
    }

    fetchingFitness.current.add(endDateStr)
    try {
      const res = await fetch(`/api/fitness?date=${endDateStr}&days=90`)
      if (!res.ok) throw new Error(`Fitness bulk failed: ${res.status}`)
      const data = await res.json()
      const arr = Array.isArray(data) ? data : [data]
      saveCache(key, arr)
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

  const chatSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchLocation = useCallback(async (dateStr: string) => {
    const key = ck('location', dateStr)
    const cached = loadCache<LocationData>(key)

    if (cached?.data) {
      setLocationCache(prev => ({ ...prev, [dateStr]: cached.data }))
      if (!isCacheStale(cached.ts, dateStr)) return
    }

    try {
      const res = await fetch(`/api/location?date=${dateStr}`)
      if (!res.ok) throw new Error(`Location fetch failed: ${res.status}`)
      const data = await res.json()
      const locationData = { stays: data.stays || [], transits: data.transits || [] }
      saveCache(key, locationData)
      setLocationCache(prev => ({ ...prev, [dateStr]: locationData }))
    } catch (e) {
      console.error(`Location fetch error for ${dateStr}:`, e)
    }
  }, [])

  const handleMessagesChange = useCallback((messages: any[]) => {
    setChatHistory(messages)
    try { localStorage.setItem("chat-messages", JSON.stringify(messages.slice(-100))) } catch {}
    // デバウンスしてTrinoに保存（3秒後、最後のメッセージから）
    if (chatSaveTimer.current) clearTimeout(chatSaveTimer.current)
    chatSaveTimer.current = setTimeout(() => {
      fetch("/api/chat-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messages.slice(-100) }),
      }).catch(console.error)
    }, 3000)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const loadData = async () => {
      const dStr = format(selectedDate, "yyyy-MM-dd")

      const hasInMemory = !!dailyCacheRef.current[dStr] &&
        fitnessCacheRef.current.some((f: any) => f.date === dStr)
      const hasBulkCache = !!loadCache(ck('bulk', `${dStr}_14`))
      const hasFitnessCache = !!loadCache(ck('fitness', dStr))

      if (hasInMemory || (hasBulkCache && hasFitnessCache)) {
        // すでにstateかlocalStorageにデータあり → 即座に表示、リフレッシュはバックグラウンドで
        fetchDailyBulk(dStr, 14)
        fetchFitnessBulk(dStr)
        fetchLocation(dStr)
        setIsLoading(false)
      } else {
        // 初回ロード → 待って表示
        setIsLoading(true)
        await Promise.all([
          fetchDailyBulk(dStr, 14),
          fetchFitnessBulk(dStr),
          fetchLocation(dStr),
        ])
        setIsLoading(false)
      }
    }

    loadData()
  }, [selectedDate, mounted, fetchDailyBulk, fetchFitnessBulk, fetchLocation])

  useEffect(() => {
    const dStr = format(selectedDate, "yyyy-MM-dd")
    const fb = dailyCache[dStr]?.feedback
    const latest = fb && (["night", "noon", "morning"] as const).find(s => fb[s])
    setSelectedFeedbackSlot(latest ?? null)
  }, [selectedDate, dailyCache])

  const currentData = useMemo(() => {
    const dStr = format(selectedDate, "yyyy-MM-dd")
    const pastStr = format(subDays(selectedDate, 90), "yyyy-MM-dd")

    const daily = dailyCache[dStr] || { activities: [], meals: null, work: null }
    const fitness = fitnessCache.find(d => d.date === dStr) || null
    const chartData = fitnessCache
      .filter(d => d.date >= pastStr && d.date <= dStr)
      .sort((a, b) => a.date.localeCompare(b.date))
    const location = locationCache[dStr] ?? null

    const ENT_CATS = new Set(['MEDIA', 'MANGA', 'GAME', 'SOCIAL'])
    const subMap: Record<string, { cat_main: string; sec: number }> = {}
    for (const act of daily.activities) {
      if (!ENT_CATS.has(act.cat_main)) continue
      if (!subMap[act.cat_sub]) subMap[act.cat_sub] = { cat_main: act.cat_main, sec: 0 }
      subMap[act.cat_sub].sec += (act.overlapSec || 0)
    }
    const entertainment: EntertainmentData = {
      date: dStr,
      breakdown: Object.entries(subMap)
        .map(([name, { cat_main, sec }]) => ({ name, cat_main, minutes: Math.round(sec / 60) }))
        .filter(item => item.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes),
    }

    return { ...daily, fitness, fitnessChartData: chartData, location, entertainment }
  }, [selectedDate, dailyCache, fitnessCache, locationCache])

  const aiContext = useMemo(() => {
    const dStr = format(selectedDate, "yyyy-MM-dd")
    const base = buildAiContext(currentData, fitnessCache, dailyCache, dStr)

    // 今日のAI FBメッセージを含める
    const fb = dailyCache[dStr]?.feedback
    const aiFeedbackToday = fb
      ? (["morning", "noon", "night"] as const)
          .filter(s => fb[s])
          .map(s => ({ slot: s, messages: fb[s]!.messages }))
      : []

    // 直近60件のチャット履歴（日付をまたいだ継続的な文脈として活用）
    const recentChat = chatHistory.slice(-60).map(m => ({
      role: m.role,
      text: m.parts?.filter((p: any) => p.type === "text").map((p: any) => p.text).join("") ?? "",
    }))

    return { ...base, ai_feedback_today: aiFeedbackToday, recent_chat: recentChat }
  }, [selectedDate, currentData, fitnessCache, dailyCache, chatHistory])



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
      entByCat[act.cat_main] = (entByCat[act.cat_main] ?? 0) + (act.overlapSec || 0) / 60
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

    // タブに戻ったときにキャッシュが古ければ即更新
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return
      const dStr = format(new Date(), "yyyy-MM-dd")
      const cached = loadCache(ck('bulk', `${dStr}_14`))
      if (!cached || isCacheStale((cached as any).ts, dStr)) {
        fetchDailyBulk(dStr, 14)
        fetchFitnessBulk(dStr)
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    // Trinoからチャット履歴をロード（クロスブラウザ対応）
    fetch("/api/chat-history")
      .then(r => r.json())
      .then(({ messages }) => {
        if (messages?.length > 0) {
          setChatHistory(messages)
          try { localStorage.setItem("chat-messages", JSON.stringify(messages.slice(-100))) } catch {}
        }
      })
      .catch(console.error)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [fetchDailyBulk, fetchFitnessBulk])

  useEffect(() => {
    if (!mounted) return

    // 15分ごとにバックグラウンド更新（選択日付に関わらず実行、鮮度チェックはfetch内部で行う）
    const timer = setInterval(() => {
      const dStr = format(selectedDate, "yyyy-MM-dd")
      fetchDailyBulk(dStr, 14)
      fetchFitnessBulk(dStr)
      fetchLocation(dStr)
    }, 15 * 60_000)

    return () => clearInterval(timer)
  }, [mounted, selectedDate, fetchDailyBulk, fetchFitnessBulk, fetchLocation])

  useEffect(() => {
    if (!mounted) return

    // 常時表示ダッシュボード用: 翌朝9時に今日の日付へ自動切り替え
    // 選択日が「昨日」のときのみ切り替え（手動で過去日を閲覧中は対象外）
    const now = new Date()
    const next9am = new Date(now)
    next9am.setHours(9, 0, 0, 0)
    if (now >= next9am) next9am.setDate(next9am.getDate() + 1)

    const timer = setTimeout(() => {
      const today = new Date()
      const yesterdayStr = format(subDays(today, 1), "yyyy-MM-dd")
      if (format(selectedDate, "yyyy-MM-dd") === yesterdayStr) setSelectedDate(today)
    }, next9am.getTime() - now.getTime())

    return () => clearTimeout(timer)
  }, [mounted, selectedDate])

  if (!mounted) return <div className="h-screen w-screen bg-background" />

  return (
    <div className="min-h-screen w-full bg-background p-3 flex flex-col md:h-screen md:overflow-hidden">
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

      <div className="flex-1 flex flex-col md:flex-row gap-3 md:min-h-0">
        <div className="w-full md:w-[30%] flex flex-col gap-2 md:min-h-0">
          <div className="cyber-card rounded-xl p-3 flex flex-col md:flex-none md:max-h-[42%] md:min-h-0">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h2 className="text-xs font-semibold text-[oklch(0.75_0.15_195)]">KPI</h2>
              <PeriodSelector value={summaryPeriod} onChange={setSummaryPeriod} size="sm" />
            </div>
            <div className="flex-1 overflow-auto">
              <KpiBoard kpis={kpiData} />
            </div>
          </div>

          <div className="cyber-card-green rounded-xl p-3 md:shrink-0 md:max-h-[32%] md:overflow-auto">
            {(() => {
              const dStr = format(selectedDate, "yyyy-MM-dd")
              const fb = dailyCache[dStr]?.feedback
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

          <div className="cyber-card rounded-xl p-3 flex flex-col h-[320px] md:flex-1 md:h-auto md:min-h-0">
            <AiChatPanel
              dateStr={format(selectedDate, "yyyy-MM-dd")}
              contextData={aiContext}
              initialMessages={chatHistory}
              onMessagesChange={handleMessagesChange}
            />
          </div>
        </div>

        <div className="w-full md:w-[70%] flex flex-col gap-3 md:min-h-0">
          <div className="h-[220px] md:h-[32%] cyber-card rounded-xl p-3 flex flex-col">
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

          <div className="cyber-card rounded-xl p-3 flex flex-col min-h-[480px] md:flex-1 md:min-h-0">
            <DetailPanel
              date={selectedDate}
              period={detailPeriod}
              onPeriodChange={setDetailPeriod}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              mealData={currentData.meals}
              workData={currentData.work}
              fitnessData={currentData.fitnessChartData}
              locationData={currentData.location}
              entertainmentData={currentData.entertainment}
            />
          </div>
        </div>
      </div>

      <footer className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground shrink-0 px-1 md:block">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-orange-400 animate-pulse' : 'bg-[oklch(0.7_0.2_145)]'} shadow-[0_0_6px_currentColor]`} />
            <span className="font-mono">{isLoading ? 'SYNCING' : 'SYNCED'}</span>
          </span>
          <span className="font-mono text-muted-foreground ml-2">Last Update: {lastUpdate}</span>
        </div>
        <div className="hidden md:flex items-center gap-4 font-mono">
          <span className="text-[oklch(0.7_0.2_145)]">Trino Bulk Cache: Active</span>
          <span className="text-[oklch(0.75_0.15_195)]">ActivityWatch: OK</span>
          <span className="text-[oklch(0.7_0.2_60)]">OwnTracks: OK</span>
        </div>
      </footer>
    </div>
  )
}
