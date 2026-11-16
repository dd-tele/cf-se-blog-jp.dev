// 事例 (content_type = "case_guide") has two kinds. The kind is stored in
// posts.case_kind, detected from the uploaded HTML at upload time
// (detectCaseKind). Titles are free-form (e.g. 【飲食チェーン　ケース１】…), so the
// title prefix is only a fallback for rows without a stored kind.

export type CaseKind = "guide" | "architecture";

export const CASE_KINDS: Record<CaseKind, { label: string; en: string; prefix: string }> = {
  guide: { label: "設計ガイド", en: "DESIGN GUIDE", prefix: "【設計ガイド】" },
  architecture: { label: "導入アーキテクチャ", en: "ARCHITECTURE", prefix: "【導入アーキテクチャ】" },
};

/** Kind of a 事例: the stored value when present, otherwise the title prefix. */
export function caseKind(title: string, stored?: string | null): CaseKind {
  const k = parseCaseKind(stored);
  if (k) return k;
  return title.startsWith(CASE_KINDS.architecture.prefix) ? "architecture" : "guide";
}

/**
 * Detect the kind from the uploaded guide HTML. The 導入アーキテクチャ template
 * (case-guides/template/architecture.html) has 「導入アーキテクチャ：」 in .brand,
 * the 「導入前の構成と課題」 chapter and 「設定の意図」 callouts.
 */
export function detectCaseKind(html: string, title: string): CaseKind {
  if (title.startsWith(CASE_KINDS.architecture.prefix)) return "architecture";
  if (title.startsWith(CASE_KINDS.guide.prefix)) return "guide";
  const brand = /<div class="brand"><b>([\s\S]*?)<\/b>/.exec(html)?.[1] ?? "";
  if (brand.includes("導入アーキテクチャ：")) return "architecture";
  if (brand.includes("設計ガイド：")) return "guide";
  if (html.includes("導入前の構成と課題") || html.includes("<b>設定の意図</b>")) return "architecture";
  return "guide";
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
