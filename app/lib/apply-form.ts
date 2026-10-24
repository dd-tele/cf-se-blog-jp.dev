// Shared (client + server) definitions for the contributor application form.

export const JOB_ROLES = [
  "エンジニアリングマネージャー",
  "フロントエンドエンジニア",
  "バックエンドエンジニア",
  "フルスタックエンジニア",
  "インフラエンジニア",
  "SRE",
  "セキュリティエンジニア",
  "ネットワークエンジニア",
  "クラウドアーキテクト",
  "DevOps エンジニア",
  "SE / プリセールス",
  "プロジェクトマネージャー",
  "その他",
] as const;

/** Maximum lengths enforced on the server and mirrored as maxLength in the UI. */
export const APPLY_LIMITS = {
  display_name: 80,
  furigana: 80,
  nickname: 50,
  email: 254,
  company: 100,
  expertise: 200,
  profile_comment: 1000,
} as const;

/** Turnstile `action` for this form; checked by siteverify. */
export const APPLY_TURNSTILE_ACTION = "apply";

/** Hidden decoy field. Humans never see it; naive bots fill every input. */
export const APPLY_HONEYPOT_FIELD = "website";
