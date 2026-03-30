import { NextRequest, NextResponse } from "next/server";
import { Trino } from "trino-client";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");
  const targetDate = dateStr || new Date().toISOString().split("T")[0];

  const trino = Trino.create({
    server: process.env.TRINO_SERVER_URL || "http://localhost:8080",
    catalog: process.env.TRINO_CATALOG || "iceberg",
    schema: "life_gold",
  });

  const query = {
    query: `
      SELECT
        CAST(time_slot_jst AS VARCHAR) as time_slot_jst,
        CAST(time_slot_end_jst AS VARCHAR) as time_slot_end_jst,
        cat_main,
        cat_sub,
        overlap_sec
      FROM life_gold.mrt_behavior_slots_15m
      WHERE slot_date_jst = DATE '${targetDate}'
      ORDER BY time_slot_jst ASC
    `,
    user: "dashboard-api",
  };

  try {
    const iter = await trino.query(query);
    const rows: any[] = [];

    for await (const result of iter) {
      if (result.error) {
        throw new Error(result.error.message);
      }
      if (result.data) {
        rows.push(...result.data);
      }
    }

    const mappedRows = rows.map((row: any[]) => {
      const start = new Date(row[0].replace(" ", "T"));
      const end = new Date(row[1].replace(" ", "T"));

      const startHour = start.getHours() + start.getMinutes() / 60;
      let endHour = end.getHours() + end.getMinutes() / 60;
      if (
        endHour === 0 &&
        (end.getDate() !== start.getDate() ||
          end.getMonth() !== start.getMonth())
      ) {
        endHour = 24;
      }

      return {
        type: row[2], // cat_main をそのまま返す
        startHour,
        endHour,
        cat_main: row[2],
        cat_sub: row[3],
      };
    });

    return NextResponse.json(mappedRows);
  } catch (error: any) {
    console.error("Trino Query Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
