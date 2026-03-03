import type { LoaderFunctionArgs } from "@remix-run/cloudflare";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const key = params["*"];
  if (!key) throw new Response("Not Found", { status: 404 });

  const bucket = context.cloudflare.env.R2_BUCKET;
  const object = await bucket.get(key);

  if (!object) throw new Response("Not Found", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(object.body as ReadableStream, { headers });
}
