import { useState } from "react";

export function MarkdownGuide() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"markdown" | "mermaid">("markdown");

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition hover:bg-gray-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        {open ? "ガイドを閉じる" : "Markdown / 図表ガイド"}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Tabs */}
          <div className="flex border-b">
            <button
              type="button"
              onClick={() => setTab("markdown")}
              className={`px-4 py-2.5 text-xs font-semibold transition ${
                tab === "markdown"
                  ? "border-b-2 border-brand-500 text-brand-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Markdown 記法
            </button>
            <button
              type="button"
              onClick={() => setTab("mermaid")}
              className={`px-4 py-2.5 text-xs font-semibold transition ${
                tab === "mermaid"
                  ? "border-b-2 border-brand-500 text-brand-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Mermaid 図表
            </button>
          </div>

          <div className="max-h-[28rem] overflow-y-auto p-4 text-xs leading-relaxed text-gray-700">
            {tab === "markdown" ? <MarkdownTab /> : <MermaidTab />}
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────── Markdown Tab ────────────────────────────── */

function MarkdownTab() {
  return (
    <div className="space-y-5">
      {/* Headings */}
      <GuideSection title="見出し">
        <CodeBlock>{`# 見出し 1
## 見出し 2
### 見出し 3`}</CodeBlock>
      </GuideSection>

      {/* Text formatting */}
      <GuideSection title="テキスト装飾">
        <CodeBlock>{`**太字テキスト**
*斜体テキスト*
~~取り消し線~~
\`インラインコード\``}</CodeBlock>
      </GuideSection>

      {/* Lists */}
      <GuideSection title="リスト">
        <CodeBlock>{`- 箇条書き項目 1
- 箇条書き項目 2
  - ネスト項目

1. 番号付きリスト
2. 番号付きリスト`}</CodeBlock>
      </GuideSection>

      {/* Links & Images */}
      <GuideSection title="リンク & 画像">
        <CodeBlock>{`[リンクテキスト](https://example.com)

![代替テキスト](画像URL)
※「画像を挿入」ボタンで R2 にアップロード可`}</CodeBlock>
      </GuideSection>

      {/* Blockquote */}
      <GuideSection title="引用">
        <CodeBlock>{`> 引用テキスト
> 複数行も可能`}</CodeBlock>
      </GuideSection>

      {/* Code blocks */}
      <GuideSection title="コードブロック">
        <CodeBlock>{`\`\`\`javascript
const greeting = "Hello, Cloudflare!";
console.log(greeting);
\`\`\`

\`\`\`toml
# wrangler.toml の設定例
name = "my-worker"
compatibility_date = "2024-01-01"
\`\`\``}</CodeBlock>
        <p className="mt-1 text-gray-400">
          言語名を指定するとシンタックスハイライトされます
        </p>
      </GuideSection>

      {/* Tables */}
      <GuideSection title="テーブル">
        <CodeBlock>{`| サービス | 用途 | 備考 |
|---------|------|------|
| D1 | データベース | SQLite |
| R2 | ストレージ | S3 互換 |
| KV | キャッシュ | Key-Value |`}</CodeBlock>
      </GuideSection>

      {/* Horizontal rule */}
      <GuideSection title="水平線">
        <CodeBlock>{`---`}</CodeBlock>
      </GuideSection>

      {/* Tips */}
      <div className="rounded-lg bg-blue-50 p-3">
        <p className="font-semibold text-blue-700">Tips</p>
        <ul className="mt-1 space-y-1 text-blue-600">
          <li>- 空行でパラグラフを分けます</li>
          <li>- 見出しは <code className="rounded bg-blue-100 px-1">##</code> (H2) から始めると読みやすい</li>
          <li>- コードブロックには言語名を必ず指定しましょう</li>
          <li>- 本文欄の上にある <strong>「表を挿入」</strong> ボタンでテーブルのテンプレートを挿入できます</li>
          <li>- <strong>「コードを挿入」</strong> ボタンで言語を選んでコードブロックを挿入できます</li>
        </ul>
      </div>
    </div>
  );
}

/* ────────────────────────────── Mermaid Tab ────────────────────────────── */

function MermaidTab() {
  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-amber-50 p-3">
        <p className="font-semibold text-amber-700">Mermaid とは</p>
        <p className="mt-1 text-amber-600">
          テキストから図表を自動生成するツールです。記事内に{" "}
          <code className="rounded bg-amber-100 px-1">```mermaid</code>{" "}
          コードブロックを書くと、公開時に図として表示されます。
        </p>
      </div>

      {/* Flowchart */}
      <GuideSection title="フローチャート">
        <CodeBlock>{`\`\`\`mermaid
flowchart LR
    A[リクエスト] --> B{WAF}
    B -->|許可| C[Workers]
    B -->|ブロック| D[403 エラー]
    C --> E[(D1)]
    C --> F[R2]
\`\`\``}</CodeBlock>
        <p className="mt-1 text-gray-400">
          LR=左→右、TD=上→下、RL=右→左、BT=下→上
        </p>
      </GuideSection>

      {/* Sequence diagram */}
      <GuideSection title="シーケンス図">
        <CodeBlock>{`\`\`\`mermaid
sequenceDiagram
    participant U as ユーザー
    participant W as Workers
    participant AI as Workers AI
    participant DB as D1

    U->>W: POST /api/v1/chat
    W->>DB: 記事コンテキスト取得
    W->>AI: プロンプト送信
    AI-->>W: ストリーミング応答
    W-->>U: SSE レスポンス
\`\`\``}</CodeBlock>
      </GuideSection>

      {/* Architecture / C4 */}
      <GuideSection title="アーキテクチャ図（C4）">
        <CodeBlock>{`\`\`\`mermaid
C4Context
    title Cloudflare Blog Architecture

    Person(user, "閲覧ユーザー", "記事を閲覧")
    Person(engineer, "SE", "記事を投稿")

    System(blog, "Blog Platform", "Pages + Workers")

    System_Ext(ai, "Workers AI", "Llama 3.3")
    SystemDb(d1, "D1", "SQLite")
    SystemDb(r2, "R2", "画像")

    Rel(user, blog, "閲覧")
    Rel(engineer, blog, "投稿")
    Rel(blog, ai, "推論")
    Rel(blog, d1, "CRUD")
    Rel(blog, r2, "Upload")
\`\`\``}</CodeBlock>
      </GuideSection>

      {/* Network diagram */}
      <GuideSection title="ネットワーク構成図">
        <CodeBlock>{`\`\`\`mermaid
flowchart TD
    subgraph Internet
        Client[クライアント]
    end

    subgraph Cloudflare["Cloudflare Edge"]
        WAF[WAF / Bot Mgmt]
        Access[CF Access]
        Pages[Pages + Workers]
    end

    subgraph Backend["Cloudflare Services"]
        D1[(D1 Database)]
        R2[(R2 Storage)]
        AI[Workers AI]
        KV[KV Cache]
    end

    Client --> WAF
    WAF --> Access
    Access --> Pages
    Pages --> D1
    Pages --> R2
    Pages --> AI
    Pages --> KV
\`\`\``}</CodeBlock>
      </GuideSection>

      {/* Gantt */}
      <GuideSection title="ガントチャート（タイムライン）">
        <CodeBlock>{`\`\`\`mermaid
gantt
    title プロジェクトタイムライン
    dateFormat YYYY-MM-DD

    section Phase 1
    要件定義       :done, 2024-01-01, 14d
    基本設計       :done, 2024-01-15, 14d

    section Phase 2
    実装          :active, 2024-02-01, 30d
    テスト         :2024-03-01, 14d
\`\`\``}</CodeBlock>
      </GuideSection>

      {/* ER diagram */}
      <GuideSection title="ER 図">
        <CodeBlock>{`\`\`\`mermaid
erDiagram
    USERS ||--o{ POSTS : "author"
    POSTS }o--|| CATEGORIES : "belongs to"
    USERS ||--o{ AI_DRAFTS : "requests"
    TEMPLATES ||--o{ AI_DRAFTS : "uses"
\`\`\``}</CodeBlock>
      </GuideSection>

      {/* Pie chart */}
      <GuideSection title="円グラフ">
        <CodeBlock>{`\`\`\`mermaid
pie title トラフィック構成
    "API リクエスト" : 45
    "静的アセット" : 30
    "SSR ページ" : 25
\`\`\``}</CodeBlock>
      </GuideSection>

      <div className="rounded-lg bg-green-50 p-3">
        <p className="font-semibold text-green-700">Tips</p>
        <ul className="mt-1 space-y-1 text-green-600">
          <li>- 図は <code className="rounded bg-green-100 px-1">```mermaid</code> で囲みます</li>
          <li>- 日本語のラベルは <code className="rounded bg-green-100 px-1">["テキスト"]</code> で囲みます</li>
          <li>- <a href="https://mermaid.js.org/syntax/flowchart.html" target="_blank" rel="noopener noreferrer" className="underline">Mermaid 公式ドキュメント</a> で全構文を確認できます</li>
          <li>- <a href="https://mermaid.live/" target="_blank" rel="noopener noreferrer" className="underline">Mermaid Live Editor</a> でリアルタイムプレビューできます</li>
        </ul>
      </div>
    </div>
  );
}

/* ────────────────────────────── Shared ────────────────────────────── */

function GuideSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-bold text-gray-900">{title}</h4>
      {children}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-200">
      <code>{children}</code>
    </pre>
  );
}
