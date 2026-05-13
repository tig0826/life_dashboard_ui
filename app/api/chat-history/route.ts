import { NextResponse } from "next/server";
import { Trino } from "trino-client";

function trino() {
  return Trino.create({
    server: process.env.TRINO_SERVER_URL || "http://localhost:8080",
    catalog: process.env.TRINO_CATALOG || "iceberg",
    schema: "life_gold",
  });
}

async function runQuery(client: ReturnType<typeof Trino.create>, sql: string) {
  const iter = await client.query({ query: sql, user: "dashboard-api" });
  const rows: any[] = [];
  for await (const result of iter) {
    if (result.error) throw new Error(result.error.message);
    if (result.data) rows.push(...result.data);
  }
  return rows;
}

// 会話履歴は日付をまたいで継続する — 最新の1件を返す
export async function GET() {
  try {
    const rows = await runQuery(
      trino(),
      `SELECT messages_json FROM life_gold.chat_history ORDER BY updated_at DESC LIMIT 1`
    );
    if (rows.length === 0) return NextResponse.json({ messages: [] });
    return NextResponse.json({ messages: JSON.parse(rows[0][0]) });
  } catch (error: any) {
    console.error("Chat history GET error:", error);
    return NextResponse.json({ messages: [] });
  }
}

// 全履歴を上書き保存（最大100件に絞って肥大化防止）
export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    if (!messages) return NextResponse.json({ ok: false }, { status: 400 });

    const trimmed = messages.slice(-100);
    const client = trino();
    const now = new Date().toISOString().replace("T", " ").slice(0, 23);
    const today = new Date().toISOString().slice(0, 10);
    const escaped = JSON.stringify(trimmed).replace(/'/g, "''");

    await runQuery(client, `DELETE FROM life_gold.chat_history WHERE 1=1`);
    await runQuery(
      client,
      `INSERT INTO life_gold.chat_history VALUES (DATE '${today}', '${escaped}', TIMESTAMP '${now}')`
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Chat history POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
