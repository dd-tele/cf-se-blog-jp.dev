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

// ─── Admin User Management ─────────────────────────────────

export async function getAllUsers(db: D1Database) {
  const d = getDb(db);
  return await d.select().from(users).orderBy(desc(users.created_at));
}

export async function getUserById(db: D1Database, userId: string) {
  const d = getDb(db);
  return await d.select().from(users).where(eq(users.id, userId)).get() ?? null;
}

export interface AdminUserUpdateInput {
  displayName?: string;
  nickname?: string;
  furigana?: string;
  email?: string;
  company?: string;
  jobRole?: string;
  expertise?: string;
  profileComment?: string;
  bio?: string;
  role?: "admin" | "se" | "user";
  isActive?: boolean;
}

export async function adminUpdateUser(db: D1Database, userId: string, input: AdminUserUpdateInput) {
  const d = getDb(db);
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  const updateData: Record<string, any> = { updated_at: now };
  if (input.displayName !== undefined) updateData.display_name = input.displayName;
  if (input.nickname !== undefined) updateData.nickname = input.nickname || null;
  if (input.furigana !== undefined) updateData.furigana = input.furigana || null;
  if (input.email !== undefined) updateData.email = input.email;
  if (input.company !== undefined) updateData.company = input.company || null;
  if (input.jobRole !== undefined) updateData.job_role = input.jobRole || null;
  if (input.expertise !== undefined) updateData.expertise = input.expertise || null;
  if (input.profileComment !== undefined) updateData.profile_comment = input.profileComment || null;
  if (input.bio !== undefined) updateData.bio = input.bio || null;
  if (input.role !== undefined) updateData.role = input.role;
  if (input.isActive !== undefined) updateData.is_active = input.isActive;

  await d.update(users).set(updateData).where(eq(users.id, userId));
}

export async function deleteUser(db: D1Database, userId: string) {
  const d = getDb(db);
  const {
    posts, aiDraftRequests, qaMessages, userBadges,
    notificationSettings, auditLogs,
  } = await import("~/db/schema");

  // 1. Get user info for snapshot
  const userRow = await d.select().from(users).where(eq(users.id, userId)).get();
  if (!userRow) throw new Error("ユーザーが見つかりません");

  // 2. Snapshot author name into posts
  const displayName = userRow.nickname || userRow.display_name;
  await d.update(posts)
    .set({ author_name_snapshot: displayName })
    .where(eq(posts.author_id, userId));

  // 3. Clean up related records (order matters for FK safety)
  await d.delete(aiDraftRequests).where(eq(aiDraftRequests.user_id, userId));
  await d.delete(userBadges).where(eq(userBadges.user_id, userId));
  await d.delete(notificationSettings).where(eq(notificationSettings.user_id, userId));
  // audit_logs and qa_messages: nullify user_id to preserve history
  await d.update(auditLogs).set({ user_id: null }).where(eq(auditLogs.user_id, userId));
  await d.update(qaMessages).set({ user_id: null }).where(eq(qaMessages.user_id, userId));

  // 4. Delete user
  await d.delete(users).where(eq(users.id, userId));

  return { email: userRow.email };
}

// ─── Cloudflare Access API ─────────────────────────────────

