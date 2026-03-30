# Frontend Code Guide

フロントエンド開発の初心者向けに、本プロジェクトのコード構造と「どこを書き換えれば何が変わるか」を解説します。

---

## ⚡ 1. 開発の基本：司令塔は `app/page.tsx`

このプロジェクトのメイン画面は `app/page.tsx` です。
初心者のうちは、**「データは page.tsx で管理し、表示は components/ で行う」**というルールだけ覚えておけば大丈夫です。

### データの流れ
1.  `app/page.tsx` でデータ（変数）を定義する。
2.  各コンポーネントにそのデータを「Props（プロップス）」として渡す。
3.  コンポーネント側で受け取ったデータを表示する。

---

## 🛠 2. よくある修正シナリオ

### A. KPI（数値パネル）を追加・変更したい
`app/page.tsx` の 40行目付近にある `kpiData` 配列を編集します。

```typescript
// app/page.tsx
const kpiData = [
  { 
    label: "睡眠スコア", 
    value: 72, 
    unit: "pt", 
    source: "Fitbit", 
    trend: "up",      // 'up' | 'down' | undefined
    trendValue: "+5", 
    color: "cyan"     // "cyan" | "green" | "yellow" | "orange" | "red" | "pink"
  },
  // ここに新しいオブジェクトを追加するだけでパネルが増えます
]
```

### B. アクティビティ（タイムライン）の種類を増やしたい
1.  `app/page.tsx` の `sampleActivities` にデータを追加します。
2.  `components/dashboard/activity-timeline.tsx` の `typeColorMap` に新しい色の定義を追加します。

### C. レイアウト（幅や高さ）を変えたい
`app/page.tsx` の `return` 文の中にある `div` の `className` を修正します。

- **左カラムの幅**: `w-[30%]` を変更（例: `w-[40%]`）
- **右カラムの幅**: `w-[70%]` を変更（例: `w-[60%]`）
- **各パネルの高さ**: `h-[32%]` や `maxHeight: '42%'` などの数値を調整。

---

## 🎨 3. スタイルのルール (Tailwind CSS 4)

見た目を整えるときは、以下の「魔法のクラス」を組み合わせて使います。

### 独自のサイバーパンク・クラス
`app/globals.css` で定義されています。HTMLの `className` に入れるだけで適用されます。

| クラス名 | 効果 |
| :--- | :--- |
| `cyber-card` | 基本のカードデザイン（青系の発光） |
| `cyber-card-green` | 緑系の発光カード（AIフィードバック用） |
| `neon-border-cyan` | 水色のネオン枠 |
| `glow-text-cyan` | 文字を水色に光らせる |

### OKLCHカラーの直接指定
Tailwindの標準色（`text-blue-500`等）の代わりに、より鮮やかな色を直接指定できます。
- `text-[oklch(0.75_0.15_195)]` （鮮やかなシアン）
- `bg-[oklch(0.7_0.2_145)]` （鮮やかなグリーン）

---

## 📂 4. フォルダの使い分け

迷ったら以下の基準でファイルを配置・探してください。

- **`components/ui/`**: 
  - ボタン (`button.tsx`)、入力欄 (`input.tsx`) など。
  - プロジェクトをまたいで使える「汎用パーツ」。直接書き換えることは少ないです。
- **`components/dashboard/`**:
  - `kpi-board.tsx`, `activity-timeline.tsx` など。
  - このアプリ専用の「中規模なパーツ」。デザインや表示項目を変えたいときはここを編集します。
- **`app/`**:
  - `page.tsx`, `layout.tsx` など。
  - 「画面そのもの」。データ取得や全体の配置を決めます。

---

## 🧪 5. 動作確認の方法

コードを書き換えたら、ターミナルで `pnpm dev` が動いていることを確認し、ブラウザをリロードしてください。

エラーが出た場合は：
1.  **赤文字のメッセージを読む**: 括弧の閉じ忘れやタイポ（打ち間違い）が多いです。
2.  **TypeScriptの型を確認**: `kpiData` に存在しないプロパティ（例: `hoge: 123`）を入れるとエラーになります。定義されている型に合わせて入力してください。
