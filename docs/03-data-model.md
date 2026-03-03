# 03 - データモデル設計 (D1 スキーマ)

## 1. ER 図（概念）

```
┌──────────┐     ┌──────────┐     ┌────────────┐
│  users   │────<│  posts   │────<│ post_tags  │
│          │     │          │     └────────────┘
│          │     │          │            │
│          │     │          │     ┌────────────┐
│          │     │          │────<│   tags     │
└──────────┘     └──────────┘     └────────────┘
     │                │
     │                │───<┌──────────────┐
     │                │    │ ai_summaries  │
     │                │    └──────────────┘
     │                │
     │           ┌────┴────┐
     │           │qa_threads│───<┌─────────────┐
     │           └─────────┘    │ qa_messages  │
     │                          └─────────────┘
     │
     │───<┌──────────────┐
     │    │ audit_logs   │
     │    └──────────────┘
     │
     │───<┌──────────────────┐
          │ user_activities  │
          └──────────────────┘

┌──────────────┐     ┌────────────────┐
│  categories  │     │   templates    │
└──────────────┘     └────────────────┘

┌──────────────┐
│ ai_insights  │
└──────────────┘
```

---

## 2. テーブル定義

### 2.1 `users` — ユーザー

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  bio           TEXT,
  company       TEXT,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'se', 'user')),
  auth_provider TEXT NOT NULL DEFAULT 'access' CHECK (auth_provider IN ('access', 'email', 'google', 'github')),
  auth_id       TEXT, -- Zero Trust Access の sub claim or OAuth ID
  approved_post_count INTEGER NOT NULL DEFAULT 0, -- 承認済み記事数（3回承認後は自動公開）
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_auth ON users(auth_provider, auth_id);
```

### 2.2 `categories` — カテゴリ

```sql
CREATE TABLE categories (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug        TEXT NOT NULL UNIQUE,
  name_ja     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  description TEXT,
  icon        TEXT, -- Lucide icon name
  color       TEXT, -- Tailwind color class
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 初期データ
INSERT INTO categories (slug, name_ja, name_en, description, icon, color, sort_order) VALUES
  ('application', 'Application Services', 'Application Services', 'CDN, WAF, DDoS, Load Balancing, Bot Management 等', 'shield', 'blue', 1),
  ('zerotrust-sase', 'Zero Trust / SASE', 'Zero Trust / SASE', 'Access, Gateway, Tunnel, CASB, DLP, Browser Isolation 等', 'lock', 'purple', 2),
  ('dev-platform', 'Developer Platform', 'Developer Platform', 'Workers, Pages, D1, R2, KV, Durable Objects, AI 等', 'code', 'orange', 3),
  ('email-security', 'Email Security', 'Email Security', 'Area 1, Email Routing, DMARC Management 等', 'mail', 'green', 4),
  ('network', 'Network Services', 'Network Services', 'Magic Transit, Magic WAN, Spectrum, Argo 等', 'globe', 'cyan', 5),
  ('other', 'その他', 'Other', 'Cloudflare に関連するその他のトピック', 'sparkles', 'gray', 99);
```

### 2.3 `posts` — ブログ記事

```sql
CREATE TABLE posts (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  subtitle        TEXT,
  content         TEXT NOT NULL, -- Markdown or HTML
  content_format  TEXT NOT NULL DEFAULT 'markdown' CHECK (content_format IN ('markdown', 'html')),
  excerpt         TEXT, -- 記事概要（自動生成 or 手動）
  cover_image_url TEXT,
  category_id     TEXT NOT NULL REFERENCES categories(id),
  author_id       TEXT NOT NULL REFERENCES users(id),
  template_id     TEXT REFERENCES templates(id),
  
  -- ステータス管理
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published', 'archived', 'rejected')),
  auto_approved   BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = 承認スキップで自動公開された記事
  published_at    TEXT,
  reviewed_by     TEXT REFERENCES users(id),
  reviewed_at     TEXT,
  review_note     TEXT,
  
  -- メタデータ
  reading_time_min INTEGER, -- 推定読了時間（分）
  word_count      INTEGER,
  language        TEXT NOT NULL DEFAULT 'ja' CHECK (language IN ('ja', 'en')),
  
  -- SEO
  meta_title      TEXT,
  meta_description TEXT,
  og_image_url    TEXT,
  
  -- AI 関連
  ai_summary      TEXT, -- AI 生成サマリー
  ai_keywords     TEXT, -- JSON array of AI 抽出キーワード
  ai_related_services TEXT, -- JSON array of 関連 Cloudflare サービス
  vectorized_at   TEXT, -- Vectorize インデックス日時
  
  -- 統計
  view_count      INTEGER NOT NULL DEFAULT 0,
  like_count      INTEGER NOT NULL DEFAULT 0,
  
  -- タイムスタンプ
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_category ON posts(category_id);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_published ON posts(published_at DESC);
CREATE INDEX idx_posts_status_published ON posts(status, published_at DESC);
```

### 2.4 `tags` & `post_tags` — タグ

```sql
CREATE TABLE tags (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE post_tags (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX idx_post_tags_tag ON post_tags(tag_id);
```

### 2.5 `templates` — ブログテンプレート

```sql
CREATE TABLE templates (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  category_id     TEXT REFERENCES categories(id),
  input_fields_json TEXT NOT NULL, -- JSON: AI 下書き生成のための入力フィールド定義
  ai_prompt_template TEXT NOT NULL, -- AI 下書き生成用のシステムプロンプトテンプレート
  example_post_id TEXT REFERENCES posts(id),
  difficulty      TEXT DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  estimated_time  INTEGER, -- 入力目安時間（分）
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  usage_count     INTEGER NOT NULL DEFAULT 0,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_templates_category ON templates(category_id);
```

### 2.5b `ai_draft_requests` — AI 下書き生成リクエスト

```sql
CREATE TABLE ai_draft_requests (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id         TEXT NOT NULL REFERENCES users(id),
  template_id     TEXT NOT NULL REFERENCES templates(id),
  input_data_json TEXT NOT NULL, -- ユーザーが入力した構造化データ（必須項目、追記、画像URL・説明等）
  generated_content TEXT,       -- AI が生成した下書き Markdown
  post_id         TEXT REFERENCES posts(id), -- 生成後に作成された下書き記事の ID
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  model_used      TEXT,
  tokens_used     INTEGER,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ai_draft_requests_user ON ai_draft_requests(user_id);
```

### 2.6 `qa_threads` — Q&A スレッド

```sql
CREATE TABLE qa_threads (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  post_id     TEXT NOT NULL REFERENCES posts(id),
  user_id     TEXT REFERENCES users(id), -- NULL = 匿名
  title       TEXT, -- スレッドタイトル（オプション）
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed', 'flagged')),
  is_ai_only  BOOLEAN NOT NULL DEFAULT FALSE, -- AI のみで回答完結したか
  ip_address  TEXT, -- モデレーション用
  user_agent  TEXT,
  turnstile_token TEXT, -- 検証用トークン
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_qa_threads_post ON qa_threads(post_id);
CREATE INDEX idx_qa_threads_status ON qa_threads(status);
CREATE INDEX idx_qa_threads_user ON qa_threads(user_id);
```

### 2.7 `qa_messages` — Q&A メッセージ

```sql
CREATE TABLE qa_messages (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  thread_id   TEXT NOT NULL REFERENCES qa_threads(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'ai', 'se', 'admin', 'system')),
  content     TEXT NOT NULL,
  sender_id   TEXT REFERENCES users(id), -- NULL for AI/system/anonymous
  
  -- AI メタデータ
  ai_model    TEXT, -- 使用した AI モデル
  ai_tokens_used INTEGER,
  ai_latency_ms INTEGER,
  ai_sources  TEXT, -- JSON array: 参照した記事 IDs
  
  -- モデレーション
  is_flagged  BOOLEAN NOT NULL DEFAULT FALSE,
  flag_reason TEXT,
  moderated_by TEXT REFERENCES users(id),
  moderated_at TEXT,
  
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_qa_messages_thread ON qa_messages(thread_id, created_at);
CREATE INDEX idx_qa_messages_flagged ON qa_messages(is_flagged) WHERE is_flagged = TRUE;
```

### 2.8 `ai_summaries` — AI サマリー

```sql
CREATE TABLE ai_summaries (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  post_id         TEXT NOT NULL REFERENCES posts(id),
  summary_type    TEXT NOT NULL CHECK (summary_type IN ('abstract', 'key_points', 'tech_analysis', 'related_services')),
  content         TEXT NOT NULL,
  model_used      TEXT NOT NULL,
  tokens_used     INTEGER,
  confidence      REAL, -- 0.0 - 1.0
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ai_summaries_post ON ai_summaries(post_id);
```

### 2.9 `ai_insights` — AI インサイトレポート

```sql
CREATE TABLE ai_insights (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  report_type     TEXT NOT NULL CHECK (report_type IN ('weekly', 'monthly', 'trend', 'gap_analysis')),
  title           TEXT NOT NULL,
  content         TEXT NOT NULL, -- Markdown
  data_json       TEXT, -- 構造化データ（グラフ用等）
  period_start    TEXT NOT NULL,
  period_end      TEXT NOT NULL,
  generated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  model_used      TEXT NOT NULL,
  tokens_used     INTEGER
);

CREATE INDEX idx_ai_insights_type ON ai_insights(report_type, generated_at DESC);
```

### 2.10 `audit_logs` — 監査ログ

```sql
CREATE TABLE audit_logs (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT REFERENCES users(id),
  action      TEXT NOT NULL, -- 'post.create', 'post.publish', 'user.login', etc.
  entity_type TEXT, -- 'post', 'user', 'template', etc.
  entity_id   TEXT,
  details     TEXT, -- JSON: 変更内容の詳細
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);
```

### 2.11 `post_likes` — いいね

```sql
CREATE TABLE post_likes (
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, user_id)
);
```

### 2.12 `user_activities` — ユーザーアクティビティ

```sql
CREATE TABLE user_activities (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('post_view', 'post_like', 'chat_message', 'search', 'login')),
  entity_id   TEXT,
  metadata    TEXT, -- JSON
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_user_activities_user ON user_activities(user_id, created_at DESC);
CREATE INDEX idx_user_activities_type ON user_activities(activity_type, created_at DESC);
```

---

## 3. マイグレーション戦略

```bash
# D1 マイグレーション（Wrangler）
wrangler d1 migrations create cf-se-blog-db init
wrangler d1 migrations apply cf-se-blog-db --local   # ローカルテスト
wrangler d1 migrations apply cf-se-blog-db --remote  # 本番適用
```

**マイグレーションファイル構成:**
```
migrations/
  0001_init.sql           # テーブル作成
  0002_seed_categories.sql # カテゴリ初期データ
  0003_seed_templates.sql  # テンプレート初期データ
```
