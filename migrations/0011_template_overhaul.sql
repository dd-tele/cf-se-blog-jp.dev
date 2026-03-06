-- Migration: 0011_template_overhaul
-- Description: Major template restructure — add SASE category, template_type column,
--   5 new storytelling fields, rename existing templates, create new templates,
--   restructure Network Services → Magic Transit x Magic Firewall only,
--   move Spectrum/Argo/LB to Application Services

-- ─── 1. Add template_type column ───
ALTER TABLE templates ADD COLUMN template_type TEXT NOT NULL DEFAULT 'case_study';

-- ─── 2. Add SASE category ───
INSERT OR IGNORE INTO categories (id, name, slug, description, icon, sort_order) VALUES
  ('cat-sase', 'SASE', 'sase', 'Magic WAN, CNI, WARP, Tunnel を組み合わせた SASE 構築関連', '', 3);

-- Reorder categories: App(1), ZT(2), SASE(3), Net(4), Dev(5), Email(6), General(7)
UPDATE categories SET sort_order = 1 WHERE id = 'cat-app';
UPDATE categories SET sort_order = 2 WHERE id = 'cat-zt';
UPDATE categories SET sort_order = 4 WHERE id = 'cat-net';
UPDATE categories SET sort_order = 5 WHERE id = 'cat-dev';
UPDATE categories SET sort_order = 6 WHERE id = 'cat-email';
UPDATE categories SET sort_order = 7 WHERE id = 'cat-other';

-- ─── 3. Update existing templates ───

-- t-app-01: Rename + add 5 new fields + add Spectrum/Argo/LB to services + set template_type
UPDATE templates SET
  name = 'Application Services 導入事例',
  description = 'WAF, CDN, Bot Management, Load Balancing, Spectrum, Argo Smart Routing などの導入事例テンプレート',
  template_type = 'case_study',
  input_fields_json = '{"fields":[{"id":"service_name","label":"扱う Cloudflare サービス","type":"text","required":true,"placeholder":"例: WAF, CDN, Load Balancing"},{"id":"use_case","label":"目的・ユースケース","type":"textarea","required":true,"placeholder":"何を実現するか（例: WordPress を WAF で保護する）"},{"id":"services_used","label":"使用する Cloudflare サービス","type":"tag_select","required":true,"options":["WAF","CDN","Bot Management","Load Balancing","Cache Rules","Page Rules","Transform Rules","SSL/TLS","Waiting Room","Log Push","Log Explorer","Spectrum","Version Management","API Protection","Page Shield","Argo Smart Routing","Argo Tiered Cache"]},{"id":"challenges_before_cf","label":"Cloudflare 利用前の課題","type":"textarea","required":false,"placeholder":"Cloudflare 導入前に抱えていた課題や問題点（例: 既存 CDN のキャッシュヒット率が低い、WAF ルールの管理が煩雑）"},{"id":"previous_solution","label":"Cloudflare 採用前のソリューション","type":"textarea","required":false,"placeholder":"例: Akamai CDN + Imperva WAF を利用していた。課題は..."},{"id":"evaluation_events","label":"検討中のできごと","type":"textarea","required":false,"placeholder":"導入検討段階での印象的なエピソードや判断のきっかけ"},{"id":"poc_struggles","label":"PoC 中の苦労","type":"textarea","required":false,"placeholder":"PoC や検証段階で経験した困難や学び"},{"id":"target_audience","label":"対象読者","type":"tag_select","required":true,"options":["インフラエンジニア","セキュリティエンジニア","SRE","Web 開発者","IT 管理者","ネットワークエンジニア"]},{"id":"target_audience_other","label":"対象読者（その他）","type":"text","required":false,"placeholder":"上記にない場合は自由記述"},{"id":"steps","label":"設定手順（箇条書き）","type":"textarea","required":true,"placeholder":"・ゾーン追加\n・WAF ルール設定\n・動作確認"},{"id":"prerequisites","label":"前提条件・プラン","type":"text","required":false,"placeholder":"例: Pro プラン以上"},{"id":"troubleshooting","label":"トラブルシューティング","type":"textarea","required":false,"placeholder":"よくある問題と解決策"},{"id":"post_deployment_challenges","label":"導入後の課題やネクストチャレンジ","type":"textarea","required":false,"placeholder":"導入後に見えてきた新たな課題や改善ポイント"},{"id":"next_challenges","label":"次にやってみたいこと","type":"textarea","required":false,"placeholder":"今後取り組みたい技術やプロジェクト"},{"id":"notes","label":"補足・特記事項","type":"textarea","required":false},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}'
WHERE id = 't-app-01';

