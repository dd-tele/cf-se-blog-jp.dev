import { useState, useCallback } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { requireUser } from "~/lib/auth.server";
import { getActiveTemplates } from "~/lib/templates.server";
import { listApiKeys } from "~/lib/api-keys.server";

export const meta: MetaFunction = () => [
  { title: "Template API ガイド — Cloudflare Solution Blog" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const db = context.cloudflare.env.DB;
  const templatesList = await getActiveTemplates(db);
  const apiKeysList = await listApiKeys(db, user.id);
  const siteUrl = context.cloudflare.env.SITE_URL || "https://blog.jp.dev";
  return { user, templatesList, apiKeysList, siteUrl };
}

export default function PortalTemplateApiGuide() {
  const { user, templatesList, apiKeysList, siteUrl } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors">
              Cloudflare Solution Blog
            </Link>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm font-medium text-gray-600">Template API ガイド</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/portal/templates" className="text-sm text-gray-500 hover:text-gray-700">テンプレート</Link>
            <Link to="/portal" className="text-sm text-gray-500 hover:text-gray-700">ダッシュボード</Link>
            <span className="text-sm text-gray-500">{user.displayName}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Template API ガイド</h1>
          <p className="mt-2 text-sm text-gray-500">
            お使いの AI ツール（Gemini、ChatGPT、Claude、Windsurf など）から API キーで認証し、テンプレート情報の取得や記事作成に活用できます。
          </p>
        </div>

        {/* API Key Management */}
        <Section title="API キー管理">
          <ApiKeyManager initialKeys={apiKeysList} siteUrl={siteUrl} />
        </Section>

        {/* Quick Start */}
        <Section title="クイックスタート">
          <p className="mb-4 text-sm text-gray-600">
            API キーを作成したら、<code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Authorization: Bearer YOUR_API_KEY</code> ヘッダーで API を呼べます。
          </p>
          <CodeBlock code={`# テンプレート一覧を取得\ncurl -s '${siteUrl}/api/v1/templates' \\\n  -H 'Authorization: Bearer YOUR_API_KEY' | jq .\n\n# テンプレートの詳細（フィールド定義）を取得\ncurl -s '${siteUrl}/api/v1/templates/t-app-01' \\\n  -H 'Authorization: Bearer YOUR_API_KEY' | jq .`} />
        </Section>

        {/* Base URL */}
        <Section title="ベース URL">
          <CodeBlock code={siteUrl} />
        </Section>

        {/* Endpoints */}
        <Section title="利用可能なエンドポイント">
          <div className="space-y-6">
            <Endpoint
              method="GET"
              path="/api/v1/templates"
              description="有効なテンプレート一覧を取得"
              curlExample={`curl -s '${siteUrl}/api/v1/templates' \\\n  -H 'Authorization: Bearer YOUR_API_KEY' | jq .`}
              responseExample={`{\n  "templates": [\n    {\n      "id": "t-app-01",\n      "name": "Application Services 導入事例",\n      "categoryName": "Application Services",\n      "templateType": "case_study",\n      "estimatedMinutes": 30\n    },\n    ...\n  ]\n}`}
            />

            <Endpoint
              method="GET"
              path="/api/v1/templates/:id"
              description="テンプレートの詳細とフィールド定義を取得 — AI ツールにこの情報を渡すとフィールドに合った入力データを生成できます"
              curlExample={`curl -s '${siteUrl}/api/v1/templates/t-app-01' \\\n  -H 'Authorization: Bearer YOUR_API_KEY' | jq .`}
              responseExample={`{\n  "id": "t-app-01",\n  "name": "Application Services 導入事例",\n  "templateType": "case_study",\n  "fields": [\n    {\n      "id": "service_name",\n      "label": "扱う Cloudflare サービス",\n      "type": "text",\n      "required": true\n    },\n    ...\n  ]\n}`}
            />
          </div>
        </Section>

        {/* Workflow */}
        <Section title="AI ツールとの連携ワークフロー">
          <p className="mb-4 text-sm text-gray-600">
            以下の手順で、お使いの AI ツールにテンプレートのフィールド定義を渡し、入力データを生成してもらえます。
          </p>

          <div className="space-y-6">
            <WorkflowStep number={1} title="API キーを作成">
              <p className="text-sm text-gray-600">
                上の「API キー管理」セクションで API キーを作成し、安全な場所に保存してください。
              </p>
            </WorkflowStep>

            <WorkflowStep number={2} title="テンプレートを選ぶ">
              <p className="text-sm text-gray-600 mb-2">
                <Link to="/portal/templates" className="text-brand-600 hover:underline">テンプレート一覧</Link>
                から使いたいテンプレートの ID を確認するか、API で取得します。
              </p>
              <CodeBlock code={`curl -s '${siteUrl}/api/v1/templates' \\\n  -H 'Authorization: Bearer YOUR_API_KEY' | jq '.templates[] | {id, name}'`} />
            </WorkflowStep>

            <WorkflowStep number={3} title="フィールド定義を AI に渡す">
              <p className="text-sm text-gray-600 mb-2">
                テンプレートの詳細を取得し、その JSON を AI ツールに貼り付けます。
              </p>
              <CodeBlock code={`curl -s '${siteUrl}/api/v1/templates/t-app-01' \\\n  -H 'Authorization: Bearer YOUR_API_KEY' | jq .`} />
            </WorkflowStep>

            <WorkflowStep number={4} title="AI に入力データの生成を依頼する">
              <p className="mb-2 text-sm text-gray-600">
                AI ツールに以下のようなプロンプトを渡してください:
              </p>
              <CodeBlock code={`以下はテンプレートのフィールド定義です。各フィールドに対して、\n実際のエンジニアが書くようなリアルな入力データを生成してください。\n\n[ここにステップ3で取得した JSON を貼り付け]\n\n以下のルールに従ってください:\n- required: true のフィールドは必ず入力する\n- tag_select タイプは options から2〜4個選ぶ\n- textarea タイプはリアルな箇条書きや説明文で\n- 自分の経験に基づいた内容に書き換えても構いません`} />
            </WorkflowStep>

            <WorkflowStep number={5} title="テンプレートフォームに入力">
              <p className="text-sm text-gray-600">
                AI が生成したデータを
                <Link to="/portal/templates" className="text-brand-600 hover:underline"> テンプレート入力フォーム</Link>
                の各フィールドにコピペし、必要に応じて編集してから送信します。
              </p>
            </WorkflowStep>
          </div>
        </Section>

        {/* Prompt templates */}
        <Section title="AI ツール別プロンプト例">
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Gemini / ChatGPT / Claude に渡すプロンプト</h3>
              <CodeBlock code={`Cloudflare Solution Blog のテンプレートを使って記事を書きたいです。\n\n以下の API からテンプレートのフィールド定義を取得しました:\n[ここに GET /api/v1/templates/:id のレスポンスを貼り付け]\n\nこのテンプレートの各フィールドに対して、以下の条件で入力データを生成してください:\n- 私は [あなたの会社名] の [あなたの職種] です\n- [使った Cloudflare サービス] を [目的] のために導入しました\n- リアルなエンジニアの記述として、箇条書きや数値データを含めてください\n- 各フィールドの placeholder を参考に、具体的な内容を書いてください`} />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Gemini（API 直接呼び出し）に渡すプロンプト</h3>
              <CodeBlock code={`以下の curl で Cloudflare Solution Blog のテンプレート情報を取得してください:\n\ncurl -s '${siteUrl}/api/v1/templates' \\\n  -H 'Authorization: Bearer YOUR_API_KEY'\n\n取得したテンプレート一覧から適切なものを選び、\ncurl -s '${siteUrl}/api/v1/templates/TEMPLATE_ID' \\\n  -H 'Authorization: Bearer YOUR_API_KEY'\nでフィールド定義を取得してください。\n\n取得したフィールド定義をもとに、各フィールドに入力するリアルなデータを\nJSON 形式で生成してください。私は IT 企業のインフラエンジニアです。`} />
            </div>
          </div>
        </Section>

        {/* Template list */}
        <Section title="利用可能なテンプレート">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-2 text-left font-medium text-gray-700">ID</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">名前</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">カテゴリ</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">タイプ</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700"></th>
                </tr>
              </thead>
              <tbody>
                {templatesList.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">{t.id}</td>
                    <td className="px-3 py-2 text-gray-900">{t.name}</td>
                    <td className="px-3 py-2 text-gray-500">{t.categoryName}</td>
                    <td className="px-3 py-2">
                      <TemplateTypeBadge type={t.templateType} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to={`/portal/templates/${t.id}`}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        フォームを開く
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </main>
    </div>
  );
}

// ─── Components ──────────────────────────────────────────────────

function ApiKeyManager({ initialKeys, siteUrl }: { initialKeys: any[]; siteUrl: string }) {
  const [keys, setKeys] = useState(initialKeys);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createKey = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCreatedKey(null);
    try {
      const res = await fetch(`${siteUrl}/api/v1/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName || "My API Key" }),
        credentials: "include",
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error || "Failed to create key");
      setCreatedKey(data.key);
      setKeys((prev) => [
        { id: data.id, name: data.name, keyPrefix: data.prefix, isActive: true, lastUsedAt: null, createdAt: new Date().toISOString() },
        ...prev,
      ]);
      setNewKeyName("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [newKeyName, siteUrl]);

  const revokeKey = useCallback(async (keyId: string) => {
    if (!confirm("このキーを無効化しますか？")) return;
    try {
      const res = await fetch(`${siteUrl}/api/v1/api-keys/${keyId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setKeys((prev) => prev.map((k) => k.id === keyId ? { ...k, isActive: false } : k));
      }
    } catch { /* ignore */ }
  }, [siteUrl]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        API キーを使えば、Cookie 不要で外部の AI ツール（Gemini、ChatGPT、Claude 等）から直接 API を呼べます。
      </p>

      {/* Create key */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="キー名（例: Gemini 用）"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          onClick={createKey}
          disabled={loading}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "作成中..." : "キーを作成"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Show newly created key */}
      {createdKey && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-green-800">API キーが作成されました（この画面でのみ表示）</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-white px-3 py-2 text-xs font-mono text-gray-900 border">{createdKey}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(createdKey); }}
              className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700"
            >
              コピー
            </button>
          </div>
          <p className="mt-2 text-xs text-green-700">このキーは安全な場所に保存してください。再表示はできません。</p>
        </div>
      )}

      {/* Key list */}
      {keys.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-3 py-2 text-left font-medium text-gray-700">名前</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">キー</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">状態</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">最終使用</th>
                <th className="px-3 py-2 text-right font-medium text-gray-700"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b">
                  <td className="px-3 py-2 text-gray-900">{k.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{k.keyPrefix}</td>
                  <td className="px-3 py-2">
                    {k.isActive ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">有効</span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">無効</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{k.lastUsedAt || "未使用"}</td>
                  <td className="px-3 py-2 text-right">
                    {k.isActive && (
                      <button
                        onClick={() => revokeKey(k.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        無効化
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="mb-4 text-lg font-bold text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-gray-100">
      <code>{code}</code>
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
          <CodeBlock code={curlExample} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-gray-500">レスポンス例</p>
          <CodeBlock code={responseExample} />
        </div>
      </div>
    </div>
  );
}

function WorkflowStep({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
        {number}
      </div>
      <div className="flex-1">
        <h3 className="mb-2 text-sm font-semibold text-gray-900">{title}</h3>
        {children}
      </div>
    </div>
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
