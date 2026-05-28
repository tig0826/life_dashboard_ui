import { NextRequest, NextResponse } from 'next/server'
import { parseISO, subDays, eachDayOfInterval, format } from 'date-fns'
import { getFitnessDays } from '@/lib/server-cache'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const daysStr = searchParams.get('days') || '90'

  const now    = new Date()
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const today  = jstNow.toISOString().split('T')[0]

  const endDateStr = searchParams.get('date') || today
  const days       = parseInt(daysStr, 10)
  const endDate    = parseISO(endDateStr)
  const startDate  = subDays(endDate, days - 1)

  const dates = eachDayOfInterval({ start: startDate, end: endDate })
    .map(d => format(d, 'yyyy-MM-dd'))

  try {
    const data = await getFitnessDays(dates)
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Fitness API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
