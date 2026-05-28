// Server-side in-memory cache for Trino query results.
// Initialized at pod startup via instrumentation.ts.
// Survives across HTTP requests; lost only on pod restart.

import { Trino } from 'trino-client'
import { eachDayOfInterval, parseISO, subDays, format } from 'date-fns'

// --- Types ---
export type DayBulkData = {
  date: string
  activities: any[]
  meals: any | null
  work: any | null
  feedback: Record<string, any>
}

export type FitnessDay = {
  date: string
  steps: number
  burned: number
  intake: number
  balance: number
  weight: number | null
  bodyFat: number | null
  activities: string[]
  weight7dAvg: number | null
  restingHr: number
  sleepMins: number
  timeInBed: number
}

type CacheEntry<T> = { data: T; ts: number }

// --- Cache stores (module-level = process-lifetime) ---
const bulkCache = new Map<string, CacheEntry<DayBulkData>>()
const fitnessCache = new Map<string, CacheEntry<FitnessDay>>()

// Inflight deduplication: if a date is being fetched, reuse the same Promise
const bulkInflight = new Map<string, Promise<DayBulkData>>()
const fitnessInflight = new Map<string, Promise<FitnessDay>>()

// --- Helpers ---
function getTodayJst(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return jst.toISOString().split('T')[0]
}

function getTTL(dateStr: string): number {
  const today = getTodayJst()
  const diff = Math.floor((Date.parse(today) - Date.parse(dateStr)) / 86_400_000)
  if (diff <= 0) return 20 * 60_000       // today: 20 min
  if (diff === 1) return 2 * 60 * 60_000  // yesterday: 2 h
  return 24 * 60 * 60_000                 // older: 24 h
}

function createTrino() {
  return Trino.create({
    server: process.env.TRINO_SERVER_URL || 'http://localhost:8080',
    catalog: process.env.TRINO_CATALOG || 'iceberg',
    schema: 'life_gold',
  })
}

async function runQuery(trino: any, query: string): Promise<any[][]> {
  const iter = await trino.query({ query, user: 'dashboard-api' })
  const rows: any[][] = []
  for await (const result of iter) {
    if (result.error) throw new Error(result.error.message)
    if (result.data) rows.push(...result.data)
  }
  return rows
}

function parseAppUsage(appsStr: string) {
  if (!appsStr) return []
  const colors = [
    'oklch(0.6 0.18 250)', 'oklch(0.7 0.2 60)',
    'oklch(0.7 0.18 340)', 'oklch(0.7 0.2 145)',
    'oklch(0.65 0.22 25)',
  ]
  let total = 0
  const parsed = appsStr.split('||').map((app, i) => {
    const [name, secStr] = app.split(':')
    const value = Number(secStr)
    total += value
    return { name, value, color: colors[i % colors.length] }
  })
  return parsed.map(p => ({ ...p, percent: total > 0 ? Math.round(p.value / total * 100) : 0 }))
}

function dateStr(raw: any): string {
  return String(raw).split('T')[0].split(' ')[0]
}

