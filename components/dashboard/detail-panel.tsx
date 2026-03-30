"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Briefcase, Gamepad2, Dumbbell, Utensils, MapPin, Monitor, Clock, Focus, TrendingDown, TrendingUp, Scale, AlertTriangle, CheckCircle } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ComposedChart, Bar } from "recharts"
import { PeriodSelector, type Period } from "./period-selector"

// Work data from ActivityWatch (AFK removed from pie chart data)
const appUsageDataForChart = [
  { name: "VSCode", value: 240, percent: 63, color: "oklch(0.6 0.18 250)" },
  { name: "Chrome", value: 80, percent: 21, color: "oklch(0.7 0.2 60)" },
  { name: "Slack", value: 45, percent: 12, color: "oklch(0.7 0.18 340)" },
  { name: "Terminal", value: 20, percent: 5, color: "oklch(0.7 0.2 145)" },
]

const appUsageDataForList = [
  { name: "VSCode", value: 240, percent: 60, color: "oklch(0.6 0.18 250)" },
  { name: "Chrome", value: 80, percent: 20, color: "oklch(0.7 0.2 60)" },
  { name: "Slack", value: 45, percent: 11, color: "oklch(0.7 0.18 340)" },
  { name: "Terminal", value: 20, percent: 5, color: "oklch(0.7 0.2 145)" },
  { name: "AFK", value: 15, percent: 4, color: "oklch(0.4 0.02 250)" },
]

const workStats = {
  totalTime: "6h 40m",
  focusRate: 88,
  afkRate: 12,
  startTime: "09:15",
  endTime: "18:30",
}

// Entertainment data
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

// Fitness trend data (week)
const weeklyFitnessData = [
  { date: "3/4", intake: 2200, burned: 2100, weight: 68.8, balance: 100 },
  { date: "3/5", intake: 1950, burned: 2300, weight: 68.7, balance: -350 },
  { date: "3/6", intake: 2100, burned: 2250, weight: 68.5, balance: -150 },
  { date: "3/7", intake: 2400, burned: 2100, weight: 68.6, balance: 300 },
  { date: "3/8", intake: 1800, burned: 2400, weight: 68.4, balance: -600 },
  { date: "3/9", intake: 2000, burned: 2300, weight: 68.3, balance: -300 },
  { date: "3/10", intake: 2100, burned: 2340, weight: 68.2, balance: -240 },
]

const monthlyFitnessData = [
  { date: "Week1", intake: 14500, burned: 15200, weight: 69.5, balance: -700 },
  { date: "Week2", intake: 14200, burned: 15800, weight: 69.1, balance: -1600 },
  { date: "Week3", intake: 14800, burned: 15500, weight: 68.8, balance: -700 },
  { date: "Week4", intake: 14350, burned: 15690, weight: 68.2, balance: -1340 },
]

// Exercise & Diet data
const exerciseData = {
  steps: 8432,
  stepsGoal: 10000,
  weight: 68.2,
  weightChange: -0.3,
  bodyFat: 18.5,
  bodyFatChange: -0.2,
  muscle: 32.1,
  muscleChange: +0.1,
  intakeCalories: 2100,
  burnedCalories: 2340,
  calorieBalance: -240,
}

// Meal data from Asken
const mealData = {
  breakfast: { 
    items: ["玄米トースト", "目玉焼き", "サラダ", "ヨーグルト"], 
    calories: 450 
  },
  lunch: { 
    items: ["鶏胸肉のグリル", "玄米", "野菜スープ", "サラダ"], 
    calories: 680 
  },
  dinner: { 
    items: ["サーモンのソテー", "温野菜", "味噌汁", "ご飯"], 
    calories: 820 
  },
}

