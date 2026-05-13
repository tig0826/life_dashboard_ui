import { NextRequest, NextResponse } from "next/server";
import { Trino } from "trino-client";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");
  if (!dateStr) {
    return NextResponse.json({ error: "Missing date" }, { status: 400 });
  }

  const trino = Trino.create({
    server: process.env.TRINO_SERVER_URL || "http://localhost:8080",
    catalog: process.env.TRINO_CATALOG || "iceberg",
    schema: "life_gold",
  });

  const query = {
    query: `
      SELECT slot, generated_at, messages, model
      FROM life_gold.ai_feedback
      WHERE feedback_date = DATE '${dateStr}'
      ORDER BY
        CASE slot
          WHEN 'morning' THEN 1
          WHEN 'noon'    THEN 2
          WHEN 'night'   THEN 3
          ELSE 4
        END
    `,
    user: "dashboard-api",
  };

  try {
    const iter = await trino.query(query);
    const rows: any[] = [];
    for await (const result of iter) {
      if (result.error) throw new Error(result.error.message);
      if (result.data) rows.push(...result.data);
    }

    // slot ごとにまとめて返す
    const bySlot: Record<string, { generatedAt: string; messages: any[]; model: string }> = {};
    for (const row of rows) {
      const [slot, generatedAt, messagesJson, model] = row;
      bySlot[slot] = {
        generatedAt: String(generatedAt),
        messages: JSON.parse(messagesJson),
        model: String(model),
      };
    }

    return NextResponse.json(bySlot);
  } catch (error: any) {
    console.error("Feedback API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
