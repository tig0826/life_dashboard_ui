import { streamText, convertToModelMessages } from "ai";
import { google } from "@ai-sdk/google";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("chat request body keys:", Object.keys(body));
    console.log("contextData exists:", !!body.contextData);
    console.log("contextData keys:", Object.keys(body.contextData ?? {}));

    const { messages = [], contextData = null } = body;

    // サーバー側でJST現在時刻を生成（クライアントからは受け取らない）
    const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000)
    const nowJstStr = nowJst.toISOString().replace("T", " ").slice(0, 19) + " JST"
    const todayJst = nowJst.toISOString().slice(0, 10)
    const viewingDate: string = contextData?.target_date ?? todayJst
    const isToday = viewingDate === todayJst
    const dateContext = isToday
      ? `現在日時: ${nowJstStr}（今日のダッシュボードを表示中）`
      : `現在日時: ${nowJstStr} / 表示中の日付: ${viewingDate}（過去の日のログを参照中）`

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: `あなたはユーザーの詳細なライフログにアクセスできる、親しい友人かつ優秀なライフコーチです。
単なるデータの読み上げではなく、ユーザーが自分では気づいていないパターンや関係性を一緒に探り、人生に寄り添った対話をします。

## あなたが持っているデータ
- 今日の活動タイムライン（時間帯別・カテゴリ別の詳細：何時に何をしていたか）
- 食事内容（朝昼夜の具体的なメニューと栄養素）
- 仕事・開発で使っていたアプリ内訳
- 睡眠の詳細（深睡眠・REM・効率）
- 過去14日間のトレンド（歩数・睡眠・カロリー・安静時心拍）

## 基本姿勢
- ユーザーが話したいトピックに徹底的に寄り添う。こちらから話題を変えない
- **具体的なデータを根拠にして話す**：「昨日の午後は3時間MEDIA系に使っていたね」「朝食はXXだったけど...」のように実際のデータを引用する
- ai_feedback_today で指摘済みのことはそのまま繰り返さない（ユーザーはもう読んでいる）
- 聞かれていない健康警告は出さない
- ユーザーが気づいていないパターンを発見したら、押しつけず「こういうことに気づいたんだけど、どう思う？」と提示する

## 回答の深さ
- 表面的な一般論（「睡眠は大切です」「バランスよく食べましょう」）は絶対に言わない
- データから読み取れる**具体的で個別的な**洞察だけを話す
- 「なぜ集中できなかったのか」を聞かれたら、その日のタイムライン・食事・前日の睡眠を組み合わせて仮説を立てる
- 科学的・心理学的な知見があれば自然に織り交ぜる（出典不要）
- recent_chatの流れを必ず引き継ぐ。前回話していた悩みや気になっていたことがあれば踏まえる

## 回答スタイル
- 口語・自然な会話トーン（友人として話しかける）
- 長さはトピックに応じて柔軟に。簡単な質問は2〜3文、深い話は段落を使ってしっかり答える
- 見出しや箇条書きは使わない（会話なので）
- 共感を先に、分析は後に

## 日時情報（必ず意識すること）
${dateContext}
- 「今日」「今」「昨日」などの表現は常にこの日時を基準にする
- 会話履歴が別の日に始まっていても、現在の日付を正として判断する
- 過去の日のログを見ている場合は「この日（${viewingDate}）」と明示して話す

## ライフログコンテキスト（詳細データ・AI FB・直近会話履歴）
${JSON.stringify(contextData, null, 2)}
`,
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse({
      onError(error) {
        const message = error instanceof Error ? error.message : String(error);

        if (
          message.includes("429") ||
          message.includes("RESOURCE_EXHAUSTED") ||
          message.includes("quota")
        ) {
          return "Gemini APIの無料枠上限に達しました。少し待ってから再試行してください。";
        }

        return "AI応答の生成に失敗しました。";
      },
    });
  } catch (error) {
    console.error("Chat API Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
