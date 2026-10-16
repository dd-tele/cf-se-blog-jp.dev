// Shared (client + server) slide category definitions for the slide portal.

export const SLIDE_CATEGORIES = ["event", "customer", "other"] as const;
export type SlideCategory = (typeof SLIDE_CATEGORIES)[number];

export const SLIDE_CATEGORY_LABEL: Record<SlideCategory, string> = {
  event: "イベント登壇",
  customer: "お客様向け",
  other: "その他",
};

export const SLIDE_CATEGORY_BADGE: Record<SlideCategory, string> = {
  event: "bg-brand-50 text-brand-700",
  customer: "bg-sky-50 text-sky-700",
  other: "bg-gray-100 text-gray-600",
};

export function parseSlideCategory(v: unknown): SlideCategory {
  return SLIDE_CATEGORIES.includes(v as SlideCategory) ? (v as SlideCategory) : "event";
}
