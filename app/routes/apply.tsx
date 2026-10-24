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
import { useState } from "react";
import { getSessionUser } from "~/lib/auth.server";
import { redirect } from "@remix-run/cloudflare";
import { TurnstileWidget } from "~/components/TurnstileWidget";
import { APPLY_HONEYPOT_FIELD, APPLY_LIMITS, APPLY_TURNSTILE_ACTION, JOB_ROLES } from "~/lib/apply-form";
import {
  checkApplyFormToken,
  checkMailDomain,
  emailDomain,
  isAllowedApplyHost,
  isDisposableDomain,
  isLocalRequest,
  issueApplyFormToken,
  parseApplyForm,
  siteHostname,
} from "~/lib/apply-guard.server";
import {
  GLOBAL_HOURLY_LIMIT,
  IP_HOURLY_LIMIT,
  createVerification,
  deleteVerification,
  isDuplicateApplication,
  purgeExpiredVerifications,
  recentVerificationCounts,
} from "~/lib/apply-verification.server";
import { verifyTurnstileToken } from "~/lib/turnstile.server";
import { sendApplyVerificationEmail } from "~/lib/email.server";
import { writeAuditLog } from "~/lib/audit.server";

export const meta: MetaFunction = () => [
  { title: "投稿者申請 — Cloudflare Field Notes" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await getSessionUser(request);
  // If already logged in, redirect to portal
  if (user) throw redirect("/portal");
  const env = context.cloudflare.env;
  return {
    formToken: await issueApplyFormToken(),
    turnstileSiteKey: env.TURNSTILE_SITE_KEY ?? "",
    hostAllowed: isAllowedApplyHost(request, env),
    siteUrl: env.SITE_URL || "https://cf-se-blog-jp.dev",
  };
}

type ActionResult = { success: true } | { error: string };

/** Same answer whether or not a mail was actually sent (no address probing). */
const ACCEPTED: ActionResult = { success: true };

export async function action({ request, context }: ActionFunctionArgs): Promise<ActionResult> {
  const env = context.cloudflare.env;
  const db = env.DB;
  const ip = request.headers.get("CF-Connecting-IP");
  const country = ((request as any).cf?.country as string | undefined) ?? null;
  const local = isLocalRequest(request);
  const blocked = (reason: string) => console.warn(`[apply] blocked: ${reason} ip=${ip ?? "-"} country=${country ?? "-"}`);

  // 1. Only on the production hostname (WAF rules apply there; *.pages.dev bypasses them).
  if (!isAllowedApplyHost(request, env)) {
    blocked("host");
    return { error: "このアドレスからは申請できません。公式サイトから申請してください。" };
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return { error: "送信内容を読み取れませんでした。ページを再読み込みしてください。" };
  }

  // 2. Honeypot: pretend success so the bot learns nothing.
  if (String(formData.get(APPLY_HONEYPOT_FIELD) ?? "") !== "") {
    blocked("honeypot");
    return ACCEPTED;
  }

  // 3. Signed render timestamp: too fast = script, too old = stale page.
  const tokenCheck = await checkApplyFormToken(formData.get("form_token") as string | null);
  if (tokenCheck !== "ok") {
    blocked(`form_token:${tokenCheck}`);
    return {
      error:
        tokenCheck === "too_fast"
          ? "送信が早すぎます。内容をご確認のうえ、もう一度送信してください。"
          : "ページの有効期限が切れました。ページを再読み込みしてもう一度お試しください。",
    };
  }

  // 4. Turnstile (fail closed outside localhost).
  if (!(local && !env.TURNSTILE_SECRET_KEY)) {
    const ts = await verifyTurnstileToken(
      env.TURNSTILE_SECRET_KEY,
      String(formData.get("cf-turnstile-response") ?? ""),
      ip ?? undefined,
      {
        failClosed: true,
        // Turnstile's dummy test secret returns no action/hostname; check them in production only.
        expectedAction: local ? undefined : APPLY_TURNSTILE_ACTION,
        allowedHostnames: local ? undefined : [siteHostname(env)],
      }
    );
    if (!ts.ok) {
      blocked(`turnstile:${ts.error}`);
      return { error: "ボット対策の確認に失敗しました。ページを再読み込みしてもう一度お試しください。" };
    }
  }

  // 5. Field validation.
  const parsed = parseApplyForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { input, emailConfirm } = parsed;
  if (input.email !== emailConfirm) {
    return { error: "メールアドレスが一致しません。確認用の欄をもう一度ご確認ください。" };
  }

  // 6. Mail domain: disposable providers and domains that cannot receive mail.
  const domain = emailDomain(input.email);
  if (isDisposableDomain(domain)) {
    blocked(`disposable:${domain}`);
    return { error: "このメールアドレスはご利用いただけません。普段お使いのアドレスで申請してください。" };
  }
  if (!local) {
    const mx = await checkMailDomain(domain);
    if (mx === "no_mail") {
      blocked(`no_mx:${domain}`);
      return { error: "メールアドレスのドメインがメールを受信できないようです。アドレスをご確認ください。" };
    }
  }

  try {
    await purgeExpiredVerifications(db);

    // 7. Duplicates: answer as if accepted, send nothing.
    if (await isDuplicateApplication(db, input.email)) {
      blocked("duplicate");
      return ACCEPTED;
    }

    // 8. Volume caps (protect sending quota and reputation).
    const counts = await recentVerificationCounts(db, ip);
    if (counts.ip >= IP_HOURLY_LIMIT || counts.global >= GLOBAL_HOURLY_LIMIT) {
      blocked(`volume ip=${counts.ip} global=${counts.global}`);
      return { error: "現在申請が集中しています。しばらく時間をおいてからお試しください。" };
    }

    // 9. Double opt-in: the request reaches admins only after the link is confirmed.
    const { id, token } = await createVerification(db, input, { ip, country });
    const base = local ? new URL(request.url).origin : (env.SITE_URL || "https://cf-se-blog-jp.dev").replace(/\/$/, "");
    const verifyUrl = `${base}/apply/verify?token=${token}`;
    const sent = await sendApplyVerificationEmail(env, input.email, input.displayName, verifyUrl);
    if (!sent.success) {
      console.error("[apply] verification mail failed:", sent.error);
      if (!local) {
        await deleteVerification(db, id);
        return { error: "確認メールを送信できませんでした。時間をおいてもう一度お試しください。" };
      }
      // Local dev without an Email Worker: print the link instead.
      console.log(`[apply] (dev) verify URL: ${verifyUrl}`);
    }

    await writeAuditLog(db, {
      action: "apply.submit",
      resourceType: "access_request",
      resourceId: id,
      details: { domain, country },
      ip: ip ?? undefined,
    });
    return ACCEPTED;
  } catch (e) {
    console.error("[apply] failed:", e);
    return { error: "申請の送信に失敗しました。時間をおいてもう一度お試しください。" };
  }
}

export default function ApplyPage() {
  const { formToken, turnstileSiteKey, hostAllowed, siteUrl } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const needsTurnstile = !!turnstileSiteKey;
  const canSubmit = !isSubmitting && (!needsTurnstile || !!turnstileToken);

  // Success state
  if (actionData && "success" in actionData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-lg rounded-2xl border bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">確認メールを送信しました</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            ご入力のメールアドレス宛てに確認メールをお送りしました。
            <strong className="text-gray-700">24 時間以内</strong>にメール内のリンクを開き、「申請を確定する」を押すと申請が完了します。
          </p>
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left">
            <p className="text-xs leading-relaxed text-gray-600">
              メールが届かない場合は、迷惑メールフォルダをご確認ください。
              すでに申請済み・登録済みのアドレスには、確認メールを再送しません。
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

  if (!hostAllowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-lg rounded-2xl border bg-white p-10 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">このアドレスからは申請できません</h1>
          <p className="mt-3 text-sm text-gray-500">公式サイトの申請フォームをご利用ください。</p>
          <a href={`${siteUrl}/apply`} className="mt-6 inline-block rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800">
            申請フォームへ
          </a>
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
            Cloudflare Field Notes
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
            Cloudflare Field Notes では、Cloudflare のエンジニアが承認したユーザーのみが記事を投稿できます。
            これは記事の品質と信頼性を維持するための仕組みです。
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-600">Step 1</div>
              <h3 className="text-sm font-semibold text-gray-900">申請フォームを送信</h3>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                下のフォームにプロフィール情報を入力し、届いた確認メールのリンクから申請を確定してください。
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-600">Step 2</div>
              <h3 className="text-sm font-semibold text-gray-900">管理者が確認</h3>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Cloudflare エンジニアが申請内容を確認します。
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
            <input type="hidden" name="form_token" value={formToken} />
            {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
              <label htmlFor={APPLY_HONEYPOT_FIELD}>Website</label>
              <input type="text" id={APPLY_HONEYPOT_FIELD} name={APPLY_HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
            </div>
            {/* Name */}
            <div>
              <label htmlFor="display_name" className="mb-1 block text-sm font-medium text-gray-700">
                名前 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="display_name"
                name="display_name"
                maxLength={APPLY_LIMITS.display_name}
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
                maxLength={APPLY_LIMITS.furigana}
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
                maxLength={APPLY_LIMITS.nickname}
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
                maxLength={APPLY_LIMITS.email}
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
                maxLength={APPLY_LIMITS.email}
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
                maxLength={APPLY_LIMITS.company}
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
                maxLength={APPLY_LIMITS.expertise}
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
                maxLength={APPLY_LIMITS.profile_comment}
                rows={3}
                placeholder="どのような記事を投稿したいか、簡単にご記入ください"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {needsTurnstile && (
              <TurnstileWidget
                siteKey={turnstileSiteKey}
                action={APPLY_TURNSTILE_ACTION}
                resetKey={actionData}
                onToken={setTurnstileToken}
              />
            )}

            <p className="text-xs leading-relaxed text-gray-400">
              送信後、ご入力のアドレスに確認メールが届きます。メール内のリンクから申請を確定すると、管理者の審査に進みます。
            </p>

            <div className="flex items-center justify-between border-t pt-6">
              <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
                トップに戻る
              </Link>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-lg bg-gray-900 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                {isSubmitting ? "送信中..." : needsTurnstile && !turnstileToken ? "確認中..." : "申請を送信"}
              </button>
            </div>
          </Form>
        </div>
      </main>
    </div>
  );
}
