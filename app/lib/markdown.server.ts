import { marked, type Tokens } from "marked";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Custom renderer: convert ```mermaid blocks into <pre class="mermaid">
// HTML-escaped so the browser doesn't parse mermaid syntax as HTML.
// Mermaid.js reads textContent which auto-unescapes the entities.
const renderer = new marked.Renderer();
const originalCode = renderer.code.bind(renderer);
renderer.code = function (token: Tokens.Code): string {
  if (token.lang === "mermaid") {
    return `<pre class="mermaid">${escapeHtml(token.text)}</pre>`;
  }
  return originalCode(token);
};

// Configure marked for safe, well-formatted output
marked.setOptions({
  gfm: true,
  breaks: true,
  renderer,
});

export function renderMarkdown(content: string): string {
  // If content already looks like HTML (has tags), return as-is
  if (content.trim().startsWith("<") && /<\/(p|div|h[1-6]|ul|ol|table)>/.test(content)) {
    return content;
  }
  return marked.parse(content, { async: false }) as string;
}
