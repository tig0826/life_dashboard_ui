"use client"

import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Briefcase, Gamepad2, Dumbbell, Utensils, MapPin, Monitor, Clock, Focus, 
  TrendingDown, TrendingUp, Scale, AlertTriangle, CheckCircle, Flame, Footprints 
} from "lucide-react"
import { 
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, 
  YAxis, Tooltip, ComposedChart, Bar, Area, CartesianGrid 
} from "recharts"
import { PeriodSelector, type Period } from "./period-selector"

// --- 1. 型定義 ---
export interface WorkApp {
  name: string;
  value: number;
  color: string;
  percent: number;
}
export interface WorkDomain {
  coreSec: number;
  sessionSec: number; 
  focusRate: number;
  score: number;
  apps: WorkApp[];
}
export interface WorkDetails {
  work: WorkDomain;
  dev: WorkDomain;
}

export interface FitnessDay {
  date: string;
  steps: number;
  burned: number;
  intake: number;
  balance: number;
  weight: number | null;
  bodyFat: number | null;
  activities: string[];
  weight7dAvg: number | null;
}

export interface MealDetails {
  meals: {
    breakfast: { items: string[]; calories: number };
    lunch: { items: string[]; calories: number };
    dinner: { items: string[]; calories: number };
    snack: { items: string[]; calories: number };
  };
  nutrition: {
    name: string;
    label: string;
    current: number;
    target: number;
    unit: string;
    isLimitType?: boolean;
  }[];
}

interface DetailPanelProps {
  date: Date
  period: Period
  onPeriodChange: (period: Period) => void
  mealData?: MealDetails | null
  workData?: WorkDetails | null
  fitnessData?: FitnessDay[] | null
}

// --- 2. 静的データ ---
const mediaUsageData = [
  { name: "YouTube", value: 65, color: "oklch(0.65 0.22 25)" },
  { name: "Netflix", value: 20, color: "oklch(0.6 0.18 280)" },
  { name: "Spotify", value: 10, color: "oklch(0.7 0.2 145)" },
  { name: "Game", value: 5, color: "oklch(0.6 0.18 250)" },
]

const youtubeGenres = [
  { genre: "Tech", percent: 45 },
  { genre: "Music", percent: 25 },
  { genre: "News", percent: 15 },
  { genre: "Other", percent: 15 },
]

const locationLog = [
  { time: "07:00", location: "自宅", duration: "2h", coords: "35.6812, 139.7671" },
  { time: "09:00", location: "オフィス", duration: "8h", coords: "35.6586, 139.7454" },
  { time: "17:00", location: "カフェ", duration: "1h", coords: "35.6595, 139.7005" },
  { time: "18:00", location: "ジム", duration: "1h", coords: "35.6614, 139.7043" },
  { time: "19:30", location: "自宅", duration: "-", coords: "35.6812, 139.7671" },
]

// --- 3. メインコンポーネント ---
export function DetailPanel({ date, period, onPeriodChange, mealData, workData, fitnessData }: DetailPanelProps) {
  const [activeTab, setActiveTab] = useState("work")

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0 mb-2">
        <TabsList className="grid grid-cols-5 bg-[oklch(0.12_0.015_250)] p-0.5 h-9 rounded-lg">
          <TabsTrigger value="work" className="text-xs gap-1.5 data-[state=active]:bg-[oklch(0.85_0.18_90/0.2)] h-8 rounded-md font-medium">
            <Briefcase className="w-3.5 h-3.5" /> Work
          </TabsTrigger>
          <TabsTrigger value="media" className="text-xs gap-1.5 data-[state=active]:bg-[oklch(0.7_0.18_340/0.2)] h-8 rounded-md font-medium">
            <Gamepad2 className="w-3.5 h-3.5" /> Media
          </TabsTrigger>
          <TabsTrigger value="fitness" className="text-xs gap-1.5 data-[state=active]:bg-[oklch(0.7_0.2_145/0.2)] h-8 rounded-md font-medium">
            <Dumbbell className="w-3.5 h-3.5" /> Fitness
          </TabsTrigger>
          <TabsTrigger value="meals" className="text-xs gap-1.5 data-[state=active]:bg-[oklch(0.7_0.2_60/0.2)] h-8 rounded-md font-medium">
            <Utensils className="w-3.5 h-3.5" /> Meals
          </TabsTrigger>
          <TabsTrigger value="location" className="text-xs gap-1.5 data-[state=active]:bg-[oklch(0.6_0.18_250/0.2)] h-8 rounded-md font-medium">
            <MapPin className="w-3.5 h-3.5" /> Location
          </TabsTrigger>
        </TabsList>
        <PeriodSelector value={period} onChange={onPeriodChange} size="sm" />
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        <TabsContent value="work" className="mt-0 h-full"><WorkPanel data={workData} /></TabsContent>
        <TabsContent value="media" className="mt-0 h-full"><MediaPanel period={period} /></TabsContent>
        <TabsContent value="fitness" className="mt-0 h-full"><FitnessPanel data={fitnessData} /></TabsContent>
        <TabsContent value="meals" className="mt-0 h-full"><MealsPanel period={period} data={mealData} /></TabsContent>
        <TabsContent value="location" className="mt-0 h-full"><LocationPanel period={period} /></TabsContent>
      </div>
    </Tabs>
  )
}

