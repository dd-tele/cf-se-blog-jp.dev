import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderSVG } from "uqr";
import { requireUser } from "~/lib/auth.server";
import { getSlideBySlug } from "~/lib/slides.server";
import { canPresentSlide, createRoom, verifyRoom } from "~/lib/present.server";
import { attachDeck, whenIframeLoaded, type DeckAdapter } from "~/lib/deck-control";
import { usePresentSocket, type PresentMessage } from "~/lib/present-socket";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? `発表中: ${data.slide.title}` : "発表" },
  { name: "robots", content: "noindex" },
  { name: "referrer", content: "no-referrer" },
];

// Presenter "display": the main screen (projector). Creates a live room and
// shows a QR code so the presenter's phone becomes the remote + speaker view.
export async function loader({ params, context, request }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const user = await requireUser(request, env);
  const slide = await getSlideBySlug(env.DB, params.slug!);
  if (!slide) throw new Response("Not Found", { status: 404 });
  if (!slide.presenterEnabled) {
    throw new Response("このスライドはプレゼンテーション機能が OFF です（スライド管理で ON にできます）", { status: 403 });
  }
  if (!canPresentSlide(user, slide)) {
    throw new Response("このスライドを発表する権限がありません", { status: 403 });
  }

  const url = new URL(request.url);
  const roomId = url.searchParams.get("r");
  const key = url.searchParams.get("k");
  const room = await verifyRoom(env.PRESENT_ROOM, roomId, key);
  if (!room || room.slideId !== slide.id) {
    // New room per presentation; keep it in the URL so a reload re-joins.
    const created = await createRoom(env.PRESENT_ROOM, slide);
    throw redirect(
      `/slides/${slide.slug}/present?r=${created.roomId}&k=${encodeURIComponent(created.key)}`
    );
  }

  const remoteUrl = `${url.origin}/slides/${slide.slug}/remote?r=${roomId}&k=${encodeURIComponent(key!)}`;
  return {
    slide: { id: slide.id, slug: slide.slug, title: slide.title, slideCount: slide.slideCount },
    roomId: roomId!,
    roomKey: key!,
    remoteUrl,
    expiresAt: room.expiresAt,
  };
}

export default function PresentDisplay() {
  const { slide, roomId, roomKey, remoteUrl } = useLoaderData<typeof loader>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const deckRef = useRef<DeckAdapter | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState({ idx: 0, total: slide.slideCount });

  const qrSvg = useMemo(
    () => renderSVG(remoteUrl, { border: 2, pixelSize: 6, whiteColor: "#ffffff", blackColor: "#111111" }),
    [remoteUrl]
  );

  const onMessage = useCallback((msg: PresentMessage) => {
    const deck = deckRef.current;
    if (!deck || msg.t !== "cmd") return;
    switch (msg.cmd) {
      case "next": deck.next(); break;
      case "prev": deck.prev(); break;
      case "first": deck.first(); break;
      case "last": deck.last(); break;
      case "goto": if (typeof msg.idx === "number") deck.goto(msg.idx); break;
    }
  }, []);

  const { status, peers, send } = usePresentSocket({ roomId, roomKey, role: "display", onMessage });

  const reportState = useCallback(() => {
    const deck = deckRef.current;
    if (!deck) return;
    const next = { idx: deck.index(), total: deck.total() || slide.slideCount };
    setPos(next);
    send({ t: "state", ...next });
  }, [send, slide.slideCount]);

  // (Re)announce position whenever the socket (re)opens.
  useEffect(() => {
    if (status === "open") reportState();
  }, [status, reportState]);

  // Collapse the pairing panel once a phone has joined.
  useEffect(() => {
    if (peers.remote > 0) setPanelOpen(false);
  }, [peers.remote]);

  const onDeckLoad = useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const deck = await attachDeck(iframe, { fallbackTotal: slide.slideCount });
    deckRef.current = deck;
    deck.onChange(() => reportState());
    reportState();
    try {
      iframe.contentWindow?.focus();
      // "Q" toggles the pairing panel even while the deck has focus.
      iframe.contentWindow?.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "q" || e.key === "Q") setPanelOpen((v) => !v);
      });
    } catch {
      /* ignore */
    }
  }, [reportState, slide.slideCount]);

  useEffect(() => {
    const iframe = iframeRef.current;
    return iframe ? whenIframeLoaded(iframe, onDeckLoad) : undefined;
  }, [onDeckLoad]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "q" || e.key === "Q") setPanelOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const goFullscreen = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    iframeRef.current?.contentWindow?.focus();
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(remoteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const connected = status === "open";

  return (
    <div className="fixed inset-0 bg-black">
      <iframe
        ref={iframeRef}
        src={`/slides/${slide.slug}/a/`}
        title={slide.title}
        className="absolute inset-0 h-full w-full border-0"
        allow="fullscreen"
        referrerPolicy="no-referrer"
      />

      {panelOpen ? (
        <div className="absolute bottom-4 right-4 z-10 w-[300px] rounded-2xl bg-white/95 p-4 text-gray-900 shadow-2xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold">スマホをリモコンにする</p>
            <button
              onClick={() => setPanelOpen(false)}
              className="rounded px-2 text-xs text-gray-500 hover:bg-gray-100"
              aria-label="閉じる"
            >
              閉じる
            </button>
          </div>
          <div
            className="mx-auto w-[200px] overflow-hidden rounded-lg [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="mt-2 text-xs leading-relaxed text-gray-600">
            カメラで読み取ると、スピーカーノートとページ送りが使えます。ログインは不要です。
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-400"}`} />
            <span className="text-gray-600">
              {connected ? `接続中 · リモコン ${peers.remote} 台` : "接続しています…"}
            </span>
            <span className="ml-auto font-mono text-gray-400">
              {pos.idx + 1} / {pos.total || "?"}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={goFullscreen}
              className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
            >
              全画面表示
            </button>
            <button
              onClick={copyUrl}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              {copied ? "コピーしました" : "URL をコピー"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-gray-400">Q キーでこのパネルを表示 / 非表示</p>
        </div>
      ) : (
        <button
          onClick={() => setPanelOpen(true)}
          className="absolute bottom-3 right-3 z-10 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-[11px] text-white/70 opacity-40 transition hover:opacity-100"
          title="リモコン接続パネル (Q)"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`} />
          {peers.remote > 0 ? `リモコン ${peers.remote}` : "QR"}
        </button>
      )}
    </div>
  );
}