-- t-zt-01: Rename + add 5 new fields + set template_type
UPDATE templates SET
  name = 'Zero Trust 導入事例',
  description = 'Cloudflare Zero Trust (Access, Gateway, CASB, Browser Isolation) の導入事例テンプレート',
  template_type = 'case_study',
  input_fields_json = '{"fields":[{"id":"component","label":"ZT コンポーネント","type":"text","required":true,"placeholder":"例: Access, Gateway, Tunnel, CASB"},{"id":"services_used","label":"使用する Cloudflare サービス","type":"tag_select","required":true,"options":["Access","Gateway","Tunnel (cloudflared)","CASB","Browser Isolation","DLP","WARP Client","DEX","Email Security"]},{"id":"challenge","label":"組織の課題・導入目的","type":"textarea","required":true,"placeholder":"従来のセキュリティ課題と ZT で解決したいこと"},{"id":"challenges_before_cf","label":"Cloudflare 利用前の課題","type":"textarea","required":false,"placeholder":"Zero Trust 導入前のセキュリティ課題（例: VPN の同時接続上限、リモートワーク対応の遅れ）"},{"id":"previous_solution","label":"Cloudflare 採用前の SSE / SASE ソリューション","type":"textarea","required":false,"placeholder":"例: Zscaler ZIA + Palo Alto Prisma Access を利用。課題は..."},{"id":"evaluation_events","label":"検討中のできごと","type":"textarea","required":false,"placeholder":"導入検討段階での印象的なエピソードや判断のきっかけ"},{"id":"poc_struggles","label":"PoC 中の苦労","type":"textarea","required":false,"placeholder":"PoC や検証段階で経験した困難や学び（例: IdP 連携の設定で苦戦）"},{"id":"idp","label":"使用する IdP","type":"select","required":true,"options":["Okta","Azure AD (Entra ID)","Google Workspace","OneLogin","Ping Identity","その他"]},{"id":"target_audience","label":"対象読者","type":"tag_select","required":true,"options":["セキュリティエンジニア","IT 管理者","ネットワークエンジニア","CISO / セキュリティ責任者","SRE","情シス担当者"]},{"id":"target_audience_other","label":"対象読者（その他）","type":"text","required":false,"placeholder":"上記にない場合は自由記述"},{"id":"steps","label":"導入手順（箇条書き）","type":"textarea","required":true,"placeholder":"Phase ごとのざっくりした手順"},{"id":"before_after","label":"Before/After の違い","type":"textarea","required":false,"placeholder":"従来構成との比較ポイント"},{"id":"policy_example","label":"ポリシー例","type":"textarea","required":false},{"id":"results","label":"導入効果（数値）","type":"textarea","required":false,"placeholder":"定量的な改善指標"},{"id":"ops_tips","label":"運用のポイント","type":"textarea","required":false},{"id":"post_deployment_challenges","label":"導入後の課題やネクストチャレンジ","type":"textarea","required":false,"placeholder":"導入後に見えてきた新たな課題や改善ポイント"},{"id":"next_challenges","label":"次にやってみたいこと","type":"textarea","required":false,"placeholder":"今後取り組みたい技術やプロジェクト"},{"id":"notes","label":"補足・特記事項","type":"textarea","required":false},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}'
WHERE id = 't-zt-01';

-- t-dev-01: Rename + add 5 new fields + set template_type
UPDATE templates SET
  name = 'Developer Platform 導入事例',
  description = 'Workers, Pages, D1, R2 等を使ったアプリ構築の導入事例テンプレート',
  template_type = 'case_study',
  input_fields_json = '{"fields":[{"id":"app_name","label":"作るもの（アプリ名・概要）","type":"text","required":true,"placeholder":"例: リアルタイムチャットアプリ"},{"id":"why_cloudflare","label":"なぜ Cloudflare を選んだか","type":"textarea","required":true,"placeholder":"Workers/Pages の利点を簡潔に"},{"id":"tech_stack","label":"使用する技術スタック","type":"tag_select","required":true,"options":["Workers","Pages","D1","KV","R2","Durable Objects","Queues","Workers AI","Vectorize","Hyperdrive","Browser Rendering","Constellation"]},{"id":"challenges_before_cf","label":"Cloudflare 利用前の課題","type":"textarea","required":false,"placeholder":"以前の開発環境やインフラの課題（例: AWS Lambda のコールドスタートが問題）"},{"id":"evaluation_events","label":"検討中のできごと","type":"textarea","required":false,"placeholder":"導入検討段階での印象的なエピソードや判断のきっかけ"},{"id":"poc_struggles","label":"PoC 中の苦労","type":"textarea","required":false,"placeholder":"PoC や検証段階で経験した困難や学び"},{"id":"target_audience","label":"対象読者","type":"tag_select","required":true,"options":["フルスタックエンジニア","バックエンドエンジニア","フロントエンドエンジニア","SRE","インフラエンジニア"]},{"id":"target_audience_other","label":"対象読者（その他）","type":"text","required":false,"placeholder":"上記にない場合は自由記述"},{"id":"framework","label":"フレームワーク","type":"select","required":false,"options":["Remix","Next.js","Hono","Astro","SvelteKit","None"]},{"id":"steps","label":"実装手順（箇条書き）","type":"textarea","required":true,"placeholder":"・プロジェクト作成\n・DB スキーマ設計\n・API 実装\n・フロント実装\n・デプロイ"},{"id":"code_snippets","label":"コードスニペット","type":"code","required":false,"placeholder":"記事に含めたい主要なコード"},{"id":"performance","label":"パフォーマンス数値","type":"textarea","required":false,"placeholder":"レイテンシ、コスト等の実測値"},{"id":"post_deployment_challenges","label":"導入後の課題やネクストチャレンジ","type":"textarea","required":false,"placeholder":"導入後に見えてきた新たな課題や改善ポイント"},{"id":"next_challenges","label":"次にやってみたいこと","type":"textarea","required":false,"placeholder":"今後取り組みたい技術やプロジェクト"},{"id":"notes","label":"補足・特記事項","type":"textarea","required":false,"placeholder":"ハマりポイント、Tips 等"},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}'
WHERE id = 't-dev-01';

