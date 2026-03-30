# Architecture & Design Documentation

本プロジェクトのシステム設計と、開発における重要な意思決定、および将来的な展望について解説します。

## 🏛️ システム構造

### 1. フロントエンド構成 (Next.js 16 + React 19)
- **App Router**: ディレクトリベースのルーティングを使用し、サーバー/クライアントコンポーネントを使い分けています。
- **React 19 Hooks**: `useState` による状態管理と、今後 `use` やサーバーアクションを統合するための最新スタックを採用しています。
- **Tailwind CSS 4**: 設定ファイル（`tailwind.config.js`）を排し、CSS内での `@theme` 定義による高速で拡張性の高いスタイリングを実現しています。

### 2. コンポーネント設計
コンポーネントは以下の3層に分離されています。

| 層 (Layer) | 場所 | 役割 |
| :--- | :--- | :--- |
| **Atomic/UI** | `components/ui/` | shadcn/uiベースのステートレスな最小単位 (Button, Badge, Card等)。 |
| **Domain/Dashboard** | `components/dashboard/` | ダッシュボード固有のビジネスロジックを含む部品 (KpiBoard, ActivityTimeline等)。 |
| **Page/Layout** | `app/` | ページ全体の組み立てとデータのオーケストレーション。 |

## 📐 レイアウト設計 (Grid & Layout)

ダッシュボードは **固定比率の2カラム構成** を採用し、画面内に情報を凝縮しています。

- **Header (固定)**: タイトル、日付、日付選択。
- **Main Content (Flex 1, Overflow Hidden)**:
  - **Left Column (30%)**: 
    - AI Summary & KPI (42%)
    - AI Feedback (26%)
    - AI Chat Input & Response (残りの領域)
  - **Right Column (70%)**:
    - Daily Activity Log (32%)
    - Detail Panel (残りの領域)
- **Footer (Status Bar)**: 各種データソースとの接続状況を表示。

## 🎨 デザインシステム (Cyberpunk Visuals)

### OKLCH カラースペース
従来の RGB/HSL ではなく、**OKLCH** を全面的に採用しています。これにより、人間の知覚に忠実な明度・彩度の調整が可能になり、鮮明なネオンカラー（Cyan, Green, Yellow, Orange, Red）を実現しています。

- **Neon Effects**: `app/globals.css` の `@layer utilities` に、`oklch` と `box-shadow` を組み合わせた発光エフェクト（`.glow-cyan`, `.neon-border-cyan`）を定義しています。
- **Glassmorphism**: `.glass-panel` クラスにより、`backdrop-filter: blur` を活用した奥行きのある質感を演出しています。

## 🔄 データフローとAI連携

### データの流れ
1. **Source Layer (Future)**: Trino (Query Engine) / Iceberg (Table Format) を経由したライフログ・データ。
2. **Analysis Layer (AI)**: 取得したデータをLLM（Gemini等）に渡し、要約と改善提案（Feedback）を生成。
3. **Display Layer**: 生成されたKPIとフィードバックをコンポーネントで表示。

### AI Chat 機能
- `AiChatInput` からユーザーの問いかけを受け取り、`app/page.tsx` の `handleAiQuestion` で処理。
- 現在はシミュレーション応答ですが、将来的にはAPI経由で動的なログ解析結果を返します。

## 📈 今後のロードマップ
1. **Data Integration**: モックデータを実データ（Fitbit API, ActivityWatch SQLite等）に差し替え。
2. **Advanced Analytics**: Recharts を用いた詳細なトレンド分析グラフの実装。
3. **PWA Support**: スマートフォンでの閲覧・入力に対応するためのモバイル最適化。
