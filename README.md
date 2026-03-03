# Cloudflare SE Engineer Blog Platform

**ドメイン:** `cf-se-blog-jp.dev`

Cloudflare の技術を活用して、より良いインターネット環境の構築に貢献するためのフルスタックブログプラットフォーム。  
ユーザーが自らの作品とも言えるアプリケーションやセキュリティ構築の実践例を、Cloudflare の技術者とエンゲージしながら世の中に簡単に公表できる場を提供。  
このブログは 100% Cloudflare サービスで構成され、プラットフォーム自体が Cloudflare のケーパビリティのショーケース。

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

## クイックスタート

```bash
# 開発環境セットアップ（予定）
npm create cloudflare@latest cf-se-blog -- --framework=remix
```

## ライセンス

Internal Use Only - Cloudflare Japan SE Team
