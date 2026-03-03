import { useEffect } from "react";
import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { isAccessConfigured } from "~/lib/auth.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  // Use app-domain logout URL so CF_Authorization cookie is sent & cleared
  const url = new URL(request.url);
  const accessLogoutUrl = isAccessConfigured(env)
    ? `${url.origin}/cdn-cgi/access/logout`
    : null;
  return { accessLogoutUrl };
}

export default function LoggedOutPage() {
  const { accessLogoutUrl } = useLoaderData<typeof loader>();

  useEffect(() => {
    // Clear Access session via same-origin fetch, then redirect home
    if (accessLogoutUrl) {
      fetch(accessLogoutUrl, { credentials: "include" }).finally(() => {
        setTimeout(() => { window.location.href = "/"; }, 1500);
      });
    } else {
      setTimeout(() => { window.location.href = "/"; }, 1500);
    }
  }, [accessLogoutUrl]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-brand-900">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl text-center">
        <div className="mb-4 text-4xl">👋</div>
        <h1 className="text-xl font-bold text-gray-900">
          ログアウトしました
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          ホームページに戻ります...
        </p>
        <div className="mt-4 flex justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      </div>
    </div>
  );
}
