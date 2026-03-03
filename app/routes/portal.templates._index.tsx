import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { requireUser } from "~/lib/auth.server";
import { getActiveTemplates } from "~/lib/templates.server";

export const meta: MetaFunction = () => [
  { title: "テンプレートを選ぶ — Cloudflare Solution Blog" },
];

const DIFFICULTY_MAP: Record<string, { label: string; className: string }> = {
  beginner: { label: "初級", className: "bg-green-100 text-green-700" },
  intermediate: { label: "中級", className: "bg-yellow-100 text-yellow-700" },
  advanced: { label: "上級", className: "bg-red-100 text-red-700" },
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const db = context.cloudflare.env.DB;
  const templatesList = await getActiveTemplates(db);

  // Group by category
  const grouped: Record<string, { categoryName: string; templates: typeof templatesList }> = {};
  for (const t of templatesList) {
    const key = t.categoryId ?? "other";
    if (!grouped[key]) {
      grouped[key] = { categoryName: t.categoryName ?? "General", templates: [] };
    }
    grouped[key].templates.push(t);
  }

  return { user, grouped };
}

export default function PortalTemplates() {
  const { user, grouped } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors">
              Cloudflare Solution Blog
            </Link>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm font-medium text-gray-600">テンプレート</span>
          </div>
          <span className="text-sm text-gray-500">{user.displayName}</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">記事を書く</h1>
          <p className="mt-2 text-sm text-gray-500">
            テンプレートを使えば AI が下書きを自動生成します。白紙から自由に書くこともできます。
          </p>
        </div>

        {/* Writing mode selector */}
        <div className="mb-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border-2 border-brand-200 bg-brand-50/40 p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-600">
              Recommended
            </div>
            <h3 className="text-base font-semibold text-gray-900">
              テンプレートで書く
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">
              構造化された入力フォームに沿って記入すると、AI がブログ下書きを自動生成。生成後は自由に編集できます。
            </p>
            <span className="mt-3 inline-block text-xs text-brand-600">
              ↓ 下のテンプレートから選択
            </span>
          </div>
          <Link
            to="/portal/new"
            className="group rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-gray-400 hover:shadow-sm"
          >
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Freeform
            </div>
            <h3 className="text-base font-semibold text-gray-900 group-hover:text-brand-600">
              白紙から書く
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">
              タイトルと本文を自由に記述します。テンプレートの制約なしに、独自の構成で書きたい場合に。
            </p>
            <span className="mt-3 inline-block text-sm font-medium text-gray-600 group-hover:text-brand-600">
              エディターを開く →
            </span>
          </Link>
        </div>

        {/* Template list */}
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">テンプレート一覧</h2>
        </div>

        {Object.entries(grouped).map(([key, group]) => (
          <div key={key} className="mb-10">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
              {group.categoryName}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {group.templates.map((t) => {
                const diff = DIFFICULTY_MAP[t.difficulty] ?? DIFFICULTY_MAP.beginner;
                return (
                  <Link
                    key={t.id}
                    to={`/portal/templates/${t.id}`}
                    className="group rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-gray-400 hover:shadow-sm"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${diff.className}`}>
                        {diff.label}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        約{t.estimatedMinutes}分
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 group-hover:text-brand-600">
                      {t.name}
                    </h3>
                    {t.description && (
                      <p className="mt-1 text-sm leading-relaxed text-gray-500">
                        {t.description}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        
      </main>
    </div>
  );
}