// Full nutrition data from Asken
const nutritionData = [
  { name: "Energy", label: "エネルギー", current: 1950, target: 2100, unit: "kcal" },
  { name: "Protein", label: "タンパク質", current: 85, target: 100, unit: "g" },
  { name: "Fat", label: "脂質", current: 58, target: 70, unit: "g" },
  { name: "Carbs", label: "糖質", current: 245, target: 280, unit: "g" },
  { name: "Fiber", label: "食物繊維", current: 18, target: 25, unit: "g" },
  { name: "SatFat", label: "飽和脂肪酸", current: 18, target: 16, unit: "g", isLimitType: true },
  { name: "Salt", label: "塩分", current: 7.2, target: 7.5, unit: "g", isLimitType: true },
  { name: "Potassium", label: "カリウム", current: 2100, target: 2500, unit: "mg" },
  { name: "Calcium", label: "カルシウム", current: 550, target: 650, unit: "mg" },
  { name: "Iron", label: "鉄", current: 6.5, target: 7.5, unit: "mg" },
  { name: "VitA", label: "ビタミンA", current: 680, target: 850, unit: "μg" },
  { name: "VitE", label: "ビタミンE", current: 5.8, target: 6.0, unit: "mg" },
  { name: "VitB1", label: "ビタミンB1", current: 1.1, target: 1.4, unit: "mg" },
  { name: "VitB2", label: "ビタミンB2", current: 1.3, target: 1.6, unit: "mg" },
  { name: "VitB6", label: "ビタミンB6", current: 1.2, target: 1.4, unit: "mg" },
  { name: "VitC", label: "ビタミンC", current: 85, target: 100, unit: "mg" },
]

// Location data from OwnTracks
const locationLog = [
  { time: "07:00", location: "自宅", duration: "2h", coords: "35.6812, 139.7671" },
  { time: "09:00", location: "オフィス", duration: "8h", coords: "35.6586, 139.7454" },
  { time: "17:00", location: "カフェ", duration: "1h", coords: "35.6595, 139.7005" },
  { time: "18:00", location: "ジム", duration: "1h", coords: "35.6614, 139.7043" },
  { time: "19:30", location: "自宅", duration: "-", coords: "35.6812, 139.7671" },
]

interface DetailPanelProps {
  period: Period
  onPeriodChange: (period: Period) => void
}

export function DetailPanel({ period, onPeriodChange }: DetailPanelProps) {
  const [activeTab, setActiveTab] = useState("work")

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0 mb-2">
        <TabsList className="grid grid-cols-5 bg-[oklch(0.12_0.015_250)] p-0.5 h-9 rounded-lg">
          <TabsTrigger value="work" className="text-xs gap-1.5 data-[state=active]:bg-[oklch(0.75_0.15_195/0.2)] data-[state=active]:text-[oklch(0.8_0.12_195)] h-8 rounded-md font-medium">
            <Briefcase className="w-3.5 h-3.5" />
            Work
          </TabsTrigger>
          <TabsTrigger value="media" className="text-xs gap-1.5 data-[state=active]:bg-[oklch(0.7_0.18_340/0.2)] data-[state=active]:text-[oklch(0.75_0.15_340)] h-8 rounded-md font-medium">
            <Gamepad2 className="w-3.5 h-3.5" />
            Media
          </TabsTrigger>
          <TabsTrigger value="fitness" className="text-xs gap-1.5 data-[state=active]:bg-[oklch(0.7_0.2_145/0.2)] data-[state=active]:text-[oklch(0.75_0.18_145)] h-8 rounded-md font-medium">
            <Dumbbell className="w-3.5 h-3.5" />
            Fitness
          </TabsTrigger>
          <TabsTrigger value="meals" className="text-xs gap-1.5 data-[state=active]:bg-[oklch(0.7_0.2_60/0.2)] data-[state=active]:text-[oklch(0.75_0.18_60)] h-8 rounded-md font-medium">
            <Utensils className="w-3.5 h-3.5" />
            Meals
          </TabsTrigger>
          <TabsTrigger value="location" className="text-xs gap-1.5 data-[state=active]:bg-[oklch(0.6_0.18_250/0.2)] data-[state=active]:text-[oklch(0.7_0.15_250)] h-8 rounded-md font-medium">
            <MapPin className="w-3.5 h-3.5" />
            Location
          </TabsTrigger>
        </TabsList>
        
        <PeriodSelector value={period} onChange={onPeriodChange} size="sm" />
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        <TabsContent value="work" className="mt-0 h-full">
          <WorkPanel period={period} />
        </TabsContent>
        <TabsContent value="media" className="mt-0 h-full">
          <MediaPanel period={period} />
        </TabsContent>
        <TabsContent value="fitness" className="mt-0 h-full">
          <FitnessPanel period={period} />
        </TabsContent>
        <TabsContent value="meals" className="mt-0 h-full">
          <MealsPanel period={period} />
        </TabsContent>
        <TabsContent value="location" className="mt-0 h-full">
          <LocationPanel period={period} />
        </TabsContent>
      </div>
    </Tabs>
  )
}

