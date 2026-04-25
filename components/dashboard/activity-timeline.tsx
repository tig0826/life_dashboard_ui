"use client"

import { useMemo, useState, useEffect } from "react"
import { 
  Bed, Briefcase, Code, MonitorPlay, Gamepad2, BookOpen, 
  MessageCircle, Navigation, Globe, Coffee, Droplets, HelpCircle, Activity
} from "lucide-react"

interface ActivityBlock {
  type: string
  startHour: number
  endHour: number
}

interface ActivityTimelineProps {
  date: Date
  activities: ActivityBlock[]
}

// アイコンをマッピングに追加
const activityConfig: Record<string, { label: string; color: string; glow: string; icon: any }> = {
  SLEEP: { label: "睡眠", color: "oklch(0.55 0.18 250)", glow: "oklch(0.55 0.18 250 / 0.6)", icon: Bed },
  WORK: { label: "仕事", color: "oklch(0.65 0.2 145)", glow: "oklch(0.65 0.2 145 / 0.6)", icon: Briefcase },
  DEVELOP: { label: "開発/学習", color: "oklch(0.85 0.18 90)", glow: "oklch(0.85 0.18 90 / 0.6)", icon: Code },
  MEDIA: { label: "動画/メディア", color: "oklch(0.65 0.18 340)", glow: "oklch(0.65 0.18 340 / 0.6)", icon: MonitorPlay },
  GAME: { label: "ゲーム", color: "oklch(0.6 0.2 300)", glow: "oklch(0.6 0.2 300 / 0.6)", icon: Gamepad2 },
  MANGA: { label: "漫画", color: "oklch(0.7 0.2 60)", glow: "oklch(0.7 0.2 60 / 0.6)", icon: BookOpen },
  SOCIAL: { label: "SNS/連絡", color: "oklch(0.8 0.15 20)", glow: "oklch(0.8 0.15 20 / 0.6)", icon: MessageCircle },
  OUTING: { label: "外出/移動", color: "oklch(0.7 0.12 160)", glow: "oklch(0.7 0.12 160 / 0.6)", icon: Navigation },
  BROWSING: { label: "ブラウジング", color: "oklch(0.5 0.05 250)", glow: "oklch(0.5 0.05 250 / 0.4)", icon: Globe },
  LIFE: { label: "生活", color: "oklch(0.6 0.1 100)", glow: "oklch(0.6 0.1 100 / 0.4)", icon: Coffee },
  BATH: { label: "入浴", color: "oklch(0.75 0.12 210)", glow: "oklch(0.75 0.12 210 / 0.6)", icon: Droplets },
  UNOBSERVED: { label: "データなし", color: "oklch(0.25 0.02 250)", glow: "oklch(0.25 0.02 250 / 0)", icon: HelpCircle },
}

const defaultStyle = { label: "その他", color: "oklch(0.35 0.02 250)", glow: "oklch(0.35 0.02 250 / 0.2)", icon: Activity }

