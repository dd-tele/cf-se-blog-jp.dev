// Browser-only helpers to drive a slide deck rendered in a same-origin iframe.
//
// reveal.js decks (the house template) are controlled through the Reveal API
// using a *linear* slide index (reading order, vertical slides included).
// Other HTML decks fall back to synthetic arrow-key events.

export interface DeckSlideInfo {
  title: string;
  notes: string;
}

export interface DeckAdapter {
  kind: "reveal" | "keys";
  total(): number;
  index(): number;
  next(): void;
  prev(): void;
  first(): void;
  last(): void;
  goto(idx: number): void;
  onChange(cb: (idx: number, total: number) => void): () => void;
  /** Title and <aside class="notes"> text of each slide (reveal only). */
  slides(): DeckSlideInfo[];
  /** Static thumbnail mode: no controls, no input, all fragments visible. */
  makeStatic(): void;
}

type RevealApi = any;

function revealOf(iframe: HTMLIFrameElement): RevealApi | null {
  try {
    const w = iframe.contentWindow as any;
    return w?.Reveal && typeof w.Reveal.getSlides === "function" ? w.Reveal : null;
  } catch {
    return null; // cross-origin
  }
}

function revealAdapter(R: RevealApi): DeckAdapter {
  const all = (): HTMLElement[] => Array.from(R.getSlides());
  const index = () => Math.max(0, all().indexOf(R.getCurrentSlide()));
  const goto = (idx: number) => {
    const list = all();
    const el = list[Math.max(0, Math.min(idx, list.length - 1))];
    if (!el) return;
    const { h, v } = R.getIndices(el);
    R.slide(h, v ?? 0);
  };
  return {
    kind: "reveal",
    total: () => R.getTotalSlides?.() ?? all().length,
    index,
    next: () => R.next(),
    prev: () => R.prev(),
    first: () => goto(0),
    last: () => goto(all().length - 1),
    goto,
    onChange(cb) {
      const handler = () => cb(index(), all().length);
      R.on("slidechanged", handler);
      R.on("ready", handler);
      return () => {
        R.off("slidechanged", handler);
        R.off("ready", handler);
      };
    },
    slides: () =>
      all().map((el) => {
        const notesEl = el.querySelector("aside.notes");
        const heading = el.querySelector("h1, h2, h3");
        return {
          title: (heading?.textContent || "").replace(/\s+/g, " ").trim(),
          notes: (notesEl?.textContent || "").replace(/^\s+|\s+$/g, ""),
        };
      }),
    makeStatic() {
      R.configure({
        controls: false,
        progress: false,
        slideNumber: false,
        keyboard: false,
        touch: false,
        hash: false,
        history: false,
        overview: false,
        fragments: false,
        transition: "none",
        backgroundTransition: "none",
        // reveal 5 switches narrow viewports (< 435px, e.g. a phone preview
        // iframe) into scroll view, where the current index drifts. Thumbnails
        // must always render a single fixed slide. A 1px threshold (rather
        // than null) makes layout() actively deactivate an already-active
        // scroll view.
        view: null,
        scrollActivationWidth: 1,
      });
      R.layout?.();
    },
  };
}

function keyAdapter(iframe: HTMLIFrameElement, fallbackTotal: number): DeckAdapter {
  let idx = 0;
  const listeners = new Set<(i: number, t: number) => void>();
  const press = (key: string, keyCode: number) => {
    try {
      const doc = iframe.contentDocument;
      const target = doc?.activeElement || doc?.body;
      target?.dispatchEvent(new KeyboardEvent("keydown", { key, keyCode, which: keyCode, bubbles: true } as any));
      target?.dispatchEvent(new KeyboardEvent("keyup", { key, keyCode, which: keyCode, bubbles: true } as any));
    } catch {
      /* ignore */
    }
  };
  const emit = () => listeners.forEach((cb) => cb(idx, fallbackTotal));
  const step = (d: number) => {
    idx = Math.max(0, fallbackTotal ? Math.min(idx + d, fallbackTotal - 1) : idx + d);
    emit();
  };
  return {
    kind: "keys",
    total: () => fallbackTotal,
    index: () => idx,
    next: () => (press("ArrowRight", 39), step(1)),
    prev: () => (press("ArrowLeft", 37), step(-1)),
    first: () => (press("Home", 36), (idx = 0), emit()),
    last: () => (press("End", 35), (idx = Math.max(0, fallbackTotal - 1)), emit()),
    goto(target) {
      const d = target - idx;
      for (let i = 0; i < Math.abs(d); i++) d > 0 ? press("ArrowRight", 39) : press("ArrowLeft", 37);
      idx = Math.max(0, target);
      emit();
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    slides: () => [],
    makeStatic() {},
  };
}

/**
 * Resolve a controller for the deck inside `iframe` once it has loaded.
 * Waits for reveal.js to become ready; otherwise falls back to keys.
 */
export function attachDeck(
  iframe: HTMLIFrameElement,
  opts: { fallbackTotal?: number; timeoutMs?: number } = {}
): Promise<DeckAdapter> {
  const { fallbackTotal = 0, timeoutMs = 8000 } = opts;
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const R = revealOf(iframe);
      if (R && (typeof R.isReady !== "function" || R.isReady())) {
        resolve(revealAdapter(R));
        return;
      }
      if (Date.now() - started > timeoutMs) {
        resolve(keyAdapter(iframe, fallbackTotal));
        return;
      }
      setTimeout(tick, 150);
    };
    tick();
  });
}

/**
 * Run `cb` once the iframe document has loaded — including the case where
 * it finished loading before React hydrated (when `onLoad` never fires).
 * Returns a cleanup function.
 */
export function whenIframeLoaded(iframe: HTMLIFrameElement, cb: () => void): () => void {
  let done = false;
  const fire = () => {
    if (done) return;
    done = true;
    cb();
  };
  const onLoad = () => {
    done = false; // a reload of the iframe should re-attach
    fire();
  };
  iframe.addEventListener("load", onLoad);
  try {
    const doc = iframe.contentDocument;
    if (doc && doc.readyState === "complete" && doc.location.href !== "about:blank") fire();
  } catch {
    /* cross-origin */
  }
  return () => iframe.removeEventListener("load", onLoad);
}