// --- Bulk fetch ---
async function fetchBulkDates(dates: string[]): Promise<DayBulkData[]> {
  if (dates.length === 0) return []
  const trino = createTrino()
  const inList = dates.map(d => `DATE '${d}'`).join(', ')

  const [workRes, mealsRes, activitiesRes, feedbackRes] = await Promise.allSettled([
    runQuery(trino, `SELECT * FROM life_gold.mrt_aw_daily_work_summary WHERE target_date IN (${inList})`),
    runQuery(trino, `SELECT * FROM life_gold.mrt_asken WHERE target_date IN (${inList})`),
    runQuery(trino, `
      SELECT CAST(slot_date_jst AS VARCHAR),
             CAST(time_slot_jst AS VARCHAR),
             CAST(time_slot_end_jst AS VARCHAR),
             cat_main, cat_sub, overlap_sec
      FROM life_gold.mrt_behavior_slots_15m
      WHERE slot_date_jst IN (${inList})
      ORDER BY time_slot_jst ASC
    `),
    runQuery(trino, `
      SELECT CAST(feedback_date AS VARCHAR), slot,
             CAST(generated_at AS VARCHAR), messages, model
      FROM life_gold.ai_feedback
      WHERE feedback_date IN (${inList})
      ORDER BY feedback_date,
        CASE slot WHEN 'morning' THEN 1 WHEN 'noon' THEN 2 WHEN 'night' THEN 3 ELSE 4 END
    `),
  ])

  const dayMap = new Map<string, DayBulkData>(
    dates.map(d => [d, { date: d, activities: [], meals: null, work: null, feedback: {} }])
  )

  if (workRes.status === 'fulfilled') {
    for (const row of workRes.value) {
      const d = dateStr(row[0])
      if (!dayMap.has(d)) continue
      dayMap.get(d)!.work = {
        work: { coreSec: Number(row[1]||0), sessionSec: Number(row[2]||0), focusRate: Number(row[3]||0), score: Number(row[4]||0), apps: parseAppUsage(row[5]) },
        dev:  { coreSec: Number(row[6]||0), sessionSec: Number(row[7]||0), focusRate: Number(row[8]||0), score: Number(row[9]||0), apps: parseAppUsage(row[10]) },
      }
    }
  } else {
    console.error('[cache] work query failed:', workRes.reason)
  }

  if (mealsRes.status === 'fulfilled') {
    const split = (s: string) => (s ? s.split('||') : [])
    for (const row of mealsRes.value) {
      const d = dateStr(row[0])
      if (!dayMap.has(d)) continue
      dayMap.get(d)!.meals = {
        meals: {
          breakfast: { items: split(row[1]), calories: Number(row[2]) },
          lunch:     { items: split(row[3]), calories: Number(row[4]) },
          dinner:    { items: split(row[5]), calories: Number(row[6]) },
          snack:     { items: split(row[7]), calories: Number(row[8]) },
        },
        nutrition: [
          { name: 'Energy',    label: 'エネルギー', current: Number(row[9]),  target: 2100,  unit: 'kcal' },
          { name: 'Protein',   label: 'タンパク質', current: Number(row[10]), target: 100,   unit: 'g' },
          { name: 'Fat',       label: '脂質',       current: Number(row[11]), target: 70,    unit: 'g',  isLimitType: true },
          { name: 'Carbs',     label: '糖質',       current: Number(row[12]), target: 280,   unit: 'g' },
          { name: 'Fiber',     label: '食物繊維',   current: Number(row[13]), target: 25,    unit: 'g' },
          { name: 'Salt',      label: '塩分',       current: Number(row[14]), target: 7.5,   unit: 'g',  isLimitType: true },
          { name: 'SatFat',    label: '飽和脂肪酸', current: Number(row[15]), target: 16,    unit: 'g',  isLimitType: true },
          { name: 'Potassium', label: 'カリウム',   current: Number(row[16]), target: 2500,  unit: 'mg' },
          { name: 'Calcium',   label: 'カルシウム', current: Number(row[17]), target: 650,   unit: 'mg' },
          { name: 'Iron',      label: '鉄',         current: Number(row[18]), target: 7.5,   unit: 'mg' },
          { name: 'VitA',      label: 'ビタミンA',  current: Number(row[19]), target: 850,   unit: 'μg' },
          { name: 'VitE',      label: 'ビタミンE',  current: Number(row[20]), target: 6.0,   unit: 'mg' },
          { name: 'VitB1',     label: 'ビタミンB1', current: Number(row[21]), target: 1.4,   unit: 'mg' },
          { name: 'VitB2',     label: 'ビタミンB2', current: Number(row[22]), target: 1.6,   unit: 'mg' },
          { name: 'VitB6',     label: 'ビタミンB6', current: Number(row[23]), target: 1.4,   unit: 'mg' },
          { name: 'VitC',      label: 'ビタミンC',  current: Number(row[24]), target: 100,   unit: 'mg' },
        ],
      }
    }
  } else {
    console.error('[cache] meals query failed:', mealsRes.reason)
  }

  if (activitiesRes.status === 'fulfilled') {
    for (const row of activitiesRes.value) {
      const d = dateStr(row[0])
      if (!dayMap.has(d)) continue
      const start = new Date(String(row[1]).replace(' ', 'T'))
      const end   = new Date(String(row[2]).replace(' ', 'T'))
      const startHour = start.getHours() + start.getMinutes() / 60
      let endHour     = end.getHours() + end.getMinutes() / 60
      if (endHour === 0 && (end.getDate() !== start.getDate() || end.getMonth() !== start.getMonth())) endHour = 24
      dayMap.get(d)!.activities.push({
        type: row[3], startHour, endHour,
        cat_main: row[3], cat_sub: row[4], overlapSec: Number(row[5]||0),
      })
    }
  } else {
    console.error('[cache] activities query failed:', activitiesRes.reason)
  }

  if (feedbackRes.status === 'fulfilled') {
    for (const row of feedbackRes.value) {
      const d = dateStr(row[0])
      if (!dayMap.has(d)) continue
      try {
        dayMap.get(d)!.feedback[String(row[1])] = {
          generatedAt: String(row[2]),
          messages: JSON.parse(String(row[3])),
          model: String(row[4]),
        }
      } catch {}
    }
  } else {
    console.error('[cache] feedback query failed:', feedbackRes.reason)
  }

  return Array.from(dayMap.values())
}

