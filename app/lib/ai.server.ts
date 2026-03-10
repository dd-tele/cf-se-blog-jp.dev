import { getDb } from "~/lib/db.server";
import { aiSummaries } from "~/db/schema";
import { ulid } from "~/lib/ulid";

// ─── AI Gateway helper ─────────────────────────────────────
// AI Gateway is not currently configured; pass empty options.
function gwOpts(): Record<string, unknown> {
  return {};
}

// ─── Text model helper ─────────────────────────────────────
const TEXT_MODEL = "@cf/meta/llama-3.1-70b-instruct" as const;
const EMBED_MODEL = "@cf/baai/bge-base-en-v1.5" as const;

const SUMMARY_SYSTEM_PROMPT = `あなたは Cloudflare の技術ブログを分析する AI アシスタントです。
与えられた記事を分析し、以下の JSON 形式で結果を返してください。

{
  "abstract": "記事の要約（3-5文、日本語）",
  "key_points": [
    "重要ポイント1",
    "重要ポイント2",
    "重要ポイント3"
  ]
}

注意事項:
- Cloudflare のサービス名は正確に記載してください
- 技術的な正確性を最優先してください
- 日本語で回答してください
- JSON 以外のテキストは出力しないでください`;

export async function generatePostSummary(
  ai: any,
  db: D1Database,
  postId: string,
  title: string,
  content: string,
  categoryName?: string
): Promise<{ summary: string; keyPoints: string[] } | null> {
  try {
    const userContent = `以下のブログ記事を分析してください。\n\nタイトル: ${title}${categoryName ? `\nカテゴリ: ${categoryName}` : ""}\n\n${content.slice(0, 6000)}`;

    const result: any = await ai.run(
      TEXT_MODEL as any,
      {
        messages: [
          { role: "system", content: SUMMARY_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      },
      gwOpts() as any
    );

    const responseText = result.response || result.result?.response || "";
    if (!responseText) return null;

    // Try to parse JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    const summary = parsed.abstract || "";
    const keyPoints: string[] = parsed.key_points || [];

    if (!summary) return null;

    // Save to D1
    const d = getDb(db);
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    await d.insert(aiSummaries).values({
      id: ulid(),
      post_id: postId,
      summary,
      key_points_json: JSON.stringify(keyPoints),
      model_used: TEXT_MODEL,
      created_at: now,
    });

    return { summary, keyPoints };
  } catch (e) {
    console.error("AI summary generation failed:", e);
    return null;
  }
}

const TAG_SUGGEST_PROMPT = `あなたは Cloudflare 技術ブログのタグ推薦 AI です。
記事の内容を分析し、適切なタグを 3〜6 個提案してください。
JSON 配列形式で返してください。例: ["workers", "d1", "セキュリティ"]
日本語または英語のタグを返してください。JSON 配列以外のテキストは出力しないでください。`;

export async function suggestTags(
  ai: any,
  content: string
): Promise<string[]> {
  try {
    const result: any = await ai.run(
      TEXT_MODEL as any,
      {
        messages: [
          { role: "system", content: TAG_SUGGEST_PROMPT },
          { role: "user", content: content.slice(0, 4000) },
        ],
        max_tokens: 256,
        temperature: 0.3,
      },
      gwOpts() as any
    );

    const responseText = result.response || result.result?.response || "";
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}

const IMPROVE_PROMPT = `あなたは技術文章の編集者です。与えられたテキストを以下の観点で改善してください:
- 技術的な正確性
- 読みやすさ（短い文、明確な構造）
- 専門用語の適切な使用

改善したテキストのみを返してください。説明は不要です。`;

export async function improveText(
  ai: any,
  text: string
): Promise<string> {
  try {
    const result: any = await ai.run(
      TEXT_MODEL as any,
      {
        messages: [
          { role: "system", content: IMPROVE_PROMPT },
          { role: "user", content: text },
        ],
        max_tokens: 2048,
        temperature: 0.5,
      },
      gwOpts() as any
    );
    return result.response || result.result?.response || text;
  } catch {
    return text;
  }
}

// ─── Refine with additional essence ─────────────────────────
const REFINE_PROMPT = `あなたは Cloudflare 技術ブログの編集 AI アシスタントです。
ユーザーが執筆中の記事本文と、追加で取り込みたい「エッセンス」（補足情報・修正指示・気づき）が与えられます。

あなたの仕事:
1. 追加エッセンスに含まれる指示・要望・補足情報を **すべて漏れなく** 記事本文に反映する（部分的な取り込みは不可）
2. 各エッセンス項目について、新しいセクション追加・既存セクションへの追記・図表の挿入など、最も適切な方法で組み込む
3. 「〜を追記して」「〜の図を入れて」「〜について触れて」等の具体的指示には必ず従う
4. Mermaid 図の指示があれば \`\`\`mermaid コードブロックで正しい Mermaid 構文を生成する
5. 元の文章のトーン・構造・Markdown 書式を維持する
6. 技術的正確性を保つ
7. 不要な冗長表現を避ける

改善した記事本文のみを返してください。説明やメタコメントは不要です。`;

export async function refineWithEssence(
  ai: any,
  content: string,
  essence: string,
  title?: string
): Promise<string> {
  try {
    const userMessage = [
      title ? `## 記事タイトル\n${title}\n` : "",
      `## 現在の記事本文\n${content.slice(0, 12000)}\n`,
      `## 追加エッセンス（取り込みたい内容）\n${essence}`,
    ].join("\n");

    const result: any = await ai.run(
      TEXT_MODEL as any,
      {
        messages: [
          { role: "system", content: REFINE_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 4096,
        temperature: 0.3,
      },
      gwOpts() as any
    );
    const response = result.response || result.result?.response || "";
    return response || content;
  } catch (e) {
    console.error("AI refine with essence failed:", e);
    return content;
  }
}

// ─── Embedding generation ───────────────────────────────────
export async function generateEmbedding(
  ai: any,
  text: string
): Promise<number[] | null> {
  try {
    const result: any = await ai.run(
      EMBED_MODEL as any,
      { text: [text.slice(0, 4000)] },
      gwOpts() as any
    );
    const vectors = result?.data?.[0];
    return vectors ?? null;
  } catch (e) {
    console.error("Embedding generation failed:", e);
    return null;
  }
}

// ─── Trend report generation ────────────────────────────────
const TREND_PROMPT = `あなたは Cloudflare ソリューションブログの分析 AI です。
与えられた記事リストを分析し、以下の JSON 形式で週次トレンドレポートを生成してください。

{
  "period": "レポート対象期間",
  "trending_topics": ["トピック1", "トピック2", "トピック3"],
  "summary": "全体の傾向サマリー（3-5文、日本語）",
  "popular_services": ["サービス名1", "サービス名2"],
  "recommendations": ["次に書くべきトピックの提案1", "提案2"]
}

JSON 以外のテキストは出力しないでください。`;

export async function generateTrendReport(
  ai: any,
  articles: { title: string; category: string; tags: string; publishedAt: string }[]
): Promise<{
  period: string;
  trendingTopics: string[];
  summary: string;
  popularServices: string[];
  recommendations: string[];
} | null> {
  try {
    const articleList = articles
      .map((a, i) => `${i + 1}. [${a.category}] ${a.title} (${a.publishedAt}) tags: ${a.tags}`)
      .join("\n");

    const result: any = await ai.run(
      TEXT_MODEL as any,
      {
        messages: [
          { role: "system", content: TREND_PROMPT },
          { role: "user", content: `直近の公開記事:\n\n${articleList}` },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      },
      gwOpts() as any
    );

    const responseText = result.response || result.result?.response || "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      period: parsed.period || "",
      trendingTopics: parsed.trending_topics || [],
      summary: parsed.summary || "",
      popularServices: parsed.popular_services || [],
      recommendations: parsed.recommendations || [],
    };
  } catch (e) {
    console.error("Trend report generation failed:", e);
    return null;
  }
}
