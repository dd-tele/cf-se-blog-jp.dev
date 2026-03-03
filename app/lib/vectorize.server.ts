import { generateEmbedding } from "~/lib/ai.server";

// ─── Index a post into Vectorize ────────────────────────────
export async function indexPost(
  ai: any,
  vectorize: VectorizeIndex,
  post: {
    id: string;
    title: string;
    content: string;
    categoryName?: string;
    tags?: string[];
  }
): Promise<boolean> {
  try {
    // Build text for embedding: title + category + tags + content excerpt
    const parts = [post.title];
    if (post.categoryName) parts.push(post.categoryName);
    if (post.tags?.length) parts.push(post.tags.join(", "));
    parts.push(post.content.replace(/<[^>]+>/g, "").slice(0, 3000));
    const text = parts.join("\n");

    const embedding = await generateEmbedding(ai, text);
    if (!embedding) return false;

    await vectorize.upsert([
      {
        id: post.id,
        values: embedding,
        metadata: {
          title: post.title,
          category: post.categoryName ?? "",
          tags: post.tags?.join(",") ?? "",
        },
      },
    ]);
    return true;
  } catch (e) {
    console.error("Vectorize indexing failed:", e);
    return false;
  }
}

// ─── Delete a post from Vectorize ───────────────────────────
export async function deletePostIndex(
  vectorize: VectorizeIndex,
  postId: string
): Promise<void> {
  try {
    await vectorize.deleteByIds([postId]);
  } catch (e) {
    console.error("Vectorize delete failed:", e);
  }
}

// ─── Semantic search ────────────────────────────────────────
export async function semanticSearch(
  ai: any,
  vectorize: VectorizeIndex,
  query: string,
  topK = 10
): Promise<{ id: string; score: number; title: string; category: string }[]> {
  try {
    const embedding = await generateEmbedding(ai, query);
    if (!embedding) return [];

    const results = await vectorize.query(embedding, {
      topK,
      returnMetadata: "all",
    });

    return results.matches.map((m) => ({
      id: m.id,
      score: m.score,
      title: (m.metadata?.title as string) ?? "",
      category: (m.metadata?.category as string) ?? "",
    }));
  } catch (e) {
    console.error("Semantic search failed:", e);
    return [];
  }
}

// ─── Find related posts ─────────────────────────────────────
export async function findRelatedPosts(
  ai: any,
  vectorize: VectorizeIndex,
  postId: string,
  title: string,
  content: string,
  topK = 5
): Promise<{ id: string; score: number; title: string }[]> {
  try {
    const text = `${title}\n${content.replace(/<[^>]+>/g, "").slice(0, 2000)}`;
    const embedding = await generateEmbedding(ai, text);
    if (!embedding) return [];

    const results = await vectorize.query(embedding, {
      topK: topK + 1, // +1 because the post itself may be in results
      returnMetadata: "all",
    });

    return results.matches
      .filter((m) => m.id !== postId)
      .slice(0, topK)
      .map((m) => ({
        id: m.id,
        score: m.score,
        title: (m.metadata?.title as string) ?? "",
      }));
  } catch (e) {
    console.error("Related posts search failed:", e);
    return [];
  }
}
