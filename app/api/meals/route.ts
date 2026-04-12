import { NextRequest, NextResponse } from "next/server";
import { Trino } from "trino-client";

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
    const query = {
      query: `SELECT * FROM life_gold.mrt_asken_daily_summary WHERE target_date = DATE '${targetDate}'`,
      user: "dashboard-api",
    };

    const iter = await trino.query(query);
    const rows: any[] = [];
    for await (const result of iter) {
      if (result.data) rows.push(...result.data);
    }

    if (rows.length === 0)
      return NextResponse.json({ error: "No data found" }, { status: 404 });

    const row = rows[0];

    // 文字列を '||' で分割して配列に戻すヘルパー関数
    const splitItems = (str: string) => (str ? str.split("||") : []);

    // フロントエンドの型に一気にマッピング
    const response = {
      meals: {
        breakfast: { items: splitItems(row[1]), calories: Number(row[2]) },
        lunch: { items: splitItems(row[3]), calories: Number(row[4]) },
        dinner: { items: splitItems(row[5]), calories: Number(row[6]) },
        snack: { items: splitItems(row[7]), calories: Number(row[8]) },
      },
      nutrition: [
        {
          name: "Energy",
          label: "エネルギー",
          current: Number(row[9]),
          target: 2100,
          unit: "kcal",
        },
        {
          name: "Protein",
          label: "タンパク質",
          current: Number(row[10]),
          target: 100,
          unit: "g",
        },
        {
          name: "Fat",
          label: "脂質",
          current: Number(row[11]),
          target: 70,
          unit: "g",
          isLimitType: true,
        },
        {
          name: "Carbs",
          label: "糖質",
          current: Number(row[12]),
          target: 280,
          unit: "g",
        },
        // ... 他の栄養素も同様にマッピング
      ],
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
