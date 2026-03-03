import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { getPublishedPosts, getAllCategories } from "~/lib/posts.server";

export async function loader({ context }: LoaderFunctionArgs) {
  const db = context.cloudflare.env.DB;
  const siteUrl = context.cloudflare.env.SITE_URL ?? "https://cf-se-blog-jp.dev";

  const [posts, categories] = await Promise.all([
    getPublishedPosts(db, { limit: 500, offset: 0 }),
    getAllCategories(db),
  ]);

  const staticPages = [
    { loc: siteUrl, changefreq: "daily", priority: "1.0" },
    { loc: `${siteUrl}/posts`, changefreq: "daily", priority: "0.9" },
    { loc: `${siteUrl}/search`, changefreq: "weekly", priority: "0.6" },
    { loc: `${siteUrl}/auth/login`, changefreq: "monthly", priority: "0.3" },
  ];

  const categoryPages = categories.map((c) => ({
    loc: `${siteUrl}/posts?category=${c.slug}`,
    changefreq: "weekly" as const,
    priority: "0.7",
  }));

  const postPages = posts.map((p) => ({
    loc: `${siteUrl}/posts/${p.slug}`,
    lastmod: p.publishedAt ?? undefined,
    changefreq: "monthly" as const,
    priority: "0.8",
  }));

  const allUrls = [...staticPages, ...categoryPages, ...postPages];

  const urlEntries = allUrls
    .map((u) => {
      const lastmod = "lastmod" in u && u.lastmod
        ? `\n    <lastmod>${new Date(u.lastmod as string).toISOString().split("T")[0]}</lastmod>`
        : "";
      return `  <url>
    <loc>${escapeXml(u.loc)}</loc>${lastmod}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`;
    })
    .join("\n");

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