-- t-dev-03: Rename + add 5 new fields + set template_type
UPDATE templates SET
  name = 'Workers AI / AI Gateway 導入事例',
  description = 'Workers AI や AI Gateway を使った AI アプリケーション構築の導入事例テンプレート',
  template_type = 'case_study',
  input_fields_json = '{"fields":[{"id":"use_case","label":"AI ユースケース","type":"text","required":true,"placeholder":"例: 社内文書の要約、チャットボット"},{"id":"challenge","label":"解決したい課題","type":"textarea","required":true,"placeholder":"ビジネス課題の説明"},{"id":"challenges_before_cf","label":"Cloudflare 利用前の課題","type":"textarea","required":false,"placeholder":"AI 導入前の業務課題や以前の AI サービスの問題点"},{"id":"evaluation_events","label":"検討中のできごと","type":"textarea","required":false,"placeholder":"Workers AI を選定するまでの経緯や比較検討のエピソード"},{"id":"poc_struggles","label":"PoC 中の苦労","type":"textarea","required":false,"placeholder":"AI モデルの精度検証やプロンプト調整で苦労した点"},{"id":"models","label":"使用モデル（自由記述）","type":"textarea","required":true,"placeholder":"例:\n・テキスト生成: @cf/meta/llama-3.3-70b-instruct-fp8-fast\n・埋め込み: @cf/baai/bge-large-en-v1.5"},{"id":"integrations","label":"Workers や他システムとの連携","type":"textarea","required":false,"placeholder":"例: Workers から AI Gateway 経由で呼び出し、結果を D1 に保存"},{"id":"target_audience","label":"対象読者","type":"tag_select","required":true,"options":["AI / ML エンジニア","バックエンドエンジニア","フルスタックエンジニア","プロダクトマネージャー","SRE","データサイエンティスト"]},{"id":"target_audience_other","label":"対象読者（その他）","type":"text","required":false,"placeholder":"上記にない場合は自由記述"},{"id":"steps","label":"実装手順（箇条書き）","type":"textarea","required":true,"placeholder":"プロンプト設計〜デプロイまでの流れ"},{"id":"use_rag","label":"RAG を使用するか","type":"select","required":false,"options":["はい (Vectorize 連携)","いいえ"]},{"id":"ai_gateway_config","label":"AI Gateway 設定","type":"textarea","required":false,"placeholder":"Rate Limiting, Caching, Logging の設定"},{"id":"prompt_example","label":"プロンプト例","type":"code","required":false,"placeholder":"実際に使ったプロンプト"},{"id":"evaluation","label":"評価指標・チューニング結果","type":"textarea","required":false,"placeholder":"精度、レイテンシ、コスト等"},{"id":"post_deployment_challenges","label":"導入後の課題やネクストチャレンジ","type":"textarea","required":false,"placeholder":"導入後に見えてきた新たな課題や改善ポイント"},{"id":"next_challenges","label":"次にやってみたいこと","type":"textarea","required":false,"placeholder":"今後取り組みたい技術やプロジェクト"},{"id":"notes","label":"補足・特記事項","type":"textarea","required":false},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}'
WHERE id = 't-dev-03';

-- t-net-01: Rename to Magic Transit x Magic Firewall only + add 5 new fields
UPDATE templates SET
  name = 'Magic Transit x Magic Firewall 導入事例',
  description = 'Magic Transit と Magic Firewall を活用した DDoS 防御・ネットワークセキュリティの導入事例テンプレート',
  template_type = 'case_study',
  input_fields_json = '{"fields":[{"id":"service_name","label":"対象サービス","type":"text","required":true,"placeholder":"例: Magic Transit, Magic Firewall"},{"id":"services_used","label":"使用する Cloudflare サービス","type":"tag_select","required":true,"options":["Magic Transit","Magic Firewall","Network Analytics","Flow-based Monitoring","DDoS Protection"]},{"id":"challenge","label":"ネットワーク課題","type":"textarea","required":true,"placeholder":"DDoS 攻撃への対策、ネットワークセキュリティの課題"},{"id":"challenges_before_cf","label":"Cloudflare 利用前の課題","type":"textarea","required":false,"placeholder":"従来の DDoS 対策やネットワークセキュリティの問題点"},{"id":"previous_solution","label":"Cloudflare 採用前のソリューション","type":"textarea","required":false,"placeholder":"例: オンプレミスの DDoS アプライアンスを利用。課題は..."},{"id":"evaluation_events","label":"検討中のできごと","type":"textarea","required":false,"placeholder":"導入検討段階での印象的なエピソードや判断のきっかけ"},{"id":"poc_struggles","label":"PoC 中の苦労","type":"textarea","required":false,"placeholder":"PoC や検証段階で経験した困難や学び（例: BGP 広告の切替テスト）"},{"id":"target_audience","label":"対象読者","type":"tag_select","required":true,"options":["ネットワークエンジニア","セキュリティエンジニア","インフラエンジニア","SRE","データセンター運用者"]},{"id":"target_audience_other","label":"対象読者（その他）","type":"text","required":false,"placeholder":"上記にない場合は自由記述"},{"id":"architecture","label":"構成概要（箇条書き）","type":"textarea","required":true,"placeholder":"BGP 構成、トラフィックフロー、冗長化など"},{"id":"steps","label":"設定手順（箇条書き）","type":"textarea","required":true,"placeholder":"オンボーディング〜本番切替までの流れ"},{"id":"performance","label":"パフォーマンス・可用性データ","type":"textarea","required":false,"placeholder":"DDoS 防御実績、レイテンシ改善等"},{"id":"post_deployment_challenges","label":"導入後の課題やネクストチャレンジ","type":"textarea","required":false,"placeholder":"導入後に見えてきた新たな課題や改善ポイント"},{"id":"next_challenges","label":"次にやってみたいこと","type":"textarea","required":false,"placeholder":"今後取り組みたい技術やプロジェクト"},{"id":"notes","label":"補足・特記事項","type":"textarea","required":false},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}'
WHERE id = 't-net-01';

