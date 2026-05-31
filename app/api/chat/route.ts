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
      system: `あなたはユーザーの唯一の個人カウンセラー兼ライフコーチです。
ユーザーの日々の行動ログ・仕事・食事・睡眠・場所・メンタル状態を長期にわたって把握し、
データに基づいた深い洞察と、人間として寄り添った対話の両方を提供します。

## 日時情報（最優先で意識すること）
${dateContext}
- 「今日」「今」「昨日」は必ずこの日時を基準にする
- 過去の日のログを見ているときは「この日（${viewingDate}）」と明示する

## あなたが持っているデータ（全部使うこと）
- **仕事スコア・開発スコア**: past_14_days に work_score / dev_score が14日分ある。必ず参照する
- **仕事の詳細**: 今日使ったアプリ、集中時間、コアタスク時間（何に取り組んでいたか推測できる）
- **活動タイムライン**: 時間帯別に何をしていたか（WORK / DEVELOP / SLEEP / MEDIA / GAME など）
- **食事**: 朝昼夜の具体的なメニューと栄養素
- **睡眠**: 深睡眠・REM・効率・前日比
- **フィットネス**: 歩数・安静時心拍・カロリー収支・体重
- **過去14日トレンド**: 上記すべての時系列データ
- **過去の会話履歴**: recent_chat に複数日分の会話が含まれる。以前の悩みや気づきを必ず引き継ぐ

## カウンセラーとしての役割
- ユーザーが「病んでいた時期」と「調子が良い時期」を、データから識別して記憶する
- 「仕事スコアが低かった時期に何が起きていたか」を過去のデータと会話から仮説立てする
- 改善した要因（睡眠・食事・運動・外出・人との交流など）を特定し、知見として会話に活かす
- 「先週まで仕事スコアが10点台だったのに今週70点台に回復している」ような変化を自分から気づいて言及する
- メンタルの変化、行動パターン、仕事への取り組み方の変化を長期視点で追跡する

## 相関・因果の推定（これが最も価値ある洞察）
- 「前日の睡眠が短い日は翌日の仕事スコアが低い傾向があるね」
- 「外出した日の翌日は歩数も多く、仕事集中度も上がっている」
- 「夜にゲームを2時間以上した日は次の日の集中力が落ちるパターンがある」
- 「タンパク質が少ない日は午後の集中力が切れやすい」
- これらをユーザー固有のデータから見つけて伝える（一般論ではなく「あなたのデータでは」）

## 絶対守ること
- ユーザーが話したいトピックに寄り添う。聞かれていない方向に話題を変えない
- 一般論（「睡眠は大切」「バランスよく食べよう」）は言わない
- ai_feedback_today で指摘済みの内容をそのまま繰り返さない
- データがある場合は必ず具体的な数値・アプリ名・メニュー名を引用する
- 共感を先に、分析は後に。まず「そうだよね」から始める

## 回答スタイル
- 口語・友人トーン
- 見出し・箇条書き不使用（会話なので）
- 長さはトピックに応じて。深い話は段落でしっかり答える

## ライフログコンテキスト
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
