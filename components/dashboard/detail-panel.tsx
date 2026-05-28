"use client"

import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { format } from "date-fns"
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
import type { StayPoint, TransitRoute } from "./location-map"

// Dynamic import to avoid SSR issues with Leaflet
const LocationMap = dynamic(() => import("./location-map"), { ssr: false })

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

export interface LocationData {
  stays: StayPoint[]
  transits: TransitRoute[]
}

export interface EntertainmentItem {
  name: string
  cat_main: string
  minutes: number
}

export interface EntertainmentData {
  date: string
  breakdown: EntertainmentItem[]
}

interface DetailPanelProps {
  date: Date
  period: Period
  onPeriodChange: (period: Period) => void
  activeTab: string
  onTabChange: (tab: string) => void
  mealData?: MealDetails | null
  workData?: WorkDetails | null
  fitnessData?: FitnessDay[] | null
  locationData?: LocationData | null
  entertainmentData?: EntertainmentData | null
}

// --- 2. エンタメパネル用定数 ---
const CAT_COLORS: Record<string, string> = {
  MEDIA:  "oklch(0.65 0.22 25)",
  MANGA:  "oklch(0.65 0.18 340)",
  GAME:   "oklch(0.62 0.22 290)",
  SOCIAL: "oklch(0.60 0.15 210)",
}

const CAT_LABELS: Record<string, string> = {
  MEDIA: "Video", MANGA: "Manga", GAME: "Game", SOCIAL: "Social",
}

const WASTE_LEVELS = [
  { max: 0,        label: "NO DATA",    color: "oklch(0.5 0.05 250)",  sub: "No activity recorded" },
  { max: 60,       label: "FOCUSED",    color: "oklch(0.70 0.20 145)", sub: "Productive day" },
  { max: 120,      label: "CASUAL",     color: "oklch(0.82 0.17 80)",  sub: "Light indulgence" },
  { max: 180,      label: "DISTRACTED", color: "oklch(0.75 0.20 40)",  sub: "High distraction" },
  { max: Infinity, label: "LOST",       color: "oklch(0.65 0.22 20)",  sub: "Productivity impacted" },
]

function getWasteLevel(totalMin: number) {
  for (const lvl of WASTE_LEVELS) {
    if (totalMin <= lvl.max) return lvl
  }
  return WASTE_LEVELS[WASTE_LEVELS.length - 1]
}