-- t-gen-01: Add 5 new fields + set template_type to tips
UPDATE templates SET
  template_type = 'tips',
  input_fields_json = '{"fields":[{"id":"topic","label":"Tip のトピック","type":"text","required":true,"placeholder":"例: Cache Rules で特定パスをキャッシュ除外"},{"id":"tldr","label":"一言まとめ (TL;DR)","type":"text","required":true,"placeholder":"結論を 1-2 文で"},{"id":"background","label":"背景・課題","type":"textarea","required":true,"placeholder":"なぜこの Tip が必要か"},{"id":"challenges_before_cf","label":"Cloudflare 利用前の課題","type":"textarea","required":false,"placeholder":"この Tip に関連する以前の課題"},{"id":"poc_struggles","label":"検証中の苦労","type":"textarea","required":false,"placeholder":"設定を試す中で経験した困難"},{"id":"solution","label":"解決方法（箇条書き）","type":"textarea","required":true,"placeholder":"ダッシュボード操作 or API/CLI コマンド"},{"id":"caveats","label":"注意点","type":"textarea","required":false},{"id":"post_deployment_challenges","label":"適用後に気づいた課題","type":"textarea","required":false,"placeholder":"設定適用後に見えてきた課題"},{"id":"next_challenges","label":"次にやってみたいこと","type":"textarea","required":false,"placeholder":"今後試したい関連設定や技術"},{"id":"notes","label":"補足","type":"textarea","required":false},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}'
WHERE id = 't-gen-01';

-- ─── 4. Insert new templates ───

-- SASE 導入事例
INSERT OR IGNORE INTO templates (id, name, description, category_id, difficulty, template_type, estimated_minutes, input_fields_json, ai_prompt_template, sort_order) VALUES
('t-sase-01', 'SASE 構築 導入事例',
 'Magic WAN, CNI, WARP, Tunnel を組み合わせた SASE 構築の導入事例テンプレート',
 'cat-sase', 'intermediate', 'case_study', 45,
 '{"fields":[{"id":"sase_components","label":"使用する SASE コンポーネント","type":"tag_select","required":true,"options":["Magic WAN","Network Interconnect (CNI)","WARP Client","Cloudflare Tunnel","Gateway","Access","DLP","CASB","Browser Isolation"]},{"id":"challenge","label":"組織のネットワーク・セキュリティ課題","type":"textarea","required":true,"placeholder":"SASE 導入の動機となった課題"},{"id":"challenges_before_cf","label":"Cloudflare 利用前の課題","type":"textarea","required":false,"placeholder":"従来の WAN / VPN / セキュリティ構成の課題（例: MPLS コスト、VPN ボトルネック）"},{"id":"previous_solution","label":"Cloudflare 採用前のソリューション","type":"textarea","required":false,"placeholder":"例: MPLS + Cisco SD-WAN + Zscaler。課題は..."},{"id":"evaluation_events","label":"検討中のできごと","type":"textarea","required":false,"placeholder":"導入検討段階での印象的なエピソードや判断のきっかけ"},{"id":"poc_struggles","label":"PoC 中の苦労","type":"textarea","required":false,"placeholder":"PoC や検証段階で経験した困難や学び"},{"id":"architecture","label":"SASE アーキテクチャ概要","type":"textarea","required":true,"placeholder":"拠点接続方式、トラフィックフロー、セキュリティポリシー構成"},{"id":"target_audience","label":"対象読者","type":"tag_select","required":true,"options":["ネットワークエンジニア","セキュリティエンジニア","IT 管理者","CISO / セキュリティ責任者","インフラエンジニア"]},{"id":"target_audience_other","label":"対象読者（その他）","type":"text","required":false,"placeholder":"上記にない場合は自由記述"},{"id":"steps","label":"導入手順（箇条書き）","type":"textarea","required":true,"placeholder":"Phase ごとの導入手順"},{"id":"before_after","label":"Before/After の違い","type":"textarea","required":false,"placeholder":"従来構成との比較ポイント"},{"id":"results","label":"導入効果（数値）","type":"textarea","required":false,"placeholder":"コスト削減、パフォーマンス改善等"},{"id":"post_deployment_challenges","label":"導入後の課題やネクストチャレンジ","type":"textarea","required":false,"placeholder":"導入後に見えてきた新たな課題や改善ポイント"},{"id":"next_challenges","label":"次にやってみたいこと","type":"textarea","required":false,"placeholder":"今後取り組みたい技術やプロジェクト"},{"id":"notes","label":"補足・特記事項","type":"textarea","required":false},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}',
 'あなたは企業のネットワーク／セキュリティチームのエンジニアです。以下の入力情報をもとに、**組織のネットワーク・セキュリティ課題に対して Cloudflare の SASE ソリューション（Magic WAN, CNI, WARP, Tunnel 等）をどう構築し解決したか**を紹介する導入事例記事を Markdown 形式で生成してください。

## 記事構成
1. 導入背景（組織規模、従来の WAN / セキュリティ構成、抱えていた課題）
2. 要件定義（ネットワーク要件、セキュリティ要件、コスト要件）
3. ソリューション選定（SASE アプローチを選択した理由、Cloudflare を選んだ判断軸）
4. アーキテクチャ設計（Before/After の構成比較、使用コンポーネント一覧を表形式）
5. 前提条件（既存インフラ、回線環境等）
6. 導入手順（Phase 形式。各フェーズの目的・スコープ・実施内容を明記）
7. PoC・検証（検証シナリオと結果、苦労した点と解決策）
8. 導入時の注意点（既存回線との並行運用、切替時のリスク管理）
9. 導入効果（コスト削減・パフォーマンス改善・セキュリティ強化を定量／定性で）
10. 導入後の課題と今後の展開
11. 参考リンク

## ルール
- 日本語で書くこと
- ネットワーク設計の判断は業務要件と紐づけて説明すること
- SASE の各コンポーネントの役割と連携を明確にすること
- スクリーンショットの挿入箇所を `<!-- screenshot: 〜 -->` で示すこと',
 7);

