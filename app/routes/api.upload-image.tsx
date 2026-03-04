import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import app from "~/api";

export async function action({ request, context }: ActionFunctionArgs) {
  return app.fetch(request, context.cloudflare.env);
}
