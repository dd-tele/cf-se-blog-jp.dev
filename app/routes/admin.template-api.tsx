import { useState } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { requireRole } from "~/lib/auth.server";
import { getActiveTemplates } from "~/lib/templates.server";
import { listApiKeys } from "~/lib/api-keys.server";

export const meta: MetaFunction = () => [
  { title: "Template API ドキュメント — Cloudflare Solution Blog" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireRole(request, ["admin"]);
  const db = context.cloudflare.env.DB;
  const templatesList = await getActiveTemplates(db);
  const siteUrl = context.cloudflare.env.SITE_URL || "https://blog.jp.dev";
  return { user, templatesList, siteUrl };
}

export default function TemplateApiDocs() {
  const { user, templatesList, siteUrl } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors">
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
              <Link to="/admin/presentation" className="text-gray-500 hover:text-gray-700">
                プレゼン
              </Link>
              <Link to="/admin/template-api" className="font-medium text-brand-600">
                Template API
              </Link>
              <Link to="/portal" className="text-gray-500 hover:text-gray-700">
                ポータル
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user.displayName}</span>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {user.role}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Template API ドキュメント</h1>
          <p className="mt-2 text-sm text-gray-500">
            外部ツールや生成 AI 環境からテンプレートを使って記事を自動生成するための API です。
          </p>
        </div>

        {/* Overview */}
        <Section title="概要">
          <p className="text-sm text-gray-600 leading-relaxed">
            この API を使うと、テンプレートのフィールド定義を取得し、AI にダミー入力を生成させてから記事を作成できます。
            Gemini、ChatGPT、Claude、Windsurf などの生成 AI 環境から API キーで認証して利用できます。
          </p>
          <div className="mt-4 rounded-lg bg-brand-50 border border-brand-200 px-4 py-3">
            <p className="text-sm text-brand-800">
              <strong>認証方法:</strong> <code className="bg-white px-1 py-0.5 rounded text-xs">Authorization: Bearer YOUR_API_KEY</code> ヘッダーを付けてください。
              API キーは <Link to="/portal/template-api" className="underline font-medium">ポータルの Template API ガイド</Link> から作成できます。
            </p>
          </div>
        </Section>

        {/* AI Guide API */}
        <Section title="AI ツール用ガイド API（推奨）">
          <div className="rounded-lg bg-brand-50 border border-brand-200 px-4 py-3 mb-4">
            <p className="text-sm text-brand-800">
              <strong>1回の API コールで全テンプレートのフィールド定義と手順を取得できます。</strong>
              Gemini や ChatGPT に以下の curl を実行させるだけで、テンプレートの構造を理解して記事を作成できます。
              admin/SE ユーザーの場合、POST で下書き作成までの手順も含まれます。
            </p>
          </div>
          <CodeBlock>{`curl -s '${siteUrl}/api/v1/ai-guide' \\
  -H 'Authorization: Bearer YOUR_API_KEY' | jq .`}</CodeBlock>
        </Section>

        {/* Base URL */}
        <Section title="ベース URL">
          <CodeBlock>{siteUrl}</CodeBlock>
        </Section>

        {/* Endpoints */}
        <Section title="エンドポイント一覧">
          <div className="space-y-6">
            <Endpoint
              method="GET"
              path="/api/v1/ai-guide"
              description="AI ツール用ガイド — 全テンプレートのフィールド定義と手順を一括取得（推奨）"
              curlExample={`curl -s '${siteUrl}/api/v1/ai-guide' \\
  -H 'Authorization: Bearer YOUR_API_KEY' | jq .`}
              responseExample={`{
  "guide": {
    "system": "Cloudflare Solution Blog",
    "workflow": ["1. テンプレートを選ぶ", "2. fields を確認", ...],
    "test_generate_api": { ... }
  },
  "templates": [ { "id": "t-zt-01", "fields": [...] }, ... ]
}`}
            />

            <Endpoint
              method="GET"
              path="/api/v1/templates"
              description="有効なテンプレート一覧を取得"
              curlExample={`curl -s '${siteUrl}/api/v1/templates' \\
  -H 'Authorization: Bearer YOUR_API_KEY' | jq .`}
              responseExample={`{
  "templates": [
    {
      "id": "t-app-01",
      "name": "Application Services 導入事例",
      "categoryName": "Application Services",
      "templateType": "case_study",
      "estimatedMinutes": 30
    },
    ...
  ]
}`}
            />

            <Endpoint
              method="GET"
              path="/api/v1/templates/:id"
              description="テンプレートの詳細とフィールド定義を取得"
              curlExample={`curl -s '${siteUrl}/api/v1/templates/t-app-01' \\
  -H 'Authorization: Bearer YOUR_API_KEY' | jq .`}
              responseExample={`{
  "id": "t-app-01",
  "name": "Application Services 導入事例",
  "templateType": "case_study",
  "fields": [
    {
      "id": "service_name",
      "label": "扱う Cloudflare サービス",
      "type": "text",
      "required": true,
      "placeholder": "例: WAF, CDN, Load Balancing"
    },
    ...
  ]
}`}
            />

            <Endpoint
              method="POST"
              path="/api/v1/templates/:id/test-generate"
              description="AI がダミー入力を生成し、記事を自動作成（admin/se のみ）"
              curlExample={`# すべて AI に任せる（デフォルト: realistic トーン）
curl -s -X POST '${siteUrl}/api/v1/templates/t-zt-01/test-generate' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' | jq .

# トーンを指定（casual = いい加減な入力）
curl -s -X POST '${siteUrl}/api/v1/templates/t-app-01/test-generate' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"tone": "casual"}' | jq .

# 一部フィールドを自分で指定、残りは AI 生成
curl -s -X POST '${siteUrl}/api/v1/templates/t-dev-01/test-generate' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "company_name": "株式会社テスト",
    "tone": "detailed",
    "overrides": {
      "app_name": "社内ナレッジベース",
      "why_cloudflare": "コールドスタートが許容できなかった"
    }
  }' | jq .`}
              responseExample={`{
  "success": true,
  "postId": "01JXXXX...",
  "title": "Cloudflare Access と Gateway を活用した...",
  "templateId": "t-zt-01",
  "templateName": "Zero Trust 導入事例",
  "tone": "realistic",
  "generatedInputs": { ... },
  "latencyMs": 18234,
  "editUrl": "/portal/edit/01JXXXX..."
}`}
            />
          </div>
        </Section>

        {/* Tone Options */}
        <Section title="tone パラメータ">
          <p className="mb-3 text-sm text-gray-600">
            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">test-generate</code> エンドポイントの
            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">tone</code> で AI が生成するダミー入力のスタイルを制御できます。
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-2 text-left font-medium text-gray-700">tone</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">説明</th>
              </tr>
            </thead>
            <tbody>
              <ToneRow tone="realistic" desc="実際のエンジニアが書くようなリアルで具体的な内容。数値データ含む。（デフォルト）" />
              <ToneRow tone="casual" desc="超いい加減で雑なメモ書き風。箇条書き・省略・ラフな表現。" />
              <ToneRow tone="detailed" desc="非常に詳細で丁寧。背景説明が豊富で、比較検討も含む。" />
              <ToneRow tone="minimal" desc="最低限の情報のみ。1〜2行の短文。" />
            </tbody>
          </table>
        </Section>

        {/* AI tool copy-paste prompts */}
        <Section title="AI ツール別コピペ用プロンプト">
          <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-sm text-amber-800">
              <strong>重要:</strong> Gemini や ChatGPT は HTTP リクエストを直接実行できません。
              AI にはコマンドを<strong>生成してもらい</strong>、出力された curl コマンドを<strong>ご自身のターミナルで実行</strong>してください。
            </p>
          </div>

          <div className="mb-6">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">ワンステップ生成（最も簡単・AI 不要）</h3>
            <p className="mb-2 text-sm text-gray-600">
              以下の curl を<strong>ターミナルで直接実行</strong>するだけで、トピックに合った記事が自動生成されます。
            </p>
            <CodeBlock>{`# Zero Trust の記事を自動生成（トピックを変えるだけ）
curl -s -X POST '${siteUrl}/api/v1/templates/quick-generate' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"topic": "Zero Trust", "tone": "realistic"}' | jq .

# 他のトピック例: "WAF", "Workers", "SASE", "CDN", "DNS"`}</CodeBlock>
          </div>

          <p className="mb-4 text-sm text-gray-600">
            AI ツールを活用したい場合は、以下のプロンプトを貼り付けてください。<code className="bg-gray-100 px-1 py-0.5 rounded text-xs">YOUR_API_KEY</code> を API キーに置き換えてください。
          </p>
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Gemini に渡すプロンプト</h3>
              <CodeBlock>{`Cloudflare Solution Blog の記事を生成するための curl コマンドを作ってほしいです。

以下の API で記事を生成できます（topic にトピックを指定するだけ）:
POST ${siteUrl}/api/v1/templates/quick-generate
ヘッダー: Authorization: Bearer YOUR_API_KEY, Content-Type: application/json
ボディ: {"topic": "書きたいトピック", "tone": "realistic"}

以下の条件で、実行可能な curl コマンドを出力してください:
- トピック: Zero Trust（Cloudflare Access / Gateway を使った導入事例）
- tone: realistic
- API Key: YOUR_API_KEY

出力はターミナルで直接コピペ実行できる curl コマンドのみでお願いします。`}</CodeBlock>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Windsurf / Cascade に渡すプロンプト</h3>
              <CodeBlock>{`以下の curl コマンドを実行して、Cloudflare Solution Blog に下書き記事を作成してください。

curl -s -X POST '${siteUrl}/api/v1/templates/quick-generate' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"topic": "Zero Trust", "tone": "realistic"}'

レスポンスの editUrl を教えてください。`}</CodeBlock>
            </div>
          </div>
        </Section>

        {/* Template List */}
        <Section title="利用可能なテンプレート">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-2 text-left font-medium text-gray-700">ID</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">名前</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">カテゴリ</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">タイプ</th>
                </tr>
              </thead>
              <tbody>
                {templatesList.map((t) => (
                  <tr key={t.id} className="border-b">
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">{t.id}</td>
                    <td className="px-3 py-2 text-gray-900">{t.name}</td>
                    <td className="px-3 py-2 text-gray-500">{t.categoryName}</td>
                    <td className="px-3 py-2">
                      <TemplateTypeBadge type={t.templateType} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Quick test buttons */}
        <Section title="クイックテスト">
          <p className="mb-4 text-sm text-gray-600">
            ブラウザからワンクリックでテスト記事を生成できます（ログイン済みセッションを使用）。
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {templatesList.slice(0, 8).map((t) => (
              <QuickTestCard key={t.id} template={t} />
            ))}
          </div>
        </Section>
      </main>
    </div>
  );
}

// ─── Components ──────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="mb-4 text-lg font-bold text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-gray-100">
      <code>{children}</code>
    </pre>
  );
}

