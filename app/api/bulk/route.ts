import { NextRequest, NextResponse } from "next/server";
import { Trino } from "trino-client";
import { format, subDays, eachDayOfInterval, parseISO } from "date-fns";

// 🚀 アプリランキングパース関数
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

// 🚀 Trinoクエリ実行用ヘルパー関数
async function runTrinoQuery(trino: any, query: string) {
  console.log(
    `[Trino Bulk] Executing: ${query.substring(0, 80).replace(/\n/g, "")}...`,
  );
  const iter = await trino.query({ query, user: "dashboard-api" });
  const rows: any[] = [];
  for await (const result of iter) {
    if (result.error)
      throw new Error(`Trino SQL Error: ${result.error.message}`);
    if (result.data) rows.push(...result.data);
  }
  return rows;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endDateStr = searchParams.get("endDate");
    const daysStr = searchParams.get("days");

    if (!endDateStr || !daysStr) {
      return NextResponse.json(
        { error: "Missing endDate or days" },
        { status: 400 },
      );
    }

    const days = parseInt(daysStr, 10);
    const endDate = parseISO(endDateStr);
    const startDate = subDays(endDate, days - 1);
    const startDateStr = format(startDate, "yyyy-MM-dd");

    // 🚀 空箱（レスポンスのベース）の作成
    const dateInterval = eachDayOfInterval({ start: startDate, end: endDate });
    const responseMap = new Map<string, any>();

    dateInterval.forEach((date) => {
      const dStr = format(date, "yyyy-MM-dd");
      responseMap.set(dStr, {
        date: dStr,
        activities: [],
        meals: null,
        work: null,
        feedback: {},
      });
    });

    const trino = Trino.create({
      server: process.env.TRINO_SERVER_URL || "http://localhost:8080",
      catalog: process.env.TRINO_CATALOG || "iceberg",
      schema: "life_gold",
    });

    // 🚀 並列クエリの定義（BETWEENで期間を一括指定）
    // ※ activities は後で日付単位でGroupしやすいように、先頭に slot_date_jst を文字として追加抽出
    const queries = {
      work: `SELECT * FROM life_gold.mrt_aw_daily_work_summary WHERE target_date BETWEEN DATE '${startDateStr}' AND DATE '${endDateStr}'`,
      meals: `SELECT * FROM life_gold.mrt_asken WHERE target_date BETWEEN DATE '${startDateStr}' AND DATE '${endDateStr}'`,
      activities: `
        SELECT
          CAST(slot_date_jst AS VARCHAR) as date_str,
          CAST(time_slot_jst AS VARCHAR) as time_slot_jst,
          CAST(time_slot_end_jst AS VARCHAR) as time_slot_end_jst,
          cat_main,
          cat_sub,
          overlap_sec
        FROM life_gold.mrt_behavior_slots_15m
        WHERE slot_date_jst BETWEEN DATE '${startDateStr}' AND DATE '${endDateStr}'
        ORDER BY time_slot_jst ASC
      `,
      feedback: `
        SELECT
          CAST(feedback_date AS VARCHAR) as dt,
          slot,
          CAST(generated_at AS VARCHAR) as generated_at,
          messages,
          model
        FROM life_gold.ai_feedback
        WHERE feedback_date BETWEEN DATE '${startDateStr}' AND DATE '${endDateStr}'
        ORDER BY feedback_date,
          CASE slot WHEN 'morning' THEN 1 WHEN 'noon' THEN 2 WHEN 'night' THEN 3 ELSE 4 END
      `,
    };

    // 🚀 クエリの並列実行
    const [workResult, mealsResult, activitiesResult, feedbackResult] =
      await Promise.allSettled([
        runTrinoQuery(trino, queries.work),
        runTrinoQuery(trino, queries.meals),
        runTrinoQuery(trino, queries.activities),
        runTrinoQuery(trino, queries.feedback),
      ]);

    // ==========================================
    // 🚀 メモリ上でのデータマージ（高速処理）
    // ==========================================

    // ✅ Work データのマージ
    if (workResult.status === "fulfilled") {
      workResult.value.forEach((row: any[]) => {
        const dStr = String(row[0]).split("T")[0].split(" ")[0];
        if (responseMap.has(dStr)) {
          responseMap.get(dStr).work = {
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
        }
      });
    } else {
      console.error("Work bulk query failed:", workResult.reason);
    }

    // ✅ Meals データのマージ
    if (mealsResult.status === "fulfilled") {
      const splitItems = (str: string) => (str ? str.split("||") : []);
      mealsResult.value.forEach((row: any[]) => {
        const dStr = String(row[0]).split("T")[0].split(" ")[0];
        if (responseMap.has(dStr)) {
          responseMap.get(dStr).meals = {
            meals: {
              breakfast: {
                items: splitItems(row[1]),
                calories: Number(row[2]),
              },
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
        }
      });
    } else {
      console.error("Meals bulk query failed:", mealsResult.reason);
    }

    // ✅ Activities データのマージ
    if (activitiesResult.status === "fulfilled") {
      activitiesResult.value.forEach((row: any[]) => {
        const dStr = String(row[0]).split("T")[0].split(" ")[0];
        if (responseMap.has(dStr)) {
          const start = new Date(row[1].replace(" ", "T"));
          const end = new Date(row[2].replace(" ", "T"));

          const startHour = start.getHours() + start.getMinutes() / 60;
          let endHour = end.getHours() + end.getMinutes() / 60;

          if (
            endHour === 0 &&
            (end.getDate() !== start.getDate() ||
              end.getMonth() !== start.getMonth())
          ) {
            endHour = 24;
          }

          responseMap.get(dStr).activities.push({
            type: row[3], // cat_main
            startHour,
            endHour,
            cat_main: row[3],
            cat_sub: row[4],
            overlapSec: Number(row[5] || 0),
          });
        }
      });
    } else {
      console.error("Activities bulk query failed:", activitiesResult.reason);
    }

    // ✅ Feedback データのマージ
    if (feedbackResult.status === "fulfilled") {
      feedbackResult.value.forEach((row: any[]) => {
        const dStr = String(row[0]).split("T")[0].split(" ")[0];
        if (!responseMap.has(dStr)) return;
        const [, slot, generatedAt, messagesJson, model] = row;
        try {
          responseMap.get(dStr).feedback[String(slot)] = {
            generatedAt: String(generatedAt),
            messages: JSON.parse(String(messagesJson)),
            model: String(model),
          };
        } catch {}
      });
    } else {
      console.error("Feedback bulk query failed:", feedbackResult.reason);
    }

    // 🚀 辞書を配列に変換してソート
    const finalData = Array.from(responseMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    return NextResponse.json(finalData);
  } catch (error: any) {
    console.error("Bulk API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
