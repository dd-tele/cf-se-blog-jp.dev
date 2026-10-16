import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requireUser } from "~/lib/auth.server";
import { canManageSlide, getSlideById } from "~/lib/slides.server";
import { getSlideNotes, saveSlideNotes, MAX_NOTE_SLIDES } from "~/lib/slide-notes.server";
import { attachDeck, whenIframeLoaded, type DeckAdapter, type DeckSlideInfo } from "~/lib/deck-control";
import {
  MAX_NOTE_FILE_BYTES,
  NotesImportError,
  parseNotesFile,
  type ParsedNotesFile,
} from "~/lib/slide-notes-import";

type PendingImport = ParsedNotesFile & { fileName: string };
type ImportMode = "replace" | "fill";

export const meta: MetaFunction = () => [
  { title: "スピーカーノート編集 — Cloudflare フィールドノート" },
];

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const user = await requireUser(request, env);
  const slide = await getSlideById(env.DB, params.id!);
  if (!slide) throw new Response("Not Found", { status: 404 });
  if (!canManageSlide(user, slide)) {
    throw new Response("このスライドを編集する権限がありません", { status: 403 });
  }
  const notes = await getSlideNotes(env.DB, slide.id);
  return {
    slide: { id: slide.id, slug: slide.slug, title: slide.title, slideCount: slide.slideCount },
    notes,
  };
}

export async function action({ request, context, params }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const user = await requireUser(request, env);
  const slide = await getSlideById(env.DB, params.id!);
  if (!slide) throw new Response("Not Found", { status: 404 });
  if (!canManageSlide(user, slide)) throw new Response("権限がありません", { status: 403 });

  const form = await request.formData();
  let notes: unknown;
  try {
    notes = JSON.parse(String(form.get("notes") || "[]"));
  } catch {
    return { ok: false as const, error: "ノートの形式が正しくありません。" };
  }
  if (!Array.isArray(notes) || notes.length > MAX_NOTE_SLIDES) {
    return { ok: false as const, error: "ノートの形式が正しくありません。" };
  }
  const saved = await saveSlideNotes(env.DB, slide.id, notes.map((n) => String(n ?? "")));
  return { ok: true as const, saved, at: Date.now() };
}

