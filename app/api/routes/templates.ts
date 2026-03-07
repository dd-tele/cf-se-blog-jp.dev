import { Hono } from "hono";
import type { HonoEnv } from "../types";
import { requireAuth, requireRole } from "../middleware";
import {
  getActiveTemplates,
  getTemplateById,
  parseInputFields,
  buildUserPrompt,
} from "~/lib/templates.server";
import { ensureUser, createPost } from "~/lib/posts.server";
import { ulid } from "~/lib/ulid";
import { getDb } from "~/lib/db.server";
import { aiDraftRequests } from "~/db/schema";

const templates = new Hono<HonoEnv>();

// ─── GET /api/v1/templates — List all active templates ────────
templates.get("/", requireAuth, async (c) => {
  const list = await getActiveTemplates(c.env.DB);
  return c.json({
    templates: list.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      categoryName: t.categoryName,
      templateType: t.templateType,
      estimatedMinutes: t.estimatedMinutes,
    })),
  });
});

// ─── GET /api/v1/templates/:id — Template details with fields ─
templates.get("/:id", requireAuth, async (c) => {
  const template = await getTemplateById(c.env.DB, c.req.param("id"));
  if (!template) return c.json({ error: "Template not found" }, 404);

  const fields = parseInputFields(template.inputFieldsJson);
  return c.json({
    id: template.id,
    name: template.name,
    description: template.description,
    categoryName: template.categoryName,
    templateType: template.templateType,
    estimatedMinutes: template.estimatedMinutes,
    fields: fields.map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      required: f.required,
      placeholder: f.placeholder,
      options: f.options,
    })),
  });
});