function getAccessApiConfig(env: Env): { headers: Record<string, string>; policyUrl: string; reusablePolicyUrl: string; authMethod: string } | null {
  const { CF_ACCOUNT_ID, CF_ACCESS_APP_ID, CF_ACCESS_POLICY_ID } = env;
  if (!CF_ACCOUNT_ID || !CF_ACCESS_APP_ID || !CF_ACCESS_POLICY_ID) return null;

  const policyUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/access/apps/${CF_ACCESS_APP_ID}/policies/${CF_ACCESS_POLICY_ID}`;
  const reusablePolicyUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/access/policies/${CF_ACCESS_POLICY_ID}`;

  // Prefer Global API Key (required for Zero Trust on some enterprise accounts)
  if (env.CF_AUTH_EMAIL && env.CF_GLOBAL_API_KEY) {
    console.log("[Access API] Using Global API Key auth");
    return {
      headers: {
        "X-Auth-Email": env.CF_AUTH_EMAIL,
        "X-Auth-Key": env.CF_GLOBAL_API_KEY,
        "Content-Type": "application/json",
      },
      policyUrl,
      reusablePolicyUrl,
      authMethod: "GlobalApiKey",
    };
  }

  // Fallback to API Token
  if (env.CF_API_TOKEN) {
    console.log("[Access API] Falling back to Bearer token (CF_AUTH_EMAIL/CF_GLOBAL_API_KEY not set)");
    return {
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      policyUrl,
      reusablePolicyUrl,
      authMethod: "BearerToken",
    };
  }

  return null;
}

export async function addEmailToAccessPolicy(
  env: Env,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const config = getAccessApiConfig(env);
  if (!config) {
    return { success: false, error: "Cloudflare Access API の環境変数が設定されていません" };
  }

  try {
    // 1. Get current policy (use reusable endpoint for consistency with PUT)
    const getRes = await fetch(config.reusablePolicyUrl, { headers: config.headers });

    if (!getRes.ok) {
      const errText = await getRes.text();
      return { success: false, error: `Access API GET failed (auth=${config.authMethod}): ${getRes.status} ${errText}` };
    }

    const policyData = await getRes.json() as any;
    const policy = policyData.result;

    // 2. Add the new email to include rules
    const existingIncludes = policy.include || [];
    const emailAlreadyExists = existingIncludes.some(
      (inc: any) => inc.email?.email === email
    );

    if (!emailAlreadyExists) {
      existingIncludes.push({ email: { email } });
    }

    // 3. Update policy (try reusable policy endpoint first, then app-specific)
    const updateBody = JSON.stringify({ ...policy, include: existingIncludes });
    let updateRes = await fetch(config.reusablePolicyUrl, {
      method: "PUT",
      headers: config.headers,
      body: updateBody,
    });

    if (!updateRes.ok) {
      // Fallback to app-specific endpoint
      updateRes = await fetch(config.policyUrl, {
        method: "PUT",
        headers: config.headers,
        body: updateBody,
      });
    }

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      return { success: false, error: `Access API PUT failed: ${updateRes.status} ${errText}` };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: `Access API error: ${e.message}` };
  }
}

export async function removeEmailFromAccessPolicy(
  env: Env,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const config = getAccessApiConfig(env);
  if (!config) {
    return { success: false, error: "Cloudflare Access API の環境変数が設定されていません。手動で削除してください。" };
  }

  try {
    // 1. Get current policy (use reusable endpoint for consistency with PUT)
    const getRes = await fetch(config.reusablePolicyUrl, { headers: config.headers });

    if (!getRes.ok) {
      const errText = await getRes.text();
      return { success: false, error: `Access API GET failed (auth=${config.authMethod}): ${getRes.status} ${errText}` };
    }

    const policyData = await getRes.json() as any;
    const policy = policyData.result;

    // 2. Remove matching email from includes
    const existingIncludes = policy.include || [];
    const filtered = existingIncludes.filter(
      (inc: any) => inc.email?.email !== email
    );

    if (filtered.length === existingIncludes.length) {
      return { success: true };
    }

    // 3. Update policy (try reusable policy endpoint first, then app-specific)
    const updateBody = JSON.stringify({ ...policy, include: filtered });
    let updateRes = await fetch(config.reusablePolicyUrl, {
      method: "PUT",
      headers: config.headers,
      body: updateBody,
    });

    if (!updateRes.ok) {
      // Fallback to app-specific endpoint
      updateRes = await fetch(config.policyUrl, {
        method: "PUT",
        headers: config.headers,
        body: updateBody,
      });
    }

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      return { success: false, error: `Access API PUT failed: ${updateRes.status} ${errText}` };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: `Access API error: ${e.message}` };
  }
}
