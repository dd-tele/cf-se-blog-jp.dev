# Cloudflare SE Engineer Blog Platform

**ドメイン:** `cf-se-blog-jp.dev`  
**100% Cloudflare Stack** — Pages, D1, R2, KV, Workers AI, Vectorize, Access, Email Workers, Email Routing

Cloudflare の技術を活用して、より良いインターネット環境の構築に貢献するためのフルスタックブログプラットフォーム。  
ユーザーが自らの作品とも言えるアプリケーションやセキュリティ構築の実践例を、Cloudflare の技術者とエンゲージしながら世の中に簡単に公表できる場を提供。  
プラットフォーム自体が Cloudflare のケーパビリティのショーケースです。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フレームワーク | Remix v2 (Vite) + **Hono** — ハイブリッドアーキテクチャ on Cloudflare Pages |
| API レイヤー | **Hono** — 7 ルートモジュール / 約 15 エンドポイント / streamSSE / 認証ミドルウェア |
| データベース | Cloudflare D1 (SQLite at edge) + Drizzle ORM |
| ストレージ | Cloudflare R2 (画像・メディア) |
| AI (生成) | Workers AI — Meta Llama 3.3 70B Instruct (fp8-fast) / temperature 0.3 |
| AI (モデレーション) | Workers AI — Meta Llama Guard 3 8B |
| AI (Embedding) | Workers AI — bge-base-en-v1.5 |
| AI Gateway | ガードレール / ログ / レイテンシ分析 / キャッシュ |
| ベクトル検索 | Cloudflare Vectorize (セマンティック検索 + 関連記事推薦 + RAG) |
| 認証 | Cloudflare Access (Zero Trust / Google SSO) + RBAC (admin/se/ae/user) |
| Bot 保護 | Cloudflare Turnstile (invisible CAPTCHA) |
| API 保護 | Cloudflare API Shield (OpenAPI 3.0 スキーマバリデーション) |
| セッション・キャッシュ | Cloudflare KV |
| メール通知 | Cloudflare Email Workers + Email Routing |
| WAF | Cloudflare WAF (OWASP Top 10) + Bot Management |
| CSS | Tailwind CSS v3 + Typography plugin |
| Markdown | marked + DOMPurify |
| 言語 | TypeScript 5.7 |

## 主な機能

- **AI ドラフト生成** — テンプレート入力（メモ書きレベル）から企業導入事例スタイルのブログ記事を自動生成
- **6種類のテンプレート** — Zero Trust、Workers/Pages、Performance、Security、Network、Tips & Tricks
- **下書き → 公開ワークフロー** — 下書き保存・編集後にワンクリックで公開
- **AI アシスト修正** — 編集中に思い出した補足情報や修正指示を「追加エッセンス」として入力すると、AI が本文に自然に組み込む。修正案プレビュー → 適用/破棄の 2 ステップで安全に反映
- **画像挿入** — R2 へのアップロード + Markdown 内任意箇所に配置
- **関連記事推薦** — Vectorize による類似記事の自動提案
- **AI チャット Q&A** — 記事ページのフローティングウィジェット。RAG (記事本文 8K + Vectorize topK:3) + SSE ストリーミング + 多層防御 (Turnstile → スパム検出 → KV レート制限 → Llama Guard モデレーション → AI Gateway ガードレール)。SE/Admin 手動回答にも対応。24h TTL 自動クリーンアップ
- **RSS / SEO** — OGP・Twitter Card・RSS フィード自動生成
- **投稿者申請システム** — 公開申請フォーム → メール検証 → 管理者承認 → 通知メール自動送信
- **ユーザープロフィール** — ニックネーム・所属・専門分野等の管理
- **著者公開プロフィール** — `/authors/$id` で著者情報と投稿記事一覧を表示、全ページからリンク
- **アバターアップロード & クロップ** — Canvas ベースの円形クロップ、ドラッグ & ズームで顔位置調整
- **パーソナル API キー** — Bearer トークン認証で外部 AI ツールから Template API を呼び出し
- **Access 再認証レジリエンス** — JWT 検証失敗時の自動リトライ、鍵ローテーション対応

## Hono — API レイヤー

Remix が SSR / UI / ルーティングを担当し、**Hono** が API ロジック・ストリーミング・ミドルウェアを担当するハイブリッドアーキテクチャ。

