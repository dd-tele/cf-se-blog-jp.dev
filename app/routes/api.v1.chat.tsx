import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { getSessionUser } from "~/lib/auth.server";
import { getPostBySlug, getPostById } from "~/lib/posts.server";
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

// GET: Fetch existing thread messages for a post
export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const postId = url.searchParams.get("postId");
  if (!postId) return json({ error: "postId required" }, { status: 400 });

  const db = context.cloudflare.env.DB;

  try {
    const threadId = await getOrCreateThread(db, postId);
    const messages = await getThreadMessages(db, threadId);
    // Filter out flagged messages for public view
    const publicMessages = messages.filter((m) => !m.flagged);
    return json({ threadId, messages: publicMessages });
  } catch (e: any) {
    return json({ error: e.message }, { status: 500 });
  }
}

// POST: Send a message and get AI streaming response
export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = context.cloudflare.env;
  const db = env.DB;
  const ai = env.AI;
  const kv = env.PAGE_CACHE; // reuse for rate limiting
  const vectorize = env.VECTORIZE;

  // Parse request body
  let body: { postId: string; message: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { postId, message } = body;
  if (!postId || !message) {
    return json({ error: "postId and message are required" }, { status: 400 });
  }

  // 1. Input validation
  const validation = validateMessage(message);
  if (!validation.ok) {
    return json({ error: validation.error }, { status: 400 });
  }

  // 2. Rate limiting
  const ip = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
  const rateCheck = await checkRateLimit(kv, ip);
  if (!rateCheck.allowed) {
    return json(
      { error: "メッセージの送信回数が制限に達しました。1分後に再度お試しください。" },
      { status: 429 }
    );
  }

  // 3. Content moderation
  const moderation = await moderateContent(ai, message);
  if (!moderation.safe) {
    // Save flagged message to DB
    const threadId = await getOrCreateThread(db, postId);
    const user = await getSessionUser(request);
    await saveMessage(db, threadId, {
      role: "user",
      content: message,
      userId: user?.id,
      flagged: true,
      metadata: { flagReason: moderation.reason },
    });
    writeAuditLog(db, { userId: user?.id, action: "chat.flagged", resourceType: "message", resourceId: postId, details: { reason: moderation.reason }, ip }).catch(() => {});
    return json(
      { error: "このメッセージは利用規約に反する可能性があるため送信できません。" },
      { status: 400 }
    );
  }

  // 4. Get post details
  const post = await getPostById(db, postId);
  if (!post) {
    return json({ error: "記事が見つかりません" }, { status: 404 });
  }

  // 5. Get or create thread & save user message
  const threadId = await getOrCreateThread(db, postId);
  const user = await getSessionUser(request);
  await saveMessage(db, threadId, {
    role: "user",
    content: message,
    userId: user?.id,
  });

  // 6. Get conversation history for context
  const history = await getThreadMessages(db, threadId, 20);
  const aiHistory = history
    .filter((m) => !m.flagged && (m.role === "user" || m.role === "ai"))
    .map((m) => ({
      role: (m.role === "ai" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    }));

  // 7. RAG context retrieval
  const ragContext = await getRAGContext(ai, vectorize, post.content, message);

  // 8. Build system prompt
  const systemPrompt = buildChatSystemPrompt(post.title, ragContext);

  // 9. Generate streaming response
  try {
    const aiStream = await generateChatResponseStream(
      ai,
      systemPrompt,
      aiHistory,
      message
    );

    // We need to tee the stream: one for the client, one for saving to DB
    const [clientStream, dbStream] = aiStream.tee();

    // Fire-and-forget: collect full response and save to DB
    collectAndSave(dbStream, db, threadId).catch((e) =>
      console.error("Failed to save AI response:", e)
    );

    // Return SSE stream to client
    return new Response(clientStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e: any) {
    console.error("Chat AI error:", e);
    return json(
      { error: "回答の生成中にエラーが発生しました。しばらくしてから再度お試しください。" },
      { status: 500 }
    );
  }
}

// Collect streamed chunks and save the full AI response to D1
async function collectAndSave(
  stream: ReadableStream,
  db: D1Database,
  threadId: string
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let fullResponse = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      // Parse SSE data lines to extract content
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.response) {
              fullResponse += parsed.response;
            }
          } catch {
            // Not JSON, might be raw text
            fullResponse += data;
          }
        }
      }
    }
  } catch {
    // Stream may have errored
  }

  if (fullResponse.trim()) {
    await saveMessage(db, threadId, {
      role: "ai",
      content: fullResponse,
      metadata: { model: "@cf/meta/llama-3.1-8b-instruct" },
    });
  }
}
