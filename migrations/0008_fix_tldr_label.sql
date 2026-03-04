-- Remove "TL;DR" from the Tips & Tricks template field label
UPDATE templates
SET input_fields_json = REPLACE(input_fields_json, '一言まとめ (TL;DR)', '一言まとめ')
WHERE id = 't-gen-01';
