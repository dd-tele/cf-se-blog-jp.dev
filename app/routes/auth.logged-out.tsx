import { useEffect } from "react";
import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { isAccessConfigured } from "~/lib/auth.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const url = new URL(request.url);
  // Only provide the SSO logout URL — normal logout clears app session only
  const ssoLogoutUrl = isAccessConfigured(env)
    ? `${url.origin}/cdn-cgi/access/logout`
    : null;
  return { ssoLogoutUrl };
}

export default function LoggedOutPage() {
  const { ssoLogoutUrl } = useLoaderData<typeof loader>();

  useEffect(() => {
    // Clear Access session via full-page navigation (not async fetch).
    // Full-page navigation is synchronous — the browser is on the logout
    // page, so the user cannot accidentally start a new login flow while
    // cookies are being cleared. This prevents "Invalid login session".
    if (ssoLogoutUrl) {
      const timer = setTimeout(() => { window.location.href = ssoLogoutUrl; }, 1200);
      return () => clearTimeout(timer);
    }
    // Non-Access env: just go home
    const timer = setTimeout(() => { window.location.href = "/"; }, 1500);
    return () => clearTimeout(timer);
  }, [ssoLogoutUrl]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-brand-900">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl text-center">
        <div className="mb-4 text-4xl">👋</div>
        <h1 className="text-xl font-bold text-gray-900">
          ログアウトしています…
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          セッションをクリアしています
        </p>
        <div className="mt-4 flex justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      </div>
    </div>
  );
}
