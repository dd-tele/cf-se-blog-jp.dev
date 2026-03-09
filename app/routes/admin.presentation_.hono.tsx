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
              Cloudflare Solution Blog
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
              title="ファイル構成"
              items={[
                { label: "app/api/index.ts", desc: "メイン Hono アプリ — CORS、ロガー、ルートマウント" },
                { label: "app/api/types.ts", desc: "HonoEnv 型定義 — 全 CF バインディングの型" },
                { label: "app/api/middleware.ts", desc: "認証ミドルウェア — optionalAuth / requireAuth / requireRole" },
                { label: "app/api/routes/chat.ts", desc: "AI チャット Q&A — streamSSE + Llama 3.3 70B" },
                { label: "app/api/routes/ai.ts", desc: "AI 機能 — タグ提案 / 文章改善 / トレンドレポート" },
                { label: "app/api/routes/upload.ts", desc: "画像アップロード — R2 への保存" },
                { label: "app/api/routes/r2.ts", desc: "R2 配信 — オブジェクトの Content-Type 付き配信" },
              ]}
            />
            <ArchCard
              title="Remix 統合パターン"
              items={[
                { label: "Remix ルートファイル", desc: "app/routes/api.v1.chat.tsx 等の薄い shim" },
                { label: "統合方法", desc: "loader / action で app.fetch(request, context.cloudflare.env) を呼び出し" },
                { label: "パスエイリアス", desc: "Vite の vite-tsconfig-paths で ~/ インポートを解決" },
                { label: "理由", desc: "functions/api/ に直接配置する方式は wrangler が Vite パスエイリアスを解決できないため不採用" },
              ]}
            />
            <ArchCard
              title="AI チャットの処理フロー"
              items={[
                { label: "1. リクエスト受信", desc: "POST /api/v1/chat — message + articleContext" },
                { label: "2. コンテンツモデレーション", desc: "Llama Guard 3 8B で入力をスキャン → 不適切なら拒否" },
                { label: "3. システムプロンプト構築", desc: "記事コンテンツをコンテキストとして注入 + グラウンディングルール" },
                { label: "4. AI 推論", desc: "Llama 3.3 70B FP8 に streaming: true でリクエスト" },
                { label: "5. SSE ストリーミング", desc: "streamSSE でトークンをリアルタイム配信" },
                { label: "6. 完了", desc: "[DONE] イベントでストリーム終了" },
              ]}
            />
          </div>
        </section>

        {/* ───────────────── Without Hono ───────────────── */}
        <section className="mb-16">
          <SectionHeader number={5} title="Hono がなかったら — 発生する課題" />
          <p className="mb-6 text-sm leading-relaxed text-gray-600">
            Hono を使わない場合、以下のような課題が発生し、開発効率とコード品質に大きな影響を与えます。
          </p>
          <div className="space-y-4">
            <ProblemCard
              number={1}
              problem="SSE ストリーミングの手動実装"
              impact="AI チャットの SSE 配信に、ReadableStream の手動構築、TextEncoder の操作、SSE フォーマットの手動エスケープが必要。エラー発生時のストリーム終了処理やバックプレッシャーの制御も自力で実装しなければならず、バグの温床になる。"
              honoSolution="streamSSE ヘルパーが全てを抽象化。宣言的にイベントを送信するだけで、フォーマット・エラー処理・終了処理を自動管理。"
            />
            <ProblemCard
              number={2}
              problem="バインディングの型安全性の喪失"
              impact="Remix の loader/action 内で context.cloudflare.env.DB のように毎回アクセスする必要があり、タイポしても実行時まで気づけない。複数のエンドポイントで同じバインディングにアクセスするコードが散在し、型定義の一元管理ができない。"
              honoSolution="HonoEnv 型を一度定義すれば、c.env.DB で全ルートから型安全にアクセス。IDE の補完が効き、タイポをコンパイル時に検出。"
            />
            <ProblemCard
              number={3}
              problem="認証ミドルウェアの重複"
              impact="各 Remix ルートの loader/action 内で認証チェックを個別に実装する必要がある。認証ロジックの変更時に全ファイルを修正する必要があり、チェック漏れのリスクが高い。API と UI で異なる認証パターンの管理も困難。"
              honoSolution="optionalAuth / requireAuth / requireRole ミドルウェアをルートグループに一括適用。認証ロジックの変更は 1 ファイルで完結。"
            />
            <ProblemCard
              number={4}
              problem="API ルーティングの煩雑さ"
              impact="Remix のファイルベースルーティングでは api.v1.ai.suggest-tags.tsx のような長いファイル名が必要。各ファイルに loader/action のボイラープレートが発生し、RESTful なルート設計が困難。CORS 設定も各ルートに個別適用が必要。"
              honoSolution="app.post('/ai/suggest-tags', handler) のように直感的にルートを定義。CORS・ロガーはアプリ全体に一括適用。"
            />
            <ProblemCard
              number={5}
              problem="エラーハンドリングの分散"
              impact="各 API エンドポイントで try-catch を個別に実装し、エラーレスポンスのフォーマット統一が困難。ログ出力の一貫性も保てない。"
              honoSolution="Hono の onError ハンドラでグローバルなエラー処理を一元化。全 API に統一されたエラーレスポンスフォーマットを適用。"
            />
            <ProblemCard
              number={6}
              problem="テスト・開発効率の低下"
              impact="Remix のルートファイルは Worker 環境に依存するため、単体テストが困難。API ロジックが UI フレームワークに密結合し、将来のフレームワーク移行時にAPI 層を切り離せない。"
              honoSolution="Hono アプリは独立してテスト可能（app.request() でテスト）。UI フレームワークから完全に分離された API 層を維持。"
            />
          </div>
        </section>

        {/* ───────────────── Code Examples ───────────────── */}
        <section className="mb-16">
          <SectionHeader number={6} title="コード比較 — Hono あり vs なし" />
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
          <SectionHeader number={7} title="API エンドポイント一覧" />
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-widest text-gray-400">
                <tr>
                  <th className="px-6 py-3">メソッド</th>
                  <th className="px-6 py-3">パス</th>
                  <th className="px-6 py-3">機能</th>
                  <th className="px-6 py-3">認証</th>
                  <th className="px-6 py-3">CF サービス</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <EndpointRow method="POST" path="/api/v1/chat" desc="AI チャット Q&A (SSE)" auth="任意" services="AI, Vectorize" />
                <EndpointRow method="POST" path="/api/v1/ai/suggest-tags" desc="タグ提案" auth="必須" services="AI" />
                <EndpointRow method="POST" path="/api/v1/ai/improve" desc="文章改善" auth="必須" services="AI" />
                <EndpointRow method="POST" path="/api/v1/ai/trend-report" desc="トレンドレポート" auth="Admin" services="AI, D1" />
                <EndpointRow method="POST" path="/api/upload-image" desc="画像アップロード" auth="必須" services="R2" />
                <EndpointRow method="GET" path="/r2/*" desc="R2 オブジェクト配信" auth="不要" services="R2" />
                <EndpointRow method="GET" path="/api/health" desc="ヘルスチェック" auth="不要" services="—" />
              </tbody>
            </table>
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
}: {
  number: number;
  problem: string;
  impact: string;
  honoSolution: string;
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

function EndpointRow({
  method,
  path,
  desc,
  auth,
  services,
}: {
  method: string;
  path: string;
  desc: string;
  auth: string;
  services: string;
}) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-3">
        <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold text-green-400">
          {method}
        </span>
      </td>
      <td className="px-6 py-3 font-mono text-xs text-gray-700">{path}</td>
      <td className="px-6 py-3 text-gray-600">{desc}</td>
      <td className="px-6 py-3 text-gray-500">{auth}</td>
      <td className="px-6 py-3">
        <span className="text-xs text-gray-500">{services}</span>
      </td>
    </tr>
  );
}