-- SASE ソリューション & テックブログ
INSERT OR IGNORE INTO templates (id, name, description, category_id, difficulty, template_type, estimated_minutes, input_fields_json, ai_prompt_template, sort_order) VALUES
('t-sase-02', 'SASE ソリューション & テックブログ',
 'Magic WAN, CNI, WARP, Tunnel に関する技術解説・ソリューション紹介テンプレート',
 'cat-sase', 'intermediate', 'solution', 30,
 '{"fields":[{"id":"topic","label":"テーマ・トピック","type":"text","required":true,"placeholder":"例: Magic WAN と CNI を使った拠点間接続の設計パターン"},{"id":"target_services","label":"対象サービス","type":"tag_select","required":true,"options":["Magic WAN","Network Interconnect (CNI)","WARP Client","Cloudflare Tunnel","Gateway","Access"]},{"id":"technical_background","label":"技術的な背景","type":"textarea","required":true,"placeholder":"この技術やソリューションの背景、解決する課題"},{"id":"challenges_before_cf","label":"従来の課題","type":"textarea","required":false,"placeholder":"この技術が解決する従来の課題"},{"id":"architecture","label":"アーキテクチャ・構成","type":"textarea","required":true,"placeholder":"システム構成、接続方式、フロー"},{"id":"implementation","label":"実装・設定の詳細","type":"textarea","required":false,"placeholder":"具体的な設定手順やコード"},{"id":"best_practices","label":"ベストプラクティス","type":"textarea","required":false,"placeholder":"推奨構成、注意点、Tips"},{"id":"poc_struggles","label":"検証中の苦労","type":"textarea","required":false,"placeholder":"検証や実装で苦労した点"},{"id":"post_deployment_challenges","label":"運用上の課題","type":"textarea","required":false,"placeholder":"運用で見えてきた課題"},{"id":"next_challenges","label":"次にやってみたいこと","type":"textarea","required":false,"placeholder":"今後の展開"},{"id":"notes","label":"補足","type":"textarea","required":false},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}',
 'あなたは Cloudflare SASE ソリューションの技術エキスパートです。以下の入力情報をもとに、SASE 関連技術の解説・ソリューション紹介記事を Markdown 形式で生成してください。

## 記事構成
1. はじめに（テーマの概要と読者が得られる知識）
2. 技術的背景（課題と解決アプローチ）
3. アーキテクチャ解説（構成図、コンポーネントの役割）
4. 実装・設定詳細（具体的な手順、コード例）
5. ベストプラクティスと注意点
6. 検証・運用の学び
7. まとめと今後の展望
8. 参考リンク

## ルール
- 日本語で書くこと
- 技術的に正確で実践的な内容にすること
- 図表や構成図を積極的に活用すること
- スクリーンショットの挿入箇所を `<!-- screenshot: 〜 -->` で示すこと',
 8);

-- Application Services ソリューション & テックブログ
INSERT OR IGNORE INTO templates (id, name, description, category_id, difficulty, template_type, estimated_minutes, input_fields_json, ai_prompt_template, sort_order) VALUES
('t-app-02', 'Application Services ソリューション & テックブログ',
 'WAF, CDN, Bot Management, Load Balancing, Spectrum, Argo 等の技術解説・ソリューション紹介テンプレート',
 'cat-app', 'beginner', 'solution', 30,
 '{"fields":[{"id":"topic","label":"テーマ・トピック","type":"text","required":true,"placeholder":"例: WAF カスタムルールによる API 保護パターン"},{"id":"target_services","label":"対象サービス","type":"tag_select","required":true,"options":["WAF","CDN","Bot Management","Load Balancing","Cache Rules","Transform Rules","SSL/TLS","Waiting Room","Spectrum","Argo Smart Routing","Argo Tiered Cache","API Protection","Page Shield"]},{"id":"technical_background","label":"技術的な背景","type":"textarea","required":true,"placeholder":"この技術やソリューションの背景、解決する課題"},{"id":"challenges_before_cf","label":"従来の課題","type":"textarea","required":false,"placeholder":"この技術が解決する従来の課題"},{"id":"architecture","label":"アーキテクチャ・構成","type":"textarea","required":false,"placeholder":"システム構成やリクエストフロー"},{"id":"implementation","label":"実装・設定の詳細","type":"textarea","required":true,"placeholder":"具体的な設定手順、ルール例、API コール"},{"id":"best_practices","label":"ベストプラクティス","type":"textarea","required":false,"placeholder":"推奨設定、注意点、Tips"},{"id":"poc_struggles","label":"検証中の苦労","type":"textarea","required":false,"placeholder":"検証や実装で苦労した点"},{"id":"post_deployment_challenges","label":"運用上の課題","type":"textarea","required":false,"placeholder":"運用で見えてきた課題"},{"id":"next_challenges","label":"次にやってみたいこと","type":"textarea","required":false,"placeholder":"今後の展開"},{"id":"notes","label":"補足","type":"textarea","required":false},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}',
 'あなたは Cloudflare Application Services の技術エキスパートです。以下の入力情報をもとに、Application Services 関連技術の解説・ソリューション紹介記事を Markdown 形式で生成してください。

## 記事構成
1. はじめに（テーマの概要と読者が得られる知識）
2. 技術的背景（課題と解決アプローチ）
3. アーキテクチャ解説（構成、リクエストフロー）
4. 実装・設定詳細（具体的な手順、ルール例）
5. ベストプラクティスと注意点
6. 検証・運用の学び
7. まとめと今後の展望
8. 参考リンク

## ルール
- 日本語で書くこと
- 技術的に正確で実践的な内容にすること
- スクリーンショットの挿入箇所を `<!-- screenshot: 〜 -->` で示すこと',
 2);

