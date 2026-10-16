import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requireUser } from "~/lib/auth.server";
import { canManageSlide, getSlideById } from "~/lib/slides.server";
import { getSlideNotes, saveSlideNotes, MAX_NOTE_SLIDES } from "~/lib/slide-notes.server";
import { attachDeck, whenIframeLoaded, type DeckAdapter, type DeckSlideInfo } from "~/lib/deck-control";

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

  const save = () => {
    const trimmed = [...notes];
    while (trimmed.length && !trimmed[trimmed.length - 1]?.trim()) trimmed.pop();
    fetcher.submit({ notes: JSON.stringify(trimmed) }, { method: "post" });
  };

  const filled = notes.filter((n) => n?.trim()).length;

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
            {embedded > 0 && (
              <button
                onClick={importFromDeck}
                className="ml-auto rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                title="デッキ HTML 内の <aside class=&quot;notes&quot;> を空欄のスライドへ取り込みます"
              >
                デッキ内ノートを取り込む（{embedded}）
              </button>
            )}
          </div>
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 text-xs leading-relaxed text-gray-500">
            <p className="font-semibold text-gray-700">書き方</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>空行で段落、行頭「- 」で箇条書き、**太字** が使えます。</li>
              <li>ノートは発表者とペアリングしたスマホだけに表示され、公開スライドには含まれません。</li>
              <li>欄をクリックすると、左のプレビューがそのスライドに移動します。</li>
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
    </div>
  );
}
