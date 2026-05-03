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
      model: google("gemini-2.0-flash"),
      system: `
あなたはデータ分析AIです。

ルール:
- 必ず「比較」「原因」「改善案」を出せ
- 推測は "可能性" として表現する
- データが不足している場合は明示する
- 抽象論は禁止（例: 頑張りましょう）

コンテキスト:
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
