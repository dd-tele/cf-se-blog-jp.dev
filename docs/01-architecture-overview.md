# 01 - システム全体アーキテクチャ

## 1. プロジェクト概要

**プロジェクト名:** Cloudflare SE Engineer Blog Platform  
**ドメイン:** `cf-se-blog-jp.dev`  
**目的:** Cloudflare の技術を活用して、より良いインターネット環境の構築に貢献する。ユーザーが自らの作品とも言えるアプリケーションやセキュリティ構築の実践例を、Cloudflare の技術者とエンゲージしながら世の中に簡単に公表できるプラットフォーム。

**設計思想:**
- **Better Internet** — Cloudflare の技術でより良いインターネットを作る貢献の場
- **作品としてのブログ** — ユーザーが構築したアプリケーションやセキュリティ設計を「自らの作品」として世の中に公開できるポートフォリオ
- **Cloudflare エンジニアとのエンゲージメント** — SE ・エンジニアがフィードバック・レビュー・コラボレーションを通じてユーザーとつながる
- **簡単に公表** — AI が下書きを生成し、テンプレートがガイドすることで、誰でも質の高い技術記事をスムーズに公開
- **100% Cloudflare Stack** — ホスティングからセキュリティ、AI まで全て Cloudflare サービスで構成—プラットフォーム自体が Cloudflare のケーパビリティのショーケース

---

## 2. システムアーキテクチャ全体図

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Cloudflare Global Network                     │
│                                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │   WAF    │  │   DDoS   │  │  Bot Mgmt    │  │  Rate Limit   │   │
│  │ Ruleset  │  │Protection│  │  + Turnstile │  │   Rules       │   │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  └───────┬───────┘   │
│       └──────────────┴───────────────┴──────────────────┘           │
│                              │                                       │
│  ┌───────────────────────────┴───────────────────────────────────┐   │
│  │                    Cloudflare Pages                            │   │
│  │              (Remix SSR / Full-Stack App)                     │   │
│  │                                                                │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐ │   │
│  │  │ Public Blog │  │  User Portal │  │   Admin Dashboard    │ │   │
│  │  │   (SSR)     │  │  (Auth'd)    │  │   (Auth'd + RBAC)   │ │   │
│  │  └─────────────┘  └──────────────┘  └──────────────────────┘ │   │
│  └───────────────────────────┬───────────────────────────────────┘   │
│                              │                                       │
│  ┌───────────────────────────┴───────────────────────────────────┐   │
│  │                  Cloudflare Workers (API Layer)                │   │
│  │                                                                │   │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌─────────────┐ │   │
│  │  │ Blog API │  │ Auth API  │  │ AI Agent │  │  Chat API   │ │   │
│  │  │ (CRUD)   │  │ (Session) │  │  API     │  │  (WebSocket)│ │   │
│  │  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └──────┬──────┘ │   │
│  └───────┼───────────────┼─────────────┼───────────────┼────────┘   │
│          │               │             │               │             │
│  ┌───────┴───────┐ ┌────┴────┐  ┌─────┴─────┐  ┌─────┴──────────┐ │
│  │     D1        │ │   KV    │  │Workers AI │  │  Durable       │ │
│  │  (SQLite DB)  │ │(Session │  │+ AI       │  │  Objects       │ │
│  │               │ │ /Cache) │  │  Gateway  │  │  (Chat State)  │ │
│  └───────────────┘ └─────────┘  └───────────┘  └────────────────┘ │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │     R2       │  │  Vectorize   │  │    Queues + Cron        │   │
│  │ (Images/     │  │ (Blog Content│  │  (AI Summary / Index)   │   │
│  │  Assets)     │  │  Embeddings) │  │                         │   │
│  └──────────────┘  └──────────────┘  └─────────────────────────┘   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │              Cloudflare Zero Trust / Access                  │     │
│  │  ┌──────────┐  ┌───────────────┐  ┌───────────────────┐    │     │
│  │  │  Access  │  │  Gateway DNS  │  │  Browser Isolation │    │     │
│  │  │  (SSO)   │  │  Policies     │  │  (Admin Preview)   │    │     │
│  │  └──────────┘  └───────────────┘  └───────────────────┘    │     │
│  └─────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. コンポーネント構成

