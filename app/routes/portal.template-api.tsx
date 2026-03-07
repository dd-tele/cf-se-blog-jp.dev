import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { requireUser } from "~/lib/auth.server";
import { getActiveTemplates } from "~/lib/templates.server";

export const meta: MetaFunction = () => [
  { title: "Template API ガイド — Cloudflare Solution Blog" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const db = context.cloudflare.env.DB;
  const templatesList = await getActiveTemplates(db);
  const siteUrl = context.cloudflare.env.SITE_URL || "https://blog.jp.dev";
  return { user, templatesList, siteUrl };
}

export default function PortalTemplateApiGuide() {
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
            お使いの AI ツール（ChatGPT、Claude、Windsurf など）からテンプレートの情報を取得し、記事作成に活用できます。
          </p>
        </div>

        {/* Overview */}
        <Section title="概要">
          <p className="text-sm text-gray-600 leading-relaxed">
            Template API を使うと、テンプレートの一覧やフィールド定義を外部ツールから取得できます。
            これを利用して、AI ツールにフィールドに合った入力データを生成させ、テンプレート入力フォームに貼り付けて記事を効率的に作成できます。
          </p>
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-sm text-amber-800">
              <strong>認証が必要です。</strong> API を利用するにはログインセッションの Cookie が必要です。
              下記の「セッション Cookie の取得方法」を参照してください。
            </p>
          </div>
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
              curlExample={`curl -s '${siteUrl}/api/v1/templates' \\\n  -b 'cookie.txt' | jq .`}
              responseExample={`{\n  "templates": [\n    {\n      "id": "t-app-01",\n      "name": "Application Services 導入事例",\n      "categoryName": "Application Services",\n      "templateType": "case_study",\n      "estimatedMinutes": 30\n    },\n    ...\n  ]\n}`}
            />

            <Endpoint
              method="GET"
              path="/api/v1/templates/:id"
              description="テンプレートの詳細とフィールド定義を取得"
              curlExample={`curl -s '${siteUrl}/api/v1/templates/t-app-01' \\\n  -b 'cookie.txt' | jq .`}
              responseExample={`{\n  "id": "t-app-01",\n  "name": "Application Services 導入事例",\n  "templateType": "case_study",\n  "fields": [\n    {\n      "id": "service_name",\n      "label": "扱う Cloudflare サービス",\n      "type": "text",\n      "required": true\n    },\n    ...\n  ]\n}`}
            />
          </div>
        </Section>

        {/* How to get session cookie */}
        <Section title="セッション Cookie の取得方法">
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Chrome / Edge の場合</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                <li>ブログサイトにログインした状態でブラウザを開く</li>
                <li>F12 キーで DevTools を開く</li>
                <li><strong>Application</strong> タブ → <strong>Cookies</strong> → サイト URL を選択</li>
                <li><code className="bg-gray-100 px-1 py-0.5 rounded text-xs">__session</code> の値をコピー</li>
              </ol>
            </div>
            <div>
              <p className="mb-2 text-sm text-gray-600">コピーした値で cookie.txt を作成:</p>
              <CodeBlock code={`echo "${siteUrl}\tFALSE\t/\tTRUE\t0\t__session\tYOUR_SESSION_VALUE" > cookie.txt`} />
            </div>
          </div>
        </Section>

        {/* Workflow */}
        <Section title="AI ツールとの連携ワークフロー">
          <p className="mb-4 text-sm text-gray-600">
            以下の手順で、お使いの AI ツールにテンプレートのフィールド定義を渡し、入力データを生成してもらえます。
          </p>

          <div className="space-y-6">
            <WorkflowStep number={1} title="テンプレートを選ぶ">
              <p className="text-sm text-gray-600 mb-2">
                <Link to="/portal/templates" className="text-brand-600 hover:underline">テンプレート一覧</Link>
                から使いたいテンプレートの ID を確認するか、API で取得します。
              </p>
              <CodeBlock code={`curl -s '${siteUrl}/api/v1/templates' -b 'cookie.txt' | jq '.templates[] | {id, name}'`} />
            </WorkflowStep>

            <WorkflowStep number={2} title="フィールド定義を AI に渡す">
              <p className="text-sm text-gray-600 mb-2">
                テンプレートの詳細を取得し、その JSON を AI ツールに貼り付けます。
              </p>
              <CodeBlock code={`curl -s '${siteUrl}/api/v1/templates/t-app-01' -b 'cookie.txt' | jq .`} />
            </WorkflowStep>

            <WorkflowStep number={3} title="AI に入力データの生成を依頼する">
              <p className="mb-2 text-sm text-gray-600">
                AI ツールに以下のようなプロンプトを渡してください:
              </p>
              <CodeBlock code={`以下はテンプレートのフィールド定義です。各フィールドに対して、\n実際のエンジニアが書くようなリアルな入力データを生成してください。\n\n[ここにステップ2で取得した JSON を貼り付け]\n\n以下のルールに従ってください:\n- required: true のフィールドは必ず入力する\n- tag_select タイプは options から2〜4個選ぶ\n- textarea タイプはリアルな箇条書きや説明文で\n- 自分の経験に基づいた内容に書き換えても構いません`} />
            </WorkflowStep>

            <WorkflowStep number={4} title="テンプレートフォームに入力">
              <p className="text-sm text-gray-600">
                AI が生成したデータを
                <Link to="/portal/templates" className="text-brand-600 hover:underline"> テンプレート入力フォーム</Link>
                の各フィールドにコピペし、必要に応じて編集してから送信します。
                AI が下書きを自動生成し、その後自由に編集できます。
              </p>
            </WorkflowStep>
          </div>
        </Section>

        {/* Prompt templates */}
        <Section title="AI ツール別プロンプト例">
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">ChatGPT / Claude に渡すプロンプト</h3>
              <CodeBlock code={`Cloudflare Solution Blog のテンプレートを使って記事を書きたいです。\n\n以下の API からテンプレートのフィールド定義を取得しました:\n[ここに GET /api/v1/templates/:id のレスポンスを貼り付け]\n\nこのテンプレートの各フィールドに対して、以下の条件で入力データを生成してください:\n- 私は [あなたの会社名] の [あなたの職種] です\n- [使った Cloudflare サービス] を [目的] のために導入しました\n- リアルなエンジニアの記述として、箇条書きや数値データを含めてください\n- 各フィールドの placeholder を参考に、具体的な内容を書いてください`} />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Windsurf / Cascade に渡すプロンプト</h3>
              <CodeBlock code={`以下のコマンドでテンプレートのフィールド定義を取得してください:\ncurl -s '${siteUrl}/api/v1/templates/t-app-01' -b 'cookie.txt' | jq .\n\n取得したフィールド定義をもとに、各フィールドに入力するリアルなダミーデータを\nJSON 形式で生成してください。私は IT 企業のインフラエンジニアです。`} />
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
