-- Migration: 0003_seed_templates
-- Description: Seed blog templates with structured input fields and AI prompts

INSERT OR IGNORE INTO templates (id, name, description, category_id, difficulty, estimated_minutes, input_fields_json, ai_prompt_template, sort_order) VALUES

-- Application Services
('t-app-01', 'Application Services 設定ガイド',
 'WAF, CDN, Bot Management, Load Balancing などの設定手順を解説する記事テンプレート',
 'cat-app', 'beginner', 30,
 '{"fields":[{"id":"service_name","label":"扱う Cloudflare サービス","type":"text","required":true,"placeholder":"例: WAF, CDN, Load Balancing"},{"id":"use_case","label":"目的・ユースケース","type":"textarea","required":true,"placeholder":"何を実現するか（例: WordPress を WAF で保護する）"},{"id":"target_audience","label":"対象読者","type":"text","required":true,"placeholder":"例: インフラエンジニア初心者"},{"id":"steps","label":"設定手順（箇条書き）","type":"textarea","required":true,"placeholder":"・ゾーン追加\n・WAF ルール設定\n・動作確認"},{"id":"services_used","label":"使用する Cloudflare サービス","type":"tag_select","required":true,"options":["WAF","CDN","Bot Management","Load Balancing","Cache Rules","Page Rules","Transform Rules","SSL/TLS"]},{"id":"prerequisites","label":"前提条件・プラン","type":"text","required":false,"placeholder":"例: Pro プラン以上"},{"id":"troubleshooting","label":"トラブルシューティング","type":"textarea","required":false,"placeholder":"よくある問題と解決策"},{"id":"notes","label":"補足・特記事項","type":"textarea","required":false},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}',
 'あなたは Cloudflare の技術ブログライターです。以下の入力情報をもとに、Application Services の設定ガイド記事を Markdown 形式で生成してください。

## 記事構成
1. はじめに（この設定で何が実現できるか）
2. 構成概要
3. 使用サービス一覧（表形式）
4. 前提条件
5. 設定手順（Step 形式、スクリーンショットの位置を示す）
6. 動作確認
7. トラブルシューティング
8. まとめ
9. 参考リンク

## ルール
- 日本語で書くこと
- エンジニアリング視点で実践的な内容にすること
- 各ステップは具体的な操作手順を含めること
- コードブロックや設定例は言語指定付きで記述すること
- 画像が提供されている場合は適切な位置に配置すること',
 1),

-- Zero Trust
('t-zt-01', 'Zero Trust 導入ステップバイステップ',
 'Cloudflare Zero Trust の導入手順と設計判断を解説する記事テンプレート',
 'cat-zt', 'beginner', 40,
 '{"fields":[{"id":"component","label":"ZT コンポーネント","type":"text","required":true,"placeholder":"例: Access, Gateway, Tunnel, CASB"},{"id":"challenge","label":"組織の課題・導入目的","type":"textarea","required":true,"placeholder":"従来のセキュリティ課題と ZT で解決したいこと"},{"id":"steps","label":"導入手順（箇条書き）","type":"textarea","required":true,"placeholder":"Phase ごとのざっくりした手順"},{"id":"idp","label":"使用する IdP","type":"select","required":true,"options":["Okta","Azure AD","Google Workspace","OneLogin","その他"]},{"id":"target_audience","label":"対象読者","type":"text","required":true,"placeholder":"例: IT 管理者、セキュリティエンジニア"},{"id":"before_after","label":"Before/After の違い","type":"textarea","required":false,"placeholder":"従来構成との比較ポイント"},{"id":"policy_example","label":"ポリシー例","type":"textarea","required":false},{"id":"results","label":"導入効果（数値）","type":"textarea","required":false,"placeholder":"定量的な改善指標"},{"id":"ops_tips","label":"運用のポイント","type":"textarea","required":false},{"id":"notes","label":"補足・特記事項","type":"textarea","required":false},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}',
 'あなたは Cloudflare Zero Trust のエキスパートライターです。以下の入力情報をもとに、Zero Trust 導入のステップバイステップ記事を Markdown 形式で生成してください。

## 記事構成
1. はじめに（背景・ゴール）
2. Zero Trust アーキテクチャ概要（Before/After）
3. 前提条件
4. 導入手順（Phase 形式）
5. ポリシー設定例
6. 動作確認
7. 運用ポイント
8. 導入効果
9. まとめ
10. 参考リンク

## ルール
- 日本語で書くこと
- 設計判断の「なぜ」を必ず説明すること
- セキュリティのベストプラクティスに言及すること
- 画像が提供されている場合は適切な位置に配置すること',
 2),

