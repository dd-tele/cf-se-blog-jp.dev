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
    date: "2026-03-25",
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
    date: "2026-03-20",
    title: "AI チャット ユーザー分離 & Access セッション改善",
    items: [
      "AI チャットをログインユーザー限定に変更、ユーザー別スレッド分離",
      "Access セッション切れ検知を Safari/Firefox にも対応（SyntaxError 等）",
      "グローバル fetch インターセプターで React 外の Access 失効を捕捉",
      "MutationObserver による白画面検知フォールバックを追加",
    ],
    tag: "improvement",
  },
  {
    date: "2026-03-18",
    title: "プレゼンテーション強化 & Hono 詳細スライド",
    items: [
      "モチベーション/背景スライドを page 1 に追加",
      "Hono API レイヤーの詳細スライド — 16 エンドポイント・Remix 統合",
      "ProblemCard にアコーディオン TIPS を追加",
    ],
    tag: "improvement",
  },
  {
    date: "2026-03-13",
    title: "エディタ改善 & テーブル挿入",
    items: [
      "テーブル・コードブロック挿入ツールバーを追加",
      "下書きエディタにキャンセルボタン（確認ダイアログ付き）を追加",
    ],
    tag: "improvement",
  },
  {
    date: "2026-03-12",
    title: "プロフィール表示改善",
    items: [
      "プロフィール表示・更新の不具合を修正",
      "記事著者欄に所属・得意分野ラベルを追加",
    ],
    tag: "fix",
  },
  {
    date: "2026-03-11",
    title: "ログアウトフロー改善 & FK 修復",
    items: [
      "ログアウト時に hidden iframe で Access Cookie をクリア → 公開トップへリダイレクト",
      "スクロールリビールアニメーション（About）・スライドトランジション（Presentation）を追加",
      "D1 の壊れた FK 参照 (users_old → users) を修復",
    ],
    tag: "fix",
  },
  {
    date: "2026-03-10",
    title: "AI アシスト修正 & Access JWT 再認証レジリエンス",
    items: [
      "追加エッセンス入力 → AI が本文に自然に組み込む機能を実装",
      "HTML プレビュー + Markdown ソースのタブ切替",
      "Mermaid 図の動的レンダリング & 構文エラー時のフォールバック",
      "max_tokens: 8192 で長文記事の途中切れを防止",
      "Access JWT 期限切れ時にアプリセッションを破棄して再認証へ",
    ],
    tag: "feature",
  },
  {
    date: "2026-03-09",
    title: "AE ロール追加 & SE 権限分離",
    items: [
      "AE（アカウントエンジニア）ロールを追加 — 投稿 + プレゼン閲覧権限",
      "SE ロールを Admin と分離 — 削除・ユーザー管理・申請管理は Admin 専用",
      "D1 CHECK 制約に 'ae' を追加（PRAGMA writable_schema パッチ）",
    ],
    tag: "feature",
  },
  {
    date: "2026-03-08",
    title: "AI チャットボット Deep Dive & AI Gateway",
    items: [
      "About ページに AI チャットボット実装詳細セクションを追加",
      "AI Gateway 統合 — ガードレール・ログ・レート制限・キャッシュを一元管理",
      "プレゼンテーションをスライド式に改修（フルスクリーン・キーボードナビ・トラックパッド対応）",
    ],
    tag: "feature",
  },
  {
    date: "2026-03-05",
    title: "投稿者申請 & Email 通知 & ユーザー管理",
    items: [
      "公開申請フォーム (/apply) を実装",
      "Email Routing API で宛先アドレス自動登録・検証",
      "専用 Email Worker (send_email binding) で承認通知メールを送信",
      "管理者承認時に Cloudflare Access ポリシーへメール自動追加",
      "ユーザー管理（一覧・編集・削除）、削除時に Access + Email Routing 自動クリーンアップ",
      "ユーザープロフィール（nickname, company, expertise 等）& Canvas アバタークロップ",
      "Markdown/Mermaid ガイド追加、抜粋の Markdown ストリップ",
    ],
    tag: "feature",
  },
  {
    date: "2026-03-04",
    title: "機能拡充 & Hono API 移行",
    items: [
      "ホーム記事一覧・Markdown レンダリング・画像アップロード",
      "AI チャット Q&A — Hono streamSSE・RAG・Llama Guard モデレーション・KV レート制限",
      "API レイヤーを Hono に移行 — 型安全バインディング・共通ミドルウェア統一",
      "管理画面の投稿管理（削除）・プレゼンテーションページ追加",
      "WAF + Bot Management セクションを About/Presentation に追加",
      "Access JWT 再認証時のリダイレクトループ修正",
    ],
    tag: "feature",
  },
  {
    date: "2026-03-03",
    title: "基礎設計 — MVP",
    items: [
      "Remix v2 + Cloudflare Pages による SSR アプリケーション構築",
      "D1 (SQLite) + Drizzle ORM でデータモデル設計（users, posts, categories, templates 等）",
      "R2 による画像ストレージ",
      "KV によるセッション管理・ページキャッシュ",
      "RSS フィード・Sitemap 自動生成",
      "SEO 最適化（OGP / Twitter Card）",
      "Tailwind CSS + Typography プラグインによるスタイリング",
      "Cloudflare Access による Zero Trust 認証（Google SSO）+ admin/se/user ロール",
      "GitHub Actions CI/CD デプロイ",
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