// --- Fitness fetch ---
async function fetchFitnessDates(dates: string[]): Promise<FitnessDay[]> {
  if (dates.length === 0) return []
  const trino = createTrino()
  const inList = dates.map(d => `DATE '${d}'`).join(', ')

  const rows = await runQuery(trino, `
    SELECT CAST(target_date AS VARCHAR),
           steps, calories_out, calories_in, net_calorie_balance,
           weight_kg, body_fat_pct, activity_logs_str,
           weight_7d_avg, resting_heart_rate,
           total_minutes_asleep, total_time_in_bed
    FROM life_gold.mrt_fitness_daily_summary
    WHERE target_date IN (${inList})
    ORDER BY target_date ASC
  `)

  return rows.map(row => ({
    date:        String(row[0]),
    steps:       Number(row[1]||0),
    burned:      Number(row[2]||0),
    intake:      Number(row[3]||0),
    balance:     Number(row[4]||0),
    weight:      row[5]  != null ? Number(row[5])  : null,
    bodyFat:     row[6]  != null ? Number(row[6])  : null,
    activities:  row[7]  ? String(row[7]).split(' || ').filter(Boolean) : [],
    weight7dAvg: row[8]  != null ? Number(row[8])  : null,
    restingHr:   Number(row[9]||0),
    sleepMins:   row[10] != null ? Number(row[10]) : 0,
    timeInBed:   row[11] != null ? Number(row[11]) : 0,
  }))
}

// Fetch a batch of dates, reusing any in-flight promises for the same dates
async function fetchBulkWithDedup(dates: string[]): Promise<DayBulkData[]> {
  const newDates = dates.filter(d => !bulkInflight.has(d))

  if (newDates.length > 0) {
    // Batch-fetch all new dates in one Trino query
    const batchPromise = fetchBulkDates(newDates).then(results => {
      for (const r of results) {
        bulkCache.set(r.date, { data: r, ts: Date.now() })
        bulkInflight.delete(r.date)
      }
      return results
    }).catch(e => {
      for (const d of newDates) bulkInflight.delete(d)
      throw e
    })
    // Register per-date so concurrent callers can join
    for (const d of newDates) {
      bulkInflight.set(d, batchPromise.then(rs => rs.find(r => r.date === d)!))
    }
  }

  return Promise.all(dates.map(d => bulkInflight.get(d)!))
}

async function fetchFitnessWithDedup(dates: string[]): Promise<FitnessDay[]> {
  const newDates = dates.filter(d => !fitnessInflight.has(d))

  if (newDates.length > 0) {
    const batchPromise = fetchFitnessDates(newDates).then(results => {
      for (const r of results) {
        fitnessCache.set(r.date, { data: r, ts: Date.now() })
        fitnessInflight.delete(r.date)
      }
      return results
    }).catch(e => {
      for (const d of newDates) fitnessInflight.delete(d)
      throw e
    })
    for (const d of newDates) {
      fitnessInflight.set(d, batchPromise.then(rs => rs.find(r => r.date === d)!))
    }
  }

  return Promise.all(dates.map(d => fitnessInflight.get(d)!))
}

// --- Public: bulk ---
export async function getBulkDays(dates: string[]): Promise<DayBulkData[]> {
  const result: DayBulkData[] = []
  const needFetch: string[] = []  // missing or in-flight
  const stale: string[] = []

  for (const d of dates) {
    const entry = bulkCache.get(d)
    if (!entry) {
      // Missing: fetch (or join existing in-flight)
      needFetch.push(d)
    } else if (bulkInflight.has(d)) {
      // In-flight from background refresh: join it instead of starting another query
      needFetch.push(d)
    } else {
      result.push(entry.data)
      if (Date.now() - entry.ts > getTTL(d)) stale.push(d)
    }
  }

  if (needFetch.length > 0) {
    const fetched = await fetchBulkWithDedup(needFetch)
    result.push(...fetched.filter(Boolean))
  }

  // Background refresh for stale dates
  if (stale.length > 0) {
    fetchBulkWithDedup(stale).catch(e => console.error('[cache] bulk stale refresh failed:', e))
  }

  return result.sort((a, b) => a.date.localeCompare(b.date))
}

