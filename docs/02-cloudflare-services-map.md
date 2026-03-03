# 02 - 利用 Cloudflare サービス一覧と役割

## 1. サービスマッピング総覧

本プラットフォームで使用する全 Cloudflare サービスとその役割を定義する。

---

## 2. コンピュート & ホスティング

### 2.1 Cloudflare Pages
| 項目 | 詳細 |
|---|---|
| **用途** | Remix フルスタックアプリケーションのホスティング |
| **機能** | SSR、Static Assets、Functions (Workers 統合) |
| **プラン** | Pro 以上推奨（ビルド回数・帯域） |
| **設定** | カスタムドメイン `cf-se-blog-jp.dev`、Preview Deployments |
| **ビルド** | `remix build` → Pages Functions 自動デプロイ |

**Pages の役割:**
- フロントエンド（React SSR）+ バックエンド（API Routes）を一体デプロイ
- Git 連携による自動 CI/CD（GitHub → Pages）
- Preview URL による記事プレビュー

### 2.2 Cloudflare Workers
| 項目 | 詳細 |
|---|---|
| **用途** | Pages Functions では対応しきれない独立 API、Cron Triggers |
| **主要 Worker** | `ai-summary-worker`、`chat-worker`、`search-indexer-worker` |
| **プラン** | Workers Paid（CPU 時間 50ms 超対応） |

**Workers 一覧:**

| Worker 名 | トリガー | 役割 |
|---|---|---|
| `ai-summary-worker` | Queue Consumer | 記事公開時に AI サマリー生成 |
| `search-indexer-worker` | Queue Consumer | 記事を Vectorize にインデックス |
| `chat-worker` | HTTP + WebSocket | Durable Objects ベースのチャット |
| `cron-analytics-worker` | Cron Trigger (daily) | 日次 AI インサイトレポート生成 |
| `image-optimizer-worker` | R2 Event Notification | 画像アップロード後処理 |

### 2.3 Durable Objects
| 項目 | 詳細 |
|---|---|
| **用途** | AI チャットセッション状態管理 |
| **クラス** | `ChatRoom` — 記事ごとのチャットルーム |
| **機能** | WebSocket 接続管理、会話履歴保持、レート制限 |
| **永続化** | Transactional Storage（DO 内蔵ストレージ） |

---

## 3. データストレージ

### 3.1 D1 (SQLite Database)
| 項目 | 詳細 |
|---|---|
| **用途** | メインリレーショナルデータベース |
| **DB名** | `cf-se-blog-db` |
| **データ** | 記事、ユーザー、カテゴリ、テンプレート、Q&A ログ、AI サマリー |
| **バックアップ** | D1 自動バックアップ + Time Travel（30日） |

**主要テーブル:**
- `users` — ユーザー情報・ロール
- `posts` — ブログ記事
- `categories` — カテゴリマスタ
- `templates` — ブログテンプレート
- `qa_threads` — Q&A スレッド
- `qa_messages` — Q&A メッセージ
- `ai_summaries` — AI 生成サマリー
- `ai_insights` — AI インサイトレポート
- `audit_logs` — 操作監査ログ

### 3.2 KV (Key-Value Store)
| 項目 | 詳細 |
|---|---|
| **用途** | セッション管理、レンダリングキャッシュ、下書き自動保存 |
| **Namespace** | `SESSIONS`、`PAGE_CACHE`、`DRAFTS`、`RATE_LIMITS` |

**KV キー設計:**
```
SESSIONS:
  session:{sessionId}        → { userId, role, expiresAt }

PAGE_CACHE:
  cache:post:{slug}          → { html, etag, cachedAt }
  cache:category:{category}  → { html, cachedAt }

DRAFTS:
  draft:{userId}:{postId}    → { content, savedAt }  (TTL: 30日)

RATE_LIMITS:
  ratelimit:chat:{ip}        → { count, windowStart }
```

