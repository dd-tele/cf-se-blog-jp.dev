import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/cloudflare";

import stylesheet from "~/tailwind.css?url";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap",
  },
  { rel: "stylesheet", href: stylesheet },
  { rel: "icon", href: "/favicon.ico" },
  { rel: "alternate", type: "application/rss+xml", title: "Cloudflare Solution Blog RSS", href: "/feed.xml" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();

  // "Failed to fetch" happens when Remix client-side navigation
  // hits a Cloudflare Access redirect (cross-origin).
  // Force a full page reload so the browser can follow the redirect.
  // Use sessionStorage to prevent infinite reload loops.
  if (
    !isRouteErrorResponse(error) &&
    error instanceof Error &&
    error.message === "Failed to fetch"
  ) {
    return (
      <html lang="ja">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>リダイレクト中...</title>
        </head>
        <body>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                var key = '__cf_reload_' + location.pathname;
                var count = parseInt(sessionStorage.getItem(key) || '0', 10);
                if (count < 2) {
                  sessionStorage.setItem(key, String(count + 1));
                  location.reload();
                } else {
                  sessionStorage.removeItem(key);
                  location.href = '/';
                }
              `,
            }}
          />
        </body>
      </html>
    );
  }

  // 401 = Access session expired — redirect to login via full page navigation
  if (isRouteErrorResponse(error) && error.status === 401) {
    const loginUrl =
      typeof error.data === "string" && error.data.startsWith("/")
        ? error.data
        : "/auth/login";
    return (
      <html lang="ja">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>セッション期限切れ — Cloudflare Solution Blog</title>
        </head>
        <body className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-brand-900">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">セッション期限切れ</h1>
            <p className="mt-2 text-sm text-gray-500">
              Cloudflare Access のセッションが切れました。<br />ログイン画面へ移動します…
            </p>
            <a
              href={loginUrl}
              className="mt-6 inline-block rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
            >
              今すぐログイン
            </a>
          </div>
          <script
            dangerouslySetInnerHTML={{
              __html: `setTimeout(function(){ window.location.href = ${JSON.stringify(loginUrl)}; }, 1500);`,
            }}
          />
        </body>
      </html>
    );
  }

  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message = isRouteErrorResponse(error)
    ? error.statusText
    : error instanceof Error
      ? error.message
      : "予期しないエラーが発生しました";

  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <title>エラー — Cloudflare Solution Blog</title>
      </head>
      <body className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-300">{status}</h1>
          <p className="mt-4 text-lg text-gray-600">{message}</p>
          <a
            href="/"
            className="mt-6 inline-block rounded-lg bg-brand-500 px-6 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            ホームに戻る
          </a>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
