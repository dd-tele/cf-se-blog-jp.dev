import type { MetaFunction } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => [
  { title: "Vibe Coding × Cloudflare — AI エージェントで実現する新しい開発体験" },
  {
    name: "description",
    content:
      "AI エージェント IDE（例：Windsurf / Cursor / Claude Code / GitHub Copilot など）と Cloudflare Developer Platform の組み合わせが生み出す、これまでにない開発体験。コーディングからデプロイ、エラー修正まですべてを IDE 内で完結。",
  },
];

export default function VibeCoding() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors">
            Cloudflare Field Notes
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/about" className="text-sm text-gray-600 hover:text-gray-900">
              このブログについて
            </Link>
            <Link to="/posts" className="text-sm text-gray-600 hover:text-gray-900">
              記事一覧
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-24 sm:py-32">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem]" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-gray-300">このブログ自体がこの手法で開発されています</span>
          </div>
          <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Vibe Coding
            <span className="block mt-2 bg-gradient-to-r from-brand-400 to-emerald-400 bg-clip-text text-transparent">
              × Cloudflare
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
            AI エージェント IDE（例：Windsurf / Cursor / Claude Code / GitHub Copilot など）と Cloudflare Developer Platform の組み合わせが生み出す、
            コーディングからデプロイ・デバッグまで<strong className="text-white">すべてを IDE 内で完結</strong>させる新しい開発体験。
          </p>
        </div>
      </section>

      {/* What is Vibe Coding */}
      <section className="border-b py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionHeader tag="01" title="Vibe Coding とは" />
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <p className="text-base leading-relaxed text-gray-600">
                「Vibe Coding」は Andrej Karpathy 氏が提唱した概念で、
                <strong className="text-gray-900">自然言語で意図を伝え、AI がコードを書く</strong>開発スタイルです。
                開発者は「何を作りたいか」のビジョンと方向性を示し、AI エージェントが実装を担当します。
              </p>
              <p className="mt-4 text-base leading-relaxed text-gray-600">
                従来の「1行ずつコードを書く」開発から、
                <strong className="text-gray-900">「対話で機能を積み上げる」</strong>開発へ。
                これは単なるコード補完ではなく、設計・実装・テスト・デプロイの全工程を AI と協働するパラダイムシフトです。
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-400">開発フローの変化</h3>
              <div className="space-y-3">
                <FlowCompare
                  before="要件定義 → 設計 → コーディング → テスト → デプロイ"
                  after="意図を伝える → AI が実装 → 確認 → 即デプロイ"
                />
                <FlowCompare
                  before="エラー発生 → ログ確認 → 原因調査 → 手動修正"
                  after="エラー発生 → AI が分析・修正 → 自動適用"
                />
                <FlowCompare
                  before="新ライブラリ → ドキュメント読解 → 試行錯誤"
                  after="「〜したい」→ AI が最適なツールを選定・統合"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Cloudflare */}
      <section className="border-b bg-gray-50 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHeader tag="02" title="なぜ Cloudflare Developer Platform と相性が良いのか" />
          <p className="mb-10 max-w-3xl text-base leading-relaxed text-gray-600">
            Vibe Coding の核心は<strong className="text-gray-900">「意図を伝えたら即座に動くものができる」</strong>こと。
            Cloudflare のプラットフォームは、この即時性と完結性を最大限に引き出す特性を備えています。
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <ReasonCard
              color="brand"
              icon={<IconZap />}
              title="統合プラットフォーム"
              desc="DB (D1)、ストレージ (R2)、AI (Workers AI)、認証 (Access)、KV キャッシュ、ベクトル検索 (Vectorize) — すべてが 1 つのプラットフォーム上に。外部サービス連携の設定不要で、AI が迷わず正しい統合コードを生成できる。"
            />
            <ReasonCard
              color="emerald"
              icon={<IconRocket />}
              title="Git Push = 即デプロイ"
              desc="AI エージェント IDE 上で git commit & push するだけで GitHub Actions → Cloudflare Pages に自動デプロイ。IDE から一歩も出ずに、数十秒で本番環境に反映される。「動くかな？」と思ったら即確認できる。"
            />
            <ReasonCard
              color="blue"
              icon={<IconStack />}
              title="ゼロ インフラ管理"
              desc="サーバーの起動、スケーリング、パッチ適用は一切不要。Cloudflare Workers の V8 Isolates がリクエストごとにゼロコールドスタートで起動。AI エージェントがインフラの心配をせず機能開発に集中できる。"
            />
            <ReasonCard
              color="purple"
              icon={<IconShield />}
              title="セキュリティが組み込み"
              desc="WAF、DDoS 防御、Bot Management、Access (Zero Trust) が最初から利用可能。AI が生成したコードに脆弱性があっても、プラットフォームレベルで防御。セキュリティは後付けではなくデフォルト。"
            />
            <ReasonCard
              color="amber"
              icon={<IconBrain />}
              title="エッジ AI ネイティブ"
              desc="Workers AI でテキスト生成、Embedding、モデレーションを呼び出すコードは ai.run() の 1 行。API キーの管理もエンドポイントの設定も不要。AI が AI を呼び出すコードを自然に書ける。"
            />
            <ReasonCard
              color="rose"
              icon={<IconCode />}
              title="wrangler.toml = 全設定"
              desc="D1 バインディング、R2 バケット、KV 名前空間、Vectorize インデックス、環境変数 — すべてが wrangler.toml に集約。AI エージェントはこの 1 ファイルを読むだけでプロジェクト全体の構成を理解できる。"
            />
          </div>
        </div>
      </section>

      {/* This Blog as Proof */}
      <section className="border-b py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHeader tag="03" title="このブログが実証していること" />
          <p className="mb-10 max-w-3xl text-base leading-relaxed text-gray-600">
            Cloudflare フィールドノート自体が、Vibe Coding（本ブログでは一例として Windsurf / Cascade を使用）と Cloudflare Developer Platform で開発されています。
            機能追加・バグ修正・デプロイのすべてが IDE 内の対話で完結しています。同様の体験は Cursor、Claude Code、GitHub Copilot など他の AI エージェント IDE でも実現可能です。
          </p>

          <div className="mb-10 rounded-2xl border-2 border-brand-200 bg-gradient-to-br from-brand-50 to-orange-50 p-8">
            <h3 className="mb-6 text-lg font-bold text-gray-900">IDE 内で完結する開発サイクル</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <CycleStep step="1" label="機能を依頼" desc="自然言語で「〜を追加して」" color="brand" />
              <CycleStep step="2" label="AI が実装" desc="Cascade がコードを書く" color="emerald" />
              <CycleStep step="3" label="ビルド確認" desc="npm run build でエラーチェック" color="blue" />
              <CycleStep step="4" label="即デプロイ" desc="git push → 自動デプロイ" color="purple" />
            </div>
          </div>

          <h3 className="mb-6 text-base font-bold text-gray-900">実際に Vibe Coding で実装された機能の例</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <ExampleCard
              title="AI チャット Q&A の多層防御"
              desc="Turnstile → スパム検出 → KV レート制限 → Llama Guard モデレーション → AI Gateway ガードレール。6 段階の防御パイプラインを対話で段階的に構築。"
              tags={["Hono SSE", "Turnstile", "KV", "Llama Guard"]}
            />
            <ExampleCard
              title="日本語 IME の Enter 送信バグ修正"
              desc="Chrome で日本語変換確定の Enter がチャット送信を誤発火する問題。compositionEnd タイムスタンプの 100ms ガードで解決。バグ報告から修正・デプロイまで数分。"
              tags={["IME", "compositionEnd", "UX"]}
            />
            <ExampleCard
              title="Cloudflare Access JWT 認証フロー"
              desc="Access JWT の署名検証失敗によるログインループ。fallback デコード戦略を設計・実装し、セッション管理を堅牢化。"
              tags={["Access", "JWT", "Session"]}
            />
            <ExampleCard
              title="AI モデルの即時切り替え"
              desc="Llama 3.3 70B から Google Gemma 4 26B A4B への全面移行。5 ファイル 12 箇所の変更を数分で完了しデプロイ。"
              tags={["Workers AI", "Gemma 4", "Migration"]}
            />
            <ExampleCard
              title="記事公開範囲（限定公開）機能"
              desc="DB スキーマ変更、マイグレーション、UI、アクセス制御ロジック、RSS/Sitemap 除外まで一連の実装を対話で完結。"
              tags={["D1", "RBAC", "Schema Migration"]}
            />
            <ExampleCard
              title="投稿者プロフィール & アバター"
              desc="Canvas ベースの円形クロップ → R2 アップロード → 著者ページ表示。フロントエンドからバックエンドまでフルスタックを一貫して構築。"
              tags={["Canvas API", "R2", "Full-stack"]}
            />
          </div>
        </div>
      </section>

      {/* Developer Experience */}
      <section className="border-b bg-gray-50 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHeader tag="04" title="開発体験の具体的なメリット" />
          <div className="grid gap-6 sm:grid-cols-2">
            <BenefitCard
              number="01"
              title="コンテキストスイッチゼロ"
              desc="ブラウザでドキュメントを検索し、ターミナルでコマンドを打ち、エディタに戻って…という往復が消滅。IDE 内の対話だけで設計・実装・デプロイが完結する。"
              highlight="集中力を途切れさせない開発フロー"
            />
            <BenefitCard
              number="02"
              title="試行錯誤のコストが激減"
              desc="「この方法でうまくいく？」→ 即実装 → ビルド → デプロイ → 確認。失敗しても元に戻すのは一瞬。仮説検証のサイクルが分単位に短縮される。"
              highlight="アイデアから検証まで数分"
            />
            <BenefitCard
              number="03"
              title="フルスタックの壁が下がる"
              desc="DB スキーマ設計、サーバーサイド API、フロントエンド UI、認証フロー、デプロイ設定 — 全レイヤーを AI と協働でカバー。専門外の領域でも高品質なコードが生成される。"
              highlight="一人で全レイヤーをカバー"
            />
            <BenefitCard
              number="04"
              title="エラー修復の劇的な高速化"
              desc="ビルドエラー、ランタイムエラー、ブラウザ固有の挙動差 — AI がエラーメッセージを分析し、根本原因を特定して修正案を即座に適用。デバッグ時間が大幅に短縮。"
              highlight="エラー → 原因特定 → 修正を一息で"
            />
          </div>
        </div>
      </section>

      {/* Tech Stack Synergy */}
      <section className="border-b py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionHeader tag="05" title="Cloudflare サービス × Vibe Coding の相乗効果" />
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Cloudflare サービス</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Vibe Coding との相性</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <SynergyRow service="Workers / Pages" desc="git push で即デプロイ。AI が書いたコードを数秒で本番反映できる即時性。" />
                <SynergyRow service="D1" desc="Drizzle ORM + マイグレーション。AI が型安全なスキーマ変更を生成し、wrangler d1 migrations apply で即適用。" />
                <SynergyRow service="R2" desc="S3 互換 API でファイルアップロード。AI が署名付き URL やストリーミングアップロードを正しく実装。" />
                <SynergyRow service="Workers AI" desc="ai.run() の 1 行で LLM 呼び出し。API キー不要で AI が AI を呼ぶコードを迷わず生成。" />
                <SynergyRow service="Vectorize" desc="Embedding → ベクトル DB → 類似検索。RAG パイプラインを対話で段階的に構築。" />
                <SynergyRow service="KV" desc="シンプルな Key-Value。セッション、レート制限、キャッシュを AI が即座にパターン実装。" />
                <SynergyRow service="Access" desc="Zero Trust 認証を wrangler.toml + ダッシュボード設定で追加。JWT 検証コードは AI が生成。" />
                <SynergyRow service="AI Gateway" desc="ai.run() に gateway オプションを足すだけ。ガードレール・ログ・分析をコード変更なしで追加。" />
                <SynergyRow service="Turnstile" desc="Bot 保護。invisible モードのスクリプトロード → トークン取得 → サーバー検証を AI がフルスタックで実装。" />
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-20 text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            あなたも Vibe Coding を始めてみませんか？
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-gray-400">
            お好みの AI エージェント IDE（Windsurf / Cursor / Claude Code / GitHub Copilot など）と Cloudflare Developer Platform があれば、アイデアをすぐに形にできます。
            このブログ自体がその証明です（一例として Windsurf を使用）。
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://www.windsurf.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-white px-8 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-100"
              title="一例として Windsurf を紹介しています"
            >
              Windsurf を試す（一例）
            </a>
            <a
              href="https://developers.cloudflare.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-white/20 bg-white/10 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-white/20"
            >
              Cloudflare Developer Docs
            </a>
            <Link
              to="/about"
              className="rounded-lg border border-white/20 bg-white/10 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-white/20"
            >
              このブログの技術詳細
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-900 py-10 text-gray-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Link to="/" className="text-sm font-medium text-gray-400 hover:text-gray-300 transition-colors">
              Cloudflare Field Notes
            </Link>
            <span className="text-xs text-gray-600">
              Built with Vibe Coding — AI Agent IDE × Cloudflare Developer Platform
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Helper Components ─────────────────────────────────────── */

