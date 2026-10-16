import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { requireUser } from "~/lib/auth.server";
import { getSlideBySlug } from "~/lib/slides.server";
import { getSlideNotes } from "~/lib/slide-notes.server";
import { canPresentSlide } from "~/lib/present.server";
import { SpeakerConsole } from "~/components/SpeakerConsole";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? `スピーカービュー: ${data.slide.title}` : "スピーカービュー" },
  { name: "robots", content: "noindex" },
  { name: "theme-color", content: "#0a0a0a" },
];

// Standalone speaker view (rehearsal): deck + notes on a phone or iPad,
// navigating locally without a main screen.
export async function loader({ params, context, request }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const user = await requireUser(request, env);
  const slide = await getSlideBySlug(env.DB, params.slug!);
  if (!slide) throw new Response("Not Found", { status: 404 });
  if (!slide.presenterEnabled) {
    throw new Response("このスライドはプレゼンテーション機能が OFF です（スライド管理で ON にできます）", { status: 403 });
  }
  if (!canPresentSlide(user, slide)) {
    throw new Response("このスライドのノートを表示する権限がありません", { status: 403 });
  }
  const notes = await getSlideNotes(env.DB, slide.id);
  return {
    slide: { slug: slide.slug, title: slide.title, slideCount: slide.slideCount },
    notes,
  };
}

export default function Speaker() {
  const { slide, notes } = useLoaderData<typeof loader>();
  return <SpeakerConsole slide={slide} notes={notes} room={null} exitHref={`/slides/${slide.slug}`} />;
}
