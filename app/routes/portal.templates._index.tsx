import { useState } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { requireUser } from "~/lib/auth.server";
import { getActiveTemplates } from "~/lib/templates.server";

export const meta: MetaFunction = () => [
  { title: "テンプレートを選ぶ — Cloudflare フィールドノート" },
];

const TYPE_MAP: Record<string, { label: string; className: string }> = {
  case_study: { label: "導入事例", className: "bg-blue-100 text-blue-700" },
  solution: { label: "ソリューション", className: "bg-purple-100 text-purple-700" },
  tips: { label: "Tips", className: "bg-amber-100 text-amber-700" },
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const user = await requireUser(request, env);
  const db = env.DB;
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

  // Build category list for filter
  const categoryList = Object.entries(grouped).map(([key, g]) => ({
    id: key,
    name: g.categoryName,
    count: g.templates.length,
  }));

  return { user, grouped, categoryList };
}

export default function PortalTemplates() {
  const { user, grouped, categoryList } = useLoaderData<typeof loader>();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

  // Flatten and filter
  const allTemplates = Object.entries(grouped).flatMap(([, g]) => g.templates);
  const filtered = allTemplates.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || (t.categoryId ?? "other") === selectedCategory;
    const matchesType =
      selectedType === "all" || t.templateType === selectedType;
    return matchesSearch && matchesCategory && matchesType;
  });

  // Group filtered results by category
  const filteredGrouped: Record<string, { categoryName: string; templates: typeof allTemplates }> = {};
  for (const t of filtered) {
    const key = t.categoryId ?? "other";
    if (!filteredGrouped[key]) {
      const catName = grouped[key]?.categoryName ?? "General";
      filteredGrouped[key] = { categoryName: catName, templates: [] };
    }
    filteredGrouped[key].templates.push(t);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors">
              Cloudflare Field Notes
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
          {/* Template mode – brand orange */}
          <div className="relative rounded-xl border-2 border-brand-200 bg-gradient-to-br from-brand-50 to-orange-50 p-6">
            <span className="absolute -top-2.5 left-4 rounded-full bg-brand-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
              おすすめ
            </span>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900">
              テンプレートで書く
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
              フォームに沿って記入するだけで <span className="font-medium text-brand-700">AI がブログ下書きを自動生成</span>。初めての方や、構成に迷ったときに最適。
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">AI 自動生成</span>
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">構造化フォーム</span>
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">初心者向け</span>
            </div>
            <span className="mt-4 inline-block text-xs font-medium text-brand-600">
              ↓ 下のテンプレートから選択
            </span>
          </div>

          {/* Freeform mode – teal/emerald */}
          <Link
            to="/portal/new"
            className="group relative rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 transition-all hover:border-emerald-300 hover:shadow-md"
          >
            <span className="absolute -top-2.5 left-4 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
              おすすめ
            </span>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 group-hover:text-emerald-700">
              Markdown フリーフォーム
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
              Markdown を<span className="font-medium text-emerald-700">そのまま貼り付け</span>て記事を作成。ChatGPT・Claude などの AI 出力や、他のブログからの<span className="font-medium text-emerald-700">記事移行</span>に最適。
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Markdown 貼り付け</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">AI 出力の取り込み</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">記事移行</span>
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-600 group-hover:text-emerald-700">
              エディターを開く
              <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        </div>

        {/* Search & Filter */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">テンプレート一覧</h2>
            <span className="text-xs text-gray-400">{filtered.length} 件</span>
          </div>

          {/* Search input */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="テンプレートを検索..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />

          {/* Filter buttons */}
          <div className="flex flex-wrap gap-4">
            {/* Category filter */}
            <div className="flex flex-wrap gap-1.5">
              <FilterButton
                active={selectedCategory === "all"}
                onClick={() => setSelectedCategory("all")}
              >
                全カテゴリ
              </FilterButton>
              {categoryList.map((cat) => (
                <FilterButton
                  key={cat.id}
                  active={selectedCategory === cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                  <span className="ml-1 text-[10px] opacity-60">{cat.count}</span>
                </FilterButton>
              ))}
            </div>

            {/* Type filter */}
            <div className="flex gap-1.5 border-l border-gray-200 pl-4">
              <FilterButton
                active={selectedType === "all"}
                onClick={() => setSelectedType("all")}
              >
                全タイプ
              </FilterButton>
              {Object.entries(TYPE_MAP).map(([key, val]) => (
                <FilterButton
                  key={key}
                  active={selectedType === key}
                  onClick={() => setSelectedType(key)}
                >
                  {val.label}
                </FilterButton>
              ))}
            </div>
          </div>
        </div>

        {/* Template list */}
        {Object.keys(filteredGrouped).length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <p className="text-sm text-gray-400">
              条件に一致するテンプレートがありません
            </p>
          </div>
        ) : (
          Object.entries(filteredGrouped).map(([key, group]) => (
            <div key={key} className="mb-10">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
                {group.categoryName}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {group.templates.map((t) => {
                  const typeInfo = TYPE_MAP[t.templateType] ?? TYPE_MAP.case_study;
                  return (
                    <Link
                      key={t.id}
                      to={`/portal/templates/${t.id}`}
                      className="group rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-gray-400 hover:shadow-sm"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${typeInfo.className}`}>
                          {typeInfo.label}
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
          ))
        )}
      </main>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-gray-900 text-white"
          : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}
