import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { Form, useLoaderData, useSearchParams } from "@remix-run/react";
import {
  createUserSession,
  getSessionUser,
  isAccessConfigured,
} from "~/lib/auth.server";
import { redirect } from "@remix-run/cloudflare";
import {
  getAccessJWT,
  verifyAccessJWT,
  resolveRole,
  buildSessionUserFromAccess,
} from "~/lib/access.server";
import { ensureUser } from "~/lib/posts.server";

export const meta: MetaFunction = () => [
  { title: "ログイン — Cloudflare Solution Blog" },
];

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
  const user = await getSessionUser(request);
  if (user) {
    return redirect("/portal");
  }

  const env = context.cloudflare.env;

  // Production: authenticate via Cloudflare Access JWT
  if (isAccessConfigured(env)) {
    const jwt = getAccessJWT(request);
    if (jwt) {
      const payload = await verifyAccessJWT(
        jwt,
        env.CF_ACCESS_TEAM_DOMAIN!,
        env.CF_ACCESS_AUD!
      );
      if (payload) {
        const role = resolveRole(
          payload.email,
          env.ADMIN_EMAILS,
          env.SE_EMAIL_DOMAINS
        );
        const sessionUser = buildSessionUserFromAccess(payload, role);

        // Ensure user exists in D1
        await ensureUser(env.DB, sessionUser);

        const url = new URL(request.url);
        const returnTo = url.searchParams.get("returnTo") || "/portal";
        return createUserSession(sessionUser, returnTo);
      }
    }
    // Access configured but JWT missing/invalid
    return { mode: "access" as const, devUsers: [] };
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
  const { mode, devUsers } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/portal";

  if (mode === "access") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-brand-900">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Cloudflare Solution Blog
          </h1>
          <p className="mt-4 text-sm text-gray-500">
            認証情報を確認しています...
          </p>
          <div className="mt-6 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
          <p className="mt-6 text-xs text-gray-400">
            自動的にリダイレクトされない場合は、ページを再読み込みしてください。
          </p>
        </div>
      </div>
    );
  }

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
          {devUsers.map((user) => (
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
