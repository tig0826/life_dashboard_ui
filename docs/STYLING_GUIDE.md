# Styling & UI Guide (Cyberpunk Design)

本プロジェクトは、**Next.js 16 + Tailwind CSS 4 + OKLCH** を活用した独自のサイバーパンク・デザインシステムを採用しています。

---

## 🎨 1. OKLCH カラーシステム

本プロジェクトでは、従来の `rgb` や `hsl` ではなく、人間の知覚に忠実な **OKLCH** を全面的に使用しています。

- **L (Lightness)**: 明度 (0% - 100%)
- **C (Chroma)**: 彩度 (0 - 0.4程度)
- **H (Hue)**: 色相 (0 - 360)

### プロジェクトの主要カラー
これらは `app/globals.css` で変数として定義されています。

| 用途 | 変数名 | 色のイメージ |
| :--- | :--- | :--- |
| **Cyan (メイン)** | `--neon-cyan` | 水色のネオン (ActivityLog, Header) |
| **Green** | `--neon-green` | 緑のネオン (AI Feedback, OKステータス) |
| **Yellow** | `--neon-yellow` | 黄色のネオン (体重, 警告) |
| **Red** | `--neon-red` | 赤のネオン (消費カロリー, エラー) |

---

## ✨ 2. ネオン・エフェクト（光らせ方）

新しいコンポーネントを「サイバーパンク」にするための3つのテクニックです。

### 1. ネオン・ボーダー (枠線を光らせる)
枠線自体が発光しているような効果を与えます。
- `.neon-border-cyan`
- `.neon-border-green`

### 2. ネオン・テキスト (文字を光らせる)
文字の背後に「ボワッ」とした光を入れます。
- `.glow-text-cyan`

### 3. グラスモルフィズム (透け感)
背景を少し透かして、奥行きを出します。
- `.glass-panel`

---

## 📦 3. shadcn/ui のカスタマイズ

`components/ui/` にある標準コンポーネントも、このデザインに合わせて自動的に調整されています。

### Button コンポーネントの例
```tsx
import { Button } from "@/components/ui/button"

// 標準のボタンもネオンカラーが適用されます
<Button variant="default">Click Me</Button>
```

---

## 📏 4. レスポンス対応

`hooks/use-mobile.ts` を使うことで、モバイル端末（幅 768px 未満）かどうかを簡単に判定できます。

```tsx
import { useIsMobile } from "@/hooks/use-mobile"

export function MyComponent() {
  const isMobile = useIsMobile()
  return (
    <div className={isMobile ? "p-2" : "p-4"}>
      {isMobile ? "Mobile View" : "Desktop View"}
    </div>
  )
}
```

---

## 🛠 5. 独自のスタイルを追加したい場合

`app/globals.css` の `@layer utilities` セクションに新しいクラスを追加してください。

```css
@layer utilities {
  .my-custom-glow {
    box-shadow: 0 0 10px oklch(0.7 0.2 300 / 0.5); /* 紫色に光らせる例 */
  }
}
```