-- Zero Trust ソリューション & テックブログ
INSERT OR IGNORE INTO templates (id, name, description, category_id, difficulty, template_type, estimated_minutes, input_fields_json, ai_prompt_template, sort_order) VALUES
('t-zt-02', 'Zero Trust ソリューション & テックブログ',
 'Access, Gateway, CASB, Browser Isolation 等の技術解説・ソリューション紹介テンプレート',
 'cat-zt', 'beginner', 'solution', 30,
 '{"fields":[{"id":"topic","label":"テーマ・トピック","type":"text","required":true,"placeholder":"例: Gateway DNS フィルタリングの設計パターン"},{"id":"target_services","label":"対象サービス","type":"tag_select","required":true,"options":["Access","Gateway","Tunnel (cloudflared)","CASB","Browser Isolation","DLP","WARP Client","DEX","Email Security"]},{"id":"technical_background","label":"技術的な背景","type":"textarea","required":true,"placeholder":"この技術やソリューションの背景、解決する課題"},{"id":"challenges_before_cf","label":"従来の課題","type":"textarea","required":false,"placeholder":"この技術が解決する従来の課題"},{"id":"architecture","label":"アーキテクチャ・構成","type":"textarea","required":false,"placeholder":"認証フロー、ポリシー構成"},{"id":"implementation","label":"実装・設定の詳細","type":"textarea","required":true,"placeholder":"具体的な設定手順、ポリシー例"},{"id":"best_practices","label":"ベストプラクティス","type":"textarea","required":false,"placeholder":"推奨設定、注意点、Tips"},{"id":"poc_struggles","label":"検証中の苦労","type":"textarea","required":false,"placeholder":"検証や実装で苦労した点"},{"id":"post_deployment_challenges","label":"運用上の課題","type":"textarea","required":false,"placeholder":"運用で見えてきた課題"},{"id":"next_challenges","label":"次にやってみたいこと","type":"textarea","required":false,"placeholder":"今後の展開"},{"id":"notes","label":"補足","type":"textarea","required":false},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}',
 'あなたは Cloudflare Zero Trust の技術エキスパートです。以下の入力情報をもとに、Zero Trust 関連技術の解説・ソリューション紹介記事を Markdown 形式で生成してください。

## 記事構成
1. はじめに（テーマの概要と読者が得られる知識）
2. 技術的背景（課題と解決アプローチ）
3. アーキテクチャ解説（認証フロー、ポリシー構成）
4. 実装・設定詳細（具体的な手順、ポリシー例）
5. ベストプラクティスと注意点
6. 検証・運用の学び
7. まとめと今後の展望
8. 参考リンク

## ルール
- 日本語で書くこと
- セキュリティ設計の判断理由を必ず説明すること
- スクリーンショットの挿入箇所を `<!-- screenshot: 〜 -->` で示すこと',
 4);

-- Developer Platform ソリューション & テックブログ
INSERT OR IGNORE INTO templates (id, name, description, category_id, difficulty, template_type, estimated_minutes, input_fields_json, ai_prompt_template, sort_order) VALUES
('t-dev-02', 'Developer Platform ソリューション & テックブログ',
 'Workers, Pages, D1, R2, Durable Objects 等の技術解説・ソリューション紹介テンプレート',
 'cat-dev', 'beginner', 'solution', 30,
 '{"fields":[{"id":"topic","label":"テーマ・トピック","type":"text","required":true,"placeholder":"例: D1 + Drizzle ORM でのマイグレーション戦略"},{"id":"target_services","label":"対象サービス","type":"tag_select","required":true,"options":["Workers","Pages","D1","KV","R2","Durable Objects","Queues","Workers AI","Vectorize","Hyperdrive","Browser Rendering"]},{"id":"technical_background","label":"技術的な背景","type":"textarea","required":true,"placeholder":"この技術やソリューションの背景、解決する課題"},{"id":"challenges_before_cf","label":"従来の課題","type":"textarea","required":false,"placeholder":"この技術が解決する従来の課題"},{"id":"architecture","label":"アーキテクチャ・構成","type":"textarea","required":false,"placeholder":"システム構成、データフロー"},{"id":"implementation","label":"実装の詳細","type":"textarea","required":true,"placeholder":"具体的なコード、設定"},{"id":"code_snippets","label":"コードスニペット","type":"code","required":false,"placeholder":"記事に含めたい主要なコード"},{"id":"best_practices","label":"ベストプラクティス","type":"textarea","required":false,"placeholder":"推奨パターン、アンチパターン、Tips"},{"id":"poc_struggles","label":"検証中の苦労","type":"textarea","required":false,"placeholder":"実装で苦労した点"},{"id":"post_deployment_challenges","label":"運用上の課題","type":"textarea","required":false,"placeholder":"運用で見えてきた課題"},{"id":"next_challenges","label":"次にやってみたいこと","type":"textarea","required":false,"placeholder":"今後の展開"},{"id":"notes","label":"補足","type":"textarea","required":false},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}',
 'あなたは Cloudflare Developer Platform の技術エキスパートです。以下の入力情報をもとに、Developer Platform 関連技術の解説・ソリューション紹介記事を Markdown 形式で生成してください。

## 記事構成
1. はじめに（テーマの概要と読者が得られる知識）
2. 技術的背景（課題と解決アプローチ）
3. アーキテクチャ解説（構成、データフロー）
4. 実装詳細（コード例付きで解説）
5. ベストプラクティスと注意点
6. 検証・運用の学び
7. まとめと今後の展望
8. 参考リンク

## ルール
- 日本語で書くこと
- コードブロックには言語指定とコメントを付けること
- 実践的で読者がすぐに試せる内容にすること
- スクリーンショットの挿入箇所を `<!-- screenshot: 〜 -->` で示すこと',
 10);

