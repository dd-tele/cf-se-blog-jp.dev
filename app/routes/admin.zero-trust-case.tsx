import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import {
  Form,
  Link,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
} from "@remix-run/react";
import { useEffect } from "react";
import { aiDraftRequests } from "~/db/schema";
import { requireRole } from "~/lib/auth.server";
import { getDb } from "~/lib/db.server";
import { createPost, ensureUser } from "~/lib/posts.server";
import { ulid } from "~/lib/ulid";
import { AdminHeader } from "~/components/AdminHeader";
import {
  anonymizeFreeText,
  collectZeroTrustSnapshot,
  type ZeroTrustSnapshot,
} from "~/lib/zero-trust-case.server";
import {
  type CaseContext,
} from "~/lib/zero-trust-case-prompt";

const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const MAX_SNAPSHOT_SIZE = 100_000;
const MAX_CONTEXT_SIZE = 100_000;
const PREVIEW_TTL_SECONDS = 15 * 60;

export const meta: MetaFunction = () => [
  { title: "事例ドラフト生成 — Cloudflare フィールドノート" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireRole(request, ["admin"], context.cloudflare.env);
  await context.cloudflare.env.DB.prepare(
    "DELETE FROM zero_trust_case_previews WHERE expires_at < ?"
  )
    .bind(Math.floor(Date.now() / 1000))
    .run();
  return { user };
}

function getCaseContext(formData: FormData): CaseContext {
  return {
    customerAlias: anonymizeFreeText(String(formData.get("customerAlias") ?? "顧客組織")) || "顧客組織",
    contractSeats: anonymizeFreeText(String(formData.get("contractSeats") ?? "")),
    contractedBandwidth: anonymizeFreeText(String(formData.get("contractedBandwidth") ?? "")),
    licenseTypes: anonymizeFreeText(String(formData.get("licenseTypes") ?? "")),
    background: anonymizeFreeText(String(formData.get("background") ?? "")),
    challenges: anonymizeFreeText(String(formData.get("challenges") ?? "")),
    pocOnboardingChallenges: anonymizeFreeText(String(formData.get("pocOnboardingChallenges") ?? "")),
    outcomes: anonymizeFreeText(String(formData.get("outcomes") ?? "")),
    futurePlans: anonymizeFreeText(String(formData.get("futurePlans") ?? "")),
    seNotes: anonymizeFreeText(String(formData.get("seNotes") ?? "")),
  };
}

function validateCaseContext(caseContext: CaseContext): string | null {
  if (caseContext.customerAlias.length > 80) return "顧客エイリアスは80文字以内で入力してください。";
  if (
    caseContext.contractSeats.length > 200 ||
    caseContext.contractedBandwidth.length > 200 ||
    caseContext.licenseTypes.length > 200
  ) {
    return "各契約情報は200文字以内で入力してください。";
  }
  const fields = [
    caseContext.background,
    caseContext.challenges,
    caseContext.pocOnboardingChallenges,
    caseContext.outcomes,
    caseContext.futurePlans,
    caseContext.seNotes,
  ];
  if (fields.some((value) => value.length > 4_000)) return "各SE入力は4,000文字以内で入力してください。";
  if (fields.reduce((total, value) => total + value.length, 0) > 16_000) {
    return "SE入力の合計は16,000文字以内にしてください。";
  }
  return null;
}

function isCaseContext(value: unknown): value is CaseContext {
  if (!value || typeof value !== "object") return false;
  const context = value as Partial<CaseContext>;
  return [
    context.customerAlias,
    context.contractSeats,
    context.contractedBandwidth,
    context.licenseTypes,
    context.background,
    context.challenges,
    context.pocOnboardingChallenges,
    context.outcomes,
    context.futurePlans,
    context.seNotes,
  ]
    .every((item) => typeof item === "string");
}

function isValidSnapshot(value: unknown): value is ZeroTrustSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ZeroTrustSnapshot>;
  return (
    typeof snapshot.collectedAt === "string" &&
    typeof snapshot.architecture === "string" &&
    Array.isArray(snapshot.limitations) &&
    snapshot.limitations.every((item) => typeof item === "string") &&
    Array.isArray(snapshot.sections) &&
    snapshot.sections.every(
      (section) =>
        section &&
        typeof section.key === "string" &&
        typeof section.label === "string" &&
        (section.status === "collected" || section.status === "unavailable") &&
        Array.isArray(section.facts) &&
        section.facts.length <= 100 &&
        section.facts.every((fact) => typeof fact === "string" && fact.length <= 10_000) &&
        (section.note === undefined || typeof section.note === "string")
    )
  );
}

