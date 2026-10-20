import {
  buildCasePrompt,
  buildCaseTitle,
  buildDeviceAccessDiagram,
  type CaseContext,
} from "../../../app/lib/zero-trust-case-prompt";
import type { ZeroTrustSnapshot } from "../../../app/lib/zero-trust-case.server";

const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const PROCESSING_TITLE = "Cloudflare Zero Trust導入事例（AI生成中）";

interface Env {
  DB: D1Database;
  AI: Ai;
}

interface CaseDraftJob {
  requestId: string;
}

interface StoredJob {
  id: string;
  post_id: string | null;
  input_data_json: string;
  status: "pending" | "completed" | "failed";
  created_at: string;
}

interface StoredInput {
  snapshot: ZeroTrustSnapshot;
  caseContext: CaseContext;
}

interface AIResponse {
  response?: string;
  result?: { response?: string };
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string };
  }>;
}

function getResponseText(response: AIResponse): string {
  return response.response ?? response.result?.response ?? response.choices?.[0]?.message?.content ?? "";
}

function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#*_>`\[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function enforceDeviceAccessDiagram(markdown: string, diagram: string): string {
  const heading = /^##\s+Device & Access Control\s*$/m;
  const headingMatch = heading.exec(markdown);
  if (!headingMatch) return markdown;
  const sectionStart = headingMatch.index;
  const contentStart = sectionStart + headingMatch[0].length;
  const nextSection = markdown.slice(contentStart).search(/^##\s+/m);
  const sectionEnd = nextSection === -1 ? markdown.length : contentStart + nextSection;
  const section = markdown.slice(sectionStart, sectionEnd);
  const mermaid = /```mermaid\s*[\s\S]*?```/;
  const enforced = mermaid.test(section)
    ? section.replace(mermaid, `\`\`\`mermaid\n${diagram}\n\`\`\``)
    : `${section.trimEnd()}\n\n\`\`\`mermaid\n${diagram}\n\`\`\`\n\n`;
  return `${markdown.slice(0, sectionStart)}${enforced}${markdown.slice(sectionEnd)}`;
}