export default function SlideNotesEditor() {
  const { slide, notes: initial } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const deckRef = useRef<DeckAdapter | null>(null);
  const [deckSlides, setDeckSlides] = useState<DeckSlideInfo[]>([]);
  const [deckTotal, setDeckTotal] = useState(0);
  const [notes, setNotes] = useState<string[]>(initial);
  const [active, setActive] = useState(0);
  const [dirty, setDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("replace");
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const rows = Math.max(deckTotal || slide.slideCount, notes.length, 1);
  const saving = fetcher.state !== "idle";

  const onDeckLoad = useCallback(async () => {
    if (!iframeRef.current) return;
    const deck = await attachDeck(iframeRef.current, { fallbackTotal: slide.slideCount });
    deck.makeStatic();
    deckRef.current = deck;
    setDeckTotal(deck.total());
    setDeckSlides(deck.slides());
  }, [slide.slideCount]);

  useEffect(() => {
    const iframe = iframeRef.current;
    return iframe ? whenIframeLoaded(iframe, onDeckLoad) : undefined;
  }, [onDeckLoad]);

  useEffect(() => {
    deckRef.current?.goto(active);
  }, [active]);

  useEffect(() => {
    if (fetcher.data && fetcher.data.ok) setDirty(false);
  }, [fetcher.data]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const setNote = (i: number, v: string) => {
    setNotes((cur) => {
      const next = [...cur];
      while (next.length <= i) next.push("");
      next[i] = v;
      return next;
    });
    setDirty(true);
  };

  const embedded = useMemo(() => deckSlides.filter((s) => s.notes).length, [deckSlides]);

  const importFromDeck = () => {
    let count = 0;
    setNotes((cur) => {
      const next = [...cur];
      deckSlides.forEach((s, i) => {
        while (next.length <= i) next.push("");
        if (s.notes && !next[i]?.trim()) {
          next[i] = s.notes;
          count += 1;
        }
      });
      return next;
    });
    setDirty(true);
    setTimeout(() => alert(count ? `${count} 枚分のノートを取り込みました。保存してください。` : "取り込めるノート（空欄のスライド）はありませんでした。"), 0);
  };

  const onFileChosen = async (file: File | undefined) => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    setImportError(null);
    setImportNotice(null);
    if (file.size > MAX_NOTE_FILE_BYTES) {
      setImportError(`ファイルが大きすぎます（上限 ${MAX_NOTE_FILE_BYTES / 1024 / 1024} MB）。`);
      return;
    }
    try {
      const parsed = parseNotesFile(file.name, await file.text());
      setImportMode("replace");
      setPending({ ...parsed, fileName: file.name });
    } catch (e) {
      setImportError(e instanceof NotesImportError ? e.message : "ファイルを読み込めませんでした。");
    }
  };

  const applyImport = () => {
    if (!pending) return;
    const incoming = pending.notes;
    let changed = 0;
    let skipped = 0;
    let next: string[];
    if (importMode === "replace") {
      next = [...incoming];
      const max = Math.max(notes.length, incoming.length);
      for (let i = 0; i < max; i++) if ((notes[i] ?? "") !== (incoming[i] ?? "")) changed += 1;
    } else {
      next = [...notes];
      incoming.forEach((body, i) => {
        if (!body.trim()) return;
        while (next.length <= i) next.push("");
        if (next[i]?.trim()) {
          if (next[i] !== body) skipped += 1;
          return;
        }
        next[i] = body;
        changed += 1;
      });
    }
    setNotes(next);
    if (changed) setDirty(true);
    setPending(null);
    setImportNotice(
      changed
        ? `${pending.fileName} から ${changed} 枚分を反映しました${skipped ? `（入力済みの ${skipped} 枚はそのまま）` : ""}。内容を確認して「保存」してください。`
        : "変更はありませんでした。"
    );
  };

  const save = () => {
    const trimmed = [...notes];
    while (trimmed.length && !trimmed[trimmed.length - 1]?.trim()) trimmed.pop();
    fetcher.submit({ notes: JSON.stringify(trimmed) }, { method: "post" });
  };

  const filled = notes.filter((n) => n?.trim()).length;
  const deckCount = deckTotal || slide.slideCount;

  const importStats = useMemo(() => {
    if (!pending) return null;
    const incoming = pending.notes;
    const incomingFilled = incoming.filter((n) => n.trim()).length;
    let overwritten = 0; // replace: existing non-empty notes replaced by different text
    let cleared = 0; // replace: existing non-empty notes that become empty
    let fillable = 0; // fill: empty slots that receive a note
    let kept = 0; // fill: non-empty slots left as-is although the file differs
    const max = Math.max(notes.length, incoming.length);
    for (let i = 0; i < max; i++) {
      const cur = notes[i] ?? "";
      const inc = incoming[i] ?? "";
      if (cur.trim() && !inc.trim()) cleared += 1;
      else if (cur.trim() && cur !== inc) overwritten += 1;
      if (inc.trim() && !cur.trim()) fillable += 1;
      if (inc.trim() && cur.trim() && cur !== inc) kept += 1;
    }
    return { incomingFilled, overwritten, cleared, fillable, kept };
  }, [pending, notes]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link to="/portal/slides" className="shrink-0 text-sm text-gray-500 hover:text-gray-700">
              ← スライド管理
            </Link>
            <span className="truncate text-sm font-semibold text-gray-900">{slide.title}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-xs text-gray-400 sm:inline">
              {filled} / {rows} 枚にノート
              {dirty ? " · 未保存" : fetcher.data?.ok ? " · 保存済み" : ""}
            </span>
            <a
              href={`/slides/${slide.slug}/speaker`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              スピーカービュー
            </a>
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:px-8">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-black shadow-sm">
            <div className="relative aspect-[16/9]">
              <iframe
                ref={iframeRef}
                src={`/slides/${slide.slug}/a/?embed=1`}
                title={slide.title}
                className="pointer-events-none absolute inset-0 h-full w-full border-0"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setActive((a) => Math.max(0, a - 1))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              ◀
            </button>
            <span className="font-mono text-sm text-gray-600">
              {active + 1} / {rows}
            </span>
            <button
              onClick={() => setActive((a) => Math.min(rows - 1, a + 1))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              ▶
            </button>
            <div className="ml-auto flex flex-wrap justify-end gap-2">
              {embedded > 0 && (
                <button
                  onClick={importFromDeck}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                  title="デッキ HTML 内の <aside class=&quot;notes&quot;> を空欄のスライドへ取り込みます"
                >
                  デッキ内ノートを取り込む（{embedded}）
                </button>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                title="Markdown（.md）または JSON（.json）のノートファイルを読み込みます"
              >
                ファイルから取り込む
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.markdown,.txt,.json,text/markdown,text/plain,application/json"
                className="hidden"
                data-testid="notes-file-input"
                onChange={(e) => onFileChosen(e.target.files?.[0])}
              />
            </div>
          </div>
          {importError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {importError}
            </p>
          )}
          {importNotice && (
            <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
              {importNotice}
            </p>
          )}
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 text-xs leading-relaxed text-gray-500">
            <p className="font-semibold text-gray-700">書き方</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>空行で段落、行頭「- 」で箇条書き、**太字** が使えます。</li>
              <li>ノートは発表者とペアリングしたスマホだけに表示され、公開スライドには含まれません。</li>
              <li>欄をクリックすると、左のプレビューがそのスライドに移動します。</li>
            </ul>
            <p className="mt-3 font-semibold text-gray-700">ファイルから取り込む</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>
                Markdown: 「<code className="font-mono">## 1. 見出し</code>」から次の「
                <code className="font-mono">## 2.</code>」までがスライド 1 のノートです（見出しの文字とコメントは取り込みません）。
              </li>
              <li>
                JSON: <code className="font-mono">{'{ "version": 1, "notes": ["…", "…"] }'}</code> または文字列の配列（0 始まり）。
              </li>
              <li>取り込んだ内容は編集欄に反映されるだけです。確認してから「保存」してください。</li>
            </ul>
          </div>
          {fetcher.data && !fetcher.data.ok && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fetcher.data.error}</p>
          )}
        </aside>

        <ol className="space-y-3">
          {Array.from({ length: rows }, (_, i) => (
            <li
              key={i}
              className={`rounded-xl border bg-white p-3 transition ${
                i === active ? "border-brand-400 ring-1 ring-brand-200" : "border-gray-200"
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600">{i + 1}</span>
                <span className="truncate text-sm font-medium text-gray-800">
                  {deckSlides[i]?.title || `スライド ${i + 1}`}
                </span>
              </div>
              <textarea
                value={notes[i] ?? ""}
                onChange={(e) => setNote(i, e.target.value)}
                onFocus={() => setActive(i)}
                rows={Math.min(14, Math.max(3, (notes[i] ?? "").split("\n").length + 1))}
                placeholder="話す内容、補足する設計の根拠、想定質問など"
                className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </li>
          ))}
        </ol>
      </main>

      {pending && importStats && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notes-import-title"
          onKeyDown={(e) => e.key === "Escape" && setPending(null)}
        >
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 id="notes-import-title" className="text-base font-semibold text-gray-900">
              ノートを取り込む
            </h2>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-gray-500">ファイル</dt>
              <dd className="truncate font-mono text-gray-800">{pending.fileName}</dd>
              <dt className="text-gray-500">形式</dt>
              <dd className="text-gray-800">{pending.format === "json" ? "JSON" : "Markdown"}</dd>
              <dt className="text-gray-500">ノート</dt>
              <dd className="text-gray-800" data-testid="import-count">
                {pending.notes.length} 枚分（うち空欄 {pending.notes.length - importStats.incomingFilled} 枚）
              </dd>
              <dt className="text-gray-500">デッキ</dt>
              <dd className="text-gray-800">{deckCount ? `${deckCount} 枚` : "不明"}</dd>
            </dl>

            {(pending.warnings.length > 0 || (deckCount > 0 && pending.notes.length !== deckCount)) && (
              <ul className="mt-4 list-disc space-y-1 rounded-lg bg-amber-50 py-2 pl-8 pr-3 text-sm text-amber-800" data-testid="import-warnings">
                {deckCount > 0 && pending.notes.length !== deckCount && (
                  <li>
                    ノートの枚数（{pending.notes.length}）とデッキの枚数（{deckCount}）が一致しません。
                    {pending.notes.length > deckCount
                      ? "デッキに無いスライドのノートも保存されます。"
                      : "番号がずれていないか確認してください。"}
                  </li>
                )}
                {pending.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}

            <fieldset className="mt-4 space-y-2 text-sm">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="import-mode"
                  value="replace"
                  checked={importMode === "replace"}
                  onChange={() => setImportMode("replace")}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-gray-900">すべて置き換える</span>
                  <span className="block text-xs text-gray-500">
                    {importStats.overwritten + importStats.cleared > 0
                      ? [
                          importStats.overwritten > 0 && `入力済みの ${importStats.overwritten} 枚が上書きされます`,
                          importStats.cleared > 0 && `ファイル側が空欄の ${importStats.cleared} 枚は削除されます`,
                        ]
                          .filter(Boolean)
                          .join("。") + "。"
                      : "入力済みのノートは変わりません。"}
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="import-mode"
                  value="fill"
                  checked={importMode === "fill"}
                  onChange={() => setImportMode("fill")}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-gray-900">空欄のスライドだけに入れる</span>
                  <span className="block text-xs text-gray-500">
                    {importStats.fillable} 枚に入ります
                    {importStats.kept > 0 ? `（入力済みの ${importStats.kept} 枚はそのまま）` : ""}。
                  </span>
                </span>
              </label>
            </fieldset>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setPending(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={applyImport}
                autoFocus
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
              >
                取り込む
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