-- Network Services ソリューション & テックブログ
INSERT OR IGNORE INTO templates (id, name, description, category_id, difficulty, template_type, estimated_minutes, input_fields_json, ai_prompt_template, sort_order) VALUES
('t-net-02', 'Network Services ソリューション & テックブログ',
 'Magic Transit, Magic Firewall に関する技術解説・ソリューション紹介テンプレート',
 'cat-net', 'intermediate', 'solution', 30,
 '{"fields":[{"id":"topic","label":"テーマ・トピック","type":"text","required":true,"placeholder":"例: Magic Firewall ルールの設計パターンと運用自動化"},{"id":"target_services","label":"対象サービス","type":"tag_select","required":true,"options":["Magic Transit","Magic Firewall","Network Analytics","Flow-based Monitoring","DDoS Protection"]},{"id":"technical_background","label":"技術的な背景","type":"textarea","required":true,"placeholder":"この技術やソリューションの背景、解決する課題"},{"id":"challenges_before_cf","label":"従来の課題","type":"textarea","required":false,"placeholder":"この技術が解決する従来の課題"},{"id":"architecture","label":"アーキテクチャ・構成","type":"textarea","required":false,"placeholder":"ネットワーク構成、トラフィックフロー"},{"id":"implementation","label":"実装・設定の詳細","type":"textarea","required":true,"placeholder":"具体的な設定手順、ルール例"},{"id":"best_practices","label":"ベストプラクティス","type":"textarea","required":false,"placeholder":"推奨構成、注意点、Tips"},{"id":"poc_struggles","label":"検証中の苦労","type":"textarea","required":false,"placeholder":"検証で苦労した点"},{"id":"post_deployment_challenges","label":"運用上の課題","type":"textarea","required":false,"placeholder":"運用で見えてきた課題"},{"id":"next_challenges","label":"次にやってみたいこと","type":"textarea","required":false,"placeholder":"今後の展開"},{"id":"notes","label":"補足","type":"textarea","required":false},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}',
 'あなたは Cloudflare Network Services の技術エキスパートです。以下の入力情報をもとに、Network Services 関連技術の解説・ソリューション紹介記事を Markdown 形式で生成してください。

## 記事構成
1. はじめに（テーマの概要と読者が得られる知識）
2. 技術的背景（課題と解決アプローチ）
3. アーキテクチャ解説（ネットワーク構成図、トラフィックフロー）
4. 実装・設定詳細（具体的な手順、ルール例）
5. ベストプラクティスと注意点
6. 検証・運用の学び
7. まとめと今後の展望
8. 参考リンク

## ルール
- 日本語で書くこと
- ネットワーク設計の判断理由を説明すること
- 数値データは表形式で見やすくすること
- スクリーンショットの挿入箇所を `<!-- screenshot: 〜 -->` で示すこと',
 12);

-- Email Security 導入事例
INSERT OR IGNORE INTO templates (id, name, description, category_id, difficulty, template_type, estimated_minutes, input_fields_json, ai_prompt_template, sort_order) VALUES
('t-email-01', 'Email Security 導入事例',
 'Cloudflare Email Security (Area 1), Email Routing, DMARC Management の導入事例テンプレート',
 'cat-email', 'beginner', 'case_study', 40,
 '{"fields":[{"id":"service_name","label":"対象サービス","type":"text","required":true,"placeholder":"例: Email Security (Area 1), DMARC Management"},{"id":"services_used","label":"使用する Cloudflare サービス","type":"tag_select","required":true,"options":["Email Security (Area 1)","Email Routing","DMARC Management","Brand Protection"]},{"id":"challenge","label":"メールセキュリティ課題","type":"textarea","required":true,"placeholder":"フィッシング攻撃、BEC、DMARC 未対応などの課題"},{"id":"challenges_before_cf","label":"Cloudflare 利用前の課題","type":"textarea","required":false,"placeholder":"従来のメールセキュリティ対策の問題点"},{"id":"previous_solution","label":"Cloudflare 採用前のソリューション","type":"textarea","required":false,"placeholder":"例: Proofpoint + Microsoft Defender for Office 365"},{"id":"evaluation_events","label":"検討中のできごと","type":"textarea","required":false,"placeholder":"導入検討段階での印象的なエピソードや判断のきっかけ"},{"id":"poc_struggles","label":"PoC 中の苦労","type":"textarea","required":false,"placeholder":"PoC や検証段階で経験した困難や学び"},{"id":"target_audience","label":"対象読者","type":"tag_select","required":true,"options":["セキュリティエンジニア","IT 管理者","情シス担当者","メール管理者"]},{"id":"target_audience_other","label":"対象読者（その他）","type":"text","required":false,"placeholder":"上記にない場合は自由記述"},{"id":"steps","label":"導入手順（箇条書き）","type":"textarea","required":true,"placeholder":"MX レコード変更〜ポリシー設定までの流れ"},{"id":"results","label":"導入効果（数値）","type":"textarea","required":false,"placeholder":"フィッシング検出率、誤検知率等"},{"id":"post_deployment_challenges","label":"導入後の課題やネクストチャレンジ","type":"textarea","required":false,"placeholder":"導入後に見えてきた新たな課題や改善ポイント"},{"id":"next_challenges","label":"次にやってみたいこと","type":"textarea","required":false,"placeholder":"今後取り組みたい技術やプロジェクト"},{"id":"notes","label":"補足・特記事項","type":"textarea","required":false},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}',
 'あなたは企業のセキュリティチームのエンジニアです。以下の入力情報をもとに、**組織のメールセキュリティ課題に対して Cloudflare Email Security をどう導入し解決したか**を紹介する導入事例記事を Markdown 形式で生成してください。

## 記事構成
1. 導入背景（メールセキュリティの課題、フィッシング被害の実態）
2. 要件定義（検出精度要件、運用要件、統合要件）
3. ソリューション選定（Cloudflare を選んだ理由、他製品との比較）
4. アーキテクチャ設計（メールフロー、既存システムとの統合方法）
5. 導入手順（Phase 形式）
6. PoC・検証（検証シナリオと結果）
7. 導入効果（検出率、誤検知率、運用負荷の変化）
8. 導入後の課題と今後の展開
9. 参考リンク

## ルール
- 日本語で書くこと
- メールセキュリティの技術的な判断理由を説明すること
- スクリーンショットの挿入箇所を `<!-- screenshot: 〜 -->` で示すこと',
 13);

