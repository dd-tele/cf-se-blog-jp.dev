import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { requireRole } from "~/lib/auth.server";

export const meta: MetaFunction = () => [
  { title: "Hono 詳細 — プレゼンテーション" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireRole(request, ["admin", "se", "ae"], context.cloudflare.env);
  return { user };
}

export default function PresentationHono() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white print:hidden">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors"
            >
              Cloudflare Field Notes
            </Link>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm font-semibold text-red-600">Admin</span>
            <span className="text-sm text-gray-400">|</span>
            <Link to="/admin/presentation" className="text-sm text-gray-500 hover:text-gray-700">
              ← プレゼンに戻る
            </Link>
          </div>
          <span className="text-sm text-gray-500">{user.displayName}</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* ───────────────── Hero ───────────────── */}
        <section className="mb-16 rounded-3xl bg-gradient-to-br from-red-700 via-red-600 to-orange-500 p-12 text-white shadow-xl sm:p-16">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-5xl">🔥</span>
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-white/70">
                API Layer Deep Dive
              </p>
              <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
                Hono
              </h1>
            </div>
          </div>
          <p className="max-w-2xl text-lg leading-relaxed text-white/85">
            Cloudflare Workers に最適化された超軽量 Web フレームワーク。
            本ブログの API レイヤーの心臓部として、AI チャット、画像アップロード、
            タグ提案など全ての API エンドポイントを統括する。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <HeroBadge>依存ゼロ</HeroBadge>
            <HeroBadge>14KB バンドル</HeroBadge>
            <HeroBadge>型安全バインディング</HeroBadge>
            <HeroBadge>streamSSE</HeroBadge>
            <HeroBadge>ミドルウェアスタック</HeroBadge>
          </div>
        </section>

        {/* ───────────────── What is Hono ───────────────── */}
        <section className="mb-16">
          <SectionHeader number={1} title="Hono とは" />
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <p className="mb-4 text-sm leading-relaxed text-gray-700">
              <a href="https://hono.dev/" target="_blank" rel="noopener noreferrer" className="font-semibold text-red-600 hover:underline">Hono</a> は、
              Cloudflare Workers、Deno、Bun、Node.js 等のエッジ/サーバーレスランタイムに最適化された
              超軽量 Web フレームワークです。Express.js のような使いやすい API を持ちながら、
              依存ゼロ・バンドルサイズ 14KB 以下という極小フットプリントを実現しています。
            </p>
            <p className="mb-6 text-sm leading-relaxed text-gray-700">
              日本発のオープンソースプロジェクトとして 2022 年に誕生し、
              現在では Cloudflare 公式のスターターテンプレートにも採用されるなど、
              Workers エコシステムの中核的存在に成長しています。
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <MiniStat label="バンドルサイズ" value="~14KB" sub="依存ゼロ" />
              <MiniStat label="ルーター性能" value="超高速" sub="RegExpRouter / TrieRouter" />
              <MiniStat label="対応ランタイム" value="6+" sub="Workers, Deno, Bun, Node..." />
            </div>
          </div>
        </section>

        {/* ───────────────── Role in this blog ───────────────── */}
        <section className="mb-16">
          <SectionHeader number={2} title="このブログでの役割" />
          <p className="mb-6 text-sm leading-relaxed text-gray-600">
            Remix が UI/SSR 層を担当する一方、Hono は全ての API エンドポイントを統括する
            <strong>「API レイヤーの心臓部」</strong>として機能しています。
          </p>
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="p-6">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-red-500">
                  Hono が担当する範囲
                </h3>
                <ul className="space-y-3">
                  <RoleItem label="AI チャット Q&A" desc="streamSSE によるリアルタイムストリーミング応答" />
                  <RoleItem label="AI タグ提案 / 文章改善" desc="Workers AI への推論リクエストとレスポンス整形" />
                  <RoleItem label="AI トレンドレポート" desc="記事データ集計 → AI 分析 → レポート生成" />
                  <RoleItem label="画像アップロード" desc="マルチパートフォーム解析 → R2 への保存" />
                  <RoleItem label="R2 オブジェクト配信" desc="画像・メディアファイルの Content-Type 付き配信" />
                  <RoleItem label="ヘルスチェック" desc="API の稼働状態監視" />
                </ul>
              </div>
              <div className="p-6">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-blue-500">
                  Remix が担当する範囲
                </h3>
                <ul className="space-y-3">
                  <RoleItem label="ページレンダリング" desc="SSR による HTML 生成とルーティング" />
                  <RoleItem label="データローディング" desc="Loader パターンでの DB クエリ" />
                  <RoleItem label="フォーム処理" desc="Action パターンでの CRUD 操作" />
                  <RoleItem label="認証フロー" desc="ログイン / ログアウト / 登録" />
                  <RoleItem label="管理画面 UI" desc="投稿管理、ユーザー管理、Q&A 管理" />
                  <RoleItem label="静的ページ" desc="About、記事一覧、検索、プレゼン" />
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ───────────────── Why Hono ───────────────── */}
        <section className="mb-16">
          <SectionHeader number={3} title="なぜ Hono なのか" />
          <div className="grid gap-6 sm:grid-cols-2">
            <WhyCard
              number={1}
              title="Workers ネイティブ設計"
              desc="Hono は Cloudflare Workers を第一ターゲットとして設計されています。Web Standard API（Request, Response, Headers）をベースにしており、Workers の制約（Node.js API の欠如、V8 Isolates のメモリ制限）を最初から考慮。Express.js や Fastify のような Node.js 依存のフレームワークでは Workers 上で動作しません。"
            />
            <WhyCard
              number={2}
              title="型安全な Cloudflare バインディング"
              desc="c.env.DB、c.env.AI、c.env.R2_BUCKET 等、全ての Cloudflare サービスに TypeScript の型付きでアクセス可能。HonoEnv 型を一度定義すれば、全ルートハンドラで型補完が効き、バインディング名のタイポをコンパイル時に検出できます。"
            />
            <WhyCard
              number={3}
              title="streamSSE による AI ストリーミング"
              desc="Hono の streamSSE ヘルパーにより、AI チャットのストリーミング応答を宣言的に実装。手動での ReadableStream 構築、TextEncoder 操作、SSE フォーマットのエスケープ処理が不要。エラーハンドリングやストリーム終了処理も内蔵されています。"
            />
            <WhyCard
              number={4}
              title="宣言的ミドルウェアスタック"
              desc="認証（optionalAuth / requireAuth / requireRole）、CORS、ロガーをルート単位で宣言的に適用。ミドルウェアの適用順序が明示的で、デバッグが容易。Remix の Loader 内に認証ロジックを散在させる必要がなくなります。"
            />
            <WhyCard
              number={5}
              title="超軽量・高速起動"
              desc="依存ゼロ、バンドルサイズ ~14KB。Workers の起動時間とメモリ消費を最小化し、コールドスタートの影響を事実上ゼロに。Express.js（~500KB+ 依存込み）と比較して桁違いの軽量さ。"
            />
            <WhyCard
              number={6}
              title="Remix との共存が容易"
              desc="Hono アプリを app.fetch() で呼び出せるため、Remix のルートファイルから薄い shim（数行のコード）で統合可能。両フレームワークが同じ Worker プロセス内で動作し、バインディングを共有。段階的な移行や機能追加が容易。"
            />
          </div>
        </section>

        {/* ───────────────── Architecture ───────────────── */}
        <section className="mb-16">
          <SectionHeader number={4} title="アーキテクチャ詳細" />
          <div className="space-y-6">
            <ArchCard
              title="ファイル構成（10 ファイル）"
              items={[
                { label: "app/api/index.ts", desc: "メイン Hono アプリ — CORS、logger、7 モジュールのルートマウント + health check" },
                { label: "app/api/types.ts", desc: "HonoEnv 型定義 — DB, AI, R2, KV, Vectorize 等全 CF バインディングの型" },
                { label: "app/api/middleware.ts", desc: "認証ミドルウェア 3 種 — optionalAuth / requireAuth / requireRole" },
                { label: "app/api/routes/chat.ts", desc: "AI チャット Q&A (239行) — Turnstile→レート制限→モデレーション→RAG→streamSSE" },
                { label: "app/api/routes/ai.ts", desc: "AI ユーティリティ (92行) — タグ提案 / 文章改善 / トレンドレポート" },
                { label: "app/api/routes/templates.ts", desc: "テンプレート API (455行・最大) — 一覧 / 詳細 / test-generate / quick-generate" },
                { label: "app/api/routes/api-keys.ts", desc: "API キー管理 (57行) — 一覧 / 作成 / 無効化 (cfbk_ プレフィックス)" },
                { label: "app/api/routes/upload.ts", desc: "画像アップロード (43行) — multipart → R2 保存 (JPEG/PNG/GIF/WebP/SVG, 10MB上限)" },
                { label: "app/api/routes/r2.ts", desc: "R2 配信 (23行) — Content-Type 付きオブジェクト配信, max-age=1年, immutable" },
                { label: "app/api/routes/ai-guide.ts", desc: "AI ツール向けガイド (118行) — 外部 AI (Gemini/ChatGPT/Claude) 用の完全ガイド" },
              ]}
            />
            <ArchCard
              title="グローバルミドルウェア（app/api/index.ts）"
              items={[
                { label: "logger()", desc: "全リクエストをコンソールにログ出力（メソッド、パス、ステータス、レイテンシ）" },
                { label: "cors()", desc: "/api/* に適用。origin: '*', methods: GET/POST/DELETE/OPTIONS, headers: Content-Type/Authorization" },
              ]}
            />
            <ArchCard
              title="デュアル認証ミドルウェア（app/api/middleware.ts）"
              items={[
                { label: "resolveUser()", desc: "① Authorization: Bearer cfbk_* ヘッダーを優先チェック（SHA-256 で DB 検証）→ ② なければ Session Cookie にフォールバック" },
                { label: "optionalAuth", desc: "ユーザー解決するが認証不要。user = null でも通過（チャット Q&A で使用）" },
                { label: "requireAuth", desc: "認証必須。未認証なら 401 JSON を返却（API キー管理、画像アップロード等）" },
                { label: "requireRole(...roles)", desc: "認証 + ロール検証。admin/se/ae 等を指定。権限不足なら 403 JSON（トレンドレポート、記事生成等）" },
              ]}
            />
            <ArchCard
              title="ルートマウント（app/api/index.ts）"
              items={[
                { label: 'app.route("/api/v1/chat", chat)', desc: "→ routes/chat.ts (GET / POST)" },
                { label: 'app.route("/api/v1/ai", ai)', desc: "→ routes/ai.ts (suggest-tags / improve / trend-report)" },
                { label: 'app.route("/api/upload-image", upload)', desc: "→ routes/upload.ts (POST)" },
                { label: 'app.route("/api/v1/templates", templatesApi)', desc: "→ routes/templates.ts (一覧 / 詳細 / test-generate / quick-generate)" },
                { label: 'app.route("/api/v1/api-keys", apiKeysRoute)', desc: "→ routes/api-keys.ts (一覧 / 作成 / 削除)" },
                { label: 'app.route("/api/v1/ai-guide", aiGuide)', desc: "→ routes/ai-guide.ts (外部AI向けガイド)" },
                { label: 'app.route("/r2", r2)', desc: "→ routes/r2.ts (R2 オブジェクト配信)" },
              ]}
            />
          </div>
        </section>

        {/* ───────────────── Remix-Hono Integration ───────────────── */}
        <section className="mb-16">
          <SectionHeader number={5} title="Remix → Hono 統合パターン — Shim の仕組み" />
          <p className="mb-6 text-sm leading-relaxed text-gray-600">
            Remix が全リクエストの「玄関」として機能し、API リクエストは<strong>薄い shim ファイル（11行）</strong>経由で Hono に転送されます。
            両方とも同じ Workers プロセス内で動作するため、<strong>ネットワーク転送なし・レイテンシゼロ</strong>です。
          </p>
          <div className="space-y-6">
            {/* Flow diagram */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-5 text-base font-bold text-gray-900">リクエストフロー</h3>
              <div className="flex flex-col items-center gap-3">
                <FlowBox color="blue" label="ブラウザ / curl / 外部AIツール" sub="POST /api/v1/chat" />
                <FlowArrow />
                <FlowBox color="gray" label="Remix ルートファイル (Shim)" sub="api.v1.chat.tsx — たった11行" />
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-center text-xs text-amber-800 font-medium">
                  app.fetch(request, context.cloudflare.env)
                </div>
                <FlowArrow />
                <FlowBox color="red" label="Hono アプリ (app/api/index.ts)" sub="logger → CORS → ルートマッチング" />
                <FlowArrow />
                <FlowBox color="red" label="認証ミドルウェア" sub="optionalAuth / requireAuth / requireRole" />
                <FlowArrow />
                <FlowBox color="red" label="ルートハンドラ (routes/chat.ts)" sub="Turnstile→Rate Limit→RAG→streamSSE" />
                <FlowArrow />
                <FlowBox color="green" label="レスポンス返却" sub="JSON / SSE ストリーム / バイナリ" />
              </div>
            </div>

            {/* Shim code example */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-base font-bold text-gray-900">Shim ファイルの中身（全 API 共通パターン）</h3>
              <p className="mb-4 text-sm text-gray-600">
                全 12 個の Remix ルートファイルの中身はほぼ同一 — <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">app.fetch(request, env)</code> を呼ぶだけです。
              </p>
              <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-gray-100">
                <code>{`// app/routes/api.v1.chat.tsx — 典型的な Shim ファイル
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/cloudflare";
import app from "~/api";  // ← Hono アプリをインポート

// GET リクエスト → Hono に丸投げ
export async function loader({ request, context }: LoaderFunctionArgs) {
  return app.fetch(request, context.cloudflare.env);
}

// POST リクエスト → Hono に丸投げ
export async function action({ request, context }: ActionFunctionArgs) {
  return app.fetch(request, context.cloudflare.env);
}`}</code>
              </pre>
            </div>

            {/* File name mapping table */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <h3 className="px-6 py-4 text-base font-bold text-gray-900 border-b bg-gray-50">Remix ファイル名 → URL → Hono ルートの対応表</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-widest text-gray-400">
                    <tr>
                      <th className="px-5 py-2.5">Remix ルートファイル</th>
                      <th className="px-5 py-2.5">URL パス</th>
                      <th className="px-5 py-2.5">Hono 処理先</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    <ShimRow file="api.v1.chat.tsx" url="/api/v1/chat" hono="routes/chat.ts GET & POST" />
                    <ShimRow file="api.v1.ai.suggest-tags.tsx" url="/api/v1/ai/suggest-tags" hono="routes/ai.ts POST /suggest-tags" />
                    <ShimRow file="api.v1.ai.improve.tsx" url="/api/v1/ai/improve" hono="routes/ai.ts POST /improve" />
                    <ShimRow file="api.v1.ai.trend-report.tsx" url="/api/v1/ai/trend-report" hono="routes/ai.ts POST /trend-report" />
                    <ShimRow file="api.v1.templates._index.tsx" url="/api/v1/templates" hono="routes/templates.ts GET /" />
                    <ShimRow file="api.v1.templates.$id.tsx" url="/api/v1/templates/:id" hono="routes/templates.ts GET /:id" />
                    <ShimRow file="api.v1.templates.$id.test-generate.tsx" url="/api/v1/templates/:id/test-generate" hono="routes/templates.ts POST /:id/test-generate" />
                    <ShimRow file="api.v1.templates.quick-generate.tsx" url="/api/v1/templates/quick-generate" hono="routes/templates.ts POST /quick-generate" />
                    <ShimRow file="api.v1.api-keys._index.tsx" url="/api/v1/api-keys" hono="routes/api-keys.ts GET & POST /" />
                    <ShimRow file="api.v1.api-keys.$id.tsx" url="/api/v1/api-keys/:id" hono="routes/api-keys.ts DELETE /:id" />
                    <ShimRow file="api.v1.ai-guide._index.tsx" url="/api/v1/ai-guide" hono="routes/ai-guide.ts GET /" />
                    <ShimRow file="api.upload-image.tsx" url="/api/upload-image" hono="routes/upload.ts POST /" />
                  </tbody>
                </table>
              </div>
            </div>

            <ArchCard
              title="なぜ Shim パターンなのか"
              items={[
                { label: "Remix が玄関", desc: "Cloudflare Pages の場合、全リクエストは Remix のルーターが最初に受ける。直接 Hono に渡す方法がない" },
                { label: "パスエイリアス問題", desc: "functions/api/ に直接 Hono を配置する方式は、wrangler が Vite の ~/ パスエイリアスを解決できないため不採用" },
                { label: "同一プロセス", desc: "Remix と Hono は同じ V8 Isolate 内で動作。app.fetch() は関数呼び出しに過ぎず、HTTP オーバーヘッドはゼロ" },
                { label: "バインディング共有", desc: "context.cloudflare.env を Hono に渡すことで、D1, AI, R2, KV, Vectorize を共有" },
              ]}
            />
          </div>
        </section>

        {/* ───────────────── Without Hono ───────────────── */}
        <section className="mb-16">
          <SectionHeader number={6} title="Hono がなかったら — 発生する課題" />
          <p className="mb-6 text-sm leading-relaxed text-gray-600">
            Hono を使わない場合、以下のような課題が発生し、開発効率とコード品質に大きな影響を与えます。
          </p>
          <div className="space-y-4">
            <ProblemCard
              number={1}
              problem="SSE ストリーミングの手動実装"
              impact="AI チャットの SSE 配信に、ReadableStream の手動構築、TextEncoder の操作、SSE フォーマットの手動エスケープが必要。エラー発生時のストリーム終了処理やバックプレッシャーの制御も自力で実装しなければならず、バグの温床になる。"
              honoSolution="streamSSE ヘルパーが全てを抽象化。宣言的にイベントを送信するだけで、フォーマット・エラー処理・終了処理を自動管理。"
              tips={{
                title: "コード比較で見る差 — streamSSE vs 手動実装",
                content: (
                  <div className="space-y-4">
                    <p className="font-semibold text-gray-900">Hono あり（3行で完結）</p>
                    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs leading-relaxed text-gray-100"><code>{`return streamSSE(c, async (stream) => {
  for await (const chunk of aiResult) {
    await stream.writeSSE({ data: JSON.stringify({ text: chunk }) });
  }
});`}</code></pre>
                    <p className="font-semibold text-gray-900">Hono なし（20行以上 + バグリスク）</p>
                    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs leading-relaxed text-gray-100"><code>{`const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    try {
      for await (const chunk of aiResult) {
        // SSE フォーマットを毎回手動構築
        const data = \`data: \${JSON.stringify({ text: chunk })}\\n\\n\`;
        controller.enqueue(encoder.encode(data));
      }
      controller.enqueue(encoder.encode("data: [DONE]\\n\\n"));
    } catch (e) {
      controller.error(e); // エラー時の cleanup は？
    } finally {
      controller.close();  // 二重 close で例外の可能性
    }
  }
});
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  }
});`}</code></pre>
                    <p>手動実装では <strong>SSE フォーマットの改行ルール（\\n\\n）</strong>、<strong>encoder の生成</strong>、<strong>ストリーム終了・エラー処理</strong>を全て自分で管理する必要があります。streamSSE はこの全てを内部で正しく処理します。</p>
                  </div>
                ),
              }}
            />
            <ProblemCard
              number={2}
              problem="バインディングの型安全性の喪失"
              impact="Remix の loader/action 内で context.cloudflare.env.DB のように毎回アクセスする必要があり、タイポしても実行時まで気づけない。複数のエンドポイントで同じバインディングにアクセスするコードが散在し、型定義の一元管理ができない。"
              honoSolution="HonoEnv 型を一度定義すれば、c.env.DB で全ルートから型安全にアクセス。IDE の補完が効き、タイポをコンパイル時に検出。"
              tips={{
                title: "型安全の威力 — IDE 補完とコンパイル時エラー検出",
                content: (
                  <div className="space-y-4">
                    <p className="font-semibold text-gray-900">型安全あり — タイポを書いた瞬間にエラー</p>
                    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs leading-relaxed text-gray-100"><code>{`// c.env. と打った瞬間、IDE が候補を表示:
//   DB           D1Database
//   AI           Ai
//   R2_BUCKET    R2Bucket
//   PAGE_CACHE   KVNamespace
//   VECTORIZE    VectorizeIndex  ...

const db = c.env.DB;         // ✅ D1Database 型と認識
const ai = c.env.AI;         // ✅ Ai 型と認識

const x = c.env.DATABSE;     // ❌ コンパイルエラー！
// Property 'DATABSE' does not exist on type 'Bindings'
// → 'DB' のタイポを即座に検出`}</code></pre>
                    <p className="font-semibold text-gray-900">型安全なし — 本番で初めて気づく</p>
                    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs leading-relaxed text-gray-100"><code>{`// env は any 型 → 何でも書ける
const db = env.DATABSE;       // ← コンパイルは通る！
//  実行時: undefined → TypeError: Cannot read properties of undefined

const ai = env.AI;
await ai.run(model, {
  mesages: [...]              // ← messages のスペルミス。コンパイル通る！
});  //  実行時: AI が空のプロンプトで推論 → 謎の出力`}</code></pre>
                    <p>このブログには <strong>Cloudflare バインディングが 14 個</strong>あり、7 モジュールからアクセスされます。型安全がなければ <strong>98 箇所</strong>でタイポの可能性が生まれ、そのうち 1 つでも間違えれば本番障害になります。</p>
                  </div>
                ),
              }}
            />
            <ProblemCard
              number={3}
              problem="認証ミドルウェアの重複"
              impact="各 Remix ルートの loader/action 内で認証チェックを個別に実装する必要がある。認証ロジックの変更時に全ファイルを修正する必要があり、チェック漏れのリスクが高い。API と UI で異なる認証パターンの管理も困難。"
              honoSolution="optionalAuth / requireAuth / requireRole ミドルウェアをルートグループに一括適用。認証ロジックの変更は 1 ファイルで完結。"
              tips={{
                title: "認証パターンの比較 — 1箇所 vs 全ファイル",
                content: (
                  <div className="space-y-4">
                    <p className="font-semibold text-gray-900">Hono あり — ルート定義に宣言するだけ</p>
                    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs leading-relaxed text-gray-100"><code>{`// Bearer トークン or Session Cookie を自動判別
ai.post("/suggest-tags", requireAuth, handler);
ai.post("/trend-report", requireRole("admin", "se"), handler);
chat.post("/", optionalAuth, handler);  // 認証なしでも OK

// 認証ロジックの変更は middleware.ts の 1 ファイルだけ
// → 全 16 エンドポイントに自動反映`}</code></pre>
                    <p className="font-semibold text-gray-900">Hono なし — 全ファイルにコピペ</p>
                    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs leading-relaxed text-gray-100"><code>{`// api.v1.ai.suggest-tags.tsx
export async function action({ request, context }) {
  const user = await getSessionUser(request);
  if (!user) return json({ error: "認証が必要です" }, 401);
  // ... 本体ロジック
}

// api.v1.ai.improve.tsx  ← 同じコードをコピペ
// api.v1.ai.trend-report.tsx  ← さらにロール判定も追加
// api.v1.templates._index.tsx  ← ...
// (12 ファイル全てに同じ認証コードを書く)`}</code></pre>
                    <p>Bearer トークン認証を後から追加する場合、Hono なら <strong>resolveUser() を 1 箇所修正</strong>するだけ。Hono なしなら <strong>12 ファイル全てを修正</strong>し、1 つでも漏れれば認証バイパスの脆弱性になります。</p>
                  </div>
                ),
              }}
            />
            <ProblemCard
              number={4}
              problem="API ルーティングの煩雑さ"
              impact="Remix のファイルベースルーティングでは api.v1.ai.suggest-tags.tsx のような長いファイル名が必要。各ファイルに loader/action のボイラープレートが発生し、RESTful なルート設計が困難。CORS 設定も各ルートに個別適用が必要。"
              honoSolution="app.post('/ai/suggest-tags', handler) のように直感的にルートを定義。CORS・ロガーはアプリ全体に一括適用。"
              tips={{
                title: "ルーティングの比較 — 1ファイル vs 12ファイル",
                content: (
                  <div className="space-y-4">
                    <p className="font-semibold text-gray-900">Hono あり — 1 ファイルで全体像が見える</p>
                    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs leading-relaxed text-gray-100"><code>{`// app/api/index.ts — 全 API の一覧がここに集約
app.use("*", logger());
app.use("/api/*", cors({ origin: "*" }));

app.route("/api/v1/chat",      chat);       // 2 routes
app.route("/api/v1/ai",        ai);         // 3 routes
app.route("/api/v1/templates",  templates);  // 4 routes
app.route("/api/v1/api-keys",   apiKeys);    // 3 routes
app.route("/api/v1/ai-guide",   aiGuide);    // 1 route
app.route("/api/upload-image",  upload);      // 1 route
app.route("/r2",                r2);          // 1 route
app.get("/api/health", (c) => c.json({ status: "ok" }));`}</code></pre>
                    <p className="font-semibold text-gray-900">Hono なし — 12 個のファイルがフォルダに散在</p>
                    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs leading-relaxed text-gray-100"><code>{`app/routes/
  api.v1.chat.tsx
  api.v1.ai.suggest-tags.tsx
  api.v1.ai.improve.tsx
  api.v1.ai.trend-report.tsx
  api.v1.templates._index.tsx
  api.v1.templates.$id.tsx
  api.v1.templates.$id.test-generate.tsx
  api.v1.templates.quick-generate.tsx
  api.v1.api-keys._index.tsx
  api.v1.api-keys.$id.tsx
  api.v1.ai-guide._index.tsx
  api.upload-image.tsx
// → 全体像を把握するにはフォルダを眺めるしかない
// → CORS を追加するには 12 ファイル全てに設定`}</code></pre>
                  </div>
                ),
              }}
            />
            <ProblemCard
              number={5}
              problem="エラーハンドリングの分散"
              impact="各 API エンドポイントで try-catch を個別に実装し、エラーレスポンスのフォーマット統一が困難。ログ出力の一貫性も保てない。"
              honoSolution="Hono の onError ハンドラでグローバルなエラー処理を一元化。全 API に統一されたエラーレスポンスフォーマットを適用。"
              tips={{
                title: "エラー処理の比較 — 一元管理 vs 各ファイル",
                content: (
                  <div className="space-y-4">
                    <p className="font-semibold text-gray-900">Hono あり — グローバルハンドラで統一</p>
                    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs leading-relaxed text-gray-100"><code>{`// app/api/index.ts — 全 API に適用
app.onError((err, c) => {
  console.error(\`[API Error] \${c.req.method} \${c.req.path}\`, err);
  return c.json({
    error: err.message || "Internal Server Error"
  }, 500);
});

// 各ルートハンドラでは例外を throw するだけ
// → フォーマット・ログは自動で統一`}</code></pre>
                    <p className="font-semibold text-gray-900">Hono なし — 各ファイルで try-catch</p>
                    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs leading-relaxed text-gray-100"><code>{`// api.v1.ai.suggest-tags.tsx
try {
  const tags = await suggestTags(ai, content);
  return json({ tags });
} catch (e) {
  console.error(e);  // ← ログフォーマットがファイルによってバラバラ
  return json({ error: e.message }, 500);
  // ← あるファイルでは { error: "..." }
  // ← 別のファイルでは { message: "..." }
  // ← また別のファイルでは { err: "..." }
}`}</code></pre>
                    <p>API クライアント側は「エラーフィールドが <code className="rounded bg-gray-200 px-1 py-0.5 text-xs">error</code> なのか <code className="rounded bg-gray-200 px-1 py-0.5 text-xs">message</code> なのか」をエンドポイントごとに気にする必要がなくなります。</p>
                  </div>
                ),
              }}
            />
            <ProblemCard
              number={6}
              problem="テスト・開発効率の低下"
              impact="Remix のルートファイルは Worker 環境に依存するため、単体テストが困難。API ロジックが UI フレームワークに密結合し、将来のフレームワーク移行時にAPI 層を切り離せない。"
              honoSolution="Hono アプリは独立してテスト可能（app.request() でテスト）。UI フレームワークから完全に分離された API 層を維持。"
              tips={{
                title: "テスト容易性の比較 — app.request() vs Worker環境依存",
                content: (
                  <div className="space-y-4">
                    <p className="font-semibold text-gray-900">Hono あり — Worker 環境なしでテスト可能</p>
                    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs leading-relaxed text-gray-100"><code>{`// テストファイル（Vitest等）
import app from "./api";

test("health check", async () => {
  const res = await app.request("/api/health");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
});

test("unauthorized access returns 401", async () => {
  const res = await app.request("/api/v1/ai/suggest-tags", {
    method: "POST",
    body: JSON.stringify({ content: "test" }),
  });
  expect(res.status).toBe(401);
});`}</code></pre>
                    <p className="font-semibold text-gray-900">Hono なし — Remix + Worker 環境が必要</p>
                    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs leading-relaxed text-gray-100"><code>{`// Remix ルートのテストには以下が必要:
// 1. miniflare or wrangler dev でローカル Worker 起動
// 2. D1, KV, R2 のモックバインディング準備
// 3. Remix の loader/action コンテキストの構築
// 4. セッションクッキーの手動生成
// → テスト 1 件書くだけで 30 行以上のセットアップ`}</code></pre>
                    <p>Hono アプリは <strong>UI フレームワーク（Remix）から完全に独立</strong>しているため、将来 Remix から別フレームワーク（Next.js, SvelteKit 等）に移行しても、<strong>API 層はそのまま再利用</strong>できます。</p>
                  </div>
                ),
              }}
            />
          </div>
        </section>

        {/* ───────────────── Code Examples ───────────────── */}
        <section className="mb-16">
          <SectionHeader number={7} title="コード比較 — Hono あり vs なし" />
          <div className="grid gap-6 sm:grid-cols-2">
            <CodeCompare
              title="Hono あり（現在の実装）"
              good
              code={`// app/api/routes/chat.ts
app.post('/chat', requireAuth, async (c) => {
  const { message, context } = await c.req.json()
  
  return streamSSE(c, async (stream) => {
    const ai = c.env.AI
    const result = await ai.run(model, {
      messages, stream: true
    })
    
    for await (const chunk of result) {
      await stream.writeSSE({
        data: JSON.stringify({ token: chunk })
      })
    }
  })
})`}
            />
            <CodeCompare
              title="Hono なし（代替実装）"
              good={false}
              code={`// app/routes/api.v1.chat.tsx
export async function action({ request, context }) {
  // 認証チェックを毎回手動で実装
  const user = await requireUser(request)
  if (!user) return json({ error: "..." }, 401)
  
  const { message } = await request.json()
  const ai = context.cloudflare.env.AI
  
  // ReadableStream を手動構築
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        const result = await ai.run(model, {
          messages, stream: true
        })
        for await (const chunk of result) {
          // SSE フォーマットを手動で構築
          const data = \`data: \${JSON.stringify({
            token: chunk
          })}\\n\\n\`
          controller.enqueue(encoder.encode(data))
        }
        controller.enqueue(
          encoder.encode("data: [DONE]\\n\\n")
        )
      } catch (e) {
        controller.error(e)
      } finally {
        controller.close()
      }
    }
  })
  // Headers も手動設定
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    }
  })
}`}
            />
          </div>
        </section>

        {/* ───────────────── API Endpoints ───────────────── */}
        <section className="mb-16">
          <SectionHeader number={8} title="全 API エンドポイント一覧（7 モジュール / 16 routes）" />
          <div className="space-y-6">
            {/* Chat */}
            <EndpointModule
              name="Chat"
              file="routes/chat.ts"
              lines={239}
              rows={[
                { method: "GET", path: "/api/v1/chat", desc: "スレッドのメッセージ一覧取得（期限切れスレッド自動削除）", auth: "任意", services: "D1" },
                { method: "POST", path: "/api/v1/chat", desc: "メッセージ送信 + AI 応答の SSE ストリーミング", auth: "任意", services: "AI, D1, KV, Vectorize" },
              ]}
              note="POST は 9段階パイプライン: Turnstile検証 → 入力バリデーション → KVレート制限(10msg/min/IP) → Llama Guard モデレーション → 記事取得 → メッセージ保存 → 会話履歴(直近20件) → RAG(Vectorize topK:3) → streamSSE(Llama 3.3 70B)"
            />
            {/* AI */}
            <EndpointModule
              name="AI"
              file="routes/ai.ts"
              lines={92}
              rows={[
                { method: "POST", path: "/api/v1/ai/suggest-tags", desc: "記事内容から AI タグ候補を提案", auth: "必須", services: "AI" },
                { method: "POST", path: "/api/v1/ai/improve", desc: "テキストの文章改善", auth: "必須", services: "AI" },
                { method: "POST", path: "/api/v1/ai/trend-report", desc: "直近30日の記事からトレンドレポート生成（KV 24hキャッシュ）", auth: "admin/se/ae", services: "AI, D1, KV" },
              ]}
            />
            {/* Templates */}
            <EndpointModule
              name="Templates"
              file="routes/templates.ts"
              lines={455}
              rows={[
                { method: "GET", path: "/api/v1/templates", desc: "全アクティブテンプレート一覧", auth: "必須", services: "D1" },
                { method: "GET", path: "/api/v1/templates/:id", desc: "テンプレート詳細 + フィールド定義", auth: "必須", services: "D1" },
                { method: "POST", path: "/api/v1/templates/:id/test-generate", desc: "ダミー入力AI生成 → 記事生成 → 下書き保存", auth: "admin/se/ae", services: "AI, D1" },
                { method: "POST", path: "/api/v1/templates/quick-generate", desc: "トピックだけで一括生成（テンプレート自動選択）", auth: "admin/se/ae", services: "AI, D1" },
              ]}
              note="test-generate: tone パラメータで realistic/casual/detailed/minimal を切り替え。quick-generate: トピックキーワード → テンプレート自動マッチ → 入力自動生成 → 記事作成を一括実行"
            />
            {/* API Keys */}
            <EndpointModule
              name="API Keys"
              file="routes/api-keys.ts"
              lines={57}
              rows={[
                { method: "GET", path: "/api/v1/api-keys", desc: "自分の API キー一覧", auth: "必須", services: "D1" },
                { method: "POST", path: "/api/v1/api-keys", desc: "新規キー作成（1ユーザー1キー制限、cfbk_ プレフィックス）", auth: "必須", services: "D1" },
                { method: "DELETE", path: "/api/v1/api-keys/:id", desc: "キー無効化", auth: "必須", services: "D1" },
              ]}
            />
            {/* Upload */}
            <EndpointModule
              name="Upload"
              file="routes/upload.ts"
              lines={43}
              rows={[
                { method: "POST", path: "/api/upload-image", desc: "画像を R2 にアップロード（JPEG/PNG/GIF/WebP/SVG, 10MB上限）", auth: "必須", services: "R2" },
              ]}
            />
            {/* R2 */}
            <EndpointModule
              name="R2"
              file="routes/r2.ts"
              lines={23}
              rows={[
                { method: "GET", path: "/r2/*", desc: "R2 オブジェクト配信（Cache-Control: max-age=1年, immutable）", auth: "不要", services: "R2" },
              ]}
            />
            {/* AI Guide */}
            <EndpointModule
              name="AI Guide"
              file="routes/ai-guide.ts"
              lines={118}
              rows={[
                { method: "GET", path: "/api/v1/ai-guide", desc: "外部AI向け完全ガイド（全テンプレ+フィールド+curl例を1レスポンス）", auth: "必須", services: "D1" },
              ]}
              note="ロールが admin/se の場合は quick-generate / test-generate API の使い方も含む"
            />
            {/* Health */}
            <EndpointModule
              name="Health"
              file="index.ts"
              lines={1}
              rows={[
                { method: "GET", path: "/api/health", desc: "ヘルスチェック", auth: "不要", services: "—" },
              ]}
            />
          </div>

          {/* CF Bindings summary */}
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-bold text-gray-900">使用 Cloudflare バインディング一覧</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <BindingCard name="DB (D1)" usage="chat, ai, templates, api-keys, ai-guide" />
              <BindingCard name="AI (Workers AI)" usage="chat, ai, templates" />
              <BindingCard name="R2_BUCKET" usage="upload, r2" />
              <BindingCard name="PAGE_CACHE (KV)" usage="chat (レート制限), ai (レポートキャッシュ)" />
              <BindingCard name="VECTORIZE" usage="chat (RAG コンテキスト)" />
              <BindingCard name="TURNSTILE_SECRET_KEY" usage="chat (Bot 保護)" />
            </div>
          </div>
        </section>

        {/* ───────────────── Navigation ───────────────── */}
        <div className="flex flex-wrap gap-4 print:hidden">
          <Link
            to="/admin/presentation"
            className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            ← プレゼンに戻る
          </Link>
          <Link
            to="/admin/presentation/stack"
            className="rounded-xl bg-gray-800 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-gray-700 transition-colors"
          >
            技術スタック詳細 →
          </Link>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-xs text-gray-400 print:hidden">
          <p>Admin 専用 — Hono 詳細</p>
        </footer>
      </main>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function HeroBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
      {children}
    </span>
  );
}

function SectionHeader({ number, title }: { number: number; title: string }) {
  return (
    <div className="mb-8 flex items-center gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-sm font-bold text-red-700">
        {number}
      </span>
      <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-4 text-center">
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}

function RoleItem({ label, desc }: { label: string; desc: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
      <div>
        <span className="text-sm font-semibold text-gray-900">{label}</span>
        <span className="ml-1.5 text-xs text-gray-500">{desc}</span>
      </div>
    </li>
  );
}

function WhyCard({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/40 p-6">
      <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-xs font-bold text-red-600">
        {number}
      </span>
      <h3 className="mb-2 text-base font-bold text-gray-900">{title}</h3>
      <p className="text-sm leading-relaxed text-gray-700">{desc}</p>
    </div>
  );
}

function ProblemCard({
  number,
  problem,
  impact,
  honoSolution,
  tips,
}: {
  number: number;
  problem: string;
  impact: string;
  honoSolution: string;
  tips?: { title: string; content: React.ReactNode };
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-500">
          {number}
        </span>
        <h3 className="text-base font-bold text-gray-900">{problem}</h3>
      </div>
      <div className="mb-4 rounded-xl bg-red-50 border border-red-100 p-4">
        <h4 className="mb-1 text-xs font-bold text-red-700">Hono なしの場合の影響</h4>
        <p className="text-sm leading-relaxed text-gray-700">{impact}</p>
      </div>
      <div className="rounded-xl bg-green-50 border border-green-100 p-4">
        <h4 className="mb-1 text-xs font-bold text-green-700">Hono による解決</h4>
        <p className="text-sm leading-relaxed text-gray-700">{honoSolution}</p>
      </div>
      {tips && (
        <details className="group mt-4">
          <summary className="flex cursor-pointer items-center gap-2 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm font-semibold text-blue-800 transition-colors hover:bg-blue-100 [&::-webkit-details-marker]:hidden">
            <svg className="h-4 w-4 shrink-0 text-blue-500 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            {tips.title}
          </summary>
          <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 p-5 text-sm leading-relaxed text-gray-700">
            {tips.content}
          </div>
        </details>
      )}
    </div>
  );
}

function CodeCompare({ title, good, code }: { title: string; good: boolean; code: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${good ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30"}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`text-lg ${good ? "text-green-600" : "text-red-500"}`}>
          {good ? "✓" : "✗"}
        </span>
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-gray-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ArchCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; desc: string }[];
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-bold text-gray-900">{title}</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-3 text-sm">
            <code className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-700">
              {item.label}
            </code>
            <span className="text-gray-600">{item.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowBox({
  color,
  label,
  sub,
}: {
  color: "blue" | "gray" | "red" | "green";
  label: string;
  sub: string;
}) {
  const styles = {
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    gray: "border-gray-200 bg-gray-50 text-gray-900",
    red: "border-red-200 bg-red-50 text-red-900",
    green: "border-green-200 bg-green-50 text-green-900",
  };
  return (
    <div className={`w-full max-w-md rounded-xl border px-5 py-3 text-center ${styles[color]}`}>
      <p className="text-sm font-bold">{label}</p>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="text-gray-300">
      <svg className="mx-auto h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    </div>
  );
}

function ShimRow({ file, url, hono }: { file: string; url: string; hono: string }) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-5 py-2 font-mono text-gray-700">{file}</td>
      <td className="px-5 py-2 font-mono font-semibold text-gray-900">{url}</td>
      <td className="px-5 py-2 text-gray-600">{hono}</td>
    </tr>
  );
}

function EndpointModule({
  name,
  file,
  lines,
  rows,
  note,
}: {
  name: string;
  file: string;
  lines: number;
  rows: { method: string; path: string; desc: string; auth: string; services: string }[];
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b bg-gray-50 px-5 py-3">
        <h3 className="text-sm font-bold text-gray-900">{name}</h3>
        <div className="flex items-center gap-2">
          <code className="rounded bg-gray-200 px-2 py-0.5 text-[10px] font-mono text-gray-600">{file}</code>
          <span className="text-[10px] text-gray-400">{lines} lines</span>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <tr>
            <th className="px-5 py-2">メソッド</th>
            <th className="px-5 py-2">パス</th>
            <th className="px-5 py-2">機能</th>
            <th className="px-5 py-2">認証</th>
            <th className="px-5 py-2">CF サービス</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={`${row.method}-${row.path}`} className="hover:bg-gray-50 transition-colors">
              <td className="px-5 py-2.5">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  row.method === "GET" ? "bg-blue-100 text-blue-700"
                  : row.method === "POST" ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
                }`}>
                  {row.method}
                </span>
              </td>
              <td className="px-5 py-2.5 font-mono text-xs text-gray-700">{row.path}</td>
              <td className="px-5 py-2.5 text-xs text-gray-600">{row.desc}</td>
              <td className="px-5 py-2.5 text-xs text-gray-500">{row.auth}</td>
              <td className="px-5 py-2.5 text-xs text-gray-500">{row.services}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {note && (
        <div className="border-t bg-amber-50 px-5 py-2.5">
          <p className="text-[11px] leading-relaxed text-amber-800">{note}</p>
        </div>
      )}
    </div>
  );
}

function BindingCard({ name, usage }: { name: string; usage: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <p className="text-xs font-bold text-gray-900">{name}</p>
      <p className="mt-1 text-[11px] text-gray-500">{usage}</p>
    </div>
  );
}
