import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { getPublishedPosts } from "~/lib/posts.server";

export async function loader({ context }: LoaderFunctionArgs) {
  const db = context.cloudflare.env.DB;
  const siteUrl = context.cloudflare.env.SITE_URL ?? "https://cf-se-blog-jp.dev";
  const siteName = context.cloudflare.env.SITE_NAME ?? "Cloudflare Solution Blog";

  const posts = await getPublishedPosts(db, { limit: 50, offset: 0 });

  const items = posts
    .map((p) => {
      const pubDate = p.publishedAt
        ? new Date(p.publishedAt).toUTCString()
        : new Date().toUTCString();
      const link = `${siteUrl}/posts/${p.slug}`;
      const desc = escapeXml(p.excerpt ?? "");
      const author = p.authorName ?? "";
      const category = p.categoryName ? `<category>${escapeXml(p.categoryName)}</category>` : "";

      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${desc}</description>
      <dc:creator>${escapeXml(author)}</dc:creator>
      ${category}
    </item>`;
    })
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${siteUrl}</link>
    <description>Cloudflare SE とユーザーが実践したエンジニアリング事例を共有するテクニカルブログ</description>
    <language>ja</language>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