// --- Public: fitness ---
export async function getFitnessDays(dates: string[]): Promise<FitnessDay[]> {
  const result: FitnessDay[] = []
  const needFetch: string[] = []
  const stale: string[] = []

  for (const d of dates) {
    const entry = fitnessCache.get(d)
    if (!entry) {
      needFetch.push(d)
    } else if (fitnessInflight.has(d)) {
      needFetch.push(d)
    } else {
      result.push(entry.data)
      if (Date.now() - entry.ts > getTTL(d)) stale.push(d)
    }
  }

  if (needFetch.length > 0) {
    const fetched = await fetchFitnessWithDedup(needFetch)
    result.push(...fetched.filter(Boolean))
  }

  if (stale.length > 0) {
    fetchFitnessWithDedup(stale).catch(e => console.error('[cache] fitness stale refresh failed:', e))
  }

  return result.sort((a, b) => a.date.localeCompare(b.date))
}

// --- Background refresh (called once at pod startup) ---
let refreshTimer: ReturnType<typeof setInterval> | null = null

async function storeBulk(dates: string[]) {
  const rs = await fetchBulkWithDedup(dates)
  return rs.length
}

async function storeFitness(dates: string[]) {
  const rs = await fetchFitnessWithDedup(dates)
  return rs.length
}

async function warmRecent() {
  const today = getTodayJst()
  const yesterday = format(subDays(parseISO(today), 1), 'yyyy-MM-dd')
  console.log(`[cache] Refreshing recent: ${yesterday}, ${today}`)
  const [b, f] = await Promise.allSettled([
    storeBulk([yesterday, today]),
    storeFitness([yesterday, today]),
  ])
  if (b.status === 'rejected') console.error('[cache] Recent bulk failed:', b.reason)
  if (f.status === 'rejected') console.error('[cache] Recent fitness failed:', f.reason)
  console.log('[cache] Recent refresh done')
}

async function warmHistory(bulkDays: number, fitnessDays: number) {
  const today = getTodayJst()

  // Bulk: only fetch dates not already cached (24h TTL handles old data)
  const bulkDates = eachDayOfInterval({
    start: subDays(parseISO(today), bulkDays - 1),
    end:   subDays(parseISO(today), 2),        // today/yesterday already done in warmRecent
  }).map(d => format(d, 'yyyy-MM-dd'))
    .filter(d => {
      const e = bulkCache.get(d)
      return !e || Date.now() - e.ts > getTTL(d)
    })

  // Fitness: only fetch dates not already cached
  const fitnessDates = eachDayOfInterval({
    start: subDays(parseISO(today), fitnessDays - 1),
    end:   subDays(parseISO(today), 2),
  }).map(d => format(d, 'yyyy-MM-dd'))
    .filter(d => {
      const e = fitnessCache.get(d)
      return !e || Date.now() - e.ts > getTTL(d)
    })

  if (bulkDates.length > 0) {
    console.log(`[cache] Warming ${bulkDates.length} historical bulk days`)
    const r = await Promise.allSettled([storeBulk(bulkDates)])
    if (r[0].status === 'rejected') console.error('[cache] Historical bulk failed:', r[0].reason)
    else console.log('[cache] Historical bulk done')
  }

  if (fitnessDates.length > 0) {
    console.log(`[cache] Warming ${fitnessDates.length} historical fitness days`)
    const r = await Promise.allSettled([storeFitness(fitnessDates)])
    if (r[0].status === 'rejected') console.error('[cache] Historical fitness failed:', r[0].reason)
    else console.log('[cache] Historical fitness done')
  }
}

export function startBackgroundRefresh(): void {
  if (refreshTimer) return

  async function startup() {
    const today = getTodayJst()
    // Register ALL dates in bulkInflight immediately so user requests join the same promise
    const bulkDates = eachDayOfInterval({ start: subDays(parseISO(today), 13), end: parseISO(today) })
      .map(d => format(d, 'yyyy-MM-dd'))
    const fitnessDates = eachDayOfInterval({ start: subDays(parseISO(today), 89), end: parseISO(today) })
      .map(d => format(d, 'yyyy-MM-dd'))

    console.log(`[cache] Startup: warming ${bulkDates.length} bulk days + ${fitnessDates.length} fitness days`)
    await Promise.allSettled([
      storeBulk(bulkDates).then(n => console.log(`[cache] Bulk warmup done (${n} days)`)),
      storeFitness(fitnessDates).then(n => console.log(`[cache] Fitness warmup done (${n} days)`)),
    ])
  }

  startup().catch(e => console.error('[cache] Startup failed:', e))

  // Every hour: refresh only today + yesterday (historical TTL keeps older data alive)
  refreshTimer = setInterval(
    () => warmRecent().catch(e => console.error('[cache] Hourly refresh failed:', e)),
    60 * 60_000
  )
}
