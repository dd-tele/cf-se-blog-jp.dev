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

| コンポーネント | 技術 | 説明 |
|---|---|---|
| **Blog CRUD API** | Workers (Remix loader/action) | 記事の CRUD 操作（自動承認判定含む） |
| **AI Draft API** | Workers + Workers AI | テンプレート入力から AI 下書き生成 |
| **Auth API** | Workers + Zero Trust Access | 認証・認可・セッション管理 |
| **AI Summary API** | Workers + Workers AI | ブログ要約・技術トレンド分析 |
| **AI Chat API** | Workers + Durable Objects | リアルタイム Q&A チャット |
| **Search API** | Workers + Vectorize | セマンティック検索 |
| **Image API** | Workers + R2 + Images | 画像アップロード・最適化 |

### 3.3 データ層

| ストア | 技術 | 用途 |
|---|---|---|
| **メインDB** | D1 (SQLite) | 記事、ユーザー、Q&A、テンプレート等 |
| **セッション/キャッシュ** | KV | セッションストア、レンダリングキャッシュ |
| **メディアストレージ** | R2 | 画像、添付ファイル |
| **ベクトルDB** | Vectorize | ブログ記事の Embedding（AI 検索用） |
| **チャット状態** | Durable Objects | チャットセッション状態管理 |
| **非同期処理** | Queues | AI 処理のバックグラウンドジョブ |

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
User → Turnstile Verify → Zero Trust Access (Login) → User Portal
     → テンプレート選択 → 構造化入力フォーム（必須項目・追記・画像＆説明）
     → [AI 下書き生成] → Workers AI が Markdown 下書きを自動作成
     → リッチエディタで自由に編集 → Auto-save (KV Draft)
     → Publish →┬→ 承認済み記事 3件未満: pending_review → Admin レビュー → D1
                └→ 承認済み記事 3件以上: auto_approved → 即時公開 → D1
                                                       → Queue (AI Summary)
                                                       → Queue (Vectorize Index)
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
# Public Blog
https://cf-se-blog-jp.dev/                          → トップページ
https://cf-se-blog-jp.dev/posts/:slug               → 記事詳細
https://cf-se-blog-jp.dev/category/:category         → カテゴリ一覧
https://cf-se-blog-jp.dev/author/:username           → 著者別一覧
https://cf-se-blog-jp.dev/search                     → 検索

# User Portal（要認証）
https://cf-se-blog-jp.dev/portal/                    → ユーザーダッシュボード
https://cf-se-blog-jp.dev/portal/new                 → 新規記事作成
https://cf-se-blog-jp.dev/portal/edit/:id            → 記事編集
https://cf-se-blog-jp.dev/portal/drafts              → 下書き一覧
https://cf-se-blog-jp.dev/portal/profile             → プロフィール設定

# Admin Dashboard（要管理者認証）
https://cf-se-blog-jp.dev/admin/                     → 管理ダッシュボード
https://cf-se-blog-jp.dev/admin/posts                → 全記事管理
https://cf-se-blog-jp.dev/admin/posts/:id/review     → 記事レビュー
https://cf-se-blog-jp.dev/admin/users                → ユーザー管理
https://cf-se-blog-jp.dev/admin/qa                   → Q&A 管理
https://cf-se-blog-jp.dev/admin/analytics            → アナリティクス
https://cf-se-blog-jp.dev/admin/ai-insights          → AI インサイト
https://cf-se-blog-jp.dev/admin/templates            → テンプレート管理
https://cf-se-blog-jp.dev/admin/moderation           → コンテンツモデレーション

# API
https://cf-se-blog-jp.dev/api/v1/posts               → 記事 API
https://cf-se-blog-jp.dev/api/v1/chat                → チャット API (WebSocket)
https://cf-se-blog-jp.dev/api/v1/search              → 検索 API
https://cf-se-blog-jp.dev/api/v1/ai/summary          → AI サマリー API
https://cf-se-blog-jp.dev/api/v1/upload              → 画像アップロード API
```

---

## 6. 技術スタック詳細

| レイヤー | 技術 | バージョン/備考 |
|---|---|---|
| **フレームワーク** | Remix (React) | v2.x on Cloudflare Pages |
| **UI ライブラリ** | Tailwind CSS + shadcn/ui | モダン UI |
| **エディタ** | Tiptap (ProseMirror) | リッチテキスト + Markdown |
| **状態管理** | Remix loader/action + React Context | サーバーファースト |
| **認証** | Cloudflare Access + remix-auth | SSO 統合 |
| **ORM** | Drizzle ORM | D1 対応の軽量 ORM |
| **デプロイ** | Wrangler + GitHub Actions | CI/CD |
| **モニタリング** | Workers Analytics + Logpush | 可観測性 |

---

## 7. マルチテナント設計

このプラットフォームは3つのロールで構成:

| ロール | 権限 | 認証方式 |
|---|---|---|
| **Admin (管理者)** | 全権限（記事承認、ユーザー管理、Q&A管理、AI設定） | Zero Trust Access (SSO) |
| **SE (ソリューションエンジニア)** | 記事執筆・編集（即時公開）、Q&A回答、テンプレート管理 | Zero Trust Access (SSO) |
| **User (一般ユーザー)** | 記事執筆（初回〜2回目は承認制、3回目以降は自動公開）、チャット Q&A | Email/Social Login + Turnstile |

---

## 8. パフォーマンス設計

- **SSR + Edge Cache**: Remix SSR の出力を KV / Cache API で CDN キャッシュ
- **Stale-While-Revalidate**: 記事ページは SWR パターンで常に高速応答
- **画像最適化**: R2 + Cloudflare Images で WebP/AVIF 自動変換
- **Smart Placement**: Workers Smart Placement で D1 近接配置
- **Early Hints**: Link ヘッダーで CSS/JS を先読み
