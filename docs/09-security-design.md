# 09 - セキュリティ設計

> **実装状況:** Cloudflare Access (Zero Trust) による認証、WAF Managed Rules、DDoS 保護、DNSSEC/TLS は有効。Turnstile、Bot Management、カスタム Rate Limiting、AI Gateway、Llama Guard によるコンテンツモデレーションは未実装（将来拡張として設計）。アプリ層では DOMPurify による XSS 対策を実施済み。

## 1. セキュリティ設計方針

**原則:** Cloudflare のセキュリティサービスをフル活用し、プラットフォーム自体が Cloudflare セキュリティのショーケースとなる。

**防御の深層化 (Defense in Depth):**
- エッジ層（Cloudflare Network — DDoS, WAF, TLS）
- アプリケーション層（Workers / Pages — DOMPurify, CSRF 対策）
- データ層（D1 / R2 / KV）
- 認証層（Cloudflare Access — Zero Trust / JWT）

---

## 2. エッジセキュリティ

### 2.1 DNS & TLS

| 項目 | 設定 |
|---|---|
| **DNSSEC** | 有効 |
| **TLS** | 1.3 Only (Minimum TLS Version: 1.3) |
| **HSTS** | `max-age=31536000; includeSubDomains; preload` |
| **Certificate** | Cloudflare Universal SSL (Edge) + Origin CA (Origin) |
| **Always Use HTTPS** | 有効 |
| **Opportunistic Encryption** | 有効 |

### 2.2 DDoS Protection

| レイヤー | 保護 |
|---|---|
| **L3/L4** | Cloudflare の自動 DDoS 軽減（常時有効） |
| **L7** | HTTP DDoS Managed Rules（自動） |
| **カスタム** | DDoS Override Rules（感度調整、必要時） |

### 2.3 WAF (Web Application Firewall)

**Managed Rulesets:**

| ルールセット | 設定 | 目的 |
|---|---|---|
| Cloudflare Managed Ruleset | Block | 一般的な脆弱性攻撃防御 |
| Cloudflare OWASP Core Ruleset | Block (Anomaly Score > 60) | OWASP Top 10 対策 |
| Cloudflare Leaked Credentials Detection | Log | 漏洩クレデンシャル検出 |
| Cloudflare Free Managed Ruleset | Block | 基本的な攻撃パターン |

**Custom Rules (WAF Custom Rules):**

```
Rule 1: ブログ投稿 XSS 防御強化
  When: (http.request.uri.path contains "/api/v1/posts" AND http.request.method eq "POST")
    AND (http.request.body contains "<script" OR http.request.body contains "javascript:")
  Action: Block

Rule 2: 管理者パス保護
  When: (http.request.uri.path contains "/admin")
    AND NOT (cf.access.authenticated eq true)
  Action: Block

Rule 3: API エンドポイント保護
  When: (http.request.uri.path contains "/api/")
    AND (http.request.method eq "POST")
    AND (cf.bot_management.score lt 30)
  Action: Managed Challenge

Rule 4: ファイルアップロード制限
  When: (http.request.uri.path contains "/api/v1/upload")
    AND (http.request.body.size gt 10485760)  # 10MB
  Action: Block

Rule 5: 不正な User-Agent ブロック
  When: (http.request.uri.path contains "/api/")
    AND (NOT http.user_agent contains "Mozilla" 
     AND NOT http.user_agent contains "Chrome"
     AND NOT http.user_agent contains "Safari")
    AND (http.request.method ne "GET")
  Action: Managed Challenge
```

### 2.4 Rate Limiting

**Advanced Rate Limiting Rules:**

```
Rule 1: API 全体レート制限
  When: http.request.uri.path matches "/api/*"
  Rate: 100 requests per 1 minute per IP
  Action: Block (60 seconds)

Rule 2: チャット API レート制限
  When: http.request.uri.path eq "/api/v1/chat"
  Rate: 15 requests per 1 minute per IP
  Action: Block (120 seconds)
  Mitigation Timeout: 120 seconds

Rule 3: ログイン試行制限
  When: http.request.uri.path contains "/auth/login" AND http.request.method eq "POST"
  Rate: 5 requests per 5 minutes per IP
  Action: Managed Challenge

Rule 4: 記事投稿制限
  When: http.request.uri.path eq "/api/v1/posts" AND http.request.method eq "POST"
  Rate: 5 requests per 10 minutes per IP
  Action: Block (300 seconds)

Rule 5: 画像アップロード制限
  When: http.request.uri.path eq "/api/v1/upload"
  Rate: 10 requests per 5 minutes per IP
  Action: Block (300 seconds)
```

