import { useState } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { requireUser } from "~/lib/auth.server";
import { getActiveTemplates } from "~/lib/templates.server";

export const meta: MetaFunction = () => [
  { title: "テンプレートを選ぶ — Cloudflare Solution Blog" },
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