function Endpoint({
  method,
  path,
  description,
  curlExample,
  responseExample,
}: {
  method: string;
  path: string;
  description: string;
  curlExample: string;
  responseExample: string;
}) {
  const methodColor = method === "GET" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700";
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="border-b bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-bold ${methodColor}`}>{method}</span>
          <code className="text-sm font-semibold text-gray-900">{path}</code>
        </div>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <p className="mb-1 text-xs font-medium text-gray-500">curl 例</p>
          <CodeBlock>{curlExample}</CodeBlock>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-gray-500">レスポンス例</p>
          <CodeBlock>{responseExample}</CodeBlock>
        </div>
      </div>
    </div>
  );
}

function ToneRow({ tone, desc }: { tone: string; desc: string }) {
  return (
    <tr className="border-b">
      <td className="px-4 py-2">
        <code className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono">{tone}</code>
      </td>
      <td className="px-4 py-2 text-gray-600">{desc}</td>
    </tr>
  );
}

function TemplateTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    case_study: "bg-blue-100 text-blue-700",
    solution: "bg-purple-100 text-purple-700",
    tips: "bg-amber-100 text-amber-700",
  };
  const labels: Record<string, string> = {
    case_study: "導入事例",
    solution: "ソリューション",
    tips: "Tips",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[type] ?? styles.case_study}`}>
      {labels[type] ?? type}
    </span>
  );
}

function QuickTestCard({ template }: { template: { id: string; name: string; categoryName: string | null; templateType: string } }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; postId?: string; editUrl?: string; error?: string } | null>(null);

  const tones = ["realistic", "casual", "detailed", "minimal"] as const;
  const [selectedTone, setSelectedTone] = useState<string>("realistic");

  async function handleGenerate() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/v1/templates/${template.id}/test-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone: selectedTone }),
      });
      const data = await res.json();
      setResult(data as any);
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <TemplateTypeBadge type={template.templateType} />
        <span className="text-xs text-gray-400">{template.categoryName}</span>
      </div>
      <h3 className="mb-3 text-sm font-semibold text-gray-900">{template.name}</h3>

      <div className="mb-3 flex gap-1">
        {tones.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSelectedTone(t)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
              selectedTone === t
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="w-full rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "生成中..." : "テスト記事を生成"}
      </button>

      {result && (
        <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {result.success ? (
            <>
              記事作成完了{" "}
              <a href={result.editUrl} className="font-medium underline">
                編集する →
              </a>
            </>
          ) : (
            <>エラー: {result.error}</>
          )}
        </div>
      )}
    </div>
  );
}
