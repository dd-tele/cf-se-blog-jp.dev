import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/cloudflare";
import app from "~/api";

export async function loader({ request, context }: LoaderFunctionArgs) {
  return app.fetch(request, context.cloudflare.env);
}

export async function action({ request, context }: ActionFunctionArgs) {
  return app.fetch(request, context.cloudflare.env);
}