-- Email Security ソリューション & テックブログ
INSERT OR IGNORE INTO templates (id, name, description, category_id, difficulty, template_type, estimated_minutes, input_fields_json, ai_prompt_template, sort_order) VALUES
('t-email-02', 'Email Security ソリューション & テックブログ',
 'Email Security, Email Routing, DMARC Management の技術解説・ソリューション紹介テンプレート',
 'cat-email', 'beginner', 'solution', 30,
 '{"fields":[{"id":"topic","label":"テーマ・トピック","type":"text","required":true,"placeholder":"例: DMARC / DKIM / SPF の段階的導入戦略"},{"id":"target_services","label":"対象サービス","type":"tag_select","required":true,"options":["Email Security (Area 1)","Email Routing","DMARC Management","Brand Protection"]},{"id":"technical_background","label":"技術的な背景","type":"textarea","required":true,"placeholder":"この技術やソリューションの背景、解決する課題"},{"id":"challenges_before_cf","label":"従来の課題","type":"textarea","required":false,"placeholder":"この技術が解決する従来の課題"},{"id":"implementation","label":"実装・設定の詳細","type":"textarea","required":true,"placeholder":"具体的な設定手順、DNS レコード例"},{"id":"best_practices","label":"ベストプラクティス","type":"textarea","required":false,"placeholder":"推奨設定、注意点、Tips"},{"id":"poc_struggles","label":"検証中の苦労","type":"textarea","required":false,"placeholder":"検証で苦労した点"},{"id":"post_deployment_challenges","label":"運用上の課題","type":"textarea","required":false,"placeholder":"運用で見えてきた課題"},{"id":"next_challenges","label":"次にやってみたいこと","type":"textarea","required":false,"placeholder":"今後の展開"},{"id":"notes","label":"補足","type":"textarea","required":false},{"id":"reference_urls","label":"参考 URL","type":"url_list","required":false}]}',
 'あなたは Cloudflare Email Security の技術エキスパートです。以下の入力情報をもとに、Email Security 関連技術の解説・ソリューション紹介記事を Markdown 形式で生成してください。

## 記事構成
1. はじめに（テーマの概要と読者が得られる知識）
2. 技術的背景（課題と解決アプローチ）
3. 実装・設定詳細（具体的な手順、DNS レコード例）
4. ベストプラクティスと注意点
5. 検証・運用の学び
6. まとめと今後の展望
7. 参考リンク

## ルール
- 日本語で書くこと
- メール認証（SPF, DKIM, DMARC）の技術的な説明を含めること
- スクリーンショットの挿入箇所を `<!-- screenshot: 〜 -->` で示すこと',
 14);

-- ─── 5. Update AI prompts for existing case_study templates to include new field handling ───

UPDATE templates SET ai_prompt_template = ai_prompt_template || '

## 追加入力フィールドの扱い（入力がある場合のみ記事に組み込む）
- 「Cloudflare 利用前の課題」→「導入背景」セクションの冒頭で具体的に描写
- 「検討中のできごと」→「ソリューション選定」セクションで検討プロセスのエピソードとして記述
- 「PoC 中の苦労」→「PoC・検証」セクション（なければ「導入手順」内）で苦労と解決策を記述
- 「導入後の課題やネクストチャレンジ」→「導入後の課題と今後の展開」セクションで記述
- 「次にやってみたいこと」→ 記事末尾の「今後の展望」として記述'
WHERE template_type = 'case_study';

UPDATE templates SET ai_prompt_template = ai_prompt_template || '

## 追加入力フィールドの扱い（入力がある場合のみ記事に組み込む）
- 「従来の課題」→「技術的背景」セクションで従来の課題として描写
- 「検証中の苦労」→「検証・運用の学び」セクションで記述
- 「運用上の課題」→「まとめと今後の展望」セクションで記述
- 「次にやってみたいこと」→ 記事末尾の「今後の展望」として記述'
WHERE template_type = 'solution';

UPDATE templates SET ai_prompt_template = ai_prompt_template || '

## 追加入力フィールドの扱い（入力がある場合のみ記事に組み込む）
- 「Cloudflare 利用前の課題」→「背景・課題」セクションで記述
- 「検証中の苦労」→「解決方法」セクション内で試行錯誤として記述
- 「適用後に気づいた課題」→「注意点」に追加
- 「次にやってみたいこと」→「まとめ」の末尾に記述'
WHERE template_type = 'tips';
