import { Link } from "@remix-run/react";

export type SiteSection = "posts" | "cases" | "slides" | "search";

const SECTIONS: { key: SiteSection; to: string; label: string }[] = [
  { key: "posts", to: "/posts", label: "記事" },
  { key: "cases", to: "/cases", label: "事例 - 設計ガイド" },
  { key: "slides", to: "/slides", label: "スライド" },
];

/**
 * Primary content sections shared by every public header, so the labels for
 * 記事 / 事例 - 設計ガイド / スライド stay consistent across pages.
 */
export function SiteNav({ active, includeSearch = false }: { active?: SiteSection; includeSearch?: boolean }) {
  const items = includeSearch ? [...SECTIONS, { key: "search" as const, to: "/search", label: "検索" }] : SECTIONS;
  return (
    <>
      {items.map((item) => (
        <Link
          key={item.key}
          to={item.to}
          aria-current={active === item.key ? "page" : undefined}
          className={`whitespace-nowrap text-sm transition-colors ${
            active === item.key ? "font-semibold text-gray-900" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}
