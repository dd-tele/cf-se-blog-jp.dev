import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { requireUser } from "~/lib/auth.server";
import { ulid } from "~/lib/ulid";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function action({ request, context }: ActionFunctionArgs) {
  await requireUser(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || !(file instanceof File)) {
    return json({ error: "ファイルが選択されていません" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return json({ error: "対応していないファイル形式です（JPEG, PNG, GIF, WebP, SVG のみ）" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return json({ error: "ファイルサイズが大きすぎます（最大 10MB）" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "png";
  const key = `images/${ulid()}.${ext}`;

  const bucket = context.cloudflare.env.R2_BUCKET;
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const siteUrl = context.cloudflare.env.SITE_URL || "https://cf-se-blog-jp.dev";
  const imageUrl = `${siteUrl}/r2/${key}`;

  return json({ url: imageUrl });
}
