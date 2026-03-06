import { eq, and } from "drizzle-orm";
import { getDb } from "~/lib/db.server";
import { templates, categories } from "~/db/schema";

export interface TemplateField {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "tag_select" | "code" | "url_list" | "image_upload" | "checkbox";
  required: boolean;
  placeholder?: string;
  options?: string[];
  multiple?: boolean;
}

export interface TemplateWithCategory {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  difficulty: string;
  templateType: string;
  estimatedMinutes: number;
  inputFieldsJson: string;
  aiPromptTemplate: string;
  sortOrder: number;
}

export async function getActiveTemplates(db: D1Database): Promise<TemplateWithCategory[]> {
  const d = getDb(db);
  const results = await d
    .select({
      id: templates.id,
      name: templates.name,
      description: templates.description,
      categoryId: templates.category_id,
      categoryName: categories.name,
      difficulty: templates.difficulty,
      templateType: templates.template_type,
      estimatedMinutes: templates.estimated_minutes,
      inputFieldsJson: templates.input_fields_json,
      aiPromptTemplate: templates.ai_prompt_template,
      sortOrder: templates.sort_order,
    })
    .from(templates)
    .leftJoin(categories, eq(templates.category_id, categories.id))
    .where(eq(templates.is_active, true))
    .orderBy(templates.sort_order);

  return results;
}

export async function getTemplateById(db: D1Database, id: string): Promise<TemplateWithCategory | null> {
  const d = getDb(db);
  const result = await d
    .select({
      id: templates.id,
      name: templates.name,
      description: templates.description,
      categoryId: templates.category_id,
      categoryName: categories.name,
      difficulty: templates.difficulty,
      templateType: templates.template_type,
      estimatedMinutes: templates.estimated_minutes,
      inputFieldsJson: templates.input_fields_json,
      aiPromptTemplate: templates.ai_prompt_template,
      sortOrder: templates.sort_order,
    })
    .from(templates)
    .leftJoin(categories, eq(templates.category_id, categories.id))
    .where(eq(templates.id, id))
    .get();

  return result ?? null;
}

export function parseInputFields(json: string): TemplateField[] {
  try {
    const parsed = JSON.parse(json);
    return parsed.fields || [];
  } catch {
    return [];
  }
}

export function buildUserPrompt(
  inputs: Record<string, any>,
  fields: TemplateField[],
  companyName?: string
): string {
  let prompt = "## ユーザー入力情報\n\n";

  if (companyName) {
    prompt += `### 会社名\n${companyName}\n\n`;
  }

  for (const field of fields) {
    const value = inputs[field.id];
    if (!value) continue;

    if (Array.isArray(value)) {
      prompt += `### ${field.label}\n${value.join(", ")}\n\n`;
    } else {
      prompt += `### ${field.label}\n${value}\n\n`;
    }
  }

  return prompt;
}
