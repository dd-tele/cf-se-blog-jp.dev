import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "@remix-run/cloudflare";
import { Form, useLoaderData } from "@remix-run/react";
import {
  getSessionUser,
  sessionStorage,
  getSession,
  isAccessConfigured,
} from "~/lib/auth.server";
import { redirect } from "@remix-run/cloudflare";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await getSessionUser(request);
  if (!user) {
    return redirect("/");
  }
  const env = context.cloudflare.env;
  const accessLogoutUrl = isAccessConfigured(env)
    ? `https://${env.CF_ACCESS_TEAM_DOMAIN}.cloudflareaccess.com/cdn-cgi/access/logout`
    : null;
  return { user, accessLogoutUrl };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const session = await getSession(request);
  const env = context.cloudflare.env;

  const accessLogoutUrl = isAccessConfigured(env)
    ? `https://${env.CF_ACCESS_TEAM_DOMAIN}.cloudflareaccess.com/cdn-cgi/access/logout`
    : null;

  // Redirect to logged-out page which handles Access session cleanup + home redirect
  const redirectTo = accessLogoutUrl ? "/auth/logged-out" : "/";

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

export default function LogoutPage() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-brand-900">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-gray-900">ログアウト</h1>
          <p className="mt-3 text-sm text-gray-500">
            <span className="font-medium text-gray-700">{user.displayName}</span>
            {" "}としてログイン中です。
          </p>
          <p className="mt-1 text-xs text-gray-400">{user.email}</p>
        </div>

        <p className="mb-6 text-center text-sm text-gray-600">
          ログアウトしますか？
        </p>

        <div className="flex gap-3">
          <a
            href="/portal"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            キャンセル
          </a>
          <Form method="post" className="flex-1">
            <button
              type="submit"
              className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
            >
              ログアウト
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
}
