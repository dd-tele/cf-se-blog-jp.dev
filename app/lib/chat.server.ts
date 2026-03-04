import { eq, desc, and, sql } from "drizzle-orm";
import { getDb } from "~/lib/db.server";
import { qaThreads, qaMessages, posts } from "~/db/schema";
import { ulid } from "~/lib/ulid";
import { generateEmbedding } from "~/lib/ai.server";

// ─── Constants ──────────────────────────────────────────────
const TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MODERATION_MODEL = "@cf/meta/llama-guard-3-8b";
const MAX_MESSAGE_LENGTH = 1000;
const MAX_MESSAGES_PER_MINUTE = 10;

// ─── Types ──────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: "user" | "ai" | "se" | "admin" | "system";
  content: string;
  flagged: boolean;
  createdAt: string;
}

// ─── Spam detection ─────────────────────────────────────────
const SPAM_PATTERNS = [
  /(.)\1{10,}/, // extreme character repetition
  /buy|cheap|discount|casino|viagra/i,
];

function containsSpam(content: string): boolean {
  return SPAM_PATTERNS.filter((p) => p.test(content)).length >= 2;
}

// ─── Input validation ───────────────────────────────────────
export function validateMessage(content: string): { ok: boolean; error?: string } {
  if (!content || !content.trim()) {
    return { ok: false, error: "メッセージが空です" };
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `メッセージは${MAX_MESSAGE_LENGTH}文字以内にしてください` };
  }
  if (containsSpam(content)) {
    return { ok: false, error: "スパムと判定されました" };
  }
  return { ok: true };
}

// ─── Rate limiting (KV-based) ───────────────────────────────
export async function checkRateLimit(
  kv: KVNamespace,
  ip: string
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `chat-rate:${ip}`;
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) : 0;

  if (count >= MAX_MESSAGES_PER_MINUTE) {
    return { allowed: false, remaining: 0 };
  }

  await kv.put(key, String(count + 1), { expirationTtl: 60 });
  return { allowed: true, remaining: MAX_MESSAGES_PER_MINUTE - count - 1 };
}

// ─── Content moderation (Llama Guard) ───────────────────────
export async function moderateContent(
  ai: any,
  content: string
): Promise<{ safe: boolean; reason?: string }> {
  try {
    const result: any = await ai.run(
      MODERATION_MODEL as any,
      {
        messages: [{ role: "user", content }],
      },
    );

    const output = (result.response || "").trim().toLowerCase();
    if (output.includes("unsafe")) {
      return { safe: false, reason: `Llama Guard: ${output.slice(0, 200)}` };
    }
    return { safe: true };
  } catch (e) {
    // Fail open on moderation error (prefer false negatives)
    console.error("Moderation error:", e);
    return { safe: true };
  }
}

// ─── Thread management ──────────────────────────────────────
export async function getOrCreateThread(
  db: D1Database,
  postId: string
): Promise<string> {
  const d = getDb(db);

  // Find existing active thread for this post
  const existing = await d
    .select({ id: qaThreads.id })
    .from(qaThreads)
    .where(and(eq(qaThreads.post_id, postId), eq(qaThreads.status, "active")))
    .get();

  if (existing) return existing.id;

  // Create new thread
  const threadId = ulid();
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  await d.insert(qaThreads).values({
    id: threadId,
    post_id: postId,
    status: "active",
    message_count: 0,
    created_at: now,
    updated_at: now,
  });
  return threadId;
}

// ─── Message persistence ────────────────────────────────────
export async function saveMessage(
  db: D1Database,
  threadId: string,
  msg: {
    role: "user" | "ai" | "se" | "admin" | "system";
    content: string;
    userId?: string;
    flagged?: boolean;
    metadata?: Record<string, unknown>;
  }
): Promise<string> {
  const d = getDb(db);
  const id = ulid();
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  await d.insert(qaMessages).values({
    id,
    thread_id: threadId,
    role: msg.role,
    content: msg.content,
    user_id: msg.userId ?? null,
    flagged: msg.flagged ?? false,
    metadata_json: msg.metadata ? JSON.stringify(msg.metadata) : null,
    created_at: now,
  });

  // Update thread message count
  await db.prepare(
    "UPDATE qa_threads SET message_count = message_count + 1, updated_at = ? WHERE id = ?"
  ).bind(now, threadId).run();

  return id;
}

// ─── Get thread messages ────────────────────────────────────
export async function getThreadMessages(
  db: D1Database,
  threadId: string,
  limit = 50
): Promise<ChatMessage[]> {
  const d = getDb(db);
  const msgs = await d
    .select({
      id: qaMessages.id,
      role: qaMessages.role,
      content: qaMessages.content,
      flagged: qaMessages.flagged,
      createdAt: qaMessages.created_at,
    })
    .from(qaMessages)
    .where(eq(qaMessages.thread_id, threadId))
    .orderBy(qaMessages.created_at)
    .limit(limit);

  return msgs.map((m) => ({
    id: m.id,
    role: m.role as ChatMessage["role"],
    content: m.content,
    flagged: m.flagged,
    createdAt: m.createdAt,
  }));
}

