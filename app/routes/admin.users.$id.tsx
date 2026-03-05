import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import {
  Form,
  useLoaderData,
  useActionData,
  useNavigation,
  Link,
} from "@remix-run/react";
import { redirect } from "@remix-run/cloudflare";
import { requireRole } from "~/lib/auth.server";
import { getUserById, adminUpdateUser } from "~/lib/access-requests.server";

export const meta: MetaFunction = () => [
  { title: "ユーザー編集 — Cloudflare Solution Blog" },
];

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const admin = await requireRole(request, ["admin"]);
  const db = context.cloudflare.env.DB;
  const userId = params.id!;
  const targetUser = await getUserById(db, userId);
  if (!targetUser) throw new Response("ユーザーが見つかりません", { status: 404 });
  return { admin, targetUser };
}

export async function action({ request, context, params }: ActionFunctionArgs) {
  await requireRole(request, ["admin"]);
  const db = context.cloudflare.env.DB;
  const userId = params.id!;
  const formData = await request.formData();

  const displayName = (formData.get("display_name") as string)?.trim();
  if (!displayName) {
    return { error: "名前は必須です" };
  }

  const email = (formData.get("email") as string)?.trim();
  if (!email) {
    return { error: "メールアドレスは必須です" };
  }

  const role = formData.get("role") as string;
  if (!["admin", "se", "user"].includes(role)) {
    return { error: "無効なロールです" };
  }

  const isActive = formData.get("is_active") === "true";

  await adminUpdateUser(db, userId, {
    displayName,
    email,
    nickname: (formData.get("nickname") as string) || undefined,
    furigana: (formData.get("furigana") as string) || undefined,
    company: (formData.get("company") as string) || undefined,
    jobRole: (formData.get("job_role") as string) || undefined,
    expertise: (formData.get("expertise") as string) || undefined,
    profileComment: (formData.get("profile_comment") as string) || undefined,
    bio: (formData.get("bio") as string) || undefined,
    role: role as "admin" | "se" | "user",
    isActive,
  });

  return { success: true, message: "ユーザー情報を更新しました" };
}

const JOB_ROLES = [
  "エンジニアリングマネージャー",
  "フロントエンドエンジニア",
  "バックエンドエンジニア",
  "フルスタックエンジニア",
  "インフラエンジニア",
  "SRE",
  "セキュリティエンジニア",
  "ネットワークエンジニア",
  "クラウドアーキテクト",
  "DevOps エンジニア",
  "SE / プリセールス",
  "プロジェクトマネージャー",
  "その他",
];

export default function AdminUserEdit() {
  const { admin, targetUser } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

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
            <Link to="/admin/users" className="text-sm text-gray-500 hover:text-gray-700">
              ← ユーザー管理
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{admin.displayName}</span>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {admin.role}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">ユーザー編集</h1>
        <p className="mb-8 text-sm text-gray-500">
          ID: <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{targetUser.id}</code>
        </p>

        {actionData && "error" in actionData && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionData.error}
          </div>
        )}
        {actionData && "success" in actionData && (
          <div className="mb-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            {actionData.message}
          </div>
        )}

        <Form method="post" className="space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="display_name" className="mb-1 block text-sm font-medium text-gray-700">
              名前 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="display_name"
              name="display_name"
              required
              defaultValue={targetUser.display_name}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Furigana */}
          <div>
            <label htmlFor="furigana" className="mb-1 block text-sm font-medium text-gray-700">
              よみがな
            </label>
            <input
              type="text"
              id="furigana"
              name="furigana"
              defaultValue={targetUser.furigana ?? ""}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Nickname */}
          <div>
            <label htmlFor="nickname" className="mb-1 block text-sm font-medium text-gray-700">
              ニックネーム（投稿者名）
            </label>
            <input
              type="text"
              id="nickname"
              name="nickname"
              defaultValue={targetUser.nickname ?? ""}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              defaultValue={targetUser.email}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Company */}
          <div>
            <label htmlFor="company" className="mb-1 block text-sm font-medium text-gray-700">
              所属会社
            </label>
            <input
              type="text"
              id="company"
              name="company"
              defaultValue={targetUser.company ?? ""}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Job Role */}
          <div>
            <label htmlFor="job_role" className="mb-1 block text-sm font-medium text-gray-700">
              職種
            </label>
            <select
              id="job_role"
              name="job_role"
              defaultValue={targetUser.job_role ?? ""}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">選択してください</option>
              {JOB_ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          {/* Expertise */}
          <div>
            <label htmlFor="expertise" className="mb-1 block text-sm font-medium text-gray-700">
              得意分野
            </label>
            <input
              type="text"
              id="expertise"
              name="expertise"
              defaultValue={targetUser.expertise ?? ""}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Comment */}
          <div>
            <label htmlFor="profile_comment" className="mb-1 block text-sm font-medium text-gray-700">
              ひとこと / 自己紹介
            </label>
            <textarea
              id="profile_comment"
              name="profile_comment"
              rows={3}
              defaultValue={targetUser.profile_comment ?? ""}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className="mb-1 block text-sm font-medium text-gray-700">
              Bio（詳細プロフィール）
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={2}
              defaultValue={targetUser.bio ?? ""}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="border-t pt-6">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">管理者設定</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Role */}
              <div>
                <label htmlFor="role" className="mb-1 block text-sm font-medium text-gray-700">
                  ロール
                </label>
                <select
                  id="role"
                  name="role"
                  defaultValue={targetUser.role}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="user">User</option>
                  <option value="se">SE</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Active */}
              <div>
                <label htmlFor="is_active" className="mb-1 block text-sm font-medium text-gray-700">
                  アカウント状態
                </label>
                <select
                  id="is_active"
                  name="is_active"
                  defaultValue={targetUser.is_active ? "true" : "false"}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="true">有効</option>
                  <option value="false">無効（ログイン不可）</option>
                </select>
              </div>
            </div>
          </div>

          {/* Meta info */}
          <div className="rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-400 space-y-1">
            <div>投稿承認数: {targetUser.approved_post_count}</div>
            <div>登録日: {new Date(targetUser.created_at).toLocaleString("ja-JP")}</div>
            <div>更新日: {new Date(targetUser.updated_at).toLocaleString("ja-JP")}</div>
          </div>

          <div className="flex items-center justify-between border-t pt-6">
            <Link to="/admin/users" className="text-sm text-gray-500 hover:text-gray-700">
              ← ユーザー一覧に戻る
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-brand-500 px-8 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "保存中..." : "保存する"}
            </button>
          </div>
        </Form>
      </main>
    </div>
  );
}
