import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { requireRole } from "~/lib/auth.server";
import { getDb } from "~/lib/db.server";
import { posts, users, qaThreads, qaMessages, aiDraftRequests, templates } from "~/db/schema";
import { count, eq, sql } from "drizzle-orm";

export const meta: MetaFunction = () => [
  { title: "プレゼンテーション — Cloudflare Solution Blog" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireRole(request, ["admin"]);
  const db = context.cloudflare.env.DB;
  const d = getDb(db);

  // Gather live stats for the presentation
  const [postStats, userStats, threadStats, draftStats, templateCount] =
    await Promise.all([
      d
        .select({
          total: count(),
          published: sql<number>`SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END)`,
          draft: sql<number>`SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END)`,
          totalViews: sql<number>`SUM(view_count)`,
        })
        .from(posts)
        .get(),
      d.select({ total: count() }).from(users).get(),
      d
        .select({
          total: count(),
          active: sql<number>`SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)`,
        })
        .from(qaThreads)
        .get(),
      d
        .select({
          total: count(),
          completed: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
        })
        .from(aiDraftRequests)
        .get(),
      d.select({ total: count() }).from(templates).get(),
    ]);

  return {
    user,
    stats: {
      posts: postStats ?? { total: 0, published: 0, draft: 0, totalViews: 0 },
      users: userStats ?? { total: 0 },
      threads: threadStats ?? { total: 0, active: 0 },
      drafts: draftStats ?? { total: 0, completed: 0 },
      templates: templateCount?.total ?? 0,
    },
  };
}

export default function AdminPresentation() {
  const { user, stats } = useLoaderData<typeof loader>();

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
            <nav className="flex items-center gap-4 text-sm">
              <Link to="/admin" className="text-gray-500 hover:text-gray-700">
                投稿管理
              </Link>
              <Link to="/admin/access-requests" className="text-gray-500 hover:text-gray-700">
                投稿者申請
              </Link>
              <Link to="/admin/users" className="text-gray-500 hover:text-gray-700">
                ユーザー管理
              </Link>
              <Link to="/admin/ai-insights" className="text-gray-500 hover:text-gray-700">
                AI インサイト
              </Link>
              <Link to="/admin/qa" className="text-gray-500 hover:text-gray-700">
                Q&A 管理
              </Link>
              <Link to="/admin/presentation" className="font-medium text-brand-600">
                プレゼン
              </Link>
              <Link to="/admin/template-api" className="text-gray-500 hover:text-gray-700">
                Template API
              </Link>
              <Link to="/portal" className="text-gray-500 hover:text-gray-700">
                ポータル
              </Link>
            </nav>
          </div>
          <span className="text-sm text-gray-500">{user.displayName}</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* ───────────────── Slide 1: Title ───────────────── */}
        <section className="slide mb-16 rounded-3xl bg-gradient-to-br from-[#FBAD41] via-[#F6821F] to-[#E04E16] p-12 text-white shadow-xl sm:p-16">
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-white/70">
            Cloudflare Solution Engineering
          </p>
          <h1 className="mb-6 text-4xl font-extrabold leading-tight sm:text-5xl">
            Solution Blog Platform
          </h1>
          <p className="mb-8 max-w-2xl text-lg leading-relaxed text-white/85">
            SE が持つ技術ナレッジを、AI の力で効率よく記事化し、
            チーム全体の技術力とお客様への価値を高めるプラットフォーム。
          </p>
          <div className="flex flex-wrap gap-3">
            <Badge>100% Cloudflare Stack</Badge>
            <Badge>Hono + Remix</Badge>
            <Badge>Workers AI (Llama 3.3 70B)</Badge>
            <Badge>RAG Chat Q&A</Badge>
            <Badge>Semantic Search</Badge>
            <Badge>Email Workers</Badge>
            <Badge>Personal API Keys</Badge>
            <Badge>Author Profiles</Badge>
            <Badge>API Shield</Badge>
            <Badge>Turnstile</Badge>
            <Badge>AI Gateway</Badge>
          </div>
        </section>

        {/* ───────────────── Slide 2: Why ───────────────── */}
        <section className="slide mb-16">
          <SlideHeader number={1} title="このブログが目指す課題解決" />
          <div className="grid gap-6 sm:grid-cols-2">
            <ProblemCard
              number={1}
              problem="事例や実際の現場での実装例を検索する労力が大きい"
              solution="ブログとして公開し、キーワード＋セマンティック検索で事例をすぐに発見。AI チャットで追加の質問にもリアルタイム対応。"
            />
            <ProblemCard
              number={2}
              problem="記事化に時間がかかる"
              solution="テンプレート + AI ドラフト生成で、メモ書きレベルの入力から記事を自動作成。"
            />
            <ProblemCard
              number={3}
              problem="エンジニア同士の接点が限られている"
              solution="投稿者や会社のアウェアネスを高め、エンジニア同士の接点を創出。新たな試みの参考や共有の場に。"
            />
            <ProblemCard
              number={4}
              problem="技術共有やイベント情報が分散している"
              solution="コミュニティイベントや Cloudflare 主催イベントのハブとなるプラットフォームを目指す。"
            />
          </div>
        </section>

        {/* ───────────────── Slide 3: Design Philosophy ───────────────── */}
        <section className="slide mb-16">
          <SlideHeader number={2} title="設計思想" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PhilosophyCard
              number={1}
              title="Better Internet"
              desc="Cloudflare のミッションを体現するプラットフォーム"
            />
            <PhilosophyCard
              number={2}
              title="Blog as a Work"
              desc="ブログ執筆は業務の一環。テンプレートで敷居を下げる"
            />
            <PhilosophyCard
              number={3}
              title="Engineer Engagement"
              desc="SE 同士の知見共有とお客様との接点を強化"
            />
            <PhilosophyCard
              number={4}
              title="Easy Publication"
              desc="AI がドラフトを生成、ワンクリックで公開"
            />
          </div>
        </section>

        {/* ───────────────── Slide 4: Live Stats ───────────────── */}
        <section className="slide mb-16">
          <SlideHeader number={3} title="現在の実績（ライブデータ）" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="公開記事"
              value={stats.posts.published ?? 0}
              sub={`/ ${stats.posts.total ?? 0} 件`}
              color="blue"
            />
            <StatCard
              label="登録ユーザー"
              value={stats.users.total ?? 0}
              sub="名"
              color="purple"
            />
            <StatCard
              label="AI ドラフト生成"
              value={stats.drafts.completed ?? 0}
              sub={`/ ${stats.drafts.total ?? 0} 回`}
              color="amber"
            />
            <StatCard
              label="Q&A スレッド"
              value={stats.threads.total ?? 0}
              sub={`(Active: ${stats.threads.active ?? 0})`}
              color="green"
            />
            <StatCard
              label="テンプレート"
              value={stats.templates ?? 0}
              sub="種類"
              color="red"
            />
          </div>
        </section>

        {/* ───────────────── Slide 5: Tech Stack ───────────────── */}
        <section className="slide mb-16">
          <SlideHeader number={4} title="技術スタック — 100% Cloudflare" />
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="p-6">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  フロントエンド / API
                </h3>
                <ul className="space-y-3">
                  <StackItem name="Remix v2" desc="SSR + ネストルーティング" />
                  <StackItem name="Hono" desc="API レイヤー、streamSSE、型安全バインディング" highlight />
                  <StackItem name="Tailwind CSS" desc="ユーティリティ CSS + Typography" />
                  <StackItem name="TypeScript" desc="フルスタック型安全" />
                </ul>
              </div>
              <div className="p-6">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Cloudflare サービス
                </h3>
                <ul className="space-y-3">
                  <StackItem name="Pages" desc="ホスティング + CI/CD" />
                  <StackItem name="D1" desc="SQLite DB（Drizzle ORM）" />
                  <StackItem name="R2" desc="画像ストレージ（S3 互換）" />
                  <StackItem name="Workers AI" desc="Llama 3.3 70B + Llama Guard 3" highlight />
                  <StackItem name="Vectorize" desc="ベクトル検索・関連記事推薦" />
                  <StackItem name="KV" desc="セッション / キャッシュ / ドラフト" />
                  <StackItem name="Access" desc="Zero Trust 認証（SSO）+ API 連携" />
                  <StackItem name="Email Workers" desc="通知メール送信" highlight />
                  <StackItem name="WAF" desc="OWASP Top 10 / カスタムルール" />
                  <StackItem name="Bot Management" desc="自動化攻撃検知・軽減" />
                  <StackItem name="API Shield" desc="OpenAPI スキーマバリデーション" highlight />
                  <StackItem name="Turnstile" desc="チャット Bot 保護（invisible）" highlight />
                  <StackItem name="AI Gateway" desc="AI ガードレール / ログ / 分析" highlight />
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-4 text-right print:hidden">
            <Link
              to="/admin/presentation/stack"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-gray-700 transition-colors"
            >
              技術スタック詳細を見る →
            </Link>
          </div>
        </section>

        {/* ───────────────── Slide 6: Key Features ───────────────── */}
        <section className="slide mb-16">
          <SlideHeader number={5} title="主要機能" />
          <div className="space-y-6">
            {/* Feature 1: AI Draft */}
            <FeatureRow
              number="01"
              title="AI ドラフト生成"
              desc="6種類のテンプレートから選択 → メモ書きレベルの入力 → Llama 3.3 70B が Markdown 記事を自動生成。プロンプトエンジニアリングで Cloudflare 事例スタイルに最適化。"
              color="amber"
              tags={["Workers AI", "テンプレート", "Llama 3.3"]}
            />
            {/* Feature 2: AI Chat Q&A */}
            <FeatureRow
              number="02"
              title="AI チャット Q&A"
              desc="記事ページに埋め込まれたチャットウィジェット。読者の質問に対し、記事コンテキストに厳密にグラウンディングされた回答を SSE ストリーミングでリアルタイム配信。Llama Guard でコンテンツモデレーション。"
              color="blue"
              tags={["Hono streamSSE", "RAG", "Llama Guard"]}
            />
            {/* Feature 3: Related Posts */}
            <FeatureRow
              number="03"
              title="関連記事レコメンド"
              desc="Vectorize に記事の Embedding を保存し、コンテンツの類似度ベースで関連記事を推薦。読者のエンゲージメントを向上。"
              color="purple"
              tags={["Vectorize", "bge-base-en", "Embedding"]}
            />
            {/* Feature 4: Search */}
            <FeatureRow
              number="04"
              title="キーワード＋セマンティック検索"
              desc="キーワード検索に加え、Vectorize を活用したセマンティック検索で意味的に近い記事を発見。事例検索の労力を大幅に削減。"
              color="green"
              tags={["Vectorize", "Semantic Search", "bge-base-en"]}
            />
            {/* Feature 5: Onboarding */}
            <FeatureRow
              number="05"
              title="投稿者オンボーディング"
              desc="公開申請フォーム → Admin 承認 → Cloudflare Access ポリシー自動追加 → Email 通知。プロフィール（ニックネーム・会社・専門分野等）で投稿者のアウェアネスを向上。"
              color="purple"
              tags={["Access API", "Email Worker", "Profile"]}
            />
            {/* Feature 6: Admin & Moderation */}
            <FeatureRow
              number="06"
              title="管理 & モデレーション"
              desc="投稿管理、ユーザー管理、Q&A スレッド管理（削除・フラグ）、AI インサイトダッシュボード、トレンドレポート生成。4週間経過した Active スレッドは自動削除。"
              color="red"
              tags={["Admin", "User Mgmt", "Auto-expire"]}
            />
            {/* Feature 7: Author Profiles */}
            <FeatureRow
              number="07"
              title="著者プロフィール & リンク"
              desc="各投稿者の公開プロフィールページ（/authors/$id）。記事詳細・ホーム・検索結果すべてから著者名をクリックで遷移可能。HTML の入れ子リンク制約を Stretched Link パターンで回避し、カード全体のクリック領域と著者リンクを共存。"
              color="purple"
              tags={["Public Profile", "Stretched Link", "COALESCE"]}
            />
            {/* Feature 8: Avatar Upload */}
            <FeatureRow
              number="08"
              title="アバターアップロード & クロップ"
              desc="HTML Canvas ベースのカスタムクロップコンポーネント。ドラッグで位置調整、スライダー+ホイールでズーム、円形マスクで顔位置を合わせて 400×400px PNG を出力。R2 にアップロード後、DB の avatar_url を即時更新。ユーザー自身のプロフィール・管理者のユーザー編集の両方から利用可能。"
              color="green"
              tags={["Canvas API", "Circular Crop", "R2 Upload"]}
            />
            {/* Feature 9: Personal API Keys */}
            <FeatureRow
              number="09"
              title="パーソナル API キー & テンプレート API"
              desc="外部 AI ツール（Gemini, ChatGPT, Claude 等）からテンプレート API を呼び出すための Bearer トークン認証。キーは cfbk_ プレフィックス + 40 hex、SHA-256 ハッシュで保存。ユーザーあたり最大5キー。セッション Cookie とのデュアル認証ミドルウェアで API とブラウザの両方をサポート。"
              color="amber"
              tags={["Bearer Auth", "SHA-256", "Dual Auth Middleware"]}
            />
          </div>
        </section>

        {/* ───────────────── Slide 7: Hono Architecture ───────────────── */}
        <section className="slide mb-16">
          <SlideHeader number={6} title="Hono — API レイヤーの心臓部" />
          <p className="mb-6 text-sm leading-relaxed text-gray-600">
            Cloudflare Workers に最適化された超軽量フレームワーク
            <a href="https://hono.dev/" target="_blank" rel="noopener noreferrer" className="mx-1 font-semibold text-red-600 hover:underline">Hono</a>
            を API レイヤーに採用。Remix の SSR/UI 層と組み合わせたハイブリッド構成。
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HonoCard number={1} title="型安全バインディング" desc="c.env.DB、c.env.AI 等、全 CF サービスに型付きアクセス" />
            <HonoCard number={2} title="streamSSE" desc="AI チャットをリアルタイム配信。ReadableStream 手動構築が不要" />
            <HonoCard number={3} title="共通ミドルウェア" desc="認証・認可・CORS・ロガーを宣言的に適用" />
            <HonoCard number={4} title="超軽量・高速" desc="依存ゼロ、バンドル極小。Workers の起動を最小化" />
          </div>
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
              API エンドポイント
            </h4>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Endpoint method="POST" path="/api/v1/chat" desc="AI チャット Q&A（SSE）" />
              <Endpoint method="POST" path="/api/v1/ai/suggest-tags" desc="タグ提案" />
              <Endpoint method="POST" path="/api/v1/ai/improve" desc="文章改善" />
              <Endpoint method="POST" path="/api/v1/ai/trend-report" desc="トレンドレポート" />
              <Endpoint method="GET" path="/api/v1/templates" desc="テンプレート一覧（Bearer/Cookie）" />
              <Endpoint method="GET" path="/api/v1/templates/:id" desc="テンプレート詳細" />
              <Endpoint method="*" path="/api/v1/api-keys" desc="API キー管理 CRUD" />
              <Endpoint method="POST" path="/api/upload-image" desc="画像アップロード（R2）" />
              <Endpoint method="GET" path="/r2/*" desc="R2 オブジェクト配信" />
              <Endpoint method="GET" path="/api/health" desc="ヘルスチェック" />
              <Endpoint method="GET" path="/feed.xml" desc="RSS フィード" />
            </div>
          </div>
          <div className="mt-4 text-right print:hidden">
            <Link
              to="/admin/presentation/hono"
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-500 transition-colors"
            >
              Hono 詳細を見る →
            </Link>
          </div>
        </section>

        {/* ───────────────── Slide 8: Article Creation Flow ───────────────── */}
        <section className="slide mb-16">
          <SlideHeader number={7} title="記事作成フロー" />
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="grid grid-cols-1 divide-y sm:grid-cols-5 sm:divide-x sm:divide-y-0">
              <FlowStep step={1} title="テンプレート選択" desc="6種類から選択" />
              <FlowStep step={2} title="フォーム入力" desc="メモ書きレベルでOK" />
              <FlowStep step={3} title="AI ドラフト" desc="Llama 3.3 70B が記事化" />
              <FlowStep step={4} title="編集・画像追加" desc="Markdown エディタ" />
              <FlowStep step={5} title="公開" desc="ワンクリック" />
            </div>
          </div>
        </section>

        {/* ───────────────── Slide 9: Security ───────────────── */}
        <section className="slide mb-16">
          <SlideHeader number={8} title="セキュリティ & インフラ" />
          <div className="grid gap-4 sm:grid-cols-2">
            <SecurityCard
              title="Cloudflare Access"
              items={["Google / Okta SSO 連携", "JWT ベース認証 + 自動リトライ", "RBAC (admin / se / user)", "OTP 再認証時のレジリエンス強化"]}
            />
            <SecurityCard
              title="WAF + Bot Management"
              items={["OWASP Top 10 防御（SQLi / XSS 等）", "API エンドポイント保護", "Bot 検知・自動化攻撃軽減", "コードスニペット WAF 誤検知回避"]}
            />
            <SecurityCard
              title="コンテンツモデレーション"
              items={["Llama Guard 3 8B", "スパムフィルター", "フラグ & 手動レビュー"]}
            />
            <SecurityCard
              title="API Shield"
              items={["OpenAPI 3.0 スキーマで全 16 エンドポイントを検証", "メソッド・パス・リクエストボディのバリデーション", "スキーマ不一致リクエストを自動ブロック", "Bearer / Cookie / CF Access 3 種の認証定義"]}
            />
            <SecurityCard
              title="Turnstile ✅ 稼働中"
              items={["チャット Q&A に invisible モード統合・稼働中", "ボットによる自動投稿を Workers 到達前にブロック", "siteverify API でサーバー側トークン検証", "Fail open 設計 — 障害時はスキップして可用性優先"]}
            />
            <SecurityCard
              title="AI Gateway ✅ 稼働中"
              items={["チャット AI 呼び出しを Gateway 経由でルーティング済み", "全リクエスト/レスポンスのログ・分析", "Gateway レベルのレート制限・キャッシュ", "プロンプト/レスポンスのガードレール"]}
            />
            <SecurityCard
              title="API キー & エッジ性能"
              items={["Bearer トークン (cfbk_) + SHA-256 ハッシュ保存", "Session Cookie とのデュアル認証", "V8 Isolates（コールドスタートなし）", "KV キャッシュ + グローバル CDN"]}
            />
          </div>
        </section>

        {/* ───────────────── Slide 10: Technical Deep-Dive ───────────────── */}
        <section className="slide mb-16">
          <SlideHeader number={9} title="技術実装の工夫 — エラー回避 & 細かな改善" />
          <div className="space-y-4">
            {/* JWT Resilience */}
            <TechDetail
              title="Cloudflare Access JWT 再認証レジリエンス"
              problem="OTP 再認証後、Access が新しい JWT を設定する前にアプリが古い JWT を読み検証失敗 → エラー画面が表示される"
              solutions={[
                "verifyAccessJWT を VerifyResult 型に拡張 — expired / kid_mismatch / bad_signature 等の失敗理由を識別",
                "期限切れ・鍵不一致の場合、サーバーサイドで自動リトライ（最大2回リダイレクト）",
                "公開鍵キャッシュに forceRefresh オプション — kid が一致しない場合キャッシュを破棄して再取得（鍵ローテーション対応）",
                "エラーページに 3 秒カウントダウン自動リトライ + 手動再試行ボタンを実装",
              ]}
              files={["app/lib/access.server.ts", "app/routes/auth.login.tsx"]}
              color="blue"
            />
            {/* WAF Code Snippet */}
            <TechDetail
              title="WAF 誤検知回避 — コードスニペット含む記事投稿"
              problem="AI 生成記事に SQL コマンド・シェルスクリプト・HTML タグが含まれると、Cloudflare WAF (OWASP) が POST リクエストをブロック"
              solutions={[
                "Cloudflare Dashboard → Security → WAF → Custom Rules で Skip ルールを作成",
                "POST /portal/*, /admin/*, /api/v1/* への認証済みリクエストで WAF Managed Rules / Bot Fight Mode / Rate Limit をスキップ",
                "Cloudflare Access で保護されたパスのため、WAF スキップしても安全性は維持",
              ]}
              files={["Cloudflare Dashboard (WAF Custom Rules)"]}
              color="red"
            />
            {/* Canvas Avatar Crop */}
            <TechDetail
              title="Canvas ベースアバタークロップ — 外部ライブラリ不使用"
              problem="プロフィール写真の顔位置を調整できるクロップ機能が必要だが、外部ライブラリの追加バンドルを避けたい"
              solutions={[
                "HTML Canvas + PointerEvents で完全カスタム実装（AvatarCropModal.tsx — 約180行）",
                "ドラッグで位置調整、スライダー＋マウスホイールでズーム（0.5x〜3x）",
                "半透明オーバーレイ + arc() で円形マスクを描画、白い枠線で切り抜き範囲を可視化",
                "canvas.toBlob() で 400×400px の円形 PNG を出力 → fetch('/api/upload-image') で R2 に直接アップロード",
              ]}
              files={["app/components/AvatarCropModal.tsx", "app/routes/portal.profile.tsx"]}
              color="green"
            />
            {/* Stretched Link Pattern */}
            <TechDetail
              title="Stretched Link パターン — 入れ子リンク制約の回避"
              problem="記事カードの全体がリンク（<a>）の場合、内部に著者名リンクをネストできない（HTML仕様違反）"
              solutions={[
                "カード全体を <div> に変更、タイトル <Link> に after:absolute after:inset-0 で全体をカバー",
                "著者名 <Link> に relative z-10 を付与してカード上に浮かせ独立クリック領域を確保",
                "ホーム・記事一覧・検索結果すべてに統一適用。pointer-events の衝突なし",
              ]}
              files={["app/routes/_index.tsx", "app/routes/posts._index.tsx", "app/routes/search.tsx"]}
              color="purple"
            />
            {/* Dual Auth Middleware */}
            <TechDetail
              title="デュアル認証ミドルウェア — API キー & セッション Cookie"
              problem="外部 AI ツールからは Bearer トークンで、ブラウザからはセッション Cookie で同一 API にアクセスしたい"
              solutions={[
                "resolveUser() ミドルウェアが Authorization: Bearer cfbk_* ヘッダーを優先チェック",
                "Bearer なしの場合 Cookie セッションにフォールバック — 既存ブラウザ動作に影響なし",
                "API キーは SHA-256 ハッシュで DB 保存、プレフィックス (cfbk_) で識別、last_used_at を自動更新",
                "CORS 設定に Authorization ヘッダーと DELETE メソッドを追加",
              ]}
              files={["app/api/middleware.ts", "app/lib/api-keys.server.ts"]}
              color="amber"
            />

            {/* API Shield */}
            <TechDetail
              title="API Shield — OpenAPI スキーマバリデーション"
              problem="API エンドポイントに対する不正なリクエスト（未定義パス・不正メソッド・不正ボディ）をエッジレベルでブロックしたい"
              solutions={[
                "OpenAPI 3.0 スキーマ (api-shield-schema.json) を作成し、全 16 エンドポイントのメソッド・パス・パラメータ・ボディを定義",
                "Cloudflare API Shield にスキーマを登録、Schema Validation を有効化",
                "multipart/form-data は API Shield 非対応のため、/api/upload-image のボディ検証はアプリ側（MIME タイプ・10MB 制限）で実施",
                "Bearer (cfbk_) / Session Cookie / CF Access JWT の 3 種の securitySchemes を定義",
              ]}
              files={["api-shield-schema.json"]}
              color="blue"
            />

            {/* Turnstile */}
            <TechDetail
              title="Turnstile — チャット Bot 保護（invisible モード）"
              problem="チャット Q&A にボットが自動投稿する攻撃を防ぎたいが、CAPTCHA で UX を悪化させたくない"
              solutions={[
                "Turnstile invisible モードを採用 — ユーザーに操作を要求せずにチャレンジを実行",
                "チャットパネル展開時に動的にスクリプトロード＆ウィジェット描画、メッセージ送信時にトークンを取得して POST ボディに含める",
                "サーバー側で siteverify API を呼び出してトークン検証、失敗時は 403 で拒否",
                "Fail open 設計 — TURNSTILE_SECRET_KEY 未設定時や API 通信エラー時はスキップして可用性を優先",
              ]}
              files={["app/lib/turnstile.server.ts", "app/components/ChatWidget.tsx", "app/api/routes/chat.ts"]}
              color="green"
            />

            {/* AI Gateway */}
            <TechDetail
              title="AI Gateway — AI 呼び出しのガードレール & 可観測性"
              problem="Workers AI への直接呼び出しではログ・レート制限・コンテンツフィルタリングを個別実装する必要がある"
              solutions={[
                "ai.run() の第 3 引数に { gateway: { id } } を渡すだけで AI Gateway 経由にルーティング",
                "gatewayOptions() ヘルパーで AI_GATEWAY_ID 未設定時は通常呼び出しにフォールバック",
                "Dashboard の Guardrails 設定でプロンプト/レスポンスのコンテンツフィルタリングを追加可能",
                "全 AI リクエストのログ・レイテンシ・トークン使用量を一元的に可視化",
              ]}
              files={["app/lib/chat.server.ts", "app/api/routes/chat.ts"]}
              color="purple"
            />
          </div>
        </section>

        {/* ───────────────── Slide 11: Challenges ───────────────── */}
        <section className="slide mb-16">
          <SlideHeader number={10} title="現在の課題と取り組み" />
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <h3 className="mb-2 text-sm font-bold text-amber-800">課題</h3>
              <p className="mb-4 text-sm font-semibold text-gray-900">AI の表現・レスポンス精度の向上</p>
              <p className="mb-4 text-sm leading-relaxed text-gray-600">
                現在の AI ドラフト生成やチャット Q&A は、Cloudflare Workers AI (Llama 3.3 70B) をベースにしていますが、
                技術的な正確さや日本語表現の自然さにはまだ改善の余地があります。
              </p>
              <h3 className="mb-2 text-sm font-bold text-green-700">取り組み</h3>
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                  プロンプトエンジニアリングの継続的な改善
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                  RAG コンテキストの品質向上（チャンク戦略の最適化）
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                  新モデルリリース時の迅速な検証・切り替え体制
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
              <h3 className="mb-2 text-sm font-bold text-blue-800">課題</h3>
              <p className="mb-4 text-sm font-semibold text-gray-900">より詳細で情報量豊かなコンテンツ作成</p>
              <p className="mb-4 text-sm leading-relaxed text-gray-600">
                記事に構成図やアーキテクチャダイアグラムを含めることで、読者の理解度を大幅に向上させたい。
                現状はテキスト中心の記事構成に留まっています。
              </p>
              <h3 className="mb-2 text-sm font-bold text-green-700">取り組み — サードパーティ連携</h3>
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                  構成図作成ツール連携（Mermaid / Excalidraw / draw.io 等）
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                  コードスニペットの埋め込み強化
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                  直近ロードマップに組み入れ済み — Phase 2 で対応予定
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ───────────────── Slide 11: Roadmap ───────────────── */}
        <section className="slide mb-16">
          <SlideHeader number={11} title="ロードマップ" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <RoadmapPhase
              phase="Phase 1"
              title="MVP"
              status="completed"
              items={["Public Blog", "User Portal", "Admin Dashboard", "認証/認可 (Access)", "基本セキュリティ"]}
            />
            <RoadmapPhase
              phase="Phase 2"
              title="AI & エンゲージメント"
              status="in-progress"
              items={["テンプレート AI ✅", "AI ドラフト生成 ✅", "Vectorize 検索 ✅", "AI チャット Q&A ✅", "Hono API 移行 ✅", "セマンティック検索 ✅", "投稿者申請 & プロフィール ✅", "Email 通知 ✅", "ユーザー管理 ✅", "RSS / Sitemap ✅", "著者プロフィール ✅", "アバタークロップ ✅", "Personal API Keys ✅", "Access 再認証改善 ✅", "API Shield ✅", "Turnstile ✅", "AI Gateway ✅", "AI 精度向上", "サードパーティ連携"]}
            />
            <RoadmapPhase
              phase="Phase 3"
              title="Advanced"
              status="planned"
              items={["Durable Objects", "Queues 非同期処理", "Logpush"]}
            />
            <RoadmapPhase
              phase="Phase 4"
              title="Scale"
              status="planned"
              items={["パフォーマンス最適化", "アナリティクス", "多言語対応", "コミュニティ機能", "外部連携"]}
            />
          </div>
        </section>

        {/* ───────────────── Slide 12: Call to Action ───────────────── */}
        <section className="slide mb-16 rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-12 text-white shadow-xl sm:p-16">
          <h2 className="mb-6 text-3xl font-extrabold sm:text-4xl">
            一緒に作りませんか？
          </h2>
          <p className="mb-8 max-w-2xl text-lg leading-relaxed text-gray-300">
            このプラットフォームは
            皆さんの参加で価値が生まれます。
            テンプレートに沿って入力するだけで、AI が記事のドラフトを作成し、皆様の表現や伝えたいことをアシストします。
            あなたの技術ナレッジを、世界に届けましょう。
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            <CTACard
              step="1"
              title="アカウント作成"
              desc="Google SSO でワンクリックログイン"
            />
            <CTACard
              step="2"
              title="テンプレートで記事作成"
              desc="メモ書きレベルの入力で OK"
            />
            <CTACard
              step="3"
              title="公開 & 共有"
              desc="お客様に URL を共有するだけ"
            />
          </div>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              to="/portal"
              className="rounded-xl bg-brand-500 px-8 py-3 text-sm font-bold text-white shadow-lg hover:bg-brand-400 transition-colors"
            >
              ポータルを開く
            </Link>
            <Link
              to="/about"
              className="rounded-xl border border-gray-600 px-8 py-3 text-sm font-bold text-gray-300 hover:bg-gray-700 transition-colors"
            >
              技術詳細を見る
            </Link>
          </div>
        </section>

        {/* ───────────────── Footer ───────────────── */}
        <footer className="text-center text-xs text-gray-400 print:hidden">
          <p>
            Built on Cloudflare — Workers, Pages, D1, R2, AI, Hono
          </p>
          <p className="mt-1">
            Admin 専用プレゼンテーションページ
          </p>
        </footer>
      </main>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
      {children}
    </span>
  );
}