// ─── POST /api/v1/templates/:id/test-generate ─────────────────
// Generates realistic dummy inputs using AI, then creates a draft article.
// Accepts optional overrides in request body.
templates.post("/:id/test-generate", requireRole("admin", "se"), async (c) => {
  const user = c.var.user!;
  const db = c.env.DB;
  const ai = c.env.AI;

  const template = await getTemplateById(db, c.req.param("id"));
  if (!template) return c.json({ error: "Template not found" }, 404);

  const fields = parseInputFields(template.inputFieldsJson);

  // Accept optional overrides and options from request body
  let overrides: Record<string, any> = {};
  let tone: string = "realistic";
  let companyName: string = "";
  try {
    const body = await c.req.json<{
      overrides?: Record<string, any>;
      tone?: string;
      company_name?: string;
    }>();
    overrides = body.overrides ?? {};
    tone = body.tone ?? "realistic";
    companyName = body.company_name ?? "";
  } catch {
    // Empty body is fine — generate everything
  }

  // Step 1: Generate dummy inputs using AI
  const fieldDescriptions = fields.map((f) => {
    let desc = `- ${f.id} (${f.label}): type=${f.type}, required=${f.required}`;
    if (f.placeholder) desc += `, hint="${f.placeholder}"`;
    if (f.options) desc += `, options=[${f.options.join(", ")}]`;
    return desc;
  }).join("\n");

  const toneInstruction = {
    realistic: "実際のエンジニアが書くようなリアルで具体的な内容。会社規模は中〜大企業。数値データも含める。",
    casual: "超いい加減で雑なメモ書き風。箇条書きのみ、体言止め、省略多め。「〜のやつ」「たぶん〜」等のラフな表現。",
    detailed: "非常に詳細で丁寧な記述。背景説明が豊富で、数値データや比較検討も含む。",
    minimal: "最低限の情報のみ。1〜2行の短文。",
  }[tone] ?? "実際のエンジニアが書くようなリアルで具体的な内容。";

  const inputGenPrompt = `あなたは Cloudflare の技術に詳しいエンジニアです。以下のテンプレートフィールドに対して、テスト用のダミー入力データを生成してください。

テンプレート: ${template.name}
カテゴリ: ${template.categoryName ?? "General"}
テンプレートタイプ: ${template.templateType}

## フィールド一覧
${fieldDescriptions}

## トーン指示
${toneInstruction}

## 出力形式
JSON オブジェクトとして出力してください。キーはフィールド ID、値は入力テキストです。
tag_select タイプのフィールドは、options の中から2〜4個を配列で選んでください。
select タイプのフィールドは、options の中から1つを文字列で選んでください。
url_list タイプのフィールドは、1〜2個の実在しそうな URL を配列で。

JSON のみを出力し、他のテキストは含めないでください。`;

  let generatedInputs: Record<string, any> = {};
  try {
    const inputResponse: any = await ai.run(
      "@cf/meta/llama-3.1-70b-instruct" as any,
      {
        messages: [
          { role: "system", content: "You output valid JSON only. No markdown fences, no explanation." },
          { role: "user", content: inputGenPrompt },
        ],
        max_tokens: 2048,
        temperature: 0.7,
      }
    );
    const raw = inputResponse.response || inputResponse.result?.response || "{}";
    // Extract JSON from response (may have markdown fences)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      generatedInputs = JSON.parse(jsonMatch[0]);
    }
  } catch (e: any) {
    return c.json({ error: `Failed to generate test inputs: ${e.message}` }, 500);
  }

  // Merge overrides on top of generated inputs
  const inputs: Record<string, any> = { ...generatedInputs, ...overrides };

  // Step 2: Build user prompt and generate article (same logic as portal.templates.$id.tsx)
  const userPrompt = buildUserPrompt(inputs, fields, companyName);
  const startTime = Date.now();

  const stylePreamble = `## 文体・トーンの指示（最重要）
あなたは企業の SE またはインフラ／開発チームのエンジニアとして、**自社（またはクライアント企業）が抱えていたビジネス課題・技術課題に対し、Cloudflare を活用してどのようにアプローチし解決したか**を読者に共有する立場で書いてください。
単なる初心者の体験記ではなく、企業環境における目的意識のある導入事例として記述してください。

### 禁止表現
- 提案書・営業資料トーン: 「〜が可能です」「〜を推奨します」「〜のメリットがあります」「〜をご検討ください」
- 初心者日記トーン: 「〜を触ってみた」「とりあえず〜してみた」

### 品質ガードレール（厳守）
1. **日本語のみで出力する**: 英語の技術用語はそのまま使用して良いが、非日本語の単語を混入させないこと。
2. **セクション冒頭の遷移表現を多様にする**
3. **セクション間で同じ内容を重複させない**
4. **「〜を考慮しました」だけで終わらせない**: 具体的な判断・対策まで踏み込む

### 文章構成の指示
ユーザーの入力は箇条書きやメモ形式で提供されますが、**入力をそのままコピーして出力しないでください**。
入力内容を咀嚼し、読み応えのある文章に再構成してください。

### タイトル生成ルール
- 記事の **1行目に必ず「# タイトル」形式の見出しを出力する**。

### 文体ルール
- 文末は「です・ます」調で統一
- 見出しは体言止めを基本とする

`;

  try {
    const systemPrompt = stylePreamble + template.aiPromptTemplate;
    const aiResponse: any = await ai.run(
      "@cf/meta/llama-3.1-70b-instruct" as any,
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 8192,
        temperature: 0.4,
      }
    );

    const generatedContent = aiResponse.response || aiResponse.result?.response || "";
    const latencyMs = Date.now() - startTime;

    if (!generatedContent) {
      return c.json({ error: "AI returned empty response" }, 500);
    }

    // Extract title
    const titleMatch = generatedContent.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : template.name;

    await ensureUser(db, user);

    // Create draft post
    const result = await createPost(
      db,
      {
        title,
        content: generatedContent,
        categoryId: template.categoryId ?? undefined,
      },
      user
    );

    // Record AI draft request
    const d = getDb(db);
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    await d.insert(aiDraftRequests).values({
      id: ulid(),
      user_id: user.id,
      template_id: template.id,
      post_id: result.id,
      input_data_json: JSON.stringify(inputs),
      generated_content: generatedContent,
      model_used: "@cf/meta/llama-3.1-70b-instruct",
      latency_ms: latencyMs,
      status: "completed",
      created_at: now,
    });

    return c.json({
      success: true,
      postId: result.id,
      title,
      templateId: template.id,
      templateName: template.name,
      tone,
      generatedInputs: inputs,
      latencyMs,
      editUrl: `/portal/edit/${result.id}`,
    });
  } catch (e: any) {
    return c.json({ error: `Article generation failed: ${e.message}` }, 500);
  }
});

