import { eq, asc } from "drizzle-orm";
import { getDb } from "~/lib/db.server";
import { slideNotes } from "~/db/schema";
import {
  MAX_NOTE_CHARS,
  MAX_NOTE_FILE_BYTES,
  MAX_NOTE_SLIDES,
  NotesImportError,
  parseNotesFile,
} from "~/lib/slide-notes-import";

export { MAX_NOTE_CHARS, MAX_NOTE_SLIDES };

/**
 * File names inside a slide ZIP that are treated as speaker notes:
 * speaker-notes.md / speaker_notes.json / notes.md etc. (any folder).
 * These are imported into slide_notes and never stored as public deck assets.
 */
const BUNDLE_NOTES_RE = /(^|\/)(speaker[-_ ]?notes|notes)\.(md|markdown|json)$/i;

export type NotesUpload = { notes: string[]; source: string };

/**
 * Split speaker-note files out of a bundle's assets. Returns the remaining
 * (publishable) assets and the parsed notes, if any. Markdown wins over JSON
 * when both are present. Throws Error with a user-facing message on bad notes.
 */
export function takeNotesFromBundle<T extends { path: string; data: Uint8Array }>(
  assets: T[]
): { assets: T[]; notes: NotesUpload | null } {
  const noteFiles = assets.filter((a) => BUNDLE_NOTES_RE.test(a.path));
  if (!noteFiles.length) return { assets, notes: null };
  const rest = assets.filter((a) => !BUNDLE_NOTES_RE.test(a.path));
  const depth = (p: string) => p.split("/").length;
  const pick = [...noteFiles].sort((a, b) => {
    const am = /\.json$/i.test(a.path) ? 1 : 0;
    const bm = /\.json$/i.test(b.path) ? 1 : 0;
    return am - bm || depth(a.path) - depth(b.path) || a.path.localeCompare(b.path);
  })[0];
  if (pick.data.byteLength > MAX_NOTE_FILE_BYTES) {
    throw new Error(`ZIP 内のスピーカーノート（${pick.path}）が大きすぎます（上限 2MB）。`);
  }
  try {
    const parsed = parseNotesFile(pick.path, new TextDecoder().decode(pick.data));
    return { assets: rest, notes: { notes: parsed.notes, source: pick.path } };
  } catch (e) {
    const msg = e instanceof NotesImportError ? e.message : "読み取れませんでした。";
    throw new Error(`ZIP 内のスピーカーノート（${pick.path}）: ${msg}`);
  }
}

/**
 * Parse an optional speaker-notes file field from a multipart form.
 * Returns null when no file was chosen. Throws Error with a user-facing message.
 */
export async function readNotesUpload(value: FormDataEntryValue | null): Promise<NotesUpload | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > MAX_NOTE_FILE_BYTES) {
    throw new Error("スピーカーノートのファイルが大きすぎます（上限 2MB）。");
  }
  try {
    const parsed = parseNotesFile(value.name, await value.text());
    return { notes: parsed.notes, source: value.name };
  } catch (e) {
    const msg = e instanceof NotesImportError ? e.message : "読み取れませんでした。";
    throw new Error(`スピーカーノート（${value.name}）: ${msg}`);
  }
}

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
