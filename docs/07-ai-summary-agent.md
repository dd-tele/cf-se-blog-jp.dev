# 07 - AI サマリーエージェント設計

> **実装状況:** 基本的な AI サマリーテーブル (`ai_summaries`) は作成済み。Queues / Cron Trigger による自動生成は未実装。現在は AI ドラフト生成（テンプレート → Workers AI Llama 3.1 70B）のみ稼働中。

## 1. 概要

AI サマリーエージェントは、ブログ記事の公開をトリガーにして自動的に以下を生成する:

1. **記事サマリー** — 各記事の要約・キーポイント抽出
2. **技術分析** — 使用されている Cloudflare サービスと技術パターンの識別
3. **トレンドレポート** — 定期的な技術トレンド分析と今後の展望
4. **ギャップ分析** — コンテンツが不足している分野の特定
5. **トピック推薦** — 次に書くべき記事のトピック候補

---

## 2. アーキテクチャ

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│  記事公開     │     │   Queues     │     │  ai-summary-worker   │
│  (Blog API)  │────>│ post-published│────>│                      │
└──────────────┘     └──────────────┘     │  1. 記事テキスト取得  │
                                          │  2. AI Gateway 経由   │
                                          │  3. Workers AI 呼出   │
                                          │  4. 結果を D1 保存    │
                                          │  5. Vectorize 更新    │
                                          └──────────┬───────────┘
                                                     │
                                    ┌────────────────┼────────────────┐
                                    ▼                ▼                ▼
                              ┌──────────┐   ┌──────────┐   ┌──────────┐
                              │    D1    │   │ Vectorize│   │    KV    │
                              │(Summary) │   │ (Index)  │   │ (Cache)  │
                              └──────────┘   └──────────┘   └──────────┘

┌──────────────┐     ┌──────────────────────────────────────────────┐
│  Cron Trigger│     │  cron-analytics-worker                       │
│  (Weekly)    │────>│                                              │
└──────────────┘     │  1. 期間内の全記事・Q&A データ収集           │
                     │  2. カテゴリ別分析                           │
                     │  3. Q&A トピック分析                         │
                     │  4. トレンドレポート生成                     │
                     │  5. ギャップ分析 & トピック推薦              │
                     │  6. D1 (ai_insights) に保存                  │
                     └──────────────────────────────────────────────┘
```

---

## 3. 記事サマリー生成

### 3.1 トリガー

記事が `published` ステータスに変更された時、Queues にメッセージを送信:

```typescript
// Blog API (Remix action)
async function publishPost(postId: string, env: Env) {
  // ステータス更新
  await env.DB.prepare(
    "UPDATE posts SET status = 'published', published_at = datetime('now') WHERE id = ?"
  ).bind(postId).run();

  // Queue にサマリー生成リクエストを送信
  await env.POST_PUBLISHED_QUEUE.send({
    type: 'generate_summary',
    postId,
    timestamp: new Date().toISOString()
  });

  // Queue に Vectorize インデックスリクエストを送信
  await env.POST_INDEX_QUEUE.send({
    type: 'index_post',
    postId,
    timestamp: new Date().toISOString()
  });
}
```

### 3.2 サマリー生成 Worker

```typescript
// workers/ai-summary-worker.ts
export default {
  async queue(batch: MessageBatch<QueueMessage>, env: Env) {
    for (const message of batch.messages) {
      try {
        switch (message.body.type) {
          case 'generate_summary':
            await generateSummary(message.body.postId, env);
            break;
        }
        message.ack();
      } catch (error) {
        message.retry();
      }
    }
  }
};

