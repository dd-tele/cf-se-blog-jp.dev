// Double opt-in storage for /apply. A submission becomes an access_requests row
// only after the applicant proves they own the address by clicking the link.

import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "~/lib/db.server";
import { accessRequests, applyVerifications, users } from "~/db/schema";
import { ulid } from "~/lib/ulid";
import { createAccessRequest, type AccessRequestInput } from "~/lib/access-requests.server";
import { hashVerificationToken, newVerificationToken, sqlUtc } from "~/lib/apply-guard.server";

export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
/** Cap on verification mails per hour across the whole site (protects sending quota/reputation). */
export const GLOBAL_HOURLY_LIMIT = 30;
/** Cap per client IP per hour (backs up the WAF rate limit). */
export const IP_HOURLY_LIMIT = 3;

export async function purgeExpiredVerifications(db: D1Database): Promise<void> {
  await getDb(db).delete(applyVerifications).where(lt(applyVerifications.expires_at, sqlUtc(new Date())));
}

/**
 * True if this address already has an account, an open/approved request, or an
 * unexpired verification. The caller answers exactly as on success so the form
 * cannot be used to probe which addresses are registered.
 */
export async function isDuplicateApplication(db: D1Database, email: string): Promise<boolean> {
  const d = getDb(db);
  const now = sqlUtc(new Date());
  const [user, request, pending] = await Promise.all([
    d.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).get(),
    d
      .select({ id: accessRequests.id })
      .from(accessRequests)
      .where(and(sql`lower(${accessRequests.email}) = ${email}`, inArray(accessRequests.status, ["pending", "approved"])))
      .get(),
    d
      .select({ id: applyVerifications.id })
      .from(applyVerifications)
      .where(and(eq(applyVerifications.email, email), gt(applyVerifications.expires_at, now)))
      .get(),
  ]);
  return !!(user || request || pending);
}

export async function recentVerificationCounts(db: D1Database, ip: string | null): Promise<{ global: number; ip: number }> {
  const d = getDb(db);
  const since = sqlUtc(new Date(Date.now() - 60 * 60 * 1000));
  const [g, i] = await Promise.all([
    d.select({ n: sql<number>`count(*)` }).from(applyVerifications).where(gt(applyVerifications.created_at, since)).get(),
    ip
      ? d
          .select({ n: sql<number>`count(*)` })
          .from(applyVerifications)
          .where(and(gt(applyVerifications.created_at, since), eq(applyVerifications.client_ip, ip)))
          .get()
      : Promise.resolve({ n: 0 }),
  ]);
  return { global: Number(g?.n ?? 0), ip: Number(i?.n ?? 0) };
}

export async function createVerification(
  db: D1Database,
  input: AccessRequestInput,
  meta: { ip: string | null; country: string | null }
): Promise<{ id: string; token: string; expiresAt: Date }> {
  const token = newVerificationToken();
  const id = ulid();
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
  await getDb(db).insert(applyVerifications).values({
    id,
    email: input.email,
    payload_json: JSON.stringify(input),
    token_hash: await hashVerificationToken(token),
    expires_at: sqlUtc(expiresAt),
    client_ip: meta.ip,
    client_country: meta.country,
    created_at: sqlUtc(new Date()),
  });
  return { id, token, expiresAt };
}

export async function deleteVerification(db: D1Database, id: string): Promise<void> {
  await getDb(db).delete(applyVerifications).where(eq(applyVerifications.id, id));
}

export async function findLiveVerification(db: D1Database, token: string) {
  const row = await getDb(db)
    .select()
    .from(applyVerifications)
    .where(
      and(
        eq(applyVerifications.token_hash, await hashVerificationToken(token)),
        gt(applyVerifications.expires_at, sqlUtc(new Date()))
      )
    )
    .get();
  return row ?? null;
}

/**
 * Consume a verification: create the access request (unless one already
 * exists for the address) and delete the verification row.
 */
export async function confirmVerification(
  db: D1Database,
  token: string
): Promise<{ ok: true; email: string; requestId: string | null } | { ok: false }> {
  const row = await findLiveVerification(db, token);
  if (!row) return { ok: false };

  // Delete first so a double-click cannot create two requests.
  const d = getDb(db);
  const deleted = await d
    .delete(applyVerifications)
    .where(eq(applyVerifications.id, row.id))
    .returning({ id: applyVerifications.id });
  if (deleted.length === 0) return { ok: false };

  const input = JSON.parse(row.payload_json) as AccessRequestInput;
  const existing = await d
    .select({ id: accessRequests.id })
    .from(accessRequests)
    .where(and(sql`lower(${accessRequests.email}) = ${row.email}`, inArray(accessRequests.status, ["pending", "approved"])))
    .get();
  if (existing) return { ok: true, email: row.email, requestId: null };

  const { id } = await createAccessRequest(db, input);
  return { ok: true, email: row.email, requestId: id };
}
