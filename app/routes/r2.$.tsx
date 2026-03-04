import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import app from "~/api";

export async function loader({ request, context }: LoaderFunctionArgs) {
  return app.fetch(request, context.cloudflare.env);
}