-- Developer Platform
('t-dev-01', 'Workers / Pages チュートリアル',
 'Cloudflare Workers または Pages を使ったアプリ構築のチュートリアル記事テンプレート',
 'cat-dev', 'beginner', 30,
 '{"fields":[{"id":"app_name","label":"作るもの（アプリ名・概要）","type":"text","required":true,"placeholder":"例: リアルタイムチャットアプリ"},{"id":"why_cloudflare","label":"なぜ Cloudflare を選んだか","type":"textarea","required":true,"placeholder":"Workers/Pages の利点を簡潔に"},{"id":"tech_stack","label":"使用する技術スタック","type":"tag_select","required":true,"options":["Workers","Pages","D1","KV","R2","Durable Objects","Queues","Workers AI","Vectorize","Hyperdrive"]},{"id":"steps","label":"実装手順（箇条書き）","type":"textarea","required":true,"placeholder":"・プロジェクト作成\n・DB スキーマ設計\n・API 実装\n・フロント実装\n・デプロイ"},{"id":"target_audience","label":"対象読者","type":"text","required":true,"placeholder":"例: Workers 初心者〜中級者"},{"id":"framework","label":"フレームワーク","type":"select","required":false,"options":["Remix","Next.js","Hono","Astro","SvelteKit","None"]},{"id":"code_snippets","label":"コードスニペット","type":"code","required":false,"placeholder":"記事に含めたい主要なコード"},{"id":"performance","label":"パフォーマンス数値","type":"textarea","required":false,"placeholder":"レイテンシ、コスト等の実測値"},{"id":"notes","label":"補足・特記事項","type":"textarea","required":false,"placeholder":"ハマりポイント、Tips 等"},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}',
 'あなたは Cloudflare Developer Platform のエキスパートライターです。以下の入力情報をもとに、Workers/Pages チュートリアル記事を Markdown 形式で生成してください。

## 記事構成
1. はじめに（完成イメージの説明）
2. 技術スタック一覧（表形式）
3. 前提条件
4. プロジェクトセットアップ
5. 実装（機能ごとにセクション分け、コードブロック付き）
6. ローカル開発 & テスト
7. デプロイ
8. パフォーマンス & コスト（数値があれば表形式）
9. まとめ（学び、ソースコード）
10. 参考リンク

## ルール
- 日本語で書くこと
- 各セクションは十分な説明を含めること
- コードブロックには言語指定とコメントを付けること
- 実践的で読者がすぐに試せる内容にすること
- 画像が提供されている場合は適切な位置に配置すること',
 3),

-- Developer Platform (AI)
('t-dev-03', 'Workers AI / AI Gateway 活用',
 'Workers AI や AI Gateway を使った AI アプリケーション構築の事例テンプレート',
 'cat-dev', 'intermediate', 45,
 '{"fields":[{"id":"use_case","label":"AI ユースケース","type":"text","required":true,"placeholder":"例: 社内文書の要約、チャットボット"},{"id":"challenge","label":"解決したい課題","type":"textarea","required":true,"placeholder":"ビジネス課題の説明"},{"id":"models","label":"使用モデル","type":"tag_select","required":true,"options":["llama-3.1-70b-instruct","llama-3.1-8b-instruct","bge-large-en-v1.5","bge-base-en-v1.5","stable-diffusion-xl"]},{"id":"steps","label":"実装手順（箇条書き）","type":"textarea","required":true,"placeholder":"プロンプト設計〜デプロイまでの流れ"},{"id":"use_rag","label":"RAG を使用するか","type":"select","required":false,"options":["はい (Vectorize 連携)","いいえ"]},{"id":"ai_gateway_config","label":"AI Gateway 設定","type":"textarea","required":false,"placeholder":"Rate Limiting, Caching, Logging の設定"},{"id":"prompt_example","label":"プロンプト例","type":"code","required":false,"placeholder":"実際に使ったプロンプト"},{"id":"evaluation","label":"評価指標・チューニング結果","type":"textarea","required":false,"placeholder":"精度、レイテンシ、コスト等"},{"id":"notes","label":"補足・特記事項","type":"textarea","required":false},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}',
 'あなたは Cloudflare Workers AI と AI Gateway のエキスパートライターです。以下の入力情報をもとに、AI 活用事例の記事を Markdown 形式で生成してください。

## 記事構成
1. はじめに（課題 → 解決策）
2. アーキテクチャ概要
3. 使用モデル一覧（表形式：モデル名、用途、理由）
4. AI Gateway 設定
5. 実装（プロンプト設計 → API 呼び出し → RAG パイプライン）
6. 評価 & チューニング
7. コスト分析
8. まとめ
9. 参考リンク

## ルール
- 日本語で書くこと
- プロンプトエンジニアリングの判断理由を説明すること
- コスト意識を持った設計を推奨すること
- 画像が提供されている場合は適切な位置に配置すること',
 4),

