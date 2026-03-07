import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { requireUser } from "~/lib/auth.server";
import { getUserBadges } from "~/lib/badges.server";
import { getDb } from "~/lib/db.server";
import { posts } from "~/db/schema";
import { eq, and, sql } from "drizzle-orm";

export const meta: MetaFunction = () => [
  { title: "ダッシュボード — Cloudflare Solution Blog" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const db = context.cloudflare.env.DB;
  const d = getDb(db);

  const [badges, statsRow] = await Promise.all([
    getUserBadges(db, user.id),
    d
      .select({
        published: sql<number>`SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END)`,
        drafts: sql<number>`SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END)`,
        pending: sql<number>`SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END)`,
        totalViews: sql<number>`SUM(view_count)`,
      })
      .from(posts)
      .where(eq(posts.author_id, user.id))
      .get(),
  ]);

  const stats = {
    published: statsRow?.published ?? 0,
    drafts: statsRow?.drafts ?? 0,
    pending: statsRow?.pending ?? 0,
    totalViews: statsRow?.totalViews ?? 0,
  };

  return { user, badges, stats };
}

export default function PortalIndex() {
  const { user, badges, stats } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Portal Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors">
              Cloudflare Solution Blog
            </Link>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm font-medium text-gray-600">
              ダッシュボード
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">
                {user.displayName}
              </div>
              <div className="text-xs text-gray-500">{user.email}</div>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                user.role === "admin"
                  ? "bg-red-100 text-red-700"
                  : user.role === "se"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-green-100 text-green-700"
              }`}
            >
              {user.role}
            </span>
            <Link
              to="/auth/logout"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              ログアウト
            </Link>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-2xl font-bold text-gray-900">
          ようこそ、{user.displayName} さん
        </h1>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Quick Actions */}
          <Link
            to="/portal/templates"
            className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-brand-300 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-gray-900 group-hover:text-brand-600">
              テンプレートで書く
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              構造化フォームに入力 → AI が下書きを自動生成
            </p>
          </Link>

          <Link
            to="/portal/new"
            className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-brand-300 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-gray-900 group-hover:text-brand-600">
              白紙から書く
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              テンプレートを使わず自由に事例を執筆
            </p>
          </Link>

          <Link
            to="/portal/posts"
            className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-brand-300 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-gray-900 group-hover:text-brand-600">
              マイ記事
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              下書き・審査中・公開済みの記事を管理
            </p>
          </Link>

          <Link
            to="/portal/profile"
            className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-brand-300 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-gray-900 group-hover:text-brand-600">
              プロフィール編集
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              名前、ニックネーム、所属、得意分野を設定
            </p>
          </Link>

          <Link
            to="/portal/template-api"
            className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-brand-300 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-gray-900 group-hover:text-brand-600">
              Template API ガイド
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              AI ツールと連携してテンプレート入力を効率化
            </p>
          </Link>

          {/* Admin-only links */}
          {(user.role === "admin" || user.role === "se") && (
            <Link
              to="/admin"
              className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-gray-400 hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-gray-700">
                管理画面
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                記事の承認キュー、ユーザー管理
              </p>
            </Link>
          )}
        </div>

        {/* Badges */}
        {badges.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Badges
            </h2>
            <div className="flex flex-wrap gap-2">
              {badges.map((b) => (
                <div
                  key={b.badgeType}
                  className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 shadow-sm"
                  title={b.badgeDescription ?? ""}
                >
                  <span className="text-base">{b.badgeIcon}</span>
                  <span className="text-xs font-medium text-gray-700">{b.badgeName}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mt-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Stats
          </h2>
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: "公開記事数", value: stats.published },
              { label: "下書き", value: stats.drafts },
              { label: "審査中", value: stats.pending },
              { label: "総閲覧数", value: stats.totalViews },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="text-2xl font-bold text-gray-900">
                  {stat.value}
                </div>
                <div className="mt-1 text-xs text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
