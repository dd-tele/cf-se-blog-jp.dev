import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { getSlideBySlug } from "~/lib/slides.server";
import { getSlideNotes } from "~/lib/slide-notes.server";
import { issueDeckGrantCookie, verifyRoom } from "~/lib/present.server";
import { SpeakerConsole } from "~/components/SpeakerConsole";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data && "slide" in data && data.slide ? `リモコン: ${data.slide.title}` : "リモコン" },
  { name: "robots", content: "noindex" },
  { name: "referrer", content: "no-referrer" },
  { name: "theme-color", content: "#0a0a0a" },
];

// Phone / tablet remote, paired by scanning the presenter's QR code.
// Authorization is the room key (no login needed on the phone).
export async function loader({ params, context, request }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const url = new URL(request.url);
  const roomId = url.searchParams.get("r");
  const roomKey = url.searchParams.get("k");

  const room = await verifyRoom(env.PRESENT_ROOM, roomId, roomKey);
  const slide = room ? await getSlideBySlug(env.DB, params.slug!) : null;
  // Turning presentation mode off also cuts off already-paired remotes.
  if (!room || !slide || slide.id !== room.slideId || !slide.presenterEnabled) {
    return json(
      { ok: false as const },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  const notes = await getSlideNotes(env.DB, slide.id);
  // Lets the phone load limited/draft decks for the previews without a login.
  const grant = await issueDeckGrantCookie(env, slide.slug, room.expiresAt);

  return json(
    {
      ok: true as const,
      slide: { slug: slide.slug, title: slide.title, slideCount: slide.slideCount },
      notes,
      room: { roomId: roomId!, roomKey: roomKey! },
    },
    { headers: grant ? { "Set-Cookie": grant, "Cache-Control": "no-store" } : { "Cache-Control": "no-store" } }
  );
}

export default function Remote() {
  const data = useLoaderData<typeof loader>();
  if (!data.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-center text-white">
        <div>
          <p className="text-lg font-semibold">この QR コードは使用できません</p>
          <p className="mt-2 text-sm text-white/60">
            発表が終了したか、有効期限が切れています。メイン画面に表示されている最新の QR コードを読み取ってください。
          </p>
        </div>
      </div>
    );
  }
  return <SpeakerConsole slide={data.slide} notes={data.notes} room={data.room} />;
}
