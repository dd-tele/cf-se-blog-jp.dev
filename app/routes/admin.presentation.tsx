import { useState, useEffect, useCallback, useRef } from "react";
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
  const user = await requireRole(request, ["admin", "se", "ae"]);
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

const TOTAL_SLIDES = 14;

export default function AdminPresentation() {
  const { user, stats } = useLoaderData<typeof loader>();
  const [current, setCurrent] = useState(0);

  const go = useCallback(
    (dir: 1 | -1) => {
      setCurrent((c) => Math.max(0, Math.min(TOTAL_SLIDES - 1, c + dir)));
    },
    [],
  );

  // Wheel / trackpad gesture — debounced so one swipe = one slide
  const wheelLock = useRef(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(1);
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      }
      if (e.key === "Home") {
        e.preventDefault();
        setCurrent(0);
      }
      if (e.key === "End") {
        e.preventDefault();
        setCurrent(TOTAL_SLIDES - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Allow normal scroll if slide content is scrollable
      const inner = el.firstElementChild as HTMLElement | null;
      if (inner) {
        const canScrollDown = inner.scrollHeight > inner.clientHeight + 1;
        if (canScrollDown) {
          const atTop = inner.scrollTop <= 0;
          const atBottom = inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 1;
          // Only navigate when at scroll boundary in the swipe direction
          if (e.deltaY > 0 && !atBottom) return;
          if (e.deltaY < 0 && !atTop) return;
        }
      }

      if (wheelLock.current) return;
      const threshold = 30;
      if (Math.abs(e.deltaY) < threshold) return;

      wheelLock.current = true;
      go(e.deltaY > 0 ? 1 : -1);
      setTimeout(() => {
        wheelLock.current = false;
      }, 600);
    };

    el.addEventListener("wheel", onWheel, { passive: true });
    return () => el.removeEventListener("wheel", onWheel);
  }, [go]);

  // ─── Build slides array ──────────────────────────────────────

  const slides: React.ReactNode[] = [];

  /* ── Slide 0: Title ── */
  slides.push(
    <div key="title" className="flex h-full flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-[#FBAD41] via-[#F6821F] to-[#E04E16] p-10 text-center text-white sm:p-16">
      <p className="mb-4 text-base font-medium uppercase tracking-widest text-white/70">
        Cloudflare Solution Engineering
      </p>
      <h1 className="mb-6 text-5xl font-extrabold leading-tight sm:text-6xl lg:text-7xl">
        Solution Blog Platform
      </h1>
      <p className="mb-10 max-w-3xl text-xl leading-relaxed text-white/90 sm:text-2xl">
        現場のリアルな技術適用・導入知見を共有し、相互に学び合うナレッジハブ。
        コミュニティ全体の技術品質を底上げし、より良いインターネット環境の構築へ。
      </p>
      <div className="flex flex-wrap justify-center gap-3">
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
    </div>,
  );

  /* ── Slide 1: Why ── */
  slides.push(
    <div key="why" className="mx-auto max-w-7xl px-8 py-8 sm:px-12 sm:py-10">
      <SlideHeader number={1} title="このブログが目指す課題解決" />
      <p className="mb-8 max-w-4xl text-lg leading-relaxed text-gray-600">
        Cloudflare を導入済み・検討中のすべてのユーザーが、<strong className="text-gray-900">現場のリアルな技術適用や導入体験</strong>を共有し、
        相互に学び合える<strong className="text-gray-900">ナレッジハブ</strong>を目指しています。
        個人や組織に閉じがちな知見をオープンにし、コミュニティ全体の技術品質を底上げします。
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        <ProblemCard number={1} problem="現場のリアルな導入事例・技術適用が見つからない" solution="キーワード + Vectorize セマンティック検索で、意味的に近い事例をすばやく発見。記事ごとの AI チャット Q&A で疑問をその場で解消。導入のリアルを記事として蓄積・共有。" />
        <ProblemCard number={2} problem="知見の発信に時間がかかり、後回しになる" solution="6 種類のテンプレートから選択し、メモ書きレベルの入力だけで Llama 3.3 70B が Markdown 記事を自動生成。タグ提案・文章改善もワンクリック。発信のハードルを限りなく下げる。" />
        <ProblemCard number={3} problem="ユーザー同士・エンジニア同士の接点が限られている" solution="投稿者プロフィール（会社・専門分野）を公開し、記事から著者ページへ遷移。誰がどんな分野で実績があるかを可視化し、企業や立場を超えた相互支援・コラボレーションを促進。" />
        <ProblemCard number={4} problem="導入判断に必要な実践情報が分散している" solution="ブログ記事・RSS フィード・セマンティック検索を軸に、Cloudflare 技術の実践ナレッジハブとして機能。導入検討中のユーザーにも、現場発のリアルな情報を提供。" />
      </div>
      <div className="mt-10">
        <div className="rounded-2xl border-2 border-brand-300 bg-gradient-to-r from-brand-50 to-orange-50 px-6 py-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-4 text-lg font-bold text-brand-800 sm:text-xl lg:text-2xl">
            <span className="rounded-lg bg-white px-4 py-2 shadow-sm ring-1 ring-brand-200">現場の知見共有</span>
            <span className="text-brand-400">→</span>
            <span className="rounded-lg bg-white px-4 py-2 shadow-sm ring-1 ring-brand-200">技術品質の向上</span>
            <span className="text-brand-400">→</span>
            <span className="rounded-lg bg-white px-4 py-2 shadow-sm ring-1 ring-brand-200">各社の課題解決</span>
            <span className="text-brand-400">→</span>
            <span className="rounded-lg bg-white px-4 py-2 shadow-sm ring-1 ring-brand-200">より優れたコスト構造とアーキテクチャ</span>
          </div>
        </div>
        <p className="mt-5 text-center text-base font-medium text-gray-600 sm:text-lg">
          その先に、<span className="font-bold text-brand-700">より良いインターネット環境の構築</span>へつながることを願っています。
        </p>
      </div>
    </div>,
  );

  /* ── Slide 2: Design Philosophy ── */
  slides.push(
    <div key="philosophy" className="mx-auto max-w-7xl px-8 py-8 sm:px-12 sm:py-10">
      <SlideHeader number={2} title="設計思想" />
      <p className="mb-8 max-w-4xl text-lg leading-relaxed text-gray-600">
        プラットフォームの設計は <strong className="text-gray-900">4 つの柱</strong> に基づいています。
        すべての技術選定・UX 設計はこれらの原則に照らして判断しています。
      </p>
      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <PhilosophyCard number={1} title="Better Internet" desc="Cloudflare の「help build a better Internet」を自ら体現。100% Cloudflare スタックでゼロトラスト・エッジ最適化・AI を実証。" />
        <PhilosophyCard number={2} title="Blog as a Work" desc="ブログ執筆は業務の一環。テンプレート + AI ドラフトで執筆時間を大幅削減し、誰でも気軽にナレッジを発信できる文化を作る。" />
        <PhilosophyCard number={3} title="Engineer Engagement" desc="著者プロフィール・専門分野の可視化でエンジニア同士の接点を創出。記事を通じてお客様にも SE の専門性を伝える。" />
        <PhilosophyCard number={4} title="Easy Publication" desc="メモ書き → AI ドラフト → レビュー → ワンクリック公開。技術ブログの敷居を限りなく下げ、知見共有を日常に。" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h4 className="mb-2 text-sm font-bold uppercase tracking-widest text-gray-400">アーキテクチャ原則</h4>
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li>• サーバーレス・エッジファースト — コールドスタートなし</li>
            <li>• 全サービス Cloudflare で完結 — 外部依存ゼロ</li>
            <li>• TypeScript フルスタック型安全</li>
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h4 className="mb-2 text-sm font-bold uppercase tracking-widest text-gray-400">セキュリティ原則</h4>
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li>• Zero Trust（Cloudflare Access + RBAC）</li>
            <li>• 多層防御（WAF → Turnstile → Guard → Gateway）</li>
            <li>• Fail-open 設計 — 障害時は可用性優先</li>
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h4 className="mb-2 text-sm font-bold uppercase tracking-widest text-gray-400">UX 原則</h4>
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li>• 最小限のステップで記事公開</li>
            <li>• AI は補助。最終判断は人間が行う</li>
            <li>• レスポンシブ & アクセシブル</li>
          </ul>
        </div>
      </div>
    </div>,
  );

  /* ── Slide 3: Live Stats ── */
  slides.push(
    <div key="stats" className="mx-auto max-w-7xl px-8 py-8 sm:px-12 sm:py-10">
      <SlideHeader number={3} title="現在の実績（ライブデータ）" />
      <p className="mb-8 max-w-4xl text-lg leading-relaxed text-gray-600">
        以下の数値は D1 データベースからリアルタイムに取得しています。プレゼンテーション表示時点の最新値です。
      </p>
      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="公開記事" value={stats.posts.published ?? 0} sub={`/ ${stats.posts.total ?? 0} 件`} color="blue" />
        <StatCard label="累計閲覧数" value={stats.posts.totalViews ?? 0} sub="PV" color="blue" />
        <StatCard label="登録ユーザー" value={stats.users.total ?? 0} sub="名" color="purple" />
        <StatCard label="AI ドラフト生成" value={stats.drafts.completed ?? 0} sub={`/ ${stats.drafts.total ?? 0} 回`} color="amber" />
        <StatCard label="Q&A スレッド" value={stats.threads.total ?? 0} sub={`(Active: ${stats.threads.active ?? 0})`} color="green" />
        <StatCard label="テンプレート" value={stats.templates ?? 0} sub="種類" color="red" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h4 className="mb-1 text-sm font-bold text-blue-800">記事</h4>
          <p className="text-sm leading-relaxed text-gray-600">テンプレート AI で生成 → レビュー → 公開のフローで蓄積中。下書き含め着実に増加。</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h4 className="mb-1 text-sm font-bold text-amber-800">AI ドラフト</h4>
          <p className="text-sm leading-relaxed text-gray-600">Llama 3.3 70B による自動生成。完了率が高いほどテンプレートの品質が良い証拠。</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <h4 className="mb-1 text-sm font-bold text-green-800">Q&A チャット</h4>
          <p className="text-sm leading-relaxed text-gray-600">記事ごとの AI チャット。24h TTL で自動削除されるため Active 数はリアルタイムの利用状況を反映。</p>
        </div>
      </div>
    </div>,
  );

  /* ── Slide 4: Tech Stack ── */
  slides.push(
    <div key="stack" className="mx-auto max-w-7xl px-8 py-8 sm:px-12 sm:py-10">
      <SlideHeader number={4} title="技術スタック — 100% Cloudflare" />
      <p className="mb-6 max-w-4xl text-lg leading-relaxed text-gray-600">
        外部クラウドやサードパーティ SaaS を一切使わず、<strong className="text-gray-900">Cloudflare のサービスだけ</strong>でフルスタック Web アプリケーションを構築。
        フロントエンド・API・DB・ストレージ・AI・認証・セキュリティすべてがエッジで動作します。
      </p>
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="p-8">
            <h3 className="mb-5 text-sm font-semibold uppercase tracking-widest text-gray-400">フロントエンド / API</h3>
            <ul className="space-y-4">
              <StackItem name="Remix v2" desc="SSR + ネストルーティング + Vite" />
              <StackItem name="Hono" desc="API レイヤー、streamSSE、型安全バインディング" highlight />
              <StackItem name="Tailwind CSS" desc="ユーティリティ CSS + Typography プラグイン" />
              <StackItem name="TypeScript" desc="フルスタック型安全（Drizzle スキーマ〜UI まで）" />
              <StackItem name="Drizzle ORM" desc="D1 用 SQL ビルダー + マイグレーション" />
            </ul>
          </div>
          <div className="p-8">
            <h3 className="mb-5 text-sm font-semibold uppercase tracking-widest text-gray-400">Cloudflare サービス（17 種）</h3>
            <ul className="space-y-4">
              <StackItem name="Pages" desc="ホスティング + GitHub CI/CD" />
              <StackItem name="D1" desc="SQLite DB — 13 テーブル、Drizzle ORM" />
              <StackItem name="R2" desc="画像 / アバターストレージ（S3 互換）" />
              <StackItem name="Workers AI" desc="Llama 3.3 70B（ドラフト/チャット）+ Llama Guard 3 8B（モデレーション）+ bge-base-en（Embedding）" highlight />
              <StackItem name="Vectorize" desc="ベクトル検索 — セマンティック検索 + 関連記事推薦" />
              <StackItem name="KV" desc="セッション / レート制限 / キャッシュ" />
              <StackItem name="Access" desc="Zero Trust 認証（Google SSO）+ RBAC + API 連携" />
              <StackItem name="Email Workers" desc="申請承認・セキュリティ通知メール送信" highlight />
              <StackItem name="WAF" desc="OWASP Top 10 + カスタムルール" />
              <StackItem name="Bot Management" desc="自動化攻撃検知・軽減" />
              <StackItem name="API Shield" desc="OpenAPI 3.0 スキーマで全 16 EP を検証" highlight />
              <StackItem name="Turnstile" desc="invisible CAPTCHA — チャット Bot 保護" highlight />
              <StackItem name="AI Gateway" desc="AI ガードレール / ログ / レイテンシ分析" highlight />
            </ul>
          </div>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-3">
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">赤字 = 最近追加</span>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">GitHub Actions で自動デプロイ</span>
        </div>
        <Link to="/admin/presentation/stack" className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-6 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-gray-700">
          技術スタック詳細を見る →
        </Link>
      </div>
    </div>,
  );

  /* ── Slide 5: Key Features ── */
  slides.push(
    <div key="features" className="mx-auto max-w-7xl px-8 py-8 sm:px-12 sm:py-10">
      <SlideHeader number={5} title="主要機能" />
      <div className="space-y-5">
        <FeatureRow number="01" title="AI ドラフト生成" desc="6種類のテンプレートから選択 → メモ書きレベルの入力 → Llama 3.3 70B が Markdown 記事を自動生成。プロンプトエンジニアリングで Cloudflare 事例スタイルに最適化。" color="amber" tags={["Workers AI", "テンプレート", "Llama 3.3"]} />
        <FeatureRow number="02" title="AI チャット Q&A" desc="記事ページのフローティングウィジェット。記事コンテキスト優先 + Cloudflare 全般の知識で補足回答。Vectorize RAG + SSE ストリーミング。Turnstile Bot 保護 → 入力バリデーション → KV レート制限 → Llama Guard モデレーション → AI Gateway ガードレールの多層防御。24h TTL で自動クリーンアップ。" color="blue" tags={["Hono streamSSE", "RAG", "Llama Guard", "AI Gateway", "Turnstile"]} />
        <FeatureRow number="03" title="関連記事レコメンド" desc="Vectorize に記事の Embedding を保存し、コンテンツの類似度ベースで関連記事を推薦。読者のエンゲージメントを向上。" color="purple" tags={["Vectorize", "bge-base-en", "Embedding"]} />
        <FeatureRow number="04" title="キーワード＋セマンティック検索" desc="キーワード検索に加え、Vectorize を活用したセマンティック検索で意味的に近い記事を発見。事例検索の労力を大幅に削減。" color="green" tags={["Vectorize", "Semantic Search", "bge-base-en"]} />
        <FeatureRow number="05" title="投稿者オンボーディング" desc="公開申請フォーム → Admin 承認 → Cloudflare Access ポリシー自動追加 → Email 通知。プロフィール（ニックネーム・会社・専門分野等）で投稿者のアウェアネスを向上。" color="purple" tags={["Access API", "Email Worker", "Profile"]} />
        <FeatureRow number="06" title="管理 & モデレーション" desc="投稿管理、ユーザー管理、Q&A スレッド管理（削除・フラグ）、AI インサイトダッシュボード、トレンドレポート生成。24 時間経過したスレッドは自動削除。フラグ付きメッセージは証跡として管理画面で確認可能。" color="red" tags={["Admin", "User Mgmt", "24h TTL"]} />
        <FeatureRow number="07" title="著者プロフィール & リンク" desc="各投稿者の公開プロフィールページ（/authors/$id）。記事詳細・ホーム・検索結果すべてから著者名をクリックで遷移可能。HTML の入れ子リンク制約を Stretched Link パターンで回避し、カード全体のクリック領域と著者リンクを共存。" color="purple" tags={["Public Profile", "Stretched Link", "COALESCE"]} />
        <FeatureRow number="08" title="アバターアップロード & クロップ" desc="HTML Canvas ベースのカスタムクロップコンポーネント。ドラッグで位置調整、スライダー+ホイールでズーム、円形マスクで顔位置を合わせて 400×400px PNG を出力。R2 にアップロード後、DB の avatar_url を即時更新。" color="green" tags={["Canvas API", "Circular Crop", "R2 Upload"]} />
        <FeatureRow number="09" title="パーソナル API キー & テンプレート API" desc="外部 AI ツール（Gemini, ChatGPT, Claude 等）からテンプレート API を呼び出すための Bearer トークン認証。キーは cfbk_ プレフィックス + 40 hex、SHA-256 ハッシュで保存。" color="amber" tags={["Bearer Auth", "SHA-256", "Dual Auth Middleware"]} />
      </div>
    </div>,
  );

  /* ── Slide 6: Hono Architecture ── */
  slides.push(
    <div key="hono" className="mx-auto max-w-7xl px-8 py-8 sm:px-12 sm:py-10">
      <SlideHeader number={6} title="Hono — API レイヤーの心臓部" />
      <p className="mb-6 text-base leading-relaxed text-gray-600">
        Cloudflare Workers に最適化された超軽量フレームワーク
        <a href="https://hono.dev/" target="_blank" rel="noopener noreferrer" className="mx-1 font-semibold text-red-600 hover:underline">Hono</a>
        を API レイヤーに採用。Remix が SSR / UI / ルーティングを担当し、Hono が API ロジック・ストリーミング・ミドルウェアを担当する
        <strong className="text-gray-900"> ハイブリッドアーキテクチャ</strong>。
      </p>
      <div className="mb-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <HonoCard number={1} title="型安全バインディング" desc="HonoEnv 型で c.env.DB / c.env.AI / c.env.R2 等すべての CF バインディングに型付きアクセス。実行時エラーを防止。" />
        <HonoCard number={2} title="streamSSE ヘルパー" desc="AI チャット応答を Server-Sent Events でリアルタイム配信。ReadableStream の手動構築が不要で、エラーハンドリングも組み込み。" />
        <HonoCard number={3} title="共通ミドルウェア" desc="optionalAuth / requireAuth / requireRole の認証チェーン + CORS + logger を宣言的にルートへ適用。" />
        <HonoCard number={4} title="超軽量・高速" desc="依存ゼロ、14KB gzip。V8 Isolate の起動コストを最小化。Remix との共存でもバンドルサイズ影響は極小。" />
      </div>
      <div className="mb-6 rounded-xl border border-red-200 bg-red-50/50 p-5">
        <h4 className="mb-2 text-sm font-bold text-red-800">Remix ↔ Hono 統合パターン</h4>
        <p className="text-sm leading-relaxed text-gray-600">
          Remix のルートファイル（例: <code className="text-xs">api.v1.chat.tsx</code>）は薄いシムで、リクエストを <code className="text-xs">app.fetch(request, env)</code> で Hono に委譲。
          Vite が <code className="text-xs">~/</code> パスエイリアスを解決するため、Pages Functions ではなく Remix ルート経由で統合。
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-400">API エンドポイント（11 routes）</h4>
        <div className="grid gap-3 text-base sm:grid-cols-2">
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
      <div className="mt-6 text-right">
        <Link to="/admin/presentation/hono" className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-6 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-red-500">
          Hono 詳細を見る →
        </Link>
      </div>
    </div>,
  );

  /* ── Slide 7: AI Chatbot Deep Dive ── */
  slides.push(
    <div key="chatbot" className="mx-auto max-w-7xl px-8 py-8 sm:px-12 sm:py-10">
      <SlideHeader number={7} title="AI チャットボット — 実装 & チューニング" />
      <p className="mb-6 text-base leading-relaxed text-gray-600">
        記事ページのフローティングウィジェットで読者の質問にリアルタイム回答。記事コンテキスト優先 + Cloudflare 全般の知識で補足する
        ハイブリッド RAG 構成。多層セキュリティと AI Gateway による可観測性を両立。
      </p>
      <div className="mb-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-3">
          <h3 className="text-base font-bold text-gray-900">リクエスト処理パイプライン（6 段階防御）</h3>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
          <PipelineStep step={1} label="Turnstile" desc="invisible CAPTCHA" color="blue" />
          <PipelineStep step={2} label="バリデーション" desc="1,000字 + スパム検出" color="gray" />
          <PipelineStep step={3} label="KV レート制限" desc="10回/分/IP" color="amber" />
          <PipelineStep step={4} label="Llama Guard" desc="コンテンツモデレーション" color="red" />
          <PipelineStep step={5} label="RAG コンテキスト" desc="Vectorize + 記事本文" color="purple" />
          <PipelineStep step={6} label="Llama 3.3 70B" desc="SSE ストリーミング回答" color="green" />
        </div>
      </div>
      <div className="mb-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-3">
          <h3 className="text-base font-bold text-gray-900">チューニングポイント & 改善履歴</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50/50">
              <th className="px-5 py-2.5 text-left font-semibold">項目</th>
              <th className="px-5 py-2.5 text-left font-semibold">Before → After</th>
              <th className="px-5 py-2.5 text-left font-semibold">効果</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr><td className="px-5 py-2 font-medium">回答スコープ</td><td className="px-5 py-2">記事のみ → 記事優先 + CF 全般知識</td><td className="px-5 py-2">幅広い質問に回答可能</td></tr>
            <tr><td className="px-5 py-2 font-medium">max_tokens</td><td className="px-5 py-2">1,024 → 2,048</td><td className="px-5 py-2">詳細な回答・コード例</td></tr>
            <tr><td className="px-5 py-2 font-medium">AI 回答保存</td><td className="px-5 py-2">fire-and-forget → await</td><td className="px-5 py-2">リフレッシュ後も回答が残る</td></tr>
            <tr><td className="px-5 py-2 font-medium">スレッド TTL</td><td className="px-5 py-2">28 日 → 24 時間</td><td className="px-5 py-2">ストレージ節約・プライバシー</td></tr>
            <tr><td className="px-5 py-2 font-medium">入力欄</td><td className="px-5 py-2">単行 input → 自動リサイズ textarea</td><td className="px-5 py-2">長文の可視性・改行対応</td></tr>
            <tr><td className="px-5 py-2 font-medium">エラーハンドリング</td><td className="px-5 py-2">無応答 → SSE error イベント</td><td className="px-5 py-2">ユーザーに理由を表示</td></tr>
          </tbody>
        </table>
      </div>
      <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/30 shadow-sm">
        <div className="border-b border-amber-200 bg-amber-100/50 px-6 py-3">
          <h3 className="text-base font-bold text-amber-900">AI Gateway — 挙動例</h3>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <div className="rounded-lg border border-amber-200 bg-white p-5">
            <h4 className="mb-1.5 text-sm font-bold text-green-700">正常フロー</h4>
            <p className="text-sm leading-relaxed text-gray-600">
              全 AI 呼び出しが Gateway 経由 → ダッシュボードでリクエスト数・レイテンシ・トークン消費をリアルタイム監視。
              <code className="text-xs">ai.run(model, input, {`{ gateway: { id } }`})</code> で有効化。
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-white p-5">
            <h4 className="mb-1.5 text-sm font-bold text-red-700">ガードレールブロック</h4>
            <p className="text-sm leading-relaxed text-gray-600">
              不適切コンテンツ検知 → ストリーム空/中断 → サーバーが検知し SSE error イベント送信
              → 「内容を変えて再度お試しください」と赤バーで表示。
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-white p-5">
            <h4 className="mb-1.5 text-sm font-bold text-blue-700">二重モデレーション</h4>
            <p className="text-sm leading-relaxed text-gray-600">
              Llama Guard（コンテンツ分類・Fail-open）+ AI Gateway（ガードレール）の多層構成。
              フラグ付きメッセージは DB に証跡保存、管理画面で確認可能。
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-white p-5">
            <h4 className="mb-1.5 text-sm font-bold text-purple-700">ダッシュボード監視</h4>
            <p className="text-sm leading-relaxed text-gray-600">
              リクエスト数・成功/失敗率・レイテンシ・トークン消費・モデル別コスト・
              ガードレール発動回数・キャッシュヒット率をリアルタイムで確認可能。
            </p>
          </div>
        </div>
      </div>
    </div>,
  );

  /* ── Slide 8: Article Creation Flow ── */
  slides.push(
    <div key="flow" className="mx-auto max-w-7xl px-8 py-8 sm:px-12 sm:py-10">
      <SlideHeader number={8} title="記事作成フロー" />
      <p className="mb-8 max-w-4xl text-lg leading-relaxed text-gray-600">
        「メモ書きレベルの入力」から「公開記事」まで、<strong className="text-gray-900">5 ステップ</strong>で完結。
        AI がドラフトを生成するため、執筆にかかる時間を大幅に短縮します。
      </p>
      <div className="mb-8 w-full overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="grid grid-cols-1 divide-y sm:grid-cols-5 sm:divide-x sm:divide-y-0">
          <FlowStep step={1} title="テンプレート選択" desc="6種類から選択" />
          <FlowStep step={2} title="フォーム入力" desc="メモ書きレベルでOK" />
          <FlowStep step={3} title="AI ドラフト" desc="Llama 3.3 70B が記事化" />
          <FlowStep step={4} title="編集・画像追加" desc="Markdown エディタ" />
          <FlowStep step={5} title="公開" desc="ワンクリック" />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h4 className="mb-2 text-base font-bold text-amber-800">Step 1–2: テンプレート & 入力</h4>
          <p className="text-sm leading-relaxed text-gray-600">
            概要紹介・技術解説・設定手順・ベストプラクティス・トラブルシューティング・イベントレポートの 6 種から選択。
            各テンプレートは専用フォームで、タイトル・要点・メモを入力するだけ。文章力は不要。
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h4 className="mb-2 text-base font-bold text-blue-800">Step 3: AI ドラフト生成</h4>
          <p className="text-sm leading-relaxed text-gray-600">
            Llama 3.3 70B がテンプレートの構造に沿って Markdown 記事を自動生成。
            Cloudflare 事例スタイルに最適化されたプロンプトエンジニアリング。
            タグ提案（suggest-tags）・文章改善（improve）もワンクリックで利用可能。
          </p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <h4 className="mb-2 text-base font-bold text-green-800">Step 4–5: 編集 & 公開</h4>
          <p className="text-sm leading-relaxed text-gray-600">
            リッチ Markdown エディタで自由に編集。R2 への画像アップロード対応。
            プレビューで確認後、ワンクリックで公開。公開後は Vectorize に自動インデックスされ、検索・Q&A の対象に。
          </p>
        </div>
      </div>
    </div>,
  );

  /* ── Slide 9: Security ── */
  slides.push(
    <div key="security" className="mx-auto max-w-7xl px-8 py-8 sm:px-12 sm:py-10">
      <SlideHeader number={9} title="セキュリティ & インフラ" />
      <div className="grid gap-5 sm:grid-cols-2">
        <SecurityCard title="Cloudflare Access" items={["Google / Okta SSO 連携", "JWT ベース認証 + 自動リトライ", "RBAC (admin / se / user)", "OTP 再認証時のレジリエンス強化"]} />
        <SecurityCard title="WAF + Bot Management" items={["OWASP Top 10 防御（SQLi / XSS 等）", "API エンドポイント保護", "Bot 検知・自動化攻撃軽減", "コードスニペット WAF 誤検知回避"]} />
        <SecurityCard title="コンテンツモデレーション" items={["Llama Guard 3 8B", "スパムフィルター", "フラグ & 手動レビュー"]} />
        <SecurityCard title="API Shield" items={["OpenAPI 3.0 スキーマで全 16 エンドポイントを検証", "メソッド・パス・リクエストボディのバリデーション", "スキーマ不一致リクエストを自動ブロック", "Bearer / Cookie / CF Access 3 種の認証定義"]} />
        <SecurityCard title="Turnstile ✅ 稼働中" items={["チャット Q&A に invisible モード統合・稼働中", "ボットによる自動投稿を Workers 到達前にブロック", "siteverify API でサーバー側トークン検証", "Fail open 設計 — 障害時はスキップして可用性優先"]} />
        <SecurityCard title="AI Gateway ✅ 稼働中" items={["チャット AI 呼び出しを Gateway 経由でルーティング済み", "全リクエスト/レスポンスのログ・分析", "Gateway レベルのレート制限・キャッシュ", "プロンプト/レスポンスのガードレール"]} />
        <SecurityCard title="API キー & エッジ性能" items={["Bearer トークン (cfbk_) + SHA-256 ハッシュ保存", "Session Cookie とのデュアル認証", "V8 Isolates（コールドスタートなし）", "KV キャッシュ + グローバル CDN"]} />
      </div>
    </div>,
  );

  /* ── Slide 10: Technical Deep-Dive ── */
  slides.push(
    <div key="tech" className="mx-auto max-w-7xl px-8 py-8 sm:px-12 sm:py-10">
      <SlideHeader number={10} title="技術実装の工夫 — エラー回避 & 細かな改善" />
      <div className="space-y-4">
        <TechDetail title="Cloudflare Access JWT 再認証レジリエンス" problem="OTP 再認証後、Access が新しい JWT を設定する前にアプリが古い JWT を読み検証失敗 → エラー画面が表示される" solutions={["verifyAccessJWT を VerifyResult 型に拡張 — expired / kid_mismatch / bad_signature 等の失敗理由を識別", "期限切れ・鍵不一致の場合、サーバーサイドで自動リトライ（最大2回リダイレクト）", "公開鍵キャッシュに forceRefresh オプション — kid が一致しない場合キャッシュを破棄して再取得（鍵ローテーション対応）", "エラーページに 3 秒カウントダウン自動リトライ + 手動再試行ボタンを実装"]} files={["app/lib/access.server.ts", "app/routes/auth.login.tsx"]} color="blue" />
        <TechDetail title="WAF 誤検知回避 — コードスニペット含む記事投稿" problem="AI 生成記事に SQL コマンド・シェルスクリプト・HTML タグが含まれると、Cloudflare WAF (OWASP) が POST リクエストをブロック" solutions={["Cloudflare Dashboard → Security → WAF → Custom Rules で Skip ルールを作成", "POST /portal/*, /admin/*, /api/v1/* への認証済みリクエストで WAF Managed Rules / Bot Fight Mode / Rate Limit をスキップ", "Cloudflare Access で保護されたパスのため、WAF スキップしても安全性は維持"]} files={["Cloudflare Dashboard (WAF Custom Rules)"]} color="red" />
        <TechDetail title="Canvas ベースアバタークロップ — 外部ライブラリ不使用" problem="プロフィール写真の顔位置を調整できるクロップ機能が必要だが、外部ライブラリの追加バンドルを避けたい" solutions={["HTML Canvas + PointerEvents で完全カスタム実装（AvatarCropModal.tsx — 約180行）", "ドラッグで位置調整、スライダー＋マウスホイールでズーム（0.5x〜3x）", "半透明オーバーレイ + arc() で円形マスクを描画、白い枠線で切り抜き範囲を可視化", "canvas.toBlob() で 400×400px の円形 PNG を出力 → fetch('/api/upload-image') で R2 に直接アップロード"]} files={["app/components/AvatarCropModal.tsx", "app/routes/portal.profile.tsx"]} color="green" />
        <TechDetail title="Stretched Link パターン — 入れ子リンク制約の回避" problem="記事カードの全体がリンク（<a>）の場合、内部に著者名リンクをネストできない（HTML仕様違反）" solutions={["カード全体を <div> に変更、タイトル <Link> に after:absolute after:inset-0 で全体をカバー", "著者名 <Link> に relative z-10 を付与してカード上に浮かせ独立クリック領域を確保", "ホーム・記事一覧・検索結果すべてに統一適用。pointer-events の衝突なし"]} files={["app/routes/_index.tsx", "app/routes/posts._index.tsx", "app/routes/search.tsx"]} color="purple" />
        <TechDetail title="デュアル認証ミドルウェア — API キー & セッション Cookie" problem="外部 AI ツールからは Bearer トークンで、ブラウザからはセッション Cookie で同一 API にアクセスしたい" solutions={["resolveUser() ミドルウェアが Authorization: Bearer cfbk_* ヘッダーを優先チェック", "Bearer なしの場合 Cookie セッションにフォールバック — 既存ブラウザ動作に影響なし", "API キーは SHA-256 ハッシュで DB 保存、プレフィックス (cfbk_) で識別、last_used_at を自動更新", "CORS 設定に Authorization ヘッダーと DELETE メソッドを追加"]} files={["app/api/middleware.ts", "app/lib/api-keys.server.ts"]} color="amber" />
        <TechDetail title="API Shield — OpenAPI スキーマバリデーション" problem="API エンドポイントに対する不正なリクエスト（未定義パス・不正メソッド・不正ボディ）をエッジレベルでブロックしたい" solutions={["OpenAPI 3.0 スキーマ (api-shield-schema.json) を作成し、全 16 エンドポイントのメソッド・パス・パラメータ・ボディを定義", "Cloudflare API Shield にスキーマを登録、Schema Validation を有効化", "multipart/form-data は API Shield 非対応のため、/api/upload-image のボディ検証はアプリ側（MIME タイプ・10MB 制限）で実施", "Bearer (cfbk_) / Session Cookie / CF Access JWT の 3 種の securitySchemes を定義"]} files={["api-shield-schema.json"]} color="blue" />
        <TechDetail title="Turnstile — チャット Bot 保護（invisible モード）" problem="チャット Q&A にボットが自動投稿する攻撃を防ぎたいが、CAPTCHA で UX を悪化させたくない" solutions={["Turnstile invisible モードを採用 — ユーザーに操作を要求せずにチャレンジを実行", "チャットパネル展開時に動的にスクリプトロード＆ウィジェット描画、メッセージ送信時にトークンを取得して POST ボディに含める", "サーバー側で siteverify API を呼び出してトークン検証、失敗時は 403 で拒否", "Fail open 設計 — TURNSTILE_SECRET_KEY 未設定時や API 通信エラー時はスキップして可用性を優先"]} files={["app/lib/turnstile.server.ts", "app/components/ChatWidget.tsx", "app/api/routes/chat.ts"]} color="green" />
        <TechDetail title="AI Gateway — AI 呼び出しのガードレール & 可観測性" problem="Workers AI への直接呼び出しではログ・レート制限・コンテンツフィルタリングを個別実装する必要がある" solutions={["ai.run() の第 3 引数に { gateway: { id } } を渡すだけで AI Gateway 経由にルーティング", "gatewayOptions() ヘルパーで AI_GATEWAY_ID 未設定時は通常呼び出しにフォールバック", "Dashboard の Guardrails 設定でプロンプト/レスポンスのコンテンツフィルタリングを追加可能", "全 AI リクエストのログ・レイテンシ・トークン使用量を一元的に可視化"]} files={["app/lib/chat.server.ts", "app/api/routes/chat.ts"]} color="purple" />
      </div>
    </div>,
  );

  /* ── Slide 11: Challenges ── */
  slides.push(
    <div key="challenges" className="mx-auto max-w-7xl px-8 py-8 sm:px-12 sm:py-10">
      <SlideHeader number={11} title="現在の課題と取り組み" />
      <div className="grid gap-8 sm:grid-cols-2">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8">
          <h3 className="mb-3 text-lg font-bold text-amber-800">課題</h3>
          <p className="mb-4 text-lg font-semibold text-gray-900">AI の表現・レスポンス精度の向上</p>
          <p className="mb-6 text-base leading-relaxed text-gray-600">
            現在の AI ドラフト生成やチャット Q&A は、Cloudflare Workers AI (Llama 3.3 70B) をベースにしていますが、
            技術的な正確さや日本語表現の自然さにはまだ改善の余地があります。
          </p>
          <h3 className="mb-3 text-lg font-bold text-green-700">取り組み</h3>
          <ul className="space-y-2 text-base text-gray-600">
            <li className="flex items-start gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-400" />プロンプトエンジニアリングの継続的な改善</li>
            <li className="flex items-start gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-400" />RAG コンテキストの品質向上（チャンク戦略の最適化）</li>
            <li className="flex items-start gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-400" />新モデルリリース時の迅速な検証・切り替え体制</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-8">
          <h3 className="mb-3 text-lg font-bold text-blue-800">課題</h3>
          <p className="mb-4 text-lg font-semibold text-gray-900">より詳細で情報量豊かなコンテンツ作成</p>
          <p className="mb-6 text-base leading-relaxed text-gray-600">
            記事に構成図やアーキテクチャダイアグラムを含めることで、読者の理解度を大幅に向上させたい。
            現状はテキスト中心の記事構成に留まっています。
          </p>
          <h3 className="mb-3 text-lg font-bold text-green-700">取り組み — サードパーティ連携</h3>
          <ul className="space-y-2 text-base text-gray-600">
            <li className="flex items-start gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-400" />構成図作成ツール連携（Mermaid / Excalidraw / draw.io 等）</li>
            <li className="flex items-start gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-400" />コードスニペットの埋め込み強化</li>
            <li className="flex items-start gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-400" />直近ロードマップに組み入れ済み — Phase 2 で対応予定</li>
          </ul>
        </div>
      </div>
    </div>,
  );

  /* ── Slide 12: Roadmap ── */
  slides.push(
    <div key="roadmap" className="mx-auto max-w-7xl px-8 py-8 sm:px-12 sm:py-10">
      <SlideHeader number={12} title="ロードマップ" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <RoadmapPhase phase="Phase 1" title="MVP" status="completed" items={["Public Blog", "User Portal", "Admin Dashboard", "認証/認可 (Access)", "基本セキュリティ"]} />
        <RoadmapPhase phase="Phase 2" title="AI & エンゲージメント" status="in-progress" items={["テンプレート AI ✅", "AI ドラフト生成 ✅", "Vectorize 検索 ✅", "AI チャット Q&A ✅", "Hono API 移行 ✅", "セマンティック検索 ✅", "投稿者申請 & プロフィール ✅", "Email 通知 ✅", "ユーザー管理 ✅", "RSS / Sitemap ✅", "著者プロフィール ✅", "アバタークロップ ✅", "Personal API Keys ✅", "Access 再認証改善 ✅", "API Shield ✅", "Turnstile ✅", "AI Gateway ✅", "AI 精度向上", "サードパーティ連携"]} />
        <RoadmapPhase phase="Phase 3" title="Advanced" status="planned" items={["Durable Objects", "Queues 非同期処理", "Logpush"]} />
        <RoadmapPhase phase="Phase 4" title="Scale" status="planned" items={["パフォーマンス最適化", "アナリティクス", "多言語対応", "コミュニティ機能", "外部連携"]} />
      </div>
    </div>,
  );

  /* ── Slide 13: Call to Action ── */
  slides.push(
    <div key="cta" className="flex h-full flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-10 text-white shadow-xl sm:p-16">
      <h2 className="mb-8 text-center text-4xl font-extrabold sm:text-5xl">
        一緒に作りませんか？
      </h2>
      <p className="mb-10 max-w-3xl text-center text-xl leading-relaxed text-gray-300">
        このプラットフォームは
        皆さんの参加で価値が生まれます。
        テンプレートに沿って入力するだけで、AI が記事のドラフトを作成し、皆様の表現や伝えたいことをアシストします。
        あなたの技術ナレッジを、世界に届けましょう。
      </p>
      <div className="grid gap-6 sm:grid-cols-3">
        <CTACard step="1" title="アカウント作成" desc="Google SSO でワンクリックログイン" />
        <CTACard step="2" title="テンプレートで記事作成" desc="メモ書きレベルの入力で OK" />
        <CTACard step="3" title="公開 & 共有" desc="お客様に URL を共有するだけ" />
      </div>
      <div className="mt-12 flex flex-wrap justify-center gap-4">
        <Link to="/portal" className="rounded-xl bg-brand-500 px-8 py-3.5 text-base font-bold text-white shadow-lg transition-colors hover:bg-brand-400">
          ポータルを開く
        </Link>
        <Link to="/about" className="rounded-xl border border-gray-600 px-8 py-3.5 text-base font-bold text-gray-300 transition-colors hover:bg-gray-700">
          技術詳細を見る
        </Link>
      </div>
    </div>,
  );

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      {/* ─ Top bar ─ */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b bg-white px-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm font-bold text-gray-900 transition-colors hover:text-brand-600">
            Cloudflare Solution Blog
          </Link>
          <span className="text-xs text-gray-300">|</span>
          <span className="text-xs font-semibold text-red-600">Presentation</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
            {current + 1} / {TOTAL_SLIDES}
          </span>
          <Link to="/admin" className="text-xs text-gray-500 transition-colors hover:text-gray-700">
            管理画面へ →
          </Link>
        </div>
      </header>

      {/* ─ Slide viewport ─ */}
      <main ref={mainRef} className="relative flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">{slides[current]}</div>
      </main>

      {/* ─ Navigation bar ─ */}
      <nav className="flex h-16 shrink-0 items-center justify-between border-t bg-white px-6 shadow-inner">
        <button
          onClick={() => go(-1)}
          disabled={current === 0}
          className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-30"
        >
          ← 前へ
        </button>
        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2.5 rounded-full transition-all ${
                i === current
                  ? "w-8 bg-brand-500"
                  : "w-2.5 bg-gray-300 hover:bg-gray-400"
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
        <button
          onClick={() => go(1)}
          disabled={current === TOTAL_SLIDES - 1}
          className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-30"
        >
          次へ →
        </button>
      </nav>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white/15 px-5 py-2 text-sm font-semibold text-white backdrop-blur-sm">
      {children}
    </span>
  );
}

