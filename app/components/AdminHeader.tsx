import { Link, useLocation } from "@remix-run/react";
import { useEffect, useId, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  Code2,
  FileText,
  Home,
  LayoutGrid,
  MessagesSquare,
  Presentation,
  ShieldCheck,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

type Role = "admin" | "se" | "ae" | string;

type AdminMenuItem = {
  to: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  roles: Role[];
};

type AdminMenuGroup = { title: string; items: AdminMenuItem[] };

const STAFF: Role[] = ["admin", "se"];
const ADMIN: Role[] = ["admin"];

export const ADMIN_MENU: AdminMenuGroup[] = [
  {
    title: "コンテンツ",
    items: [
      { to: "/admin", label: "投稿管理", desc: "すべての記事・事例の確認と削除", icon: FileText, roles: STAFF },
      { to: "/admin/qa", label: "Q&A 管理", desc: "チャットの質問への回答とモデレーション", icon: MessagesSquare, roles: STAFF },
      { to: "/admin/ai-insights", label: "AI インサイト", desc: "AI の利用状況とトレンドレポート", icon: Bot, roles: STAFF },
    ],
  },
  {
    title: "ユーザー",
    items: [
      { to: "/admin/access-requests", label: "投稿者申請", desc: "投稿権限の申請を承認・却下", icon: UserPlus, roles: ADMIN },
      { to: "/admin/users", label: "ユーザー管理", desc: "ロール・プロフィール・権限の変更", icon: Users, roles: ADMIN },
    ],
  },
  {
    title: "ツール",
    items: [
      { to: "/admin/zero-trust-case", label: "事例生成", desc: "Zero Trust の設定から事例の下書きを作成", icon: ShieldCheck, roles: ADMIN },
      { to: "/admin/template-api", label: "Template API", desc: "テンプレート API のキーと使い方", icon: Code2, roles: ADMIN },
      { to: "/admin/presentation", label: "プレゼン", desc: "このサイトの構成を紹介するスライド", icon: Presentation, roles: ["admin", "se", "ae"] },
    ],
  },
];

const EXTERNAL_LINKS = [
  { to: "/portal", label: "ポータル", icon: LayoutGrid },
  { to: "/", label: "サイトトップ", icon: Home },
];

/** Longest matching menu item for the current path (so /admin/users/123 → ユーザー管理). */
function findCurrent(pathname: string): AdminMenuItem | undefined {
  let best: AdminMenuItem | undefined;
  for (const g of ADMIN_MENU) {
    for (const it of g.items) {
      const match = it.to === "/admin" ? pathname === "/admin" || pathname === "/admin/" : pathname === it.to || pathname.startsWith(it.to + "/");
      if (match && (!best || it.to.length > best.to.length)) best = it;
    }
  }
  return best;
}

const THEMES = {
  light: {
    header: "border-b bg-white",
    brand: "text-gray-900 hover:text-brand-600",
    sep: "text-gray-300",
    crumb: "text-gray-700",
    sub: "text-gray-400",
    button: "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
    buttonOpen: "border-brand-400 bg-brand-50 text-brand-700",
    user: "text-gray-500",
  },
  dark: {
    header: "border-b border-slate-800 bg-slate-950/95",
    brand: "text-white hover:text-brand-300",
    sep: "text-slate-700",
    crumb: "text-slate-200",
    sub: "text-slate-500",
    button: "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800",
    buttonOpen: "border-brand-400 bg-slate-800 text-white",
    user: "text-slate-400",
  },
} as const;

export function AdminHeader({
  user,
  title,
  theme = "light",
}: {
  user: { displayName: string; role: string };
  /** Optional sub-page title shown after the section name (e.g. a user's name). */
  title?: string;
  theme?: keyof typeof THEMES;
}) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const t = THEMES[theme];
  const current = findCurrent(pathname);

  const groups = ADMIN_MENU.map((g) => ({ ...g, items: g.items.filter((it) => it.roles.includes(user.role)) })).filter(
    (g) => g.items.length > 0
  );

  // Close on navigation, outside click, and Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className={`relative z-40 ${t.header}`} ref={wrapRef}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" className={`hidden shrink-0 text-lg font-bold transition-colors sm:inline ${t.brand}`}>
            Cloudflare Field Notes
          </Link>
          <span className="shrink-0 rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600 ring-1 ring-red-100">
            Admin
          </span>
          {current && (
            <>
              <span className={t.sep}>/</span>
              <Link to={current.to} className={`truncate text-sm font-medium hover:underline ${t.crumb}`}>
                {current.label}
              </Link>
            </>
          )}
          {title && (
            <>
              <span className={t.sep}>/</span>
              <span className={`truncate text-sm ${t.sub}`}>{title}</span>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="管理メニュー"
            aria-controls={panelId}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              open ? t.buttonOpen : t.button
            }`}
          >
            {open ? <X className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            {open ? "閉じる" : "メニュー"}
            {!open && <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <span className={`hidden text-sm md:inline ${t.user}`}>{user.displayName}</span>
          <span className="hidden rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 md:inline">
            {user.role}
          </span>
        </div>
      </div>

      {open && (
        <div
          id={panelId}
          role="navigation"
          aria-label="管理メニュー"
          className="absolute inset-x-0 top-full border-y border-gray-200 bg-white text-gray-900 shadow-xl"
        >
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="grid gap-6 md:grid-cols-3">
              {groups.map((g) => (
                <section key={g.title}>
                  <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{g.title}</h2>
                  <ul className="space-y-1">
                    {g.items.map((it) => {
                      const active = current?.to === it.to;
                      const Icon = it.icon;
                      return (
                        <li key={it.to}>
                          <Link
                            to={it.to}
                            aria-current={active ? "page" : undefined}
                            className={`flex items-start gap-3 rounded-lg p-2 transition ${
                              active ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-gray-50"
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                active ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className={`block text-sm font-medium ${active ? "text-brand-700" : "text-gray-900"}`}>
                                {it.label}
                              </span>
                              <span className="block text-xs leading-relaxed text-gray-500">{it.desc}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
              {EXTERNAL_LINKS.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Icon className="h-4 w-4 text-gray-500" />
                  {label}へ
                </Link>
              ))}
              <span className="ml-auto text-xs text-gray-400 md:hidden">
                {user.displayName} · {user.role}
              </span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
