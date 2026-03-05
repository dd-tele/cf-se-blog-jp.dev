import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { requireRole } from "~/lib/auth.server";

export const meta: MetaFunction = () => [
  { title: "技術スタック詳細 — プレゼンテーション" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireRole(request, ["admin"]);
  return { user };
}

export default function PresentationStack() {
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
        <section className="mb-16 rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-brand-900 p-12 text-white shadow-xl sm:p-16">
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-brand-400">
            Technical Deep Dive
          </p>
          <h1 className="mb-4 text-4xl font-extrabold leading-tight sm:text-5xl">
            技術スタック詳細
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-gray-300">
            100% Cloudflare Stack で構築された本プラットフォームの
            各コンポーネントについて、選定理由・役割・技術的特徴を解説します。
          </p>
        </section>

        {/* ───────────────── Frontend ───────────────── */}
        <section className="mb-16">
          <SectionHeader title="フロントエンド / アプリケーション層" />

          <div className="space-y-6">
            <TechCard
              name="Remix v2"
              subtitle="フルスタック Web フレームワーク"
              role="UI レンダリング、ルーティング、データローディング、フォーム処理を統合するアプリケーションの中核。"
              why="Cloudflare Pages（Workers ランタイム）にネイティブ対応した数少ないフルスタックフレームワーク。SSR によりSEO と初期表示速度を両立し、ネストルーティングでページ単位の効率的なデータ取得が可能。React Server Components に頼らず、Web 標準（Fetch API, FormData）をベースとした設計で Workers 環境との相性が抜群。"
              details={[
                "ネストルーティング — レイアウトとデータを階層的に分離し、必要なデータだけを効率的にロード",
                "SSR (Server-Side Rendering) — Cloudflare のエッジで HTML を生成し、SEO と初期表示を最適化",
                "プログレッシブエンハンスメント — JavaScript が無効でもフォーム送信が動作",
                "Loader / Action パターン — データ取得（GET）と変更（POST）を宣言的に記述",
                "Cloudflare Pages アダプター — @remix-run/cloudflare-pages でネイティブに Workers 上で動作",
              ]}
              color="blue"
            />

            <TechCard
              name="TypeScript"
              subtitle="フルスタック型安全"
              role="フロントエンドからバックエンドまで一貫した型安全性を提供し、開発時のバグを大幅に削減。"
              why="Cloudflare Workers は TypeScript をネイティブサポート。DB スキーマ（Drizzle）、API 型（Hono）、UI（React）すべてで型を共有でき、エンドツーエンドの型安全を実現。リファクタリングの安全性を確保し、少人数での開発効率を最大化。"
              details={[
                "Drizzle ORM のスキーマ定義からクエリ結果まで型が自動伝搬",
                "Hono の c.env で Cloudflare バインディング（DB, AI, R2 等）に型付きアクセス",
                "Remix の useLoaderData で Loader の戻り値型が UI コンポーネントに自動伝搬",
                "strict モードで null/undefined の安全性を保証",
              ]}
              color="blue"
            />

            <TechCard
              name="Tailwind CSS + Typography プラグイン"
              subtitle="ユーティリティファースト CSS"
              role="UI スタイリングの統一と高速な開発サイクルを実現。Typography プラグインで Markdown 記事の美しいレンダリングを提供。"
              why="コンポーネント単位でスタイルを完結でき、CSS ファイルの肥大化を防止。PurgeCSS により本番バンドルは最小限。Design Token 的なカラーシステム（brand-*）でブランド統一。Workers 環境ではサーバーサイドの CSS-in-JS ランタイムが不要になるため、ゼロランタイムの Tailwind が最適。"
              details={[
                "ユーティリティクラスによるコンポーネント内スタイル完結 — CSS ファイルの分離・管理が不要",
                "@tailwindcss/typography — Markdown → HTML の記事表示を prose クラスで美しく整形",
                "カスタムカラー (brand-*) — Cloudflare ブランドカラーをテーマとして統合",
                "レスポンシブデザイン — sm: / md: / lg: プレフィックスでモバイル対応",
                "本番バンドルは未使用クラスを自動除去し、CSS サイズを最小化",
              ]}
              color="blue"
            />

            <TechCard
              name="Vite"
              subtitle="次世代ビルドツール"
              role="開発サーバーの高速起動（HMR）と本番ビルドの最適化を担当。"
              why="Remix v2 が公式に Vite をサポートし、ESM ネイティブの超高速な開発体験を提供。vite-tsconfig-paths でパスエイリアス（~/）を解決し、Cloudflare Workers 向けの SSR ビルドもシームレスに処理。"
              details={[
                "開発時は ESM ネイティブで即座に HMR（Hot Module Replacement）",
                "本番ビルドは Rollup ベースで最適なチャンク分割・Tree Shaking",
                "vite-tsconfig-paths プラグインで ~/ パスエイリアスを解決",
                "クライアント / サーバー の2段階ビルドを自動処理",
              ]}
              color="blue"
            />
          </div>
        </section>

        {/* ───────────────── Cloudflare Services ───────────────── */}
        <section className="mb-16">
          <SectionHeader title="Cloudflare サービス" />

          <div className="space-y-6">
            <TechCard
              name="Cloudflare Pages"
              subtitle="エッジホスティング + CI/CD"
              role="静的アセット配信と Pages Functions（Workers ランタイム）によるサーバーサイド処理のホスト。GitHub 連携で自動デプロイ。"
              why="Workers ランタイム上で Remix の SSR を実行でき、他の Cloudflare サービス（D1, R2, AI 等）へダイレクトにバインディングできる唯一のホスティング。プレビューデプロイメント、ロールバック、自動 SSL/TLS を含む。"
              details={[
                "Pages Functions — functions/[[path]].ts でキャッチオールハンドラを定義、全リクエストを Remix に委譲",
                "静的アセットはグローバル CDN で配信（キャッシュ自動管理）",
                "GitHub Actions 連携で main ブランチへの push で自動デプロイ",
                "カスタムドメイン (cf-se-blog-jp.dev) + 自動 SSL/TLS",
                "プレビューデプロイメントで PR 単位のステージング環境を提供",
              ]}
              color="orange"
            />

            <TechCard
              name="D1 — SQLite データベース"
              subtitle="エッジネイティブ SQL + Drizzle ORM"
              role="記事、ユーザー、Q&A スレッド、AI ドラフトリクエスト、テンプレート、アクセス申請など全てのリレーショナルデータを格納。"
              why="Workers ランタイムからレイテンシなしでアクセス可能な唯一のリレーショナル DB。外部 DB（Supabase, PlanetScale 等）への TCP 接続のオーバーヘッドがなく、コールドスタートのペナルティもゼロ。SQLite ベースで SQL の表現力を維持しつつ、Drizzle ORM で型安全なクエリを実現。"
              details={[
                "Drizzle ORM — TypeScript スキーマ定義からクエリまで完全型安全",
                "マイグレーション管理 — wrangler d1 migrations で本番/ローカル環境を一元管理（現在 10 マイグレーション）",
                "リレーション — posts, users, categories, tags, qa_threads, templates 等の多テーブル構成",
                "集計クエリ — SUM, COUNT, CASE WHEN でダッシュボード用のリアルタイム統計",
                "Workers バインディング — c.env.DB で直接アクセス、ネットワークホップなし",
              ]}
              color="orange"
            />

            <TechCard
              name="R2 — オブジェクトストレージ"
              subtitle="S3 互換 + エグレス無料"
              role="記事に挿入される画像・メディアファイルの格納と配信。"
              why="S3 互換 API でエグレス（転送）料金が完全無料。Workers から直接バインディングでアクセスでき、外部 CDN を経由せずにエッジから直接配信。署名付き URL やアクセス制御も Workers 内で実装可能。"
              details={[
                "画像アップロード — Hono API エンドポイント経由で R2 に直接保存",
                "配信 — /r2/* ルートで Workers がオブジェクトを取得して配信（Content-Type 自動判定）",
                "バケット名: cf-se-blog-media",
                "エグレス無料 — 画像の多いブログでもトラフィックコストがゼロ",
              ]}
              color="orange"
            />

            <TechCard
              name="Workers AI — Llama 3.3 70B + Llama Guard 3"
              subtitle="エッジ推論 AI"
              role="AI ドラフト生成、チャット Q&A、タグ提案、文章改善、トレンドレポート、コンテンツモデレーション。"
              why="外部 AI API（OpenAI, Anthropic 等）へのネットワーク遅延とコストを回避。Cloudflare のエッジで推論を実行するため、Workers との統合がシームレス。API キー管理が不要で、Workers バインディング（c.env.AI）で直接呼び出せる。Llama Guard によるコンテンツモデレーションも同じインフラ上で実行可能。"
              details={[
                "@cf/meta/llama-3.3-70b-instruct-fp8-fast — メインモデル（ドラフト生成、チャット Q&A、タグ提案、文章改善）",
                "@cf/meta/llama-guard-3-8b — コンテンツモデレーション（不適切なチャット入力をブロック）",
                "@cf/baai/bge-base-en-v1.5 — テキスト Embedding 生成（Vectorize 用）",
                "ストリーミング推論 — SSE でリアルタイムにトークンを配信（チャット Q&A）",
                "プロンプトエンジニアリング — Cloudflare 事例記事スタイルに最適化されたシステムプロンプト",
                "グラウンディングルール — 記事コンテキスト外の質問には回答しない厳密なガードレール",
              ]}
              color="orange"
            />

            <TechCard
              name="Vectorize — ベクトルデータベース"
              subtitle="セマンティック検索 + レコメンド"
              role="記事の Embedding を保存し、セマンティック検索（意味的類似度ベース）と関連記事レコメンドを実現。"
              why="Workers AI で生成した Embedding を同じ Cloudflare エコシステム内で検索でき、外部ベクトル DB（Pinecone 等）への依存を排除。Workers バインディングでミリ秒レベルのベクトル検索を実行可能。"
              details={[
                "bge-base-en-v1.5 モデルで 768 次元の Embedding を生成",
                "記事公開時に自動で Embedding を計算・保存",
                "セマンティック検索 — ユーザーの質問をベクトル化し、最も近い記事を検索",
                "関連記事 — 記事ページで類似度の高い記事を自動推薦",
                "インデックス名: cf-se-blog-vectors",
              ]}
              color="orange"
            />

            <TechCard
              name="KV — Key-Value ストア"
              subtitle="エッジ分散キャッシュ"
              role="セッション管理、ページキャッシュ、ドラフト一時保存の 3 つの用途で使用。"
              why="Workers から最も低レイテンシでアクセスできるデータストア。セッション管理では Cookie に格納する JWT の代わりに KV にセッションデータを保存し、サーバーサイドでの完全な制御を実現。ページキャッシュでは D1 クエリ結果をキャッシュしてパフォーマンスを向上。"
              details={[
                "SESSIONS — ユーザーセッション管理（ログイン状態、ロール情報）",
                "PAGE_CACHE — 記事ページの HTML / データキャッシュ（TTL 付き）",
                "DRAFTS — AI ドラフト生成結果の一時保存",
                "グローバル分散 — 世界中のエッジロケーションに自動レプリケート",
              ]}
              color="orange"
            />

            <TechCard
              name="Cloudflare Access — Zero Trust 認証"
              subtitle="SSO + RBAC"
              role="管理者・投稿者の認証とアクセス制御。投稿者申請の承認時に Access ポリシーを API で自動更新。"
              why="外部の認証サービス（Auth0, Firebase Auth 等）を使わず、Cloudflare のネットワークレイヤーで認証を実現。Google / Okta SSO 連携でエンタープライズ対応。API 経由でポリシーを動的に更新でき、投稿者オンボーディングの自動化を実現。"
              details={[
                "Google Workspace / Okta SSO 連携",
                "JWT ベースの認証 — CF-Access-JWT-Assertion ヘッダーで検証",
                "RBAC — admin / se / user の 3 ロールで機能アクセスを制御",
                "Access API 連携 — 投稿者申請の承認時にポリシーに自動追加",
                "認証画面は Cloudflare が提供 — カスタム実装不要",
              ]}
              color="orange"
            />

            <TechCard
              name="Email Workers"
              subtitle="トランザクショナルメール"
              role="投稿者申請の承認/却下通知、新規投稿通知など、システムイベントに基づくメール送信。"
              why="外部メールサービス（SendGrid, SES 等）への依存を排除。Cloudflare Workers 上でメールを直接構築・送信でき、同じインフラ内で完結。MIMEText ライブラリで HTML メールを構築し、MailChannels または Email Routing 経由で配信。"
              details={[
                "独立した Workers として実装（cf-se-blog-email-worker）",
                "メインアプリから fetch() で非同期呼び出し",
                "MIMEText で HTML メール構築",
                "投稿者申請の承認/却下、新規ユーザー登録の通知を配信",
              ]}
              color="orange"
            />

            <TechCard
              name="WAF + Bot Management"
              subtitle="アプリケーションセキュリティ"
              role="OWASP Top 10 攻撃の防御、API エンドポイント保護、ボット検知・軽減。"
              why="Cloudflare のネットワークレイヤーで自動適用されるため、アプリケーションコードの変更なしでエンタープライズグレードのセキュリティを実現。カスタムドメインを設定するだけで SQLi, XSS, CSRF 等の主要な攻撃を自動防御。"
              details={[
                "OWASP Core Ruleset — SQLi / XSS / RCE 等を自動検知・ブロック",
                "API エンドポイント保護 — /api/* パスへのレート制限・異常検知",
                "Bot Management — 自動化攻撃の検知と軽減",
                "カスタムルール — 特定パスやリクエストパターンに対する追加防御",
                "DDoS 保護 — L3/L4/L7 の全レイヤーで自動軽減",
              ]}
              color="orange"
            />
          </div>
        </section>

        {/* ───────────────── Architecture Benefits ───────────────── */}
        <section className="mb-16">
          <SectionHeader title="100% Cloudflare Stack のメリット" />
          <div className="grid gap-6 sm:grid-cols-2">
            <BenefitCard
              title="ゼロ・ネットワークホップ"
              desc="全サービスが同じランタイム内でバインディング接続。DB クエリ、AI 推論、ストレージ I/O にネットワーク遅延がない。外部 API コール時の DNS 解決、TLS ハンドシェイク、TCP 接続のオーバーヘッドを完全に排除。"
              color="green"
            />
            <BenefitCard
              title="単一ベンダーの運用効率"
              desc="インフラ、セキュリティ、認証、AI、DNS、SSL すべてが Cloudflare ダッシュボードで一元管理。複数サービスのアカウント管理、課金管理、障害対応の複雑さを排除し、少人数チームでの運用を現実的に。"
              color="blue"
            />
            <BenefitCard
              title="グローバル・エッジ実行"
              desc="V8 Isolates ベースの Workers ランタイムにより、コールドスタートなし（ミリ秒レベル起動）でグローバルに分散実行。日本のユーザーにも海外のユーザーにも、最寄りのエッジから低レイテンシで応答。"
              color="purple"
            />
            <BenefitCard
              title="段階的スケーリング"
              desc="従量課金モデルにより、初期コストほぼゼロでスタート。トラフィック増加に応じて自動スケール。Workers の同時実行制限は事実上なく、急激なスパイクにも対応可能。"
              color="amber"
            />
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
            to="/admin/presentation/hono"
            className="rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-red-500 transition-colors"
          >
            Hono 詳細 →
          </Link>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-xs text-gray-400 print:hidden">
          <p>Admin 専用 — 技術スタック詳細</p>
        </footer>
      </main>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
      <div className="mt-2 h-1 w-16 rounded-full bg-brand-500" />
    </div>
  );
}