function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw new Response("Forbidden", { status: 403 });
  }
}

function buildStarterDraft(snapshot: ZeroTrustSnapshot, caseContext: CaseContext): string {
  const configuration = snapshot.sections
    .map((section) => {
      const details = section.status === "collected"
        ? section.facts.join("。") || "構成情報なし。"
        : `未取得。${section.note ?? ""}`;
      return `### ${section.label}\n\n${details}`;
    })
    .join("\n\n");
  const contractDetails = [
    caseContext.contractSeats ? `- 契約シート数: ${caseContext.contractSeats}` : "",
    caseContext.contractedBandwidth ? `- 契約帯域: ${caseContext.contractedBandwidth}` : "",
    caseContext.licenseTypes ? `- ライセンス種類: ${caseContext.licenseTypes}` : "",
  ].filter(Boolean).join("\n");
  const contractSection = contractDetails ? `\n\n## 契約概要\n\n${contractDetails}` : "";

  return `# Cloudflare Zero Trust導入事例（要編集）

> 匿名化済みの収集結果から作成した限定公開の下書きです。公開前に顧客確認と技術レビューを行ってください。

## 導入背景

${caseContext.customerAlias}では、${caseContext.background || "導入背景を追記してください。"}${contractSection}

## 解決すべき課題

${caseContext.challenges || "導入前の課題を追記してください。"}

## PoCとオンボーディング中の課題

${caseContext.pocOnboardingChallenges || "PoCや展開時の課題を追記してください。"}

## 設計方針と実装

${caseContext.seNotes || "設計判断を追記してください。"}

${configuration}

## アーキテクチャ

\`\`\`mermaid
${snapshot.architecture}
\`\`\`

## 導入効果

${caseContext.outcomes || "導入後の効果を追記してください。"}

## 今後の取り組みと課題

${caseContext.futurePlans || "今後取り組む内容や残る課題を追記してください。"}

## 取得上の制約

${snapshot.limitations.map((item) => `- ${item}`).join("\n")}
`;
}

