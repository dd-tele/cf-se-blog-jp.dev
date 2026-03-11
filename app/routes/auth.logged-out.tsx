import { useEffect } from "react";

export default function LoggedOutPage() {
  useEffect(() => {
    // Cookies (app session + CF_Authorization) are already cleared
    // server-side via Set-Cookie headers in the logout action.
    // Just redirect to the public top page.
    const timer = setTimeout(() => { window.location.href = "/"; }, 2000);
    return () => clearTimeout(timer);
  }, []);

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
