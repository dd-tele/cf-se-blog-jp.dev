import { useState, useCallback, useEffect } from "react";
import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { getSessionUser } from "~/lib/auth.server";

export const meta: MetaFunction = () => [
  { title: "このブログについて — Cloudflare Solution Blog" },
  {
    name: "description",
    content:
      "Cloudflare Solution Blog のアーキテクチャ、使用技術、機能構成について紹介します。",
  },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await getSessionUser(request);
  return {
    siteName: context.cloudflare.env.SITE_NAME ?? "Cloudflare Solution Blog",
    user,
  };
}

export default function AboutPage() {
  const { siteName, user } = useLoaderData<typeof loader>();
  const [diagramOpen, setDiagramOpen] = useState(false);
  const openDiagram = useCallback(() => setDiagramOpen(true), []);
  const closeDiagram = useCallback(() => setDiagramOpen(false), []);

  useEffect(() => {
    if (!diagramOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDiagram(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [diagramOpen, closeDiagram]);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors">
            {siteName}
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
              ← ホーム
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
      <section className="border-b bg-gradient-to-br from-gray-900 via-gray-800 to-brand-900 py-20 text-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-400">
            Architecture & Technology
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            このブログについて
          </h1>
          <p className="mt-4 text-lg text-gray-300">
            Cloudflare のサーバーレスプラットフォーム上に構築された、<br className="hidden sm:block" />
            AI アシスト付きテクニカルブログの技術構成を紹介します。
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">

        {/* Architecture Overview */}
        <section className="mb-20">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">アーキテクチャ概要</h2>
          <div
            className="group cursor-pointer overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            onClick={openDiagram}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDiagram(); }}
          >
            <ArchitectureSvg prefix="" />
          </div>
          <p className="mt-4 text-center text-sm text-gray-500">
            全コンポーネントが Cloudflare のエッジ上で動作し、サーバーレスで運用されています。
          </p>
          <p className="mt-1 text-center text-xs text-gray-400">
            クリックで拡大表示
          </p>

          {/* Fullscreen modal */}
          {diagramOpen && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-8"
              onClick={closeDiagram}
              role="dialog"
              aria-modal="true"
              aria-label="アーキテクチャ概要図（拡大）"
            >
              <div
                className="relative w-full max-w-7xl rounded-2xl bg-white p-4 shadow-2xl sm:p-8"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={closeDiagram}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-800 sm:right-4 sm:top-4"
                  aria-label="閉じる"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
                <ArchitectureSvg prefix="m-" />
              </div>
            </div>
          )}
        </section>

        {/* Tech Stack Grid */}
        <section className="mb-20">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">技術スタック</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TechCard
              color="blue"
              title="Cloudflare Pages"
              description="Remix アプリケーションのホスティング。SSR（サーバーサイドレンダリング）により、SEO に強く高速な初期表示を実現。"
              tags={["Hosting", "SSR", "Edge"]}
            />
            <TechCard
              color="purple"
              title="D1 (SQLite)"
              description="記事、ユーザー、テンプレート、カテゴリなど全データを管理するエッジデータベース。Drizzle ORM でタイプセーフにアクセス。"
              tags={["Database", "SQL", "Edge"]}
            />
            <TechCard
              color="green"
              title="R2 (Object Storage)"
              description="記事に挿入する画像・スクリーンショットを保存。S3 互換 API でアップロード・配信を処理。"
              tags={["Storage", "Media", "S3互換"]}
            />
            <TechCard
              color="amber"
              title="Workers AI"
              description="Llama 3.3 70B モデルを使用し、テンプレートベースの記事ドラフトを AI が自動生成。Hono の streamSSE でチャット応答をリアルタイム配信。"
              tags={["LLM", "Llama 3.3", "70B"]}
            />
            <TechCard
              color="pink"
              title="Vectorize"
              description="記事の埋め込みベクトルを保存し、コンテンツの類似度に基づく関連記事の推薦を実現。"
              tags={["Vector DB", "Embedding", "検索"]}
            />
            <TechCard
              color="orange"
              title="Cloudflare Access"
              description="Zero Trust 認証でポータルを保護。IdP（Google 等）連携による SSO と JWT ベースのセッション管理。"
              tags={["Zero Trust", "SSO", "JWT"]}
            />
            <TechCard
              color="red"
              title="WAF + Bot Management"
              description="カスタムドメインに適用された WAF が OWASP Top 10（SQLi / XSS 等）を防御。Bot Management が API エンドポイントへの自動化攻撃を検知・軽減。ゼロコードでエッジ保護。"
              tags={["WAF", "Bot対策", "API保護"]}
            />
            <TechCard
              color="sky"
              title="API Shield"
              description="OpenAPI 3.0 スキーマを登録し、全 API エンドポイントのメソッド・パス・リクエストボディをエッジで検証。スキーマに合致しないリクエストを自動ブロック。"
              tags={["Schema Validation", "OpenAPI 3.0", "API保護"]}
            />
            <TechCard
              color="green"
              title="Turnstile"
              description="チャット Q&A に invisible モードの Turnstile を統合済み・稼働中。ボットによる自動投稿を Workers 到達前に検知・ブロックし、UX を損なわずに保護。"
              tags={["CAPTCHA", "Bot対策", "Invisible"]}
            />
            <TechCard
              color="purple"
              title="AI Gateway"
              description="Workers AI 呼び出しを AI Gateway 経由でルーティング済み・稼働中。ログ・分析・レート制限・ガードレールを一元管理。"
              tags={["Guardrails", "Logging", "Rate Limit"]}            
            />
            <TechCard
              color="slate"
              title="KV (Key-Value)"
              description="セッション管理とページキャッシュに使用。エッジ上での低レイテンシなデータアクセスを実現。"
              tags={["Session", "Cache"]}
            />
            <TechCard
              color="red"
              title="Hono"
              description="Cloudflare Workers に最適化された超軽量 API フレームワーク。型安全なバインディング、streamSSE による AI ストリーミング、共通ミドルウェア（認証・CORS・ロガー）を提供。"
              tags={["API", "Middleware", "SSE", "TypeSafe"]}
            />
            <TechCard
              color="indigo"
              title="Remix v2"
              description="フルスタック Web フレームワーク。Loader/Action パターンによるデータフェッチと、ネストルーティングで高度な画面構成を実現。API ルートは Hono に委譲。"
              tags={["Framework", "React", "SSR"]}
            />
            <TechCard
              color="teal"
              title="Email Workers + Email Routing"
              description="専用 Email Worker (send_email バインディング) で承認通知メールを送信。Email Routing API で宛先アドレスの登録・検証・削除を自動管理。"
              tags={["Email", "通知", "Verification"]}
            />
            <TechCard
              color="cyan"
              title="Tailwind CSS"
              description="ユーティリティファーストな CSS フレームワーク。Typography プラグインにより、Markdown コンテンツも美しく表示。"
              tags={["CSS", "Typography", "UI"]}
            />
          </div>
        </section>

        {/* Feature Flow */}
        <section className="mb-20">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">記事作成フロー</h2>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="grid grid-cols-1 divide-y sm:grid-cols-5 sm:divide-x sm:divide-y-0">
              <FlowStep step={1} title="テンプレート選択" desc="6種類のテンプレートから選択" />
              <FlowStep step={2} title="フォーム入力" desc="メモ書きレベルでOK" />
              <FlowStep step={3} title="AI ドラフト生成" desc="Llama 3.3 70B が記事化" />
              <FlowStep step={4} title="編集・画像追加" desc="Markdown エディタで調整" />
              <FlowStep step={5} title="公開" desc="ワンクリックで公開" />
            </div>
          </div>
        </section>

        {/* AI Prompt Engineering */}
        <section className="mb-20">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">AI ドラフト生成のしくみ</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-amber-600">入力</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs">VPNが遅い、よく切れる</div>
                <div className="rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs">リモート増えて同時接続きつい</div>
                <div className="rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs">IT部がVPN対応で疲弊してる</div>
              </div>
              <p className="mt-3 text-xs text-gray-400">ラフなメモ書き・箇条書きでの入力</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-brand-600">AI 出力</h3>
              <div className="rounded-lg bg-brand-50 px-4 py-3 text-sm leading-relaxed text-gray-700">
                リモートワークの全社導入に伴い VPN の同時接続数が急増し、業務のピーク時間帯にはライセンス上限に達して接続できない社員が続出するようになりました。IT部門は日々の VPN トラブル対応に追われ、本来注力すべきインフラ改善に手が回らない状況でした...
              </div>
              <p className="mt-3 text-xs text-gray-400">行間を読み、文脈を補完した企業事例スタイルの文章</p>
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h4 className="mb-3 text-sm font-bold text-amber-800">プロンプトエンジニアリングの特徴</h4>
            <div className="grid gap-3 text-sm text-amber-900 sm:grid-cols-2">
              <div className="flex gap-2">
                <span className="mt-0.5 text-amber-500">&#9679;</span>
                <span><strong>行間を読む文章構成</strong> — 箇条書きの裏にある判断理由を推測し肉付け</span>
              </div>
              <div className="flex gap-2">
                <span className="mt-0.5 text-amber-500">&#9679;</span>
                <span><strong>事実の完全保持</strong> — 入力された数値・固有名詞は絶対に省略しない</span>
              </div>
              <div className="flex gap-2">
                <span className="mt-0.5 text-amber-500">&#9679;</span>
                <span><strong>品質ガードレール</strong> — 多言語混入禁止、反復表現禁止、重複禁止</span>
              </div>
              <div className="flex gap-2">
                <span className="mt-0.5 text-amber-500">&#9679;</span>
                <span><strong>セクション末尾の考察</strong> — 背景の総括、改善点、今後の課題を自動追加</span>
              </div>
            </div>
          </div>
        </section>

        {/* Template Types */}
        <section className="mb-20">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">テンプレート一覧</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TemplateCard title="Zero Trust 導入ガイド" desc="Access / Gateway / Tunnel の導入事例を構造化して記述" category="Zero Trust" />
            <TemplateCard title="Workers / Pages 開発記" desc="サーバーレスアプリケーションの設計・実装事例" category="Workers" />
            <TemplateCard title="パフォーマンス最適化" desc="CDN / Cache / Argo 等によるパフォーマンス改善事例" category="Performance" />
            <TemplateCard title="セキュリティ対策" desc="WAF / Bot Management / DDoS 防御の導入・運用事例" category="Security" />
            <TemplateCard title="ネットワーク構成" desc="Magic Transit / WAN / Spectrum 等のネットワーク設計事例" category="Network" />
            <TemplateCard title="Tips &amp; Tricks" desc="短めの実用的な Cloudflare 活用テクニック" category="General" />
          </div>
        </section>

        {/* Access Request & Email Flow */}
        <section className="mb-20">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">投稿者申請 &amp; メール通知フロー</h2>
          <p className="mb-6 text-sm leading-relaxed text-gray-600">
            外部エンジニアが投稿者として参加するには、公開申請フォーム（<code className="rounded bg-gray-100 px-1 text-xs">/apply</code>）から申請を送信します。
            Cloudflare Email Routing と専用 Email Worker を組み合わせた通知メールの仕組みが組み込まれています。
          </p>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="grid grid-cols-1 divide-y sm:grid-cols-5 sm:divide-x sm:divide-y-0">
              <FlowStep step={1} title="申請フォーム送信" desc="/apply からメール・名前・所属を入力" />
              <FlowStep step={2} title="メールアドレス検証" desc="Email Routing API で宛先登録 → CF が検証メール送信" />
              <FlowStep step={3} title="ユーザーが検証" desc="メール内リンクをクリックして検証完了" />
              <FlowStep step={4} title="管理者が承認" desc="Access ポリシーにメール追加 + ユーザー作成" />
              <FlowStep step={5} title="通知メール送信" desc="Email Worker 経由で承認完了メールを送信" />
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-5">
              <h4 className="mb-2 text-sm font-bold text-teal-800">Email Routing API</h4>
              <p className="text-sm text-gray-600">
                申請時に <code className="rounded bg-teal-100 px-1 text-xs text-teal-700">POST /email/routing/addresses</code> で
                宛先アドレスを自動登録。Cloudflare が検証メールを送信し、ユーザーがリンクをクリックして検証完了。
              </p>
            </div>
            <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-5">
              <h4 className="mb-2 text-sm font-bold text-teal-800">Email Worker</h4>
              <p className="text-sm text-gray-600">
                Pages は <code className="rounded bg-teal-100 px-1 text-xs text-teal-700">send_email</code> バインディング非対応のため、
                専用 Worker（cf-se-blog-email-worker）を HTTP fetch で呼び出してメール送信。
              </p>
            </div>
            <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-5">
              <h4 className="mb-2 text-sm font-bold text-teal-800">ユーザー削除時の同期</h4>
              <p className="text-sm text-gray-600">
                ユーザー削除時に Access ポリシーからのメール削除と Email Routing 宛先アドレスの削除を
                API 経由で自動実行し、外部サービスとの整合性を維持。
              </p>
            </div>
          </div>
        </section>

        {/* Hono API Architecture */}
        <section className="mb-20">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">Hono API アーキテクチャ</h2>
          <p className="mb-6 text-sm leading-relaxed text-gray-600">
            本ブログの API レイヤーは、Cloudflare Workers に最適化された超軽量フレームワーク
            <a href="https://hono.dev/" target="_blank" rel="noopener noreferrer" className="mx-1 font-semibold text-red-600 hover:underline">Hono</a>
            で構築されています。Remix の SSR/UI 層と Hono の API 層を組み合わせることで、
            それぞれのフレームワークの強みを最大限に活かしたハイブリッド構成を実現しています。
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-5">
              <h3 className="mb-2 font-bold text-gray-900">型安全なバインディング</h3>
              <p className="text-sm text-gray-600">
                <code className="rounded bg-red-100 px-1 text-xs text-red-700">c.env.DB</code>、
                <code className="rounded bg-red-100 px-1 text-xs text-red-700">c.env.AI</code> など
                全 Cloudflare サービスに型付きでアクセス。開発時にミスを防止。
              </p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-5">
              <h3 className="mb-2 font-bold text-gray-900">streamSSE</h3>
              <p className="text-sm text-gray-600">
                AI チャットの応答を Hono の <code className="rounded bg-red-100 px-1 text-xs text-red-700">streamSSE</code> ヘルパーで
                リアルタイム配信。手動の ReadableStream 構築が不要に。
              </p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-5">
              <h3 className="mb-2 font-bold text-gray-900">共通ミドルウェア</h3>
              <p className="text-sm text-gray-600">
                認証・認可・CORS・ロガーを共通ミドルウェアとして定義。
                ルートごとに宣言的に適用でき、コードの重複を排除。
              </p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-5">
              <h3 className="mb-2 font-bold text-gray-900">超軽量・高速</h3>
              <p className="text-sm text-gray-600">
                依存ゼロ、バンドルサイズ極小。Cloudflare Workers の起動時間を最小化し、
                エッジでのレスポンス速度を最大化。
              </p>
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">
            <h4 className="mb-3 text-sm font-bold text-red-800">API ルート構成</h4>
            <div className="grid gap-2 text-sm text-red-900 sm:grid-cols-2">
              <div className="flex gap-2">
                <code className="shrink-0 rounded bg-red-100 px-2 py-0.5 text-xs font-mono">POST /api/v1/chat</code>
                <span className="text-gray-600">AI チャット Q&A（SSE ストリーミング）</span>
              </div>
              <div className="flex gap-2">
                <code className="shrink-0 rounded bg-red-100 px-2 py-0.5 text-xs font-mono">POST /api/v1/ai/*</code>
                <span className="text-gray-600">タグ提案・文章改善・トレンドレポート</span>
              </div>
              <div className="flex gap-2">
                <code className="shrink-0 rounded bg-red-100 px-2 py-0.5 text-xs font-mono">POST /api/upload-image</code>
                <span className="text-gray-600">画像アップロード（R2）</span>
              </div>
              <div className="flex gap-2">
                <code className="shrink-0 rounded bg-red-100 px-2 py-0.5 text-xs font-mono">GET /api/health</code>
                <span className="text-gray-600">ヘルスチェック</span>
              </div>
            </div>
          </div>
        </section>

        {/* Data Model */}
        <section className="mb-20">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">データモデル</h2>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <svg viewBox="0 0 800 380" className="w-full" xmlns="http://www.w3.org/2000/svg">
              <rect width="800" height="380" fill="#fafafa" rx="12" />

              {/* Users */}
              <g>
                <rect x="30" y="30" width="150" height="150" rx="8" fill="#fff" stroke="#a78bfa" strokeWidth="1.5" />
                <rect x="30" y="30" width="150" height="30" rx="8" fill="#8b5cf6" />
                <rect x="30" y="52" width="150" height="8" fill="#8b5cf6" />
                <text x="105" y="50" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">users</text>
                <text x="42" y="80" fill="#6b7280" fontSize="9">id, email, display_name</text>
                <text x="42" y="95" fill="#6b7280" fontSize="9">role, avatar_url, bio</text>
                <text x="42" y="110" fill="#6b7280" fontSize="9">nickname, furigana</text>
                <text x="42" y="125" fill="#6b7280" fontSize="9">company, job_role, expertise</text>
                <text x="42" y="140" fill="#6b7280" fontSize="9">profile_comment</text>
                <text x="42" y="155" fill="#6b7280" fontSize="9">approved_post_count</text>
              </g>

              {/* Access Requests */}
              <g>
                <rect x="30" y="210" width="150" height="120" rx="8" fill="#fff" stroke="#14b8a6" strokeWidth="1.5" />
                <rect x="30" y="210" width="150" height="30" rx="8" fill="#14b8a6" />
                <rect x="30" y="232" width="150" height="8" fill="#14b8a6" />
                <text x="105" y="230" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700">access_requests</text>
                <text x="42" y="258" fill="#6b7280" fontSize="9">id, email, display_name</text>
                <text x="42" y="273" fill="#6b7280" fontSize="9">company, reason</text>
                <text x="42" y="288" fill="#6b7280" fontSize="9">status: pending | approved</text>
                <text x="42" y="303" fill="#6b7280" fontSize="9">| rejected</text>
              </g>

              {/* Posts */}
              <g>
                <rect x="250" y="30" width="180" height="160" rx="8" fill="#fff" stroke="#3b82f6" strokeWidth="1.5" />
                <rect x="250" y="30" width="180" height="30" rx="8" fill="#3b82f6" />
                <rect x="250" y="52" width="180" height="8" fill="#3b82f6" />
                <text x="340" y="50" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">posts</text>
                <text x="262" y="80" fill="#6b7280" fontSize="9">id, title, slug, content</text>
                <text x="262" y="95" fill="#6b7280" fontSize="9">excerpt, cover_image_url</text>
                <text x="262" y="110" fill="#6b7280" fontSize="9">author_id → users</text>
                <text x="262" y="125" fill="#6b7280" fontSize="9">category_id → categories</text>
                <text x="262" y="140" fill="#6b7280" fontSize="9">status: draft | published</text>
                <text x="262" y="155" fill="#6b7280" fontSize="9">tags_json, reading_time</text>
                <text x="262" y="170" fill="#6b7280" fontSize="9">published_at, view_count</text>
              </g>

              {/* Categories */}
              <g>
                <rect x="500" y="30" width="140" height="90" rx="8" fill="#fff" stroke="#10b981" strokeWidth="1.5" />
                <rect x="500" y="30" width="140" height="30" rx="8" fill="#10b981" />
                <rect x="500" y="52" width="140" height="8" fill="#10b981" />
                <text x="570" y="50" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">categories</text>
                <text x="512" y="80" fill="#6b7280" fontSize="9">id, name, slug</text>
                <text x="512" y="95" fill="#6b7280" fontSize="9">description, sort_order</text>
              </g>

              {/* Templates */}
              <g>
                <rect x="500" y="150" width="160" height="120" rx="8" fill="#fff" stroke="#f59e0b" strokeWidth="1.5" />
                <rect x="500" y="150" width="160" height="30" rx="8" fill="#f59e0b" />
                <rect x="500" y="172" width="160" height="8" fill="#f59e0b" />
                <text x="580" y="170" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">templates</text>
                <text x="512" y="200" fill="#6b7280" fontSize="9">id, name, description</text>
                <text x="512" y="215" fill="#6b7280" fontSize="9">input_fields_json</text>
                <text x="512" y="230" fill="#6b7280" fontSize="9">ai_prompt_template</text>
                <text x="512" y="245" fill="#6b7280" fontSize="9">difficulty, category_id</text>
              </g>

              {/* AI Draft Requests */}
              <g>
                <rect x="250" y="220" width="180" height="70" rx="8" fill="#fff" stroke="#ec4899" strokeWidth="1.5" />
                <rect x="250" y="220" width="180" height="30" rx="8" fill="#ec4899" />
                <rect x="250" y="242" width="180" height="8" fill="#ec4899" />
                <text x="340" y="240" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700">ai_draft_requests</text>
                <text x="262" y="268" fill="#6b7280" fontSize="9">user_id, template_id, post_id</text>
                <text x="262" y="283" fill="#6b7280" fontSize="9">model_used, latency_ms, status</text>
              </g>

              {/* Email Routing note */}
              <g>
                <rect x="500" y="300" width="260" height="60" rx="8" fill="#f0fdfa" stroke="#14b8a6" strokeWidth="1" strokeDasharray="4" />
                <text x="630" y="322" textAnchor="middle" fill="#0d9488" fontSize="9" fontWeight="600">Cloudflare Email Routing (外部)</text>
                <text x="630" y="338" textAnchor="middle" fill="#6b7280" fontSize="8">宛先アドレスの登録・検証・削除を API 経由で管理</text>
                <text x="630" y="352" textAnchor="middle" fill="#6b7280" fontSize="8">Email Worker (send_email) で通知メール送信</text>
              </g>

              {/* Relations */}
              <line x1="180" y1="90" x2="250" y2="90" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4" />
              <line x1="430" y1="70" x2="500" y2="70" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4" />
              <line x1="430" y1="255" x2="500" y2="210" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4" />
              <line x1="340" y1="190" x2="340" y2="220" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4" />
              <line x1="180" y1="270" x2="500" y2="330" stroke="#14b8a6" strokeWidth="1" strokeDasharray="4" />
            </svg>
          </div>
        </section>

        {/* Security & Infra */}
        <section className="mb-20">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">セキュリティ & インフラ</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-2 font-bold text-gray-900">認証・認可</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>Cloudflare Access による Zero Trust 認証</li>
                <li>IdP 連携（Google Workspace 等）</li>
                <li>JWT ベースのセッション管理（KV 保存）</li>
                <li>ロールベースアクセス制御（admin / se / user）</li>
              </ul>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-2 font-bold text-gray-900">WAF + Bot Management</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>カスタムドメインに WAF を適用</li>
                <li>OWASP Top 10 防御（SQLi / XSS 等）</li>
                <li>Bot Management で自動化攻撃を検知・軽減</li>
                <li>API Shield — OpenAPI スキーマで全エンドポイントを検証</li>
                <li>Turnstile — チャット Bot 保護（invisible モード）</li>
                <li>AI Gateway — AI 呼び出しのガードレール・ログ・分析</li>
              </ul>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-2 font-bold text-gray-900">エッジコンピューティング</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>全コンポーネントが Cloudflare エッジで動作</li>
                <li>オリジンサーバー不要のフルサーバーレス</li>
                <li>グローバル CDN による低レイテンシ配信</li>
                <li>自動スケーリング・ゼロコールドスタート</li>
              </ul>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-2 font-bold text-gray-900">投稿者申請 &amp; メール通知</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>公開申請フォーム（/apply）で自己申請</li>
                <li>Email Routing API で宛先アドレス自動登録・検証</li>
                <li>専用 Email Worker で承認通知メール送信</li>
                <li>ユーザー削除時に Access + Email Routing を自動クリーンアップ</li>
              </ul>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-2 font-bold text-gray-900">運用機能</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>RSS フィード自動生成</li>
                <li>SEO 最適化（OGP / Twitter Card）</li>
                <li>閲覧数カウント</li>
                <li>監査ログ（Audit Log）</li>
                <li>ユーザープロフィール管理（所属・専門分野等）</li>
              </ul>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-2 font-bold text-gray-900">開発体験</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>TypeScript + Drizzle ORM でタイプセーフ</li>
                <li>Hono で API を型安全に構築</li>
                <li>D1 マイグレーションによるスキーマ管理</li>
                <li>Wrangler CLI でローカル開発・デプロイ</li>
                <li>Vite ベースの高速 HMR</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Specs Table */}
        <section className="mb-20">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">仕様一覧</h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">項目</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">技術 / 仕様</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <SpecRow label="フレームワーク" value="Remix v2 (Vite) + Hono (API)" />
                <SpecRow label="ランタイム" value="Cloudflare Workers (V8 Isolates)" />
                <SpecRow label="データベース" value="Cloudflare D1 (SQLite at edge)" />
                <SpecRow label="ORM" value="Drizzle ORM" />
                <SpecRow label="ストレージ" value="Cloudflare R2 (S3 互換)" />
                <SpecRow label="API レイヤー" value="Hono — streamSSE, 型付き Bindings, ミドルウェア" />
                <SpecRow label="AI モデル" value="Meta Llama 3.3 70B Instruct fp8-fast (Workers AI)" />
                <SpecRow label="ベクトル検索" value="Cloudflare Vectorize" />
                <SpecRow label="API 保護" value="API Shield (Schema Validation) + Turnstile (Bot保護) + AI Gateway (Guardrails)" />
                <SpecRow label="認証" value="Cloudflare Access (Zero Trust)" />
                <SpecRow label="セッション" value="Cloudflare KV" />
                <SpecRow label="メール通知" value="Email Workers (send_email) + Email Routing API" />
                <SpecRow label="投稿者申請" value="/apply → Email 検証 → 管理者承認 → Access ポリシー自動追加" />
                <SpecRow label="CSS" value="Tailwind CSS v3 + Typography plugin" />
                <SpecRow label="Markdown" value="marked + DOMPurify (XSS 対策)" />
                <SpecRow label="言語" value="TypeScript 5.7" />
                <SpecRow label="デプロイ" value="Wrangler CLI → Cloudflare Pages" />
              </tbody>
            </table>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-gray-900 py-10 text-gray-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Link to="/" className="text-sm font-medium text-gray-400 hover:text-gray-300 transition-colors">
              {siteName}
            </Link>
            <span className="text-xs text-gray-600">
              Built on Cloudflare — Workers, Pages, D1, R2, AI, Email, Hono
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TechCard({
  color,
  title,
  description,
  tags,
}: {
  color: string;
  title: string;
  description: string;
  tags: string[];
}) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50/50",
    purple: "border-purple-200 bg-purple-50/50",
    green: "border-green-200 bg-green-50/50",
    amber: "border-amber-200 bg-amber-50/50",
    pink: "border-pink-200 bg-pink-50/50",
    orange: "border-orange-200 bg-orange-50/50",
    slate: "border-slate-200 bg-slate-50/50",
    indigo: "border-indigo-200 bg-indigo-50/50",
    cyan: "border-cyan-200 bg-cyan-50/50",
    red: "border-red-200 bg-red-50/50",
    teal: "border-teal-200 bg-teal-50/50",
    sky: "border-sky-200 bg-sky-50/50",
  };
  const tagColorMap: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    pink: "bg-pink-100 text-pink-700",
    orange: "bg-orange-100 text-orange-700",
    slate: "bg-slate-100 text-slate-700",
    indigo: "bg-indigo-100 text-indigo-700",
    cyan: "bg-cyan-100 text-cyan-700",
    red: "bg-red-100 text-red-700",
    teal: "bg-teal-100 text-teal-700",
    sky: "bg-sky-100 text-sky-700",
  };

  return (
    <div className={`rounded-xl border p-5 ${colorMap[color] ?? "border-gray-200 bg-gray-50/50"}`}>
      <h3 className="mb-2 font-bold text-gray-900">{title}</h3>
      <p className="mb-3 text-sm leading-relaxed text-gray-600">{description}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tagColorMap[color] ?? "bg-gray-100 text-gray-600"}`}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function FlowStep({ step, title, desc }: { step: number; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-6 text-center">
      <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
        {step}
      </span>
      <h4 className="mt-2 text-sm font-bold text-gray-900">{title}</h4>
      <p className="mt-1 text-xs text-gray-500">{desc}</p>
    </div>
  );
}

function TemplateCard({ title, desc, category }: { title: string; desc: string; category: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <span className="mb-2 inline-block rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
        {category}
      </span>
      <h3 className="mb-1 font-bold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500">{desc}</p>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="hover:bg-gray-50/50">
      <td className="whitespace-nowrap px-6 py-3 font-medium text-gray-900">{label}</td>
      <td className="px-6 py-3 text-gray-600">{value}</td>
    </tr>
  );
}

function ArchitectureSvg({ prefix }: { prefix: string }) {
  const a = `${prefix}arrow`;
  const aB = `${prefix}arrowBlue`;
  const aO = `${prefix}arrowOrange`;
  const aT = `${prefix}arrowTeal`;
  return (
    <svg viewBox="0 0 1060 660" className="w-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="1060" height="660" fill="#fafafa" rx="12" />
      <text x="530" y="30" textAnchor="middle" fill="#1e293b" fontSize="13" fontWeight="700">System Architecture — Cloudflare SE Blog Platform</text>

      {/* Lane backgrounds */}
      <rect x="10" y="50" width="1040" height="230" rx="10" fill="#3b82f6" fillOpacity="0.03" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="6" />
      <text x="24" y="70" fill="#3b82f6" fontSize="9" fontWeight="700" letterSpacing="1">PUBLIC — READ ONLY + ACCESS REQUEST</text>
      <rect x="10" y="330" width="1040" height="310" rx="10" fill="#f97316" fillOpacity="0.03" stroke="#f97316" strokeWidth="0.5" strokeDasharray="6" />
      <text x="24" y="350" fill="#ea580c" fontSize="9" fontWeight="700" letterSpacing="1">AUTHENTICATED — INVITED ENGINEERS</text>

      {/* Public visitor */}
      <g>
        <rect x="25" y="95" width="120" height="90" rx="10" fill="#1e293b" />
        <text x="85" y="118" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600">閲覧ユーザー</text>
        <line x1="45" y1="126" x2="125" y2="126" stroke="#334155" strokeWidth="0.5" />
        <text x="85" y="142" textAnchor="middle" fill="#93c5fd" fontSize="8">記事閲覧</text>
        <text x="85" y="155" textAnchor="middle" fill="#93c5fd" fontSize="8">キーワード検索</text>
        <text x="85" y="168" textAnchor="middle" fill="#93c5fd" fontSize="8">AI チャット Q&amp;A</text>
      </g>
      {/* Applicant */}
      <g>
        <rect x="25" y="205" width="120" height="60" rx="10" fill="#1e293b" />
        <text x="85" y="228" textAnchor="middle" fill="#5eead4" fontSize="10" fontWeight="600">投稿者申請者</text>
        <line x1="45" y1="234" x2="125" y2="234" stroke="#334155" strokeWidth="0.5" />
        <text x="85" y="250" textAnchor="middle" fill="#5eead4" fontSize="8">/apply から自己申請</text>
      </g>
      {/* Invited engineer / Admin */}
      <g>
        <rect x="25" y="380" width="120" height="170" rx="10" fill="#1e293b" />
        <text x="85" y="403" textAnchor="middle" fill="#fdba74" fontSize="9" fontWeight="700">導入をリードした</text>
        <text x="85" y="417" textAnchor="middle" fill="#fdba74" fontSize="9" fontWeight="700">エンジニア</text>
        <line x1="45" y1="425" x2="125" y2="425" stroke="#334155" strokeWidth="0.5" />
        <text x="85" y="440" textAnchor="middle" fill="#94a3b8" fontSize="7.5">申請承認 or Cloudflare 招待</text>
        <rect x="38" y="448" width="94" height="18" rx="4" fill="#f97316" fillOpacity="0.15" />
        <text x="85" y="461" textAnchor="middle" fill="#ea580c" fontSize="7" fontWeight="600">Access 認証済み</text>
        <line x1="45" y1="472" x2="125" y2="472" stroke="#334155" strokeWidth="0.5" />
        <text x="85" y="487" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="600">SE / Admin</text>
        <text x="85" y="501" textAnchor="middle" fill="#94a3b8" fontSize="7.5">記事の投稿・管理</text>
        <text x="85" y="514" textAnchor="middle" fill="#94a3b8" fontSize="7.5">テンプレート / AI ドラフト</text>
        <text x="85" y="527" textAnchor="middle" fill="#94a3b8" fontSize="7.5">プロフィール管理</text>
        <text x="85" y="540" textAnchor="middle" fill="#94a3b8" fontSize="7.5">管理ダッシュボード</text>
      </g>

      {/* Arrows: Users → WAF */}
      <line x1="145" y1="140" x2="195" y2="140" stroke="#93c5fd" strokeWidth="2" markerEnd={`url(#${aB})`} />
      <line x1="145" y1="235" x2="195" y2="235" stroke="#5eead4" strokeWidth="2" markerEnd={`url(#${aT})`} />
      <line x1="145" y1="470" x2="195" y2="470" stroke="#fdba74" strokeWidth="2" markerEnd={`url(#${aO})`} />

      {/* WAF + Bot Management */}
      <g>
        <rect x="195" y="80" width="125" height="510" rx="12" fill="#ef4444" fillOpacity="0.06" stroke="#ef4444" strokeWidth="1.5" />
        <text x="257" y="108" textAnchor="middle" fill="#dc2626" fontSize="12" fontWeight="700">WAF</text>
        <text x="257" y="124" textAnchor="middle" fill="#b91c1c" fontSize="8">OWASP Top 10</text>
        <text x="257" y="138" textAnchor="middle" fill="#b91c1c" fontSize="8">DDoS 防御</text>
        <rect x="210" y="148" width="95" height="22" rx="6" fill="#fef2f2" stroke="#fecaca" strokeWidth="1" />
        <text x="257" y="163" textAnchor="middle" fill="#dc2626" fontSize="8" fontWeight="600">Bot Management</text>
        <text x="257" y="300" textAnchor="middle" fill="#991b1b" fontSize="7" fontWeight="500">全トラフィック適用</text>
      </g>

      {/* PUBLIC PATH: WAF → Pages */}
      <line x1="320" y1="140" x2="510" y2="230" stroke="#93c5fd" strokeWidth="2" markerEnd={`url(#${aB})`} />
      {/* Applicant PATH: WAF → Pages */}
      <line x1="320" y1="235" x2="510" y2="260" stroke="#5eead4" strokeWidth="1.5" markerEnd={`url(#${aT})`} />
      <g>
        <rect x="355" y="100" width="140" height="64" rx="8" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" />
        <text x="425" y="116" textAnchor="middle" fill="#1d4ed8" fontSize="8" fontWeight="600">Public ルート（認証不要）</text>
        <text x="425" y="130" textAnchor="middle" fill="#3b82f6" fontSize="7">/ &nbsp; /posts/* &nbsp; /about &nbsp; /search</text>
        <text x="425" y="142" textAnchor="middle" fill="#3b82f6" fontSize="7">/api/v1/chat &nbsp; /api/health</text>
        <text x="425" y="154" textAnchor="middle" fill="#14b8a6" fontSize="7" fontWeight="600">/apply（投稿者申請フォーム）</text>
        <text x="425" y="162" textAnchor="middle" fill="#94a3b8" fontSize="6">閲覧・検索・Q&amp;A・申請</text>
      </g>

      {/* AUTHENTICATED PATH: WAF → CF Access → Pages */}
      <line x1="320" y1="470" x2="355" y2="470" stroke="#fdba74" strokeWidth="2" markerEnd={`url(#${aO})`} />
      <g>
        <rect x="355" y="370" width="140" height="220" rx="12" fill="#f97316" fillOpacity="0.1" stroke="#f97316" strokeWidth="1.5" />
        <text x="425" y="395" textAnchor="middle" fill="#ea580c" fontSize="11" fontWeight="700">Cloudflare Access</text>
        <line x1="370" y1="402" x2="480" y2="402" stroke="#f97316" strokeWidth="0.5" strokeOpacity="0.4" />
        <text x="425" y="418" textAnchor="middle" fill="#9a3412" fontSize="8">Zero Trust 認証</text>
        <text x="425" y="433" textAnchor="middle" fill="#9a3412" fontSize="8">IdP 連携 (Google)</text>
        <text x="425" y="448" textAnchor="middle" fill="#9a3412" fontSize="8">JWT 検証</text>
        <rect x="370" y="456" width="110" height="20" rx="5" fill="#fff7ed" stroke="#fed7aa" strokeWidth="1" />
        <text x="425" y="470" textAnchor="middle" fill="#c2410c" fontSize="7" fontWeight="600">申請承認制アクセス制御</text>
        <line x1="370" y1="484" x2="480" y2="484" stroke="#f97316" strokeWidth="0.5" strokeOpacity="0.4" />
        <text x="425" y="498" textAnchor="middle" fill="#9a3412" fontSize="7" fontWeight="600">保護対象パス:</text>
        <text x="425" y="512" textAnchor="middle" fill="#9a3412" fontSize="7">/portal/* （投稿・編集・プロフィール）</text>
        <text x="425" y="526" textAnchor="middle" fill="#9a3412" fontSize="7">/admin/* （管理・申請承認）</text>
        <rect x="370" y="536" width="110" height="22" rx="5" fill="#fef2f2" stroke="#fecaca" strokeWidth="1" />
        <text x="425" y="551" textAnchor="middle" fill="#dc2626" fontSize="7" fontWeight="600">未招待 → アクセス拒否</text>
        <rect x="370" y="564" width="110" height="18" rx="5" fill="#f0fdfa" stroke="#99f6e4" strokeWidth="1" />
        <text x="425" y="577" textAnchor="middle" fill="#0d9488" fontSize="6.5" fontWeight="600">承認時 API でメール追加</text>
      </g>

      {/* Arrow: CF Access → Pages */}
      <line x1="495" y1="460" x2="510" y2="350" stroke="#fdba74" strokeWidth="2" markerEnd={`url(#${aO})`} />

      {/* CF Pages + Workers */}
      <g>
        <rect x="510" y="165" width="195" height="240" rx="12" fill="#3b82f6" fillOpacity="0.08" stroke="#3b82f6" strokeWidth="1.5" />
        <text x="607" y="190" textAnchor="middle" fill="#1d4ed8" fontSize="12" fontWeight="700">Cloudflare Pages</text>
        <rect x="528" y="202" width="160" height="26" rx="6" fill="#dbeafe" />
        <text x="608" y="219" textAnchor="middle" fill="#1e40af" fontSize="9" fontWeight="600">Remix (SSR / UI)</text>
        <rect x="528" y="234" width="160" height="26" rx="6" fill="#ff6b1a" fillOpacity="0.15" stroke="#ff6b1a" strokeWidth="1" />
        <text x="608" y="251" textAnchor="middle" fill="#c2410c" fontSize="9" fontWeight="700">Hono (API Layer)</text>
        <rect x="528" y="266" width="76" height="22" rx="6" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" />
        <text x="566" y="281" textAnchor="middle" fill="#1e40af" fontSize="7">streamSSE</text>
        <rect x="612" y="266" width="76" height="22" rx="6" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" />
        <text x="650" y="281" textAnchor="middle" fill="#1e40af" fontSize="7">Middleware</text>
        <rect x="528" y="294" width="160" height="22" rx="6" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" />
        <text x="608" y="309" textAnchor="middle" fill="#1e40af" fontSize="7">CORS / Auth / Logger</text>
        <rect x="528" y="322" width="160" height="22" rx="6" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" />
        <text x="608" y="337" textAnchor="middle" fill="#1e40af" fontSize="7">Tailwind CSS + Typography</text>
        <rect x="528" y="350" width="160" height="28" rx="6" fill="#f0fdf4" stroke="#86efac" strokeWidth="1" />
        <text x="608" y="368" textAnchor="middle" fill="#166534" fontSize="7" fontWeight="600">Public + Protected ルート統合</text>
      </g>

      {/* Arrows: Pages → Backend Services */}
      <line x1="705" y1="220" x2="760" y2="140" stroke="#cbd5e1" strokeWidth="2" markerEnd={`url(#${a})`} />
      <line x1="705" y1="250" x2="760" y2="240" stroke="#cbd5e1" strokeWidth="2" markerEnd={`url(#${a})`} />
      <line x1="705" y1="295" x2="760" y2="340" stroke="#cbd5e1" strokeWidth="2" markerEnd={`url(#${a})`} />
      <line x1="705" y1="325" x2="760" y2="435" stroke="#cbd5e1" strokeWidth="1.5" markerEnd={`url(#${a})`} />
      <line x1="705" y1="355" x2="760" y2="530" stroke="#14b8a6" strokeWidth="1.5" markerEnd={`url(#${aT})`} />

      {/* D1 Database */}
      <g>
        <rect x="760" y="95" width="125" height="80" rx="10" fill="#8b5cf6" fillOpacity="0.1" stroke="#8b5cf6" strokeWidth="1.5" />
        <text x="822" y="118" textAnchor="middle" fill="#6d28d9" fontSize="10" fontWeight="700">D1 (SQLite)</text>
        <text x="822" y="134" textAnchor="middle" fill="#7c3aed" fontSize="8">記事 / ユーザー / 申請</text>
        <text x="822" y="148" textAnchor="middle" fill="#7c3aed" fontSize="8">テンプレート / カテゴリ</text>
        <text x="822" y="162" textAnchor="middle" fill="#7c3aed" fontSize="8">プロフィール / 監査ログ</text>
      </g>
      <line x1="885" y1="125" x2="898" y2="125" stroke="#c4b5fd" strokeWidth="1" />
      <g>
        <rect x="898" y="112" width="72" height="24" rx="6" fill="#f3e8ff" stroke="#c4b5fd" strokeWidth="1" />
        <text x="934" y="128" textAnchor="middle" fill="#6d28d9" fontSize="8" fontWeight="600">Drizzle ORM</text>
      </g>

      {/* R2 Storage */}
      <g>
        <rect x="760" y="200" width="125" height="65" rx="10" fill="#10b981" fillOpacity="0.1" stroke="#10b981" strokeWidth="1.5" />
        <text x="822" y="225" textAnchor="middle" fill="#047857" fontSize="10" fontWeight="700">R2 (Storage)</text>
        <text x="822" y="241" textAnchor="middle" fill="#059669" fontSize="8">画像アップロード</text>
        <text x="822" y="255" textAnchor="middle" fill="#059669" fontSize="8">メディア管理</text>
      </g>

      {/* Workers AI */}
      <g>
        <rect x="760" y="300" width="125" height="70" rx="10" fill="#f59e0b" fillOpacity="0.1" stroke="#f59e0b" strokeWidth="1.5" />
        <text x="822" y="325" textAnchor="middle" fill="#b45309" fontSize="10" fontWeight="700">Workers AI</text>
        <text x="822" y="341" textAnchor="middle" fill="#d97706" fontSize="8">Llama 3.3 70B</text>
        <text x="822" y="357" textAnchor="middle" fill="#d97706" fontSize="8">ドラフト / Chat Q&amp;A</text>
      </g>

      {/* KV */}
      <g>
        <rect x="760" y="405" width="125" height="50" rx="10" fill="#64748b" fillOpacity="0.1" stroke="#64748b" strokeWidth="1.5" />
        <text x="822" y="427" textAnchor="middle" fill="#475569" fontSize="10" fontWeight="700">KV</text>
        <text x="822" y="443" textAnchor="middle" fill="#64748b" fontSize="8">セッション / キャッシュ</text>
      </g>

      {/* Email Worker */}
      <g>
        <rect x="760" y="490" width="125" height="80" rx="10" fill="#14b8a6" fillOpacity="0.1" stroke="#14b8a6" strokeWidth="1.5" />
        <text x="822" y="513" textAnchor="middle" fill="#0d9488" fontSize="10" fontWeight="700">Email Worker</text>
        <text x="822" y="529" textAnchor="middle" fill="#14b8a6" fontSize="7.5">send_email binding</text>
        <text x="822" y="543" textAnchor="middle" fill="#14b8a6" fontSize="7.5">承認通知メール送信</text>
        <text x="822" y="557" textAnchor="middle" fill="#14b8a6" fontSize="7">noreply@cf-se-blog-jp.dev</text>
      </g>
      {/* Arrow: Email Worker → Email Routing */}
      <line x1="885" y1="530" x2="910" y2="530" stroke="#14b8a6" strokeWidth="1.5" markerEnd={`url(#${aT})`} />
      <g>
        <rect x="910" y="505" width="110" height="50" rx="10" fill="#14b8a6" fillOpacity="0.06" stroke="#14b8a6" strokeWidth="1" strokeDasharray="4" />
        <text x="965" y="525" textAnchor="middle" fill="#0d9488" fontSize="8" fontWeight="600">Email Routing</text>
        <text x="965" y="541" textAnchor="middle" fill="#14b8a6" fontSize="7">宛先検証・配信</text>
      </g>

      {/* Vectorize */}
      <line x1="885" y1="335" x2="910" y2="335" stroke="#cbd5e1" strokeWidth="1.5" markerEnd={`url(#${a})`} />
      <g>
        <rect x="910" y="310" width="100" height="50" rx="10" fill="#ec4899" fillOpacity="0.1" stroke="#ec4899" strokeWidth="1.5" />
        <text x="960" y="332" textAnchor="middle" fill="#be185d" fontSize="9" fontWeight="700">Vectorize</text>
        <text x="960" y="348" textAnchor="middle" fill="#db2777" fontSize="7">関連記事 / RAG</text>
      </g>

      {/* Legend */}
      <g>
        <rect x="510" y="560" width="195" height="90" rx="8" fill="#fff" stroke="#e2e8f0" strokeWidth="1" />
        <text x="525" y="578" fill="#475569" fontSize="8" fontWeight="700">LEGEND</text>
        <line x1="525" y1="590" x2="555" y2="590" stroke="#93c5fd" strokeWidth="2" />
        <text x="562" y="594" fill="#64748b" fontSize="7">閲覧ユーザー（認証不要・読み取り専用）</text>
        <line x1="525" y1="606" x2="555" y2="606" stroke="#5eead4" strokeWidth="2" />
        <text x="562" y="610" fill="#64748b" fontSize="7">投稿者申請者（/apply → Email 検証）</text>
        <line x1="525" y1="622" x2="555" y2="622" stroke="#fdba74" strokeWidth="2" />
        <text x="562" y="626" fill="#64748b" fontSize="7">招待エンジニア（CF Access 認証・投稿可能）</text>
        <line x1="525" y1="638" x2="555" y2="638" stroke="#cbd5e1" strokeWidth="2" />
        <text x="562" y="642" fill="#64748b" fontSize="7">内部サービス間通信</text>
      </g>

      {/* Arrow markers */}
      <defs>
        <marker id={a} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill="#94a3b8" />
        </marker>
        <marker id={aB} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill="#93c5fd" />
        </marker>
        <marker id={aO} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill="#fdba74" />
        </marker>
        <marker id={aT} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill="#14b8a6" />
        </marker>
      </defs>
    </svg>
  );
}