### 3.1 フロントエンド層

| コンポーネント | 技術 | 説明 |
|---|---|---|
| **Public Blog** | Remix on Pages (SSR) | SEO 最適化されたブログ公開ページ |
| **User Portal** | Remix on Pages | ユーザーが自身のブログを執筆・管理するポータル |
| **Admin Dashboard** | Remix on Pages | 管理者（SE）専用のダッシュボード |
| **AI Chat Widget** | WebSocket + React | ブログ記事に埋め込まれた Q&A チャット |

### 3.2 バックエンド API 層

API レイヤーは **Hono** フレームワークで実装。Remix の route ファイルは thin shim として Hono `app.fetch()` に委譲する構成。

| コンポーネント | 技術 | 説明 |
|---|---|---|
| **Blog CRUD API** | Hono + Remix loader/action | 記事の CRUD 操作（下書き保存・公開） |
| **AI Draft API** | Hono + Workers AI | テンプレート入力から AI 下書き生成 |
| **Auth API** | Hono middleware + Zero Trust Access | 認証・認可・セッション管理 |
| **AI Summary API** | Hono + Workers AI | ブログ要約・技術トレンド分析 |
| **AI Chat API** | Hono streamSSE + Workers AI | SSE ストリーミング Q&A チャット |
| **Search API** | Remix loader + Vectorize | セマンティック検索 |
| **Image API** | Hono + R2 | 画像アップロード・配信 |

### 3.3 データ層

| ストア | 技術 | 用途 |
|---|---|---|
| **メインDB** | D1 (SQLite) | 記事、ユーザー、Q&A、テンプレート等 |
| **セッション/キャッシュ** | KV | セッションストア、レンダリングキャッシュ |
| **メディアストレージ** | R2 | 画像、添付ファイル |
| **ベクトルDB** | Vectorize | ブログ記事の Embedding（AI 検索用） |
| **チャット状態** | D1 (qa_threads / qa_messages) | チャットスレッド・メッセージ永続化 |

### 3.4 セキュリティ層

| コンポーネント | 技術 | 説明 |
|---|---|---|
| **エッジ防御** | WAF + DDoS + Rate Limiting | L7 攻撃防御 |
| **ボット対策** | Turnstile + Bot Management | チャット・投稿のボット防止 |
| **認証** | Zero Trust Access (SSO) | 管理者はOkta/Google SSO |
| **認可** | RBAC (Custom Workers) | admin / se / user ロール |
| **コンテンツ安全** | AI Gateway + Workers AI | 不適切コンテンツフィルタリング |
| **API保護** | API Shield + mTLS | API エンドポイント保護 |

---

## 4. リクエストフロー

### 4.1 ブログ閲覧（公開）

```
User → Cloudflare CDN (Cache) → Pages (Remix SSR) → D1 → HTML Response
                                                   ↓
                                              KV (Cache hit → 直接返却)
```

### 4.2 ブログ執筆（認証済みユーザー）

```
User → Zero Trust Access (Login) → User Portal
     → テンプレート選択 → 構造化入力フォーム（メモ書きレベルでOK）
     → [AI で下書きを生成] → Workers AI (Llama 3.1 70B) が Markdown 記事を自動作成
     → Markdown エディタで自由に編集・画像追加
     → [下書き保存] or [公開] → D1 に保存
     → 管理者は全下書きを閲覧可能（読み取り専用）
```

### 4.3 AI チャット Q&A

```
User → Turnstile Verify → WebSocket (Durable Object)
     → AI Gateway (Rate Limit + Log) → Workers AI (LLM)
     → Vectorize (Relevant Context) → Response
     → D1 (Q&A Log for Admin)
```

---

## 5. URL 設計

