// Generates migrations/0017_seed_sample_slide.sql from a slide HTML file in the
// public archive. Run with: node scripts/generate-sample-slide-migration.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE =
  process.argv[2] ||
  "/Users/daisuke/CascadeProjects/スライドアーカイブ/公開用/agents.html";

function rewriteSlideAssets(html) {
  return html
    .replace(/(["'(])(?:\.?\/)?(cf-template-[\w-]+\.svg)/g, "$1/slides-assets/$2")
    .replace(/(["'(])(?:\.?\/)?(styles\.css)(["')])/g, "$1/slides-assets/$2$3")
    .replace(/\/slides-assets\/slides-assets\//g, "/slides-assets/");
}

function countSlides(html) {
  const m = html.match(/<section\b/gi);
  return m ? m.length : 0;
}

function sqlEscape(s) {
  return s.replace(/'/g, "''");
}

const raw = readFileSync(SOURCE, "utf8");
const html = rewriteSlideAssets(raw);
const slideCount = countSlides(html);

const SYSTEM_USER_ID = "SYSTEM0000000000000000000A";
const SLIDE_ID = "SLIDESAMPLEAGENTS000000001";
const slug = "cloudflare-agents";
const title = "Cloudflare Agents — 「動き続ける」AI を作る";
const description =
  "記憶を持ち、自律的に考え、ツールを使う AI エージェントをエッジで動かす。Agents SDK の仕様・ユースケース・拡張性・Workers AI との違いを解説したサンプルスライド。";
const eventName = "サンプル";
const tags = JSON.stringify(["Agents", "Workers AI", "Edge"]);

const sql = `-- Seed: sample published slide (generated from ${SOURCE.split("/").pop()})
-- Regenerate with: node scripts/generate-sample-slide-migration.mjs

INSERT OR IGNORE INTO users (id, email, display_name, role, created_at, updated_at)
VALUES (
  '${SYSTEM_USER_ID}',
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
  '${SLIDE_ID}',
  '${sqlEscape(title)}',
  '${slug}',
  '${sqlEscape(description)}',
  '${sqlEscape(eventName)}',
  '${sqlEscape(html)}',
  ${slideCount},
  '${SYSTEM_USER_ID}',
  'Cloudflare Field Notes',
  'published',
  'public',
  '${sqlEscape(tags)}',
  datetime('now'),
  datetime('now')
);
`;

const out = resolve(
  process.cwd(),
  "migrations/0017_seed_sample_slide.sql"
);
writeFileSync(out, sql, "utf8");
console.log(`Wrote ${out} (slideCount=${slideCount}, htmlBytes=${html.length})`);
