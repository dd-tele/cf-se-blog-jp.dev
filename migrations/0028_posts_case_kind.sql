-- 事例 kind stored explicitly instead of being inferred from the title prefix.
-- Titles in practice start with 【業種　ケースN】 rather than 【導入アーキテクチャ】,
-- so the kind is detected from the uploaded HTML (see app/lib/case-kind.ts).
ALTER TABLE posts ADD COLUMN case_kind TEXT CHECK (case_kind IN ('guide', 'architecture'));

-- Backfill: the 導入アーキテクチャ template has ".brand" 「導入アーキテクチャ：」, the
-- 「導入前の構成と課題」 chapter and 「設定の意図」 callouts; anything else is 設計ガイド.
UPDATE posts
SET case_kind = CASE
  WHEN title LIKE '【導入アーキテクチャ】%'
    OR instr(content, '導入アーキテクチャ：') > 0
    OR instr(content, '導入前の構成と課題') > 0
    OR instr(content, '<b>設定の意図</b>') > 0
  THEN 'architecture'
  ELSE 'guide'
END
WHERE content_type = 'case_guide';