async function completeJob(env: Env, job: StoredJob): Promise<void> {
  if (!job.post_id) throw new Error("job has no post");
  const input = JSON.parse(job.input_data_json) as StoredInput;
  if (!input.snapshot || !input.caseContext) throw new Error("job input is invalid");

  const aiResponse = (await env.AI.run(MODEL as any, {
    messages: [
      {
        role: "system",
        content: "あなたは構成と設計意図を理解したCloudflare Zero TrustのシニアSEです。APIや情報収集を客観視するメタコメント、推測表現、一般論を使わず、提供された事実だけを具体的な技術記事として断定形で説明してください。",
      },
      { role: "user", content: buildCasePrompt(input.snapshot, input.caseContext) },
    ],
    max_tokens: 8192,
    temperature: 0.3,
  })) as AIResponse;

  const content = getResponseText(aiResponse).trim();
  const firstLine = content.split(/\r?\n/, 1)[0];
  if (content.length < 1_000) throw new Error("AI response is too short");
  if (!/^#\s+.+$/.test(firstLine)) throw new Error("AI response has no title heading");
  if (aiResponse.choices?.[0]?.finish_reason === "length") {
    throw new Error("AI response reached the token limit");
  }
  if (/(?:回答できません|お手伝いできません|I cannot|I can't assist)/i.test(content)) {
    throw new Error("AI declined the generation request");
  }

  const generatedTitle = content.match(/^#\s+(.+)$/m)?.[1]?.trim() || "";
  const title = buildCaseTitle(input.caseContext);
  const contentWithoutTitle = content
    .replace(/^#\s+.+(?:\r?\n)+/, "")
    .split(/\r?\n/)
    .filter((line) => {
      const heading = line.replace(/^#+\s*/, "").trim();
      return heading !== title && (!generatedTitle || heading !== generatedTitle);
    })
    .join("\n");
  const articleBody = enforceDeviceAccessDiagram(contentWithoutTitle, buildDeviceAccessDiagram(input.snapshot))
    .replace(/^.*(?:下書き|ドラフト|公開前|顧客確認|技術レビュー|内容を確認してください).*$/gm, "")
    .replace(/\s*<!-- ARTICLE_COMPLETE -->\s*$/, "")
    .replace(/^#\s+/gm, "## ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const codeFenceCount = articleBody.match(/^```/gm)?.length ?? 0;
  if (
    articleBody.length < 900 ||
    /(?:下書き|ドラフト|公開前|顧客確認|技術レビュー)/.test(articleBody) ||
    codeFenceCount % 2 !== 0
  ) {
    throw new Error("AI article body is incomplete");
  }
  const excerpt = plainText(articleBody).slice(0, 240);
  const latencyMs = Date.now() - Date.parse(`${job.created_at.replace(" ", "T")}Z`);

  const postUpdate = await env.DB.prepare(
      `UPDATE posts
       SET title = ?, content = ?, excerpt = ?, visibility = 'limited', meta_title = ?,
           meta_description = ?, reading_time_minutes = ?, tags_json = ?, updated_at = datetime('now')
       WHERE id = ?
         AND EXISTS (SELECT 1 FROM ai_draft_requests WHERE id = ? AND status = 'pending')`
    ).bind(
      title,
      articleBody,
      excerpt,
      title,
      excerpt.slice(0, 120),
      Math.max(1, Math.ceil(articleBody.length / 400)),
      JSON.stringify(["Zero Trust", "導入事例"]),
      job.post_id,
      job.id
    )
    .run();
  if (postUpdate.meta.changes !== 1) throw new Error("processing post was not updated");

  const requestUpdate = await env.DB.prepare(
      "UPDATE ai_draft_requests SET generated_content = ?, latency_ms = ?, status = 'completed' WHERE id = ? AND status = 'pending'"
    )
    .bind(articleBody, Number.isFinite(latencyMs) ? latencyMs : null, job.id)
    .run();
  if (requestUpdate.meta.changes !== 1) throw new Error("generation job was not completed");

  console.log(
    JSON.stringify({
      message: "Case draft generation completed",
      requestId: job.id,
      latencyMs: Number.isFinite(latencyMs) ? latencyMs : null,
      outputChars: articleBody.length,
    })
  );
}

async function failJob(env: Env, job: StoredJob): Promise<void> {
  const statements = [
    env.DB.prepare(
      "UPDATE ai_draft_requests SET post_id = NULL, status = 'failed' WHERE id = ? AND status = 'pending'"
    ).bind(job.id),
  ];
  if (job.post_id) {
    statements.push(
      env.DB.prepare("DELETE FROM posts WHERE id = ? AND title = ?").bind(job.post_id, PROCESSING_TITLE)
    );
  }
  await env.DB.batch(statements);
}

export default {
  async queue(batch: MessageBatch<CaseDraftJob>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      let job: StoredJob | null = null;
      const requestId = message.body && typeof message.body === "object"
        ? (message.body as Partial<CaseDraftJob>).requestId
        : undefined;
      try {
        if (!requestId || !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(requestId)) {
          throw new Error("invalid request ID");
        }
        job = await env.DB.prepare(
          "SELECT id, post_id, input_data_json, status, created_at FROM ai_draft_requests WHERE id = ?"
        )
          .bind(requestId)
          .first<StoredJob>();
        if (!job || job.status !== "pending") {
          message.ack();
          continue;
        }

        await completeJob(env, job);
        message.ack();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
          JSON.stringify({
            message: "Case draft generation failed",
            requestId: requestId ?? "invalid",
            attempt: message.attempts,
            error: errorMessage,
          })
        );
        if (job) {
          try {
            await env.DB.prepare(
              `UPDATE ai_draft_requests
               SET attempt_count = attempt_count + 1,
                   last_error = ?,
                   last_attempt_at = datetime('now')
               WHERE id = ? AND status = 'pending'`
            )
              .bind(errorMessage.slice(0, 1_000), job.id)
              .run();
          } catch (diagnosticError) {
            console.error(
              JSON.stringify({
                message: "Case draft diagnostic update failed",
                requestId: job.id,
                error: diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError),
              })
            );
          }
        }
        if (job && message.attempts >= 3) {
          await failJob(env, job);
          message.ack();
        } else {
          message.retry({ delaySeconds: 10 });
        }
      }
    }
  },
} satisfies ExportedHandler<Env, CaseDraftJob>;
