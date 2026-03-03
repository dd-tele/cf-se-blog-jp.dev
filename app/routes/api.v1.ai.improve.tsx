import { json, type ActionFunctionArgs } from "@remix-run/cloudflare";
import { requireUser } from "~/lib/auth.server";
import { improveText } from "~/lib/ai.server";

export async function action({ request, context }: ActionFunctionArgs) {
  await requireUser(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = (await request.json()) as { text?: string };
  const { text } = body;
  if (!text) {
    return json({ error: "text is required" }, { status: 400 });
  }

  const ai = context.cloudflare.env.AI;
  const improved = await improveText(ai, text);
  return json({ improved });
}