-- Network Services
('t-net-01', 'Network Services 構成ガイド',
 'Magic Transit, Magic WAN, Spectrum などの構成・設計事例テンプレート',
 'cat-net', 'intermediate', 45,
 '{"fields":[{"id":"service_name","label":"対象サービス","type":"text","required":true,"placeholder":"例: Magic Transit, Magic WAN, Spectrum"},{"id":"challenge","label":"ネットワーク課題","type":"textarea","required":true,"placeholder":"既存のネットワーク課題"},{"id":"architecture","label":"構成概要（箇条書き）","type":"textarea","required":true,"placeholder":"接続方式、ルーティング、冗長化など"},{"id":"steps","label":"設定手順（箇条書き）","type":"textarea","required":true,"placeholder":"オンボーディング〜本番切替までの流れ"},{"id":"target_audience","label":"対象読者","type":"text","required":true,"placeholder":"例: ネットワークエンジニア"},{"id":"performance","label":"パフォーマンス・可用性データ","type":"textarea","required":false,"placeholder":"レイテンシ改善、DDoS 防御実績等"},{"id":"notes","label":"補足・特記事項","type":"textarea","required":false},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}',
 'あなたは Cloudflare Network Services のエキスパートライターです。以下の入力情報をもとに、ネットワーク構成ガイド記事を Markdown 形式で生成してください。

## 記事構成
1. はじめに（ネットワーク課題と解決策）
2. アーキテクチャ概要（構成図の位置を示す）
3. 前提条件
4. 設定手順（Phase 形式）
5. ルーティング・トラフィック制御
6. パフォーマンス & 可用性
7. 運用・監視ポイント
8. まとめ
9. 参考リンク

## ルール
- 日本語で書くこと
- ネットワーク設計の判断理由を説明すること
- 数値データがある場合は表形式で見やすくすること
- 画像が提供されている場合は適切な位置に配置すること',
 5),

-- General: Tips
('t-gen-01', 'Cloudflare Tips & Tricks',
 '短めの Tips 記事を手軽に書けるテンプレート',
 'cat-other', 'beginner', 15,
 '{"fields":[{"id":"topic","label":"Tip のトピック","type":"text","required":true,"placeholder":"例: Cache Rules で特定パスをキャッシュ除外"},{"id":"tldr","label":"一言まとめ (TL;DR)","type":"text","required":true,"placeholder":"結論を 1-2 文で"},{"id":"background","label":"背景・課題","type":"textarea","required":true,"placeholder":"なぜこの Tip が必要か"},{"id":"solution","label":"解決方法（箇条書き）","type":"textarea","required":true,"placeholder":"ダッシュボード操作 or API/CLI コマンド"},{"id":"caveats","label":"注意点","type":"textarea","required":false},{"id":"notes","label":"補足","type":"textarea","required":false},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}',
 'あなたは Cloudflare の実践的な Tips を書くライターです。以下の入力情報をもとに、短くて実用的な Tips 記事を Markdown 形式で生成してください。

## 記事構成
1. TL;DR（結論を最初に）
2. 背景・課題
3. 解決方法（ダッシュボード操作 / API / CLI）
4. 注意点
5. 参考リンク

## ルール
- 日本語で書くこと
- 簡潔で実用的にすること（目安: 800〜1500 文字）
- コードや設定例は具体的に記述すること
- 画像が提供されている場合は適切な位置に配置すること',
 6);
