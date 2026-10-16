import { eq, asc } from "drizzle-orm";
import { getDb } from "~/lib/db.server";
import { slideNotes } from "~/db/schema";

export const MAX_NOTE_CHARS = 8000;
export const MAX_NOTE_SLIDES = 500;

/** Speaker notes for a deck as a dense array indexed by linear slide index. */
export async function getSlideNotes(db: D1Database, slideId: string): Promise<string[]> {
  const rows = await getDb(db)
    .select({ idx: slideNotes.idx, body: slideNotes.body })
    .from(slideNotes)
    .where(eq(slideNotes.slide_id, slideId))
    .orderBy(asc(slideNotes.idx));
  const out: string[] = [];
  for (const r of rows) {
    if (r.idx >= 0 && r.idx < MAX_NOTE_SLIDES) out[r.idx] = r.body;
  }
  for (let i = 0; i < out.length; i++) if (out[i] === undefined) out[i] = "";
  return out;
}

/** Replace all notes for a deck. Empty entries are not stored. */
export async function saveSlideNotes(
  db: D1Database,
  slideId: string,
  notes: string[]
): Promise<number> {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const stmts: D1PreparedStatement[] = [
    db.prepare("DELETE FROM slide_notes WHERE slide_id = ?").bind(slideId),
  ];
  let saved = 0;
  notes.slice(0, MAX_NOTE_SLIDES).forEach((raw, idx) => {
    const body = String(raw ?? "").slice(0, MAX_NOTE_CHARS).replace(/\r\n/g, "\n");
    if (!body.trim()) return;
    saved += 1;
    stmts.push(
      db
        .prepare("INSERT INTO slide_notes (slide_id, idx, body, updated_at) VALUES (?, ?, ?, ?)")
        .bind(slideId, idx, body, now)
    );
  });
  await db.batch(stmts);
  return saved;
}