export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const user = await requireRole(request, ["admin"], env);
  assertSameOrigin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "generation-status") {
    const requestId = String(formData.get("requestId") ?? "");
    if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(requestId)) {
      return { generationError: "生成ジョブが無効です。" };
    }
    let job = await env.DB.prepare(
      "SELECT status, post_id, created_at FROM ai_draft_requests WHERE id = ? AND user_id = ?"
    )
      .bind(requestId, user.id)
      .first<{
        status: "pending" | "completed" | "failed";
        post_id: string | null;
        created_at: string;
      }>();
    if (!job) return { generationError: "生成ジョブが見つかりません。" };
    const createdAt = Date.parse(`${job.created_at.replace(" ", "T")}Z`);
    if (job.status === "pending" && Number.isFinite(createdAt) && Date.now() - createdAt > 20 * 60_000) {
      const stalePostId = job.post_id;
      const statements = [
        env.DB.prepare(
          "UPDATE ai_draft_requests SET post_id = NULL, status = 'failed' WHERE id = ? AND user_id = ? AND status = 'pending'"
        ).bind(requestId, user.id),
      ];
      if (stalePostId) {
        statements.push(
          env.DB.prepare("DELETE FROM posts WHERE id = ? AND title = ?").bind(
            stalePostId,
            "Cloudflare Zero Trust導入事例（AI生成中）"
          )
        );
      }
      await env.DB.batch(statements);
      job = { ...job, status: "failed", post_id: null };
    }
    return { generationStatus: job.status, postId: job.post_id, requestId };
  }

  let caseContext = getCaseContext(formData);

  if (intent === "collect") {
    const contextError = validateCaseContext(caseContext);
    if (contextError) return { error: contextError, caseContext };
    const accountId = String(formData.get("accountId") ?? "").trim();
    const apiToken = String(formData.get("apiToken") ?? "").trim();
    if (!/^[a-f0-9]{32}$/i.test(accountId)) {
      return { error: "Account IDの形式を確認してください。", caseContext };
    }
    if (!apiToken || apiToken.length > 512) {
      return { error: "一時API Tokenを入力してください。", caseContext };
    }

    const snapshot = await collectZeroTrustSnapshot(accountId, apiToken);
    const snapshotJson = JSON.stringify(snapshot);
    const contextJson = JSON.stringify(caseContext);
    if (snapshotJson.length > MAX_SNAPSHOT_SIZE || contextJson.length > MAX_CONTEXT_SIZE) {
      return { error: "収集結果が大きすぎます。入力または対象構成を減らしてください。", caseContext };
    }
    const previewId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM zero_trust_case_previews WHERE expires_at < ?").bind(now),
      env.DB.prepare(
        "INSERT INTO zero_trust_case_previews (id, user_id, snapshot_json, context_json, expires_at) VALUES (?, ?, ?, ?, ?)"
      ).bind(
        previewId,
        user.id,
        snapshotJson,
        contextJson,
        now + PREVIEW_TTL_SECONDS
      ),
    ]);
    return { snapshot, caseContext, previewId };
  }

  if (intent !== "generate") return { error: "不明な操作です。", caseContext };

  const previewId = String(formData.get("previewId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(previewId)) {
    return { error: "プレビューが無効です。もう一度収集してください。", caseContext };
  }
  const storedPreview = await env.DB.prepare(
    "SELECT user_id, snapshot_json, context_json FROM zero_trust_case_previews WHERE id = ? AND expires_at >= ?"
  )
    .bind(previewId, Math.floor(Date.now() / 1000))
    .first<{ user_id: string; snapshot_json: string; context_json: string }>();
  if (!storedPreview) {
    return { error: "プレビューの有効期限が切れました。もう一度収集してください。", caseContext };
  }

  if (
    storedPreview.snapshot_json.length > MAX_SNAPSHOT_SIZE ||
    storedPreview.context_json.length > MAX_CONTEXT_SIZE
  ) {
    return { error: "収集結果が大きすぎます。入力を減らして再度収集してください。", caseContext };
  }

  let snapshot: unknown;
  let storedContext: unknown;
  try {
    snapshot = JSON.parse(storedPreview.snapshot_json);
    storedContext = JSON.parse(storedPreview.context_json);
  } catch {
    return { error: "収集結果を読み取れません。もう一度収集してください。", caseContext };
  }
  if (
    storedPreview.user_id !== user.id ||
    !isValidSnapshot(snapshot) ||
    !isCaseContext(storedContext)
  ) {
    return { error: "収集結果の形式が無効です。もう一度収集してください。", caseContext };
  }
  caseContext = storedContext;
  const contextError = validateCaseContext(caseContext);
  if (contextError) return { error: contextError, caseContext };

  const consumed = await env.DB.prepare(
    "DELETE FROM zero_trust_case_previews WHERE id = ? AND user_id = ? AND expires_at >= ?"
  )
    .bind(previewId, user.id, Math.floor(Date.now() / 1000))
    .run();
  if (consumed.meta.changes !== 1) {
    return { error: "プレビューはすでに使用済みです。もう一度収集してください。", caseContext };
  }

  await ensureUser(env.DB, user);
  const inputForRecord = { snapshot, caseContext };
  let createdPostId: string | null = null;
  let requestId: string | null = null;
  const starterDraft = buildStarterDraft(snapshot, caseContext);

  try {
    const post = await createPost(
      env.DB,
      {
        title: "Cloudflare Zero Trust導入事例（AI生成中）",
        content: starterDraft,
        categoryId: "cat-zt",
        tagsJson: JSON.stringify(["Zero Trust", "導入事例"]),
        visibility: "limited",
      },
      user
    );
    createdPostId = post.id;

    requestId = ulid();
    const db = getDb(env.DB);
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    await db.insert(aiDraftRequests).values({
      id: requestId,
      user_id: user.id,
      post_id: post.id,
      input_data_json: JSON.stringify(inputForRecord),
      model_used: MODEL,
      status: "pending",
      created_at: now,
    });

    await env.CASE_DRAFT_QUEUE.send({ requestId });
    return {
      snapshot,
      caseContext,
      generation: { requestId, postId: post.id, status: "pending" as const },
    };
  } catch (error) {
    if (createdPostId) {
      try {
        const cleanup = [];
        if (requestId) {
          cleanup.push(
            env.DB.prepare(
              "UPDATE ai_draft_requests SET post_id = NULL, status = 'failed' WHERE id = ?"
            ).bind(requestId)
          );
        }
        cleanup.push(env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(createdPostId));
        await env.DB.batch(cleanup);
      } catch (saveError) {
        console.error(
          JSON.stringify({
            message: "Zero Trust fallback draft save failed",
            error: saveError instanceof Error ? saveError.message : String(saveError),
          })
        );
      }
    }
    try {
      await env.DB.prepare(
        "INSERT OR REPLACE INTO zero_trust_case_previews (id, user_id, snapshot_json, context_json, expires_at) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(
          previewId,
          user.id,
          storedPreview.snapshot_json,
          storedPreview.context_json,
          Math.floor(Date.now() / 1000) + PREVIEW_TTL_SECONDS
        )
        .run();
    } catch (restoreError) {
      console.error(
        JSON.stringify({
          message: "Case Builder preview restore failed",
          error: restoreError instanceof Error ? restoreError.message : String(restoreError),
        })
      );
    }
    console.error(
      JSON.stringify({
        message: "Zero Trust case draft generation failed",
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { error: "AI生成ジョブを開始できませんでした。時間をおいて再度お試しください。", snapshot, caseContext, previewId };
  }
}

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500";

export default function CaseBuilder() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const statusFetcher = useFetcher<{
    generationStatus?: "pending" | "completed" | "failed";
    postId?: string | null;
    requestId?: string;
    generationError?: string;
  }>();
  const submittingIntent = navigation.formData?.get("intent");
  const snapshot = actionData && "snapshot" in actionData ? actionData.snapshot : undefined;
  const previewId = actionData && "previewId" in actionData ? actionData.previewId : undefined;
  const values = actionData && "caseContext" in actionData ? actionData.caseContext : undefined;
  const generation = actionData && "generation" in actionData ? actionData.generation : undefined;
  const statusData = statusFetcher.data;
  const currentStatus = statusData && statusData.requestId === generation?.requestId
    ? statusData.generationStatus
    : undefined;
  const generationStatus = currentStatus ?? generation?.status;

  useEffect(() => {
    if (!generation) return;
    if (generationStatus === "completed" && generation.postId) {
      navigate(`/portal/edit/${generation.postId}`);
      return;
    }
    if (generationStatus === "failed" || statusFetcher.data?.generationError) return;
    if (statusFetcher.state !== "idle") return;
    const timer = window.setTimeout(() => {
      statusFetcher.submit(
        { intent: "generation-status", requestId: generation.requestId },
        { method: "post" }
      );
    }, 2_000);
    return () => window.clearTimeout(timer);
  }, [generation, generationStatus, navigate, statusFetcher]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminHeader user={user} theme="dark" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-3xl">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.25em] text-orange-400">Evidence to narrative</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">事例ドラフト生成</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            ソリューション構成とSEの知見から事例ドラフトを作成します。現在はZero Trust構成の収集に対応しています。一時API Tokenと生API応答は保存せず、収集内容は15分間だけ生成に利用できます。固有情報は生成後の下書きで確認・修正してください。
          </p>
        </div>

        {actionData && "error" in actionData && actionData.error && (
          <div className="mb-6 rounded-lg border border-red-900 bg-red-950/60 px-4 py-3 text-sm text-red-200">
            {actionData.error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 font-mono text-sm font-bold text-slate-950">1</span>
              <div>
                <h2 className="font-semibold">構成収集とSE入力</h2>
                <p className="text-xs text-slate-500">構成と事例の文脈を入力します</p>
              </div>
            </div>

            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="collect" />
              <label className="block text-sm text-slate-300">
                Account ID
                <input name="accountId" required pattern="[a-fA-F0-9]{32}" autoComplete="off" className={inputClass} />
              </label>
              <label className="block text-sm text-slate-300">
                一時API Token
                <input name="apiToken" type="password" required autoComplete="off" className={inputClass} />
                <span className="mt-1 block text-xs text-slate-500">読み取り専用・短期有効のTokenを使用してください。</span>
              </label>
              <label className="block text-sm text-slate-300">
                顧客エイリアス
                <input name="customerAlias" defaultValue={values?.customerAlias ?? "顧客組織A"} className={inputClass} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-300">
                  契約シート数
                  <input
                    name="contractSeats"
                    maxLength={200}
                    defaultValue={values?.contractSeats}
                    className={inputClass}
                    placeholder="例: 1,000シート"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  契約帯域
                  <input
                    name="contractedBandwidth"
                    maxLength={200}
                    defaultValue={values?.contractedBandwidth}
                    className={inputClass}
                    placeholder="例: 1 Gbps"
                  />
                </label>
              </div>
              <label className="block text-sm text-slate-300">
                ライセンス種類
                <input
                  name="licenseTypes"
                  maxLength={200}
                  defaultValue={values?.licenseTypes}
                  className={inputClass}
                  placeholder="例: Zero Trust Standard、Browser Isolation"
                />
              </label>
              <label className="block text-sm text-slate-300">
                導入背景（SE入力）
                <textarea name="background" rows={3} defaultValue={values?.background} className={inputClass} placeholder="組織やプロジェクトを特定できない表現で入力" />
              </label>
              <label className="block text-sm text-slate-300">
                導入前の課題（SE入力）
                <textarea name="challenges" rows={3} defaultValue={values?.challenges} className={inputClass} />
              </label>
              <label className="block text-sm text-slate-300">
                PoCとオンボーディング中の課題（SE入力）
                <textarea
                  name="pocOnboardingChallenges"
                  rows={3}
                  defaultValue={values?.pocOnboardingChallenges}
                  className={inputClass}
                  placeholder="検証・展開時に直面した課題や対応上の学び"
                />
              </label>
              <label className="block text-sm text-slate-300">
                導入効果（SE入力）
                <textarea name="outcomes" rows={3} defaultValue={values?.outcomes} className={inputClass} />
              </label>
              <label className="block text-sm text-slate-300">
                今後取り組むことや課題（SE入力）
                <textarea name="futurePlans" rows={3} defaultValue={values?.futurePlans} className={inputClass} />
              </label>
              <label className="block text-sm text-slate-300">
                設計判断・補足（SE入力）
                <textarea name="seNotes" rows={3} defaultValue={values?.seNotes} className={inputClass} />
              </label>
              <button
                type="submit"
                disabled={navigation.state !== "idle"}
                className="w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-orange-400 disabled:opacity-50"
              >
                {submittingIntent === "collect" ? "構成を収集中..." : "構成を収集"}
              </button>
            </Form>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400 font-mono text-sm font-bold text-slate-950">2</span>
              <div>
                <h2 className="font-semibold">収集内容プレビュー</h2>
                <p className="text-xs text-slate-500">AIへ送信・D1へ保存される情報</p>
              </div>
            </div>

            {!snapshot ? (
              <div className="flex min-h-80 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center text-sm leading-6 text-slate-500">
                収集後、製品別の取得状況と構成要約がここに表示されます。
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  {snapshot.sections.map((section) => (
                    <article key={section.key} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">{section.label}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${section.status === "collected" ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-300"}`}>
                          {section.status === "collected" ? "取得済み" : "未取得"}
                        </span>
                      </div>
                      {section.facts.length > 0 ? (
                        <>
                          <ul className="space-y-1 text-xs leading-5 text-slate-400">
                            {section.facts.map((fact) => <li key={fact}>{fact}</li>)}
                          </ul>
                          {section.note && <p className="mt-2 text-xs text-amber-300">{section.note}</p>}
                        </>
                      ) : (
                        <p className="text-xs leading-5 text-slate-500">{section.note}</p>
                      )}
                    </article>
                  ))}
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">AI送信データ</h3>
                  <pre className="max-h-72 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-[11px] leading-5 text-cyan-200">
                    {JSON.stringify({ snapshot, caseContext: values }, null, 2)}
                  </pre>
                </div>

                <Form method="post" className="space-y-4 border-t border-slate-800 pt-5">
                  <input type="hidden" name="intent" value="generate" />
                  <input type="hidden" name="previewId" value={previewId ?? ""} />
                  <button
                    type="submit"
                    disabled={navigation.state !== "idle" || generationStatus === "pending"}
                    className="w-full rounded-lg bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
                  >
                    {submittingIntent === "generate" || generationStatus === "pending"
                      ? "AI下書きを生成中..."
                      : "限定公開の下書きを生成"}
                  </button>
                  {generationStatus === "pending" && (
                    <p className="text-center text-xs leading-5 text-cyan-200">
                      記事を生成しています。完成すると編集画面へ自動的に移動します。そのままお待ちください。
                    </p>
                  )}
                  {(generationStatus === "failed" || statusFetcher.data?.generationError) && (
                    <p className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-xs text-red-200">
                      {statusFetcher.data?.generationError ?? "AI生成に失敗しました。時間をおいてもう一度お試しください。"}
                    </p>
                  )}
                </Form>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
