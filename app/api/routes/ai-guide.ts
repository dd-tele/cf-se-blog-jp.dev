import { Hono } from "hono";
import type { HonoEnv } from "../types";
import { requireAuth } from "../middleware";
import { getActiveTemplates, parseInputFields } from "~/lib/templates.server";

const aiGuide = new Hono<HonoEnv>();

// ─── GET /api/v1/ai-guide — Complete guide for AI tools ─────
// Returns all template schemas + instructions in one response
// so that an AI tool (Gemini, ChatGPT, etc.) can understand the
// entire system with a single API call.
aiGuide.get("/", requireAuth, async (c) => {
  const user = c.var.user!;
  const siteUrl = c.env.SITE_URL || "https://blog.jp.dev";
  const canTestGenerate = user.role === "admin" || user.role === "se";
  const list = await getActiveTemplates(c.env.DB);

  const templatesData = list.map((t) => {
    const fields = parseInputFields(t.inputFieldsJson);
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      categoryName: t.categoryName,
      templateType: t.templateType,
      fields: fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        required: f.required,
        placeholder: f.placeholder || null,
        options: f.options || null,
      })),
    };
  });

  return c.json({
    guide: {
      system: "Cloudflare Solution Blog — Template API",
      description:
        "このブログは Cloudflare SE が技術ブログ記事を投稿するプラットフォームです。テンプレートごとにフィールド定義があり、各フィールドに入力データを埋めると AI が記事を自動生成します。",
      your_user: {
        displayName: user.displayName,
        email: user.email,
        role: user.role,
      },
      workflow: canTestGenerate
        ? [
            "1. 下の templates 一覧から書きたい記事に合うテンプレートを選ぶ",
            "2. そのテンプレートの fields を確認する",
            "3. 各 field に対して、実際のエンジニアが書くリアルな入力データを JSON で生成する",
            `4. POST ${siteUrl}/api/v1/templates/{テンプレートID}/test-generate に overrides として送信すると、AI が記事を自動生成して下書き保存する`,
            `5. レスポンスの editUrl（${siteUrl}/portal/edit/{postId}）で記事を編集・公開する`,
          ]
        : [
            "1. 下の templates 一覧から書きたい記事に合うテンプレートを選ぶ",
            "2. そのテンプレートの fields を確認する",
            "3. 各 field に対して、実際のエンジニアが書くリアルな入力データを生成する",
            `4. ブラウザで ${siteUrl}/portal/templates/{テンプレートID} を開き、各フィールドに生成したデータを貼り付けて送信する`,
            "5. AI が下書き記事を自動生成するので、編集して公開する",
          ],
      field_types_guide: {
        text: "1行のテキスト入力",
        textarea: "複数行のテキスト。箇条書きやメモ形式で入力する。実際のエンジニアが書くようなリアルな内容で。",
        select: "options の中から1つ選択（文字列で回答）",
        tag_select: "options の中から2〜4個を選択（配列で回答）",
        url_list: "関連する URL を1〜2個（配列で回答）",
        code: "コードスニペットやコマンド例",
        checkbox: "true/false",
      },
      output_format:
        "各テンプレートについて、fields の id をキーとした JSON オブジェクトで出力してください。textarea フィールドはリアルな箇条書きやメモ書きで、具体的な数値・製品名・設定値を含めてください。",
      important_notes: [
        "required: true のフィールドは必ず入力すること",
        "placeholder の内容を参考に、具体的で現実的な内容を書くこと",
        "テンプレートの templateType が case_study なら導入事例風、solution ならソリューション紹介風、tips なら Tips 風に書くこと",
        "自分の経験がある場合はそれを反映してよい",
      ],
      ...(canTestGenerate
        ? {
            quick_generate_api: {
              description:
                "最も簡単な方法。topic キーワードを渡すだけでテンプレート自動選択→入力データ自動生成→記事作成まで一括実行します。テンプレート ID を知る必要はありません。",
              endpoint: `POST ${siteUrl}/api/v1/templates/quick-generate`,
              auth: "Authorization: Bearer YOUR_API_KEY",
              request_body: {
                topic: "記事のトピック（例: 'Zero Trust', 'WAF', 'Workers', 'SASE'）— 必須",
                tone: "realistic | casual | detailed | minimal（デフォルト: realistic）",
                company_name: "会社名（任意）",
              },
              curl_example: `curl -s -X POST '${siteUrl}/api/v1/templates/quick-generate' -H 'Authorization: Bearer YOUR_API_KEY' -H 'Content-Type: application/json' -d '{"topic": "Zero Trust", "tone": "realistic"}'`,
              response_example: {
                success: true,
                postId: "記事ID",
                title: "自動生成されたタイトル",
                editUrl: "/portal/edit/{postId}",
              },
            },
            test_generate_api: {
              description:
                "テンプレート ID を指定して記事を生成する上級者向け API。overrides で入力データを細かく制御できます。",
              endpoint: `POST ${siteUrl}/api/v1/templates/{テンプレートID}/test-generate`,
              auth: "Authorization: Bearer YOUR_API_KEY",
              request_body: {
                tone: "realistic | casual | detailed | minimal（デフォルト: realistic）",
                company_name: "会社名（任意）",
                overrides: "{ フィールドID: 値, ... }  — fields の id をキーにした JSON。指定しなかったフィールドは AI が自動生成",
              },
            },
          }
        : {}),
    },
    templates: templatesData,
  });
});

export default aiGuide;