async function generateSummary(postId: string, env: Env) {
  // 1. 記事データ取得
  const post = await env.DB.prepare(
    "SELECT p.*, c.name_ja as category_name FROM posts p JOIN categories c ON p.category_id = c.id WHERE p.id = ?"
  ).bind(postId).first();

  if (!post) throw new Error(`Post not found: ${postId}`);

  // 2. AI Gateway 経由で Workers AI を呼び出し
  const gateway = new AIGateway(env.AI_GATEWAY_URL, env.AI_GATEWAY_TOKEN);

  // --- サマリー生成 ---
  const summaryResult = await gateway.run("@cf/meta/llama-3.1-8b-instruct", {
    messages: [
      {
        role: "system",
        content: SUMMARY_SYSTEM_PROMPT
      },
      {
        role: "user",
        content: `以下のブログ記事を分析してください。\n\nタイトル: ${post.title}\nカテゴリ: ${post.category_name}\n\n${post.content}`
      }
    ],
    max_tokens: 2048,
    temperature: 0.3 // 低温で事実に基づいた要約
  });

  // 3. 結果をパース & 保存
  const parsed = JSON.parse(summaryResult.response);
  
  // D1 に保存
  await saveSummaries(env.DB, postId, parsed);

  // 記事テーブルも更新
  await env.DB.prepare(
    `UPDATE posts SET 
      ai_summary = ?, 
      ai_keywords = ?, 
      ai_related_services = ?,
      reading_time_min = ?,
      updated_at = datetime('now')
    WHERE id = ?`
  ).bind(
    parsed.abstract,
    JSON.stringify(parsed.keywords),
    JSON.stringify(parsed.related_services),
    parsed.reading_time_min,
    postId
  ).run();
}
```

### 3.3 サマリー生成プロンプト

```typescript
const SUMMARY_SYSTEM_PROMPT = `あなたは Cloudflare の技術ブログを分析する AI アシスタントです。
与えられた記事を分析し、以下の JSON 形式で結果を返してください。

{
  "abstract": "記事の要約（3-5文、日本語）",
  "key_points": [
    "重要ポイント1",
    "重要ポイント2",
    "重要ポイント3"
  ],
  "keywords": ["キーワード1", "キーワード2", ...],
  "related_services": [
    {
      "name": "Cloudflare サービス名",
      "role": "この記事での使われ方"
    }
  ],
  "difficulty_level": "beginner|intermediate|advanced",
  "reading_time_min": 数値（推定読了時間、分）,
  "tech_patterns": [
    "使用されている技術パターン（例: Edge-side RAG, mTLS認証, etc.）"
  ],
  "future_potential": [
    {
      "area": "今後活用できそうな技術分野",
      "reason": "理由",
      "relevance": "high|medium|low"
    }
  ],
  "suggested_next_topics": [
    "この記事の読者が次に興味を持ちそうなトピック"
  ]
}

注意事項:
- Cloudflare のサービス名は正確に記載してください
- 技術的な正確性を最優先してください
- 日本語で回答してください
- JSON 以外のテキストは出力しないでください`;
```

---

## 4. Vectorize インデックス

### 4.1 インデックス Worker

```typescript
// workers/search-indexer-worker.ts
async function indexPost(postId: string, env: Env) {
  const post = await env.DB.prepare(
    "SELECT * FROM posts WHERE id = ?"
  ).bind(postId).first();

  if (!post) return;

  // 既存のベクトルを削除（更新時）
  await env.VECTORIZE_INDEX.deleteByIds([
    ...Array.from({ length: 50 }, (_, i) => `${postId}_chunk_${i}`)
  ]);

  // 記事をチャンク分割
  const chunks = splitIntoChunks(post.content, {
    maxTokens: 500,
    overlap: 100
  });

  // 各チャンクを Embedding
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await env.AI.run(
      "@cf/baai/bge-large-en-v1.5",
      { text: [chunks[i]] }
    );

    await env.VECTORIZE_INDEX.upsert([{
      id: `${postId}_chunk_${i}`,
      values: embedding.data[0],
      metadata: {
        postId: post.id,
        title: post.title,
        category: post.category_id,
        author: post.author_id,
        publishedAt: post.published_at,
        chunkIndex: i,
        chunkText: chunks[i].substring(0, 200) // プレビュー用
      }
    }]);
  }

  // インデックス完了日時を更新
  await env.DB.prepare(
    "UPDATE posts SET vectorized_at = datetime('now') WHERE id = ?"
  ).bind(postId).run();
}

