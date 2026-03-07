import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { getAuthorPublicProfile } from "~/lib/posts.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.author) return [{ title: "著者が見つかりません" }];
  return [
    { title: `${data.author.displayName} — Cloudflare Solution Blog` },
    { name: "description", content: data.author.bio || `${data.author.displayName} の投稿記事一覧` },
  ];
};

export async function loader({ params, context }: LoaderFunctionArgs) {
  const db = context.cloudflare.env.DB;
  const authorId = params.id;
  if (!authorId) throw new Response("Not Found", { status: 404 });

  const result = await getAuthorPublicProfile(db, authorId);
  if (!result) throw new Response("Not Found", { status: 404 });

  return { author: result.author, posts: result.posts };
}

export default function AuthorProfile() {
  const { author, posts } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors">
            Cloudflare Solution Blog
          </Link>
          <Link to="/posts" className="text-sm text-gray-500 hover:text-gray-700">記事一覧</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Author Card */}
        <div className="mb-10 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              {author.avatarUrl ? (
                <img
                  src={author.avatarUrl}
                  alt={author.displayName}
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold">
                  {author.displayName.charAt(0)}
                </span>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold text-gray-900">{author.displayName}</h1>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {author.jobRole && (
                  <span className="rounded-full bg-brand-50 px-3 py-0.5 text-xs font-medium text-brand-700">
                    {author.jobRole}
                  </span>
                )}
                {author.company && (
                  <span className="text-sm text-gray-500">{author.company}</span>
                )}
              </div>
              {author.bio && (
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{author.bio}</p>
              )}
              {author.expertise && (
                <div className="mt-3">
                  <span className="text-xs font-medium text-gray-400">専門分野:</span>
                  <span className="ml-1 text-sm text-gray-600">{author.expertise}</span>
                </div>
              )}
              {author.profileComment && (
                <p className="mt-2 text-sm text-gray-500 italic">{author.profileComment}</p>
              )}
            </div>
          </div>
        </div>

        {/* Posts */}
        <div>
          <h2 className="mb-6 text-lg font-bold text-gray-900">
            投稿記事
            <span className="ml-2 text-sm font-normal text-gray-400">({posts.length})</span>
          </h2>

          {posts.length === 0 ? (
            <p className="text-sm text-gray-500">まだ公開された記事はありません。</p>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  to={`/posts/${post.slug}`}
                  className="block rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-brand-300 hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    {post.coverImageUrl && (
                      <img
                        src={post.coverImageUrl}
                        alt=""
                        className="hidden h-20 w-28 shrink-0 rounded-lg object-cover sm:block"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 line-clamp-2">{post.title}</h3>
                      {post.excerpt && (
                        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{post.excerpt}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                        {post.categoryName && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{post.categoryName}</span>
                        )}
                        {post.publishedAt && (
                          <span>{new Date(post.publishedAt).toLocaleDateString("ja-JP")}</span>
                        )}
                        {post.readingTimeMinutes && (
                          <span>{post.readingTimeMinutes}分</span>
                        )}
                        {post.viewCount != null && (
                          <span>{post.viewCount.toLocaleString()} views</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
