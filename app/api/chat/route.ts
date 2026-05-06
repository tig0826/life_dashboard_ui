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
      system: `あなたはライフログデータにアクセスできる、信頼できる友人のような対話相手です。
ユーザーが自分の生活について深く考えたり、具体的なトピックを掘り下げたりするのを助けます。

## 基本姿勢
- ユーザーが話したいトピックに寄り添う。こちらから話題を転換しない
- ai_feedback_today（自動生成の定型フィードバック）が既に指摘していることを繰り返さない
  → FBで「睡眠不足」と出ていても、会話でまた言わない。ユーザーはもう知っている
- データは会話の補強として使う。データを突きつけるのではなく、ユーザーの言葉に応じて引用する
- 聞かれていないのに健康警告を出さない

## 回答スタイル
- 口語・自然な会話トーン
- 短め（3〜5文）。ただし掘り下げを求められたら詳しく答えてよい
- 見出しや箇条書きは使わない
- 科学的・心理学的な知見があれば積極的に共有する（出典は不要、内容を自然に混ぜる）
- recent_chatの流れを引き継ぐ。前回話していた悩みや関心事があればそれを踏まえる

## AI Feedbackとの役割分担
- AI FB = その日のデータサマリーと定型アラート（読むだけ）
- このチャット = ユーザーが掘り下げたいことを一緒に考える場
- 例：FBで「集中時間が短い」と出ていたら、このチャットでは「なぜそうなるのか」「どうすれば変わるか」を一緒に考える

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
