-- Migration: 0002_seed_categories
-- Description: Seed initial categories

INSERT OR IGNORE INTO categories (id, name, slug, description, icon, sort_order) VALUES
  ('cat-app', 'Application Services', 'application', 'WAF, CDN, Bot Management, Load Balancing など Application Services 関連', '', 1),
  ('cat-zt', 'Zero Trust', 'zero-trust', 'Access, Gateway, CASB, Browser Isolation など Zero Trust 関連', '', 2),
  ('cat-dev', 'Developer Platform', 'dev-platform', 'Workers, Pages, D1, R2, AI など Developer Platform 関連', '', 3),
  ('cat-email', 'Email Security', 'email-security', 'Email Routing, Area 1, DMARC Management など Email Security 関連', '', 4),
  ('cat-net', 'Network Services', 'network', 'Magic Transit, Magic WAN, Spectrum など Network Services 関連', '', 5),
  ('cat-other', 'General', 'other', 'Cloudflare 全般、業界トレンド、イベントレポートなど', '', 6);