// 時間表記のフォーマット (例: 14.5 -> "14:30")
const formatHour = (hourFloat: number) => {
  const h = Math.floor(hourFloat)
  const m = Math.round((hourFloat - h) * 60)
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

export function ActivityTimeline({ date, activities }: ActivityTimelineProps) {
  const safeActivities = Array.isArray(activities) ? activities : [];

  // 現在時刻のパルス用ステート
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const isToday = date.toDateString() === now.toDateString()
  const currentHourFloat = now.getHours() + now.getMinutes() / 60
  const pulsePosition = (currentHourFloat / 24) * 100

  const consolidatedBlocks = useMemo(() => {
    // start と end を保持するように修正
    const blocks: { type: string; duration: number; start: number; end: number }[] = []
    
    for (let hour = 0; hour < 24; hour += 0.25) {
      const activity = safeActivities.find(a => hour >= a.startHour && hour < a.endHour)
      const type = activity?.type || "UNOBSERVED"
      
      if (blocks.length === 0 || blocks[blocks.length - 1].type !== type) {
        blocks.push({ type, duration: 0.25, start: hour, end: hour + 0.25 })
      } else {
        blocks[blocks.length - 1].duration += 0.25
        blocks[blocks.length - 1].end += 0.25
      }
    }
    return blocks
  }, [safeActivities])

  const activeTypes = useMemo(() => {
    const typesInUse = new Set(safeActivities.map(a => a.type))
    return Object.entries(activityConfig).filter(([key]) => typesInUse.has(key))
  }, [safeActivities])

  const hourMarkers = [0, 3, 6, 9, 12, 15, 18, 21, 24]

  return (
    <div className="w-full space-y-5">
      {/* 凡例エリア */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 px-1">
        {activeTypes.map(([key, config]) => {
          const Icon = config.icon
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div 
                className="w-3 h-3 rounded-[3px] border"
                style={{ 
                  borderColor: config.color,
                  backgroundColor: `color-mix(in oklch, ${config.color} 20%, transparent)`,
                  boxShadow: `0 0 8px ${config.glow}`
                }} 
              />
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{config.label}</span>
            </div>
          )
        })}
      </div>

      {/* タイムライン本体 */}
      <div className="relative w-full pt-2">
        {/* Live Pulse (今日の場合のみ表示) */}
        {isToday && (
          <div 
            className="absolute top-0 bottom-[-16px] w-[2px] bg-cyan-400 z-40 transition-all duration-1000 ease-linear pointer-events-none shadow-[0_0_12px_#22d3ee]"
            style={{ left: `${pulsePosition}%` }}
          >
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_10px_#22d3ee] animate-pulse" />
          </div>
        )}

{/* 光るネオンチューブのラッパー */}
<div 
          className="h-14 flex w-full relative z-10"
          style={{ 
            background: 'oklch(0.12 0.015 250)',
            borderRadius: '12px',
            boxShadow: 'inset 0 2px 10px oklch(0 0 0 / 0.5), 0 0 0 1px oklch(1 1 1 / 0.05)'
          }}
        >
          {consolidatedBlocks.map((block, index) => {
            const config = activityConfig[block.type] || defaultStyle
            const width = (block.duration / 24) * 100
            const Icon = config.icon
            
            const showIcon = width > 3 && block.type !== "UNOBSERVED"

            return (
              <div
                key={index}
                className="relative h-full group transition-all duration-300 hover:z-30 hover:brightness-150"
                style={{ width: `${width}%` }}
              >
                {/* 🚀 修正: 隙間(inset-x)をゼロにし、角丸(rounded)を消し、左右のボーダーだけで区切る */}
                <div 
                  className="absolute inset-y-[2px] inset-x-0 border-y border-r border-white/10 flex items-center justify-center overflow-hidden backdrop-blur-sm"
                  style={{
                    borderColor: `color-mix(in oklch, ${config.color} 50%, transparent)`,
                    backgroundColor: `color-mix(in oklch, ${config.color} 30%, transparent)`,
                    boxShadow: `0 0 10px ${config.glow}, inset 0 0 12px ${config.glow}`,
                  }}
                >
                  {showIcon && <Icon className="w-4 h-4 opacity-70 drop-shadow-[0_0_4px_currentColor]" style={{ color: config.color }} />}
                </div>

                {/* ツールチップの中身はそのまま */}
                {block.type !== "UNOBSERVED" && (
                  <div className="absolute hidden group-hover:block bottom-full mb-3 left-1/2 -translate-x-1/2 w-56 z-50 pointer-events-none">
                    <div className="bg-[oklch(0.15_0.02_250)]/90 backdrop-blur-md rounded-xl p-3 shadow-[0_10px_30px_rgba(0,0,0,0.8)] border border-white/10 relative">
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[oklch(0.15_0.02_250)]/90 border-b border-r border-white/10 rotate-45" />
                      
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/5">
                          <div className="flex items-center gap-1.5">
                            <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: config.color }}>{config.label}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {formatHour(block.start)} - {formatHour(block.end)}
                          </span>
                        </div>
                        
                        <div className="space-y-1.5">
                          <div className="text-[8px] text-muted-foreground uppercase tracking-widest mb-1">Top Activities (Mock)</div>
                          <div className="flex justify-between items-center"><span className="text-[10px] text-foreground/90">{block.type === 'WORK' ? 'Chrome' : block.type === 'DEVELOP' ? 'Ghostty' : 'Activity'}</span><span className="text-[9px] font-mono opacity-60">65%</span></div>
                          <div className="h-0.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: '65%', backgroundColor: config.color }} /></div>
                          
                          <div className="flex justify-between items-center pt-1"><span className="text-[10px] text-foreground/90">{block.type === 'WORK' ? 'Slack' : block.type === 'DEVELOP' ? 'Gemini' : 'Other'}</span><span className="text-[9px] font-mono opacity-60">25%</span></div>
                          <div className="h-0.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: '25%', backgroundColor: config.color }} /></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        
        {/* 時間軸のマーカー */}
        <div className="relative h-6 mt-3">
          {hourMarkers.map((hour) => (
            <div
              key={hour}
              className="absolute flex flex-col items-center transform -translate-x-1/2"
              style={{ left: `${(hour / 24) * 100}%` }}
            >
              <div className="w-px h-1.5 bg-muted-foreground/30 mb-1" />
              <span className="text-[9px] text-muted-foreground/60 font-mono">
                {hour.toString().padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
