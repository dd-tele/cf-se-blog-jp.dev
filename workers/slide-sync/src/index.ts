/**
 * cf-se-blog-slide-sync
 *
 * One Durable Object instance per live presentation ("room"). It relays
 * messages between:
 *   - display : the main screen that renders the deck (projector / big screen)
 *   - remote  : phones / tablets showing speaker notes and sending page turns
 *
 * Protocol (JSON text frames):
 *   remote|display → room : { t: "cmd", cmd: "next" | "prev" | "first" | "last" | "goto", idx?: number }
 *   display        → room : { t: "state", idx: number, total: number }
 *   any            → room : { t: "ping" }
 *   room → client         : { t: "state", idx, total } | { t: "cmd", ... } | { t: "peers", display, remote } | { t: "pong" }
 *
 * Access control: the Pages app creates a room with a random 256-bit key and
 * stores only its SHA-256 hash here. Every WebSocket must present the key.
 * Rooms expire automatically via an alarm.
 *
 * Uses the WebSocket Hibernation API so idle rooms cost nothing while a talk
 * is paused.
 */
import { DurableObject } from "cloudflare:workers";

type Role = "display" | "remote";

interface RoomMeta {
  slideId: string;
  slug: string;
  keyHash: string;
  expiresAt: number; // epoch ms
}

interface DeckState {
  idx: number;
  total: number;
}

const MAX_SOCKETS = 24;
const MAX_FRAME_BYTES = 2048;
const COMMANDS = new Set(["next", "prev", "first", "last", "goto"]);

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison for equal-length hex digests. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export class PresentRoom extends DurableObject {
  private async meta(): Promise<RoomMeta | undefined> {
    return this.ctx.storage.get<RoomMeta>("meta");
  }

  private async checkKey(key: string | null): Promise<RoomMeta | null> {
    const meta = await this.meta();
    if (!meta || !key) return null;
    if (Date.now() > meta.expiresAt) return null;
    return safeEqual(await sha256Hex(key), meta.keyHash) ? meta : null;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // ── Internal control plane (called only by the Pages app via binding) ──
    if (url.pathname === "/init" && request.method === "POST") {
      const body = (await request.json()) as RoomMeta;
      if (!body?.slideId || !body?.keyHash || !body?.expiresAt) {
        return Response.json({ ok: false }, { status: 400 });
      }
      await this.ctx.storage.put("meta", body);
      await this.ctx.storage.setAlarm(body.expiresAt);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/verify" && request.method === "POST") {
      const { key } = (await request.json()) as { key?: string };
      const meta = await this.checkKey(key ?? null);
      return Response.json(
        meta
          ? { ok: true, slideId: meta.slideId, slug: meta.slug, expiresAt: meta.expiresAt }
          : { ok: false }
      );
    }

    // ── WebSocket join ──
    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }
      const meta = await this.checkKey(url.searchParams.get("k"));
      if (!meta) return new Response("Forbidden", { status: 403 });

      const role: Role = url.searchParams.get("role") === "display" ? "display" : "remote";
      if (this.ctx.getWebSockets().length >= MAX_SOCKETS) {
        return new Response("Room is full", { status: 429 });
      }

      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      this.ctx.acceptWebSocket(server, [role]);

      const state = await this.ctx.storage.get<DeckState>("state");
      if (state) server.send(JSON.stringify({ t: "state", ...state }));
      this.broadcastPeers();

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string" || message.length > MAX_FRAME_BYTES) return;
    let msg: any;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }
    const role = (this.ctx.getTags(ws)[0] as Role) ?? "remote";

    switch (msg?.t) {
      case "ping":
        ws.send(JSON.stringify({ t: "pong" }));
        return;

      case "cmd": {
        if (!COMMANDS.has(msg.cmd)) return;
        const out: Record<string, unknown> = { t: "cmd", cmd: msg.cmd };
        if (msg.cmd === "goto") {
          const idx = Number(msg.idx);
          if (!Number.isInteger(idx) || idx < 0 || idx > 10_000) return;
          out.idx = idx;
        }
        // Commands are executed by the display(s).
        this.send("display", JSON.stringify(out), ws);
        return;
      }

      case "state": {
        // Only a display reports authoritative deck position.
        if (role !== "display") return;
        const idx = Number(msg.idx);
        const total = Number(msg.total);
        if (!Number.isInteger(idx) || !Number.isInteger(total) || idx < 0 || total < 0) return;
        const state: DeckState = { idx, total };
        await this.ctx.storage.put("state", state);
        const frame = JSON.stringify({ t: "state", ...state });
        this.send("remote", frame);
        this.send("display", frame, ws); // keep mirrored displays in sync
        return;
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 ? 1000 : code, "closing");
    } catch {
      /* already closed */
    }
    this.broadcastPeers();
  }

  async webSocketError(): Promise<void> {
    this.broadcastPeers();
  }

  /** Room expired: disconnect everyone and wipe storage. */
  async alarm(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(4000, "room expired");
      } catch {
        /* ignore */
      }
    }
    await this.ctx.storage.deleteAll();
  }

  private send(role: Role, frame: string, except?: WebSocket) {
    for (const ws of this.ctx.getWebSockets(role)) {
      if (ws === except) continue;
      try {
        ws.send(frame);
      } catch {
        /* socket closing */
      }
    }
  }

  private broadcastPeers() {
    const open = (r: Role) =>
      this.ctx.getWebSockets(r).filter((w) => w.readyState === WebSocket.OPEN).length;
    const frame = JSON.stringify({ t: "peers", display: open("display"), remote: open("remote") });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(frame);
      } catch {
        /* ignore */
      }
    }
  }
}

export default {
  async fetch(): Promise<Response> {
    // No public surface: rooms are reached only through the Pages binding.
    return new Response("Not found", { status: 404 });
  },
};