function splitIntoChunks(text: string, options: { maxTokens: number; overlap: number }): string[] {
  // 段落・見出し単位で分割し、トークン制限内に収める
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if (estimateTokens(currentChunk + para) > options.maxTokens) {
      if (currentChunk) chunks.push(currentChunk.trim());
      // オーバーラップ: 前のチャンクの末尾を次のチャンクの先頭に
      const overlapText = currentChunk.slice(-options.overlap * 4); // 概算
      currentChunk = overlapText + '\n\n' + para;
    } else {
      currentChunk += '\n\n' + para;
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());

  return chunks;
}
```

---

## 5. 定期トレンドレポート

### 5.1 Cron Trigger 設定

```toml
# wrangler.toml (cron-analytics-worker)
[triggers]
crons = [
  "0 3 * * 1",   # 毎週月曜 3:00 AM UTC — 週次レポート
  "0 3 1 * *"    # 毎月1日 3:00 AM UTC — 月次レポート
]
```

### 5.2 レポート生成ロジック

```typescript
// workers/cron-analytics-worker.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    const isMonthly = new Date(event.scheduledTime).getDate() === 1;
    const reportType = isMonthly ? 'monthly' : 'weekly';
    
    await generateInsightReport(reportType, env);
  }
};

async function generateInsightReport(type: 'weekly' | 'monthly', env: Env) {
  const periodDays = type === 'weekly' ? 7 : 30;
  const periodStart = new Date(Date.now() - periodDays * 86400000).toISOString();

  // 1. データ収集
  const [posts, qaThreads, qaMessages, categories] = await Promise.all([
    // 期間内の公開記事
    env.DB.prepare(
      "SELECT p.*, c.name_ja as category_name FROM posts p JOIN categories c ON p.category_id = c.id WHERE p.published_at >= ? AND p.status = 'published' ORDER BY p.published_at DESC"
    ).bind(periodStart).all(),
    
    // 期間内の Q&A スレッド
    env.DB.prepare(
      "SELECT qt.*, p.title as post_title, p.category_id FROM qa_threads qt JOIN posts p ON qt.post_id = p.id WHERE qt.created_at >= ?"
    ).bind(periodStart).all(),
    
    // 期間内の Q&A メッセージ（ユーザー発言のみ）
    env.DB.prepare(
      "SELECT qm.content, qt.post_id FROM qa_messages qm JOIN qa_threads qt ON qm.thread_id = qt.id WHERE qm.role = 'user' AND qm.created_at >= ?"
    ).bind(periodStart).all(),
    
    // カテゴリ別の累計記事数
    env.DB.prepare(
      "SELECT c.name_ja, c.slug, COUNT(p.id) as count FROM categories c LEFT JOIN posts p ON c.id = p.category_id AND p.status = 'published' GROUP BY c.id ORDER BY count DESC"
    ).all()
  ]);

  // 2. AI によるトレンド分析
  const analysisInput = {
    period: { type, start: periodStart, end: new Date().toISOString() },
    posts: posts.results.map(p => ({
      title: p.title,
      category: p.category_name,
      keywords: p.ai_keywords ? JSON.parse(p.ai_keywords as string) : [],
      services: p.ai_related_services ? JSON.parse(p.ai_related_services as string) : [],
      viewCount: p.view_count
    })),
    qaTopics: qaMessages.results.map(m => m.content).slice(0, 100), // 上位100件
    categoryDistribution: categories.results
  };

  const insightResult = await env.AI.run(
    "@cf/meta/llama-3.1-70b-instruct",
    {
      messages: [
        { role: "system", content: INSIGHT_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(analysisInput) }
      ],
      max_tokens: 4096,
      temperature: 0.4
    }
  );

  // 3. レポート保存
  const report = JSON.parse(insightResult.response);
  
  await env.DB.prepare(
    `INSERT INTO ai_insights (report_type, title, content, data_json, period_start, period_end, model_used, tokens_used)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    type,
    report.title,
    report.markdown_content,
    JSON.stringify(report.structured_data),
    periodStart,
    new Date().toISOString(),
    "@cf/meta/llama-3.1-70b-instruct",
    insightResult.usage?.total_tokens || 0
  ).run();
}
```

### 5.3 トレンド分析プロンプト

```typescript
const INSIGHT_SYSTEM_PROMPT = `あなたは Cloudflare の技術トレンドを分析する AI アナリストです。
与えられたブログプラットフォームのデータを分析し、以下の JSON 形式でレポートを生成してください。

{
  "title": "レポートタイトル（例: 2026年2月 技術トレンドレポート）",
  "markdown_content": "Markdown形式の詳細レポート本文",
  "structured_data": {
    "trending_topics": [
      { "topic": "トピック名", "growth_rate": "増加率(%)", "description": "説明" }
    ],
    "content_gaps": [
      { "area": "不足分野", "severity": "high|medium|low", "suggestion": "推奨アクション" }
    ],
    "qa_insights": [
      { "topic": "よくある質問トピック", "frequency": 数値, "has_article": true/false }
    ],
    "recommended_topics": [
      { "title": "推奨記事タイトル", "category": "カテゴリ", "reason": "推奨理由", "priority": "high|medium|low" }
    ],
    "service_coverage": {
      "well_covered": ["十分カバーされているサービス"],
      "needs_more": ["記事が不足しているサービス"],
      "not_covered": ["全くカバーされていないサービス"]
    },
    "future_outlook": [
      { "prediction": "今後の予測", "timeframe": "期間", "confidence": "high|medium|low" }
    ]
  }
}

分析のポイント:
1. カテゴリ別の記事数の偏りを分析
2. Q&A の質問内容から潜在的なニーズを抽出
3. Cloudflare の最新サービス/機能と記事カバレッジのギャップを特定
4. トレンドの方向性（増加/減少/安定）を判定
5. 実用的で具体的な推奨アクションを提示
6. 全て日本語で出力`;
```

---

## 6. AI アシスタント（執筆支援）

記事エディタ内で使える AI 支援機能:

### 6.1 機能一覧

| 機能 | エンドポイント | モデル | 説明 |
|---|---|---|---|
| **AI 下書き生成** | `POST /api/v1/ai/generate-draft` | llama-3.1-70b | テンプレート入力から完全な Markdown 下書きを生成 |
| 要約生成 | `POST /api/v1/ai/summarize` | llama-3.1-8b | 記事の要約を自動生成 |
| SEO タイトル | `POST /api/v1/ai/seo-title` | llama-3.1-8b | SEO 最適化タイトル候補 |
| タグ提案 | `POST /api/v1/ai/suggest-tags` | llama-3.1-8b | 記事内容からタグを推薦 |
| 文章改善 | `POST /api/v1/ai/improve` | llama-3.1-70b | 選択テキストの文章改善 |
| トピック提案 | `POST /api/v1/ai/suggest-topic` | llama-3.1-70b | 書くべきトピックの推薦 |

### 6.2 AI 下書き生成 API（テンプレート → AI ドラフト）

テンプレートの構造化入力フォームから、Workers AI が完全な Markdown ブログ下書きを自動生成する。
生成された下書きはリッチエディタに展開され、**ユーザーは自由に書き換え可能**。

```typescript
// POST /api/v1/ai/generate-draft
// Request
{
  "templateId": "t-dev-01",
  "inputs": {
    "app_name": "社内 RAG 検索システム",
    "why_cloudflare": "Workers AI + Vectorize でサーバーレスに RAG を構築できる",
    "tech_stack": ["Workers", "Workers AI", "Vectorize", "D1"],
    "steps": "・Vectorize インデックス作成\n・Embedding 生成\n・Workers AI で応答生成\n・ストリーミング対応",
    "target_audience": "Workers 初心者〜中級者",
    "framework": "Hono",
    "code_snippets": "const results = await env.VECTORIZE.query(embedding, { topK: 5 });",
    "notes": "D1 と組み合わせてメタデータ管理も紹介したい",
    "reference_urls": ["https://developers.cloudflare.com/vectorize/"]
  },
  "images": [
    { "url": "https://media.cf-se-blog-jp.dev/abc123.png", "description": "全体アーキテクチャ図" },
    { "url": "https://media.cf-se-blog-jp.dev/def456.png", "description": "Vectorize ダッシュボード" }
  ]
}

// Response
{
  "postId": "newly-created-draft-id",
  "title": "Workers AI + Vectorize で社内 RAG 検索を構築する",
  "content": "## はじめに\n\n社内ドキュメントを効率的に...(AI 生成 Markdown)...",
  "suggestedTags": ["workers-ai", "vectorize", "rag", "hono"],
  "draftRequestId": "ai-draft-request-id"
}
```

#### 下書き生成 Worker 実装

```typescript
// app/routes/api.v1.ai.generate-draft.tsx
import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const { templateId, inputs, images } = await request.json();

  // 1. テンプレートの ai_prompt_template を取得
  const template = await env.DB.prepare(
    'SELECT * FROM templates WHERE id = ?'
  ).bind(templateId).first();

  if (!template) return json({ error: 'Template not found' }, { status: 404 });

  // 2. ユーザー入力をプロンプトに組み立て
  const userPrompt = buildUserPrompt(inputs, images, template.input_fields_json);

  // 3. AI Gateway 経由で Workers AI を呼び出し
  const aiResponse = await env.AI.run(
    '@cf/meta/llama-3.1-70b-instruct',
    {
      messages: [
        { role: 'system', content: template.ai_prompt_template },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 4096,
      temperature: 0.7
    }
  );

  const generatedContent = aiResponse.response;

  // 4. 下書き記事を D1 に作成 (status: 'draft')
  const postId = crypto.randomUUID();
  const title = extractTitle(generatedContent); // Markdown の # から抽出

  await env.DB.prepare(`
    INSERT INTO posts (id, slug, title, content, content_format, category_id, author_id, template_id, status)
    VALUES (?, ?, ?, ?, 'markdown', ?, ?, ?, 'draft')
  `).bind(postId, generateSlug(title), title, generatedContent,
          template.category_id, userId, templateId).run();

  // 5. AI 下書きリクエストを記録
  await env.DB.prepare(`
    INSERT INTO ai_draft_requests (id, user_id, template_id, input_data_json, generated_content, post_id, status, model_used)
    VALUES (?, ?, ?, ?, ?, ?, 'completed', '@cf/meta/llama-3.1-70b-instruct')
  `).bind(crypto.randomUUID(), userId, templateId,
          JSON.stringify({ inputs, images }), generatedContent, postId).run();

  // 6. KV に下書きをキャッシュ（エディタのリアルタイム編集用）
  await env.DRAFTS.put(`draft:${postId}`, generatedContent, { expirationTtl: 86400 * 7 });

  return json({ postId, title, content: generatedContent });
}

function buildUserPrompt(
  inputs: Record<string, any>,
  images: Array<{ url: string; description: string }>,
  fieldsJson: string
): string {
  const fields = JSON.parse(fieldsJson).fields;
  let prompt = '## ユーザー入力情報\n\n';

  for (const field of fields) {
    const value = inputs[field.id];
    if (value) {
      prompt += `### ${field.label}\n${Array.isArray(value) ? value.join(', ') : value}\n\n`;
    }
  }

  if (images?.length > 0) {
    prompt += '### アップロード画像\n';
    prompt += '以下の画像を記事の適切な位置に配置してください:\n';
    for (const img of images) {
      prompt += `- ![${img.description}](${img.url})\n`;
    }
    prompt += '\n';
  }

  return prompt;
}
```

#### 自動承認判定ロジック

```typescript
// 記事公開時の承認判定 (Blog CRUD API 内)
async function handlePublish(postId: string, userId: string, env: Env) {
  const user = await env.DB.prepare(
    'SELECT role, approved_post_count FROM users WHERE id = ?'
  ).bind(userId).first();

  const needsReview = user.role === 'user' && user.approved_post_count < 3;

  if (needsReview) {
    // 承認が必要 → pending_review に設定
    await env.DB.prepare(
      "UPDATE posts SET status = 'pending_review' WHERE id = ?"
    ).bind(postId).run();
    return { status: 'pending_review', message: '管理者の承認待ちです' };
  } else {
    // 自動公開 (Admin/SE ロール or 承認済み3件以上の User)
    await env.DB.prepare(
      "UPDATE posts SET status = 'published', auto_approved = TRUE, published_at = datetime('now') WHERE id = ?"
    ).bind(postId).run();

    // AI サマリー & Vectorize インデックスの Queue 送信
    await env.POST_PUBLISHED_QUEUE.send({ type: 'generate_summary', postId });
    await env.POST_INDEX_QUEUE.send({ type: 'index_post', postId });

    return { status: 'published', message: '記事が公開されました' };
  }
}