function SlideHeader({ number, title }: { number: number; title: string }) {
  return (
    <div className="mb-8 flex items-center gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-sm font-bold text-brand-700">
        {number}
      </span>
      <h2 className="text-3xl font-bold text-gray-900">{title}</h2>
    </div>
  );
}

function ProblemCard({
  number,
  problem,
  solution,
}: {
  number: number;
  problem: string;
  solution: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <span className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-500">
        {number}
      </span>
      <h3 className="mb-2 text-base font-bold text-red-600">課題</h3>
      <p className="mb-4 text-base font-medium text-gray-900">{problem}</p>
      <h3 className="mb-2 text-base font-bold text-green-600">解決</h3>
      <p className="text-base text-gray-600">{solution}</p>
    </div>
  );
}

function PhilosophyCard({
  number,
  title,
  desc,
}: {
  number: number;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm">
      <span className="mx-auto mb-3 flex h-7 w-7 items-center justify-center rounded-md bg-brand-50 text-xs font-bold text-brand-600">
        {number}
      </span>
      <h3 className="mb-1 text-sm font-bold text-gray-900">{title}</h3>
      <p className="text-xs text-gray-500">{desc}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number;
  sub: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "from-blue-500 to-blue-600",
    purple: "from-purple-500 to-purple-600",
    amber: "from-amber-500 to-amber-600",
    green: "from-green-500 to-green-600",
    red: "from-red-500 to-red-600",
  };
  return (
    <div
      className={`rounded-2xl bg-gradient-to-br ${colors[color] ?? colors.blue} p-5 text-white shadow-lg`}
    >
      <p className="text-xs font-medium text-white/80">{label}</p>
      <p className="mt-1 text-3xl font-extrabold">
        {value}
        <span className="ml-1 text-sm font-normal text-white/70">{sub}</span>
      </p>
    </div>
  );
}

