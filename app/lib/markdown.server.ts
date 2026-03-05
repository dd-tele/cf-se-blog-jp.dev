import { marked, type Tokens } from "marked";

// Custom renderer: convert ```mermaid blocks into <div class="mermaid">
const renderer = new marked.Renderer();
const originalCode = renderer.code.bind(renderer);
renderer.code = function (token: Tokens.Code): string {
  if (token.lang === "mermaid") {
    return `<div class="mermaid">${token.text}</div>`;
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
