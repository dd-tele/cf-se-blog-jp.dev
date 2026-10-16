import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { attachDeck, whenIframeLoaded, type DeckAdapter, type DeckSlideInfo } from "~/lib/deck-control";
import { usePresentSocket, type PresentMessage } from "~/lib/present-socket";

// Speaker view for phones and tablets.
//   - remote mode   : paired to a live room; page turns drive the main screen
//   - rehearsal mode: standalone, navigates locally (practice / review notes)
//
// Layout adapts: phone portrait = preview + notes + big buttons;
// tablet / landscape = current & next preview on the left, notes on the right.

interface Props {
  slide: { slug: string; title: string; slideCount: number };
  notes: string[];
  room?: { roomId: string; roomKey: string } | null;
  exitHref?: string;
}

type Cmd = "next" | "prev" | "first" | "last" | "goto";

const FONT_SIZES = [15, 17, 19, 22, 26, 30];

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Minimal, safe markdown: paragraphs, "- " bullets, **bold**. */
function NotesBody({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (line: string, key: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={`${key}-${i}`} className="font-bold text-amber-200">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <Fragment key={`${key}-${i}`}>{part}</Fragment>
      )
    );
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-・*]\s+/.test(l))) {
          return (
            <ul key={bi} className="mb-4 list-disc space-y-1.5 pl-6">
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*[-・*]\s+/, ""), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="mb-4 whitespace-pre-wrap">
            {inline(block, String(bi))}
          </p>
        );
      })}
    </>
  );
}

/** A non-interactive thumbnail of slide `idx`. */
function SlidePreview({
  slug,
  idx,
  label,
  onInfo,
}: {
  slug: string;
  idx: number | null;
  label: string;
  onInfo?: (total: number, slides: DeckSlideInfo[]) => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const deckRef = useRef<DeckAdapter | null>(null);
  const [ready, setReady] = useState(false);

  const onLoad = useCallback(async () => {
    if (!ref.current) return;
    const deck = await attachDeck(ref.current);
    deck.makeStatic();
    deckRef.current = deck;
    setReady(true);
    onInfo?.(deck.total(), deck.slides());
  }, [onInfo]);

  useEffect(() => {
    const iframe = ref.current;
    return iframe ? whenIframeLoaded(iframe, onLoad) : undefined;
  }, [onLoad]);

  useEffect(() => {
    if (ready && idx !== null) deckRef.current?.goto(idx);
  }, [ready, idx]);

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-neutral-800 ring-1 ring-white/10">
      <iframe
        ref={ref}
        src={`/slides/${slug}/a/?embed=1`}
        title={label}
        tabIndex={-1}
        className={`pointer-events-none absolute inset-0 h-full w-full border-0 transition-opacity ${
          idx === null ? "opacity-0" : "opacity-100"
        }`}
      />
      {idx === null && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-white/40">
          最後のスライドです
        </div>
      )}
      <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white/80">
        {label}
      </span>
    </div>
  );
}

