# Cloudflare SE Engineer Blog Platform

**ドメイン:** `cf-se-blog-jp.dev`  
**100% Cloudflare Stack** — Pages, D1, R2, KV, Workers AI, Vectorize, Access

Cloudflare の技術を活用して、より良いインターネット環境の構築に貢献するためのフルスタックブログプラットフォーム。  
ユーザーが自らの作品とも言えるアプリケーションやセキュリティ構築の実践例を、Cloudflare の技術者とエンゲージしながら世の中に簡単に公表できる場を提供。  
プラットフォーム自体が Cloudflare のケーパビリティのショーケースです。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フレームワーク | Remix v2 (Vite) on Cloudflare Pages |
| データベース | Cloudflare D1 (SQLite at edge) + Drizzle ORM |
| ストレージ | Cloudflare R2 (画像・メディア) |
| AI | Workers AI — Meta Llama 3.1 70B Instruct |
| ベクトル検索 | Cloudflare Vectorize (関連記事推薦) |
| 認証 | Cloudflare Access (Zero Trust / IdP 連携) |
| セッション・キャッシュ | Cloudflare KV |
| CSS | Tailwind CSS v3 + Typography plugin |
| Markdown | marked + DOMPurify |
| 言語 | TypeScript 5.7 |

## 主な機能

- **AI ドラフト生成** — テンプレート入力（メモ書きレベル）から企業導入事例スタイルのブログ記事を自動生成
- **6種類のテンプレート** — Zero Trust、Workers/Pages、Performance、Security、Network、Tips & Tricks
- **下書き → 公開ワークフロー** — 下書き保存・編集後にワンクリックで公開
- **画像挿入** — R2 へのアップロード + Markdown 内任意箇所に配置
- **関連記事推薦** — Vectorize による類似記事の自動提案
- **AI チャット Q&A** — 記事内容に基づく質問応答ウィジェット
- **RSS / SEO** — OGP・Twitter Card・RSS フィード自動生成

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