### 2.5 Bot Management

| 設定 | 値 |
|---|---|
| **Bot Score < 1** | Block（確実な自動化ツール） |
| **Bot Score 1-29** | Managed Challenge |
| **Bot Score 30-49** | JS Challenge（POST リクエストのみ） |
| **Bot Score ≥ 50** | Allow |
| **Verified Bots** | Allow（Googlebot 等の正当なクローラー） |
| **Static Resources** | Skip（CSS/JS/画像はスキップ） |

### 2.6 Page Shield

- **CSP (Content Security Policy)** 自動生成・監視
- **JavaScript の変更検出** — サプライチェーン攻撃対策
- **接続先監視** — 不正な外部接続の検出

---

## 3. 認証・認可

### 3.1 Cloudflare Access (Zero Trust)

**Access Applications:**

| アプリ名 | ドメイン/パス | ポリシー |
|---|---|---|
| Blog Admin | `blog.cf-se.jp/admin/*` | Cloudflare Email + SE-Admin Group |
| Blog SE Portal | `blog.cf-se.jp/portal/*` (SE機能) | Cloudflare Email + SE-Team Group |
| Blog User Portal | `blog.cf-se.jp/portal/*` | 全認証ユーザー |

**Access Policy 詳細:**

```yaml
# Admin Policy
- name: "Admin Access"
  decision: Allow
  include:
    - email_domain: "cloudflare.com"
  require:
    - access_groups:
        id: "SE-Admin-Group-ID"
  session_duration: "24h"

# SE Policy
- name: "SE Access"
  decision: Allow
  include:
    - email_domain: "cloudflare.com"
  require:
    - access_groups:
        id: "SE-Team-Group-ID"
  session_duration: "24h"

# User Policy (Email/Social Login)
- name: "User Access"
  decision: Allow
  include:
    - login_method:
        - otp   # メールワンタイムパスコード
        - google
        - github
  session_duration: "168h" # 7日間
```

### 3.2 Access JWT 検証（Workers 側）

> **実装状況:** `app/lib/access.server.ts` に実装済み。外部ライブラリ不使用、Web Crypto API のみで RSA-PKCS1-v1_5 署名検証。

**構造化された検証結果型:**

```typescript
// app/lib/access.server.ts
export type VerifyResult =
  | { ok: true; payload: AccessJWTPayload }
  | { ok: false; reason: "expired" | "invalid" | "kid_mismatch"
      | "bad_signature" | "bad_aud" | "bad_iss" | "malformed" };
```

**公開鍵キャッシュ & 自動リフレッシュ:**

```typescript
// 公開鍵をモジュールスコープで 1 時間キャッシュ
// kid が一致しない場合、forceRefresh=true で再取得（鍵ローテーション対応）
async function getPublicKeys(teamDomain: string, forceRefresh = false): Promise<JWK[]> {
  if (!forceRefresh && cachedKeys && Date.now() - cachedKeys.fetchedAt < KEY_CACHE_TTL) {
    return cachedKeys.keys;
  }
  const certsUrl = `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`;
  const res = await fetch(certsUrl);
  const data = await res.json();
  cachedKeys = { keys: data.keys, fetchedAt: Date.now() };
  return data.keys;
}
```

**OTP 再認証レジリエンス（`app/routes/auth.login.tsx` loader）:**

```typescript
// JWT 検証失敗時の自動リトライ（最大2回）
// expired / kid_mismatch / bad_signature の場合、リダイレクトで Access が JWT を更新する機会を作る
if (retryCount < 2 && ["expired", "kid_mismatch", "bad_signature"].includes(result.reason)) {
  return redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}&retry=${retryCount + 1}`);
}
// リトライ上限後はエラーページに 3 秒カウントダウン自動リトライを表示
```

**ロール判定:**

```typescript
// app/lib/access.server.ts — 環境変数ベースのロール判定
export function resolveRole(email: string, adminEmails?: string, seDomains?: string): Role {
  if (adminEmails?.split(",").map(e => e.trim()).includes(email)) return "admin";
  const domain = email.split("@")[1];
  if (seDomains?.split(",").map(d => d.trim()).includes(domain)) return "se";
  return "user";
}
```

### 3.3 投稿者申請・メール検証フロー

**投稿者申請フロー（`/apply`）:**
1. 未認証ユーザーが `/apply` から申請フォームを送信（メールアドレス・表示名・所属等）
2. D1 に申請レコード作成 (`access_requests` テーブル)
3. Email Routing API でメールアドレスを宛先登録 → Cloudflare が検証メール送信
4. ユーザーが検証リンクをクリック（アドレス検証完了）
5. Admin が `/admin/access-requests` で承認 → 以下が自動実行:
   - D1 にユーザーレコード作成
   - Cloudflare Access ポリシーにメールアドレス追加（API 経由）
   - Email Worker 経由で承認通知メール送信（検証済みアドレスのみ）

**ユーザー削除フロー:**
1. D1 からユーザー・関連データを削除（記事は `author_name_snapshot` で保持）
2. Cloudflare Access ポリシーからメールを削除（API 経由）
3. Email Routing の宛先アドレスを削除（API 経由）

**関連ファイル:**
- `app/lib/access-requests.server.ts` — 申請 CRUD、CF Access API、Email Routing API
- `app/lib/email.server.ts` — Email Worker 呼び出し
- `app/routes/apply.tsx` — 申請フォーム
- `app/routes/admin.access-requests.tsx` — 管理者による承認・却下
- `workers/email-worker/` — メール送信用専用 Worker

### 3.4 RBAC ミドルウェア

```typescript
// app/lib/rbac.server.ts

