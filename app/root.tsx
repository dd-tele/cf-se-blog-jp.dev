import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import {
  getSession,
  getSessionUser,
  sessionStorage,
  isAccessConfigured,
} from "~/lib/auth.server";
import {
  getAccessJWT,
  verifyAccessJWT,
  decodeAccessJWTUnsafe,
  resolveRole,
  buildSessionUserFromAccess,
} from "~/lib/access.server";
import { ensureUser } from "~/lib/posts.server";

import stylesheet from "~/tailwind.css?url";

// ─── Auto-login: create app session from Cloudflare Access JWT ───
// When the entire site is behind Access, every visitor already has a valid
// CF_Authorization JWT. This loader transparently converts it into an app
// session so child loaders see the user via getSessionUser().
export async function loader({ request, context }: LoaderFunctionArgs) {
  // Already has a valid app session — nothing to do
  const user = await getSessionUser(request);
  if (user) return null;

  const env = context.cloudflare.env;
  if (!isAccessConfigured(env)) return null;

  // Skip auto-login for non-page requests (RSS, sitemap, API, etc.)
  const url = new URL(request.url);
  const path = url.pathname;
  if (
    path.endsWith(".xml") ||
    path.endsWith(".json") ||
    path.endsWith(".txt") ||
    path.endsWith(".ico") ||
    path.startsWith("/api/") ||
    path.startsWith("/r2/") ||
    path.startsWith("/cdn-cgi/")
  ) {
    return null;
  }

  // Prevent redirect loop: if a session cookie was already sent but is
  // invalid/empty, getSessionUser returned null above. Don't try again.
  const cookieHeader = request.headers.get("Cookie") || "";
  if (cookieHeader.includes("__cf_blog_session")) return null;

  const jwt = getAccessJWT(request);
  if (!jwt) return null;

  try {
    let payload: { email: string; sub: string } | null = null;

    const result = await verifyAccessJWT(
      jwt,
      env.CF_ACCESS_TEAM_DOMAIN!,
      env.CF_ACCESS_AUD!
    );
    if (result.ok) {
      payload = result.payload;
    } else {
      // Fallback: decode without verification.
      // Safe because Access has already verified the JWT before the
      // request reached this Worker.
      console.warn(`[Root Auto-Login] JWT verify failed (${result.reason}), falling back to decode`);
      payload = decodeAccessJWTUnsafe(jwt);
    }
    if (!payload) return null;

    const role = resolveRole(
      payload.email,
      env.ADMIN_EMAILS,
      env.SE_EMAIL_DOMAINS
    );
    const sessionUser = buildSessionUserFromAccess(payload as any, role);

    // Ensure user record exists in D1 and reflect DB profile
    const dbUser = await ensureUser(env.DB, sessionUser);
    if (dbUser) {
      if (!dbUser.is_active) return null;
      sessionUser.displayName = dbUser.nickname || dbUser.display_name;
      if (dbUser.role) sessionUser.role = dbUser.role as typeof sessionUser.role;
    }

    // Persist session and redirect to the same URL so the cookie is set
    const session = await getSession(request);
    session.set("user", sessionUser);
    throw redirect(path + url.search, {
      headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
    });
  } catch (err) {
    if (err instanceof Response) throw err; // re-throw our redirect
    console.error("[Root Auto-Login] Error:", err);
    return null;
  }
}

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
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "alternate", type: "application/rss+xml", title: "Cloudflare フィールドノート RSS", href: "/feed.xml" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {/* Global safety net: force full-page reload when client-side navigation
            fails (e.g. Cloudflare Access intercepts fetch with a redirect/HTML).
            Runs outside React so it works even if ErrorBoundary never fires. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
  var R='__cf_nav_reload',T='__cf_nav_target';
  var navTarget='';
  function goTo(url){
    var dest=url||navTarget||location.href;
    var c=parseInt(sessionStorage.getItem(R)||'0',10);
    if(c<2){
      sessionStorage.setItem(R,String(c+1));
      sessionStorage.setItem(T,dest);
      location.href=dest;
    }else{
      sessionStorage.removeItem(R);
      sessionStorage.removeItem(T);
      location.href='/';
    }
  }
  var prev=sessionStorage.getItem(T);
  if(prev)navTarget=prev;
  function isFetchErr(m){return/failed to fetch|load failed|networkerror|unexpected token/i.test(m||'');}
  function pathFromDataUrl(u){
    try{var p=new URL(u,location.origin).pathname;return p;}catch(e){return'';}
  }
  window.addEventListener('unhandledrejection',function(e){
    var r=e&&e.reason;
    if(r instanceof Error&&isFetchErr(r.message))goTo();
    if(r instanceof Response&&(r.status===401||r.status===302||r.status===0))goTo();
  });
  window.addEventListener('error',function(e){
    if(e&&e.message&&isFetchErr(e.message))goTo();
  });
  var origFetch=window.fetch;
  window.fetch=function(){
    var reqUrl=String((arguments[0]&&arguments[0].url)||arguments[0]||'');
    var isDataReq=/[?&]_data=/.test(reqUrl)||/\\.data(\\?|$)/.test(reqUrl);
    if(isDataReq){navTarget=pathFromDataUrl(reqUrl)||navTarget;}
    return origFetch.apply(this,arguments).then(function(res){
      if(!res)return res;
      if(res.type==='opaqueredirect'||res.status===0)goTo();
      var rUrl=res.url||'';
      if(res.redirected&&(/cloudflareaccess\\.com/.test(rUrl)||/\\/cdn-cgi\\/access/.test(rUrl)))goTo();
      if(isDataReq){
        var ct=res.headers&&res.headers.get('content-type')||'';
        if(ct.indexOf('text/html')!==-1)goTo();
      }
      return res;
    }).catch(function(err){
      if(err instanceof Error&&isFetchErr(err.message))goTo();
      throw err;
    });
  };
  document.addEventListener('DOMContentLoaded',function(){sessionStorage.removeItem(R);sessionStorage.removeItem(T);});
  var blankTimer=null;
  function checkBlank(){
    if(blankTimer)clearTimeout(blankTimer);
    blankTimer=setTimeout(function(){
      var b=document.body;if(!b)return;
      var text=(b.innerText||'').trim();
      if(text.length<5&&!document.querySelector('canvas,video,iframe')){
        var c=parseInt(sessionStorage.getItem(R)||'0',10);
        if(c<2){goTo();}
        else{
          sessionStorage.removeItem(R);sessionStorage.removeItem(T);
          b.innerHTML='<div style=\"display:flex;min-height:100vh;align-items:center;justify-content:center;font-family:sans-serif\"><div style=\"text-align:center\"><p style=\"font-size:1.1rem;color:#374151;margin-bottom:1rem\">\\u30da\\u30fc\\u30b8\\u306e\\u8aad\\u307f\\u8fbc\\u307f\\u306b\\u5931\\u6557\\u3057\\u307e\\u3057\\u305f</p><a href=\"'+(navTarget||location.href)+'\" style=\"display:inline-block;padding:.5rem 1.5rem;border-radius:.5rem;background:#f6821f;color:#fff;text-decoration:none;font-weight:500\">\\u518d\\u8aad\\u307f\\u8fbc\\u307f</a><br><a href=\"/\" style=\"display:inline-block;margin-top:.75rem;color:#f6821f;text-decoration:underline;font-size:.875rem\">\\u30c8\\u30c3\\u30d7\\u30da\\u30fc\\u30b8\\u3078</a></div></div>';
        }
      }
    },3000);
  }
  new MutationObserver(checkBlank).observe(document.documentElement,{childList:true,subtree:true});
})();`,
          }}
        />
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

  // Detect errors caused by Cloudflare Access intercepting client-side
  // fetch requests when the Access session has expired.
  // Covers multiple browsers and failure modes:
  //   - Chrome:  TypeError "Failed to fetch"
  //   - Safari:  TypeError "Load failed"
  //   - Firefox: TypeError "NetworkError when attempting to fetch resource"
  //   - Access returning HTML login page → Remix JSON parse fails:
  //       SyntaxError "Unexpected token '<'"
  const isAccessRedirectError =
    !isRouteErrorResponse(error) &&
    error instanceof Error &&
    (/failed to fetch|load failed|networkerror/i.test(error.message) ||
      (error.name === "SyntaxError" && /unexpected token/i.test(error.message)));

  if (isAccessRedirectError) {
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
          <title>セッション期限切れ — Cloudflare フィールドノート</title>
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
        <title>エラー — Cloudflare フィールドノート</title>
      </head>
      <body
        className="flex min-h-screen items-center justify-center bg-gray-50"
        style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb" }}
      >
        <div style={{ textAlign: "center" }}>
          <h1
            className="text-6xl font-bold text-gray-300"
            style={{ fontSize: "3.75rem", fontWeight: 700, color: "#d1d5db" }}
          >
            {status}
          </h1>
          <p
            className="mt-4 text-lg text-gray-600"
            style={{ marginTop: "1rem", fontSize: "1.125rem", color: "#4b5563" }}
          >
            {message}
          </p>
          <a
            href="/"
            className="mt-6 inline-block rounded-lg bg-brand-500 px-6 py-2 text-sm font-medium text-white hover:bg-brand-600"
            style={{ marginTop: "1.5rem", display: "inline-block", padding: "0.5rem 1.5rem", borderRadius: "0.5rem", backgroundColor: "#f6821f", color: "#fff", fontWeight: 500, fontSize: "0.875rem", textDecoration: "none" }}
          >
            ホームに戻る
          </a>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