export function SpeakerConsole({ slide, notes, room, exitHref }: Props) {
  const [idx, setIdx] = useState(0);
  const [total, setTotal] = useState(slide.slideCount);
  const [deckSlides, setDeckSlides] = useState<DeckSlideInfo[]>([]);
  const [fontStep, setFontStep] = useState(2);
  const [showJump, setShowJump] = useState(false);
  const [showNext, setShowNext] = useState(true);

  // ── Timer (persists across reloads within this tab) ──
  const timerKey = `speaker-timer:${slide.slug}:${room?.roomId ?? "solo"}`;
  const [timer, setTimer] = useState<{ startedAt: number | null; accumulated: number }>({
    startedAt: null,
    accumulated: 0,
  });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(timerKey);
      if (saved) setTimer(JSON.parse(saved));
      const fs = localStorage.getItem("speaker-font-step");
      if (fs) setFontStep(Math.min(FONT_SIZES.length - 1, Math.max(0, Number(fs))));
      const sn = localStorage.getItem("speaker-show-next");
      if (sn) setShowNext(sn === "1");
    } catch {
      /* ignore */
    }
  }, [timerKey]);

  useEffect(() => {
    try {
      sessionStorage.setItem(timerKey, JSON.stringify(timer));
    } catch {
      /* ignore */
    }
  }, [timer, timerKey]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const elapsed = timer.accumulated + (timer.startedAt ? now - timer.startedAt : 0);
  const toggleTimer = () =>
    setTimer((t) =>
      t.startedAt
        ? { startedAt: null, accumulated: t.accumulated + (Date.now() - t.startedAt) }
        : { ...t, startedAt: Date.now() }
    );
  const resetTimer = () => setTimer({ startedAt: null, accumulated: 0 });

  // ── Live room ──
  const onMessage = useCallback((msg: PresentMessage) => {
    if (msg.t === "state" && typeof msg.idx === "number") {
      setIdx(msg.idx);
      if (msg.total) setTotal(msg.total);
    }
  }, []);
  const { status, peers, send } = usePresentSocket({
    roomId: room?.roomId ?? null,
    roomKey: room?.roomKey ?? null,
    role: "remote",
    onMessage,
  });
  const live = !!room && status === "open" && peers.display > 0;

  const go = useCallback(
    (cmd: Cmd, target?: number) => {
      if (navigator.vibrate) navigator.vibrate(12);
      setTimer((t) => (t.startedAt || t.accumulated ? t : { startedAt: Date.now(), accumulated: 0 }));
      if (live && send({ t: "cmd", cmd, idx: target })) return; // display reports back
      setIdx((cur) => {
        const max = Math.max(0, (total || 1) - 1);
        switch (cmd) {
          case "next": return Math.min(cur + 1, max);
          case "prev": return Math.max(cur - 1, 0);
          case "first": return 0;
          case "last": return max;
          case "goto": return Math.max(0, Math.min(target ?? cur, max));
        }
      });
    },
    [live, send, total]
  );

  // ── Keyboard (tablets with keyboards, laptops, clickers) ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); go("next"); }
      if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); go("prev"); }
      if (e.key === "Home") go("first");
      if (e.key === "End") go("last");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // ── Keep the screen awake while presenting ──
  useEffect(() => {
    let lock: any = null;
    const request = async () => {
      try {
        lock = await (navigator as any).wakeLock?.request("screen");
      } catch {
        /* unsupported or denied */
      }
    };
    const onVisible = () => document.visibilityState === "visible" && request();
    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release?.();
    };
  }, []);

  // ── Swipe on the notes area ──
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const p = e.touches[0];
    touch.current = { x: p.clientX, y: p.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - s.x;
    const dy = p.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 50 && Date.now() - s.t < 600) {
      go(dx < 0 ? "next" : "prev");
    }
  };

  const onDeckInfo = useCallback((t: number, list: DeckSlideInfo[]) => {
    if (t) setTotal((cur) => (live ? cur : t));
    setDeckSlides(list);
  }, [live]);

  const noteText = useMemo(() => {
    const stored = notes[idx]?.trim();
    if (stored) return stored;
    return deckSlides[idx]?.notes?.trim() || "";
  }, [notes, deckSlides, idx]);

  const nextIdx = idx + 1 < (total || 0) ? idx + 1 : null;
  const fontSize = FONT_SIZES[fontStep];
  const setFont = (d: number) => {
    const v = Math.min(FONT_SIZES.length - 1, Math.max(0, fontStep + d));
    setFontStep(v);
    try { localStorage.setItem("speaker-font-step", String(v)); } catch { /* ignore */ }
  };
  const toggleNext = () => {
    setShowNext((v) => {
      try { localStorage.setItem("speaker-show-next", v ? "0" : "1"); } catch { /* ignore */ }
      return !v;
    });
  };

  const statusLabel = !room
    ? "リハーサル"
    : status !== "open"
      ? "再接続中…"
      : peers.display > 0
        ? "メイン画面と接続中"
        : "メイン画面を待っています";
  const statusColor = !room
    ? "bg-sky-400"
    : status !== "open"
      ? "bg-amber-400 animate-pulse"
      : peers.display > 0
        ? "bg-emerald-400"
        : "bg-amber-400";

  const clock = new Date(now).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className="fixed inset-0 flex select-none flex-col bg-neutral-950 text-white"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusColor}`} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight">{slide.title}</p>
          <p className="truncate text-[10px] leading-tight text-white/50">{statusLabel}</p>
        </div>
        <button
          onClick={toggleTimer}
          className={`rounded-md px-2 py-1 font-mono text-base font-bold tabular-nums ${
            timer.startedAt ? "text-emerald-300" : "text-white/70"
          }`}
          title="タップで開始 / 一時停止"
        >
          {fmt(elapsed)}
        </button>
        <button
          onClick={resetTimer}
          className="rounded-md px-1.5 py-1 text-[10px] text-white/40 hover:text-white/80"
          title="タイマーをリセット"
        >
          リセット
        </button>
        <span className="hidden font-mono text-sm tabular-nums text-white/50 sm:inline">{clock}</span>
        {exitHref && (
          <a href={exitHref} className="ml-1 rounded-md px-2 py-1 text-[11px] text-white/50 hover:text-white">
            終了
          </a>
        )}
      </header>

      {/* Body */}
      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] md:gap-4 md:p-4">
        <section className="flex shrink-0 flex-col gap-3 md:min-h-0">
          <SlidePreview slug={slide.slug} idx={idx} label={`現在 ${idx + 1}`} onInfo={onDeckInfo} />
          {showNext && (
            <div className="hidden md:block">
              <SlidePreview slug={slide.slug} idx={nextIdx} label={nextIdx !== null ? `次 ${nextIdx + 1}` : "次"} />
            </div>
          )}
          {nextIdx !== null && deckSlides[nextIdx]?.title && (
            <p className="truncate text-xs text-white/50 md:hidden">
              次: {deckSlides[nextIdx].title}
            </p>
          )}
        </section>

        <section
          className="relative flex min-h-0 flex-1 flex-col rounded-xl bg-neutral-900 ring-1 ring-white/10"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex shrink-0 items-center gap-1 border-b border-white/10 px-3 py-1.5">
            <span className="text-[11px] font-semibold tracking-wide text-white/50">スピーカーノート</span>
            <span className="ml-auto" />
            <button onClick={toggleNext} className="hidden rounded px-2 py-1 text-[11px] text-white/50 hover:bg-white/10 md:inline">
              {showNext ? "次を隠す" : "次を表示"}
            </button>
            <button onClick={() => setFont(-1)} className="rounded px-2 py-1 text-xs text-white/70 hover:bg-white/10" aria-label="文字を小さく">
              A−
            </button>
            <button onClick={() => setFont(1)} className="rounded px-2 py-1 text-sm text-white/70 hover:bg-white/10" aria-label="文字を大きく">
              A+
            </button>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 leading-relaxed text-white/90"
            style={{ fontSize }}
          >
            {noteText ? (
              <NotesBody text={noteText} />
            ) : (
              <p className="text-sm text-white/30">このスライドのノートはまだありません。</p>
            )}
          </div>
        </section>
      </main>

      {/* Controls */}
      <footer className="grid h-[76px] shrink-0 grid-cols-[1fr_auto_1.6fr] gap-2 border-t border-white/10 px-3 py-2.5">
        <button
          onClick={() => go("prev")}
          disabled={idx === 0}
          className="touch-manipulation rounded-xl bg-white/10 text-base font-bold active:bg-white/20 disabled:opacity-30"
        >
          ◀ 前へ
        </button>
        <button
          onClick={() => setShowJump(true)}
          className="touch-manipulation min-w-[72px] rounded-xl px-2 font-mono text-lg font-bold tabular-nums text-white/80 active:bg-white/10"
          title="スライド一覧から移動"
        >
          {idx + 1}
          <span className="text-sm text-white/40"> / {total || "?"}</span>
        </button>
        <button
          onClick={() => go("next")}
          disabled={!!total && idx >= total - 1 && !live}
          className="touch-manipulation rounded-xl bg-[#f6821f] text-lg font-bold text-white active:bg-[#d9601a] disabled:opacity-30"
        >
          次へ ▶
        </button>
      </footer>

      {/* Jump sheet */}
      {showJump && (
        <div className="absolute inset-0 z-20 flex flex-col bg-neutral-950/95 backdrop-blur" onClick={() => setShowJump(false)}>
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
            <p className="text-sm font-semibold">スライドへ移動</p>
            <button className="text-sm text-white/60">閉じる</button>
          </div>
          <ol className="min-h-0 flex-1 overflow-y-auto p-2" onClick={(e) => e.stopPropagation()}>
            {Array.from({ length: total || 0 }, (_, i) => (
              <li key={i}>
                <button
                  onClick={() => {
                    go("goto", i);
                    setShowJump(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm ${
                    i === idx ? "bg-[#f6821f]/20 text-white" : "text-white/80 active:bg-white/10"
                  }`}
                >
                  <span className="w-8 shrink-0 text-right font-mono text-white/40">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{deckSlides[i]?.title || `スライド ${i + 1}`}</span>
                  {(notes[i]?.trim() || deckSlides[i]?.notes) && (
                    <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">ノート</span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