// ─── RAG context retrieval ──────────────────────────────────
export async function getRAGContext(
  ai: any,
  vectorize: VectorizeIndex | undefined,
  postContent: string,
  query: string
): Promise<string> {
  // Always include the current post content as primary context
  const postExcerpt = postContent.replace(/<[^>]+>/g, "").slice(0, 8000);

  // If Vectorize is available, also search for related content
  let vectorContext = "";
  if (vectorize) {
    try {
      const embedding = await generateEmbedding(ai, query);
      if (embedding) {
        const results = await vectorize.query(embedding, {
          topK: 3,
          returnMetadata: "all",
        });
        vectorContext = results.matches
          .map(
            (m) =>
              `[関連記事: ${m.metadata?.title ?? ""}]\n関連度: ${Math.round(m.score * 100)}%`
          )
          .join("\n\n");
      }
    } catch {
      /* Vectorize not available locally */
    }
  }

  return `--- 記事本文 ---\n${postExcerpt}\n\n${vectorContext ? `--- 関連情報 ---\n${vectorContext}` : ""}`;
}

// ─── Build AI system prompt ─────────────────────────────────
export function buildChatSystemPrompt(postTitle: string, context: string): string {
  return `あなたは Cloudflare Solution Blog の記事「${postTitle}」専属の Q&A アシスタントです。

## 絶対ルール（必ず守ること）
1. 回答の根拠は「記事コンテキスト」の文章のみです。一般的な技術知識や外部情報で回答を補完・拡張しないでください。
2. 回答には必ず記事から該当箇所を引用または要約してください。「記事では〜と述べています」「記事によると〜」のように出典を明示してください。
3. 記事に具体的な記述がない場合は、正直に「この記事では具体的な詳細は述べられていません」と回答してください。推測で一般知識を列挙しないでください。
4. 記事の文脈から合理的に推測できる場合のみ「記事の文脈から推測すると」と明示した上で、簡潔に推測を述べてください。
5. 記事と無関係な質問には「この記事の範囲外です」と回答してください。

## 禁止事項
- 「一般的に〜」「通常〜」「〜が想定できます」のような一般論の列挙
- 記事に書かれていない技術的詳細の創作
- 番号付きリストで一般知識を並べること

## 回答スタイル
- 日本語で丁寧かつ簡潔に回答（最大 600 文字）
- 記事の内容を正確に反映
- 必要に応じて記事中のコード例や設定例を引用

## 記事コンテキスト（この内容のみを根拠に回答すること）
${context}`;
}

// ─── Generate AI chat response (streaming) ──────────────────
export async function generateChatResponseStream(
  ai: any,
  systemPrompt: string,
  history: { role: "user" | "assistant"; content: string }[],
  userMessage: string
): Promise<ReadableStream> {
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.slice(-10), // last 5 exchanges
    { role: "user" as const, content: userMessage },
  ];

  const stream: any = await ai.run(
    TEXT_MODEL as any,
    {
      messages,
      max_tokens: 1024,
      temperature: 0.3,
      stream: true,
    },
  );

  return stream as ReadableStream;
}

// ─── Admin: list threads ────────────────────────────────────
export async function listThreads(
  db: D1Database,
  opts: { status?: string; limit?: number; offset?: number } = {}
) {
  const { status, limit = 20, offset = 0 } = opts;
  const d = getDb(db);

  let query = d
    .select({
      id: qaThreads.id,
      postId: qaThreads.post_id,
      postTitle: posts.title,
      postSlug: posts.slug,
      status: qaThreads.status,
      messageCount: qaThreads.message_count,
      createdAt: qaThreads.created_at,
      updatedAt: qaThreads.updated_at,
    })
    .from(qaThreads)
    .leftJoin(posts, eq(qaThreads.post_id, posts.id))
    .orderBy(desc(qaThreads.updated_at))
    .limit(limit)
    .offset(offset);

  if (status && status !== "all") {
    return query.where(eq(qaThreads.status, status as any));
  }
  return query;
}

// ─── Admin: get flagged messages ────────────────────────────
export async function getFlaggedMessages(db: D1Database, limit = 50) {
  const d = getDb(db);
  return d
    .select({
      id: qaMessages.id,
      threadId: qaMessages.thread_id,
      role: qaMessages.role,
      content: qaMessages.content,
      createdAt: qaMessages.created_at,
      metadataJson: qaMessages.metadata_json,
    })
    .from(qaMessages)
    .where(eq(qaMessages.flagged, true))
    .orderBy(desc(qaMessages.created_at))
    .limit(limit);
}

// ─── Admin: update thread status ────────────────────────────
export async function updateThreadStatus(
  db: D1Database,
  threadId: string,
  status: "active" | "resolved" | "flagged"
) {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  await db
    .prepare("UPDATE qa_threads SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, now, threadId)
    .run();
}
