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
  const canTestGenerate = user.role === "admin" || user.role === "se" || user.role === "ae";
  return { user, templatesList, apiKeysList, siteUrl, canTestGenerate };
}

export default function PortalTemplateApiGuide() {
  const { user, templatesList, apiKeysList, siteUrl, canTestGenerate } = useLoaderData<typeof loader>();

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
            お使いの AI ツール（Gemini、ChatGPT、Claude 等）でフィールド入力データを生成し、テンプレートフォームに JSON インポートして記事を作成できます。
          </p>
        </div>

        {/* New Workflow */}
        <Section title="AI ツール連携ワークフロー">
          <div className="rounded-lg bg-brand-50 border border-brand-200 px-4 py-3 mb-6">
            <p className="text-sm text-brand-800">
              <strong>API キー不要・curl 不要。</strong>テンプレートフォーム上の「AI ツール連携 / JSON インポート」パネルだけで完結します。
            </p>
          </div>

          <div className="space-y-6">
            <WorkflowStep number={1} title="テンプレートを選ぶ">
              <p className="text-sm text-gray-600">
                <Link to="/portal/templates" className="text-brand-600 hover:underline">テンプレート一覧</Link>
                から書きたい記事のテーマに合うテンプレートを選び、フォームを開きます。
              </p>
            </WorkflowStep>

            <WorkflowStep number={2} title="フィールド定義をコピー">
              <p className="text-sm text-gray-600">
                フォーム上部の「<strong>AI ツール連携 / JSON インポート</strong>」パネルを開き、「<strong>フィールド定義をコピー</strong>」ボタンをクリックします。
              </p>
            </WorkflowStep>

            <WorkflowStep number={3} title="AI に書きたい内容のエッセンスと一緒に渡す">
              <p className="mb-2 text-sm text-gray-600">
                コピーしたフィールド定義を Gemini や ChatGPT に貼り付け、書きたい記事のエッセンスを添えて送信します。
              </p>
              <CodeBlock code={`[ここにフィールド定義を貼り付け]\n\n私は IT 企業のインフラエンジニアです。\n以下の内容で各フィールドの入力データを JSON で出力してください。\n\n・Cloudflare Access と Gateway を使って社内 VPN を廃止した\n・Azure AD 連携で SAML SSO を実装\n・VPN 機器の保守コスト年間 120 万円を削減\n・ログイン遅延が 2.5 秒→0.8 秒に改善`} />
            </WorkflowStep>

            <WorkflowStep number={4} title="JSON をインポート">
              <p className="text-sm text-gray-600">
                AI が出力した JSON をフォームの「<strong>JSON をインポート</strong>」欄に貼り付けてインポートすると、全フィールドが自動入力されます。
                必要に応じて内容を編集してください。
              </p>
            </WorkflowStep>

            <WorkflowStep number={5} title="送信して記事を生成">
              <p className="text-sm text-gray-600">
                「<strong>AI で下書き生成</strong>」をクリックすると、Workers AI が入力データをもとにブログ記事を自動生成し、下書きとして保存します。
              </p>
            </WorkflowStep>
          </div>
        </Section>

        {/* API Key Management — now secondary */}
        <Section title="API キー管理（上級者向け）">
          <p className="mb-4 text-sm text-gray-600">
            curl や Windsurf/Cascade などのツールから直接 API を呼びたい場合は、API キーを作成してください。
            JSON インポートだけで十分な場合はこのセクションは不要です。
          </p>
          <ApiKeyManager initialKeys={apiKeysList} siteUrl={siteUrl} />
        </Section>

        {/* API Endpoints — collapsed for advanced users */}
        <Section title="API エンドポイント（上級者向け）">
          <p className="mb-4 text-sm text-gray-600">
            API キーを使ってターミナルやコードから直接テンプレート情報を取得できます。
          </p>
          <div className="space-y-6">
            <Endpoint
              method="GET"
              path="/api/v1/ai-guide"
              description="全テンプレートのフィールド定義と手順を一括取得（推奨）"
              curlExample={`curl -s '${siteUrl}/api/v1/ai-guide' \\\n  -H 'Authorization: Bearer YOUR_API_KEY' | jq .`}
            />
            <Endpoint
              method="GET"
              path="/api/v1/templates"
              description="テンプレート一覧を取得"
              curlExample={`curl -s '${siteUrl}/api/v1/templates' \\\n  -H 'Authorization: Bearer YOUR_API_KEY' | jq .`}
            />
            <Endpoint
              method="GET"
              path="/api/v1/templates/:id"
              description="テンプレートの詳細とフィールド定義を取得"
              curlExample={`curl -s '${siteUrl}/api/v1/templates/t-app-01' \\\n  -H 'Authorization: Bearer YOUR_API_KEY' | jq .`}
            />
          </div>
        </Section>

        {/* API Key Security Notice */}
        <div className="mb-10 rounded-xl border border-green-200 bg-green-50 p-5">
          <h2 className="mb-3 text-base font-bold text-green-900">API キーの安全性について</h2>
          <p className="mb-3 text-sm leading-relaxed text-green-800">
            API キーは<strong>安全に利用できる</strong>設計になっています。
          </p>
          <ul className="mb-3 space-y-2 text-sm text-green-800">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-green-600">&#10003;</span>
              <span><strong>できるのはテンプレート情報の閲覧と下書き作成だけ</strong> — 記事の公開・削除・ユーザー情報へのアクセスはできません</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-green-600">&#10003;</span>
              <span><strong>あなたのデータだけに限定</strong> — キーはあなたのアカウントに紐づいており、他のユーザーの記事やデータには一切触れません</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-green-600">&#10003;</span>
              <span><strong>いつでも無効化・再作成できます</strong> — 不安になったら上の一覧から「無効化」するだけで即座に使えなくなります</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-green-600">&#10003;</span>
              <span><strong>キーはサーバーに安全に保存</strong> — データベースにはハッシュ化された値のみ保存されるため、万が一の漏洩時もキー自体は復元できません</span>
            </li>
          </ul>
          <p className="text-xs text-green-700">
            Windsurf / Cascade などのコーディングアシスタントにキーを渡す場合も、上記の通りできることは限定的です。気になる場合は、使用後にキーを無効化して新しく作り直す運用もおすすめです。
          </p>
        </div>

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
        API キーを使うと、ターミナル（curl）やコーディングアシスタント（Windsurf / Cascade 等）からブラウザのログイン不要で API を呼べます。
        Gemini・ChatGPT・Claude などのチャット型 AI は HTTP リクエストを直接実行できないため、AI には「フィールド定義をコピー」で JSON 生成を依頼し、このサイトのフォームからインポートしてください。
      </p>

      {/* Create key — only if no active key exists */}
      {keys.some((k) => k.isActive) ? (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
          既に有効な API キーがあります。新しいキーを作成するには、既存のキーを削除してください。
        </div>
      ) : (
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
      )}

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
          <CodeBlock code={curlExample} />
        </div>
        {responseExample && (
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">レスポンス例</p>
            <CodeBlock code={responseExample} />
          </div>
        )}
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
