import { NextRequest, NextResponse } from "next/server";
import { Trino } from "trino-client";

async function runQuery(trino: ReturnType<typeof Trino.create>, sql: string) {
  const iter = await trino.query({ query: sql, user: "dashboard-api" });
  const rows: any[] = [];
  for await (const result of iter) {
    if (result.error) throw new Error(result.error.message);
    if (result.data) rows.push(...result.data);
  }
  return rows;
}

function trino() {
  return Trino.create({
    server: process.env.TRINO_SERVER_URL || "http://localhost:8080",
    catalog: process.env.TRINO_CATALOG || "iceberg",
    schema: "life_gold",
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");
  const days = parseInt(searchParams.get("days") ?? "30");
  if (!dateStr) return NextResponse.json({ error: "Missing date" }, { status: 400 });

  const client = trino();

  try {
    const rows = await runQuery(client, `
      SELECT
        CAST(DATE(time_slot_jst) AS VARCHAR) AS dt,
        cat_main,
        cat_sub,
        SUM(overlap_sec) AS total_sec
      FROM life_gold.mrt_behavior_slots_15m
      WHERE DATE(time_slot_jst) BETWEEN DATE '${dateStr}' - INTERVAL '${days - 1}' DAY AND DATE '${dateStr}'
        AND cat_main IN ('MEDIA', 'MANGA', 'GAME', 'SOCIAL')
      GROUP BY DATE(time_slot_jst), cat_main, cat_sub
      ORDER BY dt, total_sec DESC
    `);

    const trendMainByDate: Record<string, Record<string, number>> = {};
    const todaySubs: Record<string, { sec: number; cat_main: string }> = {};

    for (const [dt, main, sub, sec] of rows) {
      const s = Number(sec);
      if (!trendMainByDate[dt]) trendMainByDate[dt] = {};
      trendMainByDate[dt][main] = (trendMainByDate[dt][main] ?? 0) + s;

      if (dt === dateStr) {
        if (!todaySubs[sub]) todaySubs[sub] = { sec: 0, cat_main: main };
        todaySubs[sub].sec += s;
      }
    }

    const breakdown = Object.entries(todaySubs)
      .map(([name, { sec, cat_main }]) => ({ name, cat_main, minutes: Math.round(sec / 60) }))
      .sort((a, b) => b.minutes - a.minutes);

    const trend = Object.entries(trendMainByDate)
      .map(([date, catMap]) => ({
        date,
        totalMin: Math.round(Object.values(catMap).reduce((a, b) => a + b, 0) / 60),
        MEDIA:  Math.round((catMap.MEDIA  ?? 0) / 60),
        MANGA:  Math.round((catMap.MANGA  ?? 0) / 60),
        GAME:   Math.round((catMap.GAME   ?? 0) / 60),
        SOCIAL: Math.round((catMap.SOCIAL ?? 0) / 60),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ date: dateStr, breakdown, trend });
  } catch (error: any) {
    console.error("Entertainment API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
