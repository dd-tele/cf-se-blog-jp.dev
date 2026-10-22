# 本番デプロイ手順書

**ドメイン:** `cf-se-blog-jp.dev`  
**スタック:** Remix on Cloudflare Pages + D1 + R2 + KV + Workers AI + Vectorize + Email Workers

---

## 前提条件

- [ ] Cloudflare アカウント作成済み（Workers Paid プラン推奨）
- [ ] `cf-se-blog-jp.dev` ドメインを Cloudflare に追加済み
- [ ] GitHub リポジトリ作成済み
- [ ] ローカルに Node.js 20+ / npm インストール済み
- [ ] Wrangler CLI インストール済み (`npm i -g wrangler`)

---

## Step 0: Wrangler ログイン

```bash
wrangler login
```

ブラウザが開くので、新しい Cloudflare アカウントで認証してください。

---

## Step 1: Cloudflare リソース作成

以下のコマンドを **プロジェクトルートで** 順番に実行してください。
各コマンドの出力に含まれる **ID** を控えてください。

### 1.1 D1 データベース

```bash
wrangler d1 create cf-se-blog-db
```

出力例:
```
✅ Successfully created DB 'cf-se-blog-db'
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   ← これを控える
```

### 1.2 R2 バケット

```bash
wrangler r2 bucket create cf-se-blog-media
```

### 1.3 KV Namespace × 3

```bash
wrangler kv namespace create SESSIONS
wrangler kv namespace create PAGE_CACHE
wrangler kv namespace create DRAFTS
```

それぞれの出力から `id` を控えてください:
```
{ binding = "SESSIONS", id = "xxxxxxxx..." }    ← SESSIONS の ID
{ binding = "PAGE_CACHE", id = "xxxxxxxx..." }  ← PAGE_CACHE の ID
{ binding = "DRAFTS", id = "xxxxxxxx..." }      ← DRAFTS の ID
```

### 1.4 Vectorize インデックス

```bash
wrangler vectorize create cf-se-blog-vectors --dimensions=768 --metric=cosine
```

> **dimensions=768** は `@cf/baai/bge-base-en-v1.5` embedding モデルの次元数です。

### 1.5 AI Gateway（任意）

Cloudflare Dashboard → AI → AI Gateway で作成:
- **Name:** `cf-se-blog-gw`
- 作成後、Gateway ID を控える

---

## Step 2: wrangler.toml を本番 ID に更新

Step 1 で控えた ID を `wrangler.toml` に反映してください:

```toml
name = "cf-se-blog"
compatibility_date = "2025-12-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "./build/client"

[vars]
ENVIRONMENT = "production"
SITE_NAME = "Cloudflare Solution Blog"
SITE_URL = "https://cf-se-blog-jp.dev"
# AI_GATEWAY_ID = "cf-se-blog-gw"        # 現在未使用

[[d1_databases]]
binding = "DB"
database_name = "cf-se-blog-db"
database_id = "★ Step 1.1 の ID ★"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "cf-se-blog-media"

[[kv_namespaces]]
binding = "SESSIONS"
id = "★ Step 1.3 SESSIONS の ID ★"

[[kv_namespaces]]
binding = "PAGE_CACHE"
id = "★ Step 1.3 PAGE_CACHE の ID ★"

[[kv_namespaces]]
binding = "DRAFTS"
id = "★ Step 1.3 DRAFTS の ID ★"

[ai]
binding = "AI"

[[vectorize]]
binding = "VECTORIZE"
index_name = "cf-se-blog-vectors"
```

---

## Step 3: D1 マイグレーション実行（リモート）

```bash
wrangler d1 migrations apply cf-se-blog-db --remote
```

または個別に実行:
```bash
wrangler d1 execute cf-se-blog-db --remote --file=migrations/0001_init.sql
wrangler d1 execute cf-se-blog-db --remote --file=migrations/0002_seed_categories.sql
wrangler d1 execute cf-se-blog-db --remote --file=migrations/0003_seed_templates.sql
wrangler d1 execute cf-se-blog-db --remote --file=migrations/0004_update_template_fields.sql
wrangler d1 execute cf-se-blog-db --remote --file=migrations/0005_badges.sql
wrangler d1 execute cf-se-blog-db --remote --file=migrations/0006_user_password.sql
wrangler d1 execute cf-se-blog-db --remote --file=migrations/0007_update_template_prompts.sql
wrangler d1 execute cf-se-blog-db --remote --file=migrations/0008_fix_tldr_label.sql
wrangler d1 execute cf-se-blog-db --remote --file=migrations/0009_user_profiles_and_access_requests.sql
```