// Admin が記事を承認した時のカウント更新
async function approvePost(postId: string, reviewerId: string, env: Env) {
  const post = await env.DB.prepare('SELECT author_id FROM posts WHERE id = ?').bind(postId).first();

  // 記事を公開
  await env.DB.prepare(`
    UPDATE posts SET status = 'published', reviewed_by = ?, reviewed_at = datetime('now'), published_at = datetime('now')
    WHERE id = ?
  `).bind(reviewerId, postId).run();

  // ユーザーの approved_post_count をインクリメント
  await env.DB.prepare(`
    UPDATE users SET approved_post_count = approved_post_count + 1 WHERE id = ?
  `).bind(post.author_id).run();

  // Queue 送信
  await env.POST_PUBLISHED_QUEUE.send({ type: 'generate_summary', postId });
  await env.POST_INDEX_QUEUE.send({ type: 'index_post', postId });
}
```

### 6.3 その他 AI API 仕様例

```typescript
// POST /api/v1/ai/suggest-tags
// Request
{
  "content": "記事本文（途中でも可）",
  "category": "dev-platform",
  "existingTags": ["workers-ai"]
}

// Response
{
  "suggestedTags": [
    { "name": "vectorize", "confidence": 0.95, "reason": "Vectorize の使用例が含まれている" },
    { "name": "rag", "confidence": 0.92, "reason": "RAG パターンの解説がある" },
    { "name": "embedding", "confidence": 0.85, "reason": "テキスト Embedding の実装がある" }
  ]
}
```

---

## 7. コスト最適化

| 処理 | モデル | 理由 |
|---|---|---|
| 記事サマリー | 8B (軽量) | 構造化された入力のため小型モデルで十分 |
| トレンド分析 | 70B (高精度) | 複雑な分析タスクのため大型モデル |
| タグ/SEO 提案 | 8B (軽量) | 単純な分類/抽出タスク |
| 文章改善 | 70B (高精度) | 自然言語生成の品質が重要 |
| トピック提案 | 70B (高精度) | 創造的な推論が必要 |

**キャッシング戦略:**
- AI Gateway のキャッシュ機能を活用
- 同一記事の再分析リクエストはキャッシュから返却
- トレンドレポートは週次/月次のため、キャッシュ TTL = レポート期間
