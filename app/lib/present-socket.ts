// Browser WebSocket client for a live presentation room (auto-reconnect).
import { useEffect, useRef, useState, useCallback } from "react";

export type PresentRole = "display" | "remote";
export type SocketStatus = "idle" | "connecting" | "open" | "closed";

export interface PresentMessage {
  t: "state" | "cmd" | "peers" | "pong";
  idx?: number;
  total?: number;
  cmd?: "next" | "prev" | "first" | "last" | "goto";
  display?: number;
  remote?: number;
}

export function usePresentSocket(opts: {
  roomId: string | null;
  roomKey: string | null;
  role: PresentRole;
  onMessage: (msg: PresentMessage) => void;
}) {
  const { roomId, roomKey, role } = opts;
  const [status, setStatus] = useState<SocketStatus>(roomId ? "connecting" : "idle");
  const [peers, setPeers] = useState({ display: 0, remote: 0 });
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(opts.onMessage);
  handlerRef.current = opts.onMessage;

  useEffect(() => {
    if (!roomId || !roomKey) return;
    let stopped = false;
    let retry = 0;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (stopped) return;
      setStatus("connecting");
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(
        `${proto}//${location.host}/present-ws/${roomId}?k=${encodeURIComponent(roomKey)}&role=${role}`
      );
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        setStatus("open");
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('{"t":"ping"}');
        }, 25_000);
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as PresentMessage;
          if (msg.t === "peers") setPeers({ display: msg.display ?? 0, remote: msg.remote ?? 0 });
          handlerRef.current(msg);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = (ev) => {
        clearInterval(pingTimer);
        wsRef.current = null;
        setStatus("closed");
        // 4000 = room expired; 1008/403-ish: stop retrying
        if (stopped || ev.code === 4000) return;
        retry = Math.min(retry + 1, 6);
        retryTimer = setTimeout(connect, 500 * 2 ** retry);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    const onVisible = () => {
      if (document.visibilityState === "visible" && !wsRef.current) {
        clearTimeout(retryTimer);
        retry = 0;
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearInterval(pingTimer);
      clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", onVisible);
      wsRef.current?.close(1000);
    };
  }, [roomId, roomKey, role]);

  const send = useCallback((msg: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  return { status, peers, send };
}
