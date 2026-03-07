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
import { useState, useCallback, useRef } from "react";
import { requireUser } from "~/lib/auth.server";
import { MarkdownGuide } from "~/components/MarkdownGuide";
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

  // Shared style preamble for all templates — enterprise case study tech blog tone
  const stylePreamble = `## 文体・トーンの指示（最重要）
あなたは企業の SE またはインフラ／開発チームのエンジニアとして、**自社（またはクライアント企業）が抱えていたビジネス課題・技術課題に対し、Cloudflare を活用してどのようにアプローチし解決したか**を読者に共有する立場で書いてください。
単なる初心者の体験記ではなく、企業環境における目的意識のある導入事例として記述してください。

### 禁止表現
- 提案書・営業資料トーン: 「〜が可能です」「〜を推奨します」「〜のメリットがあります」「〜をご検討ください」
- 初心者日記トーン: 「〜を触ってみた」「とりあえず〜してみた」

### 品質ガードレール（厳守）
1. **日本語のみで出力する**: 英語の技術用語（Cloudflare, Access, Tunnel, VPN, IdP, Azure AD 等の固有名詞）はそのまま使用して良いが、アラビア語・マレー語・その他の非日本語の単語を絶対に混入させないこと。不明な単語はカタカナ表記にする。
2. **セクション冒頭の遷移表現を多様にする**: 「〜は以下のようになっています」「〜は以下の通りです」を繰り返し使わない。各セクションごとに異なる導入文を工夫する。例:「ここからは〜について詳しく見ていきます」「次に取り組んだのが〜です」「〜の観点で整理すると」など。
3. **セクション間で同じ内容を重複させない**: 一度言及した事実や数値を別のセクションでそのまま繰り返さない。再度触れる場合は「先述の通り」と簡潔に参照し、新しい視点や考察を加える。
4. **「〜を考慮しました」だけで終わらせない**: 何をどのように考慮し、具体的にどういう判断・対策を行ったのかまで踏み込んで書く。

### 文章構成の指示（非常に重要）
ユーザーの入力は箇条書きやメモ形式で提供されますが、**入力をそのままコピーして出力しないでください**。
以下のルールに従って、入力内容を咀嚼し、読み応えのある文章に再構成してください:

1. **行間を読んで文脈を補完する**: 箇条書きの裏にある「なぜそうしたのか」「どういう判断があったのか」を推測し、文章として肉付けする。
   - 例（入力）: 「・VPN 同時接続数が上限に達し接続できない社員が発生」
   - 例（出力）: 「リモートワークの全社導入に伴い VPN の同時接続数が急増し、業務のピーク時間帯にはライセンス上限に達して接続できない社員が続出するようになりました。特に月曜朝の全社ミーティング前後は深刻で、業務開始が 30 分以上遅れるケースも珍しくありませんでした。」

2. **事実は絶対に省略・削除しない**: ユーザーが入力した情報（数値、固有名詞、手順、ポリシー例など）はすべて記事に含める。ただし、羅列ではなく文脈の中に組み込む。

3. **箇条書きと文章を適切に使い分ける**:
   - 設定手順、ポリシー一覧、スペック比較 → 箇条書きや表が適切
   - 導入背景、課題説明、設計判断の理由、成果の解説 → 散文（地の文）で書く
   - 箇条書きの前後には必ず導入文や補足文を添え、箇条書きだけが続く構成を避ける

4. **セクション間のつながりを意識する**: 各セクションの冒頭で前セクションとの関係を一文で示す（例:「要件が固まったところで、次に具体的なソリューションの選定に入りました。」）

5. **各セクションの末尾にまとめ・考察を入れる**: 箇条書きや手順の羅列で終わらず、以下の要素を末尾に散文で補足する:
   - そのセクションの内容から推測される**背景や意図の総括**（例:「こうした段階的な展開を選んだのは、万が一の切り戻しリスクを最小化するためでした。」）
   - 振り返って感じた**改善点や残課題**（例:「振り返ると、PoC 段階でもう少しエッジケースのテストを増やしておくべきでした。」）
   - 今後**取り組むべき課題や展望**（例:「現在はアクセスログの分析を手動で行っていますが、今後は SIEM 連携による自動アラートの導入を計画しています。」）

6. **記事全体の末尾「まとめ」セクションを充実させる**: 単に導入内容を箇条書きで繰り返すのではなく、以下を含む読み応えのあるまとめを書く:
   - 導入全体を通じて得られた**学びや教訓**
   - 入力内容の要素から推測される**組織的・技術的なインパクトの総括**
   - 同様の課題を持つ読者への**実践的なアドバイス**
   - 今後の**改善計画や発展の方向性**

7. **Mermaid 図表を積極的に活用する**: アーキテクチャ構成、ネットワーク図、フローチャート、シーケンス図などを ${"```"}mermaid コードブロックで記事に埋め込む。特に以下の場面で図表を推奨:
   - システム構成やネットワークトポロジの説明→ flowchart または C4Context
   - リクエストフローや API シーケンスの説明 → sequenceDiagram
   - データモデルの説明 → erDiagram
   - プロジェクトタイムライン → gantt
   - ユーザー入力に図表の Mermaid テキストが含まれている場合はそのまま保持すること