### 3.3 R2 (Object Storage)
| 項目 | 詳細 |
|---|---|
| **用途** | 画像・メディアファイルストレージ |
| **バケット名** | `cf-se-blog-media` |
| **構造** | `images/{userId}/{year}/{month}/{filename}` |
| **アクセス** | Public bucket + Custom Domain or Workers Route |
| **制限** | 1ファイル最大 10MB、ユーザーあたり 100MB |

### 3.4 Vectorize
| 項目 | 詳細 |
|---|---|
| **用途** | ブログ記事のセマンティック検索 & AI チャットのコンテキスト検索 |
| **インデックス名** | `blog-content-index` |
| **次元数** | 768 (BGE-base) or 1536 (OpenAI compatible) |
| **メトリクス** | Cosine Similarity |
| **メタデータ** | postId, category, author, publishedAt |

**インデックス戦略:**
- 記事公開時に Queues 経由で非同期インデックス
- 記事本文をチャンク分割（500トークン/チャンク、100トークンオーバーラップ）
- タイトル・カテゴリ・タグをメタデータとして付与
- 記事更新時は旧ベクトルを削除して再インデックス

### 3.5 Queues
| 項目 | 詳細 |
|---|---|
| **用途** | 非同期バックグラウンド処理 |
| **キュー名** | 役割 |

| Queue 名 | Producer | Consumer | 用途 |
|---|---|---|---|
| `post-published` | Blog API | `ai-summary-worker` | AI サマリー生成 |
| `post-index` | Blog API | `search-indexer-worker` | Vectorize インデックス |
| `chat-log` | Chat Worker | Pages Function | Q&A ログ永続化 |
| `content-moderation` | Chat/Blog API | Moderation Worker | コンテンツ審査 |

---

## 4. AI & Machine Learning

### 4.1 Workers AI
| 項目 | 詳細 |
|---|---|
| **用途** | LLM 推論（チャット応答、サマリー生成、コンテンツ分析） |
| **モデル** | 下記参照 |

**使用モデル:**

| モデル | 用途 | 入出力 |
|---|---|---|
| `@cf/meta/llama-3.1-70b-instruct` | チャット Q&A 応答 | テキスト → テキスト |
| `@cf/meta/llama-3.1-8b-instruct` | サマリー生成（コスト最適化） | テキスト → テキスト |
| `@cf/baai/bge-large-en-v1.5` | テキスト Embedding | テキスト → ベクトル |
| `@cf/meta/llama-guard-3-8b` | コンテンツモデレーション | テキスト → 安全性判定 |

### 4.2 AI Gateway
| 項目 | 詳細 |
|---|---|
| **用途** | AI API のプロキシ・レート制限・ログ・キャッシュ |
| **ゲートウェイ名** | `cf-se-blog-ai` |

**AI Gateway の機能活用:**
- **Rate Limiting**: ユーザーあたりのチャットリクエスト制限（10 req/min）
- **Caching**: 同一質問へのキャッシュ応答（コスト削減）
- **Logging**: 全 AI リクエスト/レスポンスのログ（管理画面で閲覧可能）
- **Fallback**: プライマリモデル障害時のフォールバック設定
- **Cost Tracking**: AI 利用コストの追跡・可視化

---

## 5. セキュリティ

### 5.1 Cloudflare Zero Trust / Access
| 項目 | 詳細 |
|---|---|
| **用途** | 管理者・SE の認証 |
| **IdP 連携** | Google Workspace / Okta / Azure AD |
| **ポリシー** | `/admin/*` → Admin グループのみ、`/portal/*` → 認証済みユーザー |
| **セッション** | 24時間 + リフレッシュ |

**Access Policy 設計:**

| アプリケーション | パス | ポリシー |
|---|---|---|
| Admin Dashboard | `/admin/*` | Include: Email ends with `@cloudflare.com` AND Group: `SE-Admin` |
| SE Portal | `/portal/*` (SE functions) | Include: Email ends with `@cloudflare.com` AND Group: `SE-Team` |
| User Portal | `/portal/*` | Include: Everyone (with login) |

### 5.2 WAF (Web Application Firewall)
| 項目 | 詳細 |
|---|---|
| **用途** | L7 攻撃防御 |
| **ルールセット** | Cloudflare Managed Rules + OWASP Core Rule Set |
| **カスタムルール** | XSS 対策強化（ブログ投稿のサニタイズ補強） |

