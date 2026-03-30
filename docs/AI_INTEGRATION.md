# AI Integration Guide (Gemini API)

本プロジェクトの AI チャット機能を Google Gemini API と連携させるための手順を解説します。

---

## 🏗️ 1. 推奨される構成

API キーを安全に管理するため、**Server Actions** (Next.js のサーバーサイド処理) を使用します。

### データの流れ
1.  **Frontend (`AiChatInput`)**: ユーザーが質問を入力して送信。
2.  **Server Action (`app/actions/ai.ts`)**: API キーを使用して Gemini API を呼び出す。
3.  **Frontend (`app/page.tsx`)**: AI からの回答を受け取り、画面を更新。

---

## 🛠️ 2. 具体的な実装手順

### ステップ1: Gemini API キーの取得
[Google AI Studio](https://aistudio.google.com/) から API キーを取得してください。

### ステップ2: API キーの設定
プロジェクトのルートに `.env.local` を作成し、取得したキーを保存します。

```env
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

### ステップ3: ライブラリのインストール
```bash
pnpm add @google/generative-ai
```

### ステップ4: Server Action の作成 (`app/actions/ai.ts`)
サーバーサイドで動作する関数を作成します。

```typescript
// app/actions/ai.ts
'use server'

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

export async function askGemini(prompt: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  // ダッシュボードのコンテキスト（KPIデータなど）をプロンプトに含めると精度が上がります
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}
```

### ステップ5: データの繋ぎ込み (`app/page.tsx`)
`handleAiQuestion` 関数で Server Action を呼び出すように修正します。

```typescript
// app/page.tsx (修正イメージ)
import { askGemini } from "./actions/ai";

// ...

const handleAiQuestion = async (message: string) => {
  setAiResponse(`Geminiが考え中...`);
  
  try {
    const response = await askGemini(message); // Server Actionの呼び出し
    setAiResponse(response);
  } catch (error) {
    setAiResponse("エラーが発生しました。APIキーの設定を確認してください。");
  }
}
```

---

## 💡 3. AIの精度を高めるコツ (Prompt Engineering)

ただ質問を投げるのではなく、**「あなたは健康管理のアドバイザーです。以下のKPIデータを元に回答してください」**といったシステムプロンプトを `askGemini` 関数の中で追加すると、よりダッシュボードらしい回答が得られます。

例：
```typescript
const systemPrompt = "あなたはライフログ分析のプロです。";
const fullPrompt = `${systemPrompt}\n\nユーザーの質問: ${prompt}`;
```
