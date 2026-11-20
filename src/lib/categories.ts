import type { ContentType } from "@/lib/editorial";

export type CategoryContentType = ContentType | "all";

export type ResearchCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  content_type: CategoryContentType;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isResearchCategory(value: unknown): value is ResearchCategory {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    value.name.length <= 80 &&
    typeof value.slug === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug) &&
    typeof value.description === "string" &&
    value.description.length <= 500 &&
    (value.content_type === "all" ||
      value.content_type === "article" ||
      value.content_type === "video" ||
      value.content_type === "podcast") &&
    (value.parent_id === null || typeof value.parent_id === "string") &&
    typeof value.sort_order === "number" &&
    Number.isInteger(value.sort_order) &&
    value.sort_order >= 0 &&
    typeof value.is_active === "boolean" &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string";
}

export function parseResearchCategories(value: unknown): ResearchCategory[] {
  if (!Array.isArray(value) || !value.every(isResearchCategory)) {
    throw new Error("The research categories table returned invalid data.");
  }
  return value;
}