// ─── POST /api/v1/templates/quick-generate ───────────────────
// One-step article generation: pass a topic keyword and the
// system auto-selects the best matching template.
// Designed so users can run a single curl command.
templates.post("/quick-generate", requireRole("admin", "se"), async (c) => {
  const user = c.var.user!;
  const db = c.env.DB;
  const ai = c.env.AI;

  let topic = "";
  let tone = "realistic";
  let companyName = "";
  let overrides: Record<string, any> = {};
  try {
    const body = await c.req.json<{
      topic?: string;
      tone?: string;
      company_name?: string;
      overrides?: Record<string, any>;
    }>();
    topic = body.topic?.trim() ?? "";
    tone = body.tone ?? "realistic";
    companyName = body.company_name ?? "";
    overrides = body.overrides ?? {};
  } catch {
    return c.json({ error: "リクエストボディが不正です" }, 400);
  }

  if (!topic) {
    return c.json({ error: "topic を指定してください（例: 'Zero Trust', 'WAF', 'Workers'）" }, 400);
  }

  // Auto-select template by matching topic against name/description/category
  const allTemplates = await getActiveTemplates(db);
  const topicLower = topic.toLowerCase();
  const matched = allTemplates.find((t) => {
    const haystack = `${t.name} ${t.description ?? ""} ${t.categoryName ?? ""}`.toLowerCase();
    return haystack.includes(topicLower);
  });
  // Fallback: pick first template if no match
  const template = matched ?? allTemplates[0];
  if (!template) {
    return c.json({ error: "利用可能なテンプレートがありません" }, 404);
  }

  const fields = parseInputFields(template.inputFieldsJson);

  // Generate dummy inputs using AI
  const fieldDescriptions = fields.map((f) => {
    let desc = `- ${f.id} (${f.label}): type=${f.type}, required=${f.required}`;
    if (f.placeholder) desc += `, hint="${f.placeholder}"`;
    if (f.options) desc += `, options=[${f.options.join(", ")}]`;
    return desc;
  }).join("\n");

  const toneInstruction = {
    realistic: "実際のエンジニアが書くようなリアルで具体的な内容。会社規模は中〜大企業。数値データも含める。",
    casual: "超いい加減で雑なメモ書き風。箇条書きのみ、体言止め、省略多め。「〜のやつ」「たぶん〜」等のラフな表現。",
    detailed: "非常に詳細で丁寧な記述。背景説明が豊富で、数値データや比較検討も含む。",
    minimal: "最低限の情報のみ。1〜2行の短文。",
  }[tone] ?? "実際のエンジニアが書くようなリアルで具体的な内容。";

  const inputGenPrompt = `あなたは Cloudflare の技術に詳しいエンジニアです。以下のテンプレートフィールドに対して、テスト用のダミー入力データを生成してください。

テンプレート: ${template.name}
カテゴリ: ${template.categoryName ?? "General"}
テンプレートタイプ: ${template.templateType}
トピック: ${topic}
${companyName ? `会社名: ${companyName}` : ""}

## フィールド一覧
${fieldDescriptions}

## トーン指示
${toneInstruction}

## 出力形式
JSON オブジェクトとして出力してください。キーはフィールド ID、値は入力テキストです。
tag_select タイプのフィールドは、options の中から2〜4個を配列で選んでください。
select タイプのフィールドは、options の中から1つを文字列で選んでください。
url_list タイプのフィールドは、1〜2個の実在しそうな URL を配列で。

JSON のみを出力し、他のテキストは含めないでください。`;

  let generatedInputs: Record<string, any> = {};
  try {
    const inputResponse: any = await ai.run(
      "@cf/meta/llama-3.1-70b-instruct" as any,
      {
        messages: [
          { role: "system", content: "You output valid JSON only. No markdown fences, no explanation." },
          { role: "user", content: inputGenPrompt },
        ],
        max_tokens: 2048,
        temperature: 0.7,
      }
    );
    const raw = inputResponse.response || inputResponse.result?.response || "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      generatedInputs = JSON.parse(jsonMatch[0]);
    }
  } catch (e: any) {
    return c.json({ error: `Failed to generate test inputs: ${e.message}` }, 500);
  }

  const inputs: Record<string, any> = { ...generatedInputs, ...overrides };

  const userPrompt = buildUserPrompt(inputs, fields, companyName);
  const startTime = Date.now();

  const stylePreamble = `## 文体・トーンの指示（最重要）
あなたは企業の SE またはインフラ／開発チームのエンジニアとして、**自社（またはクライアント企業）が抱えていたビジネス課題・技術課題に対し、Cloudflare を活用してどのようにアプローチし解決したか**を読者に共有する立場で書いてください。
単なる初心者の体験記ではなく、企業環境における目的意識のある導入事例として記述してください。

### 禁止表現
- 提案書・営業資料トーン: 「〜が可能です」「〜を推奨します」「〜のメリットがあります」「〜をご検討ください」
- 初心者日記トーン: 「〜を触ってみた」「とりあえず〜してみた」

### 品質ガードレール（厳守）
1. **日本語のみで出力する**: 英語の技術用語はそのまま使用して良いが、非日本語の単語を混入させないこと。
2. **セクション冒頭の遷移表現を多様にする**
3. **セクション間で同じ内容を重複させない**
4. **「〜を考慮しました」だけで終わらせない**: 具体的な判断・対策まで踏み込む

### 文章構成の指示
ユーザーの入力は箇条書きやメモ形式で提供されますが、**入力をそのままコピーして出力しないでください**。
入力内容を咀嚼し、読み応えのある文章に再構成してください。

### タイトル生成ルール
- 記事の **1行目に必ず「# タイトル」形式の見出しを出力する**。

### 文体ルール
- 文末は「です・ます」調で統一
- 見出しは体言止めを基本とする

`;

  try {
    const systemPrompt = stylePreamble + template.aiPromptTemplate;
    const aiResponse: any = await ai.run(
      "@cf/meta/llama-3.1-70b-instruct" as any,
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 8192,
        temperature: 0.4,
      }
    );

    const generatedContent = aiResponse.response || aiResponse.result?.response || "";
    const latencyMs = Date.now() - startTime;

    if (!generatedContent) {
      return c.json({ error: "AI returned empty response" }, 500);
    }

    const titleMatch = generatedContent.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : template.name;

    await ensureUser(db, user);

    const result = await createPost(
      db,
      {
        title,
        content: generatedContent,
        categoryId: template.categoryId ?? undefined,
      },
      user
    );

    const d = getDb(db);
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    await d.insert(aiDraftRequests).values({
      id: ulid(),
      user_id: user.id,
      template_id: template.id,
      post_id: result.id,
      input_data_json: JSON.stringify(inputs),
      generated_content: generatedContent,
      model_used: "@cf/meta/llama-3.1-70b-instruct",
      latency_ms: latencyMs,
      status: "completed",
      created_at: now,
    });

    return c.json({
      success: true,
      postId: result.id,
      title,
      templateId: template.id,
      templateName: template.name,
      topic,
      tone,
      generatedInputs: inputs,
      latencyMs,
      editUrl: `/portal/edit/${result.id}`,
    });
  } catch (e: any) {
    return c.json({ error: `Article generation failed: ${e.message}` }, 500);
  }
});

export default templates;