### 推奨表現・テックブログ常套句
- 導入背景: 「自社では〜という課題を抱えていました」「〜の要件を満たす必要がありました」
- 選定理由: 「複数の選択肢を検討した結果、〜という理由で Cloudflare の〜を採用しました」
- 実装過程: 「本記事では、〜を導入した際の設計判断と実装手順を紹介します」「設定手順は以下の通りです」
- 技術的判断: 「〜という要件があったため、〜の構成を選択しました」「〜を考慮し、〜の方式を採用しています」
- つまずき: 「導入時に注意が必要だった点として〜」「当初は〜で想定通りに動作しなかったため、〜に変更しました」
- 成果: 「結果として〜が改善しました」「レイテンシが〜ms から〜ms に短縮されました」「運用負荷が大幅に軽減されました」
- 展望: 「今後は〜への展開も検討しています」

### タイトル生成ルール
- 記事の **1行目に必ず「# タイトル」形式の見出しを出力する**。
- ユーザーがタイトルを入力している場合でも、内容に即した正式なテックブログ記事タイトルに整形・改善すること。
- ラフな入力（例:「キャッシュ除外のやつ」）→ 読者に内容が伝わるタイトルに変換（例:「Cache Rules を活用した API パスのキャッシュ除外設定」）。
- タイトルは簡潔かつ具体的に。30〜60文字程度を目安とする。

### 文体ルール
- 文末は「です・ます」調で統一
- 一人称は状況に応じて省略、または「弊社」「自社チーム」「筆者」を使用
- 会社名が提供されている場合は適宜使用する
- 見出しは体言止め（例:「導入背景」「アーキテクチャ設計」「動作検証」）を基本とする

