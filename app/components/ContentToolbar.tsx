import { useState } from "react";

interface ContentToolbarProps {
  onInsert: (markdown: string) => void;
}

const TABLE_TEMPLATE = `
| 項目 | 説明 | 備考 |
|------|------|------|
|      |      |      |
|      |      |      |
|      |      |      |
`;

const CODE_LANGUAGES = [
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "Python", value: "python" },
  { label: "SQL", value: "sql" },
  { label: "Shell / Bash", value: "bash" },
  { label: "TOML", value: "toml" },
  { label: "YAML", value: "yaml" },
  { label: "JSON", value: "json" },
  { label: "HTML", value: "html" },
  { label: "CSS", value: "css" },
  { label: "HCL (Terraform)", value: "hcl" },
  { label: "Mermaid 図表", value: "mermaid" },
  { label: "その他", value: "" },
];

export function ContentToolbar({ onInsert }: ContentToolbarProps) {
  const [codeMenuOpen, setCodeMenuOpen] = useState(false);

  function insertTable() {
    onInsert(TABLE_TEMPLATE);
  }

  function insertCode(lang: string) {
    const placeholder = lang === "mermaid"
      ? "flowchart LR\n    A[開始] --> B[処理] --> C[終了]"
      : "// ここにコードを入力";
    onInsert(`\n\`\`\`${lang}\n${placeholder}\n\`\`\`\n`);
    setCodeMenuOpen(false);
  }

  return (
    <div className="flex items-center gap-2">
      {/* Table insert */}
      <button
        type="button"
        onClick={insertTable}
        className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
        title="表を挿入"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>
        表を挿入
      </button>

      {/* Code block insert */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setCodeMenuOpen(!codeMenuOpen)}
          className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          title="コードブロックを挿入"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          コードを挿入
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        {codeMenuOpen && (
          <>
            {/* Backdrop to close menu */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setCodeMenuOpen(false)}
            />
            <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {CODE_LANGUAGES.map((lang) => (
                <button
                  key={lang.value}
                  type="button"
                  onClick={() => insertCode(lang.value)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
                >
                  {lang.value === "mermaid" ? (
                    <span className="inline-block w-3 text-center text-purple-500">◆</span>
                  ) : (
                    <span className="inline-block w-3 text-center font-mono text-gray-400">#</span>
                  )}
                  {lang.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
