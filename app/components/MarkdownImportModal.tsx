import { useState } from "react";

export interface ImportedData {
  title: string;
  content: string;
  tags: string;
  category: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (data: ImportedData) => void;
}

/** Parse YAML-like frontmatter between --- delimiters */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("---")) {
    return { meta: {}, body: raw };
  }

  const endIdx = trimmed.indexOf("---", 3);
  if (endIdx === -1) {
    return { meta: {}, body: raw };
  }

  const yamlBlock = trimmed.slice(3, endIdx).trim();
  const body = trimmed.slice(endIdx + 3).replace(/^\n+/, "");

  const meta: Record<string, string> = {};
  for (const line of yamlBlock.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    let value = line.slice(colonIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Handle YAML array syntax: [a, b, c]
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
        .join(", ");
    }
    meta[key] = value;
  }

  return { meta, body };
}

/** Extract title from first # heading if no frontmatter title */
function extractTitleFromHeading(content: string): { title: string; body: string } {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^#\s+(.+)$/);
    if (match) {
      const title = match[1].trim();
      const body = [...lines.slice(0, i), ...lines.slice(i + 1)].join("\n").replace(/^\n+/, "");
      return { title, body };
    }
    // Skip blank lines at the top
    if (lines[i].trim() !== "") break;
  }
  return { title: "", body: content };
}

export function MarkdownImportModal({ open, onClose, onImport }: Props) {
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<ImportedData | null>(null);

  function handleParse() {
    if (!raw.trim()) return;

    const { meta, body } = parseFrontmatter(raw);

    let title = meta.title || "";
    let content = body;

    // If no frontmatter title, try extracting from first # heading
    if (!title) {
      const extracted = extractTitleFromHeading(body);
      title = extracted.title;
      content = extracted.body;
    }

    const tags =
      meta.tags ||
      meta.tag ||
      "";

    const category =
      meta.category ||
      meta.categories ||
      "";

    setPreview({ title, content, tags, category });
  }

  function handleImport() {
    if (!preview) return;
    onImport(preview);
    setRaw("");
    setPreview(null);
    onClose();
  }

  function handleClose() {
    setRaw("");
    setPreview(null);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Markdown インポート</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600" aria-label="閉じる">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!preview ? (
            <>
              <p className="mb-3 text-sm text-gray-600">
                Markdown テキストを貼り付けてください。YAML Frontmatter があればタイトル・タグ・カテゴリを自動抽出します。
              </p>
              <div className="mb-3 rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-500">
                <p className="mb-1 font-semibold text-gray-600">対応フォーマット例:</p>
                <pre className="whitespace-pre-wrap font-mono leading-relaxed">{`---
title: 記事タイトル
tags: [Workers, D1, セキュリティ]
category: Zero Trust
---

# 本文の見出し
記事の本文...`}</pre>
                <p className="mt-2 text-gray-400">
                  ※ Frontmatter なしの場合、最初の <code className="rounded bg-gray-200 px-1"># 見出し</code> をタイトルとして抽出します
                </p>
              </div>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="Markdown を貼り付け..."
                rows={14}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 font-mono text-sm leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                autoFocus
              />
            </>
          ) : (
            <>
              <p className="mb-4 text-sm font-medium text-gray-700">
                以下の内容でインポートします。問題なければ「インポート」をクリックしてください。
              </p>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="font-semibold text-gray-600">タイトル</dt>
                  <dd className="mt-0.5 rounded-lg bg-gray-50 px-3 py-2 text-gray-900">
                    {preview.title || <span className="italic text-gray-400">（未検出 — フォームで手動入力してください）</span>}
                  </dd>
                </div>
                {preview.tags && (
                  <div>
                    <dt className="font-semibold text-gray-600">タグ</dt>
                    <dd className="mt-0.5 flex flex-wrap gap-1.5">
                      {preview.tags.split(",").map((t) => (
                        <span key={t.trim()} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                          {t.trim()}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                {preview.category && (
                  <div>
                    <dt className="font-semibold text-gray-600">カテゴリ</dt>
                    <dd className="mt-0.5 text-gray-900">{preview.category}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-semibold text-gray-600">本文（プレビュー）</dt>
                  <dd className="mt-0.5 max-h-48 overflow-y-auto rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs leading-relaxed text-gray-700 whitespace-pre-wrap">
                    {preview.content.slice(0, 2000)}
                    {preview.content.length > 2000 && "\n\n...（以下省略）"}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          {preview ? (
            <>
              <button
                onClick={() => setPreview(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                戻る
              </button>
              <button
                onClick={handleImport}
                className="rounded-lg bg-brand-500 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
              >
                インポート
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleParse}
                disabled={!raw.trim()}
                className="rounded-lg bg-brand-500 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                解析する
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
