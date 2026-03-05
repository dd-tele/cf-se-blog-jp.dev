import { eq, desc } from "drizzle-orm";
import { getDb } from "~/lib/db.server";
import { users, accessRequests } from "~/db/schema";
import { ulid } from "~/lib/ulid";

// ─── Types ─────────────────────────────────────────────────

export interface AccessRequestInput {
  email: string;
  displayName: string;
  nickname?: string;
  furigana?: string;
  company?: string;
  jobRole?: string;
  expertise?: string;
  profileComment?: string;
}

export interface ProfileInput {
  displayName?: string;
  nickname?: string;
  furigana?: string;
  company?: string;
  jobRole?: string;
  expertise?: string;
  profileComment?: string;
  bio?: string;
  avatarUrl?: string;
}

// ─── Access Request Queries ────────────────────────────────

export async function createAccessRequest(db: D1Database, input: AccessRequestInput) {
  const d = getDb(db);
  const id = ulid();
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  await d.insert(accessRequests).values({
    id,
    email: input.email,
    display_name: input.displayName,
    nickname: input.nickname || null,
    furigana: input.furigana || null,
    company: input.company || null,
    job_role: input.jobRole || null,
    expertise: input.expertise || null,
    profile_comment: input.profileComment || null,
    status: "pending",
    created_at: now,
    updated_at: now,
  });

  return { id };
}

export async function getAllAccessRequests(db: D1Database) {
  const d = getDb(db);
  return await d
    .select()
    .from(accessRequests)
    .orderBy(desc(accessRequests.created_at));
}

export async function getPendingAccessRequests(db: D1Database) {
  const d = getDb(db);
  return await d
    .select()
    .from(accessRequests)
    .where(eq(accessRequests.status, "pending"))
    .orderBy(desc(accessRequests.created_at));
}

export async function getAccessRequestById(db: D1Database, id: string) {
  const d = getDb(db);
  return await d.select().from(accessRequests).where(eq(accessRequests.id, id)).get() ?? null;
}

export async function approveAccessRequest(
  db: D1Database,
  requestId: string,
  adminUserId: string,
  adminNote?: string
) {
  const d = getDb(db);
  const req = await getAccessRequestById(db, requestId);
  if (!req) throw new Error("申請が見つかりません");
  if (req.status !== "pending") throw new Error("この申請は既に処理済みです");

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  // Update request status
  await d
    .update(accessRequests)
    .set({
      status: "approved",
      reviewed_by: adminUserId,
      reviewed_at: now,
      admin_note: adminNote || null,
      updated_at: now,
    })
    .where(eq(accessRequests.id, requestId));

  // Create user record from request data
  const userId = ulid();
  await d.insert(users).values({
    id: userId,
    email: req.email,
    display_name: req.display_name,
    nickname: req.nickname || null,
    furigana: req.furigana || null,
    company: req.company || null,
    job_role: req.job_role || null,
    expertise: req.expertise || null,
    profile_comment: req.profile_comment || null,
    role: "user",
    created_at: now,
    updated_at: now,
  });

  return { userId, email: req.email };
}

export async function rejectAccessRequest(
  db: D1Database,
  requestId: string,
  adminUserId: string,
  adminNote?: string
) {
  const d = getDb(db);
  const req = await getAccessRequestById(db, requestId);
  if (!req) throw new Error("申請が見つかりません");
  if (req.status !== "pending") throw new Error("この申請は既に処理済みです");

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  await d
    .update(accessRequests)
    .set({
      status: "rejected",
      reviewed_by: adminUserId,
      reviewed_at: now,
      admin_note: adminNote || null,
      updated_at: now,
    })
    .where(eq(accessRequests.id, requestId));
}

// ─── Profile Queries ───────────────────────────────────────

export async function getUserProfile(db: D1Database, userId: string) {
  const d = getDb(db);
  return await d.select().from(users).where(eq(users.id, userId)).get() ?? null;
}

export async function updateUserProfile(db: D1Database, userId: string, input: ProfileInput) {
  const d = getDb(db);
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  const updateData: Record<string, any> = { updated_at: now };
  if (input.displayName !== undefined) updateData.display_name = input.displayName;
  if (input.nickname !== undefined) updateData.nickname = input.nickname || null;
  if (input.furigana !== undefined) updateData.furigana = input.furigana || null;
  if (input.company !== undefined) updateData.company = input.company || null;
  if (input.jobRole !== undefined) updateData.job_role = input.jobRole || null;
  if (input.expertise !== undefined) updateData.expertise = input.expertise || null;
  if (input.profileComment !== undefined) updateData.profile_comment = input.profileComment || null;
  if (input.bio !== undefined) updateData.bio = input.bio || null;
  if (input.avatarUrl !== undefined) updateData.avatar_url = input.avatarUrl || null;

  await d.update(users).set(updateData).where(eq(users.id, userId));
}

// ─── Cloudflare Access API ─────────────────────────────────

export async function addEmailToAccessPolicy(
  env: Env,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const { CF_API_TOKEN, CF_ACCOUNT_ID, CF_ACCESS_APP_ID, CF_ACCESS_POLICY_ID } = env;
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID || !CF_ACCESS_APP_ID || !CF_ACCESS_POLICY_ID) {
    return { success: false, error: "Cloudflare Access API の環境変数が設定されていません" };
  }

  try {
    // 1. Get current policy
    const getPolicyUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/access/apps/${CF_ACCESS_APP_ID}/policies/${CF_ACCESS_POLICY_ID}`;
    const getRes = await fetch(getPolicyUrl, {
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!getRes.ok) {
      const errText = await getRes.text();
      return { success: false, error: `Access API GET failed: ${getRes.status} ${errText}` };
    }

    const policyData = await getRes.json() as any;
    const policy = policyData.result;

    // 2. Find the "Emails" include rule and add the new email
    let emailsFound = false;
    for (const include of (policy.include || [])) {
      if (include.email) {
        // Single email rule — convert to email_list or keep adding
        // Cloudflare Access uses { email: { email: "xxx" } } format
      }
      if (include.email_list) {
        // Already a list
      }
    }

    // The simplest approach: add a new email include entry
    const existingIncludes = policy.include || [];
    const emailAlreadyExists = existingIncludes.some(
      (inc: any) => inc.email?.email === email
    );

    if (!emailAlreadyExists) {
      existingIncludes.push({ email: { email } });
    }

    // 3. Update policy
    const updateRes = await fetch(getPolicyUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...policy,
        include: existingIncludes,
      }),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      return { success: false, error: `Access API PUT failed: ${updateRes.status} ${errText}` };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: `Access API error: ${e.message}` };
  }
}
