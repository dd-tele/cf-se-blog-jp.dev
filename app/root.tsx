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
