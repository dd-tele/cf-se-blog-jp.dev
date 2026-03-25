import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { getSessionUser } from "~/lib/auth.server";

export const meta: MetaFunction = () => [
  { title: "Change Log — Cloudflare Solution Blog" },
  {
    name: "description",
    content:
      "Cloudflare Solution Blog の基礎設計から現在に至るまでの実装・変更履歴。",
  },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await getSessionUser(request);
  return {
    siteName: context.cloudflare.env.SITE_NAME ?? "Cloudflare Solution Blog",
    user,
  };
}

interface ChangeEntry {
  date: string;
  version?: string;
  title: string;
  items: string[];
  tag: "foundation" | "feature" | "improvement" | "security" | "fix";
}

const TAG_STYLES: Record<string, string> = {
  foundation: "bg-purple-100 text-purple-700",
  feature: "bg-blue-100 text-blue-700",
  improvement: "bg-emerald-100 text-emerald-700",
  security: "bg-red-100 text-red-700",
  fix: "bg-amber-100 text-amber-700",
};
const TAG_LABELS: Record<string, string> = {
  foundation: "基礎設計",
  feature: "新機能",
  improvement: "改善",
  security: "セキュリティ",
  fix: "修正",
};

const CHANGES: ChangeEntry[] = [
  {
    date: "2025-03-25",
    title: "Markdown インポート & 免責事項",
    items: [
      "Markdown インポート機能を追加 — YAML Frontmatter からタイトル・タグ・カテゴリを自動抽出",
      "公開時に外部画像を自動で R2 に取り込み、URL を置換する仕組みを実装",
      "デフォルト Frontmatter テンプレートをインポートモーダルに設定",
      "ホームページに免責事項（概要版）を追加",
      "各記事ページ末尾に免責事項ボックスを追加",
      "「このブログについて」ページに Markdown インポート・免責事項ポリシーのセクションを追加",
      "プレゼンテーションに Markdown インポート & 免責事項スライドを追加",
      "Change Log ページを新規作成",
    ],
    tag: "feature",
  },
  {
    date: "2025-03-24",
    title: "AI Gateway 統合",
    items: [
      "Workers AI 呼び出しを AI Gateway 経由にルーティング",
      "ガードレール・ログ・レート制限・キャッシュを一元管理",
      "gatewayOptions() ヘルパーで未設定時のフォールバック対応",
      "プレゼンテーション・About ページに AI Gateway セクションを追加",
    ],
    tag: "security",
  },
  {
    date: "2025-03-23",
    title: "Turnstile Bot 保護",
    items: [
      "チャット Q&A に Turnstile invisible モードを統合",
      "サーバー側 siteverify API でトークン検証",
      "Fail-open 設計 — API エラー時はスキップして可用性優先",
    ],
    tag: "security",
  },
  {
    date: "2025-03-22",
    title: "API Shield 導入",
    items: [
      "OpenAPI 3.0 スキーマで全 16 エンドポイントを定義",
      "Cloudflare API Shield に登録し Schema Validation を有効化",
      "Bearer / Cookie / CF Access JWT の 3 種の securitySchemes を定義",
    ],
    tag: "security",
  },
  {
    date: "2025-03-21",
    title: "Personal API Keys & Template API",
    items: [
      "Bearer トークン (cfbk_*) による API 認証を追加",
      "SHA-256 ハッシュ保存、ユーザーあたり最大 5 キー",
      "セッション Cookie とのデュアル認証ミドルウェア",
      "GET /api/v1/ai-guide、POST /api/v1/templates/:id/test-generate 等のエンドポイントを公開",
      "Template API ドキュメントページを作成",
    ],
    tag: "feature",
  },
  {
    date: "2025-03-20",
    title: "JSON インポート — 外部 AI 連携",
    items: [
      "テンプレートフォームのフィールド定義を JSON でコピー可能に",
      "Gemini / ChatGPT / Claude で生成した JSON データをインポート",
      "フォーム自動入力 → Workers AI で記事生成のワークフローを実現",
    ],
    tag: "feature",
  },
  {
    date: "2025-03-19",
    title: "AI アシスト修正機能",
    items: [
      "追加エッセンス入力 → AI が本文に自然に組み込む機能を実装",
      "HTML プレビュー + Markdown ソースのタブ切替",
      "Mermaid 図の動的レンダリング & 構文エラー時のフォールバック",
      "max_tokens: 8192 で長文記事の途中切れを防止",
    ],
    tag: "feature",
  },
  {
    date: "2025-03-18",
    title: "投稿者申請 & Email 通知フロー",
    items: [
      "公開申請フォーム (/apply) を実装",
      "Email Routing API で宛先アドレス自動登録・検証",
      "専用 Email Worker (send_email binding) で承認通知メールを送信",
      "管理者承認時に Cloudflare Access ポリシーへメール自動追加",
      "ユーザー削除時の Access + Email Routing 自動クリーンアップ",
    ],
    tag: "feature",
  },
  {
    date: "2025-03-17",
    title: "ユーザープロフィール & アバター",
    items: [
      "nickname, furigana, company, job_role, expertise, profile_comment フィールドを追加",
      "Canvas ベースのアバタークロップモーダル（外部ライブラリ不使用）",
      "著者プロフィールページ (/authors/:id) を作成",
    ],
    tag: "feature",
  },
  {
    date: "2025-03-16",
    title: "AI チャット Q&A",
    items: [
      "記事ページにフローティングチャットウィジェットを設置",
      "Hono streamSSE でリアルタイムストリーミング応答",
      "RAG: 記事本文 + Vectorize 類似記事でコンテキスト構築",
      "Llama Guard 3 8B によるコンテンツモデレーション",
      "KV ベースレート制限 (10 msg/min)",
      "SE/Admin による手動回答対応",
    ],
    tag: "feature",
  },
  {
    date: "2025-03-15",
    title: "Hono API レイヤー移行",
    items: [
      "API ルートを Hono フレームワークに移行",
      "型安全なバインディング (c.env.*) による開発体験向上",
      "共通ミドルウェア（認証・CORS・ロガー）を統一",
      "Remix route shim パターンで統合",
    ],
    tag: "improvement",
  },
  {
    date: "2025-03-14",
    title: "Vectorize セマンティック検索",
    items: [
      "記事の埋め込みベクトルを Vectorize に保存",
      "bge-base-en-v1.5 モデルで embedding 生成",
      "類似度ベースの関連記事推薦を実装",
      "検索ページでセマンティック検索に対応",
    ],
    tag: "feature",
  },
  {
    date: "2025-03-13",
    title: "AI テンプレートドラフト生成",
    items: [
      "6 種類のテンプレート（Zero Trust / Workers / Performance / Security / Network / Tips）",
      "Llama 3.3 70B fp8-fast によるドラフト自動生成",
      "スタイルプリアンブル + テンプレート固有指示の 2 層プロンプト構成",
      "品質ガードレール（多言語混入禁止・重複禁止・Mermaid 図活用等）",
    ],
    tag: "feature",
  },
  {
    date: "2025-03-12",
    title: "Cloudflare Access JWT 再認証レジリエンス",
    items: [
      "OTP 再認証後の JWT 遅延問題を解消",
      "期限切れ・鍵不一致時の自動リトライ（最大 2 回）",
      "公開鍵キャッシュの forceRefresh オプション追加",
      "401 レスポンス + root ErrorBoundary でセッション切れ UI を実装",
    ],
    tag: "fix",
  },
  {
    date: "2025-03-11",
    title: "WAF 誤検知回避",
    items: [
      "コードスニペット含む記事投稿時の WAF ブロック問題を解消",
      "認証済みパス (/portal/*, /admin/*, /api/v1/*) で WAF Managed Rules をスキップ",
    ],
    tag: "fix",
  },
  {
    date: "2025-03-10",
    title: "基礎設計 — MVP",
    items: [
      "Remix v2 + Cloudflare Pages による SSR アプリケーション構築",
      "D1 (SQLite) + Drizzle ORM でデータモデル設計（users, posts, categories, templates 等）",
      "R2 による画像ストレージ",
      "KV によるセッション管理・ページキャッシュ",
      "Cloudflare Access による Zero Trust 認証（Google SSO）",
      "RBAC (admin / se / ae / user) によるアクセス制御",
      "RSS フィード・Sitemap 自動生成",
      "SEO 最適化（OGP / Twitter Card）",
      "Tailwind CSS + Typography プラグインによるスタイリング",
      "監査ログ (Audit Log) の基盤実装",
    ],
    tag: "foundation",
  },
];

