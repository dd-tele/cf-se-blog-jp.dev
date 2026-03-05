import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import {
  Form,
  useActionData,
  useNavigation,
  Link,
  useLoaderData,
} from "@remix-run/react";
import { getSessionUser } from "~/lib/auth.server";
import { createAccessRequest, registerEmailDestination } from "~/lib/access-requests.server";
import { redirect } from "@remix-run/cloudflare";

export const meta: MetaFunction = () => [
  { title: "投稿者申請 — Cloudflare Solution Blog" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getSessionUser(request);
  // If already logged in, redirect to portal
  if (user) throw redirect("/portal");
  return { ok: true };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const formData = await request.formData();
  const db = context.cloudflare.env.DB;

  const email = (formData.get("email") as string)?.trim();
  const emailConfirm = (formData.get("email_confirm") as string)?.trim();
  const displayName = (formData.get("display_name") as string)?.trim();

  if (!email || !displayName) {
    return { error: "名前とメールアドレスは必須です" };
  }

  // Email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "正しいメールアドレスを入力してください" };
  }

  // Email confirmation check
  if (email !== emailConfirm) {
    return { error: "メールアドレスが一致しません。確認用の欄をもう一度ご確認ください。" };
  }

  try {
    const env = context.cloudflare.env;

    await createAccessRequest(db, {
      email,
      displayName,
      nickname: (formData.get("nickname") as string) || undefined,
      furigana: (formData.get("furigana") as string) || undefined,
      company: (formData.get("company") as string) || undefined,
      jobRole: (formData.get("job_role") as string) || undefined,
      expertise: (formData.get("expertise") as string) || undefined,
      profileComment: (formData.get("profile_comment") as string) || undefined,
    });

    // Register email as Email Routing destination (triggers verification email)
    const emailRegResult = await registerEmailDestination(env, email);

    return { success: true, emailVerification: emailRegResult.success };
  } catch (e: any) {
    return { error: `申請の送信に失敗しました: ${e.message}` };
  }
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

export default function ApplyPage() {
  useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Success state
  if (actionData && "success" in actionData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-lg rounded-2xl border bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">申請を受け付けました</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            管理者が申請内容を確認し、承認されると投稿が可能になります。
          </p>
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-left">
            <p className="text-sm font-medium text-amber-800">
              ✉️ メールアドレスの確認をお願いします
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">
              ご登録のメールアドレスに Cloudflare から確認メールが届きます。
              メール内の「メール アドレスを確認」ボタンをクリックするだけで完了です。
              （ダッシュボードへのログインは不要です）
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">
              確認が完了すると、申請の承認時に通知メールをお送りできます。
            </p>
          </div>
          <Link
            to="/"
            className="mt-8 inline-block rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            トップページに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors">
            Cloudflare Solution Blog
          </Link>
          <a
            href="/portal"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            ログイン
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Explanation Section */}
        <div className="mb-10 rounded-2xl border bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">投稿者になるには</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            Cloudflare Solution Blog では、Cloudflare のエンジニアが承認したユーザーのみが記事を投稿できます。
            これは記事の品質と信頼性を維持するための仕組みです。
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-600">Step 1</div>
              <h3 className="text-sm font-semibold text-gray-900">申請フォームを送信</h3>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                下のフォームにプロフィール情報を入力して申請してください。
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-600">Step 2</div>
              <h3 className="text-sm font-semibold text-gray-900">管理者が審査</h3>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Cloudflare エンジニアが申請内容を確認し、承認または却下を判断します。
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-600">Step 3</div>
              <h3 className="text-sm font-semibold text-gray-900">ログイン＆投稿開始</h3>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                承認後、Cloudflare Access 経由でログインし、記事を投稿できるようになります。
              </p>
            </div>
          </div>
        </div>

        {/* Application Form */}
        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <h2 className="mb-1 text-xl font-bold text-gray-900">投稿者申請フォーム</h2>
          <p className="mb-6 text-sm text-gray-500">
            以下の情報を入力してください。<span className="text-red-500">*</span> は必須項目です。
          </p>

          {actionData && "error" in actionData && (
            <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {actionData.error}
            </div>
          )}

          <Form method="post" className="space-y-5">
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
                placeholder="山田 太郎"
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
                placeholder="ブログに表示される名前"
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
                placeholder="name@example.com"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                承認後、このアドレスで Cloudflare Access にログインできるようになります。
              </p>
            </div>

            {/* Email Confirm */}
            <div>
              <label htmlFor="email_confirm" className="mb-1 block text-sm font-medium text-gray-700">
                メールアドレス（確認） <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email_confirm"
                name="email_confirm"
                required
                placeholder="もう一度入力してください"
                autoComplete="off"
                onPaste={(e) => e.preventDefault()}
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
                placeholder="Zero Trust, Workers, WAF, ネットワーク設計 など"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Comment */}
            <div>
              <label htmlFor="profile_comment" className="mb-1 block text-sm font-medium text-gray-700">
                ひとこと / 申請理由
              </label>
              <textarea
                id="profile_comment"
                name="profile_comment"
                rows={3}
                placeholder="どのような記事を投稿したいか、簡単にご記入ください"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="flex items-center justify-between border-t pt-6">
              <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
                トップに戻る
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-gray-900 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                {isSubmitting ? "送信中..." : "申請を送信"}
              </button>
            </div>
          </Form>
        </div>
      </main>
    </div>
  );
}
