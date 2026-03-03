import { eq } from "drizzle-orm";
import { getDb } from "~/lib/db.server";
import { userBadges, users } from "~/db/schema";
import { ulid } from "~/lib/ulid";

// ─── Badge definitions ──────────────────────────────────────
export const BADGE_DEFS: Record<
  string,
  { name: string; description: string; icon: string }
> = {
  first_post: {
    name: "初投稿",
    description: "初めての記事を投稿しました",
    icon: "📝",
  },
  five_posts: {
    name: "ライター",
    description: "5件の記事を公開しました",
    icon: "✍️",
  },
  ten_posts: {
    name: "ベテランライター",
    description: "10件の記事を公開しました",
    icon: "🏆",
  },
  trusted_author: {
    name: "信頼された著者",
    description: "自動承認権限を獲得しました",
    icon: "⭐",
  },
  popular_post: {
    name: "人気記事",
    description: "記事が100回以上閲覧されました",
    icon: "🔥",
  },
  ai_pioneer: {
    name: "AI パイオニア",
    description: "AI 下書き生成を初めて利用しました",
    icon: "🤖",
  },
  community_helper: {
    name: "コミュニティヘルパー",
    description: "Q&A で人間の回答を提供しました",
    icon: "🤝",
  },
};

// ─── Award a badge (idempotent) ─────────────────────────────
export async function awardBadge(
  db: D1Database,
  userId: string,
  badgeType: string
): Promise<boolean> {
  const def = BADGE_DEFS[badgeType];
  if (!def) return false;

  const d = getDb(db);

  // Check if already awarded
  const existing = await d
    .select({ id: userBadges.id })
    .from(userBadges)
    .where(
      eq(userBadges.user_id, userId)
    )
    .all();

  if (existing.some((b) => b.id && badgeType === badgeType)) {
    // Need to check badge_type, not just existence
    const hasBadge = await db
      .prepare("SELECT id FROM user_badges WHERE user_id = ? AND badge_type = ?")
      .bind(userId, badgeType)
      .first();
    if (hasBadge) return false;
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  try {
    await d.insert(userBadges).values({
      id: ulid(),
      user_id: userId,
      badge_type: badgeType,
      badge_name: def.name,
      badge_description: def.description,
      badge_icon: def.icon,
      earned_at: now,
    });
    return true;
  } catch {
    // Unique constraint violation = already has badge
    return false;
  }
}

// ─── Get user badges ────────────────────────────────────────
export async function getUserBadges(db: D1Database, userId: string) {
  const d = getDb(db);
  return d
    .select({
      badgeType: userBadges.badge_type,
      badgeName: userBadges.badge_name,
      badgeDescription: userBadges.badge_description,
      badgeIcon: userBadges.badge_icon,
      earnedAt: userBadges.earned_at,
    })
    .from(userBadges)
    .where(eq(userBadges.user_id, userId))
    .orderBy(userBadges.earned_at);
}

// ─── Check and award milestone badges after post publish ────
export async function checkPostMilestones(
  db: D1Database,
  userId: string
) {
  const d = getDb(db);
  const userRow = await d
    .select({ approvedCount: users.approved_post_count })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!userRow) return;
  const count = userRow.approvedCount;

  if (count >= 1) awardBadge(db, userId, "first_post").catch(() => {});
  if (count >= 5) awardBadge(db, userId, "five_posts").catch(() => {});
  if (count >= 10) awardBadge(db, userId, "ten_posts").catch(() => {});
  if (count >= 3) awardBadge(db, userId, "trusted_author").catch(() => {});
}
