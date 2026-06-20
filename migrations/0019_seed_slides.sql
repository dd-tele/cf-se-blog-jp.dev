-- Seed: additional public slides + remove the "サンプル" marker from the agents deck.
-- Regenerate with: node scripts/generate-slides-migration.mjs

-- Remove sample marker from the existing agents slide
UPDATE slides
SET event_name = NULL,
    description = '記憶を持ち、自律的に考え、ツールを使う AI エージェントをエッジで動かす。Agents SDK の仕様・ユースケース・拡張性・Workers AI との違いを解説します。',
    updated_at = datetime('now')
WHERE slug = 'cloudflare-agents';

INSERT OR IGNORE INTO slides (
  id, title, slug, description, event_name, presented_at, html, slide_count,
  author_id, author_name_snapshot, status, visibility, tags_json,
  created_at, updated_at
) VALUES (
  'SLIDEAGENTNATIVEINTERNET01',
  'エージェントネイティブインターネット',
  'agent-native-internet',
  'トラフィックはもう AI 中心。エージェントが主役となるインターネットの姿と、その上で Cloudflare が果たす役割を読み解きます。',
  'Mini Session #3',
  NULL,
  '<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>エージェントネイティブインターネット</title>
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

    h1, h2, h3, p, li, td, th, div, span {
      color: inherit;
      margin: 0;
    }

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

    p, li, td, th {
      font-size: 15pt;
      line-height: 1.34;
    }

    .subtext {
      margin-top: 12px;
      font-size: 17pt;
      line-height: 1.34;
      color: var(--cf-muted);
    }

    .meta {
      margin-top: 14px;
      font-size: 13pt;
      color: var(--cf-muted);
    }

    .divider-subtext,
    .thankyou-subtext {
      color: rgba(255, 255, 255, 0.88);
      margin-top: 12px;
      font-size: 18pt;
      line-height: 1.34;
      max-width: 760px;
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

    .content-grid-4 {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }

    .panel {
      background: var(--cf-panel);
      border: 1px solid var(--cf-line);
      border-radius: 12px;
      padding: 12px 14px;
    }

    .panel.soft { background: var(--cf-panel-soft); }

    .panel.accent {
      background: rgba(255, 102, 51, 0.06);
      border: 1px solid rgba(255, 102, 51, 0.35);
    }

    .panel.dim {
      background: rgba(31, 31, 31, 0.04);
      border: 1px dashed rgba(31, 31, 31, 0.25);
      color: var(--cf-muted);
    }

    .badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

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

    .small {
      font-size: 13pt;
      color: var(--cf-muted);
    }

    ul {
      margin: 0;
      padding-left: 1.15em;
    }

    li { margin: 0.15em 0; }

    .stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
      height: 100%;
      min-height: 0;
    }

    .kw {
      color: var(--cf-orange);
      font-weight: 700;
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
    .quote .src a:hover {
      border-bottom-style: solid;
    }

    /* Big stat */
    .big-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 14px;
      background: rgba(255,255,255,0.95);
      border: 1px solid var(--cf-line);
      border-radius: 12px;
      text-align: center;
    }
    .big-stat .num {
      font-size: 38pt;
      font-weight: 700;
      color: var(--cf-orange);
      line-height: 1;
    }
    .big-stat .label {
      margin-top: 8px;
      font-size: 13pt;
      color: var(--cf-muted);
    }

    /* Unicast vs Anycast 比較イラスト */
    .arch-card {
      background: rgba(255,255,255,0.96);
      border: 1px solid var(--cf-line);
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .arch-card.bad { border-color: rgba(178, 34, 34, 0.35); }
    .arch-card.good { border-color: rgba(255, 102, 51, 0.45); background: rgba(255, 102, 51, 0.05); }
    .arch-card h3 { font-size: 15pt; }

    .stack-rows {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: center;
      padding: 4px 0;
    }
    .stack-rows .row {
      display: flex;
      gap: 4px;
    }
    .stack-rows .box {
      width: 36px;
      height: 14px;
      background: rgba(31,31,31,0.18);
      border-radius: 3px;
    }
    .stack-rows .box.cf {
      background: var(--cf-orange);
    }
    .stack-cap {
      font-size: 12pt;
      color: var(--cf-muted);
      text-align: center;
      margin-top: 4px;
    }

    /* Agentic 4-grid primitives */
    .primitive {
      background: rgba(255,255,255,0.96);
      border: 1px solid var(--cf-line);
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .primitive .pname {
      font-size: 12pt;
      font-weight: 700;
      color: var(--cf-orange);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .primitive ul {
      padding-left: 1em;
      font-size: 12pt;
      line-height: 1.35;
      color: var(--cf-text);
    }
    .primitive li { margin: 0.05em 0; }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">

      <!-- 1. Cover -->
      <section data-background-image="/slides-assets/cf-template-cover.svg" data-background-size="100% 100%" id="cover-slide">
        <div class="overlay cover-overlay">
          <h1>エージェントネイティブ<br>インターネット</h1>
          <p class="subtext">トラフィックはもう、AI 中心。<br>その時、インターネットを誰が支えるのか。</p>
          <p class="meta">Mini Session #3 / 15 min &nbsp;·&nbsp; Cloudflare Blog "Agents Week 2026 in Review" より</p>
        </div>
      </section>

      <!-- 2. つかみ: トラフィックはもう AI -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="traffic-shift-slide">
        <div class="overlay content-overlay">
          <h2>"通信の主役" は、いつのまにか AI に変わった</h2>
          <div class="stack">
            <div class="content-grid-3">
              <div class="big-stat">
                <div class="num">人</div>
                <div class="label">これまでの主役<br>ブラウザ・スマホ</div>
              </div>
              <div class="big-stat" style="background: rgba(255,102,51,0.08); border-color: rgba(255,102,51,0.4);">
                <div class="num">AI / Agent</div>
                <div class="label">これからの主役<br>クロール・推論・自律実行</div>
              </div>
              <div class="big-stat">
                <div class="num">24/7</div>
                <div class="label">一人で<br>複数エージェントを並列実行</div>
              </div>
            </div>
            <div class="quote">
              一人の知的労働者が並列で数体のエージェントを動かしただけでも、<span class="kw">何千万もの同時セッション</span>分の計算容量が必要になる。
              <span class="src">— Cloudflare Blog,
                <a href="https://blog.cloudflare.com/agents-week-in-review/" target="_blank" rel="noopener">Agents Week 2026 in Review</a>
              </span>
            </div>
            <p class="small">正当なトラフィックも、攻撃トラフィックも、その多くを AI が占める時代に入った。</p>
          </div>
        </div>
      </section>

      <!-- 3. クラウドの前提が壊れた -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="cloud-broken-slide">
        <div class="overlay content-overlay">
          <h2>"これまでのクラウド" の前提が、壊れた</h2>
          <div class="stack">
            <div class="quote">
              クラウドが前提としていた "1 つのアプリが大勢のユーザーをさばく" モデルは、エージェント時代には<span class="kw">通用しない</span>。
              <span class="src">— Cloudflare Blog,
                <a href="https://blog.cloudflare.com/agents-week-in-review/" target="_blank" rel="noopener">Agents Week 2026 in Review</a>
                (the one-app-serves-many-users model doesn''t work)
              </span>
            </div>
            <div class="content-grid">
              <div class="panel">
                <h3>これまで (人間中心)</h3>
                <ul>
                  <li>1 アプリ : 多ユーザー (1:N)</li>
                  <li>セッション数はせいぜい同時数百〜数千</li>
                  <li>アクセスは断続的・人の操作速度</li>
                </ul>
              </div>
              <div class="panel accent">
                <h3>これから (エージェント中心)</h3>
                <ul>
                  <li>1 アプリ : <span class="kw">N エージェント × M ユーザー</span></li>
                  <li>同時セッションは <span class="kw">数千万オーダー</span></li>
                  <li>24/7 連続・マシン速度</li>
                </ul>
              </div>
            </div>
            <div class="note"><span class="kw">Cloud 2.0 = エージェントを主要ワークロードとして設計されたインフラ</span> が必要になる。</div>
          </div>
        </div>
      </section>

      <!-- 4. 他社の対応は無理がある: ユニキャストの限界 -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="unicast-problem-slide">
        <div class="overlay content-overlay">
          <h2>他社の AI 対応 = "ユニキャスト+増強" の悪コスト構造</h2>
          <div class="stack">
            <div class="content-grid">
              <div class="arch-card bad">
                <h3>従来クラウド (ユニキャスト前提)</h3>
                <div class="stack-rows">
                  <div class="row">
                    <div class="box"></div><div class="box"></div><div class="box"></div>
                  </div>
                  <div class="row">
                    <div class="box"></div><div class="box"></div><div class="box"></div><div class="box"></div><div class="box"></div>
                  </div>
                  <div class="row">
                    <div class="box"></div><div class="box"></div><div class="box"></div><div class="box"></div><div class="box"></div><div class="box"></div><div class="box"></div>
                  </div>
                  <div class="stack-cap">顧客 / 顧客グループごとに専用サーバーを積み増す</div>
                </div>
                <ul>
                  <li>需要が読めない → <span class="kw">過剰プロビジョニング</span></li>
                  <li>リージョン跨ぎは別契約・別構成</li>
                  <li>ピーク時 GPU の取り合い</li>
                  <li>コストは <span class="kw">線形〜超線形</span>に膨らむ</li>
                </ul>
              </div>
              <div class="arch-card good">
                <h3>Cloudflare (Anycast + 共有エッジ)</h3>
                <div class="stack-rows">
                  <div class="row">
                    <div class="box cf"></div><div class="box cf"></div><div class="box cf"></div><div class="box cf"></div><div class="box cf"></div>
                  </div>
                  <div class="row">
                    <div class="box cf"></div><div class="box cf"></div><div class="box cf"></div><div class="box cf"></div><div class="box cf"></div>
                  </div>
                  <div class="stack-cap"><span class="kw">同じ "鉄"</span> がすべての顧客に同時に役立つ</div>
                </div>
                <ul>
                  <li>330+ 都市で <span class="kw">需要を平準化</span></li>
                  <li>Workers = ミリ秒起動の Isolate、無限近傍に増殖可能</li>
                  <li>追加顧客の限界費用が <span class="kw">ほぼゼロ</span>に近づく</li>
                  <li>需要に応じて <span class="kw">自動でスケール</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 5. Divider Part 01 -->
      <section data-background-image="/slides-assets/cf-template-divider.svg" data-background-size="100% 100%" id="divider-1">
        <div class="overlay divider-overlay">
          <div class="kicker">Part 01</div>
          <h1>Cloudflare は 8 年前から<br>"これ" を作っていた</h1>
          <p class="divider-subtext">コンテナレスでサーバーレス。Anycast でグローバル。エージェント時代に合わせて作られたかのような基盤。</p>
        </div>
      </section>

      <!-- 6. Workers の "意図せず最適" だった構造 -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="ready-made-slide">
        <div class="overlay content-overlay">
          <h2>偶然ではなく必然: Workers が "エージェント向き" だった理由</h2>
          <div class="stack">
            <div class="quote">
              8 年前に Workers として立ち上げた "コンテナレス・サーバーレス" のコンピュート基盤は、<span class="kw">まさにこの瞬間のために用意されていた</span>。
              <span class="src">— Cloudflare Blog,
                <a href="https://blog.cloudflare.com/agents-week-in-review/" target="_blank" rel="noopener">Agents Week 2026 in Review</a>
                (ready-made for this moment)
              </span>
            </div>
            <div class="content-grid-3">
              <div class="panel">
                <h3>ミリ秒起動</h3>
                <p>Isolate ベースで <span class="kw">コールドスタートほぼゼロ</span>。エージェントの瞬発的な呼び出しに合う。</p>
              </div>
              <div class="panel">
                <h3>数千万の同時実行</h3>
                <p>同じネットワーク上で <span class="kw">無限近傍にインスタンスを生やせる</span>。1:N ではなく N:N。</p>
              </div>
              <div class="panel accent">
                <h3>世界中で同じ実行</h3>
                <p>330+ 都市の <span class="kw">同じ "鉄"</span> 上で同じ Worker が動く。ユーザーの隣に AI を置ける。</p>
              </div>
            </div>
            <div class="note">他社が「AI 用に作り直し中」のものを、<span class="kw">Cloudflare は最初から運用している</span>。</div>
          </div>
        </div>
      </section>

      <!-- 7. Agents Week で揃った "agentic primitives" -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="primitives-slide">
        <div class="overlay content-overlay">
          <h2>Agents Week 2026: エージェントの "全部" が揃った</h2>
          <div class="stack">
            <div class="content-grid-4">
              <div class="primitive">
                <span class="pname">Compute</span>
                <ul>
                  <li>Sandboxes (GA)</li>
                  <li>Artifacts (Git for agents)</li>
                  <li>Dynamic Workers + DO Facets</li>
                  <li>Workflows v2 (5万並行)</li>
                </ul>
              </div>
              <div class="primitive">
                <span class="pname">Security</span>
                <ul>
                  <li>Cloudflare Mesh</li>
                  <li>Managed OAuth for Access</li>
                  <li>Non-human ID 管理</li>
                  <li>Enterprise MCP 基準</li>
                </ul>
              </div>
              <div class="primitive">
                <span class="pname">Toolbox</span>
                <ul>
                  <li>Agents SDK / Project Think</li>
                  <li>Agent Memory</li>
                  <li>AI Search · Voice · Email</li>
                  <li>Browser Run</li>
                </ul>
              </div>
              <div class="primitive">
                <span class="pname">Agentic Web</span>
                <ul>
                  <li>Agent Readiness Score</li>
                  <li>Redirects for AI Training</li>
                  <li>FL2 (Rust 化で +60%)</li>
                  <li>Shared Dictionary 圧縮</li>
                </ul>
              </div>
            </div>
            <div class="note">エージェントを作る・走らせる・守る・流す。<span class="kw">スタック全レイヤーの "プリミティブ" を一週間で同時投入</span>。</div>
          </div>
        </div>
      </section>

      <!-- 8. Agentic Web - ウェブ自体が変わる -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="agentic-web-slide">
        <div class="overlay content-overlay">
          <h2>"エージェント向けのウェブ" という新しいレイヤー</h2>
          <div class="stack">
            <div class="quote">
              ウェブは "人間用" として作られた。エージェントが多数派になる世界では、<span class="kw">ウェブそのものを作り直す</span>必要がある。
              <span class="src">— Cloudflare Blog,
                <a href="https://blog.cloudflare.com/agents-week-in-review/" target="_blank" rel="noopener">Agents Week 2026 in Review</a>
                (the agentic web)
              </span>
            </div>
            <div class="content-grid">
              <div class="panel">
                <h3>サイト側に必要なこと</h3>
                <ul>
                  <li><span class="kw">Agent Readiness Score</span> — 自サイトはエージェント対応か</li>
                  <li><span class="kw">どの bot に何を許すか</span>を細かく制御</li>
                  <li>古い情報をクロールさせない (Redirects for AI Training)</li>
                  <li>エージェント向けに <span class="kw">構造化して提示</span></li>
                </ul>
              </div>
              <div class="panel accent">
                <h3>ネットワーク側に必要なこと</h3>
                <ul>
                  <li><span class="kw">MCP の運用基盤</span> (Access / Gateway / AI Gateway)</li>
                  <li>Shadow MCP の検知</li>
                  <li>共有辞書圧縮で <span class="kw">マシン間通信を高速化</span></li>
                  <li>FL2: Rust で再構築されたエッジリクエスト処理</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 9. Divider Part 02 -->
      <section data-background-image="/slides-assets/cf-template-divider.svg" data-background-size="100% 100%" id="divider-2">
        <div class="overlay divider-overlay">
          <div class="kicker">Part 02</div>
          <h1>エージェントネイティブ<br>インターネット、を作れるのは誰か</h1>
          <p class="divider-subtext">スケール構造・経済構造・ウェブ構造。3 つを同時に持っているプレイヤーは限られる。</p>
        </div>
      </section>

      <!-- 10. なぜ Cloudflare がファーストチョイスになるのか -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="why-first-choice-slide">
        <div class="overlay content-overlay">
          <h2>"ファーストチョイス" になり得る、構造的な 3 つの理由</h2>
          <div class="stack">
            <div class="content-grid-3">
              <div class="panel">
                <h3>① スケール構造</h3>
                <p>Anycast + Isolate で <span class="kw">1:N ではなく N:N</span>。エージェント数が爆発しても <span class="kw">追加コストが線形にならない</span>。</p>
              </div>
              <div class="panel">
                <h3>② 経済構造</h3>
                <p>顧客ごとサーバー増強 ではなく <span class="kw">同じ "鉄" を全員で使う</span>。ピーク差を世界中で吸収。</p>
              </div>
              <div class="panel accent">
                <h3>③ ウェブ構造</h3>
                <p>すでに <span class="kw">世界のウェブの 1/5</span> が Cloudflare 経由。Agentic Web の <span class="kw">標準を決める位置</span>にいる。</p>
              </div>
            </div>
            <div class="quote">
              我々が作っているのは Cloud 2.0 — <span class="kw">エージェントが主要ワークロードとなる世界のためのインフラ</span> である。
              <span class="src">— Cloudflare Blog,
                <a href="https://blog.cloudflare.com/agents-week-in-review/" target="_blank" rel="noopener">Agents Week 2026 in Review</a>
              </span>
            </div>
            <p class="small">この 3 つを <span class="kw">同時に</span>持っているのは事実上 Cloudflare だけ。AI 時代のインターネットの "土台" にそのまま入っていく可能性が高い。</p>
          </div>
        </div>
      </section>

      <!-- 11. 持ち帰っていただきたいこと -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="takeaway-slide">
        <div class="overlay content-overlay">
          <h2>持ち帰っていただきたいこと</h2>
          <div class="stack">
            <div class="content-grid">
              <div class="panel accent">
                <h3>頭の片隅に置いておきたい一言</h3>
                <ul>
                  <li>「<span class="kw">AI 対応をユニキャストで増強し続ける構造</span>、もう限界が近い」</li>
                  <li>「Cloudflare は <span class="kw">8 年前から</span>この時代のために作られていた」</li>
                  <li>「<span class="kw">同じ網に AI もエージェントも乗せられる</span> のは Cloudflare だけ」</li>
                </ul>
              </div>
              <div class="panel">
                <h3>これからの見方の "アングル"</h3>
                <ul>
                  <li>"AI 導入" は、<span class="kw">インフラそのものを問い直す</span>タイミング</li>
                  <li>WAF / SASE / Workers / Agents は <span class="kw">同じ網の話</span>として地続きで見る</li>
                  <li>Agentic Web (bot 制御 / MCP / Agent Readiness) は <span class="kw">これからの入り口</span>になる</li>
                </ul>
              </div>
            </div>
            <div class="note">エージェントネイティブインターネットは、これから 10 年で静かに進む <span class="kw">インフラ層の世代交代</span>。その入口を、いま一緒に見ています。</div>
          </div>
        </div>
      </section>

      <!-- 12. Thank you -->
      <section data-background-image="/slides-assets/cf-template-thankyou.svg" data-background-size="100% 100%" id="thankyou-slide">
        <div class="overlay thankyou-overlay">
          <div>
            <h1>Thank you</h1>
            <p class="thankyou-subtext">エージェントネイティブインターネット = Cloud 2.0 の、最初の現実</p>
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
  12,
  'SYSTEM0000000000000000000A',
  'Cloudflare Field Notes',
  'published',
  'public',
  '["Agents","AI","Internet"]',
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO slides (
  id, title, slug, description, event_name, presented_at, html, slide_count,
  author_id, author_name_snapshot, status, visibility, tags_json,
  created_at, updated_at
) VALUES (
  'SLIDECLOUDFLAREMESH0000001',
  'もう WAN は不要？ Cloudflare Mesh',
  'cloudflare-mesh',
  '柔軟性と、AI 実行環境の安全な相互接続。従来の WAN に代わる Cloudflare Mesh のアーキテクチャと考え方を解説します。',
  'Interop 2026',
  NULL,
  '<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>もう WAN は不要？ Cloudflare Mesh</title>
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

    h1, h2, h3, p, li, td, th, div, span {
      color: inherit;
      margin: 0;
    }

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

    p, li, td, th {
      font-size: 15pt;
      line-height: 1.34;
    }

    .subtext {
      margin-top: 12px;
      font-size: 17pt;
      line-height: 1.34;
      color: var(--cf-muted);
    }

    .meta {
      margin-top: 14px;
      font-size: 13pt;
      color: var(--cf-muted);
    }

    .divider-subtext,
    .thankyou-subtext {
      color: rgba(255, 255, 255, 0.88);
      margin-top: 12px;
      font-size: 18pt;
      line-height: 1.34;
      max-width: 760px;
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
    }

    .panel.soft { background: var(--cf-panel-soft); }

    .panel.accent {
      background: rgba(255, 102, 51, 0.06);
      border: 1px solid rgba(255, 102, 51, 0.35);
    }

    .badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

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

    .small {
      font-size: 13pt;
      color: var(--cf-muted);
    }

    ul {
      margin: 0;
      padding-left: 1.15em;
    }

    li { margin: 0.15em 0; }

    .stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
      height: 100%;
      min-height: 0;
    }

    .kw {
      color: var(--cf-orange);
      font-weight: 700;
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
    .quote .src a:hover {
      border-bottom-style: solid;
    }

    /* シンプルコードブロック */
    pre.code {
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid var(--cf-line);
      border-radius: 0 10px 10px 10px;
      padding: 10px 14px;
      margin: 0;
      font-family: "JetBrains Mono", ui-monospace, Menlo, monospace;
      font-size: 10pt;
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

    /* Mesh 構成ノード図 */
    .mesh-diagram {
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid var(--cf-line);
      border-radius: 12px;
      padding: 14px 16px;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 14px;
      align-items: center;
    }
    .mesh-side {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .mesh-node {
      padding: 8px 10px;
      background: rgba(255, 102, 51, 0.06);
      border: 1px solid rgba(255, 102, 51, 0.30);
      border-radius: 8px;
      font-size: 12pt;
      text-align: center;
    }
    .mesh-node .nlabel {
      display: block;
      font-size: 10pt;
      color: var(--cf-muted);
      margin-top: 2px;
      font-weight: 500;
    }
    .mesh-center {
      width: 110px;
      padding: 14px 8px;
      background: var(--cf-orange);
      color: #fff;
      border-radius: 12px;
      text-align: center;
      font-weight: 700;
      font-size: 13pt;
      line-height: 1.3;
    }
    .mesh-center .csub {
      display: block;
      font-size: 10pt;
      opacity: 0.9;
      margin-top: 4px;
      font-weight: 500;
    }

    /* ステップカード */
    .stat-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .stat-box {
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid var(--cf-line);
      border-radius: 12px;
      padding: 12px;
      text-align: center;
    }
    .stat-box .num {
      font-size: 28pt;
      font-weight: 700;
      color: var(--cf-orange);
      line-height: 1;
    }
    .stat-box .label {
      margin-top: 6px;
      font-size: 13pt;
      color: var(--cf-text);
      font-weight: 600;
    }
    .stat-box .desc {
      margin-top: 4px;
      font-size: 11.5pt;
      color: var(--cf-muted);
      line-height: 1.3;
    }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">

      <!-- 1. Cover -->
      <section data-background-image="/slides-assets/cf-template-cover.svg" data-background-size="100% 100%" id="cover-slide">
        <div class="overlay cover-overlay">
          <h1>もう WAN は不要？<br>Cloudflare Mesh</h1>
          <p class="subtext">柔軟性と、AI 実行環境の安全な相互接続。<br>"つなぐ" の前提が、変わりはじめている。</p>
          <p class="meta">Mini Session #1 / 15 min &nbsp;·&nbsp; Cloudflare Blog "introducing Cloudflare Mesh" より</p>
        </div>
      </section>

      <!-- 2. つかみ: クライアントが変わった -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="clients-changed-slide">
        <div class="overlay content-overlay">
          <h2>"つながりたいクライアント" が、変わった</h2>
          <div class="stack">
            <div class="quote">
              プライベートネットワークの命題は変わっていない。<span class="kw">変わったのは "クライアントが誰か"</span> だ。
              <span class="src">— Cloudflare Blog,
                <a href="https://blog.cloudflare.com/mesh/" target="_blank" rel="noopener">introducing Cloudflare Mesh</a>
              </span>
            </div>
            <div class="content-grid">
              <div class="panel">
                <h3>これまで (1 年前)</h3>
                <ul>
                  <li>クライアント = <span class="kw">開発者・サービス</span></li>
                  <li>VPN にログインしてアクセス</li>
                  <li>SSH トンネル / 拠点 VPN で接続</li>
                  <li>必要なときに、人が判断して繋ぐ</li>
                </ul>
              </div>
              <div class="panel accent">
                <h3>これから</h3>
                <ul>
                  <li>クライアント = <span class="kw">エージェント</span></li>
                  <li>自律的に動き、勝手に呼び、勝手に取得</li>
                  <li>VPN / SSH / 公開は <span class="kw">人間用に作られたツール</span></li>
                  <li>エージェント時代の "つなぐ" には合わない</li>
                </ul>
              </div>
            </div>
            <p class="small">コーディングエージェントはステージング DB を叩き、本番エージェントは内部 API を呼ぶ。<span class="kw">"つなぐ" の前提が変わる</span>と、WAN の前提も変わる。</p>
          </div>
        </div>
      </section>

      <!-- 3. 既存の "つなぐ" 手段の限界 -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="legacy-limit-slide">
        <div class="overlay content-overlay">
          <h2>VPN / SSH トンネル / 公開 — それぞれの "つらみ"</h2>
          <div class="stack">
            <div class="content-grid-3">
              <div class="panel">
                <h3>VPN</h3>
                <ul>
                  <li>対話的ログインが必要</li>
                  <li>端末まるごと社内網へ</li>
                  <li>"自律エージェント" には不向き</li>
                </ul>
              </div>
              <div class="panel">
                <h3>SSH トンネル</h3>
                <ul>
                  <li>毎回の手動セットアップ</li>
                  <li>誰が何にアクセスしたか追えない</li>
                  <li>スケールしない</li>
                </ul>
              </div>
              <div class="panel">
                <h3>公開してしまう</h3>
                <ul>
                  <li>セキュリティリスクが直撃</li>
                  <li>1 つの設定ミスで全部抜ける</li>
                  <li>監査・観測が分断</li>
                </ul>
              </div>
            </div>
            <div class="note">
              いずれも <span class="kw">"接続できた後" の可視化がない</span>。エージェントが何をしたかを、ネットワーク側で押さえられない。
            </div>
          </div>
        </div>
      </section>

      <!-- 4. Divider Part 01 -->
      <section data-background-image="/slides-assets/cf-template-divider.svg" data-background-size="100% 100%" id="divider-1">
        <div class="overlay divider-overlay">
          <div class="kicker">Part 01</div>
          <h1>Cloudflare Mesh<br>— 新しい "プライベート網" の作り方</h1>
          <p class="divider-subtext">ユーザー・エージェント・Workers・VPC が、同じネットワークで<br>会話する世界。</p>
        </div>
      </section>

      <!-- 5. Mesh とは -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="what-mesh-slide">
        <div class="overlay content-overlay">
          <h2>Cloudflare Mesh とは</h2>
          <div class="stack">
            <div class="quote">
              新しい技術パラダイムは要らない。エージェント時代に合わせて作られた SASE が必要で、それが Cloudflare One。
              <span class="src">— Cloudflare Blog,
                <a href="https://blog.cloudflare.com/mesh/" target="_blank" rel="noopener">introducing Cloudflare Mesh</a>
              </span>
            </div>
            <div class="mesh-diagram">
              <div class="mesh-side">
                <div class="mesh-node">PC / スマホ<span class="nlabel">Cloudflare One Client</span></div>
                <div class="mesh-node">拠点・サーバー<span class="nlabel">Mesh node (旧 WARP Connector)</span></div>
                <div class="mesh-node">クラウド VPC<span class="nlabel">Mesh node on VM / 各クラウド</span></div>
              </div>
              <div class="mesh-center">Cloudflare<br>Mesh<span class="csub">330+ 都市の<br>グローバル網</span></div>
              <div class="mesh-side">
                <div class="mesh-node">Workers / Durable Objects<span class="nlabel">Workers VPC binding</span></div>
                <div class="mesh-node">AI エージェント<span class="nlabel">Agents SDK on Workers</span></div>
                <div class="mesh-node">プライベート API / DB<span class="nlabel">社内・MCP サーバー</span></div>
              </div>
            </div>
            <p class="small">1 本のコネクタ・1 つのバイナリで、すべての "つなぎたいもの" を同じプライベート網に。<br><span class="kw">既存の Gateway / Access / Posture が、そのまま Mesh トラフィックにも効く</span>。</p>
          </div>
        </div>
      </section>

      <!-- 5.5 トランジション: Tunnel から Mesh へ -->
      <section data-background-image="/slides-assets/cf-template-divider.svg" data-background-size="100% 100%" id="transition-tunnel-mesh">
        <div class="overlay divider-overlay">
          <h1>Tunnel から、Mesh へ</h1>
          <p class="divider-subtext">ひとつの安全な接続を張る <strong>Tunnel</strong> が原点。<br>それを多対多のプライベート網へ広げたのが <strong>Mesh</strong>。</p>
        </div>
      </section>

      <!-- 6. Tunnel と Mesh の違い -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="tunnel-vs-mesh-slide">
        <div class="overlay content-overlay">
          <h2>Cloudflare Tunnel と Cloudflare Mesh の違い</h2>
          <p class="small" style="margin-top:-2px;"><strong>Tunnel は双方向こそ持たないが、公開サーバーを完全に守って公開できる。</strong> 内部を双方向につなぐのが Mesh。</p>
          <div class="stack">
            <div class="content-grid">
              <div class="panel">
                <h3>Cloudflare Tunnel</h3>
                <ul>
                  <li><span class="kw">単方向</span>の経路に最適</li>
                  <li>エッジから特定の私設サービスへプロキシ</li>
                  <li>Web サーバーや DB を外から守って公開する用途</li>
                  <li>サービス 1 件ごとに 1 本（設計によります）</li>
                </ul>
              </div>
              <div class="panel accent">
                <h3>Cloudflare Mesh</h3>
                <ul>
                  <li><span class="kw">双方向・多対多</span>のプライベート網</li>
                  <li>Mesh 上の全ノードが <span class="kw">プライベート IP で相互到達</span></li>
                  <li>1 つの繋ぎ込みで、サービス・人・AI が全部見える</li>
                  <li>各リソースごとに Tunnel を張る必要はない</li>
                </ul>
              </div>
            </div>
            <div class="note">"出す" 用途は Tunnel、"組織まるごとのプライベート網" は Mesh。<span class="kw">用途で使い分ける</span>のが今の正解。</div>
          </div>
        </div>
      </section>

      <!-- 6.5 用途分けと連携イメージ -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="tunnel-mesh-flow-slide">
        <div class="overlay content-overlay">
          <h2>用途で使い分け、ひとつの網で連携する</h2>
          <p class="small" style="margin-top:-2px;">"外に出すや単一拠点への接続" は Tunnel、"内側でつなぐ" は Mesh。<span class="kw">どちらも同じ Cloudflare One 上</span>。</p>

          <!-- Tunnel レーン -->
          <div style="border-left:4px solid #0A6CFF; background:rgba(10,108,255,0.05); border-radius:0 10px 10px 0; padding:9px 14px; margin-top:10px;">
            <div style="font-size:11pt; font-weight:700; color:#0A6CFF; margin-bottom:7px; letter-spacing:0.02em;">CLOUDFLARE TUNNEL &nbsp;·&nbsp; 公開、単一拠点（ingress）</div>
            <div style="display:grid; grid-template-columns:1fr 26px 140px 26px 1fr; align-items:center; gap:6px;">
              <div style="background:rgba(255,255,255,0.95); border:1px solid var(--cf-line); border-radius:9px; padding:8px 10px; text-align:center; font-size:12pt; font-weight:600;">インターネット<br>社員 / 外部ユーザー</div>
              <div style="text-align:center; font-size:18pt; color:var(--cf-muted);">→</div>
              <div style="background:#0A6CFF; color:#fff; border-radius:9px; padding:9px 8px; text-align:center; font-size:11.5pt; font-weight:700; line-height:1.25;">Cloudflare<br>Tunnel<span style="display:block; font-size:9pt; opacity:0.9; font-weight:500;">cloudflared</span></div>
              <div style="text-align:center; font-size:18pt; color:var(--cf-muted);">→</div>
              <div style="background:rgba(255,255,255,0.95); border:1px solid var(--cf-line); border-radius:9px; padding:8px 10px; text-align:center; font-size:12pt; font-weight:600;">公開 Web サーバー / 単一拠点<span style="display:block; font-size:10pt; color:var(--cf-muted); font-weight:500;">self-hosted を公開、または特定拠点へ<br>限定プライベート接続</span></div>
            </div>
          </div>

          <!-- Mesh レーン -->
          <div style="border-left:4px solid var(--cf-orange); background:rgba(255,102,51,0.06); border-radius:0 10px 10px 0; padding:9px 14px; margin-top:10px;">
            <div style="font-size:11pt; font-weight:700; color:var(--cf-orange); margin-bottom:7px; letter-spacing:0.02em;">CLOUDFLARE MESH &nbsp;·&nbsp; リソースを繋ぐ（private）</div>
            <div style="display:grid; grid-template-columns:1fr 26px 140px 26px 1fr; align-items:center; gap:6px;">
              <div style="background:rgba(255,255,255,0.95); border:1px solid var(--cf-line); border-radius:9px; padding:8px 10px; text-align:center; font-size:12pt; font-weight:600;">社員・拠点・クラウド<br>Workers / AI エージェント</div>
              <div style="text-align:center; font-size:18pt; color:var(--cf-orange);">↔</div>
              <div style="background:var(--cf-orange); color:#fff; border-radius:9px; padding:9px 8px; text-align:center; font-size:11.5pt; font-weight:700; line-height:1.25;">Cloudflare<br>Mesh<span style="display:block; font-size:9pt; opacity:0.9; font-weight:500;">プライベートIPで相互到達</span></div>
              <div style="text-align:center; font-size:18pt; color:var(--cf-orange);">↔</div>
              <div style="background:rgba(255,255,255,0.95); border:1px solid var(--cf-line); border-radius:9px; padding:8px 10px; text-align:center; font-size:12pt; font-weight:600;">内部 API・DB<br>MCP サーバー<span style="display:block; font-size:10pt; color:var(--cf-muted); font-weight:500;">公開せず内部限定</span></div>
            </div>
          </div>

          <!-- 連携(共通基盤)バンド -->
          <div style="margin-top:10px; text-align:center; background:rgba(31,31,31,0.05); border:1px dashed var(--cf-line); border-radius:10px; padding:8px 14px; font-size:12.5pt;">
            同じ <span class="kw">Cloudflare One</span> のグローバル網 — <strong>Gateway / Access / Posture</strong> が<span class="kw">両方のトラフィックに同じく適用</span>。だから併用しても運用・監査は一元化。
          </div>
        </div>
      </section>

      <!-- 6.6 実例: 公開SaaS × 内部私設網のひと続き構成 -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="tunnel-mesh-value-slide">
        <div class="overlay content-overlay">
          <h2>実例 — 公開は Tunnel、内部リソースを Mesh で繋ぐ</h2>
          <p class="small" style="margin-top:-2px;">構成例。<span class="kw">公開サイトを Tunnel で守り</span>、その同じバックエンドが <span class="kw">Mesh の私設網</span>(マルチクラウド + AI)</p>

          <!-- 公開レーン (Tunnel) -->
          <div style="background:rgba(10,108,255,0.05); border:1px solid rgba(10,108,255,0.25); border-radius:10px; padding:10px 14px; margin-top:10px;">
            <div style="font-size:10.5pt; font-weight:700; color:#0A6CFF; margin-bottom:7px; letter-spacing:0.02em;">公開（顧客向け SaaS / Web サイト）</div>
            <div style="display:grid; grid-template-columns:auto 22px 1fr 22px auto 22px auto; align-items:center; gap:6px;">
              <div style="background:#fff; border:1px solid var(--cf-line); border-radius:8px; padding:7px 9px; text-align:center; font-size:11pt; font-weight:600; line-height:1.2;">顧客 /<br>エンドユーザー</div>
              <div style="text-align:center; font-size:16pt; color:#0A6CFF;">→</div>
              <div style="background:#0A6CFF; color:#fff; border-radius:8px; padding:8px 9px; text-align:center; font-size:11pt; font-weight:700; line-height:1.25;">Cloudflare エッジ<span style="display:block; font-size:9pt; opacity:0.92; font-weight:500;">WAF · DDoS · Bot · Access</span></div>
              <div style="text-align:center; font-size:16pt; color:#0A6CFF;">→</div>
              <div style="background:#0A6CFF; color:#fff; border-radius:8px; padding:8px 9px; text-align:center; font-size:11pt; font-weight:700; line-height:1.25;">Tunnel<span style="display:block; font-size:9pt; opacity:0.92; font-weight:500;">受信ポートなし<br>オリジンIP秘匿で直撃遮断</span></div>
              <div style="text-align:center; font-size:16pt; color:var(--cf-muted);">→</div>
              <div id="bridge-node" style="background:#FFF7E6; border:2px solid var(--cf-orange); border-radius:8px; padding:7px 9px; text-align:center; font-size:11pt; font-weight:700; line-height:1.2;">公開 SaaS<br>バックエンド</div>
            </div>
          </div>

          <!-- 接点 -->
          <div style="text-align:center; font-size:11.5pt; color:var(--cf-muted); margin:5px 0 3px;">↑↓ &nbsp;<span class="kw">同じバックエンドが Mesh のノードでもある</span>（公開と内部がここで繋がる）</div>

          <!-- 内部レーン (Mesh) -->
          <div style="background:rgba(255,102,51,0.06); border:1px solid rgba(255,102,51,0.30); border-radius:10px; padding:10px 14px;">
            <div style="font-size:10.5pt; font-weight:700; color:var(--cf-orange); margin-bottom:7px; letter-spacing:0.02em;">内部私設網（Cloudflare Mesh ─ プライベートIPで相互到達）</div>
            <div style="display:grid; grid-template-columns:auto 18px 1fr 18px 1fr 18px 1fr; align-items:center; gap:6px;">
              <div style="background:#FFF7E6; border:2px solid var(--cf-orange); border-radius:8px; padding:7px 8px; text-align:center; font-size:10.5pt; font-weight:700; line-height:1.2;">公開 SaaS<br>バックエンド</div>
              <div style="text-align:center; font-size:15pt; color:var(--cf-orange);">↔</div>
              <div style="background:#fff; border:1px solid var(--cf-line); border-radius:8px; padding:7px 8px; text-align:center; font-size:10.5pt; font-weight:600; line-height:1.2;">AWS VPC /<br>GCP VPC</div>
              <div style="text-align:center; font-size:15pt; color:var(--cf-orange);">↔</div>
              <div style="background:#fff; border:1px solid var(--cf-line); border-radius:8px; padding:7px 8px; text-align:center; font-size:10.5pt; font-weight:600; line-height:1.2;">Workers /<br>AI エージェント</div>
              <div style="text-align:center; font-size:15pt; color:var(--cf-orange);">↔</div>
              <div style="background:#fff; border:1px solid var(--cf-line); border-radius:8px; padding:7px 8px; text-align:center; font-size:10.5pt; font-weight:600; line-height:1.2;">社内 API ·<br>DB · MCP</div>
            </div>
          </div>

          <div class="note" style="margin-top:12px;"><strong>セキュリティはひとつに統合。</strong> 外からの攻撃は <span class="kw">WAF / DDoS / Bot</span>、Tunnel が <span class="kw">IP 直攻撃を遮断</span>、<br>内部アクセスは <span class="kw">Access / Posture</span> ── 公開も私設網も、同じゼロトラストで守れる。</div>
        </div>
      </section>

      <!-- 7. なぜ Cloudflare の網が効くのか -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="why-network-slide">
        <div class="overlay content-overlay">
          <h2>"Cloudflare の網が、そのまま経路" になる強み</h2>
          <div class="stack">
            <div class="quote">
              すべての Mesh トラフィックは Cloudflare のグローバル網を経由する。<span class="kw">"Cloudflare のエッジが、その経路そのもの"</span> だ。
              <span class="src">— Cloudflare Blog,
                <a href="https://blog.cloudflare.com/mesh/" target="_blank" rel="noopener">introducing Cloudflare Mesh</a>
              </span>
            </div>
            <div class="content-grid-3">
              <div class="panel">
                <h3>NAT 越え不要</h3>
                <p>NAT 配下同士の通信で <span class="kw">リレーサーバーを自前で持つ必要なし</span>。Cloudflare 経由で一発で繋がる。</p>
              </div>
              <div class="panel">
                <h3>遅延の安定</h3>
                <p>マルチクラウド・拠点間も <span class="kw">パブリック網よりも安定して低遅延</span>。落ちた時のフォールバック経路も同じ網内。</p>
              </div>
              <div class="panel accent">
                <h3>セキュリティ同梱</h3>
                <p>すべてのパケットが <span class="kw">Cloudflare のセキュリティスタックを通る</span>。Gateway / DLP / Posture が "つなぐ" と同じ場所で効く。</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 8. AI エージェントのプライベート網接続 (Workers VPC) -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="workers-vpc-slide">
        <div class="overlay content-overlay">
          <h2>Workers / エージェントから、プライベート網に直接つなぐ</h2>
          <div class="stack">
            <p class="small">Workers VPC を Mesh と統合。Workers / Durable Objects / Agents SDK のコードから <span class="kw">プライベート IP に直接 fetch</span> できる。</p>
            <span class="code-tab">wrangler.jsonc &nbsp;+&nbsp; worker.ts</span>
<pre class="code"><span class="c">// wrangler.jsonc — Mesh ネットワーク全体を Worker にバインド</span>
<span class="s">"vpc_networks"</span>: [
  { <span class="s">"binding"</span>: <span class="s">"MESH"</span>, <span class="s">"network_id"</span>: <span class="s">"cf1:network"</span>, <span class="s">"remote"</span>: <span class="k">true</span> }
]

<span class="c">// worker.ts — エージェントが社内 API / DB を呼ぶ</span>
<span class="k">export default</span> {
  <span class="k">async</span> <span class="f">fetch</span>(req, env) {
    <span class="k">const</span> r = <span class="k">await</span> env.MESH.<span class="f">fetch</span>(<span class="s">"http://10.0.1.50/api/data"</span>);
    <span class="k">return</span> <span class="k">new</span> <span class="f">Response</span>(<span class="k">await</span> r.<span class="f">text</span>());
  }
};</pre>
            <div class="note">エージェントが <span class="kw">トンネル設定なしで</span> 社内 DB・内部 API・MCP サーバーに到達できる。ネットワーク側の認可と監査はそのまま効く。</div>
          </div>
        </div>
      </section>

      <!-- 9. これからの拡張 -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="whats-next-slide">
        <div class="overlay content-overlay">
          <h2>これから来るもの — Mesh のロードマップ</h2>
          <div class="stack">
            <div class="content-grid">
              <div class="panel">
                <h3>Hostname routing / Mesh DNS</h3>
                <ul>
                  <li>IP ではなく <span class="kw">名前</span>でルーティング</li>
                  <li>例: <code>ssh postgres-staging.mesh</code></li>
                  <li>動的 IP・auto-scaling・ephemeral コンテナでも安心</li>
                </ul>
              </div>
              <div class="panel">
                <h3>Identity-aware routing</h3>
                <ul>
                  <li>ノード / 端末 / <span class="kw">エージェント</span> がそれぞれ ID を持つ</li>
                  <li>"誰" "どのエージェントが" を Gateway で判別</li>
                  <li>Principal / Agent / Scope をネットワーク層で識別</li>
                </ul>
              </div>
              <div class="panel">
                <h3>Mesh in containers</h3>
                <ul>
                  <li>Mesh Docker image を順次提供</li>
                  <li>Kubernetes / Compose / CI ランナーにも</li>
                  <li>コンテナが終われば <span class="kw">ノードも消える</span></li>
                </ul>
              </div>
              <div class="panel accent">
                <h3>無料枠の大きさ</h3>
                <ul>
                  <li>最大 <span class="kw">50 ノード / 50 ユーザー無料</span></li>
                  <li>チームと検証環境を 1 つのプライベート網に</li>
                  <li>"まず触ってみる" のハードルが極めて低い</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 10. Divider Part 02 -->
      <section data-background-image="/slides-assets/cf-template-divider.svg" data-background-size="100% 100%" id="divider-2">
        <div class="overlay divider-overlay">
          <div class="kicker">Part 02</div>
          <h1>もう WAN は不要、ではなく<br>"WAN の定義" が変わる</h1>
          <p class="divider-subtext">拠点をつなぐ箱から、ユーザー・ノード・エージェントを一枚に乗せる "プライベート網" へ。</p>
        </div>
      </section>

      <!-- 11. 持ち帰っていただきたいこと -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="takeaway-slide">
        <div class="overlay content-overlay">
          <h2>持ち帰っていただきたいこと</h2>
          <div class="stack">
            <div class="content-grid">
              <div class="panel accent">
                <h3>本日のアジェンダ</h3>
                <ul>
                  <li>「VPN・SSH・公開は <span class="kw">"人間用のつなぎ方"</span> で、エージェントには合わない」</li>
                  <li>「Mesh は <span class="kw">"ひとつのプライベート網" にユーザー・ノード・AI を全部乗せる</span>」</li>
                  <li>「Cloudflare の網が <span class="kw">"経路そのもの"</span> になるから、リレーも増強もいらない」</li>
                </ul>
              </div>
              <div class="panel">
                <h3>これからの変化</h3>
                <ul>
                  <li><span class="kw">複数クラウド・エッジに分散</span>し、所在が流動化する</li>
                  <li>所有するものが変わる。<span class="kw">エッジ・AI エージェント</span>が既存クラウドリソースと同等に扱われる</li>
                  <li>WAN は "箱と回線" から <span class="kw">"ポリシーで括る網"</span> へ。置き場所が変わっても同じ私設網・同じゼロトラスト</li>
                </ul>
              </div>
            </div>
            <div class="note">"もう WAN は不要" は煽りではなく、<span class="kw">"WAN" の定義が静かに置き換わっている</span> という話。<br>Mesh はその最初の形。</div>
          </div>
        </div>
      </section>

      <!-- 12. Thank you -->
      <section data-background-image="/slides-assets/cf-template-thankyou.svg" data-background-size="100% 100%" id="thankyou-slide">
        <div class="overlay thankyou-overlay">
          <div>
            <h1>Thank you</h1>
            <p class="thankyou-subtext">Cloudflare Mesh = ユーザー・ノード・エージェントを、<br>ひとつのプライベート網に。</p>
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
  15,
  'SYSTEM0000000000000000000A',
  'Cloudflare Field Notes',
  'published',
  'public',
  '["Mesh","Networking","SASE"]',
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO slides (
  id, title, slug, description, event_name, presented_at, html, slide_count,
  author_id, author_name_snapshot, status, visibility, tags_json,
  created_at, updated_at
) VALUES (
  'SLIDEPROGRAMMABLESASE00001',
  'プログラマブル SASE という新しい定義',
  'programmable-sase',
  'SASE プラットフォームを自分たちで“拡張する”時代へ。プログラマブル SASE の概念と Cloudflare での実現方法。',
  'Interop 2026',
  '2026-03-02',
  '<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>プログラマブル SASE という新しい定義</title>
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

    .reveal .slides {
      text-align: left;
    }

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

    h1, h2, h3, p, li, td, th, div, span {
      color: inherit;
      margin: 0;
    }

    h1 {
      font-size: 38pt;
      font-weight: 600;
      line-height: 1.12;
      letter-spacing: -0.02em;
      text-transform: none;
    }

    h2 {
      font-size: 24pt;
      font-weight: 600;
      line-height: 1.12;
      text-transform: none;
      margin-bottom: 4px;
    }

    h3 {
      font-size: 16pt;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 6px;
      text-transform: none;
    }

    p,
    li,
    td,
    th {
      font-size: 15pt;
      line-height: 1.34;
    }

    .subtext {
      margin-top: 12px;
      font-size: 17pt;
      line-height: 1.34;
      color: var(--cf-muted);
    }

    .meta {
      margin-top: 14px;
      font-size: 13pt;
      color: var(--cf-muted);
    }

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

    .panel.soft {
      background: var(--cf-panel-soft);
    }

    .panel.accent {
      background: rgba(255, 102, 51, 0.06);
      border: 1px solid rgba(255, 102, 51, 0.35);
    }

    .badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

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

    .small {
      font-size: 13pt;
      color: var(--cf-muted);
    }

    ul {
      margin: 0;
      padding-left: 1.15em;
    }

    li {
      margin: 0.15em 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      background: rgba(255,255,255,0.95);
      border-radius: 10px;
      overflow: hidden;
    }

    th,
    td {
      border: 1px solid rgba(82, 82, 82, 0.16);
      padding: 8px 10px;
      vertical-align: top;
    }

    th {
      font-weight: 700;
      background: rgba(255, 102, 51, 0.08);
    }

    .stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
      height: 100%;
      min-height: 0;
    }

    .kw {
      color: var(--cf-orange);
      font-weight: 700;
    }

    /* シンプルなコードブロック (template.html のトーンに合わせる) */
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
    pre.code .c { color: rgba(31, 31, 31, 0.5); }       /* コメント */
    pre.code .k { color: #d6336c; font-weight: 600; }   /* キーワード */
    pre.code .s { color: #1c7c54; }                     /* 文字列 */
    pre.code .f { color: #1864ab; }                     /* 関数 */
    pre.code .n { color: #5f3dc4; }                     /* 数値 */

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
    .quote .src a:hover {
      border-bottom-style: solid;
    }

    /* RBI フロー専用スタイル */
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
    .flow-arrow {
      text-align: center;
      color: var(--cf-orange);
      font-weight: 700;
      font-size: 14pt;
      line-height: 1;
    }
    .rbi-effects {
      background: rgba(255, 102, 51, 0.06);
      border: 1px solid rgba(255, 102, 51, 0.35);
      border-radius: 10px;
      padding: 8px 12px;
      font-size: 11pt;
    }
    .rbi-effects ul {
      padding-left: 1em;
    }
    .rbi-effects li {
      margin: 0.1em 0;
      line-height: 1.3;
      font-size: 11pt;
    }
    .screen-frame {
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid var(--cf-line);
      border-radius: 10px;
      padding: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      height: 100%;
      min-height: 0;
    }
    .screen-frame img {
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      display: block;
      border-radius: 6px;
      object-fit: contain;
    }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">

      <!-- 1. Cover -->
      <section data-background-image="/slides-assets/cf-template-cover.svg" data-background-size="100% 100%" id="cover-slide">
        <div class="overlay cover-overlay">
          <h1>プログラマブル SASE<br>という新しい定義</h1>
          <p class="subtext">SASE プラットフォームを、自分たちで "拡張する" 時代へ</p>
          <p class="meta">Mini Session #2 / 15 min &nbsp;·&nbsp; Cloudflare Blog (2026-03-02) より</p>
        </div>
      </section>

      <!-- 2. つかみ: "Programmability" は薄まっている -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="dilution-slide">
        <div class="overlay content-overlay">
          <h2>"プログラマブル" という言葉は、業界で薄まっている</h2>
          <div class="stack">
            <div class="quote">
              「プログラマビリティ」という言葉は、業界によって意味が薄められてしまった。
              <span class="src">— Cloudflare Blog,
                <a href="https://blog.cloudflare.com/programmable-sase/" target="_blank" rel="noopener">The truly programmable SASE platform</a>
              </span>
            </div>
            <div class="content-grid-3">
              <div class="panel">
                <h3>公開 API</h3>
                <p>たいていのベンダーが提供している</p>
              </div>
              <div class="panel">
                <h3>Terraform Provider</h3>
                <p>IaC 対応はもはや前提</p>
              </div>
              <div class="panel">
                <h3>Webhook / アラート</h3>
                <p>Slack 通知などはもはや当たり前</p>
              </div>
            </div>
            <div class="note">これらは <span class="kw">最低限の前提</span>。"プログラマブル" を名乗るには、まだ足りない。</div>
          </div>
        </div>
      </section>

      <!-- 3. では Programmability の本質は? -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="essence-slide">
        <div class="overlay content-overlay">
          <h2>本質は "判断" を組み立てられること</h2>
          <div class="stack">
            <div class="content-grid">
              <div class="panel">
                <h3>従来 — "通知" の世界</h3>
                <ul>
                  <li>ポリシーが発火 → Webhook で通知</li>
                  <li>判断はあくまで人間 / 別システム</li>
                  <li>定義済みアクション: 許可 / ブロック / 隔離 / 検疫</li>
                </ul>
              </div>
              <div class="panel accent">
                <h3>プログラマブル — "判断" の世界</h3>
                <ul>
                  <li>セキュリティイベントを <span class="kw">捕まえて</span></li>
                  <li>外部コンテキストで <span class="kw">情報を足して</span></li>
                  <li>その場で <span class="kw">リアルタイムに判断・実行</span></li>
                </ul>
              </div>
            </div>
            <div class="quote">
              ポリシーは単にアラートを発火させただけではない — ポリシーが "判断" を下したのだ。
              <span class="src">— Cloudflare Blog,
                <a href="https://blog.cloudflare.com/programmable-sase/" target="_blank" rel="noopener">The truly programmable SASE platform</a>
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. Divider -->
      <section data-background-image="/slides-assets/cf-template-divider.svg" data-background-size="100% 100%" id="divider-1">
        <div class="overlay divider-overlay">
          <div class="kicker">Part 01</div>
          <h1>なぜ Cloudflare だけが<br>"プログラマブル SASE" を作れるのか</h1>
          <p class="divider-subtext">SASE と開発者プラットフォームが、同じネットワーク・同じサーバーで動いているから</p>
        </div>
      </section>

      <!-- 5. なぜ Cloudflare だけが作れるのか -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="why-cf-slide">
        <div class="overlay content-overlay">
          <h2>SASE と開発者プラットフォームが "同じ網" で動く</h2>
          <div class="stack">
            <div class="quote">
              業界をリードする SASE プラットフォームと開発者プラットフォームが、同じ "サーバー" の上で並んで動いている。
              <span class="src">— Cloudflare Blog,
                <a href="https://blog.cloudflare.com/programmable-sase/" target="_blank" rel="noopener">The truly programmable SASE platform</a>
              </span>
            </div>
            <div class="content-grid-3">
              <div class="panel">
                <h3>330+ 都市</h3>
                <p>世界中の都市にエッジ。インターネット利用者の 95% から約 50ms 圏内。</p>
              </div>
              <div class="panel">
                <h3>同じメタルの上で動く</h3>
                <p>すべてのサーバーで <span class="kw">すべてのサービス</span>が動く。SASE と Workers が同居している。</p>
              </div>
              <div class="panel accent">
                <h3>最初から一体</h3>
                <p>後付けの統合ではなく、<span class="kw">最初から一体</span>として設計。だから組み合わせも拡張も自在。</p>
              </div>
            </div>
            <div class="note">他社 SASE は別クラウドに自動化基盤を建てる必要がある。Cloudflare は <span class="kw">Worker が インラインで SASE を拡張</span> する。</div>
          </div>
        </div>
      </section>

      <!-- 6. What programmability unlocks -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="unlock-slide">
        <div class="overlay content-overlay">
          <h2>定義済みアクションから、カスタムロジックへ</h2>
          <div class="stack">
            <div class="content-grid">
              <div class="panel">
                <h3>従来の Gateway アクション</h3>
                <ul>
                  <li>許可 / ブロック</li>
                  <li>隔離 (ブラウザ分離)</li>
                  <li>検疫</li>
                </ul>
                <p class="small" style="margin-top:8px;">→ 用意された選択肢から選ぶだけ</p>
              </div>
              <div class="panel accent">
                <h3>カスタムロジックを呼び出す</h3>
                <ul>
                  <li>ID クレームに基づき <span class="kw">動的にヘッダーを注入</span></li>
                  <li>外部リスクエンジンを呼んで <span class="kw">リアルタイム判定</span></li>
                  <li>勤務地 / 勤務時間で <span class="kw">アクセス制御</span></li>
                  <li>ブラウザ属性を検証して経路を変える</li>
                </ul>
              </div>
            </div>
            <div class="note">Gateway HTTP ポリシーがマッチしたら、許可/ブロック/隔離 ではなく <span class="kw">Worker を直接呼び出せる</span> 方向へ。</div>
          </div>
        </div>
      </section>

      <!-- 7. Managed actions & Custom actions -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="actions-slide">
        <div class="overlay content-overlay">
          <h2>アクションは "マネージド" と "カスタム" の二階建て</h2>
          <div class="stack">
            <div class="content-grid">
              <div class="panel">
                <h3>マネージドアクション</h3>
                <ul>
                  <li>よくあるシナリオのテンプレート集</li>
                  <li>IT サービス管理 (ITSM) 連携</li>
                  <li>リダイレクト / コンプライアンス自動化</li>
                  <li>ベストプラクティスを再利用できる</li>
                </ul>
              </div>
              <div class="panel accent">
                <h3>カスタムアクション</h3>
                <ul>
                  <li>ロジックを <span class="kw">完全に自分で定義</span></li>
                  <li>Gateway HTTP ポリシーのマッチで <span class="kw">Cloudflare Worker を呼び出す</span></li>
                  <li>エッジでリアルタイム実行、リクエスト情報にフルアクセス</li>
                </ul>
              </div>
            </div>
            <div class="note">"機能要望を出してロードマップに乗ることを祈る" 時代はもう終わり。今日、自分で作れる。</div>
          </div>
        </div>
      </section>

      <!-- 8. Workers の垣根が下がった -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="workers-easy-slide">
        <div class="overlay content-overlay">
          <h2>"Worker を作る" は、もう開発者だけの仕事じゃない</h2>
          <div class="stack">
            <div class="content-grid">
              <div class="panel">
                <h3>これまでの "Worker を作る" 印象</h3>
                <ul>
                  <li>JavaScript / TypeScript が分かる開発者の仕事</li>
                  <li>ローカル環境構築・wrangler セットアップ</li>
                  <li>テスト・デプロイ・ロールバック手順を整える</li>
                  <li>セキュリティ運用チームには <span class="kw">距離があった</span></li>
                </ul>
              </div>
              <div class="panel accent">
                <h3>2026年: AI エージェントで一変</h3>
                <ul>
                  <li>自然言語で "やりたいこと" を伝えるだけ</li>
                  <li><span class="kw">バイブコーディング</span>で Worker が即生成</li>
                  <li>デプロイまで <span class="kw">エージェントが自動化</span></li>
                  <li>"動くもの" が <span class="kw">数分〜数十分</span>で手に入る</li>
                </ul>
              </div>
            </div>
            <div class="content-grid-3" style="gap: 10px;">
              <div class="panel soft" style="text-align: center;">
                <h3 style="color: var(--cf-orange);">Workers の特性</h3>
                <p class="small" style="margin-top: 6px;">小さな単位で作れる · 起動が速い · 1ファイルでも完結</p>
              </div>
              <div class="panel soft" style="text-align: center;">
                <h3 style="color: var(--cf-orange);">AI の得意分野</h3>
                <p class="small" style="margin-top: 6px;">小さなコードの生成 · パターンの応用 · API 呼び出し</p>
              </div>
              <div class="panel soft" style="text-align: center;">
                <h3 style="color: var(--cf-orange);">相性の良さ</h3>
                <p class="small" style="margin-top: 6px;">Workers と AI エージェントは<br> <span class="kw">構造的にハマる</span></p>
              </div>
            </div>
            <div class="note">"プログラマブル" のハードルは、もう <span class="kw">"作りたいものをちゃんと言葉にできるか"</span> だけ。</div>
          </div>
        </div>
      </section>

      <!-- 9. 実例 ①: Block + RBI フロー (画像あり) -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="example-rbi-slide">
        <div class="overlay content-overlay">
          <h2>実例 ① ブロック画面に "業務継続の選択肢" を埋め込む</h2>
          <div class="stack" style="gap: 8px;">
            <div style="display: grid; grid-template-columns: 1.25fr 1fr; gap: 14px; flex: 1; min-height: 0;">
              <div style="display: flex; flex-direction: column; gap: 6px; min-height: 0;">
                <div class="flow-step"><span class="num">1</span><span>ユーザーがリスクサイトにアクセス</span></div>
                <div class="flow-step"><span class="num">2</span><span>Gateway が <span class="kw">直接接続をブロック</span></span></div>
                <div class="flow-step"><span class="num">3</span><span>Workers が <span class="kw">警告画面 (右) を動的生成</span></span></div>
                <div class="flow-step"><span class="num">4</span><span>ユーザーが同意 → 監査ログ記録</span></div>
                <div class="flow-step"><span class="num">5</span><span><span class="kw">Clientless RBI</span> でサイトを描画</span></div>
                <div class="rbi-effects" style="flex: 1; display: flex; align-items: center;">
                  <ul style="margin: 0;">
                    <li>サイトのコードは <span class="kw">Cloudflare 上で実行</span>、マルウェアは端末に到達しない</li>
                    <li>端末には描画結果のみ送信。<span class="kw">コピー / DL / 印刷などを制御可能</span></li>
                    <li><span class="kw">NVR (特許技術)</span> による軽量・高忠実度の描画ストリーム</li>
                    <li>通常のブラウジングと <span class="kw">遜色ない体感速度</span>でウェブ閲覧</li>
                    <li>ゼロデイ攻撃から端末を保護</li>
                  </ul>
                </div>
              </div>
              <div class="screen-frame">
                <img src="block-rbi-screen.png" alt="Cloudflare Block + RBI 画面">
              </div>
            </div>
            <p class="small">構成: Cloudflare Zero Trust (Gateway) + Workers + Browser Isolation。<span class="kw">"許可/拒否" の二択ではなく "安全に閲覧する第3の道"</span> を Worker で作り込んだ例。</p>
          </div>
        </div>
      </section>

      <!-- 10. 実例 ②: デバイスセッションの自動失効 -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="example-revoke-slide">
        <div class="overlay content-overlay">
          <h2>実例 ② デバイスセッションの自動失効</h2>
          <div class="stack">
            <div class="content-grid">
              <div class="panel">
                <h3>課題</h3>
                <p>VPN のような <span class="kw">定期的な再認証</span>を Cloudflare One Client にも強制したい。標準のセッション制御はアプリ単位で、グローバルな時間ベースの失効ができない。</p>
              </div>
              <div class="panel accent">
                <h3>解決方法</h3>
                <p>Scheduled Worker が Devices API を叩き、しきい値を超えて非アクティブな端末を検出し、<span class="kw">登録を失効</span>。結果として IdP 経由で再認証が強制される。</p>
              </div>
            </div>
            <span class="code-tab">device-revoke.js &nbsp;·&nbsp; cron: 0 */4 * * *</span>
<pre class="code"><span class="k">export default</span> {
  <span class="k">async</span> <span class="f">scheduled</span>(event, env, ctx) {
    <span class="c">// 全デバイスの登録一覧を Devices API から取得</span>
    <span class="k">const</span> devices = <span class="k">await</span> <span class="f">fetchAllDevices</span>(env);
    <span class="k">for</span> (<span class="k">const</span> d <span class="k">of</span> devices) {
      <span class="k">const</span> mins = (<span class="k">new</span> <span class="f">Date</span>() - <span class="k">new</span> <span class="f">Date</span>(d.last_seen_at)) / <span class="n">60000</span>;
      <span class="k">if</span> (mins &gt; env.REVOKE_INTERVAL_MINUTES) {  <span class="c">// しきい値超え</span>
        <span class="k">await</span> <span class="f">fetch</span>(<span class="s">`.../devices/registrations/${d.id}`</span>, { method: <span class="s">''DELETE''</span> });
      }
    }
  }
};</pre>
            <p class="small">ベンダーのロードマップ待ちなら数ヶ月。<span class="kw">Cloudflare なら、数時間で本番化</span>。以来、動き続ける。</p>
          </div>
        </div>
      </section>

      <!-- 11. Divider 2 -->
      <section data-background-image="/slides-assets/cf-template-divider.svg" data-background-size="100% 100%" id="divider-2">
        <div class="overlay divider-overlay">
          <div class="kicker">Part 02</div>
          <h1>会話そのものを、変える</h1>
          <p class="divider-subtext">セキュリティ基盤は "あなたと一緒に育つ" もの。あなたを縛るものではない。</p>
        </div>
      </section>

      <!-- 12. 何が変わるのか / 将来 -->
      <section data-background-image="/slides-assets/cf-template-content.svg" data-background-size="100% 100%" id="future-slide">
        <div class="overlay content-overlay">
          <h2>プログラマブル SASE が変える "会話" と "未来"</h2>
          <div class="stack">
            <div class="content-grid-3">
              <div class="panel">
                <h3>セキュリティチーム</h3>
                <p>"機能要望を出して祈る" のをやめて、<span class="kw">今日、自分で作る</span>。</p>
              </div>
              <div class="panel">
                <h3>パートナー / MSSP</h3>
                <p>業界特化・規制特化のソリューションを <span class="kw">プラットフォーム上で提供</span>。カスタム統合が差別化に。</p>
              </div>
              <div class="panel accent">
                <h3>お客様</h3>
                <p>"簡単" は "一律" という意味ではない。<span class="kw">必要なものを作れる</span>基盤。</p>
              </div>
            </div>
            <div class="quote">
              エンタープライズセキュリティの未来は、すべてを抱え込む一枚岩ではなく — <span class="kw">組み合わせ可能で、プログラマブルなプラットフォーム</span>である。
              <span class="src">— Cloudflare Blog,
                <a href="https://blog.cloudflare.com/programmable-sase/" target="_blank" rel="noopener">The truly programmable SASE platform</a>
              </span>
            </div>
            <p class="small">2026 年を通じて、Gateway のカスタムアクション、外部 DB を使った動的ポリシー、リクエスト情報の引き継ぎ機能が順次追加されていく。</p>
          </div>
        </div>
      </section>

      <!-- 13. Thank you -->
      <section data-background-image="/slides-assets/cf-template-thankyou.svg" data-background-size="100% 100%" id="thankyou-slide">
        <div class="overlay thankyou-overlay">
          <div>
            <h1>Thank you</h1>
            <p class="thankyou-subtext">プログラマブル SASE = SASE を "組み立てる" 時代の Cloudflare One</p>
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
  13,
  'SYSTEM0000000000000000000A',
  'Cloudflare Field Notes',
  'published',
  'public',
  '["SASE","Networking","Workers"]',
  datetime('now'),
  datetime('now')
);
