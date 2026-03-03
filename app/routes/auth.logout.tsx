import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { destroyUserSession } from "~/lib/auth.server";

export async function action({ request }: ActionFunctionArgs) {
  return destroyUserSession(request);
}

export async function loader() {
  return new Response("Method not allowed", { status: 405 });
}