function StackItem({
  name,
  desc,
  highlight,
}: {
  name: string;
  desc: string;
  highlight?: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
          highlight
            ? "bg-red-100 text-red-700"
            : "bg-gray-100 text-gray-600"
        }`}
      >
        {name[0]}
      </span>
      <div>
        <span className={`text-sm font-semibold ${highlight ? "text-red-700" : "text-gray-900"}`}>
          {name}
        </span>
        <span className="ml-1.5 text-xs text-gray-500">{desc}</span>
      </div>
    </li>
  );
}

function FeatureRow({
  number,
  title,
  desc,
  color,
  tags,
}: {
  number: string;
  title: string;
  desc: string;
  color: string;
  tags: string[];
}) {
  const bgMap: Record<string, string> = {
    amber: "bg-amber-50 border-amber-200",
    blue: "bg-blue-50 border-blue-200",
    purple: "bg-purple-50 border-purple-200",
    red: "bg-red-50 border-red-200",
  };
  const tagMap: Record<string, string> = {
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <div className={`flex gap-5 rounded-2xl border p-6 ${bgMap[color] ?? bgMap.blue}`}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-lg font-extrabold text-gray-400 shadow-sm">
        {number}
      </span>
      <div>
        <h3 className="mb-1 text-base font-bold text-gray-900">{title}</h3>
        <p className="mb-3 text-sm leading-relaxed text-gray-600">{desc}</p>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${tagMap[color] ?? tagMap.blue}`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function HonoCard({
  number,
  title,
  desc,
}: {
  number: number;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/50 p-5">
      <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-xs font-bold text-red-600">
        {number}
      </span>
      <h3 className="mb-2 text-sm font-bold text-gray-900">{title}</h3>
      <p className="text-xs text-gray-600">{desc}</p>
    </div>
  );
}

function Endpoint({
  method,
  path,
  desc,
}: {
  method: string;
  path: string;
  desc: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold text-green-400">
        {method}
      </span>
      <code className="shrink-0 text-xs font-mono text-gray-700">{path}</code>
      <span className="text-xs text-gray-400">{desc}</span>
    </div>
  );
}

function FlowStep({
  step,
  title,
  desc,
}: {
  step: number;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-6 text-center">
      <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
        {step}
      </span>
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      <p className="mt-1 text-xs text-gray-500">{desc}</p>
    </div>
  );
}

function SecurityCard({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-3 font-bold text-gray-900">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoadmapPhase({
  phase,
  title,
  status,
  items,
}: {
  phase: string;
  title: string;
  status: "completed" | "in-progress" | "planned";
  items: string[];
}) {
  const statusStyles = {
    completed: "border-green-300 bg-green-50",
    "in-progress": "border-amber-300 bg-amber-50",
    planned: "border-gray-200 bg-gray-50",
  };
  const badgeStyles = {
    completed: "bg-green-100 text-green-700",
    "in-progress": "bg-amber-100 text-amber-700",
    planned: "bg-gray-100 text-gray-500",
  };
  const badgeText = {
    completed: "完了",
    "in-progress": "進行中",
    planned: "計画中",
  };
  return (
    <div className={`rounded-xl border p-5 ${statusStyles[status]}`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            {phase}
          </p>
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeStyles[status]}`}
        >
          {badgeText[status]}
        </span>
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="text-xs text-gray-600">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CTACard({
  step,
  title,
  desc,
}: {
  step: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
      <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
        {step}
      </span>
      <h3 className="mt-3 text-sm font-bold text-white">{title}</h3>
      <p className="mt-1 text-xs text-gray-400">{desc}</p>
    </div>
  );
}

function TechDetail({
  title,
  problem,
  solutions,
  files,
  color,
}: {
  title: string;
  problem: string;
  solutions: string[];
  files: string[];
  color: string;
}) {
  const borderMap: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50/60",
    red: "border-red-200 bg-red-50/60",
    green: "border-green-200 bg-green-50/60",
    purple: "border-purple-200 bg-purple-50/60",
    amber: "border-amber-200 bg-amber-50/60",
  };
  const dotMap: Record<string, string> = {
    blue: "bg-blue-400",
    red: "bg-red-400",
    green: "bg-green-400",
    purple: "bg-purple-400",
    amber: "bg-amber-400",
  };
  return (
    <div className={`rounded-xl border p-5 ${borderMap[color] ?? borderMap.blue}`}>
      <h3 className="mb-2 text-sm font-bold text-gray-900">{title}</h3>
      <p className="mb-3 text-xs leading-relaxed text-red-700">
        <span className="font-semibold">課題:</span> {problem}
      </p>
      <ul className="mb-3 space-y-1.5">
        {solutions.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dotMap[color] ?? dotMap.blue}`} />
            {s}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-1.5">
        {files.map((f) => (
          <span key={f} className="rounded bg-gray-200/70 px-2 py-0.5 text-[10px] font-mono text-gray-600">
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}
