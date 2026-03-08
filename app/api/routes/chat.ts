import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { HonoEnv } from "../types";
import { optionalAuth } from "../middleware";
import { getPostById } from "~/lib/posts.server";
import {
  validateMessage,
  checkRateLimit,
  moderateContent,
  getOrCreateThread,
  saveMessage,
  getThreadMessages,
  getRAGContext,
  buildChatSystemPrompt,
  generateChatResponseStream,
} from "~/lib/chat.server";
import { writeAuditLog } from "~/lib/audit.server";
import { verifyTurnstileToken } from "~/lib/turnstile.server";

const chat = new Hono<HonoEnv>();

// GET /api/v1/chat — Fetch existing thread messages
chat.get("/", optionalAuth, async (c) => {
  const postId = c.req.query("postId");
  if (!postId) return c.json({ error: "postId required" }, 400);

  const db = c.env.DB;
  try {
    const threadId = await getOrCreateThread(db, postId);
    const messages = await getThreadMessages(db, threadId);
    const publicMessages = messages.filter((m) => !m.flagged);
    return c.json({ threadId, messages: publicMessages });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /api/v1/chat — Send message & stream AI response
chat.post("/", optionalAuth, async (c) => {
  const env = c.env;
  const db = env.DB;
  const ai = env.AI;
  const kv = env.PAGE_CACHE;
  const vectorize = env.VECTORIZE;

  // Parse body
  let body: { postId: string; message: string; turnstileToken?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const { postId, message, turnstileToken } = body;
  if (!postId || !message) {
    return c.json({ error: "postId and message are required" }, 400);
  }

  const ip = c.req.header("CF-Connecting-IP") || "127.0.0.1";

  // 0. Turnstile verification (bot protection)
  const secretKey = env.TURNSTILE_SECRET_KEY;
  if (secretKey) {
    const turnstile = await verifyTurnstileToken(secretKey, turnstileToken || "", ip);
    if (!turnstile.ok) {
      return c.json({ error: turnstile.error || "Turnstile 検証に失敗しました" }, 403);
    }
  }

  // 1. Input validation
  const validation = validateMessage(message);
  if (!validation.ok) {
    return c.json({ error: validation.error }, 400);
  }

  // 2. Rate limiting
  const rateCheck = await checkRateLimit(kv, ip);
  if (!rateCheck.allowed) {
    return c.json(
      { error: "メッセージの送信回数が制限に達しました。1分後に再度お試しください。" },
      429
    );
  }

  // 3. Content moderation (via AI Gateway if configured)
  const gatewayId = env.AI_GATEWAY_ID;
  const moderation = await moderateContent(ai, message, gatewayId);
  if (!moderation.safe) {
    const threadId = await getOrCreateThread(db, postId);
    const user = c.get("user");
    await saveMessage(db, threadId, {
      role: "user",
      content: message,
      userId: user?.id,
      flagged: true,
      metadata: { flagReason: moderation.reason },
    });
    writeAuditLog(db, {
      userId: user?.id,
      action: "chat.flagged",
      resourceType: "message",
      resourceId: postId,
      details: { reason: moderation.reason },
      ip,
    }).catch(() => {});
    return c.json(
      { error: "このメッセージは利用規約に反する可能性があるため送信できません。" },
      400
    );
  }

  // 4. Get post
  const post = await getPostById(db, postId);
  if (!post) {
    return c.json({ error: "記事が見つかりません" }, 404);
  }

  // 5. Save user message
  const threadId = await getOrCreateThread(db, postId);
  const user = c.get("user");
  await saveMessage(db, threadId, {
    role: "user",
    content: message,
    userId: user?.id,
  });

  // 6. Conversation history
  const history = await getThreadMessages(db, threadId, 20);
  const aiHistory = history
    .filter((m) => !m.flagged && (m.role === "user" || m.role === "ai"))
    .map((m) => ({
      role: (m.role === "ai" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    }));

  // 7. RAG context
  const ragContext = await getRAGContext(ai, vectorize, post.content, message);

  // 8. System prompt
  const systemPrompt = buildChatSystemPrompt(post.title, ragContext);

  // 9. Stream AI response via Hono SSE helper
  try {
    const aiStream = await generateChatResponseStream(
      ai,
      systemPrompt,
      aiHistory,
      message,
      gatewayId
    );

    return streamSSE(c, async (stream) => {
      const reader = (aiStream as ReadableStream).getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let lineBuf = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value as ArrayBuffer, { stream: true });
          lineBuf += chunk;
          const parts = lineBuf.split("\n");
          lineBuf = parts.pop() || "";

          for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const payload = trimmed.slice(6);
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.response) {
                fullResponse += parsed.response;
                await stream.writeSSE({
                  data: JSON.stringify({ text: parsed.response }),
                });
              }
            } catch {
              // Incomplete JSON — skip
            }
          }
        }

        await stream.writeSSE({ data: "[DONE]" });
      } catch (e) {
        console.error("Stream transform error:", e);
      }

      // Save AI response to DB
      if (fullResponse.trim()) {
        saveMessage(db, threadId, {
          role: "ai",
          content: fullResponse,
          metadata: { model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
        }).catch((e) => console.error("Failed to save AI response:", e));
      }
    });
  } catch (e: any) {
    console.error("Chat AI error:", e);
    return c.json(
      { error: "回答の生成中にエラーが発生しました。しばらくしてから再度お試しください。" },
      500
    );
  }
});

export default chat;