function fmtMin(min: number) {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60), m = min % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// --- 3. メインコンポーネント ---
export function DetailPanel({ date, period, onPeriodChange, activeTab, onTabChange, mealData, workData, fitnessData, locationData, entertainmentData }: DetailPanelProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 shrink-0 mb-2">
        <TabsList className="grid grid-cols-5 bg-[oklch(0.12_0.015_250)] p-0.5 h-9 rounded-lg w-full md:w-auto">
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
        <TabsContent value="media" className="mt-0 h-full"><MediaPanel data={entertainmentData} /></TabsContent>
        <TabsContent value="fitness" className="mt-0 h-full"><FitnessPanel data={fitnessData} date={date} /></TabsContent>
        <TabsContent value="meals" className="mt-0 h-full"><MealsPanel period={period} data={mealData} /></TabsContent>
        <TabsContent value="location" className="mt-0 h-full"><LocationPanel data={locationData} /></TabsContent>
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
  
  // 🚀 親(page.tsx)のフィルターが完璧になったため、黙って配列の最後を取るだけで100%一致する
  const today = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  // 歩数解析ロジック
  const stepStats = useMemo(() => {
    const finalTotal = today?.steps || 0;
    let active = (today?.activities || []).reduce((sum, log) => {
      const match = log.match(/(\d+)\s*steps/i);
      return sum + (match ? parseInt(match[1], 10) : 0);
    }, 0);
    active = Math.min(active, finalTotal);
    
    const ambient = finalTotal - active;
    const ratio = finalTotal > 0 ? (active / finalTotal) * 100 : 0;
    return { active, ambient, finalTotal, ratio };
  }, [today]);

  const specialEvents = useMemo(() => {
    return (today?.activities || []).filter(log => !log.toLowerCase().includes('walk'));
  }, [today]);

  return (
    <div className="grid grid-cols-12 gap-4 h-full min-h-0">
      {/* 左カラム：今日の詳細 */}
      <div className="col-span-4 flex flex-col gap-3 min-h-0">
        <div className="bg-gradient-to-br from-[oklch(0.14_0.02_250)] to-[oklch(0.08_0.01_250)] rounded-2xl border border-white/5 p-4 relative overflow-hidden shrink-0 group shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-[oklch(0.8_0.15_150)]/10 blur-3xl rounded-full transition-opacity opacity-50 group-hover:opacity-100 pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[oklch(0.7_0.15_250)]/10 blur-3xl rounded-full transition-opacity opacity-50 group-hover:opacity-100 pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] text-foreground/70 uppercase font-bold tracking-[0.2em] flex items-center gap-1.5 z-10">
              <Flame className="w-3.5 h-3.5 text-[oklch(0.8_0.15_150)]" /> Energy Balance
            </span>
          </div>
          <div className="flex items-end justify-between z-10 relative">
            <div className="flex flex-col">
              <span className={cn(
                "text-3xl font-black font-mono tracking-tighter leading-none drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]",
                (today?.balance || 0) <= 0 ? "text-[oklch(0.8_0.15_150)]" : "text-rose-400"
              )}>
                {today && today.balance > 0 ? "+" : ""}{today?.balance || 0}
              </span>
              <span className="text-[8px] text-muted-foreground uppercase tracking-widest mt-1.5 ml-0.5">Net (kcal)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-xl font-bold font-mono text-[oklch(0.7_0.15_250)]">{today?.burned || 0}</span>
                <span className="text-[8px] text-muted-foreground uppercase tracking-widest mt-0.5">OUT</span>
              </div>
              <div className="w-px h-8 bg-white/10 rounded-full" />
              <div className="flex flex-col items-start">
                <span className="text-xl font-bold font-mono text-[oklch(0.5_0.15_280)]">{today?.intake || 0}</span>
                <span className="text-[8px] text-muted-foreground uppercase tracking-widest mt-0.5">IN</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 shrink-0">
          <div className="bg-[oklch(0.12_0.015_250)] rounded-2xl p-3.5 border border-white/5 shadow-sm">
            <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mb-1.5">Weight</div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-foreground/90">{today?.weight ? today.weight.toFixed(1) : '--'}</span>
              <span className="text-[10px] text-muted-foreground font-medium">kg</span>
            </div>
          </div>
          <div className="bg-[oklch(0.12_0.015_250)] rounded-2xl p-3.5 border border-white/5 shadow-sm">
            <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mb-1.5">Body Fat</div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-foreground/90">{today?.bodyFat ? today.bodyFat.toFixed(1) : '--'}</span>
              <span className="text-[10px] text-muted-foreground font-medium">%</span>
            </div>
          </div>
        </div>

        <div className="bg-[oklch(0.12_0.015_250)] rounded-2xl p-4 border border-white/5 flex-1 flex flex-col min-h-0 overflow-hidden shadow-sm relative">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-1.5">
              <Footprints className="w-4 h-4 text-[oklch(0.6_0.18_250)]" />
              <span className="text-[10px] font-bold text-foreground/70 uppercase tracking-widest">Step Analysis</span>
            </div>
            <span className="text-xl font-black font-mono text-foreground tracking-tight">
              {stepStats.finalTotal.toLocaleString()}
            </span>
          </div>
          <div className="space-y-2.5 shrink-0 mt-1">
            <div className="h-2 w-full bg-[oklch(0.08_0.01_250)] rounded-full overflow-hidden p-[1px] border border-white/5">
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-[oklch(0.6_0.18_250)] to-[oklch(0.7_0.15_280)] shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                style={{ width: `${stepStats.ratio}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-muted-foreground tracking-tighter uppercase px-0.5">
              <span className="text-[oklch(0.7_0.15_280)]">Active: {stepStats.active.toLocaleString()}</span>
              <span>Ambient: {stepStats.ambient.toLocaleString()}</span>
            </div>
          </div>
          {specialEvents.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5 flex-1 flex flex-col min-h-0">
              <div className="text-[9px] text-[oklch(0.8_0.15_150)] font-bold uppercase tracking-widest mb-2 shrink-0">Special Events</div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {specialEvents.map((log, i) => (
                  <div key={i} className="text-[10px] bg-white/5 border border-white/5 rounded-lg px-2.5 py-2 text-foreground/80 flex items-center gap-2">
                    <Flame className="w-3.5 h-3.5 text-[oklch(0.8_0.15_150)] shrink-0" />
                    <span className="truncate leading-relaxed">{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 🚀 右側のチャートエリア（1つの統合された巨大パネル） */}
      <div className="col-span-8 bg-[oklch(0.12_0.015_250)] rounded-2xl border border-white/5 shadow-sm flex flex-col min-h-0 h-full p-4 gap-2 relative">
        
        {/* 上段：体重トレンド (少し領域を譲る flex-[3]) */}
        <div className="flex-[3] relative min-h-0">
          <div className="absolute top-0 left-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest z-10">Weight & Fat Trend</div>
          
          <div className="absolute inset-0 top-6 bottom-0 left-0 right-2">
            <ResponsiveContainer width="100%" height="100%">
              {/* 🚀 左右のマージンを下のチャートと完全に一致させた */}
              <LineChart data={chartData} margin={{ top: 5, right: 0, bottom: -15, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                {/* 🚀 tick={false} で日付を消し去る */}
                <XAxis dataKey="date" height={10} tick={false} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" domain={['dataMin - 0.2', 'dataMax + 0.2']} hide />
                <YAxis yAxisId="right" orientation="right" domain={['dataMin - 0.2', 'dataMax + 0.2']} hide />
                
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px', backdropFilter: 'blur(8px)' }} 
                  formatter={(v: any, n: string) => n==="weight"?[v+"kg","体重"]:n==="bodyFat"?[v+"%","体脂肪"]: [v,n]} 
                  labelFormatter={(label) => `Date: ${label}`}
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                />
                <Line yAxisId="left" type="monotone" dataKey="weight" stroke="oklch(0.85 0.18 90)" strokeWidth={3} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} connectNulls name="weight" style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.3))' }} />
                <Line yAxisId="left" type="monotone" dataKey="weight7dAvg" stroke="oklch(0.85 0.18 90)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} connectNulls opacity={0.4} name="weight7dAvg" />
                <Line yAxisId="right" type="monotone" dataKey="bodyFat" stroke="oklch(0.75 0.15 195)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} connectNulls name="bodyFat" style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.3))' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 🚀 うっすらとした境界線で上下を仕切る */}
        <div className="w-full h-px bg-white/5 my-1" />
        
        {/* 下段：カロリー収支 (領域を奪って広く flex-[4]) */}
        <div className="flex-[4] relative min-h-0">
          <div className="absolute top-0 left-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest z-10">Daily Calorie Balance</div>
          
          <div className="absolute inset-0 top-6 bottom-0 left-0 right-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 0, bottom: -15, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="date" height={10} tick={false} axisLine={false} tickLine={false} />
                <YAxis hide domain={['auto', 'auto']} />
                
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px', backdropFilter: 'blur(8px)' }}
                  formatter={(val: number, name: string) => {
                    if (name === "Net Balance (Daily)") {
                      const realVal = val * -1;
                      return [realVal > 0 ? `+${realVal}` : realVal, "Net Balance (Daily)"];
                    }
                    return [Math.abs(val), name];
                  }}
                  labelFormatter={(label) => `Date: ${label}`}
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                />
                
                <Bar dataKey="burned" name="Burned (Out)" fill="oklch(0.6 0.2 250)" radius={[4, 4, 0, 0]} maxBarSize={20} opacity={0.9} />
                <Bar dataKey={(d) => d.intake * -1} name="Intake (In)" fill="oklch(0.4 0.15 280)" radius={[0, 0, 4, 4]} maxBarSize={20} opacity={0.7} />
                
                <Line 
                  type="monotone" 
                  dataKey={(d) => d.balance * -1} 
                  name="Net Balance (Daily)" 
                  stroke="oklch(0.8 0.15 150)" 
                  strokeWidth={3} 
                  dot={false} 
                  activeDot={{ r: 5, fill: '#0f172a', stroke: 'oklch(0.8 0.15 150)', strokeWidth: 2 }} 
                  style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.6))' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}

// --- 6. MediaPanel ---
function MediaPanel({ data }: { data?: EntertainmentData | null }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const isLoading = data == null
  const breakdown = data?.breakdown ?? []
  const totalMin = breakdown.reduce((s, i) => s + i.minutes, 0)
  const lvl = getWasteLevel(isLoading ? -1 : totalMin)
  const limitMin = 180
  const progressPct = isLoading ? 0 : Math.min(100, (totalMin / limitMin) * 100)

  const byMain: Record<string, number> = {}
  for (const item of breakdown) {
    byMain[item.cat_main] = (byMain[item.cat_main] ?? 0) + item.minutes
  }
  const maxCatMin = Math.max(...Object.values(byMain), 1)

  const grouped = Object.entries(
    breakdown.reduce<Record<string, EntertainmentItem[]>>((acc, item) => {
      if (!acc[item.cat_main]) acc[item.cat_main] = []
      acc[item.cat_main].push(item)
      return acc
    }, {})
  )
    .map(([cat, items]) => ({ cat, items, catMin: items.reduce((s, i) => s + i.minutes, 0) }))
    .sort((a, b) => b.catMin - a.catMin)

  const fmtSubName = (name: string) =>
    name.charAt(0).toUpperCase() + name.slice(1).toLowerCase().replace(/_/g, ' ')

  return (
    <div className="grid grid-cols-12 gap-4 h-full min-h-0">
      {/* Left: status + category summary */}
      <div className="col-span-4 flex flex-col gap-3 min-h-0">
        <div
          className="rounded-2xl border p-4 relative overflow-hidden shrink-0"
          style={{
            background: `linear-gradient(135deg, oklch(0.14 0.02 250), oklch(0.08 0.01 250))`,
            borderColor: `${lvl.color}30`,
          }}
        >
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full blur-3xl opacity-15 pointer-events-none" style={{ backgroundColor: lvl.color }} />
          <div className="text-[9px] text-muted-foreground uppercase tracking-widest mb-2">Leisure Time</div>
          <div className="flex items-end justify-between mb-3">
            <span className="text-4xl font-black font-mono tracking-tighter leading-none"
              style={{ color: lvl.color, filter: `drop-shadow(0 0 10px ${lvl.color}60)` }}>
              {isLoading ? "--" : totalMin === 0 ? "0m" : fmtMin(totalMin)}
            </span>
            <span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded border mb-1"
              style={{ color: lvl.color, borderColor: `${lvl.color}40`, backgroundColor: `${lvl.color}15` }}>
              {lvl.label}
            </span>
          </div>
          <div className="h-1.5 bg-[oklch(0.08_0.01_250)] rounded-full overflow-hidden border border-white/5">
            <div className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: mounted ? `${progressPct}%` : '0%', backgroundColor: lvl.color, boxShadow: `0 0 8px ${lvl.color}80` }} />
          </div>
          <div className="text-[9px] text-muted-foreground mt-1.5">{lvl.sub}</div>
        </div>

        <div className="bg-[oklch(0.12_0.015_250)] rounded-2xl p-3.5 border border-white/5 flex-1 flex flex-col min-h-0">
          <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mb-3 shrink-0">By Category</div>
          <div className="space-y-3">
            {(["MEDIA", "MANGA", "GAME", "SOCIAL"] as const).map(cat => {
              const min = byMain[cat] ?? 0
              const pct = (min / maxCatMin) * 100
              const color = CAT_COLORS[cat]
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="font-semibold" style={{ color }}>{CAT_LABELS[cat]}</span>
                    <span className="font-mono text-muted-foreground">{min > 0 ? fmtMin(min) : "–"}</span>
                  </div>
                  <div className="h-1 bg-[oklch(0.08_0.01_250)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: mounted ? `${pct}%` : '0%', backgroundColor: color, boxShadow: `0 0 6px ${color}60` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right: hierarchical breakdown */}
      <div className="col-span-8 bg-[oklch(0.12_0.015_250)] rounded-2xl border border-white/5 flex flex-col min-h-0 h-full p-4">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 shrink-0">Activity Breakdown</div>

        {!isLoading && grouped.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-sm text-muted-foreground italic">No entertainment today</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-5 pr-1 min-h-0">
          {grouped.map(({ cat, items, catMin }) => (
            <div key={cat}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: CAT_COLORS[cat] }} />
                  <span className="text-xs font-bold" style={{ color: CAT_COLORS[cat] }}>{CAT_LABELS[cat]}</span>
                </div>
                <span className="text-xs font-mono text-muted-foreground">{fmtMin(catMin)}</span>
              </div>
              <div className="space-y-2 ml-4">
                {items.map(item => {
                  const pct = totalMin > 0 ? (item.minutes / totalMin) * 100 : 0
                  return (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="text-[10px] text-foreground/70 w-28 truncate shrink-0">{fmtSubName(item.name)}</span>
                      <div className="flex-1 h-1.5 bg-[oklch(0.08_0.01_250)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: mounted ? `${pct}%` : '0%', backgroundColor: CAT_COLORS[cat], opacity: 0.75 }} />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground w-10 text-right shrink-0">{fmtMin(item.minutes)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
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
function LocationPanel({ data }: { data?: LocationData | null }) {
  const stays = data?.stays ?? []
  const transits = data?.transits ?? []
  const loading = data === null || data === undefined

  const formatTime = (isoStr: string | null | undefined) => {
    if (!isoStr) return "--"
    try {
      return new Date(isoStr.replace(" ", "T")).toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tokyo",
      })
    } catch {
      return "--"
    }
  }

  const formatDuration = (min: number) => {
    if (min < 60) return `${min}m`
    const h = Math.floor(min / 60)
    const m = min % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  return (
    <div className="grid grid-cols-5 gap-4 h-full">
      {/* Left: Map (60% = 3/5 cols) */}
      <div className="col-span-3 bg-[oklch(0.1_0.015_250)] rounded-xl border border-[oklch(0.6_0.18_250/0.2)] overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center flex-col gap-2 bg-[oklch(0.1_0.015_250/0.8)]">
            <MapPin className="w-8 h-8 text-[oklch(0.6_0.18_250/0.5)] animate-pulse" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Loading map...</span>
          </div>
        )}
        {!loading && (
          <LocationMap stays={stays} transits={transits} />
        )}
      </div>

      {/* Right: Stay list (40% = 2/5 cols) */}
      <div className="col-span-2 flex flex-col gap-2 min-h-0">
        <div className="flex items-center justify-between shrink-0">
          <h4 className="text-xs font-semibold text-[oklch(0.6_0.18_250)] uppercase tracking-wider">
            Location History
          </h4>
          <span className="text-[10px] font-mono text-muted-foreground">
            {stays.length} stops
          </span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
          {stays.length === 0 && !loading && (
            <div className="text-xs text-muted-foreground text-center py-8 uppercase tracking-wide">
              No stays recorded
            </div>
          )}
          {stays.map((stay, index) => (
            <div
              key={stay.stayPk}
              className="flex items-start gap-2 bg-[oklch(0.1_0.015_250)] rounded-lg p-2.5 border border-[oklch(0.25_0.03_250/0.3)]"
            >
              <div className="flex flex-col items-center shrink-0 pt-0.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[oklch(0.6_0.18_250)] shadow-[0_0_6px_oklch(0.6_0.18_250)]" />
                {index < stays.length - 1 && (
                  <div className="w-px h-5 bg-[oklch(0.6_0.18_250/0.3)] mt-1" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <span className="text-xs font-semibold text-foreground truncate leading-tight">
                    {stay.placeName}
                  </span>
                  <span className="text-[10px] font-mono text-[oklch(0.6_0.18_250)] shrink-0">
                    {formatDuration(stay.durationMin)}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  {formatTime(stay.arrivedAt)} – {formatTime(stay.departedAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