export default function ChangeLogPage() {
  const { siteName, user } = useLoaderData<typeof loader>();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors">
            {siteName}
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/about" className="text-sm text-gray-500 hover:text-gray-700">
              ← このブログについて
            </Link>
            <Link to="/posts" className="text-sm text-gray-600 hover:text-gray-900">
              事例一覧
            </Link>
            {user && (
              <Link to="/portal" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                ダッシュボード
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b bg-gradient-to-br from-gray-900 via-gray-800 to-brand-900 py-16 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-400">
            Design & Implementation History
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Change Log
          </h1>
          <p className="mt-4 text-lg text-gray-300">
            基礎設計から現在に至るまでの実装・変更履歴
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 h-full w-0.5 bg-gray-200 sm:left-8" />

          <div className="space-y-8">
            {CHANGES.map((entry, i) => (
              <div key={i} className="relative pl-12 sm:pl-20">
                {/* Dot */}
                <div className="absolute left-[0.625rem] top-[0.375rem] h-3 w-3 rounded-full border-2 border-white bg-brand-500 shadow sm:left-[1.625rem]" />

                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <time className="text-xs font-medium text-gray-400">{entry.date}</time>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TAG_STYLES[entry.tag]}`}>
                      {TAG_LABELS[entry.tag]}
                    </span>
                  </div>
                  <h3 className="mb-3 text-base font-bold text-gray-900">{entry.title}</h3>
                  <ul className="space-y-1">
                    {entry.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-300" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-gray-900 py-10 text-gray-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Link to="/" className="text-sm font-medium text-gray-400 hover:text-gray-300 transition-colors">
              {siteName}
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/about" className="text-xs text-gray-500 hover:text-gray-400 transition-colors">
                このブログについて
              </Link>
              <span className="text-xs text-gray-600">
                Built on Cloudflare — Workers, Pages, D1, R2, AI
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
