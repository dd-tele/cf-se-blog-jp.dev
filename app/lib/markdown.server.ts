import { marked } from "marked";

// Configure marked for safe, well-formatted output
marked.setOptions({
  gfm: true,
  breaks: true,
});

export function renderMarkdown(content: string): string {
  // If content already looks like HTML (has tags), return as-is
  if (content.trim().startsWith("<") && /<\/(p|div|h[1-6]|ul|ol|table)>/.test(content)) {
    return content;
  }
  return marked.parse(content, { async: false }) as string;
}