### 5.3 Turnstile
| 項目 | 詳細 |
|---|---|
| **用途** | ボット防止（チャット、記事投稿、コメント） |
| **モード** | Managed（通常）+ Invisible（チャット連続投稿時） |
| **適用箇所** | ログイン、記事投稿、チャット送信、検索 |

### 5.4 Rate Limiting
| 項目 | 詳細 |
|---|---|
| **用途** | API エンドポイントの保護 |

| エンドポイント | 制限 | ウィンドウ |
|---|---|---|
| `POST /api/v1/chat` | 10 req | 1 min |
| `POST /api/v1/posts` | 5 req | 1 min |
| `POST /api/v1/upload` | 10 req | 1 min |
| `GET /api/v1/search` | 30 req | 1 min |
| `POST /api/v1/ai/*` | 20 req | 1 min |

### 5.5 Bot Management
| 項目 | 詳細 |
|---|---|
| **用途** | スクレイピング・自動投稿防止 |
| **スコア閾値** | < 30 → Block、30-50 → Challenge、> 50 → Allow |

---

## 6. 可観測性 & 分析

### 6.1 Workers Analytics Engine
| 項目 | 詳細 |
|---|---|
| **用途** | カスタムアナリティクス（PV、記事エンゲージメント、チャット利用） |
| **データポイント** | pageView, articleRead, chatMessage, searchQuery |

### 6.2 Logpush
| 項目 | 詳細 |
|---|---|
| **用途** | セキュリティログの外部保存 |
| **送信先** | R2 バケット `cf-se-blog-logs` |
| **データセット** | HTTP Requests, Firewall Events, Workers Trace Events |

### 6.3 Web Analytics
| 項目 | 詳細 |
|---|---|
| **用途** | プライバシーファーストの訪問者分析 |
| **特徴** | Cookie 不要、GDPR 準拠 |

---

## 7. ネットワーク & パフォーマンス

### 7.1 DNS
| 項目 | 詳細 |
|---|---|
| **ゾーン** | `cf-se-blog-jp.dev` |
| **レコード** | `cf-se-blog-jp.dev` → Pages Custom Domain |
| **その他** | `media.cf-se-blog-jp.dev` → R2 Custom Domain |

### 7.2 Cache Rules
| 項目 | 詳細 |
|---|---|
| **Static Assets** | Cache Everything, TTL 30日 |
| **ブログ記事 HTML** | Edge TTL 1時間、Browser TTL 5分、SWR |
| **API レスポンス** | No Cache (Dynamic) |
| **画像** | Cache Everything, TTL 365日 |

### 7.3 Speed Optimizations
- **Early Hints (103)** — CSS/JS の先読み
- **Auto Minify** — HTML/CSS/JS 自動圧縮
- **Brotli** — 圧縮有効
- **HTTP/3** — QUIC 有効
- **Image Resizing** — Cloudflare Images でオンザフライリサイズ

---

## 8. サービス費用見積もり（概算）

| サービス | プラン | 月額概算 |
|---|---|---|
| Pages | Pro | $20 |
| Workers | Paid | $5 (基本) + 従量 |
| D1 | 含まれる | $0 (5GB まで) |
| R2 | 従量制 | ~$5 (10GB 想定) |
| KV | 含まれる | $0 (基本枠内) |
| Vectorize | 含まれる | $0 (Workers Paid 枠) |
| Workers AI | 従量制 | ~$10-30 |
| AI Gateway | 無料 | $0 |
| Durable Objects | 従量制 | ~$1-5 |
| Queues | 従量制 | ~$1 |
| Zero Trust | Free (50ユーザーまで) | $0 |
| Turnstile | 無料 | $0 |
| WAF | Pro プラン含む | $0 (追加なし) |
| **合計** | | **~$42-66/月** |

> **注:** 上記はスモールスタート時の概算。トラフィック増加に応じてスケール。
> Workers Paid プラン ($5/月) に多くのサービスが含まれるため、非常にコスト効率が良い。
