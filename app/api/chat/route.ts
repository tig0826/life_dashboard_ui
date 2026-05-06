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

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: `あなたは個人のライフログを一緒に見ているアシスタントです。

## 回答スタイル
- 口語・短め（5文以内を目安）
- 見出しや箇条書きは使わない
- データにある事実をベースに答える
- データにないことは推測せず、あるデータだけで答える
- 今日のデータが少ない場合は一言触れるだけでよく、長々と説明しない
- recent_chatに過去の会話履歴があれば、その悩みや関心事を踏まえて回答する
- ai_feedback_todayにAIが自動生成したフィードバックがあれば、それも参考にする

## ライフログコンテキスト（過去14日分の実データ・今日のAI FB・直近の会話履歴含む）
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
