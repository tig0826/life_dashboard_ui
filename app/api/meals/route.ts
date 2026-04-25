// app/api/meals/route.ts
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
      query: `SELECT * FROM life_gold.mrt_asken WHERE target_date = DATE '${targetDate}'`,
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
    const splitItems = (str: string) => (str ? str.split("||") : []);

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
        {
          name: "Fiber",
          label: "食物繊維",
          current: Number(row[13]),
          target: 25,
          unit: "g",
        },
        {
          name: "Salt",
          label: "塩分",
          current: Number(row[14]),
          target: 7.5,
          unit: "g",
          isLimitType: true,
        },
        {
          name: "SatFat",
          label: "飽和脂肪酸",
          current: Number(row[15]),
          target: 16,
          unit: "g",
          isLimitType: true,
        },
        {
          name: "Potassium",
          label: "カリウム",
          current: Number(row[16]),
          target: 2500,
          unit: "mg",
        },
        {
          name: "Calcium",
          label: "カルシウム",
          current: Number(row[17]),
          target: 650,
          unit: "mg",
        },
        {
          name: "Iron",
          label: "鉄",
          current: Number(row[18]),
          target: 7.5,
          unit: "mg",
        },
        {
          name: "VitA",
          label: "ビタミンA",
          current: Number(row[19]),
          target: 850,
          unit: "μg",
        },
        {
          name: "VitE",
          label: "ビタミンE",
          current: Number(row[20]),
          target: 6.0,
          unit: "mg",
        },
        {
          name: "VitB1",
          label: "ビタミンB1",
          current: Number(row[21]),
          target: 1.4,
          unit: "mg",
        },
        {
          name: "VitB2",
          label: "ビタミンB2",
          current: Number(row[22]),
          target: 1.6,
          unit: "mg",
        },
        {
          name: "VitB6",
          label: "ビタミンB6",
          current: Number(row[23]),
          target: 1.4,
          unit: "mg",
        },
        {
          name: "VitC",
          label: "ビタミンC",
          current: Number(row[24]),
          target: 100,
          unit: "mg",
        },
      ],
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