type Permission = 
  | 'post:create' | 'post:edit' | 'post:delete' | 'post:publish' | 'post:review'
  | 'user:manage' | 'user:invite'
  | 'qa:view' | 'qa:reply' | 'qa:moderate'
  | 'template:create' | 'template:manage'
  | 'ai:configure' | 'ai:insights'
  | 'admin:settings' | 'admin:audit';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    'post:create', 'post:edit', 'post:delete', 'post:publish', 'post:review',
    'user:manage', 'user:invite',
    'qa:view', 'qa:reply', 'qa:moderate',
    'template:create', 'template:manage',
    'ai:configure', 'ai:insights',
    'admin:settings', 'admin:audit'
  ],
  se: [
    'post:create', 'post:edit',
    'qa:view', 'qa:reply', 'qa:moderate',
    'template:create',
    'ai:insights'
  ],
  user: [
    'post:create', 'post:edit', // 自分の記事のみ
    'qa:view'
  ]
};

export function hasPermission(role: string, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(role: string, permission: Permission) {
  if (!hasPermission(role, permission)) {
    throw new Response('Forbidden', { status: 403 });
  }
}
```

---

## 4. データセキュリティ

### 4.1 入力バリデーション & サニタイゼーション

```typescript
// app/lib/sanitize.server.ts
import DOMPurify from 'isomorphic-dompurify';

// ブログ記事コンテンツのサニタイズ
export function sanitizePostContent(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'strong', 'em', 'code', 'pre', 'blockquote',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class',
      'target', 'rel', 'width', 'height'
    ],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'], // リンクに target="_blank" を許可
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
  });
}

// チャットメッセージのサニタイズ（プレーンテキストのみ）
export function sanitizeChatMessage(text: string): string {
  return text
    .replace(/[<>]/g, '') // HTML タグ除去
    .trim()
    .substring(0, 1000); // 最大1000文字
}

// SQL インジェクション対策: D1 のバインドパラメータを常に使用
// ※ Drizzle ORM 使用時は自動的にパラメータ化される
```

### 4.2 R2 アップロードセキュリティ

```typescript
// app/lib/upload.server.ts

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function handleImageUpload(
  request: Request,
  env: Env,
  userId: string
): Promise<{ url: string }> {
  const formData = await request.formData();
  const file = formData.get('image') as File;

  // 1. ファイルサイズチェック
  if (file.size > MAX_FILE_SIZE) {
    throw new Response('File too large', { status: 413 });
  }

  // 2. MIME タイプチェック
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Response('Invalid file type', { status: 415 });
  }

  // 3. Magic bytes 検証（実際のファイル内容を確認）
  const buffer = await file.arrayBuffer();
  if (!isValidImageMagicBytes(new Uint8Array(buffer))) {
    throw new Response('Invalid file content', { status: 415 });
  }

  // 4. ファイル名のサニタイズ
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeFilename = `${crypto.randomUUID()}.${ext}`;
  const now = new Date();
  const key = `images/${userId}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${safeFilename}`;

  // 5. R2 にアップロード
  await env.R2_BUCKET.put(key, buffer, {
    httpMetadata: {
      contentType: file.type,
      cacheControl: 'public, max-age=31536000, immutable'
    },
    customMetadata: {
      uploadedBy: userId,
      originalName: file.name.substring(0, 255)
    }
  });

  return { url: `https://media.cf-se.jp/${key}` };
}

