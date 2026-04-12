"use client"

import { useMemo } from "react"

interface ActivityBlock {
  type: string
  startHour: number
  endHour: number
}

interface ActivityTimelineProps {
  date: Date
  activities: ActivityBlock[]
}

const activityConfig: Record<string, { label: string; color: string; glow: string }> = {
  SLEEP: { 
    label: "睡眠", 
    color: "oklch(0.55 0.18 250)",
    glow: "oklch(0.55 0.18 250 / 0.4)"
  },
  WORK: { 
    label: "仕事", 
    color: "oklch(0.65 0.2 145)",
    glow: "oklch(0.65 0.2 145 / 0.4)"
  },
  DEVELOP: { 
    label: "開発/学習", 
    color: "oklch(0.85 0.18 90)",
    glow: "oklch(0.85 0.18 90 / 0.4)"
  },
  MEDIA: { 
    label: "動画/メディア", 
    color: "oklch(0.65 0.18 340)",
    glow: "oklch(0.65 0.18 340 / 0.4)"
  },
  GAME: { 
    label: "ゲーム", 
    color: "oklch(0.6 0.2 300)",
    glow: "oklch(0.6 0.2 300 / 0.4)"
  },
  MANGA: { 
    label: "漫画", 
    color: "oklch(0.7 0.2 60)",
    glow: "oklch(0.7 0.2 60 / 0.4)"
  },
  SOCIAL: { 
    label: "SNS/連絡", 
    color: "oklch(0.8 0.15 20)",
    glow: "oklch(0.8 0.15 20 / 0.4)"
  },
  OUTING: { 
    label: "外出/移動", 
    color: "oklch(0.7 0.12 160)",
    glow: "oklch(0.7 0.12 160 / 0.4)"
  },
  BROWSING: { 
    label: "ブラウジング", 
    color: "oklch(0.5 0.05 250)",
    glow: "oklch(0.5 0.05 250 / 0.2)"
  },
  LIFE: { 
    label: "生活", 
    color: "oklch(0.6 0.1 100)",
    glow: "oklch(0.6 0.1 100 / 0.2)"
  },
  BATH: { 
    label: "入浴", 
    color: "oklch(0.75 0.12 210)",
    glow: "oklch(0.75 0.12 210 / 0.4)"
  },
  UNOBSERVED: { 
    label: "データなし", 
    color: "oklch(0.25 0.02 250)",
    glow: "oklch(0.25 0.02 250 / 0)"
  },
}

const defaultStyle = {
  label: "その他",
  color: "oklch(0.35 0.02 250)",
  glow: "oklch(0.35 0.02 250 / 0.2)"
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  const consolidatedBlocks = useMemo(() => {
    const blocks: { type: string; start: number; end: number }[] = []
    
    for (let hour = 0; hour < 24; hour += 0.25) {
      const activity = activities.find(a => hour >= a.startHour && hour < a.endHour)
      const type = activity?.type || "UNOBSERVED"
      
      if (blocks.length === 0 || blocks[blocks.length - 1].type !== type) {
        blocks.push({ type, start: hour, end: hour + 0.25 })
      } else {
        blocks[blocks.length - 1].end = hour + 0.25
      }
    }
    
    return blocks
  }, [activities])

  const activeTypes = useMemo(() => {
    const typesInUse = new Set(activities.map(a => a.type))
    return Object.entries(activityConfig).filter(([key]) => typesInUse.has(key))
  }, [activities])

  const hourMarkers = [0, 3, 6, 9, 12, 15, 18, 21, 24]

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {activeTypes.map(([key, config]) => (
          <div key={key} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-sm"
              style={{ 
                backgroundColor: config.color,
                boxShadow: `0 0 6px ${config.glow}`
              }} 
            />
            <span className="text-[10px] text-muted-foreground font-medium">{config.label}</span>
          </div>
        ))}
      </div>

      <div className="relative">
        <div 
          className="h-10 rounded-lg overflow-hidden flex"
          style={{ 
            background: 'oklch(0.15 0.02 250)',
            boxShadow: 'inset 0 2px 4px oklch(0 0 0 / 0.3)'
          }}
        >
          {consolidatedBlocks.map((block, index) => {
            const config = activityConfig[block.type] || defaultStyle
            const width = ((block.end - block.start) / 24) * 100
            
            return (
              <div
                key={index}
                className="h-full transition-all duration-300"
                style={{ 
                  width: `${width}%`,
                  backgroundColor: config.color,
                  boxShadow: `0 0 12px ${config.glow}, inset 0 1px 0 oklch(1 0 0 / 0.1)`,
                }}
              />
            )
          })}
        </div>
        
        <div className="relative h-6 mt-2">
          {hourMarkers.map((hour) => (
            <div
              key={hour}
              className="absolute flex flex-col items-center transform -translate-x-1/2"
              style={{ left: `${(hour / 24) * 100}%` }}
            >
              <div className="w-px h-2 bg-muted-foreground/30" />
              <span className="text-[10px] text-muted-foreground/80 font-mono mt-1">
                {hour.toString().padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
