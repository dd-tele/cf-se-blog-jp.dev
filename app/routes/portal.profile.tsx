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
import { requireUser } from "~/lib/auth.server";
import { getUserProfile, updateUserProfile } from "~/lib/access-requests.server";

export const meta: MetaFunction = () => [
  { title: "プロフィール編集 — Cloudflare Solution Blog" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const db = context.cloudflare.env.DB;
  const profile = await getUserProfile(db, user.id);
  return { user, profile };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const db = context.cloudflare.env.DB;
  const formData = await request.formData();

  const displayName = (formData.get("display_name") as string)?.trim();
  if (!displayName) {
    return { error: "名前は必須です" };
  }

  await updateUserProfile(db, user.id, {
    displayName,
    nickname: (formData.get("nickname") as string) || undefined,
    furigana: (formData.get("furigana") as string) || undefined,
    company: (formData.get("company") as string) || undefined,
    jobRole: (formData.get("job_role") as string) || undefined,
    expertise: (formData.get("expertise") as string) || undefined,
    profileComment: (formData.get("profile_comment") as string) || undefined,
    bio: (formData.get("bio") as string) || undefined,
  });

  return { success: true, message: "プロフィールを更新しました" };
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

export default function PortalProfile() {
  const { user, profile } = useLoaderData<typeof loader>();
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
            <Link to="/portal" className="text-sm text-gray-500 hover:text-gray-700">
              ← ダッシュボード
            </Link>
          </div>
          <span className="text-sm text-gray-500">{user.displayName}</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">プロフィール編集</h1>
        <p className="mb-8 text-sm text-gray-500">
          投稿者名にはニックネームが使用されます。ニックネーム未設定の場合は名前が表示されます。
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
              defaultValue={profile?.display_name ?? user.displayName}
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
              defaultValue={profile?.furigana ?? ""}
              placeholder="やまだ たろう"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Nickname */}
          <div>
            <label htmlFor="nickname" className="mb-1 block text-sm font-medium text-gray-700">
              ニックネーム（投稿者名として表示）
            </label>
            <input
              type="text"
              id="nickname"
              name="nickname"
              defaultValue={profile?.nickname ?? ""}
              placeholder="ブログに表示される名前"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              未設定の場合は「名前」が投稿者名に使用されます。
            </p>
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <input
              type="email"
              value={profile?.email ?? user.email}
              disabled
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              メールアドレスは Cloudflare Access で管理されているため変更できません。
            </p>
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
              defaultValue={profile?.company ?? ""}
              placeholder="株式会社〇〇"
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
              defaultValue={profile?.job_role ?? ""}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">選択してください</option>
              {JOB_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
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
              defaultValue={profile?.expertise ?? ""}
              placeholder="Zero Trust, Workers, WAF, ネットワーク設計 など"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Comment / Bio */}
          <div>
            <label htmlFor="profile_comment" className="mb-1 block text-sm font-medium text-gray-700">
              ひとこと / 自己紹介
            </label>
            <textarea
              id="profile_comment"
              name="profile_comment"
              rows={3}
              defaultValue={profile?.profile_comment ?? ""}
              placeholder="簡単な自己紹介やコメントを記入してください"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center justify-between border-t pt-6">
            <Link to="/portal" className="text-sm text-gray-500 hover:text-gray-700">
              ダッシュボードに戻る
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