function SlideHeader({ number, title }: { number: number; title: string }) {
  return (
    <div className="mb-8 flex items-center gap-5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-lg font-bold text-brand-700">
        {number}
      </span>
      <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">{title}</h2>
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
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-base font-bold text-gray-500">
        {number}
      </span>
      <h3 className="mb-2 text-lg font-bold text-red-600">課題</h3>
      <p className="mb-5 text-lg font-medium text-gray-900">{problem}</p>
      <h3 className="mb-2 text-lg font-bold text-green-600">解決</h3>
      <p className="text-base leading-relaxed text-gray-600">{solution}</p>
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
    <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-base font-bold text-brand-600">
        {number}
      </span>
      <h3 className="mb-2 text-xl font-bold text-gray-900">{title}</h3>
      <p className="text-base text-gray-500">{desc}</p>
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
      className={`rounded-2xl bg-gradient-to-br ${colors[color] ?? colors.blue} p-6 text-white shadow-lg`}
    >
      <p className="text-sm font-medium text-white/80">{label}</p>
      <p className="mt-2 text-4xl font-extrabold">
        {value}
        <span className="ml-1.5 text-base font-normal text-white/70">{sub}</span>
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
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
          highlight
            ? "bg-red-100 text-red-700"
            : "bg-gray-100 text-gray-600"
        }`}
      >
        {name[0]}
      </span>
      <div>
        <span className={`text-base font-semibold ${highlight ? "text-red-700" : "text-gray-900"}`}>
          {name}
        </span>
        <span className="ml-2 text-sm text-gray-500">{desc}</span>
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
    green: "bg-green-50 border-green-200",
  };
  const tagMap: Record<string, string> = {
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    red: "bg-red-100 text-red-700",
    green: "bg-green-100 text-green-700",
  };
  return (
    <div className={`flex gap-5 rounded-2xl border p-5 ${bgMap[color] ?? bgMap.blue}`}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-lg font-extrabold text-gray-400 shadow-sm">
        {number}
      </span>
      <div>
        <h3 className="mb-1 text-lg font-bold text-gray-900">{title}</h3>
        <p className="mb-3 text-sm leading-relaxed text-gray-600">{desc}</p>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className={`rounded-full px-3 py-0.5 text-xs font-medium ${tagMap[color] ?? tagMap.blue}`}>
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
    <div className="rounded-xl border border-red-200 bg-red-50/50 p-6">
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-sm font-bold text-red-600">
        {number}
      </span>
      <h3 className="mb-2 text-base font-bold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600">{desc}</p>
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
    <div className="flex items-center gap-3">
      <span className="shrink-0 rounded bg-gray-800 px-2 py-0.5 text-xs font-bold text-green-400">
        {method}
      </span>
      <code className="shrink-0 font-mono text-sm text-gray-700">{path}</code>
      <span className="text-sm text-gray-400">{desc}</span>
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
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
        {step}
      </span>
      <h3 className="text-base font-bold text-gray-900">{title}</h3>
      <p className="mt-1.5 text-sm text-gray-500">{desc}</p>
    </div>
  );
}

function PipelineStep({
  step,
  label,
  desc,
  color,
}: {
  step: number;
  label: string;
  desc: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700",
    gray: "bg-gray-100 text-gray-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    purple: "bg-purple-100 text-purple-700",
    green: "bg-green-100 text-green-700",
  };
  return (
    <div className="flex flex-col items-center px-4 py-6 text-center">
      <span className={`mb-2 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${colors[color] || colors.gray}`}>
        {step}
      </span>
      <h4 className="text-sm font-bold text-gray-900">{label}</h4>
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
      <h3 className="mb-3 text-lg font-bold text-gray-900">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-base text-gray-600">
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
    <div className={`rounded-xl border p-6 ${statusStyles[status]}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
            {phase}
          </p>
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeStyles[status]}`}
        >
          {badgeText[status]}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="text-sm text-gray-600">
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
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 text-base font-bold text-white">
        {step}
      </span>
      <h3 className="mt-3 text-lg font-bold text-white">{title}</h3>
      <p className="mt-1.5 text-sm text-gray-400">{desc}</p>
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
      <h3 className="mb-2 text-base font-bold text-gray-900">{title}</h3>
      <p className="mb-3 text-sm leading-relaxed text-red-700">
        <span className="font-semibold">課題:</span> {problem}
      </p>
      <ul className="mb-3 space-y-1.5">
        {solutions.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
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