```
# Public（認証不要）
https://cf-se-blog-jp.dev/                           → トップページ
https://cf-se-blog-jp.dev/posts                      → 事例一覧
https://cf-se-blog-jp.dev/posts/:slug                → 記事詳細
https://cf-se-blog-jp.dev/search                     → 検索
https://cf-se-blog-jp.dev/about                      → このブログについて（技術構成）
https://cf-se-blog-jp.dev/feed.xml                   → RSS フィード
https://cf-se-blog-jp.dev/sitemap.xml                → サイトマップ

# Auth
https://cf-se-blog-jp.dev/auth/login                 → ログイン
https://cf-se-blog-jp.dev/auth/logout                → ログアウト
https://cf-se-blog-jp.dev/auth/logged-out            → ログアウト完了

# User Portal（要認証 — Cloudflare Access）
https://cf-se-blog-jp.dev/portal/                    → ダッシュボード（統計 + クイックアクション）
https://cf-se-blog-jp.dev/portal/new                 → 新規記事作成（Markdown エディタ）
https://cf-se-blog-jp.dev/portal/edit/:id            → 記事編集
https://cf-se-blog-jp.dev/portal/posts               → マイ記事一覧
https://cf-se-blog-jp.dev/portal/templates           → テンプレート一覧
https://cf-se-blog-jp.dev/portal/templates/:id       → テンプレート入力 → AI ドラフト生成

# Admin（admin ロールのみ）
https://cf-se-blog-jp.dev/admin/                     → 管理ダッシュボード
https://cf-se-blog-jp.dev/admin/posts                → 全記事管理（下書き含む、読み取り専用）
https://cf-se-blog-jp.dev/admin/users                → ユーザー管理
https://cf-se-blog-jp.dev/admin/qa                   → Q&A 管理

# API（Hono フレームワークで実装、Remix route は thin shim として委譲）
# POST /api/v1/chat         → AI チャット Q&A（SSE ストリーミング）
# POST /api/v1/ai/*         → AI 機能（タグ提案、文章改善、トレンドレポート）
# POST /api/upload-image    → 画像アップロード（R2）
# GET  /api/health          → ヘルスチェック
```

---

## 6. 技術スタック詳細

| レイヤー | 技術 | バージョン/備考 |
|---|---|---|
| **フレームワーク** | Remix (React) + Hono (API) | v2.x on Cloudflare Pages |
| **API フレームワーク** | Hono | 軽量・高速な API ルーティング、ミドルウェア、SSE ストリーミング |
| **UI ライブラリ** | Tailwind CSS v3 + Typography plugin | モダン UI + Markdown 整形 |
| **Markdown** | marked + DOMPurify | Markdown レンダリング + XSS 対策 |
| **状態管理** | Remix loader/action | サーバーファースト |
| **認証** | Cloudflare Access (Zero Trust) | JWT ベース SSO |
| **ORM** | Drizzle ORM | D1 対応のタイプセーフ ORM |
| **AI モデル** | Meta Llama 3.3 70B Instruct (fp8-fast) | Workers AI 経由 |
| **デプロイ** | Wrangler CLI | Pages ダイレクトデプロイ |

---

## 7. マルチテナント設計

このプラットフォームは3つのロールで構成:

| ロール | 権限 | 認証方式 |
|---|---|---|
| **Admin (管理者)** | 全下書き閲覧（読み取り専用）、ユーザー管理、Q&A管理 | Zero Trust Access (SSO) |
| **SE (ソリューションエンジニア)** | 記事執筆・編集・公開 | Zero Trust Access (SSO) |
| **User (一般ユーザー)** | 記事執筆・編集・公開、チャット Q&A | Zero Trust Access (SSO) |

---

## 8. パフォーマンス設計

- **SSR + Edge Cache**: Remix SSR の出力を KV / Cache API で CDN キャッシュ
- **Stale-While-Revalidate**: 記事ページは SWR パターンで常に高速応答
- **画像最適化**: R2 + Cloudflare Images で WebP/AVIF 自動変換
- **Smart Placement**: Workers Smart Placement で D1 近接配置
- **Early Hints**: Link ヘッダーで CSS/JS を先読み
