# Life Dashboard

個人向けのライフログ（睡眠、作業、食事、移動など）を可視化し、AIによるフィードバックを提供するモダンなサイバーパンク・ダッシュボードです。

## 🚀 技術スタック

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Library**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Data Source**: [Trino](https://trino.io/) / [Apache Iceberg](https://iceberg.apache.org/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI)
- **Visualization**: [Recharts](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Package Manager**: [pnpm](https://pnpm.io/)

## 🛠 セットアップ方法

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. 環境変数の設定

`.env` ファイルを作成し、Trino への接続情報を設定します。

```env
# Trino / Iceberg Connection
TRINO_SERVER_URL=http://localhost:8080
TRINO_CATALOG=iceberg
TRINO_SCHEMA=life_gold

# Gemini AI API
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

### 3. 開発サーバーの起動

```bash
pnpm dev
```

---

## 📊 データ連携アーキテクチャ

1.  **Data Pipeline**: `life_dashboard` プロジェクトがデータを収集・加工。
2.  **Gold Layer**: Trino上の `life_gold.mrt_behavior_slots_15m` テーブルに 15分刻みの集計済みデータを保持。
3.  **API Route**: `app/api/activities/route.ts` が Trino からデータを取得。
4.  **UI Component**: `ActivityTimeline` がデータを可視化。

---

## 📚 詳細ドキュメント (docs/)

プロジェクトの設計方針や、詳細なガイドラインは `docs/` ディレクトリに集約されています。AIレビューや開発時には、以下の各ドキュメントをまず参照してください。

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)**: 全体の設計思想とコンポーネント構成
- **[DATA_CONNECTION.md](docs/DATA_CONNECTION.md)**: Trino/Iceberg 連携とデータスキーマの詳細
- **[CODE_GUIDE.md](docs/CODE_GUIDE.md)**: コーディング規約、命名規則、プロジェクトの作法
- **[STYLING_GUIDE.md](docs/STYLING_GUIDE.md)**: Tailwind CSS 4 と OKLCH を使ったサイバーパンク・テーマの適用方法
- **[AI_INTEGRATION.md](docs/AI_INTEGRATION.md)**: Gemini API 等の AI モデルとの統合ガイド

---

## 💡 開発者・AIレビュワー向けの補足メモ

### 1. データ型とマッピング
API (`/api/activities`) は、Trino の `cat_main` をそのまま `type` として返します。
- **Trino 側の型**: `time_slot_jst` (Timestamp), `cat_main` (Varchar), `overlap_sec` (BigInt)
- **API レスポンス**:
  ```typescript
  {
    type: string;       // cat_main の値 (SLEEP, WORK, DEVELOP 等)
    startHour: number;  // 0.0 ~ 24.0 の浮動小数点
    endHour: number;    // 同上
    cat_main: string;
    cat_sub: string;
  }
  ```

### 2. カテゴリと色分けの定義
行動カテゴリの分類ロジックは、データパイプライン側の dbt モデル `dbt_lifeos/models/intermediate/int_aw_categorized.sql` で定義されています。
ダッシュボード上での色分けは `components/dashboard/activity-timeline.tsx` の `activityConfig` オブジェクトで管理しています。新しいカテゴリが追加された場合は、ここに色を定義してください。

### 3. Trino 接続の注意点
- 現在の `trino-client` 実装は、認証なしまたはユーザー名のみの接続を想定しています。
- 開発環境では Trino コーディネーターへのポートフォワードが必要です。
- `trino-client` (v0.2.9) は `Iterator<QueryResult>` を返します。`result.data` には「カラム順の配列」が入るため、SQLの `SELECT` 順序を変更する場合は API 側のインデックス指定も更新する必要があります。

### 4. タイムゾーン
- 全てのデータは **Asia/Tokyo (JST)** 基準です。
- Trino からは文字列として取得し、JS の `Date` オブジェクトでパースしています。
