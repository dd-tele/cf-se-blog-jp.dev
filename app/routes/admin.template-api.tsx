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

        {/* Overview — JSON import workflow */}
        <Section title="概要">
          <p className="text-sm text-gray-600 leading-relaxed">
            AI ツール（Gemini、ChatGPT、Claude 等）でフィールド入力データを生成し、テンプレートフォームに JSON インポートして記事を作成できます。
          </p>
          <div className="mt-4 rounded-lg bg-brand-50 border border-brand-200 px-4 py-3">
            <p className="text-sm text-brand-800">
              <strong>推奨ワークフロー:</strong> テンプレートフォームの「AI ツール連携 / JSON インポート」パネルを使えば、API キー不要で完結します。
              詳しくは <Link to="/portal/template-api" className="underline font-medium">ポータルの Template API ガイド</Link> をご覧ください。
            </p>
          </div>
        </Section>

        {/* JSON Import Workflow */}
        <Section title="AI ツール連携ワークフロー">
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">1</div>
              <p className="text-sm text-gray-600 pt-0.5"><Link to="/portal/templates" className="text-brand-600 hover:underline">テンプレート一覧</Link>から書きたいテーマのフォームを開く</p>
            </div>
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">2</div>
              <p className="text-sm text-gray-600 pt-0.5">「<strong>フィールド定義をコピー</strong>」→ AI ツールに貼り付け、書きたい内容のエッセンスと一緒に送信</p>
            </div>
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">3</div>
              <p className="text-sm text-gray-600 pt-0.5">AI が出力した JSON を「<strong>JSON をインポート</strong>」→ フィールドが自動入力される</p>
            </div>
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">4</div>
              <p className="text-sm text-gray-600 pt-0.5">内容を確認・編集して「<strong>AI で下書き生成</strong>」をクリック</p>
            </div>
          </div>
        </Section>

        {/* API Endpoints — for advanced/admin users */}
        <Section title="API エンドポイント（上級者向け）">
          <p className="mb-2 text-sm text-gray-600">
            curl や Windsurf/Cascade などから直接 API を呼ぶ場合は、<code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Authorization: Bearer YOUR_API_KEY</code> ヘッダーを付けてください。
            API キーは <Link to="/portal/template-api" className="underline font-medium text-brand-600">ポータルの Template API ガイド</Link> から作成できます。
          </p>
          <div className="mt-4 space-y-6">
            <Endpoint
              method="GET"
              path="/api/v1/ai-guide"
              description="全テンプレートのフィールド定義と手順を一括取得（推奨）"
              curlExample={`curl -s '${siteUrl}/api/v1/ai-guide' \\
  -H 'Authorization: Bearer YOUR_API_KEY' | jq .`}
            />

            <Endpoint
              method="GET"
              path="/api/v1/templates"
              description="テンプレート一覧を取得"
              curlExample={`curl -s '${siteUrl}/api/v1/templates' \\
  -H 'Authorization: Bearer YOUR_API_KEY' | jq .`}
            />

            <Endpoint
              method="GET"
              path="/api/v1/templates/:id"
              description="テンプレートの詳細とフィールド定義を取得"
              curlExample={`curl -s '${siteUrl}/api/v1/templates/t-app-01' \\
  -H 'Authorization: Bearer YOUR_API_KEY' | jq .`}
            />

            <Endpoint
              method="POST"
              path="/api/v1/templates/:id/test-generate"
              description="AI がダミー入力を生成し記事を自動作成（admin/se のみ）"
              curlExample={`curl -s -X POST '${siteUrl}/api/v1/templates/t-zt-01/test-generate' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"tone": "realistic"}' | jq .`}
              responseExample={`{
  "success": true,
  "postId": "01JXXXX...",
  "title": "自動生成されたタイトル",
  "editUrl": "/portal/edit/01JXXXX..."
}`}
            />

            <Endpoint
              method="POST"
              path="/api/v1/templates/quick-generate"
              description="トピックキーワードでテンプレート自動選択＋記事生成（admin/se のみ）"
              curlExample={`curl -s -X POST '${siteUrl}/api/v1/templates/quick-generate' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"topic": "Zero Trust", "tone": "realistic"}' | jq .`}
              responseExample={`{
  "success": true,
  "postId": "01JXXXX...",
  "title": "自動生成されたタイトル",
  "templateId": "t-zt-01",
  "editUrl": "/portal/edit/01JXXXX..."
}`}
            />
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
  responseExample?: string;
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
        {responseExample && (
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">レスポンス例</p>
            <CodeBlock>{responseExample}</CodeBlock>
          </div>
        )}
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
