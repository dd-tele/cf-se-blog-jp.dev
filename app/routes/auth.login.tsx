import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { useState, useEffect } from "react";
import { Form, useLoaderData, useSearchParams } from "@remix-run/react";
import {
  createUserSession,
  getSession,
  getSessionUser,
  isAccessConfigured,
  sessionStorage,
  type SessionUser,
} from "~/lib/auth.server";
import { redirect } from "@remix-run/cloudflare";
import {
  getAccessJWT,
  verifyAccessJWT,
  decodeAccessJWTUnsafe,
  resolveAccessEmail,
  resolveRole,
  buildSessionUserFromAccess,
  type VerifyResult,
} from "~/lib/access.server";
import { ensureUser } from "~/lib/posts.server";

export const meta: MetaFunction = () => [
  { title: "ログイン — Cloudflare Solution Blog" },
];

const CLEAR_PRE_LOGOUT_COOKIE =
  "__cf_blog_pre_logout_email=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

function getPreLogoutEmail(request: Request): string | null {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/__cf_blog_pre_logout_email=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function createUserSessionAndClearPreLogout(
  user: SessionUser,
  redirectTo: string
) {
  const session = await sessionStorage.getSession();
  session.set("user", user);
  const headers = new Headers();
  headers.append("Set-Cookie", await sessionStorage.commitSession(session));
  headers.append("Set-Cookie", CLEAR_PRE_LOGOUT_COOKIE);
  return redirect(redirectTo, { headers });
}

const DEV_USERS = [
  {
    id: "dev-admin-001",
    email: "admin@cf-se-blog-jp.dev",
    displayName: "Admin User",
    role: "admin" as const,
  },
  {
    id: "dev-se-001",
    email: "se@cf-se-blog-jp.dev",
    displayName: "SE Engineer",
    role: "se" as const,
  },
  {
    id: "dev-user-001",
    email: "user@cf-se-blog-jp.dev",
    displayName: "Blog User",
    role: "user" as const,
  },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const existingUser = await getSessionUser(request);
  const env = context.cloudflare.env;

  // If a session exists, check that it still matches the Access JWT user.
  // If a different user logged in via Access (new CF_Authorization cookie),
  // destroy the stale session and fall through to create a new one.
  if (existingUser) {
    if (isAccessConfigured(env)) {
      const jwt = getAccessJWT(request);
      if (jwt) {
        const jwtEmail = resolveAccessEmail(jwt);
        if (jwtEmail && jwtEmail !== existingUser.email.toLowerCase()) {
          console.warn(
            `[Login] Email mismatch: session=${existingUser.email}, jwt=${jwtEmail}. Re-authenticating.`
          );
          // Destroy stale session — fall through to normal auth flow below
          const session = await getSession(request);
          const headers = new Headers();
          headers.set("Set-Cookie", await sessionStorage.destroySession(session));
          // Redirect back here without the old session cookie
          const url = new URL(request.url);
          return redirect(url.toString(), { headers });
        }
      }
    }
    // Session email matches JWT (or no Access) — reuse existing session
    return redirect("/portal");
  }

  // Production: authenticate via Cloudflare Access JWT
  if (isAccessConfigured(env)) {
    const jwt = getAccessJWT(request);
    const url = new URL(request.url);
    const returnTo = url.searchParams.get("returnTo") || "/portal";
    const retryCount = parseInt(url.searchParams.get("retry") || "0", 10);

    if (jwt) {
      // Detect stale Access JWTs left over from a failed logout.
      // The logout action sets __cf_blog_pre_logout_email cookie.
      // If the JWT email still matches the logged-out email, the Access
      // session wasn't properly cleared. Force a full-page redirect to
      // /cdn-cgi/access/logout to ensure it's cleaned up.
      const preLogoutEmail = getPreLogoutEmail(request);
      if (preLogoutEmail) {
        const jwtEmail = resolveAccessEmail(jwt);
        if (jwtEmail && jwtEmail === preLogoutEmail.toLowerCase()) {
          console.warn(
            `[Login] Stale JWT detected after logout: jwt=${jwtEmail} matches pre_logout=${preLogoutEmail}. Forcing Access logout.`
          );
          const headers = new Headers();
          // Clear the pre_logout cookie so we don't loop
          headers.append("Set-Cookie", CLEAR_PRE_LOGOUT_COOKIE);
          return redirect("/cdn-cgi/access/logout", { headers });
        }
        // JWT email differs from pre_logout → new user authenticated, clear cookie
        // (will be cleared when session is created below)
      }

      try {
        const result: VerifyResult = await verifyAccessJWT(
          jwt,
          env.CF_ACCESS_TEAM_DOMAIN!,
          env.CF_ACCESS_AUD!
        );

        // Resolve payload: prefer verified, fallback to decoded
        let payload: { email: string; sub: string } | null = null;
        let verifyReason: string | null = null;

        if (result.ok) {
          payload = result.payload;
        } else {
          verifyReason = result.reason;
          // Fallback: decode without verification.
          // Safe because Access has already verified the JWT before the
          // request reached this Worker.
          console.warn(`[Access Auth] JWT verify failed (${verifyReason}), falling back to decode`);
          payload = decodeAccessJWTUnsafe(jwt);
        }

        if (payload) {
          const role = resolveRole(
            payload.email,
            env.ADMIN_EMAILS,
            env.SE_EMAIL_DOMAINS
          );
          const sessionUser = buildSessionUserFromAccess(payload as any, role);

          // Ensure user exists in D1 and reflect DB profile
          const dbUser = await ensureUser(env.DB, sessionUser);
          if (dbUser) {
            // Block inactive users
            if (!dbUser.is_active) {
              return {
                mode: "error" as const,
                error: "このアカウントは無効化されています。管理者にお問い合わせください。",
              };
            }
            sessionUser.displayName = dbUser.nickname || dbUser.display_name;
            if (dbUser.role) sessionUser.role = dbUser.role as typeof sessionUser.role;
          }

          // Create session and redirect (works for document requests)
          return createUserSessionAndClearPreLogout(sessionUser, returnTo);
        }

        // JWT could not be verified or decoded at all
        const reason = verifyReason || "unknown";
        console.warn(`[Access Auth] JWT verification failed: ${reason} (retry=${retryCount})`);

        // For expired/transient failures, redirect to re-trigger Access auth
        // Access will intercept, refresh the JWT, and redirect back
        if (retryCount < 2 && ["expired", "kid_mismatch", "bad_signature"].includes(reason)) {
          return redirect(
            `/auth/login?returnTo=${encodeURIComponent(returnTo)}&retry=${retryCount + 1}`
          );
        }

        // After retries or for non-transient errors, show error with auto-retry
        const reasonLabel: Record<string, string> = {
          expired: "JWT の有効期限切れ（再試行しましたが更新されませんでした）",
          kid_mismatch: "署名鍵が一致しません",
          bad_signature: "JWT の署名が無効です",
          bad_aud: "Audience が一致しません — CF_ACCESS_AUD の設定を確認してください",
          bad_iss: "Issuer が一致しません — CF_ACCESS_TEAM_DOMAIN の設定を確認してください",
          malformed: "JWT の形式が不正です",
          invalid: "JWT の検証中にエラーが発生しました",
        };
        return {
          mode: "error" as const,
          error: `Cloudflare Access の認証に失敗しました: ${reasonLabel[reason] || reason}`,
          autoRetry: ["expired", "kid_mismatch", "bad_signature"].includes(reason),
        };
      } catch (err) {
        if (err instanceof Response) throw err;
        console.error("[Access Auth] Error:", err);
        // Last-resort fallback: decode JWT without verification
        const fallbackPayload = decodeAccessJWTUnsafe(jwt);
        if (fallbackPayload) {
          console.warn("[Access Auth] Using decoded JWT after catch fallback");
          const role = resolveRole(fallbackPayload.email, env.ADMIN_EMAILS, env.SE_EMAIL_DOMAINS);
          const sessionUser = buildSessionUserFromAccess(fallbackPayload as any, role);
          const dbUser = await ensureUser(env.DB, sessionUser);
          if (dbUser) {
            if (!dbUser.is_active) {
              return { mode: "error" as const, error: "このアカウントは無効化されています。管理者にお問い合わせください。" };
            }
            sessionUser.displayName = dbUser.nickname || dbUser.display_name;
            if (dbUser.role) sessionUser.role = dbUser.role as typeof sessionUser.role;
          }
          return createUserSessionAndClearPreLogout(sessionUser, returnTo);
        }
        return {
          mode: "error" as const,
          error: `認証エラー: ${err instanceof Error ? err.message : "Unknown error"}`,
          autoRetry: false,
        };
      }
    }

    // No JWT yet — redirect to Access-protected path to trigger login,
    // but only once to avoid redirect loops.
    const alreadyRedirected = url.searchParams.get("ar") === "1";
    if (!alreadyRedirected) {
      // Redirect to Access-protected path; Access should intercept and show IdP login.
      // After auth, Access redirects back here with CF_Authorization cookie.
      return redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}&ar=1`);
    }

    // Already redirected once and still no JWT — Access may not be protecting this path
    return {
      mode: "error" as const,
      error: "Cloudflare Access の JWT が取得できません。Access Application のパス設定を確認してください。",
      autoRetry: false,
    };
  }

  // Dev: show mock login
  return { mode: "dev" as const, devUsers: DEV_USERS };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const selectedId = formData.get("userId") as string;
  const returnTo = (formData.get("returnTo") as string) || "/portal";

  const selectedUser = DEV_USERS.find((u) => u.id === selectedId);
  if (!selectedUser) {
    throw new Response("Invalid user", { status: 400 });
  }

  return createUserSession(selectedUser, returnTo);
}

export default function LoginPage() {
  const data = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/portal";

  // Error mode — show Access configuration error
  if (data.mode === "error") {
    return <LoginError error={data.error} autoRetry={"autoRetry" in data && !!data.autoRetry} returnTo={returnTo} />;
  }

  // Dev mode — show mock login
  const devUsers = data.devUsers;
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-brand-900">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Cloudflare Solution Blog
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            開発用ログイン
          </p>
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            本番環境では Cloudflare Access で認証されます
          </div>
        </div>

        <div className="space-y-3">
          {devUsers.map((user: typeof DEV_USERS[number]) => (
            <Form method="post" key={user.id}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button
                type="submit"
                className="flex w-full items-center gap-4 rounded-xl border border-gray-200 p-4 text-left transition-all hover:border-brand-300 hover:bg-brand-50 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-lg">
                  {user.role === "admin"
                    ? "👑"
                    : user.role === "se"
                      ? "🛠️"
                      : "✍️"}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {user.displayName}
                  </div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    user.role === "admin"
                      ? "bg-red-100 text-red-700"
                      : user.role === "se"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                  }`}
                >
                  {user.role}
                </span>
              </button>
            </Form>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoginError({ error, autoRetry, returnTo }: { error: string; autoRetry: boolean; returnTo: string }) {
  const [countdown, setCountdown] = useState(autoRetry ? 3 : 0);

  useEffect(() => {
    if (!autoRetry || countdown <= 0) return;
    const timer = setTimeout(() => {
      if (countdown === 1) {
        window.location.href = `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [autoRetry, countdown, returnTo]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-brand-900">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Cloudflare Solution Blog
          </h1>
          <p className="mt-2 text-sm text-gray-500">認証エラー</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
        {autoRetry && countdown > 0 && (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm text-blue-700">
            {countdown} 秒後に自動で再試行します…
          </div>
        )}
        <div className="mt-4 flex flex-col items-center gap-2">
          <a
            href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}
            className="rounded-lg bg-brand-500 px-6 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            再試行する
          </a>
          <a
            href="/auth/logout"
            className="text-sm font-medium text-red-600 hover:text-red-700 underline"
          >
            ログアウトして別のアカウントでログイン
          </a>
          <a
            href="/"
            className="text-sm text-brand-600 hover:text-brand-700 underline"
          >
            トップページに戻る
          </a>
        </div>
      </div>
    </div>
  );
}
