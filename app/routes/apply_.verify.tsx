import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { isWellFormedVerificationToken, maskEmail } from "~/lib/apply-guard.server";
import { confirmVerification, findLiveVerification } from "~/lib/apply-verification.server";
import { writeAuditLog } from "~/lib/audit.server";

export const meta: MetaFunction = () => [
  { title: "申請の確定 — Cloudflare Field Notes" },
  // The token is in the URL; never leak it via Referer.
  { name: "referrer", content: "no-referrer" },
  { name: "robots", content: "noindex" },
];

// GET only shows a confirm button. Mail security scanners prefetch links, so the
// application is created on POST (a human pressing the button), not on GET.
export async function loader({ request, context }: LoaderFunctionArgs) {
  const token = new URL(request.url).searchParams.get("token");
  if (!isWellFormedVerificationToken(token)) return { state: "invalid" as const, token: "", email: "" };
  const row = await findLiveVerification(context.cloudflare.env.DB, token);
  if (!row) return { state: "invalid" as const, token: "", email: "" };
  return { state: "ready" as const, token, email: maskEmail(row.email) };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const db = context.cloudflare.env.DB;
  const form = await request.formData().catch(() => null);
  const token = form?.get("token");
  if (typeof token !== "string" || !isWellFormedVerificationToken(token)) return { done: false as const };
  try {
    const result = await confirmVerification(db, token);
    if (!result.ok) return { done: false as const };
    if (result.requestId) {
      await writeAuditLog(db, {
        action: "apply.verify",
        resourceType: "access_request",
        resourceId: result.requestId,
        ip: request.headers.get("CF-Connecting-IP") ?? undefined,
      });
    }
    return { done: true as const };
  } catch (e) {
    console.error("[apply/verify] failed:", e);
    return { done: false as const };
  }
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg rounded-2xl border bg-white p-10 text-center shadow-sm">{children}</div>
    </div>
  );
}

export default function ApplyVerify() {
  const data = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const busy = useNavigation().state === "submitting";

  if (result?.done) {
    return (
      <Card>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">申請が完了しました</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-500">
          管理者が申請内容を確認します。承認されると、ご登録のアドレスにお知らせメールが届き、Cloudflare Access からログインできるようになります。
        </p>
        <Link to="/" className="mt-8 inline-block rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800">
          トップページに戻る
        </Link>
      </Card>
    );
  }

  if (data.state === "invalid" || result?.done === false) {
    return (
      <Card>
        <h1 className="text-xl font-bold text-gray-900">リンクが無効か、有効期限が切れています</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-500">
          確認リンクの有効期限は 24 時間で、一度だけ使えます。お手数ですが、申請フォームからもう一度お申し込みください。
        </p>
        <Link to="/apply" className="mt-8 inline-block rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800">
          申請フォームへ
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-2xl font-bold text-gray-900">申請を確定してください</h1>
      <p className="mt-3 text-sm leading-relaxed text-gray-500">
        <span className="font-mono text-gray-700">{data.email}</span> の投稿者申請を確定します。
        確定すると、管理者の審査に進みます。
      </p>
      <Form method="post" className="mt-8">
        <input type="hidden" name="token" value={data.token} />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-500 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? "確定中..." : "申請を確定する"}
        </button>
      </Form>
      <p className="mt-6 text-xs text-gray-400">心当たりがない場合は、このページを閉じてください。申請は確定されません。</p>
    </Card>
  );
}
