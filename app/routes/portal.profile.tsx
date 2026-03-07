import { useState, useRef, useCallback } from "react";
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
import { AvatarCropModal } from "~/components/AvatarCropModal";

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

  // Avatar URL update (from client-side upload)
  const avatarUrl = formData.get("avatar_url") as string | null;
  if (avatarUrl !== null) {
    await updateUserProfile(db, user.id, { avatarUrl });
    return { success: true, message: "プロフィール写真を更新しました" };
  }

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

  // Avatar upload state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url ?? null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("画像ファイルを選択してください");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAvatarError("ファイルサイズが大きすぎます（最大 10MB）");
      return;
    }
    setAvatarError(null);
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }, []);

  const handleCrop = useCallback(async (blob: Blob) => {
    setCropSrc(null);
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      // Upload to R2
      const formData = new FormData();
      formData.append("file", blob, "avatar.png");
      const uploadRes = await fetch("/api/upload-image", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({ error: "アップロードに失敗しました" }));
        throw new Error((err as any).error || "アップロードに失敗しました");
      }
      const { url } = await uploadRes.json() as { url: string };
      setAvatarPreview(url);

      // Save avatar_url to DB via form action
      const saveForm = new FormData();
      saveForm.append("avatar_url", url);
      await fetch("/portal/profile", { method: "POST", body: saveForm });
    } catch (err: any) {
      setAvatarError(err.message || "アップロードに失敗しました");
    } finally {
      setAvatarUploading(false);
    }
  }, []);

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

        {/* Avatar Upload Section */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
          <label className="mb-3 block text-sm font-medium text-gray-700">プロフィール写真</label>
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-gray-200 bg-gray-100">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-gray-400">
                    {(profile?.nickname || profile?.display_name || user.displayName)?.charAt(0) ?? "?"}
                  </span>
                )}
              </div>
              {avatarUploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                  <svg className="h-6 w-6 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                写真を変更
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <p className="mt-2 text-xs text-gray-400">
                JPEG, PNG, WebP, GIF（最大 10MB）。アップロード後に顔の位置を調整できます。
              </p>
              {avatarError && (
                <p className="mt-1 text-xs text-red-600">{avatarError}</p>
              )}
            </div>
          </div>
        </div>

        {/* Crop Modal */}
        {cropSrc && (
          <AvatarCropModal
            imageSrc={cropSrc}
            onCrop={handleCrop}
            onClose={() => setCropSrc(null)}
          />
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
