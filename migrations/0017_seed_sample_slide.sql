-- Seed: sample published slide (generated from agents.html)
-- Regenerate with: node scripts/generate-sample-slide-migration.mjs

INSERT OR IGNORE INTO users (id, email, display_name, role, created_at, updated_at)
VALUES (
  'SYSTEM0000000000000000000A',
  'system@cf-se-blog.local',
  'Cloudflare Field Notes',
  'se',
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO slides (
  id, title, slug, description, event_name, html, slide_count,
  author_id, author_name_snapshot, status, visibility, tags_json,
  created_at, updated_at
) VALUES (
  'SLIDESAMPLEAGENTS000000001',
  'Cloudflare Agents — 「動き続ける」AI を作る',
  'cloudflare-agents',
  '記憶を持ち、自律的に考え、ツールを使う AI エージェントをエッジで動かす。Agents SDK の仕様・ユースケース・拡張性・Workers AI との違いを解説したサンプルスライド。',
  'サンプル',
  '<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cloudflare Agents — 仕様・ユースケース・拡張性</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.css">
  <style>
    :root {
      --cf-text: #1f1f1f;
      --cf-muted: rgba(31, 31, 31, 0.68);
      --cf-orange: #ff6633;
      --cf-line: rgba(60, 60, 60, 0.20);
      --cf-panel: rgba(255, 255, 255, 0.92);
      --cf-panel-soft: rgba(255, 255, 255, 0.84);
    }

    * { box-sizing: border-box; }

    body,
    .reveal {
      font-family: "Inter", "Hiragino Sans", "Yu Gothic", Arial, sans-serif;
      color: var(--cf-text);
      background: #fff;
    }

    .reveal .slides { text-align: left; }

    .reveal .slide-number {
      font-size: 12pt;
      color: rgba(0, 0, 0, 0.42);
      right: 14px;
      bottom: 8px;
    }

    .reveal section {
      width: 1024px;
      height: 576px;
      padding: 0;
    }

    .overlay {
      width: 100%;
      height: 100%;
      position: relative;
      color: inherit;
    }

    .cover-overlay {
      padding: 122px 60px 60px 60px;
      max-width: 900px;
    }

    #cover-slide h1 {
      font-size: 34pt;
      line-height: 1.16;
    }

    .divider-overlay {
      padding: 0 58px;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      color: #fff;
    }

    .content-overlay {
      padding: 58px 34px 24px 34px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .thankyou-overlay {
      padding: 0 42px;
      height: 100%;
      display: flex;
      align-items: center;
      color: #fff;
    }

    h1, h2, h3, p, li, td, th, div, span { color: inherit; margin: 0; }

    h1 {
      font-size: 38pt;
      font-weight: 600;
      line-height: 1.12;
      letter-spacing: -0.02em;
    }

    h2 {
      font-size: 24pt;
      font-weight: 600;
      line-height: 1.12;
      margin-bottom: 4px;
    }

    h3 {
      font-size: 16pt;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 6px;
    }

    p, li, td, th { font-size: 15pt; line-height: 1.34; }

    .subtext {
      margin-top: 12px;
      font-size: 17pt;
      line-height: 1.34;
      color: var(--cf-muted);
    }

    .meta { margin-top: 14px; font-size: 13pt; color: var(--cf-muted); }

    .divider-subtext,
    .thankyou-subtext {
      color: rgba(255, 255, 255, 0.88);
      margin-top: 12px;
      font-size: 18pt;
      line-height: 1.34;
      max-width: 720px;
    }

    .kicker {
      font-size: 14pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.88);
      margin-bottom: 12px;
    }

    .content-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .content-grid-3 {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .panel {
      background: var(--cf-panel);
      border: 1px solid var(--cf-line);
      border-radius: 12px;
      padding: 12px 14px;
      min-height: 0;
    }

    .panel.soft { background: var(--cf-panel-soft); }

    .panel.accent {
      background: rgba(255, 102, 51, 0.06);
      border: 1px solid rgba(255, 102, 51, 0.35);
    }

    .badge-row { display: flex; flex-wrap: wrap; gap: 8px; }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 5px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.94);
      border: 1px solid rgba(255, 102, 51, 0.25);
      color: var(--cf-orange);
      font-size: 12pt;
      font-weight: 700;
    }

    .note {
      padding: 10px 12px;
      border-left: 4px solid var(--cf-orange);
      background: rgba(255,255,255,0.93);
      border-radius: 10px;
      font-size: 14pt;
      line-height: 1.34;
    }

    .small { font-size: 13pt; color: var(--cf-muted); }

    ul { margin: 0; padding-left: 1.15em; }
    li { margin: 0.15em 0; }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      background: rgba(255,255,255,0.95);
      border-radius: 10px;
      overflow: hidden;
    }

    th, td {
      border: 1px solid rgba(82, 82, 82, 0.16);
      padding: 8px 10px;
      vertical-align: top;
      font-size: 13pt;
    }

    th { font-weight: 700; background: rgba(255, 102, 51, 0.08); }

    .stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
      height: 100%;
      min-height: 0;
    }

    .kw { color: var(--cf-orange); font-weight: 700; }

    pre.code {
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid var(--cf-line);
      border-radius: 0 10px 10px 10px;
      padding: 10px 14px;
      margin: 0;
      font-family: "JetBrains Mono", ui-monospace, Menlo, monospace;
      font-size: 9.5pt;
      line-height: 1.5;
      color: #2d2d2d;
      white-space: pre;
      overflow: visible;
    }
    pre.code .c { color: rgba(31, 31, 31, 0.5); }
    pre.code .k { color: #d6336c; font-weight: 600; }
    pre.code .s { color: #1c7c54; }
    pre.code .f { color: #1864ab; }
    pre.code .n { color: #5f3dc4; }

    .code-tab {
      display: inline-block;
      font-family: "JetBrains Mono", monospace;
      font-size: 10pt;
      background: rgba(255, 102, 51, 0.10);
      border: 1px solid rgba(255, 102, 51, 0.30);
      color: var(--cf-orange);
      padding: 2px 10px;
      border-radius: 6px 6px 0 0;
      font-weight: 600;
    }

    .quote {
      font-size: 16pt;
      line-height: 1.4;
      font-weight: 600;
      color: var(--cf-text);
      padding: 12px 16px;
      border-left: 4px solid var(--cf-orange);
      background: rgba(255, 255, 255, 0.92);
      border-radius: 0 10px 10px 0;
    }
    .quote .src {
      display: block;
      font-size: 11pt;
      font-weight: 500;
      color: var(--cf-muted);
      margin-top: 6px;
    }
    .quote .src a {
      color: var(--cf-orange);
      text-decoration: none;
      border-bottom: 1px dotted var(--cf-orange);
    }

    .flow-step {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 5px 11px;
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid var(--cf-line);
      border-radius: 8px;
      font-size: 12pt;
      line-height: 1.25;
    }
    .flow-step .num {
      flex-shrink: 0;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--cf-orange);
      color: #fff;
      font-weight: 700;
      font-size: 11pt;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">

      <!-- 1. Cover -->
      <section data-background-image="/slides-assets/cf-template-cover.svg" data-background-size="100% 100%" id="cover-slide">
        <div class="overlay cover-overlay">
          <h1>Cloudflare Agents<br>「動き続ける」AI を作る</h1>
          <p class="subtext">記憶を持ち、自律的に考え、ツールを使うエージェントを、エッジで。</p>
          <p class="meta">Agents SDK 入門 ／ 仕様・ユースケース・拡張性・Workers AI との違い</p>
        </div>
      </section>

      <!-- 2. Divider Part 01 -->
      <section data-background-image="/slides-assets/cf-template-divider.svg" data-background-size="100% 100%" id="divider-1">
        <div class="overlay divider-overlay">
          <div class="kicker">Part 01</div>
          <h1>そもそも Agent とは何か</h1>
          <p class="divider-subtext">Worker は「応答して消える」。Agent は「覚えて・考えて・動き続ける」。</p>
        </div>
      </section>

      <!-- 3. Worker vs Agent -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="def-slide">
        <div class="overlay content-overlay">
          <h2>「応答する関数」から「自律する存在」へ</h2>
          <div class="stack">
            <div class="content-grid">
              <div class="panel">
                <h3>従来の Worker</h3>
                <ul>
                  <li>リクエスト → レスポンスで <span class="kw">消える</span></li>
                  <li>状態を持たない（ステートレス）</li>
                  <li>呼ばれない限り動かない</li>
                  <li>1回の処理が完結したら終わり</li>
                </ul>
              </div>
              <div class="panel accent">
                <h3>Agent</h3>
                <ul>
                  <li><span class="kw">長命</span>・固有のID（インスタンス）を持つ</li>
                  <li><span class="kw">記憶</span>を保持する（状態・会話履歴）</li>
                  <li>自分で起きる（予約・メール・Webhook）</li>
                  <li>多段の処理を <span class="kw">耐障害で</span>進める</li>
                </ul>
              </div>
            </div>
            <div class="note">Agent = <span class="kw">状態 × 自律 × ツール</span> を一つにまとめ、Cloudflare エッジに <span class="kw">常駐して動き続けるアプリケーション</span>。</div>
          </div>
        </div>
      </section>

      <!-- 4. アーキテクチャ -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="arch-slide">
        <div class="overlay content-overlay">
          <h2>キーは Durable Object ＝「1ユーザー1インスタンス」</h2>
          <div class="stack">
            <div class="content-grid-3">
              <div class="panel">
                <h3>インスタンス = 実体</h3>
                <p>1エージェント=1 Durable Object。ユーザーごと・部屋ごとに <span class="kw">独立して存在</span>する。</p>
              </div>
              <div class="panel">
                <h3>SQLite を内蔵</h3>
                <p>各インスタンスに <span class="kw">専用ストレージ</span>。状態も会話履歴もその場に永続化。</p>
              </div>
              <div class="panel accent">
                <h3>グローバルに分散</h3>
                <p>330+ 都市のエッジで動き、利用者の近くで <span class="kw">無限にスケール</span>。</p>
              </div>
            </div>
            <div class="content-grid">
              <div class="panel soft">
                <h3>アドレス指定でルーティング</h3>
                <p class="small"><span class="kw">/agents/{種類}/{インスタンス名}</span> に届く。名前を指定すれば、その実体に必ずつながる。</p>
              </div>
              <div class="panel soft">
                <h3>クライアントは React フックで接続</h3>
                <p class="small"><span class="kw">useAgent({ agent, name })</span> で WebSocket 接続。状態は自動同期。</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 5. 最小コード -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="code-slide">
        <div class="overlay content-overlay">
          <h2>最小の Agent — 状態と RPC が標準装備</h2>
          <div class="stack">
            <span class="code-tab">src/index.ts</span>
<pre class="code"><span class="k">import</span> { Agent, callable, routeAgentRequest } <span class="k">from</span> <span class="s">"agents"</span>;

<span class="k">export class</span> <span class="f">Counter</span> <span class="k">extends</span> Agent&lt;Env, { count: <span class="k">number</span> }&gt; {
  initialState = { count: <span class="n">0</span> };          <span class="c">// 永続化される状態</span>

  <span class="f">@callable</span>()                             <span class="c">// クライアントから直接呼べる</span>
  <span class="f">increment</span>() {
    <span class="k">this</span>.<span class="f">setState</span>({ count: <span class="k">this</span>.state.count + <span class="n">1</span> }); <span class="c">// 即、全端末へ同期</span>
    <span class="k">return</span> <span class="k">this</span>.state.count;
  }
}

<span class="k">export default</span> {
  fetch: (req, env) =&gt; <span class="f">routeAgentRequest</span>(req, env)
};</pre>
            <div class="note">状態の永続化・クライアント同期・RPC・WebSocket が <span class="kw">最初から組み込み</span>。インフラの作り込みはゼロ。</div>
          </div>
        </div>
      </section>

      <!-- 6. 主要機能 -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="features-slide">
        <div class="overlay content-overlay">
          <h2>主要機能 — エージェントに必要なものが一式</h2>
          <div class="stack">
            <div class="content-grid-3">
              <div class="panel">
                <h3>状態 &amp; 同期</h3>
                <p class="small">setState / 自動クライアント同期 / 内蔵 SQL（this.sql）</p>
              </div>
              <div class="panel">
                <h3>RPC（@callable）</h3>
                <p class="small">クライアントから型安全に呼び出し / ストリーミング対応</p>
              </div>
              <div class="panel">
                <h3>スケジューリング</h3>
                <p class="small">遅延・繰り返し・cron で <span class="kw">自分を起こす</span></p>
              </div>
              <div class="panel">
                <h3>Workflows / 耐久実行</h3>
                <p class="small">多段処理を再試行つきで / DO 退避を越えて継続</p>
              </div>
              <div class="panel">
                <h3>Queue / Retries</h3>
                <p class="small">内蔵 FIFO キュー / 指数バックオフ再試行</p>
              </div>
              <div class="panel accent">
                <h3>チャット / MCP / 入出力</h3>
                <p class="small">AIChatAgent・MCP・Email・Webhook・Push・音声(実験)</p>
              </div>
            </div>
            <div class="note">「記憶」「自律(予約)」「多段の耐久処理」「ツール接続」「リアルタイム」を <span class="kw">1フレームワークで</span>。</div>
          </div>
        </div>
      </section>

      <!-- 7. Divider Part 02 -->
      <section data-background-image="/slides-assets/cf-template-divider.svg" data-background-size="100% 100%" id="divider-2">
        <div class="overlay divider-overlay">
          <div class="kicker">Part 02</div>
          <h1>Developer Platform ＋ Workers AI<br>と何が違う？</h1>
          <p class="divider-subtext">部品は前からあった。Agents はそれを「実体」として一体化する上位レイヤー。</p>
        </div>
      </section>

      <!-- 8. 比較表 -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="compare-slide">
        <div class="overlay content-overlay">
          <h2>レイヤーの違いを一枚で</h2>
          <div class="stack">
            <table>
              <tr>
                <th style="width:24%"></th>
                <th>Workers AI</th>
                <th>Developer Platform</th>
                <th>Agents SDK</th>
              </tr>
              <tr>
                <td><strong>役割</strong></td>
                <td>モデル推論（頭脳）</td>
                <td>計算・保存の部品</td>
                <td>部品を統合した実体</td>
              </tr>
              <tr>
                <td><strong>状態</strong></td>
                <td>なし（1回の入出力）</td>
                <td>DO/KV/D1/R2 で個別に</td>
                <td><span class="kw">標準で永続＋同期</span></td>
              </tr>
              <tr>
                <td><strong>自律性</strong></td>
                <td>呼ばれたら答える</td>
                <td>Cron/Queue を自分で用意</td>
                <td><span class="kw">予約・メール等で自走</span></td>
              </tr>
              <tr>
                <td><strong>位置づけ</strong></td>
                <td>脳</td>
                <td>手足・記憶</td>
                <td><span class="kw">神経系（統合）</span></td>
              </tr>
            </table>
            <div class="note">Workers AI / Workers / DO / Queues / Workflows は <span class="kw">部品</span>。Agents はそれらを「記憶を持ち自律的に動く1つの存在」として <span class="kw">ひとまとめに提供</span>。</div>
          </div>
        </div>
      </section>

      <!-- 9. 違いの本質 -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="essence-slide">
        <div class="overlay content-overlay">
          <h2>本質：自分で組み合わせるか、最初から一体になっているか</h2>
          <div class="stack">
            <div class="content-grid">
              <div class="panel">
                <h3>これまで（部品を自分で組む）</h3>
                <ul>
                  <li>状態は Durable Object を自前で実装</li>
                  <li>定期実行は Cron Trigger を別途設定</li>
                  <li>会話履歴の保存・再開を自作</li>
                  <li>WebSocket・再接続・同期を自前で実装</li>
                </ul>
              </div>
              <div class="panel accent">
                <h3>Agents（一体になっている）</h3>
                <ul>
                  <li>状態・同期・履歴・再開が <span class="kw">標準装備</span></li>
                  <li>schedule() 一行で自走</li>
                  <li>AIChatAgent でストリーミング＆永続化</li>
                  <li>MCP・ツール・Workflow も同じ流儀で</li>
                </ul>
              </div>
            </div>
            <div class="note">同じ Cloudflare 網の上で、Workers AI(推論)・ストレージ・計算が <span class="kw">隣り合って</span>動くから、統合しても速くて安い。</div>
          </div>
        </div>
      </section>

      <!-- 10. Divider Part 03 -->
      <section data-background-image="/slides-assets/cf-template-divider.svg" data-background-size="100% 100%" id="divider-3">
        <div class="overlay divider-overlay">
          <div class="kicker">Part 03</div>
          <h1>ユースケースと拡張性</h1>
          <p class="divider-subtext">「記憶 × 自律 × ツール」が効く場所と、Cloudflare 完結か外部連携かの見極め。</p>
        </div>
      </section>

      <!-- 11. ユースケース -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="usecase-slide">
        <div class="overlay content-overlay">
          <h2>ユースケース</h2>
          <div class="stack">
            <div class="content-grid-3">
              <div class="panel">
                <h3>記憶を持つアシスタント</h3>
                <p class="small">家庭教師・カスタマーサポート・パーソナルコーチ</p>
              </div>
              <div class="panel">
                <h3>自律タスク</h3>
                <p class="small">リサーチ・監視・要約・定期レポート生成</p>
              </div>
              <div class="panel">
                <h3>スケジュール駆動</h3>
                <p class="small">定期ポーリング → 判断 → 通知 / アクション</p>
              </div>
              <div class="panel">
                <h3>MCP サーバー/クライアント</h3>
                <p class="small">外部ツール群と接続、または自分をツールとして公開</p>
              </div>
              <div class="panel">
                <h3>耐久ワークフロー</h3>
                <p class="small">多段・長時間・再試行が必要な業務処理</p>
              </div>
              <div class="panel accent">
                <h3>リアルタイム協調 / 音声</h3>
                <p class="small">共同編集・マルチプレイ・音声エージェント</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 12. 拡張性 -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="extend-slide">
        <div class="overlay content-overlay">
          <h2>拡張性 — 小さく始めて、無限に伸ばす</h2>
          <div class="stack">
            <div class="content-grid">
              <div class="panel">
                <h3>能力を足す</h3>
                <ul>
                  <li><span class="kw">ツール（function calling）</span>で行動を追加</li>
                  <li><span class="kw">MCP</span>で外部ツールに接続／自分を公開</li>
                  <li>Workflow で長時間処理、HITL で人の承認</li>
                </ul>
              </div>
              <div class="panel accent">
                <h3>規模を伸ばす</h3>
                <ul>
                  <li>インスタンス単位で <span class="kw">世界中に自動分散</span></li>
                  <li>従量課金 — 使わなければほぼ無料</li>
                  <li><span class="kw">マルチエージェント</span>（エージェント同士が連携）</li>
                </ul>
              </div>
            </div>
            <div class="note">プロファイルや設定を <span class="kw">データとして差し替える</span>だけで、用途・世代・言語を横展開できる。</div>
          </div>
        </div>
      </section>

      <!-- 13. Cloudflare完結 vs 外部連携 -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="decision-slide">
        <div class="overlay content-overlay">
          <h2>Cloudflare で完結か、外部と連携か — 見極め</h2>
          <div class="stack">
            <div class="content-grid">
              <div class="panel">
                <h3>Cloudflare 完結が向く</h3>
                <ul>
                  <li>低レイテンシ・即応が最優先（エッジで処理）</li>
                  <li>状態・会話・軽量データで足りる（DO/KV/D1/R2）</li>
                  <li>新規・PoC・小さく始めてグローバル配信</li>
                </ul>
              </div>
              <div class="panel accent">
                <h3>外部（ハイパースケーラー / オンプレ）と連携</h3>
                <ul>
                  <li>基幹DB・業務システムが既に外にある<br>（<span class="kw">データ重力あり</span>）</li>
                  <li>大規模学習・GPU 専用処理・特殊な基盤</li>
                  <li>データ所在・規制（データレジデンシー）</li>
                </ul>
              </div>
            </div>
            <div class="content-grid-3" style="grid-template-columns: repeat(4, minmax(0, 1fr));">
              <div class="panel soft"><h3>Hyperdrive</h3><p class="small">既存 Postgres 等へ低レイテンシ接続</p></div>
              <div class="panel soft"><h3>Tunnel</h3><p class="small">オンプレを穴を開けず安全に接続(<span class="kw">単一方向</span>)</p></div>
              <div class="panel soft"><h3>Mesh</h3><p class="small">バックエンド同士を <span class="kw">相互にメッシュ接続</span></p></div>
              <div class="panel soft"><h3>AI Gateway / MCP</h3><p class="small">外部LLM・外部ツールを集約して呼ぶ</p></div>
            </div>
            <div class="note">基本形：Cloudflare を <span class="kw">「判断と即応の頭」</span>に置き、重い処理や既存データは外部へ委譲。<span class="kw">R2 は下り無料</span>でクラウド間のデータ移動コストも抑えられる。</div>
          </div>
        </div>
      </section>

      <!-- 14. 実例: 家庭教師 -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="example-slide">
        <div class="overlay content-overlay">
          <h2>実例：今回作った「AI 家庭教師」も Agent</h2>
          <div class="stack">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:14px; align-items:start;">
              <div style="display:flex; flex-direction:column; gap:6px; min-height:0;">
                <div class="flow-step"><span class="num">1</span><span>生徒ごとに <span class="kw">1インスタンス</span>（学習状態を記憶）</span></div>
                <div class="flow-step"><span class="num">2</span><span><span class="kw">AIChatAgent</span> で会話を永続化＆ストリーミング</span></div>
                <div class="flow-step"><span class="num">3</span><span>Workers AI（Llama / Whisper）で指導・音声認識</span></div>
                <div class="flow-step"><span class="num">4</span><span><span class="kw">@callable</span> で学年・キャラ設定を切替</span></div>
                <div class="flow-step"><span class="num">5</span><span>Hono で保護者API（認証つき）</span></div>
              </div>
              <div class="panel accent" style="display:flex; flex-direction:column; gap:4px; align-self:start;">
                <h3>Agents だから簡単だったこと</h3>
                <ul>
                  <li>生徒ごとの記憶＝<span class="kw">DOが標準提供</span></li>
                  <li>会話の保存・再開を <span class="kw">書かずに</span>実現</li>
                  <li>設定変更は RPC 一行で即同期</li>
                  <li>世代別への拡張は <span class="kw">設定追加だけ</span></li>
                </ul>
              </div>
            </div>
            <p class="small">構成：Agents SDK（Durable Object）＋ Workers AI ＋ Hono ＋ React。<span class="kw">部品を統合する手間をSDKが引き受ける</span>。</p>
          </div>
        </div>
      </section>

      <!-- 14. まとめ -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="summary-slide">
        <div class="overlay content-overlay">
          <h2>まとめ</h2>
          <div class="stack">
            <div class="content-grid-3">
              <div class="panel">
                <h3>Agent とは</h3>
                <p>記憶 × 自律 × ツールを一体化した、エッジで動く「実体」。</p>
              </div>
              <div class="panel">
                <h3>違いは「統合」</h3>
                <p>部品(Workers AI/DO/…)を <span class="kw">自分で組み合わせず</span>、SDKが一体で提供。</p>
              </div>
              <div class="panel accent">
                <h3>強みは Cloudflare 網</h3>
                <p>推論・記憶・計算が <span class="kw">同じ網</span>で隣接。速く・安く・無限に。</p>
              </div>
            </div>
            <div class="quote">
              小さく始めて、ツール・MCP・ワークフローで無限に伸ばせる。<span class="kw">「動き続ける AI」</span>を作るための最短距離。
            </div>
          </div>
        </div>
      </section>

      <!-- 15. Thank you -->
      <section data-background-image="/slides-assets/cf-template-thankyou.svg" data-background-size="100% 100%" id="thankyou-slide">
        <div class="overlay thankyou-overlay">
          <div>
            <h1>Thank you</h1>
            <p class="thankyou-subtext">Cloudflare Agents = 記憶を持ち、自律的に動く AI を、エッジで組み立てる。</p>
          </div>
        </div>
      </section>

    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.js"></script>
  <script>
    Reveal.initialize({
      width: 1024,
      height: 576,
      margin: 0.02,
      controls: true,
      progress: true,
      slideNumber: true,
      hash: true,
      center: false,
      transition: ''slide''
    });
  </script>
</body>
</html>
',
  16,
  'SYSTEM0000000000000000000A',
  'Cloudflare Field Notes',
  'published',
  'public',
  '["Agents","Workers AI","Edge"]',
  datetime('now'),
  datetime('now')
);
