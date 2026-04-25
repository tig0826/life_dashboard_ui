import { NextRequest, NextResponse } from "next/server";
import { Trino } from "trino-client";

// アプリランキングの文字列("App1:100||App2:50")をパースして、色付きの配列にする関数
function parseAppUsage(appsStr: string) {
  if (!appsStr) return [];
  const colors = [
    "oklch(0.6 0.18 250)",
    "oklch(0.7 0.2 60)",
    "oklch(0.7 0.18 340)",
    "oklch(0.7 0.2 145)",
    "oklch(0.65 0.22 25)",
  ];
  const apps = appsStr.split("||");
  let totalValue = 0;
  const parsed = apps.map((app, index) => {
    const [name, secStr] = app.split(":");
    const value = Number(secStr);
    totalValue += value;
    return { name, value, color: colors[index % colors.length] };
  });
  return parsed.map((p) => ({
    ...p,
    percent: totalValue > 0 ? Math.round((p.value / totalValue) * 100) : 0,
  }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetDate =
    searchParams.get("date") || new Date().toISOString().split("T")[0];

  const trino = Trino.create({
    server: process.env.TRINO_SERVER_URL || "http://localhost:8080",
    catalog: process.env.TRINO_CATALOG || "iceberg",
    schema: "life_gold",
  });

  try {
    const iter = await trino.query({
      query: `SELECT * FROM life_gold.mrt_aw_daily_work_summary WHERE target_date = DATE '${targetDate}'`,
      user: "dashboard-api",
    });
    const rows: any[] = [];
    for await (const result of iter) {
      if (result.error)
        throw new Error(`Trino SQL Error: ${result.error.message}`);
      if (result.data) rows.push(...result.data);
    }

    if (rows.length === 0) {
      return NextResponse.json({
        work: { coreSec: 0, sessionSec: 0, focusRate: 0, score: 0, apps: [] },
        dev: { coreSec: 0, sessionSec: 0, focusRate: 0, score: 0, apps: [] },
      });
    }

    const row = rows[0];
    const response = {
      work: {
        coreSec: Number(row[1] || 0),
        sessionSec: Number(row[2] || 0),
        focusRate: Number(row[3] || 0),
        score: Number(row[4] || 0),
        apps: parseAppUsage(row[5]),
      },
      dev: {
        coreSec: Number(row[6] || 0),
        sessionSec: Number(row[7] || 0),
        focusRate: Number(row[8] || 0),
        score: Number(row[9] || 0),
        apps: parseAppUsage(row[10]),
      },
    };
    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
