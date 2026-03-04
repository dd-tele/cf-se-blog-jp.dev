# 03 - データモデル設計 (D1 スキーマ)

## 1. ER 図（概念）

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   users      │       │   posts      │       │  categories  │
│──────────────│       │──────────────│       │──────────────│
│ id (PK)      │──┐    │ id (PK)      │   ┌──│ id (PK)      │
│ email        │  │    │ slug         │   │  │ name         │
│ display_name │  │    │ title        │   │  │ slug         │
│ role         │  │    │ content (MD) │   │  │ description  │
│ bio          │  ├───>│ author_id(FK)│   │  │ icon         │
│ is_active    │  │    │ category_    │───┘  │ sort_order   │
│ created_at   │  │    │  id(FK)      │      └──────────────┘
└──────────────┘  │    │ status       │
                  │    │ tags_json    │       ┌──────────────┐
                  │    │ published_at │       │  templates   │
                  │    │ view_count   │       │──────────────│
                  │    │ created_at   │       │ id (PK)      │
                  │    └──────┬───────┘       │ name         │
                  │           │               │ input_fields │
                  │           │               │  _json       │
                  │           │               │ ai_prompt_   │
                  │           │               │  template    │
                  │           │               │ category_    │
                  │           │               │  id(FK)      │
                  │           │               │ sort_order   │
           ┌──────┴───────────┤               └──────────────┘
           │                  │
           ▼                  ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  qa_threads  │       │ai_draft_     │       │ ai_summaries │
│──────────────│       │ requests     │       │──────────────│
│ id (PK)      │       │──────────────│       │ id (PK)      │
│ post_id (FK) │       │ id (PK)      │       │ post_id (FK) │
│ status       │       │ user_id (FK) │       │ summary      │
│ message_count│       │ template_    │       │ model_used   │
│ created_at   │       │  id(FK)      │       └──────────────┘
└──────┬───────┘       │ input_data   │
       │               │  _json       │       ┌──────────────┐
       ▼               │ generated_   │       │ audit_logs   │
┌──────────────┐       │  content     │       │──────────────│
│ qa_messages  │       │ post_id (FK) │       │ id (PK)      │
│──────────────│       │ model_used   │       │ user_id (FK) │
│ id (PK)      │       │ latency_ms   │       │ action       │
│ thread_id(FK)│       │ status       │       │ resource_type│
│ role         │       └──────────────┘       │ details_json │
│ content      │                              │ created_at   │
│ user_id (FK) │                              └──────────────┘
│ created_at   │
└──────────────┘

ステータスフロー:
  posts.status:  draft ──→ published
  ai_draft_requests.status: pending → completed / failed
```

---

## 2. テーブル定義

> 以下は `migrations/0001_init.sql` に基づく実際のスキーマです。

### 2.1 `users` — ユーザー

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'se', 'user')),
  bio TEXT,
  social_links_json TEXT,
  approved_post_count INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.2 `categories` — カテゴリ

```sql
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**初期カテゴリ（6件）:** Application Services, Zero Trust / SASE, Developer Platform, Email Security, Network Services, その他

### 2.3 `posts` — ブログ記事

```sql
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,                    -- Markdown
  excerpt TEXT,
  cover_image_url TEXT,
  author_id TEXT NOT NULL REFERENCES users(id),
  category_id TEXT REFERENCES categories(id),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'archived')),
  auto_approved INTEGER NOT NULL DEFAULT 0,
  tags_json TEXT,                           -- JSON array of tag strings
  meta_title TEXT,
  meta_description TEXT,
  reading_time_minutes INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**ステータスフロー:** `draft` → `published`（ワンクリック公開。承認プロセスは廃止済み）

### 2.4 `templates` — ブログテンプレート

```sql
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category_id TEXT REFERENCES categories(id),
  difficulty TEXT NOT NULL DEFAULT 'beginner'
    CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  input_fields_json TEXT NOT NULL,         -- JSON: 入力フィールド定義
  ai_prompt_template TEXT NOT NULL,         -- AI プロンプトテンプレート
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**テンプレート一覧（6件）:**

| ID | テンプレート名 | カテゴリ | 難易度 |
|---|---|---|---|
| t-zt-01 | Zero Trust 導入ガイド | Zero Trust / SASE | 初級 |
| t-dev-01 | Workers / Pages 開発記 | Developer Platform | 中級 |
| t-perf-01 | パフォーマンス最適化 | Application Services | 中級 |
| t-sec-01 | セキュリティ対策 | Application Services | 中級 |
| t-net-01 | ネットワーク構成 | Network Services | 上級 |
| t-gen-01 | Cloudflare Tips & Tricks | その他 | 初級 |

### 2.5 `ai_draft_requests` — AI ドラフト生成リクエスト

```sql
CREATE TABLE IF NOT EXISTS ai_draft_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  template_id TEXT REFERENCES templates(id),
  post_id TEXT REFERENCES posts(id),
  input_data_json TEXT NOT NULL,            -- ユーザー入力データ
  generated_content TEXT,                    -- AI 生成 Markdown
  model_used TEXT,                           -- @cf/meta/llama-3.1-70b-instruct
  tokens_used INTEGER,
  latency_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.6 `ai_summaries` — AI サマリー

```sql
CREATE TABLE IF NOT EXISTS ai_summaries (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id),
  summary TEXT NOT NULL,
  key_points_json TEXT,
  model_used TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.7 `qa_threads` — Q&A スレッド

```sql
CREATE TABLE IF NOT EXISTS qa_threads (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'resolved', 'flagged')),
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.8 `qa_messages` — Q&A メッセージ

```sql
CREATE TABLE IF NOT EXISTS qa_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES qa_threads(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'ai', 'se', 'admin', 'system')),
  content TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  metadata_json TEXT,
  flagged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.9 `audit_logs` — 監査ログ

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details_json TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 3. マイグレーション戦略

```bash
# D1 マイグレーション（Wrangler）
wrangler d1 migrations apply cf-se-blog-db --local   # ローカルテスト
wrangler d1 migrations apply cf-se-blog-db --remote  # 本番適用
```

**マイグレーションファイル構成:**
```
migrations/
  0001_init.sql                    # テーブル作成 + インデックス
  0002_seed_categories.sql         # カテゴリ初期データ（6件）
  0003_seed_templates.sql          # テンプレート初期データ（6件）
  0004_update_template_fields.sql  # テンプレートフィールド更新
  0005_badges.sql                  # バッジ機能追加
  0006_user_password.sql           # ユーザーパスワードカラム追加
  0007_update_template_prompts.sql # テンプレートプロンプト更新
  0008_fix_tldr_label.sql          # TL;DR ラベル修正
```