function SectionHeader({ tag, title }: { tag: string; title: string }) {
  return (
    <div className="mb-8">
      <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand-500">{tag}</span>
      <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h2>
    </div>
  );
}

function FlowCompare({ before, after }: { before: string; after: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-400 line-through">{before}</p>
      <p className="text-sm font-medium text-gray-700">{after}</p>
    </div>
  );
}

function ReasonCard({
  color,
  icon,
  title,
  desc,
}: {
  color: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  const borderColors: Record<string, string> = {
    brand: "border-brand-200 bg-brand-50/50",
    emerald: "border-emerald-200 bg-emerald-50/50",
    blue: "border-blue-200 bg-blue-50/50",
    purple: "border-purple-200 bg-purple-50/50",
    amber: "border-amber-200 bg-amber-50/50",
    rose: "border-rose-200 bg-rose-50/50",
  };
  const titleColors: Record<string, string> = {
    brand: "text-brand-700",
    emerald: "text-emerald-700",
    blue: "text-blue-700",
    purple: "text-purple-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
  };
  return (
    <div className={`rounded-xl border p-5 ${borderColors[color] ?? ""}`}>
      <div className="mb-3">{icon}</div>
      <h3 className={`mb-2 text-base font-bold ${titleColors[color] ?? ""}`}>{title}</h3>
      <p className="text-sm leading-relaxed text-gray-600">{desc}</p>
    </div>
  );
}

function CycleStep({
  step,
  label,
  desc,
  color,
}: {
  step: string;
  label: string;
  desc: string;
  color: string;
}) {
  const bgColors: Record<string, string> = {
    brand: "bg-brand-500",
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    purple: "bg-purple-500",
  };
  return (
    <div className="text-center">
      <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${bgColors[color] ?? "bg-gray-500"}`}>
        {step}
      </div>
      <p className="text-sm font-bold text-gray-900">{label}</p>
      <p className="mt-0.5 text-xs text-gray-500">{desc}</p>
    </div>
  );
}

function ExampleCard({
  title,
  desc,
  tags,
}: {
  title: string;
  desc: string;
  tags: string[];
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h4 className="mb-2 text-sm font-bold text-gray-900">{title}</h4>
      <p className="text-sm leading-relaxed text-gray-600">{desc}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function BenefitCard({
  number,
  title,
  desc,
  highlight,
}: {
  number: string;
  title: string;
  desc: string;
  highlight: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <span className="mb-3 inline-block rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-bold text-white">
        {number}
      </span>
      <h3 className="mb-2 text-base font-bold text-gray-900">{title}</h3>
      <p className="text-sm leading-relaxed text-gray-600">{desc}</p>
      <p className="mt-3 text-xs font-semibold text-brand-600">{highlight}</p>
    </div>
  );
}

function SynergyRow({ service, desc }: { service: string; desc: string }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="whitespace-nowrap px-6 py-3 font-medium text-gray-900">{service}</td>
      <td className="px-6 py-3 text-gray-600">{desc}</td>
    </tr>
  );
}

/* ── Icons ─────────────────────────────────────────────────── */

function IconZap() {
  return (
    <svg className="h-6 w-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function IconRocket() {
  return (
    <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 003.02-11.65A14.98 14.98 0 007.3 4.75m8.29 9.62L7.3 4.75M4.72 12.54l4.46 4.46" />
    </svg>
  );
}

function IconStack() {
  return (
    <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg className="h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function IconBrain() {
  return (
    <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function IconCode() {
  return (
    <svg className="h-6 w-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}
