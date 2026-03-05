import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function estimateReadingTime(content: string): number {
  const wordsPerMinute = 400; // Japanese reading speed
  const charCount = content.length;
  return Math.max(1, Math.ceil(charCount / wordsPerMinute));
}

/**
 * Strip Markdown syntax and return plain text.
 * Handles headings, bold/italic, links, images, code blocks, lists, etc.
 */
export function stripMarkdown(md: string): string {
  return md
    // Remove code blocks (```...```)
    .replace(/```[\s\S]*?```/g, "")
    // Remove inline code
    .replace(/`([^`]+)`/g, "$1")
    // Remove images ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    // Convert links [text](url) to text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove headings (# ... )
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold/italic markers
    .replace(/(\*{1,3}|_{1,3})(.+?)\1/g, "$2")
    // Remove strikethrough
    .replace(/~~(.+?)~~/g, "$1")
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Remove blockquotes
    .replace(/^>\s?/gm, "")
    // Remove unordered list markers
    .replace(/^[\s]*[-*+]\s+/gm, "")
    // Remove ordered list markers
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // Remove HTML tags
    .replace(/<[^>]+>/g, "")
    // Collapse multiple newlines
    .replace(/\n{2,}/g, "\n")
    // Collapse multiple spaces
    .replace(/ {2,}/g, " ")
    .trim();
}

/**
 * Generate a clean, reader-friendly excerpt from Markdown content.
 * Skips the title heading and picks the first meaningful paragraph.
 */
export function generateExcerpt(content: string, maxLength = 240): string {
  const plain = stripMarkdown(content);
  // Split into lines, skip very short ones (headings, labels)
  const lines = plain.split("\n").map((l) => l.trim()).filter(Boolean);
  const meaningful = lines.filter((l) => l.length > 20);

  // Join multiple meaningful sentences for a richer highlight
  let text = "";
  for (const line of (meaningful.length > 0 ? meaningful : lines)) {
    const next = text ? text + " " + line : line;
    if (next.length > maxLength) break;
    text = next;
  }
  if (!text) text = lines.join(" ");

  if (text.length <= maxLength) return text;
  // Truncate at sentence boundary
  const truncated = text.slice(0, maxLength);
  const lastPeriod = Math.max(
    truncated.lastIndexOf("。"),
    truncated.lastIndexOf("．"),
    truncated.lastIndexOf(". ")
  );
  if (lastPeriod > maxLength * 0.4) return truncated.slice(0, lastPeriod + 1);
  return truncated.replace(/\s+\S*$/, "") + "…";
}