実行後、確認:
```bash
wrangler d1 execute cf-se-blog-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

期待される出力テーブル: `access_requests`, `ai_draft_requests`, `ai_summaries`, `audit_logs`, `categories`, `notification_settings`, `posts`, `qa_messages`, `qa_threads`, `templates`, `user_badges`, `users`

---

## Step 3.5: Email Worker デプロイ

承認通知メール送信用の専用 Worker をデプロイします。

```bash
# Email Worker の依存パッケージインストール
cd workers/email-worker && npm install && cd ../..

# Email Worker デプロイ
npx wrangler deploy --config workers/email-worker/wrangler.toml
```

出力例:
```
Published cf-se-blog-email-worker
  https://cf-se-blog-email-worker.<subdomain>.workers.dev
  Send Email: SEND_EMAIL: unrestricted
```

> **❗ `send_email` バインディングを使うため、Email Routing がドメインで有効である必要があります。**
> Dashboard → Email → Email Routing → Overview で有効化してください。

---

## Step 4: GitHub リポジトリにプッシュ

```bash
cd /Users/daisuke/CascadeProjects/cf-se-blog-platform

git init
git add .
git commit -m "Initial commit: Cloudflare SE Blog Platform"

git remote add origin https://github.com/<YOUR_ORG>/<YOUR_REPO>.git
git branch -M main
git push -u origin main
```

---

## Step 5: Cloudflare Pages プロジェクト作成 + GitHub 連携

### 方法 A: Dashboard（推奨）

1. **Cloudflare Dashboard** → Workers & Pages → **Create** → **Pages** → **Connect to Git**
2. GitHub アカウントを連携し、リポジトリを選択
3. ビルド設定:

| 項目 | 値 |
|---|---|
| **Project name** | `cf-se-blog` |
| **Production branch** | `main` |
| **Build command** | `npm run build` |
| **Build output directory** | `build/client` |
| **Root directory** | `/` |
| **Node.js version** | `20` |

4. **Environment variables** は不要（`wrangler.toml` の `[vars]` で管理）
5. **Save and Deploy** をクリック

### 方法 B: CLI

```bash
npm run build
wrangler pages deploy ./build/client --project-name=cf-se-blog
```

> CLI デプロイの場合、初回実行でプロジェクトが自動作成されます。
> ただし GitHub 連携による自動デプロイを有効にするには Dashboard での設定が必要です。

### Bindings 設定（重要）

Dashboard で Pages プロジェクト作成後、**Settings → Functions → Bindings** で以下を設定:

| Type | Binding name | Resource |
|---|---|---|
| D1 Database | `DB` | `cf-se-blog-db` |
| R2 Bucket | `R2_BUCKET` | `cf-se-blog-media` |
| KV Namespace | `SESSIONS` | (Step 1.3 で作成したもの) |
| KV Namespace | `PAGE_CACHE` | (Step 1.3 で作成したもの) |
| KV Namespace | `DRAFTS` | (Step 1.3 で作成したもの) |
| Workers AI | `AI` | (有効化) |
| Vectorize | `VECTORIZE` | `cf-se-blog-vectors` |

> **⚠️ wrangler.toml に書いても、Pages の場合は Dashboard の Bindings 設定が優先されます。必ず Dashboard で設定してください。**

---

## Step 6: カスタムドメイン設定

### 6.1 Pages カスタムドメイン

1. Dashboard → Workers & Pages → `cf-se-blog` → **Custom domains**
2. **Set up a custom domain** → `cf-se-blog-jp.dev` を入力
3. DNS レコードが自動追加される（CNAME → `cf-se-blog.pages.dev`）

### 6.2 DNS 確認

Dashboard → DNS → Records で以下を確認:

| Type | Name | Content | Proxy |
|---|---|---|---|
| CNAME | `cf-se-blog-jp.dev` | `cf-se-blog.pages.dev` | Proxied ☁️ |

---

## Step 7: セキュリティ設定

Dashboard → `cf-se-blog-jp.dev` ゾーンで以下を設定:

### 7.1 SSL/TLS

- **SSL/TLS** → Overview → **Full (strict)**
- **Edge Certificates**:
  - **Always Use HTTPS**: ON
  - **Minimum TLS Version**: 1.2 （1.3 推奨だが互換性考慮）
  - **TLS 1.3**: ON
  - **HSTS**: Enable → `max-age=31536000`, `includeSubDomains` ON, `preload` ON

### 7.2 Security

- **WAF** → Managed Rules: Cloudflare Managed Ruleset を有効化
- **Bot Fight Mode**: ON
- **Security Level**: Medium

### 7.3 Speed

- **Auto Minify**: JavaScript, CSS, HTML すべて ON
- **Brotli**: ON
- **Early Hints**: ON
- **HTTP/2 to Origin**: ON

### 7.4 Caching

- **Caching** → Configuration:
  - **Browser Cache TTL**: Respect Existing Headers
- **Cache Rules** で静的アセットに長い TTL を設定（任意）

---

## Step 8: 動作確認

デプロイ後、以下を確認:

```
✅ https://cf-se-blog-jp.dev/                → トップページ表示
✅ https://cf-se-blog-jp.dev/posts            → 記事一覧（空でOK）
✅ https://cf-se-blog-jp.dev/auth/login       → ログインページ
✅ https://cf-se-blog-jp.dev/feed.xml         → RSS フィード
✅ https://cf-se-blog-jp.dev/sitemap.xml      → サイトマップ
✅ https://cf-se-blog-jp.dev/search           → 検索ページ
```

ログイン後:
```
✅ /portal              → ダッシュボード（統計 + クイックアクション）
✅ /portal/new          → 新規記事作成
✅ /portal/posts        → マイ記事一覧
✅ /portal/templates    → テンプレート一覧
✅ /admin               → 管理画面（admin ロールのみ）
✅ /about               → このブログについて（技術構成ページ）
```

---

## Step 9: Cloudflare Access 認証（設定済み）

本番環境では **Cloudflare Access (Zero Trust)** で認証を構成済みです。

| 項目 | 値 |
|---|---|
| **チーム名** | `cf-se-jp`（Pages シークレット `CF_ACCESS_TEAM_DOMAIN` にはこのチーム名を設定） |
| **チームURL** | `cf-se-jp.cloudflareaccess.com` |
| **保護パス** | `/portal/*`, `/admin/*`（`/`・`/auth/*`・`/api/*` は一般公開。アプリ側で JWT を署名検証する） |
| **AUD** | `/portal`・`/admin` 共通。Pages シークレット `CF_ACCESS_AUD`（複数ある場合はカンマ区切り） |
| **セッション署名鍵** | Pages シークレット `SESSION_SECRET`（32文字以上のランダム値。未設定だとログイン不可） |
| **プレビュー** | `*.cf-se-blog.pages.dev` は Pages の Access ポリシーで全体保護（AUD は本番と別） |
| **プレビュー共有** | `/preview/*` は別の Access アプリケーション（One-time PIN、AUD は `CF_ACCESS_PREVIEW_AUD`）。Step 11 参照 |
| **IdP** | Google Workspace |
| **ポリシー** | Emails ending in `@cloudflare.com` |

ローカル開発時（localhost かつ `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD` 未設定）のみモックログインが表示されます。デプロイ環境ではモックログインは常に無効です。

---

## Step 10: Cloudflare API 環境変数設定

投稿者申請の承認・ Email Routing ・ Access ポリシー操作に必要な環境変数を Pages の Secrets に設定:

| 変数名 | 用途 | 設定先 |
|---|---|---|
| `CF_AUTH_EMAIL` | Cloudflare アカウントメール | Pages Secrets |
| `CF_GLOBAL_API_KEY` | Global API Key | Pages Secrets |
| `CF_ACCOUNT_ID` | アカウント ID | Pages Secrets |
| `CF_ACCESS_APP_ID` | Access アプリケーション ID | Pages Secrets |
| `CF_ACCESS_POLICY_ID` | Access ポリシー ID | Pages Secrets |
| `CF_ACCESS_TEAM_DOMAIN` | Zero Trust チーム URL | Pages Secrets |
| `CF_ACCESS_AUD` | Access オーディエンスタグ | Pages Secrets |
| `ADMIN_EMAILS` | 管理者メール（カンマ区切り） | Pages Secrets |
| `SE_EMAIL_DOMAINS` | SE メールドメイン | Pages Secrets |

Dashboard → Workers & Pages → `cf-se-blog` → Settings → Environment variables → Secrets で設定。

---

## Step 11: プレビュー共有（期限付きリンク + Access One-time PIN）

記事の作成者と管理者が、編集画面の「プレビューを共有」から、指定したメールアドレスに期限付きのプレビューリンク
（`/preview/<id>`）を発行できます。下書きの記事・事例も閲覧できます。

```
発行: D1 preview_grants に記録 → プレビュー用 Access ポリシーの Include にメールアドレスを同期（API）→ 案内メール
閲覧: Access（/preview/* のみ・One-time PIN）でメールアドレスを確認
      → アプリが JWT（CF_ACCESS_PREVIEW_AUD）と preview_grants（メールアドレス・期限・取り消し）を確認し、その 1 記事だけを表示
```

- 閲覧者にはサイトのセッションも `users` の行も作りません（`app/root.tsx` は `/preview/` で自動ログインしない）。
- 期限と取り消しはアプリがリクエストのたびに確認します。Access ポリシーの Include は、発行・取り消し時と、
  期限切れのリンクが開かれたときに、有効なリンクのメールアドレスの一覧に同期します（`syncPreviewAccessPolicy`）。
- 事例の iframe 用トークンは、プレビューでは最長 2 時間（リンクの期限まで）に短縮しています。

### 11.1 Access の設定（Zero Trust ダッシュボード）

1. **One-time PIN** がログイン方法に追加されていることを確認する（Integrations → Identity providers）。
2. **再利用可能なポリシー**を作成する（Access controls → Policies）。
   - 名前: `Field Notes preview reviewers`、Action: **Allow**
   - Include: **Emails** = `nobody@preview.invalid`（プレースホルダー。アプリが同期時に置き換える）
   - Require: **Login Methods** = One-time PIN
   - 作成後のポリシー ID を控える。
3. **Self-hosted アプリケーション**を作成する（Access controls → Applications）。
   - ドメイン: `cf-se-blog-jp.dev`、パス: `preview/*`
   - ポリシー: 2 のポリシーのみ
   - ログイン方法: One-time PIN のみ（**Instant Auth** を有効にすると IdP の選択画面を省略できる）
   - セッション時間: 24 時間（期限はアプリ側でも確認する）
   - 作成後、Overview の **Application Audience (AUD) Tag** を控える。
4. Pages の Secrets に設定する。

| 変数名 | 値 |
|---|---|
| `CF_ACCESS_PREVIEW_AUD` | 3 の AUD タグ。**`CF_ACCESS_AUD` には追加しないこと**（追加すると閲覧者が通常ユーザーとして自動登録され、限定公開の記事や `/portal` に入れてしまう） |
| `CF_ACCESS_PREVIEW_POLICY_ID` | 2 のポリシー ID |

Access API は既存の `CF_GLOBAL_API_KEY` または `CF_API_TOKEN`（`Access: Apps and Policies Write` が必要）を使います。

> **シート数**: One-time PIN でログインした閲覧者も Zero Trust のシートを消費し、削除するまでカウントされます
> （Team & Resources → Users）。

### 11.2 案内メール（Email Sending）

社外のアドレスに案内メールを送るには、送信元ドメインを **Cloudflare Email Sending** に登録する必要があります
（未登録の場合は Email Routing で確認済みの宛先にしか送れず、案内メールは失敗します。リンクは発行され、案内文をコピーして送れます）。

```bash
npx wrangler@latest email sending enable cf-se-blog-jp.dev     # SPF / DKIM などの DNS レコードを追加
npx wrangler@latest email sending dns get cf-se-blog-jp.dev    # レコードの確認
```

Email Worker は認証必須になりました（`Authorization: Bearer <EMAIL_WORKER_SECRET>`。未設定だと 503 を返し送信しない）。
承認メールを止めないよう、次の順で設定します。

```bash
SECRET=$(openssl rand -hex 32)
# 1. Pages に設定してデプロイ（旧 Worker はヘッダーを無視するので、この時点では影響なし）
echo "$SECRET" | npx wrangler pages secret put EMAIL_WORKER_SECRET --project-name cf-se-blog
# 2. Worker に設定してデプロイ
echo "$SECRET" | npx wrangler secret put EMAIL_WORKER_SECRET --config workers/email-worker/wrangler.toml
npx wrangler deploy --config workers/email-worker/wrangler.toml
```

---

## 運用コマンド集

```bash
# リモート D1 にクエリ実行
wrangler d1 execute cf-se-blog-db --remote --command="SELECT COUNT(*) FROM posts;"

# ログ確認
wrangler pages deployment tail --project-name=cf-se-blog

# 手動デプロイ（GitHub 連携が不要な場合）
npm run deploy

# KV キャッシュクリア（全件）
wrangler kv key list --namespace-id=<PAGE_CACHE_ID> | jq -r '.[].name' | xargs -I{} wrangler kv key delete {} --namespace-id=<PAGE_CACHE_ID>
```

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| 500 エラー | Bindings 未設定 | Dashboard → Pages → Settings → Functions → Bindings を確認 |
| `AI binding not found` | Workers AI 未有効化 | Dashboard → AI → Workers AI を有効化 |
| Vectorize エラー | インデックス未作成 | `wrangler vectorize create` を再実行 |
| セッションが切れる | KV SESSIONS 未バインド | Bindings で SESSIONS KV を追加 |
| ビルドエラー | Node バージョン | Pages → Settings → Environment variables に `NODE_VERSION=20` を追加 |