function TechCard({
  name,
  subtitle,
  role,
  why,
  details,
  color,
}: {
  name: string;
  subtitle: string;
  role: string;
  why: string;
  details: string[];
  color: "blue" | "orange";
}) {
  const accent = color === "blue"
    ? "border-l-blue-500 bg-blue-50/30"
    : "border-l-[#F6821F] bg-orange-50/30";
  const tagBg = color === "blue"
    ? "bg-blue-100 text-blue-700"
    : "bg-orange-100 text-orange-700";

  return (
    <div className={`rounded-2xl border border-gray-200 border-l-4 ${accent} bg-white p-6 shadow-sm`}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{name}</h3>
          <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tagBg}`}>
            {subtitle}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400">
          このブログでの役割
        </h4>
        <p className="text-sm leading-relaxed text-gray-700">{role}</p>
      </div>

      <div className="mb-4">
        <h4 className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400">
          なぜこの技術なのか
        </h4>
        <p className="text-sm leading-relaxed text-gray-700">{why}</p>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
          技術的特徴
        </h4>
        <ul className="space-y-1.5">
          {details.map((d) => (
            <li key={d} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BenefitCard({
  title,
  desc,
  color,
}: {
  title: string;
  desc: string;
  color: string;
}) {
  const bg: Record<string, string> = {
    green: "border-green-200 bg-green-50",
    blue: "border-blue-200 bg-blue-50",
    purple: "border-purple-200 bg-purple-50",
    amber: "border-amber-200 bg-amber-50",
  };
  const titleColor: Record<string, string> = {
    green: "text-green-800",
    blue: "text-blue-800",
    purple: "text-purple-800",
    amber: "text-amber-800",
  };
  return (
    <div className={`rounded-2xl border p-6 ${bg[color] ?? bg.blue}`}>
      <h3 className={`mb-2 text-base font-bold ${titleColor[color] ?? titleColor.blue}`}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-gray-700">{desc}</p>
    </div>
  );
}