function WorkPanel({ period }: { period: Period }) {
  return (
    <div className="grid grid-cols-3 gap-4 h-full">
      {/* Stats */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-[oklch(0.75_0.15_195)] flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Work Stats {period !== "day" && `(${period === "week" ? "Weekly" : "Monthly"} Avg)`}
        </h4>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="bg-[oklch(0.12_0.015_250)] rounded-lg p-2.5 border border-[oklch(0.75_0.15_195/0.2)]">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Total Time</div>
            <div className="text-xl font-bold font-mono text-[oklch(0.75_0.15_195)]">{workStats.totalTime}</div>
          </div>
          <div className="bg-[oklch(0.12_0.015_250)] rounded-lg p-2.5 border border-[oklch(0.7_0.2_145/0.2)]">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Focus className="w-2.5 h-2.5" />
              Focus
            </div>
            <div className="text-xl font-bold font-mono text-[oklch(0.7_0.2_145)]">{workStats.focusRate}%</div>
          </div>
          <div className="bg-[oklch(0.12_0.015_250)] rounded-lg p-2.5 border border-[oklch(0.3_0.03_250/0.2)]">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Start</div>
            <div className="text-lg font-mono text-foreground/80">{workStats.startTime}</div>
          </div>
          <div className="bg-[oklch(0.12_0.015_250)] rounded-lg p-2.5 border border-[oklch(0.3_0.03_250/0.2)]">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">End</div>
            <div className="text-lg font-mono text-foreground/80">{workStats.endTime}</div>
          </div>
        </div>
        <div className="bg-[oklch(0.12_0.015_250)] rounded-lg p-2.5 border border-[oklch(0.65_0.22_25/0.2)]">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1.5">AFK Rate</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2.5 bg-[oklch(0.18_0.02_250)] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[oklch(0.65_0.22_25)] rounded-full shadow-[0_0_8px_oklch(0.65_0.22_25/0.5)]"
                style={{ width: `${workStats.afkRate}%` }}
              />
            </div>
            <span className="text-base font-mono text-[oklch(0.65_0.22_25)]">{workStats.afkRate}%</span>
          </div>
        </div>
      </div>

      {/* App Usage Chart - AFK excluded */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-[oklch(0.75_0.15_195)] flex items-center gap-1.5">
          <Monitor className="w-3.5 h-3.5" />
          App Usage
        </h4>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={appUsageDataForChart}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={60}
                dataKey="value"
                strokeWidth={0}
              >
                {appUsageDataForChart.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'oklch(0.12 0.015 250)', 
                  border: '1px solid oklch(0.3 0.04 250)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#fff'
                }}
                formatter={(value: number) => [`${Math.round(value / 60 * 10) / 10}h`, 'Time']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* App List - includes AFK */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground">Breakdown</h4>
        <div className="space-y-1.5">
          {appUsageDataForList.map((app) => (
            <div key={app.name} className="flex items-center gap-2 bg-[oklch(0.1_0.015_250)] rounded-lg p-2 border border-[oklch(0.25_0.03_250/0.3)]">
              <div 
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: app.color, boxShadow: `0 0 6px ${app.color}` }} 
              />
              <span className="flex-1 text-xs text-foreground/90">{app.name}</span>
              <span className="text-xs font-mono text-muted-foreground">{Math.round(app.value / 60 * 10) / 10}h</span>
              <span className="text-xs font-mono text-foreground/60 w-8 text-right">{app.percent}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MediaPanel({ period }: { period: Period }) {
  return (
    <div className="grid grid-cols-3 gap-4 h-full">
      {/* Stats */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-[oklch(0.7_0.18_340)]">
          Media Stats {period !== "day" && `(${period === "week" ? "Weekly" : "Monthly"})`}
        </h4>
        <div className="bg-[oklch(0.12_0.015_250)] rounded-lg p-3 border border-[oklch(0.7_0.18_340/0.2)]">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Total Media Time</div>
          <div className="text-2xl font-bold font-mono text-[oklch(0.7_0.18_340)]">2h 45m</div>
          <div className="text-[10px] text-[oklch(0.7_0.2_145)] mt-1 flex items-center gap-1">
            <TrendingDown className="w-3 h-3" />
            -15m vs target
          </div>
        </div>
        
        <h4 className="text-xs font-semibold text-muted-foreground pt-1">YouTube Genres</h4>
        <div className="space-y-1.5">
          {youtubeGenres.map((genre) => (
            <div key={genre.genre} className="flex items-center gap-2">
              <span className="text-[10px] text-foreground/80 w-10">{genre.genre}</span>
              <div className="flex-1 h-2 bg-[oklch(0.18_0.02_250)] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[oklch(0.65_0.22_25)] rounded-full shadow-[0_0_6px_oklch(0.65_0.22_25/0.5)]"
                  style={{ width: `${genre.percent}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground w-7 text-right">{genre.percent}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Media Chart */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-[oklch(0.7_0.18_340)]">Usage Breakdown</h4>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={mediaUsageData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={65}
                dataKey="value"
                strokeWidth={0}
              >
                {mediaUsageData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'oklch(0.12 0.015 250)', 
                  border: '1px solid oklch(0.3 0.04 250)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#fff'
                }}
                formatter={(value: number) => [`${value}%`, 'Ratio']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Media List */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground">Platforms</h4>
        <div className="space-y-1.5">
          {mediaUsageData.map((item) => (
            <div key={item.name} className="flex items-center gap-2 bg-[oklch(0.1_0.015_250)] rounded-lg p-2.5 border border-[oklch(0.25_0.03_250/0.3)]">
              <div 
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}` }} 
              />
              <span className="flex-1 text-xs text-foreground/90">{item.name}</span>
              <span className="text-lg font-mono font-bold text-foreground/80">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FitnessPanel({ period }: { period: Period }) {
  const chartData = period === "month" ? monthlyFitnessData : weeklyFitnessData

  return (
    <div className="grid grid-cols-12 gap-3 h-full">
      {/* Left: Today's Stats */}
      <div className="col-span-3 space-y-2">
        <h4 className="text-xs font-semibold text-[oklch(0.7_0.2_145)]">Today</h4>
        
        {/* Steps */}
        <div className="bg-[oklch(0.12_0.015_250)] rounded-lg p-2.5 border border-[oklch(0.75_0.15_195/0.25)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wide">Steps</span>
            <span className="text-[9px] text-muted-foreground">{Math.round((exerciseData.steps / exerciseData.stepsGoal) * 100)}%</span>
          </div>
          <div className="text-xl font-bold font-mono text-[oklch(0.75_0.15_195)]">
            {exerciseData.steps.toLocaleString()}
          </div>
          <div className="mt-1.5 h-1.5 bg-[oklch(0.18_0.02_250)] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[oklch(0.75_0.15_195)] rounded-full shadow-[0_0_8px_oklch(0.75_0.15_195/0.6)]"
              style={{ width: `${Math.min((exerciseData.steps / exerciseData.stepsGoal) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Weight */}
        <div className="bg-[oklch(0.12_0.015_250)] rounded-lg p-2.5 border border-[oklch(0.85_0.18_90/0.25)]">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Weight</div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-[oklch(0.85_0.18_90)]">{exerciseData.weight}</span>
            <span className="text-xs text-muted-foreground">kg</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[oklch(0.7_0.2_145)] mt-0.5">
            <TrendingDown className="w-2.5 h-2.5" />
            {exerciseData.weightChange}kg
          </div>
        </div>

        {/* Body Composition */}
        <div className="bg-[oklch(0.12_0.015_250)] rounded-lg p-2.5 border border-[oklch(0.3_0.03_250/0.2)]">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1.5">Body Composition</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-[10px] text-muted-foreground">Body Fat</span>
              <span className="text-xs font-mono text-foreground/80">{exerciseData.bodyFat}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-muted-foreground">Muscle</span>
              <span className="text-xs font-mono text-foreground/80">{exerciseData.muscle}kg</span>
            </div>
          </div>
        </div>

        {/* Calorie Balance */}
        <div className="bg-[oklch(0.12_0.015_250)] rounded-lg p-2.5 border border-[oklch(0.7_0.2_145/0.25)]">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Today&apos;s Balance</div>
          <div className="text-xl font-bold font-mono text-[oklch(0.7_0.2_145)]">
            {exerciseData.calorieBalance > 0 ? "+" : ""}{exerciseData.calorieBalance}
            <span className="text-xs font-normal text-muted-foreground ml-1">kcal</span>
          </div>
          <div className="flex justify-between text-[10px] mt-1 text-muted-foreground">
            <span>In: {exerciseData.intakeCalories}</span>
            <span>Out: {exerciseData.burnedCalories}</span>
          </div>
        </div>
      </div>

      {/* Right: Trend Charts */}
      <div className="col-span-9 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-[oklch(0.7_0.2_145)]">
            {period === "day" ? "Weekly" : period === "week" ? "Weekly" : "Monthly"} Trends
          </h4>
          <div className="flex items-center gap-3 text-[9px]">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-1 rounded bg-[oklch(0.7_0.2_60)]" />
              <span className="text-muted-foreground">Intake</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-1 rounded bg-[oklch(0.65_0.22_25)]" />
              <span className="text-muted-foreground">Burned</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-1 rounded bg-[oklch(0.85_0.18_90)]" />
              <span className="text-muted-foreground">Weight</span>
            </div>
          </div>
        </div>

        {/* Calorie Chart */}
        <div className="bg-[oklch(0.1_0.015_250)] rounded-xl p-3 border border-[oklch(0.25_0.03_250/0.3)] h-[46%]">
          <div className="text-[10px] text-muted-foreground mb-1">Calories (kcal)</div>
          <ResponsiveContainer width="100%" height="85%">
            <ComposedChart data={chartData}>
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 9, fill: 'oklch(0.6 0 0)' }}
                axisLine={{ stroke: 'oklch(0.25 0.02 250)' }}
                tickLine={false}
              />
              <YAxis 
                yAxisId="calories"
                tick={{ fontSize: 9, fill: 'oklch(0.6 0 0)' }}
                axisLine={{ stroke: 'oklch(0.25 0.02 250)' }}
                tickLine={false}
                domain={[1500, 2800]}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'oklch(0.12 0.015 250)', 
                  border: '1px solid oklch(0.3 0.04 250)',
                  borderRadius: '8px',
                  fontSize: '10px',
                  color: '#fff'
                }}
              />
              <Bar 
                yAxisId="calories"
                dataKey="intake" 
                fill="oklch(0.7 0.2 60)" 
                radius={[3, 3, 0, 0]}
                opacity={0.8}
              />
              <Bar 
                yAxisId="calories"
                dataKey="burned" 
                fill="oklch(0.65 0.22 25)" 
                radius={[3, 3, 0, 0]}
                opacity={0.8}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Weight Chart */}
        <div className="bg-[oklch(0.1_0.015_250)] rounded-xl p-3 border border-[oklch(0.25_0.03_250/0.3)] h-[46%]">
          <div className="text-[10px] text-muted-foreground mb-1">Weight (kg)</div>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={chartData}>
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 9, fill: 'oklch(0.6 0 0)' }}
                axisLine={{ stroke: 'oklch(0.25 0.02 250)' }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 9, fill: 'oklch(0.6 0 0)' }}
                axisLine={{ stroke: 'oklch(0.25 0.02 250)' }}
                tickLine={false}
                domain={['dataMin - 0.5', 'dataMax + 0.5']}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'oklch(0.12 0.015 250)', 
                  border: '1px solid oklch(0.3 0.04 250)',
                  borderRadius: '8px',
                  fontSize: '10px',
                  color: '#fff'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="weight" 
                stroke="oklch(0.85 0.18 90)" 
                strokeWidth={2}
                dot={{ fill: 'oklch(0.85 0.18 90)', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: 'oklch(0.85 0.18 90)', stroke: 'oklch(0.95 0.1 90)', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function MealsPanel({ period }: { period: Period }) {
  const totalCalories = mealData.breakfast.calories + mealData.lunch.calories + mealData.dinner.calories

  // Separate macro nutrients from micro nutrients
  const macros = nutritionData.slice(0, 5)
  const micros = nutritionData.slice(5)

  return (
    <div className="grid grid-cols-12 gap-3 h-full">
      {/* Left: Meals */}
      <div className="col-span-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-[oklch(0.7_0.2_60)]">
            {period === "day" ? "Today's" : period === "week" ? "Weekly Avg" : "Monthly Avg"} Meals
          </h4>
          <div className="text-xs font-mono text-[oklch(0.7_0.2_60)]">{totalCalories} kcal</div>
        </div>
        
        {Object.entries(mealData).map(([key, meal]) => (
          <div key={key} className="bg-[oklch(0.12_0.015_250)] rounded-lg p-2.5 border border-[oklch(0.7_0.2_60/0.2)]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-foreground capitalize">
                {key === "breakfast" ? "Breakfast" : key === "lunch" ? "Lunch" : "Dinner"}
              </span>
              <span className="text-xs font-mono text-[oklch(0.7_0.2_60)]">{meal.calories} kcal</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {meal.items.map((item) => (
                <span key={item} className="text-[10px] bg-[oklch(0.18_0.02_250)] rounded px-1.5 py-0.5 text-foreground/70">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Middle: Macro Nutrients */}
      <div className="col-span-4 space-y-2">
        <h4 className="text-xs font-semibold text-[oklch(0.7_0.2_60)]">Macro Nutrients</h4>
        <div className="space-y-1.5">
          {macros.map((nutrient) => {
            const ratio = (nutrient.current / nutrient.target) * 100
            const status = ratio >= 80 && ratio <= 110 ? "good" : ratio < 80 ? "low" : "high"
            
            return (
              <div key={nutrient.name} className="bg-[oklch(0.1_0.015_250)] rounded-lg p-2 border border-[oklch(0.25_0.03_250/0.3)]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-foreground/90">{nutrient.label}</span>
                  <div className="flex items-center gap-1.5">
                    {status === "good" && <CheckCircle className="w-2.5 h-2.5 text-[oklch(0.7_0.2_145)]" />}
                    {status === "low" && <TrendingDown className="w-2.5 h-2.5 text-[oklch(0.7_0.2_60)]" />}
                    {status === "high" && <AlertTriangle className="w-2.5 h-2.5 text-[oklch(0.65_0.22_25)]" />}
                    <span className="text-[10px] font-mono text-foreground/80">{nutrient.current}</span>
                    <span className="text-[9px] text-muted-foreground">/ {nutrient.target}{nutrient.unit}</span>
                  </div>
                </div>
                <div className="h-1.5 bg-[oklch(0.18_0.02_250)] rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(ratio, 100)}%`,
                      backgroundColor: status === "good" ? "oklch(0.7 0.2 145)" : status === "low" ? "oklch(0.7 0.2 60)" : "oklch(0.65 0.22 25)",
                      boxShadow: `0 0 6px ${status === "good" ? "oklch(0.7 0.2 145 / 0.5)" : status === "low" ? "oklch(0.7 0.2 60 / 0.5)" : "oklch(0.65 0.22 25 / 0.5)"}`
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right: Micro Nutrients */}
      <div className="col-span-4 space-y-2 overflow-auto">
        <h4 className="text-xs font-semibold text-[oklch(0.7_0.2_60)]">Vitamins & Minerals</h4>
        <div className="grid grid-cols-2 gap-1.5">
          {micros.map((nutrient) => {
            const ratio = (nutrient.current / nutrient.target) * 100
            const isLimitType = 'isLimitType' in nutrient && nutrient.isLimitType
            const status = isLimitType 
              ? (ratio <= 100 ? "good" : "high")
              : (ratio >= 80 ? "good" : "low")
            
            return (
              <div key={nutrient.name} className="bg-[oklch(0.1_0.015_250)] rounded-lg p-1.5 border border-[oklch(0.25_0.03_250/0.2)]">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] text-foreground/80">{nutrient.label}</span>
                  {status === "good" && <CheckCircle className="w-2 h-2 text-[oklch(0.7_0.2_145)]" />}
                  {status === "low" && <TrendingDown className="w-2 h-2 text-[oklch(0.7_0.2_60)]" />}
                  {status === "high" && <AlertTriangle className="w-2 h-2 text-[oklch(0.65_0.22_25)]" />}
                </div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-xs font-mono text-foreground/90">{nutrient.current}</span>
                  <span className="text-[8px] text-muted-foreground">/ {nutrient.target}{nutrient.unit}</span>
                </div>
                <div className="h-1 bg-[oklch(0.18_0.02_250)] rounded-full overflow-hidden mt-0.5">
                  <div 
                    className="h-full rounded-full"
                    style={{ 
                      width: `${Math.min(ratio, 100)}%`,
                      backgroundColor: status === "good" ? "oklch(0.7 0.2 145)" : status === "low" ? "oklch(0.7 0.2 60)" : "oklch(0.65 0.22 25)"
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function LocationPanel({ period }: { period: Period }) {
  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      {/* Map */}
      <div className="bg-[oklch(0.1_0.015_250)] rounded-xl border border-[oklch(0.6_0.18_250/0.2)] overflow-hidden relative">
        <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
          <MapPin className="w-10 h-10 text-[oklch(0.6_0.18_250/0.5)]" />
          <span className="text-xs text-muted-foreground">OwnTracks Map</span>
          <span className="text-[10px] text-muted-foreground/60">
            {period === "day" ? "Today's" : period === "week" ? "Weekly" : "Monthly"} GPS Route
          </span>
        </div>
        {/* Map overlay grid effect */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `
            linear-gradient(oklch(0.6 0.18 250 / 0.3) 1px, transparent 1px),
            linear-gradient(90deg, oklch(0.6 0.18 250 / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }} />
      </div>

      {/* Location Log */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-[oklch(0.6_0.18_250)]">Location History</h4>
        <div className="space-y-1.5">
          {locationLog.map((log, index) => (
            <div key={index} className="flex items-start gap-2 bg-[oklch(0.1_0.015_250)] rounded-lg p-2.5 border border-[oklch(0.25_0.03_250/0.3)]">
              <div className="flex flex-col items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-[oklch(0.6_0.18_250)] shadow-[0_0_6px_oklch(0.6_0.18_250/0.6)]" />
                {index < locationLog.length - 1 && (
                  <div className="w-px h-6 bg-[oklch(0.6_0.18_250/0.3)] mt-1" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">{log.location}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{log.duration}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] font-mono text-[oklch(0.6_0.18_250)]">{log.time}</span>
                  <span className="text-[9px] text-muted-foreground/60 font-mono">{log.coords}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
