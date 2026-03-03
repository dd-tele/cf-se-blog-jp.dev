import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import {
  Form,
  useLoaderData,
  useActionData,
  useNavigation,
  Link,
} from "@remix-run/react";
import { redirect } from "@remix-run/cloudflare";
import { useState } from "react";
import { requireUser } from "~/lib/auth.server";
import {
  getTemplateById,
  parseInputFields,
  buildUserPrompt,
} from "~/lib/templates.server";
import { ensureUser, createPost } from "~/lib/posts.server";
import { ulid } from "~/lib/ulid";
import { getDb } from "~/lib/db.server";
import { aiDraftRequests } from "~/db/schema";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: `${data?.template?.name ?? "テンプレート"} — Cloudflare Solution Blog` },
];

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const db = context.cloudflare.env.DB;
  const template = await getTemplateById(db, params.id!);
  if (!template) throw new Response("Not Found", { status: 404 });

  const fields = parseInputFields(template.inputFieldsJson);
  return { user, template, fields };
}

export async function action({ params, request, context }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const db = context.cloudflare.env.DB;
  const ai = context.cloudflare.env.AI;

  await ensureUser(db, user);

  const template = await getTemplateById(db, params.id!);
  if (!template) throw new Response("Not Found", { status: 404 });

  const fields = parseInputFields(template.inputFieldsJson);
  const formData = await request.formData();

  // Collect inputs
  const inputs: Record<string, any> = {};
  for (const field of fields) {
    if (field.type === "tag_select") {
      const values = formData.getAll(`field_${field.id}`) as string[];
      if (values.length > 0) inputs[field.id] = values;
    } else {
      const val = formData.get(`field_${field.id}`) as string;
      if (val) inputs[field.id] = val;
    }
  }

  // Validate required fields
  for (const field of fields) {
    if (field.required && !inputs[field.id]) {
      return { error: `「${field.label}」は必須です` };
    }
  }

  // Get user-provided title and company name
  const customTitle = (formData.get("custom_title") as string) || "";
  const companyName = (formData.get("company_name") as string) || "";

  // Add company name to inputs if provided
  if (companyName) {
    inputs["__company_name"] = companyName;
  }

  const userPrompt = buildUserPrompt(inputs, fields, companyName);
  const startTime = Date.now();

  try {
    // Call Workers AI
    const aiResponse: any = await ai.run(
      "@cf/meta/llama-3.1-8b-instruct" as any,
      {
        messages: [
          { role: "system", content: template.aiPromptTemplate },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 4096,
        temperature: 0.7,
      }
    );

    const generatedContent = aiResponse.response || aiResponse.result?.response || "";
    const latencyMs = Date.now() - startTime;

    if (!generatedContent) {
      return { error: "AI からの応答が空でした。もう一度お試しください。" };
    }

    // Use custom title if provided, otherwise extract from generated markdown
    let title = customTitle;
    if (!title) {
      const titleMatch = generatedContent.match(/^#\s+(.+)$/m);
      title = titleMatch ? titleMatch[1].trim() : template.name;
    }

    // Create draft post
    const result = await createPost(
      db,
      {
        title,
        content: generatedContent,
        categoryId: template.categoryId ?? undefined,
      },
      user
    );

    // Record AI draft request
    const d = getDb(db);
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    await d.insert(aiDraftRequests).values({
      id: ulid(),
      user_id: user.id,
      template_id: template.id,
      post_id: result.id,
      input_data_json: JSON.stringify(inputs),
      generated_content: generatedContent,
      model_used: "@cf/meta/llama-3.1-8b-instruct",
      latency_ms: latencyMs,
      status: "completed",
      created_at: now,
    });

    // Redirect to edit page so user can refine
    return redirect(`/portal/edit/${result.id}`);
  } catch (e: any) {
    const latencyMs = Date.now() - startTime;
    console.error("AI draft generation error:", e);

    // Record failed request
    try {
      const d = getDb(db);
      const now = new Date().toISOString().replace("T", " ").slice(0, 19);
      await d.insert(aiDraftRequests).values({
        id: ulid(),
        user_id: user.id,
        template_id: template.id,
        input_data_json: JSON.stringify(inputs),
        model_used: "@cf/meta/llama-3.1-8b-instruct",
        latency_ms: latencyMs,
        status: "failed",
        created_at: now,
      });
    } catch {}

    return {
      error: `AI 生成に失敗しました: ${e.message || "Unknown error"}。もう一度お試しください。`,
    };
  }
}

const DIFFICULTY_MAP: Record<string, { label: string; className: string }> = {
  beginner: { label: "初級", className: "bg-green-100 text-green-700" },
  intermediate: { label: "中級", className: "bg-yellow-100 text-yellow-700" },
  advanced: { label: "上級", className: "bg-red-100 text-red-700" },
};

export default function TemplateInput() {
  const { user, template, fields } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const diff = DIFFICULTY_MAP[template.difficulty] ?? DIFFICULTY_MAP.beginner;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors">
              Cloudflare Solution Blog
            </Link>
            <span className="text-sm text-gray-400">|</span>
            <Link to="/portal/templates" className="text-sm text-gray-500 hover:text-gray-700">
              テンプレート
            </Link>
          </div>
          <span className="text-sm text-gray-500">{user.displayName}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Template Info */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2">
            {template.categoryName && (
              <span className="text-xs font-medium text-gray-400">{template.categoryName}</span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${diff.className}`}>
              {diff.label}
            </span>
            <span className="text-[11px] text-gray-400">約{template.estimatedMinutes}分</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
          {template.description && (
            <p className="mt-1 text-sm text-gray-500">{template.description}</p>
          )}
        </div>

        {actionData && "error" in actionData && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionData.error}
          </div>
        )}

        {/* Loading overlay */}
        {isSubmitting && (
          <div className="mb-6 rounded-lg bg-brand-50 px-4 py-4 text-center">
            <div className="mb-2 text-sm font-medium text-brand-700">
              AI が下書きを生成しています...
            </div>
            <div className="text-xs text-brand-500">
              通常 10〜30 秒ほどかかります。ページを離れないでください。
            </div>
          </div>
        )}

        <Form method="post" className="space-y-6">
          {/* Custom title */}
          <div>
            <label
              htmlFor="custom_title"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              記事タイトル
            </label>
            <input
              type="text"
              id="custom_title"
              name="custom_title"
              placeholder="タイトルを入力（空欄の場合 AI が自動生成）"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              記事の趣旨が分かるタイトルを入力してください。空欄の場合は AI が自動生成します。
            </p>
          </div>

          {/* Company name */}
          <div>
            <label
              htmlFor="company_name"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              会社名（任意）
            </label>
            <input
              type="text"
              id="company_name"
              name="company_name"
              placeholder="例: 株式会社〇〇"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              記事に会社名を含める場合に入力してください。
            </p>
          </div>

          {fields.map((field) => (
            <FieldRenderer key={field.id} field={field} />
          ))}

          <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
            入力後「AI で下書き生成」をクリックすると、Workers AI がブログ記事の下書きを自動作成します。
            生成後はエディタで自由に編集できます。
          </div>

          <div className="flex items-center justify-between border-t pt-6">
            <Link to="/portal/templates" className="text-sm text-gray-500 hover:text-gray-700">
              テンプレート一覧に戻る
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-gray-900 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {isSubmitting ? "AI 生成中..." : "AI で下書き生成"}
            </button>
          </div>
        </Form>
      </main>
    </div>
  );
}

// ─── Dynamic Field Renderer ────────────────────────────────

function FieldRenderer({ field }: { field: ReturnType<typeof parseInputFields>[number] }) {
  const name = `field_${field.id}`;
  const baseInputClass =
    "w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700">
        {field.label}
        {field.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      {field.type === "text" && (
        <input
          type="text"
          id={name}
          name={name}
          required={field.required}
          placeholder={field.placeholder}
          className={baseInputClass}
        />
      )}

      {field.type === "textarea" && (
        <textarea
          id={name}
          name={name}
          required={field.required}
          placeholder={field.placeholder}
          rows={4}
          className={baseInputClass}
        />
      )}

      {field.type === "code" && (
        <textarea
          id={name}
          name={name}
          required={field.required}
          placeholder={field.placeholder}
          rows={6}
          className={`${baseInputClass} font-mono text-xs`}
        />
      )}

      {field.type === "select" && field.options && (
        <select
          id={name}
          name={name}
          required={field.required}
          className={baseInputClass}
        >
          <option value="">選択してください</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {field.type === "tag_select" && field.options && (
        <TagSelect name={name} options={field.options} required={field.required} />
      )}

      {field.type === "url_list" && (
        <UrlListInput name={name} />
      )}
    </div>
  );
}

function TagSelect({
  name,
  options,
  required,
}: {
  name: string;
  options: string[];
  required: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isActive = selected.includes(opt);
          return (
            <label
              key={opt}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              <input
                type="checkbox"
                name={name}
                value={opt}
                checked={isActive}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelected([...selected, opt]);
                  } else {
                    setSelected(selected.filter((s) => s !== opt));
                  }
                }}
                className="sr-only"
              />
              {opt}
            </label>
          );
        })}
      </div>
      {required && selected.length === 0 && (
        <input type="hidden" name={`${name}_required`} required />
      )}
    </div>
  );
}

function UrlListInput({ name }: { name: string }) {
  const [urls, setUrls] = useState<string[]>([""]);

  return (
    <div className="space-y-2">
      {urls.map((url, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="url"
            name={name}
            value={url}
            onChange={(e) => {
              const newUrls = [...urls];
              newUrls[i] = e.target.value;
              setUrls(newUrls);
            }}
            placeholder="https://..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {urls.length > 1 && (
            <button
              type="button"
              onClick={() => setUrls(urls.filter((_, j) => j !== i))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50"
            >
              削除
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => setUrls([...urls, ""])}
        className="text-xs font-medium text-brand-600 hover:text-brand-700"
      >
        + URL を追加
      </button>
    </div>
  );
}