`;

  try {
    // Call Workers AI
    const systemPrompt = stylePreamble + template.aiPromptTemplate;
    const aiResponse: any = await ai.run(
      "@cf/meta/llama-3.1-70b-instruct" as any,
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 8192,
        temperature: 0.4,
      }
    );

    const generatedContent = aiResponse.response || aiResponse.result?.response || "";
    const latencyMs = Date.now() - startTime;

    if (!generatedContent) {
      return { error: "AI からの応答が空でした。もう一度お試しください。" };
    }

    // Extract AI-generated title from first heading, fall back to user input
    const titleMatch = generatedContent.match(/^#\s+(.+)$/m);
    let title = titleMatch ? titleMatch[1].trim() : (customTitle || template.name);

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
      model_used: "@cf/meta/llama-3.1-70b-instruct",
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
        model_used: "@cf/meta/llama-3.1-70b-instruct",
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

const TYPE_MAP: Record<string, { label: string; className: string }> = {
  case_study: { label: "導入事例", className: "bg-blue-100 text-blue-700" },
  solution: { label: "ソリューション", className: "bg-purple-100 text-purple-700" },
  tips: { label: "Tips", className: "bg-amber-100 text-amber-700" },
};

export default function TemplateInput() {
  const { user, template, fields } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const typeInfo = TYPE_MAP[template.templateType] ?? TYPE_MAP.case_study;

  // ─── Controlled state for all fields ───
  const [customTitle, setCustomTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    for (const f of fields) {
      if (f.type === "tag_select") init[f.id] = [];
      else if (f.type === "url_list") init[f.id] = [""];
      else init[f.id] = "";
    }
    return init;
  });

  const updateField = useCallback((fieldId: string, value: any) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  // ─── JSON import ───
  const [jsonText, setJsonText] = useState("");
  const [jsonImportOpen, setJsonImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<{
    type: "ok" | "warn" | "error";
    message: string;
    details?: string[];
  } | null>(null);
  const jsonTextareaNodeRef = useRef<HTMLTextAreaElement | null>(null);
  const jsonTextareaRef = useCallback((node: HTMLTextAreaElement | null) => {
    jsonTextareaNodeRef.current = node;
  }, []);

  const handleJsonImport = useCallback(() => {
    setImportResult(null);
    // Read from state, fallback to DOM value
    const raw = jsonText || jsonTextareaNodeRef.current?.value || "";
    if (!raw.trim()) {
      setImportResult({ type: "error", message: "JSON が空です。テキストエリアに JSON を貼り付けてください。" });
      return;
    }
    try {
      const data = JSON.parse(raw);
      if (typeof data !== "object" || data === null) throw new Error("JSON はオブジェクトである必要があります");

      let importedCount = 0;
      const matched: string[] = [];
      const newValues = { ...fieldValues };
      for (const f of fields) {
        if (data[f.id] !== undefined) {
          newValues[f.id] = data[f.id];
          importedCount++;
          matched.push(f.id);
        }
      }
      setFieldValues(newValues);

      let extras = 0;
      if (data.custom_title) { setCustomTitle(data.custom_title); extras++; }
      if (data.company_name) { setCompanyName(data.company_name); extras++; }

      // Identify unmatched JSON keys
      const fieldIds = new Set(fields.map((f) => f.id));
      const ignoredKeys = Object.keys(data).filter(
        (k) => !fieldIds.has(k) && k !== "custom_title" && k !== "company_name"
      );

      if (importedCount === 0 && extras === 0) {
        const expectedIds = fields.map((f) => f.id).join(", ");
        setImportResult({
          type: "error",
          message: "一致するフィールドがありませんでした。JSON のキーがこのテンプレートのフィールド ID と一致していません。",
          details: [
            `JSON のキー: ${Object.keys(data).join(", ")}`,
            `テンプレートの期待キー: ${expectedIds}`,
            "「フィールド定義をコピー」で正しいキーを AI に渡してください。",
          ],
        });
      } else if (ignoredKeys.length > 0) {
        setImportResult({
          type: "warn",
          message: `${importedCount} フィールド${extras > 0 ? ` + ${extras} 件（タイトル/会社名）` : ""}をインポートしました。`,
          details: [`無視されたキー: ${ignoredKeys.join(", ")}`],
        });
      } else {
        setImportResult({
          type: "ok",
          message: `${importedCount} フィールド${extras > 0 ? ` + ${extras} 件（タイトル/会社名）` : ""}をインポートしました。`,
        });
      }
    } catch (e: any) {
      setImportResult({ type: "error", message: `JSON パースエラー: ${e.message}` });
    }
  }, [jsonText, fieldValues, fields]);

  // ─── Field definition copy ───
  const [defCopied, setDefCopied] = useState(false);
  const fieldDefinitionText = useCallback(() => {
    const lines = fields.map((f) => {
      let def = `- ${f.id}: ${f.label} (type: ${f.type}, required: ${f.required})`;
      if (f.placeholder) def += `\n  ヒント: ${f.placeholder}`;
      if (f.options) def += `\n  選択肢: [${f.options.join(", ")}]`;
      return def;
    });
    // Build a concrete example using the first 2-3 actual field IDs
    const exampleFields = fields.slice(0, 3).map((f) => {
      if (f.type === "tag_select" && f.options) return `  "${f.id}": ["${f.options[0]}", "${f.options[1] || f.options[0]}"]`;
      if (f.type === "url_list") return `  "${f.id}": ["https://example.com"]`;
      return `  "${f.id}": "ここに入力"`;
    });
    return `テンプレート: ${template.name}\nタイプ: ${template.templateType}\n\n以下のフィールド定義に従って、各フィールドの値を JSON で出力してください。\n\n【重要】JSON のキーは必ず以下のフィールド ID をそのまま使ってください。\n独自のキー名に変えないでください（インポート時にマッチしなくなります）。\n\n- tag_select タイプ → 配列（options から選択）\n- url_list タイプ → 文字列の配列\n- その他 → 文字列（textarea は箇条書きや改行入り文章も可）\n\n## フィールド一覧\n${lines.join("\n\n")}\n\n## 出力 JSON の形式（キーは上記の ID をそのまま使うこと）\n{\n${exampleFields.join(",\n")},\n  ...\n  "custom_title": "記事タイトル（任意）",\n  "company_name": "会社名（任意）"\n}`;
  }, [fields, template]);

  const handleCopyFieldDef = useCallback(() => {
    navigator.clipboard.writeText(fieldDefinitionText());
    setDefCopied(true);
    setTimeout(() => setDefCopied(false), 2000);
  }, [fieldDefinitionText]);

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
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${typeInfo.className}`}>
              {typeInfo.label}
            </span>
            <span className="text-[11px] text-gray-400">約{template.estimatedMinutes}分</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
          {template.description && (
            <p className="mt-1 text-sm text-gray-500">{template.description}</p>
          )}
        </div>

        {/* JSON Import & AI Integration Panel */}
        <div className="mb-8 rounded-xl border border-brand-200 bg-brand-50 overflow-hidden">
          <button
            type="button"
            onClick={() => setJsonImportOpen(!jsonImportOpen)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-brand-800">AI ツール連携 / JSON インポート</span>
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-700">NEW</span>
            </div>
            <svg className={`h-4 w-4 text-brand-600 transition-transform ${jsonImportOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>

          {jsonImportOpen && (
            <div className="border-t border-brand-200 px-4 py-4 space-y-4">
              <p className="text-sm text-brand-800">
                Gemini、ChatGPT、Claude などの AI にフィールド定義を渡して JSON を生成し、ここにインポートできます。
              </p>

              {/* Step 1: Copy field definition */}
              <div>
                <p className="mb-2 text-xs font-semibold text-brand-700">ステップ1: フィールド定義を AI に渡す</p>
                <button
                  type="button"
                  onClick={handleCopyFieldDef}
                  className="rounded-lg bg-white border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 transition-colors"
                >
                  {defCopied ? "コピーしました!" : "フィールド定義をコピー"}
                </button>
                <p className="mt-1 text-xs text-brand-600">
                  コピーした内容を AI ツールに貼り付け、書きたい記事のエッセンスと一緒に送信してください。
                </p>
              </div>

              {/* Step 2: Paste JSON */}
              <div>
                <p className="mb-2 text-xs font-semibold text-brand-700">ステップ2: AI が出力した JSON をインポート</p>
                <textarea
                  ref={jsonTextareaRef}
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder='{ "service_name": "Cloudflare Access", "current_issues": "- VPN の同時接続数が..." }'
                  rows={5}
                  className="w-full rounded-lg border border-brand-300 bg-white px-3 py-2 text-xs font-mono focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={handleJsonImport}
                    disabled={!jsonText.trim()}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                  >
                    JSON をインポート
                  </button>
                </div>
                {importResult && (
                  <div className={`mt-3 rounded-lg border px-4 py-3 text-sm ${
                    importResult.type === "ok"
                      ? "border-green-200 bg-green-50 text-green-800"
                      : importResult.type === "warn"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-red-200 bg-red-50 text-red-800"
                  }`}>
                    <p className="font-medium">{importResult.message}</p>
                    {importResult.details && (
                      <ul className="mt-1 space-y-0.5 text-xs">
                        {importResult.details.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
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
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
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
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="例: 株式会社〇〇"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              記事に会社名を含める場合に入力してください。
            </p>
          </div>

          {fields.map((field) => (
            <FieldRenderer
              key={field.id}
              field={field}
              value={fieldValues[field.id]}
              onChange={(val) => updateField(field.id, val)}
            />
          ))}

          <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <p>入力後「AI で下書き生成」をクリックすると、Workers AI がブログ記事の下書きを自動作成します。
            生成後はエディタで自由に編集できます。</p>
            <p className="mt-1">入力テキストに Markdown 記法や Mermaid 図表を含めると、AI がそのまま下書きに組み込みます。</p>
          </div>

          <MarkdownGuide />

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

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: ReturnType<typeof parseInputFields>[number];
  value: any;
  onChange: (val: any) => void;
}) {
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
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          placeholder={field.placeholder}
          className={baseInputClass}
        />
      )}

      {field.type === "textarea" && (
        <textarea
          id={name}
          name={name}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
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
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
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
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
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
        <TagSelect name={name} options={field.options} required={field.required} selected={value ?? []} onSelectedChange={onChange} />
      )}

      {field.type === "url_list" && (
        <UrlListInput name={name} urls={value ?? [""]} onUrlsChange={onChange} />
      )}
    </div>
  );
}

function TagSelect({
  name,
  options,
  required,
  selected,
  onSelectedChange,
}: {
  name: string;
  options: string[];
  required: boolean;
  selected: string[];
  onSelectedChange: (val: string[]) => void;
}) {
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
                    onSelectedChange([...selected, opt]);
                  } else {
                    onSelectedChange(selected.filter((s) => s !== opt));
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

function UrlListInput({
  name,
  urls,
  onUrlsChange,
}: {
  name: string;
  urls: string[];
  onUrlsChange: (val: string[]) => void;
}) {
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
              onUrlsChange(newUrls);
            }}
            placeholder="https://..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {urls.length > 1 && (
            <button
              type="button"
              onClick={() => onUrlsChange(urls.filter((_, j) => j !== i))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50"
            >
              削除
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onUrlsChange([...urls, ""])}
        className="text-xs font-medium text-brand-600 hover:text-brand-700"
      >
        + URL を追加
      </button>
    </div>
  );
}
