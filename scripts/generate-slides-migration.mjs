// Generates migrations/0019_seed_slides.sql:
//  - removes the "サンプル" marker from the existing agents slide
//  - inserts the remaining public-folder decks
// Run: node scripts/generate-slides-migration.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ARCHIVE = "/Users/daisuke/CascadeProjects/スライドアーカイブ/公開用";
const SYSTEM_USER_ID = "SYSTEM0000000000000000000A";

function rewriteSlideAssets(html) {
  return html
    .replace(/(["'(])(?:\.?\/)?(cf-template-[\w-]+\.svg)/g, "$1/slides-assets/$2")
    .replace(/(["'(])(?:\.?\/)?(styles\.css)(["')])/g, "$1/slides-assets/$2$3")
    .replace(/\/slides-assets\/slides-assets\//g, "/slides-assets/");
}
const countSlides = (h) => (h.match(/<section\b/gi) || []).length;
const esc = (s) => s.replace(/'/g, "''");

// New decks to insert (agents already seeded in 0017).
const DECKS = [
  {
    id: "SLIDEAGENTNATIVEINTERNET01",
    file: "agent-native-internet.html",
    slug: "agent-native-internet",
    title: "エージェントネイティブインターネット",
    description:
      "トラフィックはもう AI 中心。エージェントが主役となるインターネットの姿と、その上で Cloudflare が果たす役割を読み解きます。",
    eventName: "Mini Session #3",
    presentedAt: null,
    tags: ["Agents", "AI", "Internet"],
  },
  {
    id: "SLIDECLOUDFLAREMESH0000001",
    file: "mesh-2026-interop.html",
    slug: "cloudflare-mesh",
    title: "もう WAN は不要？ Cloudflare Mesh",
    description:
      "柔軟性と、AI 実行環境の安全な相互接続。従来の WAN に代わる Cloudflare Mesh のアーキテクチャと考え方を解説します。",
    eventName: "Interop 2026",
    presentedAt: null,
    tags: ["Mesh", "Networking", "SASE"],
  },
  {
    id: "SLIDEPROGRAMMABLESASE00001",
    file: "programable-sase-2026-interop.html",
    slug: "programmable-sase",
    title: "プログラマブル SASE という新しい定義",
    description:
      "SASE プラットフォームを自分たちで“拡張する”時代へ。プログラマブル SASE の概念と Cloudflare での実現方法。",
    eventName: "Interop 2026",
    presentedAt: "2026-03-02",
    tags: ["SASE", "Networking", "Workers"],
  },
];

let sql = `-- Seed: additional public slides + remove the "サンプル" marker from the agents deck.
-- Regenerate with: node scripts/generate-slides-migration.mjs

-- Remove sample marker from the existing agents slide
UPDATE slides
SET event_name = NULL,
    description = '記憶を持ち、自律的に考え、ツールを使う AI エージェントをエッジで動かす。Agents SDK の仕様・ユースケース・拡張性・Workers AI との違いを解説します。',
    updated_at = datetime('now')
WHERE slug = 'cloudflare-agents';
`;

for (const d of DECKS) {
  const raw = readFileSync(resolve(ARCHIVE, d.file), "utf8");
  const html = rewriteSlideAssets(raw);
  const n = countSlides(html);
  const presented = d.presentedAt ? `'${d.presentedAt}'` : "NULL";
  sql += `
INSERT OR IGNORE INTO slides (
  id, title, slug, description, event_name, presented_at, html, slide_count,
  author_id, author_name_snapshot, status, visibility, tags_json,
  created_at, updated_at
) VALUES (
  '${d.id}',
  '${esc(d.title)}',
  '${d.slug}',
  '${esc(d.description)}',
  '${esc(d.eventName)}',
  ${presented},
  '${esc(html)}',
  ${n},
  '${SYSTEM_USER_ID}',
  'Cloudflare Field Notes',
  'published',
  'public',
  '${esc(JSON.stringify(d.tags))}',
  datetime('now'),
  datetime('now')
);
`;
  console.log(`  + ${d.slug} (${n} slides, ${html.length} bytes)`);
}

const out = resolve(process.cwd(), "migrations/0019_seed_slides.sql");
writeFileSync(out, sql, "utf8");
console.log(`Wrote ${out}`);
