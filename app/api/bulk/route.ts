import { NextRequest, NextResponse } from 'next/server'
import { parseISO, subDays, eachDayOfInterval, format } from 'date-fns'
import { getBulkDays } from '@/lib/server-cache'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endDateStr = searchParams.get('endDate')
  const daysStr    = searchParams.get('days')

  if (!endDateStr || !daysStr) {
    return NextResponse.json({ error: 'Missing endDate or days' }, { status: 400 })
  }

  const days      = parseInt(daysStr, 10)
  const endDate   = parseISO(endDateStr)
  const startDate = subDays(endDate, days - 1)

  const dates = eachDayOfInterval({ start: startDate, end: endDate })
    .map(d => format(d, 'yyyy-MM-dd'))

  try {
    const data = await getBulkDays(dates)
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Bulk API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
