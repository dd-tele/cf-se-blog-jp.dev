import { useEffect, useCallback } from "react";
import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { isAccessConfigured } from "~/lib/auth.server";

export async function loader({ context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  return { useAccessLogout: isAccessConfigured(env) };
}

export default function LoggedOutPage() {
  const { useAccessLogout } = useLoaderData<typeof loader>();

  const goHome = useCallback(() => {
    window.location.href = "/";
  }, []);

  useEffect(() => {
    // App session is already destroyed server-side.
    // If Cloudflare Access is configured, use a hidden same-origin iframe
    // to hit /cdn-cgi/access/logout which clears the CF_Authorization cookie.
    // Then redirect to / (public page) — no OIDC flow is triggered on a
    // public page, so "Invalid login session" errors are avoided.
    // The origin server cannot clear CF_Authorization via Set-Cookie because
    // Cloudflare's edge proxy controls that cookie.
    if (!useAccessLogout) {
      const t = setTimeout(goHome, 1500);
      return () => clearTimeout(t);
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      // Small delay to let the Set-Cookie from the iframe response propagate
      setTimeout(goHome, 500);
    };

    // Hidden iframe clears Access cookies in the background
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = "/cdn-cgi/access/logout";
    iframe.onload = finish;
    iframe.onerror = finish;
    document.body.appendChild(iframe);

    // Fallback: redirect even if iframe hangs
    const fallback = setTimeout(finish, 3000);

    return () => {
      clearTimeout(fallback);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };
  }, [useAccessLogout, goHome]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-brand-900">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl text-center">
        <div className="mb-4 text-4xl">👋</div>
        <h1 className="text-xl font-bold text-gray-900">
          ログアウトしました
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          トップページに戻ります…
        </p>
        <div className="mt-4 flex justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      </div>
    </div>
  );
}
