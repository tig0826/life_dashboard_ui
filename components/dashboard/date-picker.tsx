"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date: Date
  onDateChange: (date: Date) => void
}

export function DatePicker({ date, onDateChange }: DatePickerProps) {
  const [open, setOpen] = useState(false)

  const goToPreviousDay = () => {
    const newDate = new Date(date)
    newDate.setDate(newDate.getDate() - 1)
    onDateChange(newDate)
  }

  const goToNextDay = () => {
    const newDate = new Date(date)
    newDate.setDate(newDate.getDate() + 1)
    onDateChange(newDate)
  }

  const goToToday = () => {
    onDateChange(new Date())
  }

  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={goToPreviousDay}
      >
        <ChevronLeft className="h-3 w-3" />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-7 px-2 text-xs font-mono bg-secondary/30 border-border/50 hover:bg-secondary/50",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-1.5 h-3 w-3" />
            {format(date, "yyyy/MM/dd (E)", { locale: ja })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(newDate) => {
              if (newDate) {
                onDateChange(newDate)
                setOpen(false)
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={goToNextDay}
        disabled={isToday}
      >
        <ChevronRight className="h-3 w-3" />
      </Button>

      {!isToday && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={goToToday}
        >
          今日
        </Button>
      )}
    </div>
  )
}