function isValidImageMagicBytes(bytes: Uint8Array): boolean {
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true;
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true;
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return true;
  return false;
}
```

### 4.3 セッションセキュリティ

```typescript
// KV セッション管理
const SESSION_TTL = 7 * 24 * 60 * 60; // 7日

interface SessionData {
  userId: string;
  role: 'admin' | 'se' | 'user';
  email: string;
  createdAt: string;
  lastAccessAt: string;
  ip: string;
  userAgent: string;
}

// セッション作成時のセキュリティ設定
export function createSessionCookie(sessionId: string): string {
  return [
    `session=${sessionId}`,
    'Path=/',
    'HttpOnly',           // JavaScript からアクセス不可
    'Secure',             // HTTPS のみ
    'SameSite=Lax',       // CSRF 対策
    `Max-Age=${SESSION_TTL}`,
    'Domain=.cf-se.jp'
  ].join('; ');
}
```

---

## 5. API セキュリティ

### 5.1 CORS 設定

```typescript
// app/lib/cors.server.ts
const ALLOWED_ORIGINS = [
  'https://blog.cf-se.jp',
  'https://*.cf-se-blog.pages.dev' // Preview deployments
];

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') || '';
  const isAllowed = ALLOWED_ORIGINS.some(allowed => {
    if (allowed.includes('*')) {
      const pattern = new RegExp('^' + allowed.replace('*', '.*') + '$');
      return pattern.test(origin);
    }
    return allowed === origin;
  });

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Turnstile-Token',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true'
  };
}
```

### 5.2 セキュリティヘッダー

```typescript
// app/lib/security-headers.server.ts
export const securityHeaders: HeadersInit = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https://media.cf-se.jp https://*.cloudflare.com data:",
    "connect-src 'self' wss://blog.cf-se.jp https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; ')
};
```

### 5.3 API Shield (Schema Validation)

> **実装状況:** OpenAPI 3.0 スキーマ (`api-shield-schema.json`) を Cloudflare API Shield に登録済み。全 API エンドポイントのメソッド・パス・リクエストボディ・パラメータを検証。

**登録スキーマ概要:**

| カテゴリ | エンドポイント数 | 主な保護対象 |
|---|---|---|
| Chat | 2 (GET/POST) | AI チャット Q&A — postId/message バリデーション |
| AI | 3 (POST) | タグ提案・文章改善・トレンドレポート — リクエストボディ検証 |
| Templates | 5 (GET/POST) | テンプレート CRUD + AI 記事生成 — パスパラメータ + ボディ検証 |
| API Keys | 3 (GET/POST/DELETE) | API キー管理 — パスパラメータ + ボディ検証 |
| Upload | 1 (POST) | 画像アップロード — メソッド + パス検証（multipart/form-data はアプリ側で検証） |
| System | 2 (GET) | ヘルスチェック + R2 オブジェクト配信 |

**認証スキーム定義:**

```yaml
securitySchemes:
  bearerAuth:     # Personal API Key (cfbk_ プレフィックス)
    type: http
    scheme: bearer
  cookieAuth:     # セッション Cookie (__cf_blog_session)
    type: apiKey
    in: cookie
  cfAccess:       # Cloudflare Access JWT (CF_Authorization)
    type: apiKey
    in: cookie
```

**注意事項:**
- `multipart/form-data` は API Shield のスキーマバリデーション非対応のため、`/api/upload-image` のボディ検証はアプリ側（MIME タイプ・サイズ制限）で実施
- スキーマファイル: `api-shield-schema.json`（リポジトリルート）

### 5.4 Turnstile（チャット Bot 保護）

> **実装状況:** チャット Q&A の POST `/api/v1/chat` に Cloudflare Turnstile（invisible モード）を統合。ボットによる自動投稿を Workers 到達前に検知・ブロック。環境変数 `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` 設定済み・稼働中。

**フロー:**

```
[ユーザー] ──── チャット送信 ────▶ [Turnstile invisible challenge]
                                         │ token 発行
                                         ▼
[POST /api/v1/chat] ── turnstileToken 付き ──▶ [Workers]
                                                 │
                                         siteverify API で検証
                                                 │
                                     ┌─── OK ───┤─── NG ──┐
                                     ▼           │         ▼
                              通常処理続行        │   403 Forbidden
                                                 │
