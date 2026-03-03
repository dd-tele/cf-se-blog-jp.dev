import { json, type ActionFunctionArgs } from "@remix-run/cloudflare";
import { requireUser } from "~/lib/auth.server";
import { suggestTags } from "~/lib/ai.server";

export async function action({ request, context }: ActionFunctionArgs) {
  await requireUser(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = (await request.json()) as { content?: string };
  const { content } = body;
  if (!content) {
    return json({ error: "content is required" }, { status: 400 });
  }

  const ai = context.cloudflare.env.AI;
  const tags = await suggestTags(ai, content);
  return json({ tags });
}