| モジュール | エンドポイント | 主な機能 |
|---|---|---|
| `chat.ts` | `GET/POST /api/v1/chat` | AI チャット Q&A (streamSSE) |
| `ai.ts` | `POST /api/v1/ai/*` | タグ提案・文章改善・トレンドレポート |
| `templates.ts` | `GET/POST /api/v1/templates/*` | テンプレート一覧・詳細・AI ドラフト生成 |
| `api-keys.ts` | `GET/POST/DELETE /api/v1/api-keys` | パーソナル API キー管理 |
| `ai-guide.ts` | `GET /api/v1/ai-guide` | 外部 AI ツール向け統合ガイド |
| `upload.ts` | `POST /api/upload-image` | R2 画像アップロード |
| `r2.ts` | `GET /r2/*` | R2 オブジェクト配信 |

**主な Hono 機能**: `streamSSE()` (SSE ストリーミング), `cors()` / `logger()` (グローバルミドルウェア), `HonoEnv` 型安全バインディング, `optionalAuth` / `requireAuth` / `requireRole` 認証チェーン

## AI チャットボット — 技術詳細

### 精度チューニング
- **3 段階システムプロンプト**: ① 記事コンテキスト優先 → ② Cloudflare 全般知識で補足 → ③ 公式ドキュメント誘導
- **RAG**: 記事本文 8,000 字 + Vectorize セマンティック検索 (topK:3) で関連コンテキスト付加
- **モデル**: Llama 3.3 70B (FP8 量子化・高速推論), temperature 0.3, max_tokens 2,048
- **会話履歴**: 直近 10 件を保持して文脈維持

### UI チューニング
- 自動リサイズ `<textarea>` (max-height 6rem) + IME 対応 (日本語入力中の誤送信防止)
- SSE ストリーミング表示 + タイピングドットアニメーション + カーソルパルス
- 3 つのサジェスト質問ボタン（空状態時）
- SE / Admin 手動回答の視覚的差別化（緑ラベル）

### 多層セキュリティ
| レイヤー | 技術 | 詳細 |
|---|---|---|
| 1 | Turnstile | invisible CAPTCHA — Bot 到達前にブロック |
| 2 | 入力バリデーション | 1,000 字制限 + 正規表現スパム検出 |
| 3 | KV レート制限 | 10 msg/分/IP |
| 4 | Llama Guard 3 8B | コンテンツモデレーション (Fail-open) |
| 5 | AI Gateway | ガードレール + ログ + レイテンシ分析 |
| 6 | 監査ログ | フラグ付きメッセージを D1 に証跡保存 |
| 7 | 24h TTL | スレッド自動削除でストレージ節約 |

## ドキュメント構成

| ドキュメント | 内容 |
|---|---|
| [01-architecture-overview.md](docs/01-architecture-overview.md) | システム全体アーキテクチャ |
| [02-cloudflare-services-map.md](docs/02-cloudflare-services-map.md) | 利用 Cloudflare サービス一覧と役割 |
| [03-data-model.md](docs/03-data-model.md) | データモデル設計 (D1 スキーマ) |
| [04-admin-ui-design.md](docs/04-admin-ui-design.md) | 管理者画面設計 |
| [05-user-ui-design.md](docs/05-user-ui-design.md) | ユーザー UI 設計 |
| [06-blog-templates.md](docs/06-blog-templates.md) | ブログテンプレート設計 |
| [07-ai-summary-agent.md](docs/07-ai-summary-agent.md) | AI サマリーエージェント設計 |
| [08-ai-chat-agent.md](docs/08-ai-chat-agent.md) | AI チャットエージェント設計 |
| [09-security-design.md](docs/09-security-design.md) | セキュリティ設計 |
| [10-implementation-roadmap.md](docs/10-implementation-roadmap.md) | 実装ロードマップ |
| [DEPLOY.md](docs/DEPLOY.md) | 本番デプロイ手順書 |

## クイックスタート

```bash
# 依存パッケージインストール
npm install

# ローカル D1 マイグレーション
wrangler d1 migrations apply cf-se-blog-db --local

# 開発サーバー起動
npm run dev

# ビルド & デプロイ
npm run build
wrangler pages deploy ./build/client --project-name=cf-se-blog
```

詳細なデプロイ手順は [DEPLOY.md](docs/DEPLOY.md) を参照してください。

## ライセンス

Internal Use Only - Cloudflare Japan SE Team
