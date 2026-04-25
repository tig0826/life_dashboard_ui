import { NextRequest, NextResponse } from "next/server";
import { Trino } from "trino-client";

// 文字列 "[Walk] 45m (4116 steps, 349kcal) || [Run]..." を配列にパースする
function parseActivityLogs(logsStr: string) {
  if (!logsStr) return [];
  return logsStr.split(" || ").filter(Boolean);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = searchParams.get("days") || "90";
  const dateStr =
    searchParams.get("date") || new Date().toISOString().split("T")[0];

  const trino = Trino.create({
    server: process.env.TRINO_SERVER_URL || "http://localhost:8080",
    catalog: process.env.TRINO_CATALOG || "iceberg",
    schema: "life_gold",
  });

  try {
    const iter = await trino.query({
      query: `
        SELECT
          CAST(target_date AS VARCHAR),
          steps,
          calories_out,
          calories_in,
          net_calorie_balance,
          weight_kg,
          body_fat_pct,
          activity_logs_str,
          weight_7d_avg,
          resting_heart_rate
        FROM life_gold.mrt_fitness_daily_summary
        WHERE target_date BETWEEN DATE '${dateStr}' - interval '${days}' day AND DATE '${dateStr}'
        ORDER BY target_date ASC
      `,
      user: "dashboard-api",
    });

    const rows: any[] = [];
    for await (const result of iter) {
      if (result.error) throw new Error(result.error.message);
      if (result.data) rows.push(...result.data);
    }

    const response = rows.map((row) => ({
      date: row[0],
      steps: Number(row[1] || 0),
      burned: Number(row[2] || 0),
      intake: Number(row[3] || 0),
      balance: Number(row[4] || 0),
      weight: row[5] ? Number(row[5]) : null,
      bodyFat: row[6] ? Number(row[6]) : null,
      activities: parseActivityLogs(row[7] || ""),
      weight7dAvg: row[8] ? Number(row[8]) : null,
      restingHr: Number(row[9] || 0),
    }));

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