```

**実装ファイル:**
- `app/lib/turnstile.server.ts` — Turnstile siteverify API 呼び出し
- `app/components/ChatWidget.tsx` — invisible ウィジェット描画 + トークン取得
- `app/api/routes/chat.ts` — POST リクエストでトークン検証（ステップ 0）

**設計方針:**
- **Fail open:** Turnstile の `TURNSTILE_SECRET_KEY` が未設定の場合はスキップ（開発環境対応）
- **Fail open on error:** siteverify API への通信エラー時もスキップ（可用性優先）
- **トークンリセット:** 各メッセージ送信後にウィジェットをリセットし、次回送信用の新しいトークンを自動取得

**環境変数:**
| 変数名 | 用途 | ステータス |
|---|---|---|
| `TURNSTILE_SITE_KEY` | フロントエンドウィジェット用（公開可） | ✅ 設定済 |
| `TURNSTILE_SECRET_KEY` | サーバー側検証用（シークレット） | ✅ 設定済 |

### 5.5 AI Gateway（AI 呼び出しのガードレール）

> **実装状況:** チャット Q&A の Workers AI 呼び出し（コンテンツモデレーション + AI 応答生成）を AI Gateway 経由にルーティング。環境変数 `AI_GATEWAY_ID` 設定済み・稼働中。

**対象:**
| 呼び出し | モデル | 機能 |
|---|---|---|
| `moderateContent()` | `@cf/meta/llama-guard-3-8b` | 不適切コンテンツ検知 |
| `generateChatResponseStream()` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | AI チャット応答生成 |

**AI Gateway で有効化できる機能:**
- **ログ・分析:** 全 AI リクエスト/レスポンスのログ記録、レイテンシ・トークン使用量の可視化
- **レート制限:** Gateway レベルでのリクエスト数制限
- **キャッシュ:** 同一プロンプトのレスポンスキャッシュ
- **ガードレール:** プロンプト/レスポンスのコンテンツフィルタリング

**実装ファイル:**
- `app/lib/chat.server.ts` — `gatewayOptions()` ヘルパーで `ai.run()` の第 3 引数に `{ gateway: { id } }` を付与
- `app/api/routes/chat.ts` — `env.AI_GATEWAY_ID` を取得して `moderateContent` / `generateChatResponseStream` に渡す

**環境変数:**
| 変数名 | 用途 | ステータス |
|---|---|---|
| `AI_GATEWAY_ID` | AI Gateway の ID（未設定時はバイパス） | ✅ 設定済 |

**設定手順（Cloudflare Dashboard）:**
1. AI → AI Gateway → Create Gateway
2. Gateway ID を `AI_GATEWAY_ID` 環境変数に設定
3. Settings → Guardrails でコンテンツフィルタリングルールを設定

---

## 6. 監査 & コンプライアンス

### 6.1 監査ログ

全ての重要な操作を `audit_logs` テーブルに記録:

| アクション | ログ対象 |
|---|---|
| `user.login` | ログイン成功 |
| `user.login_failed` | ログイン失敗 |
| `user.role_change` | ロール変更 |
| `user.delete` | ユーザー削除（Access ポリシー + Email Routing クリーンアップ含む） |
| `access_request.create` | 投稿者申請受付 |
| `access_request.approve` | 投稿者申請承認（ユーザー作成 + Access ポリシー追加 + 通知メール） |
| `access_request.reject` | 投稿者申請却下 |
| `post.create` | 記事作成 |
| `post.publish` | 記事公開 |
| `post.delete` | 記事削除 |
| `post.review` | 記事レビュー |
| `qa.moderate` | Q&A モデレーション |
| `qa.block_user` | ユーザーブロック |
| `admin.settings_change` | 設定変更 |
| `ai.config_change` | AI 設定変更 |

### 6.2 Logpush 設定

```json
{
  "destination": "r2://cf-se-blog-logs/{DATE}",
  "datasets": [
    "http_requests",
    "firewall_events",
    "workers_trace_events",
    "access_requests"
  ],
  "frequency": "high",
  "retention_days": 90
}
```

---

## 7. インシデント対応

### 7.1 自動対応

| 検出 | 自動対応 |
|---|---|
| DDoS 攻撃 | Cloudflare 自動軽減 + Slack 通知 |
| WAF ブロック急増 | Slack 通知 + Under Attack モード検討 |
| Bot 攻撃 | Bot Management 自動ブロック |
| コンテンツモデレーション発動 | メッセージブロック + Admin 通知 |
| AI コスト超過 | AI Gateway アラート + 一時停止 |

### 7.2 エスカレーション

```
Level 1 (自動): WAF/Bot/Rate Limiting による自動ブロック
Level 2 (通知): Slack/Email でAdmin に通知
Level 3 (手動): Admin が管理画面で対応（ユーザーブロック、ルール追加）
Level 4 (緊急): Under Attack モード有効化、一時メンテナンス
```
