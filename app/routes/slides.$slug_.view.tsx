import { redirect } from "@remix-run/cloudflare";
import type { LoaderFunctionArgs } from "@remix-run/cloudflare";

// Backwards-compatible entry point. The canonical viewer is now the
// "directory" route /slides/:slug/a/ which also serves bundled assets.
export async function loader({ params }: LoaderFunctionArgs) {
  return redirect(`/slides/${params.slug}/a/`);
}
