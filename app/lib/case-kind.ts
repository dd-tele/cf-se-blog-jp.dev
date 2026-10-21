// 事例 (content_type = "case_guide") has two kinds, distinguished by the
// leading 【...】 of the title (case-guides/AGENTS.md 4-4). Titles without a
// known prefix (older uploads) are treated as 設計ガイド.

export type CaseKind = "guide" | "architecture";

export const CASE_KINDS: Record<CaseKind, { label: string; en: string; prefix: string }> = {
  guide: { label: "設計ガイド", en: "DESIGN GUIDE", prefix: "【設計ガイド】" },
  architecture: { label: "導入アーキテクチャ", en: "ARCHITECTURE", prefix: "【導入アーキテクチャ】" },
};

export function caseKind(title: string): CaseKind {
  return title.startsWith(CASE_KINDS.architecture.prefix) ? "architecture" : "guide";
}

export function parseCaseKind(value: string | null | undefined): CaseKind | undefined {
  return value === "guide" || value === "architecture" ? value : undefined;
}

/** Title without the kind prefix, for places that show the kind as a badge. */
export function caseDisplayTitle(title: string): string {
  for (const k of Object.values(CASE_KINDS)) {
    if (title.startsWith(k.prefix)) return title.slice(k.prefix.length).trim() || title;
  }
  return title;
}

/** Tailwind classes for the kind badge. */
export function caseKindBadgeClass(kind: CaseKind): string {
  return kind === "architecture" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700";
}
