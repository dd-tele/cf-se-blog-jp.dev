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

### 2.2 Workers (Pages Functions)

本プラットフォームでは独立した Workers は使用せず、全バックエンドロジックを **Remix の loader/action (Pages Functions)** で実装しています。

| 機能 | 実装場所 | 説明 |
|---|---|---|
| Blog CRUD | `portal.edit.$id.tsx` action | 記事の作成・編集・削除・公開 |
| AI ドラフト生成 | `portal.templates.$id.tsx` action | テンプレート入力 → Workers AI 呼び出し |
| 画像アップロード | `portal.edit.$id.tsx` action | R2 へのアップロード + Markdown 挿入 |
| 認証 | `auth.login.tsx` / `auth.server.ts` | Access JWT 検証 + KV セッション |
| 検索 | `search.tsx` loader | D1 全文検索 |
| AI チャット | `ChatWidget` component + action | 記事コンテキストベースの Q&A |

> **注:** Durable Objects、Queues、Cron Triggers は現在未使用。将来的な拡張で導入を検討。

---

## 3. データストレージ

### 3.1 D1 (SQLite Database)
| 項目 | 詳細 |
|---|---|
| **用途** | メインリレーショナルデータベース |
| **DB名** | `cf-se-blog-db` |
| **データ** | 記事、ユーザー、カテゴリ、テンプレート、AI ドラフトリクエスト、Q&A、監査ログ |
| **バックアップ** | D1 自動バックアップ + Time Travel（30日） |

**主要テーブル:**
- `users` — ユーザー情報・ロール
- `posts` — ブログ記事（status: draft / published）
- `categories` — カテゴリマスタ（6カテゴリ）
- `templates` — ブログテンプレート（6テンプレート）
- `ai_draft_requests` — AI ドラフト生成リクエスト・履歴
- `ai_summaries` — AI 生成サマリー
- `qa_threads` — Q&A スレッド
- `qa_messages` — Q&A メッセージ
- `audit_logs` — 操作監査ログ

### 3.2 KV (Key-Value Store)
| 項目 | 詳細 |
|---|---|
| **用途** | セッション管理、レンダリングキャッシュ、下書き自動保存 |
| **Namespace** | `SESSIONS`、`PAGE_CACHE`、`DRAFTS` |

**KV キー設計:**
```
SESSIONS:
  session:{sessionId}        → { userId, role, expiresAt }

PAGE_CACHE:
  cache:post:{slug}          → { html, etag, cachedAt }

DRAFTS:
  draft:{userId}:{postId}    → { content, savedAt }  (TTL: 30日)
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
| **用途** | ブログ記事のセマンティック検索 & 関連記事推薦 |
| **インデックス名** | `cf-se-blog-vectors` |
| **次元数** | 768 (`@cf/baai/bge-base-en-v1.5`) |
| **メトリクス** | Cosine Similarity |
| **メタデータ** | postId, category, author, publishedAt |

**インデックス戦略:**
- 記事公開時にベクトルを生成・保存
- 記事本文を Embedding し、類似記事を `findRelatedPosts()` で取得
- 記事更新時は旧ベクトルを削除して再インデックス

> **注:** Queues は現在未使用。インデックスは同期的に処理。

---

## 4. AI & Machine Learning

### 4.1 Workers AI
| 項目 | 詳細 |
|---|---|
| **用途** | LLM 推論（チャット応答、サマリー生成、コンテンツ分析） |
| **モデル** | 下記参照 |

**使用モデル:**

| モデル | 用途 | 入出力 | パラメータ |
|---|---|---|---|
| `@cf/meta/llama-3.1-70b-instruct` | AI ドラフト生成・チャット Q&A 応答 | テキスト → テキスト | temperature: 0.4, max_tokens: 8192 |
| `@cf/baai/bge-base-en-v1.5` | テキスト Embedding | テキスト → ベクトル (768次元) | — |

> **注:** AI Gateway は現在未使用。Workers AI への直接呼び出しで運用中。
> 将来的に Rate Limiting やコスト追跡が必要になった場合に導入を検討。

---

## 5. セキュリティ

### 5.1 Cloudflare Zero Trust / Access
| 項目 | 詳細 |
|---|---|
| **用途** | ポータル・管理画面の認証 |
| **チーム名** | `cf-se-blog-jp` |
| **チームURL** | `cf-se-blog-jp.cloudflareaccess.com` |
| **IdP 連携** | Google Workspace |
| **ポリシー** | `/portal/*`, `/admin/*`, `/auth/*` → 認証済みユーザー |
| **セッション** | JWT ベース → KV (`SESSIONS`) で管理 |

**Access Policy 設計:**

| アプリケーション | パス | ポリシー |
|---|---|---|
| Blog Portal | `/portal/*`, `/admin/*`, `/auth/*` | Include: Emails ending in `@cloudflare.com` |

**認証フロー:**
1. ユーザーが `/portal` にアクセス
2. Cloudflare Access がログイン画面を表示（IdP 連携）
3. 認証成功 → JWT (`Cf-Access-Jwt-Assertion`) がヘッダーに付与
4. アプリ側で JWT を検証 → ユーザー情報を D1 に upsert
5. セッション ID を KV に保存、Cookie で管理

### 5.2 WAF (Web Application Firewall)
| 項目 | 詳細 |
|---|---|
| **用途** | L7 攻撃防御 |
| **ルールセット** | Cloudflare Managed Rules |

### 5.3 コンテンツセキュリティ
| 対策 | 実装 |
|---|---|
| **XSS 防御** | DOMPurify で Markdown HTML をサニタイズ |
| **CSRF** | Remix の action は POST メソッド + Cookie セッション検証 |

> **注:** Turnstile、Bot Management、Rate Limiting は現在未実装。トラフィック増加時に導入を検討。

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
