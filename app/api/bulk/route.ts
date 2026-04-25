import { NextResponse } from "next/server";
import { format, subDays, eachDayOfInterval, parseISO } from "date-fns";

// ※君の環境のTrinoクライアントをインポートする想定
// import { executeTrinoQuery } from "@/lib/trino"

export async function GET(request: Request) {
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

    // 🚀 1. 返却する配列の「ベース（空箱）」を作成する
    // データがない日も欠落せず、空配列や null として返すためのプロの設計
    const dateInterval = eachDayOfInterval({ start: startDate, end: endDate });
    const responseMap = new Map<string, any>();

    dateInterval.forEach((date) => {
      const dStr = format(date, "yyyy-MM-dd");
      responseMap.set(dStr, {
        date: dStr,
        activities: [],
        meals: null,
        work: null,
      });
    });

    // 🚀 2. Trinoへ並列で範囲クエリを投げる（JOINは使わない）
    // ※以下はイメージだ。君のスキーマに合わせてテーブル名やカラム名を調整してくれ
    const queries = {
      activities: `
        SELECT date, type, start_hour, end_hour 
        FROM iceberg.default.activities 
        WHERE date BETWEEN '${startDateStr}' AND '${endDateStr}'
      `,
      meals: `
        SELECT date, nutrition_data 
        FROM iceberg.default.meals 
        WHERE date BETWEEN '${startDateStr}' AND '${endDateStr}'
      `,
      work: `
        SELECT date, focus_rate, session_time 
        FROM iceberg.default.work_logs 
        WHERE date BETWEEN '${startDateStr}' AND '${endDateStr}'
      `,
    };

    // 3つのクエリを同時に走らせる（Icebergのパーティション検索が効くので爆速だ）
    // ※ executeTrinoQuery は君の実装に置き換えてくれ
    const [activitiesRes, mealsRes, workRes] = await Promise.all([
      executeTrinoQuery(queries.activities),
      executeTrinoQuery(queries.meals),
      executeTrinoQuery(queries.work),
    ]);

    // 🚀 3. Next.jsのメモリ上でデータを「日付ごと」に振り分ける

    // Activities（1日に複数行ある前提）
    activitiesRes.forEach((row: any) => {
      if (responseMap.has(row.date)) {
        responseMap.get(row.date).activities.push({
          type: row.type,
          startHour: row.start_hour,
          endHour: row.end_hour,
        });
      }
    });

    // Meals（1日1行の前提）
    mealsRes.forEach((row: any) => {
      if (responseMap.has(row.date)) {
        // nutrition_data がJSON文字列なら parse する
        const parsedNutrition =
          typeof row.nutrition_data === "string"
            ? JSON.parse(row.nutrition_data)
            : row.nutrition_data;

        responseMap.get(row.date).meals = { nutrition: parsedNutrition };
      }
    });

    // Work（1日1行の前提）
    workRes.forEach((row: any) => {
      if (responseMap.has(row.date)) {
        responseMap.get(row.date).work = {
          focusRate: row.focus_rate,
          sessionTime: row.session_time,
        };
      }
    });

    // 🚀 4. Mapを配列に変換し、日付の古い順（または新しい順）にソートして返す
    const finalData = Array.from(responseMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    return NextResponse.json(finalData);
  } catch (error) {
    console.error("Bulk API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

// --- ※モック用ダミー関数（実際のTrino接続処理に置き換えること） ---
async function executeTrinoQuery(sql: string): Promise<any[]> {
  console.log("Executing in Trino:", sql);
  // 本来はここで fetch なり Trinoクライアント なりを呼ぶ
  return [];
}
