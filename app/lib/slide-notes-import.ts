// Parse speaker-note files (Markdown / JSON) for bulk import into the notes editor.
// Pure and dependency-free so it runs in the browser (and in tests under Node).
//
// Markdown: "## <n>. <heading>" starts the note for slide n (1-based, reading order);
// everything up to the next "## <n>." is the body. Lines before the first section and
// HTML comments are ignored. The heading text itself is not imported.
//
// JSON: { "version": 1, "notes": ["...", ...] } or a bare array of strings (0-based).

export const MAX_NOTE_CHARS = 8000;
export const MAX_NOTE_SLIDES = 500;
export const MAX_NOTE_FILE_BYTES = 2 * 1024 * 1024;

export type NotesFileFormat = "markdown" | "json";

export type ParsedNotesFile = {
  format: NotesFileFormat;
  /** Dense, 0-based. Trailing empty entries are removed. */
  notes: string[];
  /** Non-fatal issues to show before applying. */
  warnings: string[];
};

export class NotesImportError extends Error {}

export function parseNotesFile(fileName: string, text: string): ParsedNotesFile {
  const src = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const format = detectFormat(fileName, src);
  const result = format === "json" ? parseJson(src) : parseMarkdown(src);

  while (result.notes.length && !result.notes[result.notes.length - 1].trim()) result.notes.pop();
  if (!result.notes.length) throw new NotesImportError("取り込めるノートがありませんでした。");
  if (result.notes.length > MAX_NOTE_SLIDES) {
    throw new NotesImportError(`ノートは ${MAX_NOTE_SLIDES} 枚分までです（${result.notes.length} 枚分あります）。`);
  }
  const tooLong = result.notes
    .map((n, i) => (n.length > MAX_NOTE_CHARS ? i + 1 : 0))
    .filter(Boolean);
  if (tooLong.length) {
    throw new NotesImportError(
      `1 枚あたり ${MAX_NOTE_CHARS.toLocaleString()} 文字までです。超えているスライド: ${tooLong.join(", ")}`
    );
  }
  return { format, ...result };
}

function detectFormat(fileName: string, src: string): NotesFileFormat {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "json") return "json";
  if (ext === "md" || ext === "markdown" || ext === "txt") return "markdown";
  return /^\s*[[{]/.test(src) ? "json" : "markdown";
}

function parseMarkdown(src: string): Omit<ParsedNotesFile, "format"> {
  const md = src.replace(/<!--[\s\S]*?-->/g, "");
  const notes: string[] = [];
  const re = /^##[ \t]+(\d+)\.[^\n]*(?:\n|$)([\s\S]*?)(?=^##[ \t]+\d+\.|(?![\s\S]))/gm;
  let m: RegExpExecArray | null;
  let sections = 0;
  while ((m = re.exec(md))) {
    const n = Number(m[1]);
    if (n < 1) throw new NotesImportError(`スライド番号は 1 から始めてください（「## ${m[1]}.」）。`);
    if (n > MAX_NOTE_SLIDES) {
      throw new NotesImportError(`スライド番号が大きすぎます（「## ${n}.」、上限 ${MAX_NOTE_SLIDES}）。`);
    }
    if (notes[n - 1] !== undefined) throw new NotesImportError(`スライド ${n} のノートが重複しています。`);
    notes[n - 1] = m[2].trim();
    sections += 1;
  }
  if (!sections) {
    throw new NotesImportError(
      "「## 1. 見出し」の形式の見出しが見つかりませんでした。各スライドのノートを「## <番号>. <見出し>」で始めてください。"
    );
  }
  const missing: number[] = [];
  for (let i = 0; i < notes.length; i++) {
    if (notes[i] === undefined) {
      notes[i] = "";
      missing.push(i + 1);
    }
  }
  const warnings = missing.length ? [`見出しが無いスライド番号があります: ${summarize(missing)}（空欄として扱います）`] : [];
  return { notes, warnings };
}

function parseJson(src: string): Omit<ParsedNotesFile, "format"> {
  let data: unknown;
  try {
    data = JSON.parse(src);
  } catch {
    throw new NotesImportError("JSON として読み取れませんでした。");
  }
  const warnings: string[] = [];
  let list: unknown;
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === "object" && Array.isArray((data as { notes?: unknown }).notes)) {
    const obj = data as { version?: unknown; slideCount?: unknown; notes: unknown[] };
    if (obj.version !== undefined && obj.version !== 1) {
      warnings.push(`未対応のバージョンです（version: ${JSON.stringify(obj.version)}）。version 1 として読み込みます。`);
    }
    if (typeof obj.slideCount === "number" && obj.slideCount !== obj.notes.length) {
      warnings.push(`slideCount（${obj.slideCount}）と notes の要素数（${obj.notes.length}）が一致しません。`);
    }
    list = obj.notes;
  } else {
    throw new NotesImportError("JSON には notes 配列（または文字列の配列）が必要です。");
  }
  const arr = list as unknown[];
  const bad = arr.map((v, i) => (v == null || typeof v === "string" ? 0 : i + 1)).filter(Boolean);
  if (bad.length) throw new NotesImportError(`文字列ではないノートがあります（スライド ${summarize(bad)}）。`);
  return { notes: arr.map((v) => String(v ?? "").trim()), warnings };
}

function summarize(nums: number[]): string {
  return nums.length > 10 ? `${nums.slice(0, 10).join(", ")} ほか ${nums.length - 10} 件` : nums.join(", ");
}