// --- 4. WorkPanel ---
function WorkPanel({ data }: { data?: WorkDetails | null }) {
  const workData = data?.work || { coreSec: 0, sessionSec: 0, focusRate: 0, score: 0, apps: [] };
  const devData = data?.dev || { coreSec: 0, sessionSec: 0, focusRate: 0, score: 0, apps: [] };
  const formatTime = (sec: number) => {
    const safeSec = Number(sec) || 0;
    const h = Math.floor(safeSec / 3600);
    const m = Math.floor((safeSec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const DomainCard = ({ title, icon, domainData, colorStr }: { title: string, icon: React.ReactNode, domainData: WorkDomain, colorStr: string }) => {
    const cssColor = domainData.score >= 80 ? "oklch(0.7 0.2 145)" : domainData.score >= 50 ? "oklch(0.85 0.18 90)" : "oklch(0.65 0.22 25)";
    const circumference = 2 * Math.PI * 28;
    const fillPercentage = Math.min(domainData.score, 120) / 120;
    const strokeDashoffset = circumference - (circumference * fillPercentage);

    return (
      <div className={`bg-[oklch(0.1_0.015_250)] rounded-xl p-4 border border-[${colorStr}/0.2] flex flex-col gap-4 h-full relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-current to-transparent opacity-10 pointer-events-none rounded-full blur-3xl" style={{ color: cssColor }} />
        <div className="flex items-start justify-between z-10">
          <h4 className={`text-sm font-bold flex items-center gap-1.5`} style={{ color: colorStr }}>{icon} {title}</h4>
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5" />
                <circle cx="32" cy="32" r="28" stroke={cssColor} strokeWidth="4" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="transition-all duration-1000 ease-out" style={{ filter: `drop-shadow(0 0 6px ${cssColor}80)` }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl font-black font-mono" style={{ color: cssColor }}>{domainData.score}</span></div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 z-10">
          <div className="bg-[oklch(0.14_0.02_250)] rounded-lg p-2.5 border border-white/5"><div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Session Time</div><div className="text-sm font-mono text-foreground/90">{formatTime(domainData.sessionSec)}</div></div>
          <div className="bg-[oklch(0.14_0.02_250)] rounded-lg p-2.5 border border-white/5"><div className="text-[9px] text-[oklch(0.7_0.2_145)] uppercase flex items-center gap-1 mb-1"><Focus className="w-2.5 h-2.5"/> Focus</div><div className="text-sm font-mono text-[oklch(0.7_0.2_145)]">{domainData.focusRate}%</div></div>
          <div className="bg-[oklch(0.14_0.02_250)] rounded-lg p-2.5 border border-[oklch(0.6_0.18_250/0.3)] shadow-[inset_0_0_10px_oklch(0.6_0.18_250/0.1)]"><div className="text-[9px] text-[oklch(0.6_0.18_250)] font-bold uppercase mb-1">Core Task</div><div className="text-base font-bold font-mono text-foreground">{formatTime(domainData.coreSec)}</div></div>
          <div className="bg-[oklch(0.14_0.02_250)] rounded-lg p-2.5 border border-[oklch(0.65_0.22_25/0.2)]"><div className="text-[9px] text-[oklch(0.65_0.22_25)] uppercase mb-1">Loss Time</div><div className="text-sm font-mono text-[oklch(0.65_0.22_25)]">{formatTime(Math.max(0, domainData.sessionSec - domainData.coreSec))}</div></div>
        </div>
        <div className="flex-1 mt-1 z-10"><div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-2.5">App Breakdown</div>
          <div className="space-y-2.5">
            {domainData.apps.slice(0, 4).map((app) => (
              <div key={app.name} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[10px]"><span className="text-foreground/80 truncate pr-2 flex-1">{app.name}</span><span className="font-mono text-muted-foreground w-12 text-right">{formatTime(app.value)}</span><span className="font-mono text-foreground/60 w-8 text-right">{app.percent}%</span></div>
                <div className="h-1 bg-[oklch(0.18_0.02_250)] rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${app.percent}%`, backgroundColor: app.color }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="grid grid-cols-2 gap-4 h-full min-h-0">
      <DomainCard title="Work (業務)" icon={<Briefcase className="w-3.5 h-3.5"/>} domainData={workData} colorStr="oklch(0.85 0.15 90)" />
      <DomainCard title="Personal Dev (個人開発)" icon={<Monitor className="w-3.5 h-3.5"/>} domainData={devData} colorStr="oklch(0.6 0.18 250)" />
    </div>
  );
}

// --- 5. FitnessPanel ---
function FitnessPanel({ data }: { data?: FitnessDay[] | null }) {
  const chartData = data || [];
  const today = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  // 歩数解析ロジック
  const stepStats = useMemo(() => {
    const totalSummary = today?.steps || 0;
    const active = (today?.activities || []).reduce((sum, log) => {
      const match = log.match(/(\d+)\s*steps/);
      return sum + (match ? parseInt(match[1]) : 0);
    }, 0);

    const finalTotal = Math.max(totalSummary, active);
    const ambient = Math.max(0, finalTotal - active);
    const ratio = finalTotal > 0 ? (active / finalTotal) * 100 : 0;

    return { active, ambient, finalTotal, ratio };
  }, [today]);

  // ★ ウォーキング以外の特別なイベントを抽出
  const specialEvents = useMemo(() => {
    return (today?.activities || []).filter(log => !log.toLowerCase().includes('walk'));
  }, [today]);

  if (chartData.length === 0) return <div className="h-full flex items-center justify-center text-xs opacity-30 font-mono">WAITING FOR FITNESS DATA...</div>;

  return (
    <div className="grid grid-cols-12 gap-3 h-full">
      <div className="col-span-4 flex flex-col gap-2 min-h-0">
        <h4 className="text-xs font-semibold text-[oklch(0.7_0.2_145)] shrink-0">Today</h4>
        
        {/* カロリーバランス (少し高さを抑えた) */}
        <div className="bg-[oklch(0.12_0.015_250)] rounded-lg p-3 border border-[oklch(0.7_0.2_145/0.2)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-bold text-[oklch(0.7_0.2_145)] uppercase tracking-widest">Energy Balance</span>
            <Flame className="w-3.5 h-3.5 text-[oklch(0.7_0.2_145)]" />
          </div>
          <div className={`text-2xl font-black font-mono ${today && today.balance <= 0 ? 'text-[oklch(0.7_0.2_145)]' : 'text-rose-500'}`}>
            {today && today.balance > 0 ? "+" : ""}{today?.balance}
            <span className="text-xs font-normal ml-1 text-muted-foreground">kcal</span>
          </div>
        </div>

        {/* ★ 体重・体脂肪を横並びに修正 */}
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <div className="bg-[oklch(0.12_0.015_250)] rounded-lg p-2.5 border border-white/5">
            <div className="text-[8px] text-muted-foreground uppercase mb-0.5">Weight</div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-[oklch(0.85_0.18_90)]">{today?.weight ? today.weight.toFixed(1) : '--'}</span>
              <span className="text-[10px] text-muted-foreground">kg</span>
            </div>
          </div>
          <div className="bg-[oklch(0.12_0.015_250)] rounded-lg p-2.5 border border-white/5">
            <div className="text-[8px] text-muted-foreground uppercase mb-0.5">Body Fat</div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-foreground/80">{today?.bodyFat ? today.bodyFat.toFixed(1) : '--'}</span>
              <span className="text-[10px] text-muted-foreground">%</span>
            </div>
          </div>
        </div>

        {/* 歩数解析 & 特別なイベントのスクロールエリア */}
        <div className="bg-[oklch(0.12_0.015_250)] rounded-lg p-3 border border-white/5 flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <Footprints className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Step Analysis</span>
            </div>
            <span className="text-sm font-black font-mono text-foreground tracking-tight">
              {stepStats.finalTotal.toLocaleString()}
            </span>
          </div>

          <div className="space-y-2 shrink-0">
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden p-[px] border border-white/5">
              <div 
                className="h-full rounded-full transition-all duration-1000 bg-indigo-500 shadow-[0_0_8px_oklch(0.6_0.18_250/0.4)]"
                style={{ width: `${stepStats.ratio}%` }}
              />
            </div>
            <div className="flex justify-between text-[8px] font-mono text-muted-foreground tracking-tighter uppercase px-0.5">
              <span>Active: {stepStats.active.toLocaleString()}</span>
              <span>Ambient: {stepStats.ambient.toLocaleString()}</span>
            </div>
          </div>

          {/* ★ 特別なアクティビティ（Walk以外）がある場合のみ表示 */}
          {specialEvents.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/5 flex-1 flex flex-col min-h-0">
              <div className="text-[8px] text-[oklch(0.75_0.15_195)] font-bold uppercase tracking-widest mb-2 shrink-0">Special Events</div>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {specialEvents.map((log, i) => (
                  <div key={i} className="text-[9px] bg-indigo-500/10 border border-indigo-500/20 rounded px-2 py-1.5 text-indigo-100 flex items-center gap-2">
                    <Activity className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span className="truncate leading-tight">{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 右側のチャートエリア（幅を少し調整 9 -> 8） */}
      <div className="col-span-8 flex flex-col h-full gap-2">
        {/* チャート部分はそのまま（必要に応じて col-span を微調整） */}
        <div className="h-[62%] bg-[oklch(0.1_0.015_250)] rounded-xl p-4 border border-white/5 relative">
          <div className="absolute top-4 left-6 text-[10px] font-bold text-muted-foreground uppercase z-10">Weight & Fat Trend</div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#666' }} tickFormatter={(v) => v.slice(5)} minTickGap={40} axisLine={false} />
              <YAxis yAxisId="left" domain={['dataMin - 1', 'dataMax + 1']} hide />
              <YAxis yAxisId="right" orientation="right" domain={['dataMin - 2', 'dataMax + 2']} hide />
              <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '10px' }} formatter={(v: any, n: string) => n==="weight"?[v+"kg","体重"]:n==="bodyFat"?[v+"%","体脂肪"]: [v,n]} />
              <Line yAxisId="left" type="monotone" dataKey="weight" stroke="oklch(0.85 0.18 90)" strokeWidth={3} dot={false} connectNulls name="weight" />
              <Line yAxisId="left" type="monotone" dataKey="weight7dAvg" stroke="oklch(0.85 0.18 90)" strokeDasharray="4 4" strokeWidth={1} dot={false} connectNulls opacity={0.3} name="weight7dAvg" />
              <Line yAxisId="right" type="monotone" dataKey="bodyFat" stroke="oklch(0.75 0.15 195)" strokeWidth={2} dot={false} connectNulls name="bodyFat" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="h-[36%] bg-[oklch(0.1_0.015_250)] rounded-xl p-4 border border-white/5 relative">
          <div className="absolute top-3 left-6 text-[9px] font-bold text-muted-foreground uppercase z-10">Daily Calorie Balance</div>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#666' }} tickFormatter={(v) => v.slice(5)} minTickGap={40} axisLine={false} />
              <YAxis hide domain={[0, 4500]} />
              <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '10px' }} />
              <Area type="step" dataKey="balance" fill="oklch(0.7 0.2 145)" stroke="none" fillOpacity={0.1} />
              <Bar dataKey="intake" fill="oklch(0.7 0.2 60)" opacity={0.3} barSize={4} />
              <Bar dataKey="burned" fill="oklch(0.65 0.22 25)" opacity={0.3} barSize={4} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// --- 6. MediaPanel ---
function MediaPanel({ period }: { period: Period }) {
  return (
    <div className="grid grid-cols-3 gap-4 h-full">
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-[oklch(0.7_0.18_340)] uppercase">Media Usage</h4>
        <div className="bg-[oklch(0.12_0.015_250)] rounded-lg p-3 border border-[oklch(0.7_0.18_340/0.2)]">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Total Time</div>
          <div className="text-2xl font-bold font-mono text-[oklch(0.7_0.18_340)]">2h 45m</div>
          <div className="text-[10px] text-[oklch(0.7_0.2_145)] mt-1 flex items-center gap-1"><TrendingDown className="w-3 h-3" /> -15m vs target</div>
        </div>
        <div className="space-y-1.5 pt-2">
          {youtubeGenres.map((genre) => (
            <div key={genre.genre} className="flex items-center gap-2">
              <span className="text-[10px] opacity-70 w-10 truncate">{genre.genre}</span>
              <div className="flex-1 h-2 bg-[oklch(0.18_0.02_250)] rounded-full overflow-hidden"><div className="h-full bg-[oklch(0.65_0.22_25)] shadow-[0_0_6px_currentColor]" style={{ width: `${genre.percent}%` }} /></div>
              <span className="text-[10px] font-mono opacity-50 w-7 text-right">{genre.percent}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="h-40 flex items-center justify-center"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={mediaUsageData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value" strokeWidth={0}>{mediaUsageData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie><Tooltip contentStyle={{ backgroundColor: 'oklch(0.12 0.015 250)', border: 'none', borderRadius: '8px', fontSize: '11px' }} /></PieChart></ResponsiveContainer></div>
      <div className="space-y-1.5">{mediaUsageData.map((item) => (<div key={item.name} className="flex items-center gap-2 bg-white/5 rounded-lg p-2.5 border border-white/5"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}` }} /><span className="flex-1 text-xs opacity-80">{item.name}</span><span className="text-lg font-mono font-bold opacity-80">{item.value}%</span></div>))}</div>
    </div>
  )
}

// --- 7. MealsPanel (原状復帰 3カラム・ミクロも含めてバーアニメーション搭載) ---
function MealsPanel({ period, data }: { period: Period, data: MealDetails | null }) {
  const displayMealData = data?.meals || { breakfast: { items: [], calories: 0 }, lunch: { items: [], calories: 0 }, dinner: { items: [], calories: 0 }, snack: { items: [], calories: 0 } };
  const displayNutritionData = data?.nutrition || [];
  const totalCalories = Object.values(displayMealData).reduce((sum, m) => sum + m.calories, 0);
  const macros = displayNutritionData.slice(0, 4);
  const micros = displayNutritionData.slice(4);

  // バーのアニメーション用ステート
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // コンポーネントマウント後にアニメーションを開始
    setMounted(true);
  }, []);

  return (
    <div className="grid grid-cols-12 gap-3 h-full overflow-hidden">
      {/* Column 1: Today's Meals */}
      <div className="col-span-4 space-y-2 overflow-y-auto pr-1">
        <div className="flex items-center justify-between"><h4 className="text-xs font-semibold text-[oklch(0.7_0.2_60)] uppercase tracking-wider">Today's Meals</h4><div className="text-xs font-mono text-[oklch(0.7_0.2_60)] font-bold">{totalCalories} kcal</div></div>
        {Object.entries(displayMealData).map(([key, meal]) => (
          <div key={key} className="bg-[oklch(0.12_0.015_250)] rounded-lg p-2.5 border border-[oklch(0.7_0.2_60/0.2)]">
            <div className="flex items-center justify-between mb-1.5"><span className="text-xs font-semibold text-foreground capitalize">{key}</span><span className="text-xs font-mono text-[oklch(0.7_0.2_60)]">{meal.calories} kcal</span></div>
            <div className="flex flex-wrap gap-1">{meal.items.map((item) => (<span key={item} className="text-[10px] bg-[oklch(0.18_0.02_250)] rounded px-1.5 py-0.5 text-foreground/70">{item}</span>))}</div>
          </div>
        ))}
      </div>
      {/* Column 2: Macro Nutrients (Animated Progress Bars) */}
      <div className="col-span-4 space-y-2">
        <h4 className="text-xs font-semibold text-[oklch(0.7_0.2_60)] uppercase tracking-wider">Macro Nutrients</h4>
        <div className="space-y-1.5">
          {macros.map((n) => {
            const ratio = (n.current / n.target) * 100;
            const status = ratio >= 80 && ratio <= 110 ? "good" : ratio < 80 ? "low" : "high";
            const color = status === "good" ? "oklch(0.7 0.2 145)" : status === "low" ? "oklch(0.7 0.2 60)" : "oklch(0.65 0.22 25)";
            return (
              <div key={n.name} className="bg-[oklch(0.1_0.015_250)] rounded-lg p-2 border border-[oklch(0.25_0.03_250/0.3)]">
                <div className="flex items-center justify-between mb-1"><span className="text-[10px] text-foreground/90">{n.label}</span><div className="flex items-center gap-1.5">{status === "good" && <CheckCircle className="w-2.5 h-2.5 text-[oklch(0.7_0.2_145)]" />}<span className="text-[10px] font-mono text-foreground/80">{n.current}</span><span className="text-[9px] text-muted-foreground">/ {n.target}{n.unit}</span></div></div>
                <div className="h-1.5 bg-[oklch(0.18_0.02_250)] rounded-full overflow-hidden relative">
                  <div 
                    className="h-full bg-[oklch(0.7_0.2_145)] shadow-[0_0_6px_currentColor] transition-all duration-[300ms] ease-out" 
                    style={{ width: mounted ? `${Math.min(ratio, 100)}%` : '0%', backgroundColor: color }} 
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Column 3: Micronutrients (Grid with Animated Progress Bars) */}
      <div className="col-span-4 space-y-2 overflow-auto pr-1">
        <h4 className="text-xs font-semibold text-[oklch(0.7_0.2_60)] uppercase tracking-wider">Micronutrients</h4>
        <div className="grid grid-cols-2 gap-1.5">
          {micros.map((n) => {
            const ratio = (n.current / n.target) * 100;
            const isLimitType = 'isLimitType' in n && n.isLimitType;
            const status = isLimitType ? (ratio <= 100 ? "good" : "high") : (ratio >= 80 ? "good" : "low");
            const color = status === "good" ? "oklch(0.7 0.2 145)" : status === "low" ? "oklch(0.7 0.2 60)" : "oklch(0.65 0.22 25)";
            return (
              <div key={n.name} className="bg-[oklch(0.1_0.015_250)] rounded-lg p-1.5 border border-[oklch(0.25_0.03_250/0.2)]">
                <div className="flex items-center justify-between mb-0.5"><span className="text-[9px] text-foreground/80 truncate pr-1">{n.label}</span>{status === "good" ? <CheckCircle className="w-2 h-2" style={{color}}/> : status === "low" ? <TrendingDown className="w-2 h-2" style={{color}}/> : <AlertTriangle className="w-2 h-2" style={{color}}/>}</div>
                <div className="flex items-baseline gap-0.5"><span className="text-xs font-mono text-foreground/90">{n.current}</span><span className="text-[8px] text-muted-foreground">/ {n.target}{n.unit}</span></div>
                <div className="h-1 bg-[oklch(0.18_0.02_250)] rounded-full overflow-hidden mt-0.5 relative">
                  <div 
                    className="h-full rounded-full transition-all duration-[300ms] ease-out" 
                    style={{ width: mounted ? `${Math.min(ratio, 100)}%` : '0%', backgroundColor: color, boxShadow: `0 0 6px ${color}80` }} 
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  )
}

// --- 8. LocationPanel ---
function LocationPanel({ period }: { period: Period }) {
  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      <div className="bg-[oklch(0.1_0.015_250)] rounded-xl border border-[oklch(0.6_0.18_250/0.2)] overflow-hidden relative">
        <div className="absolute inset-0 flex items-center justify-center flex-col gap-2"><MapPin className="w-10 h-10 text-[oklch(0.6_0.18_250/0.5)]" /><span className="text-xs text-muted-foreground uppercase">OwnTracks Map</span></div>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `linear-gradient(oklch(0.6 0.18 250 / 0.3) 1px, transparent 1px), linear-gradient(90deg, oklch(0.6 0.18 250 / 0.3) 1px, transparent 1px)`, backgroundSize: '20px 20px' }} />
      </div>
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-[oklch(0.6_0.18_250)] uppercase">Location History</h4>
        <div className="space-y-1.5 overflow-y-auto pr-1 h-full">
          {locationLog.map((log, index) => (
            <div key={index} className="flex items-start gap-2 bg-[oklch(0.1_0.015_250)] rounded-lg p-2.5 border border-[oklch(0.25_0.03_250/0.3)]">
              <div className="flex flex-col items-center"><div className="w-2.5 h-2.5 rounded-full bg-[oklch(0.6_0.18_250)] shadow-[0_0_6px_currentColor]" />{index < locationLog.length - 1 && <div className="w-px h-6 bg-[oklch(0.6_0.18_250/0.3)] mt-1" />}</div>
              <div className="flex-1 min-w-0"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-foreground truncate">{log.location}</span><span className="text-[10px] font-mono text-muted-foreground shrink-0">{log.duration}</span></div><div className="text-[10px] font-mono text-[oklch(0.6_0.18_250)] mt-0.5">{log.time} <span className="text-[9px] text-muted-foreground/60">{log.coords}</span></div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
