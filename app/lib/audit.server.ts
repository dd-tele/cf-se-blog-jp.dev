import { getDb } from "~/lib/db.server";
import { auditLogs } from "~/db/schema";
import { ulid } from "~/lib/ulid";

export type AuditAction =
  | "post.create"
  | "post.update"
  | "post.approve"
  | "post.reject"
  | "post.delete"
  | "chat.message"
  | "chat.flagged"
  | "chat.reply"
  | "thread.resolve"
  | "thread.flag"
  | "thread.delete"
  | "message.delete"
  | "ai.summary"
  | "ai.draft"
  | "ai.trend_report"
  | "admin.login"
  | "user.login";

export type ResourceType =
  | "post"
  | "thread"
  | "message"
  | "user"
  | "ai_summary"
  | "ai_draft"
  | "trend_report";

export async function writeAuditLog(
  db: D1Database,
  opts: {
    userId?: string;
    action: AuditAction;
    resourceType: ResourceType;
    resourceId?: string;
    details?: Record<string, unknown>;
    ip?: string;
  }
) {
  try {
    const d = getDb(db);
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    await d.insert(auditLogs).values({
      id: ulid(),
      user_id: opts.userId ?? null,
      action: opts.action,
      resource_type: opts.resourceType,
      resource_id: opts.resourceId ?? null,
      details_json: opts.details ? JSON.stringify(opts.details) : null,
      ip_address: opts.ip ?? null,
      created_at: now,
    });
  } catch (e) {
    console.error("Audit log write failed:", e);
  }
}
