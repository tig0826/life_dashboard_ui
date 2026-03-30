# Trino Data Connection Guide

本プロジェクトで Trino (Iceberg) から実データを取得するための実装手順を解説します。

---

## 🧩 1. なぜ Trino + Iceberg なのか？

本プロジェクトで Trino を採用する理由は、**「大量のライフログ（位置情報、心拍数、PC操作ログなど）を柔軟に集計するため」**です。

### Trino のメリット (OLAP)
- **圧倒的な集計速度**: 数百万行のログから「先月の平均睡眠時間」などを一瞬で計算できます。
- **Iceberg との相性**: データが S3 などの安価なストレージにあっても、SQL で高速に操作できます。

### システム利用時の注意点 (VS 一般的なDB)
一般的なアプリで使われる PostgreSQL などの DB とは特性が異なります。

| 特徴 | 一般的なDB (PostgreSQL等) | Trino |
| :--- | :--- | :--- |
| **主な用途** | データの保存・更新 (OLTP) | データの分析・集計 (OLAP) |
| **レスポンス** | 数ミリ秒 (超高速) | 数百ミリ秒〜数秒 (集計は早いが開始が遅い) |
| **得意なこと** | 1行のデータを書き換える | 1億行のデータを合計する |

**結論：** 本ダッシュボードは「自分専用」であり、複雑な集計を伴うため **Trino 直結構成** を採用していますが、もし数千人が使うサービスにする場合は、集計結果を PostgreSQL 等にキャッシュする構成を検討します。

## 🏗️ 2. 推奨される構成

Next.js 16 では、セキュリティとパフォーマンスの観点から **「サーバーサイドで Trino に接続し、データを取得する」** のが一般的です。

### 接続の全体図
1.  **Server side (`lib/trino.ts`)**: Trino クライアントの設定とクエリ実行関数。
2.  **API Route / Server Action**: フロントエンドからのリクエストを受け取り、Trino にクエリを投げる。
3.  **Frontend (`app/page.tsx`)**: `useEffect` や `SWR/TanStack Query` を使ってデータを取得し、表示を更新する。

---

## 🛠️ 2. 具体的な実装手順

### ステップ1: ライブラリのインストール
ターミナルで以下を実行します。
```bash
pnpm add trino-client
```

### ステップ2: 接続ユーティリティの作成 (`lib/trino.ts`)
環境変数（`.env`）から接続情報を読み込み、Trino クライアントを初期化します。

```typescript
// lib/trino.ts
import { Trino } from 'trino-client';

const trino = Trino.create({
  server: process.env.TRINO_SERVER_URL || 'http://localhost:8080',
  user: 'dashboard-user',
});

export async function fetchKpiData() {
  const iter = await trino.query('SELECT label, value, unit FROM iceberg.default.kpi_table');
  const rows = [];
  for await (const queryResult of iter) {
    if (queryResult.data) {
      rows.push(...queryResult.data);
    }
  }
  return rows;
}
```

### ステップ3: データの繋ぎ込み (app/page.tsx)
現在の `app/page.tsx` は `"use client"`（クライアントコンポーネント）であるため、API経由でデータを取得するように書き換えます。

```typescript
// app/page.tsx (修正イメージ)
"use client"

import { useEffect, useState } from "react"

export default function LifeDashboard() {
  const [kpis, setKpis] = useState([]);

  useEffect(() => {
    // API経由でTrinoのデータを取得
    fetch('/api/kpi')
      .then(res => res.json())
      .then(data => setKpis(data));
  }, []);

  // ... あとは取得した kpis をコンポーネントに渡すだけ
}
```

---

## 🔑 3. 環境変数の設定
プロジェクトのルートに `.env.local` ファイルを作成し、接続情報を記述します。

```env
TRINO_SERVER_URL=http://your-trino-server:8080
TRINO_CATALOG=iceberg
TRINO_SCHEMA=default
```

---

## ⚠️ 初心者へのアドバイス
- **SQLの確認**: いきなりコードを書く前に、DBeaver などのツールで Trino に SQL を投げて、期待通りのデータが返ってくるか確認してください。
- **データ型の一致**: Trino から返ってくるデータの形（型）を、`app/page.tsx` で定義されている `kpiData` の形式に変換（マッピング）する必要があります。
