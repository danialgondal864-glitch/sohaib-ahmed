export type ResearchCategory = {
  id: string;
  name: string;
  slug: string;
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
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string";
}

export function parseResearchCategories(value: unknown): ResearchCategory[] {
  if (!Array.isArray(value) || !value.every(isResearchCategory)) {
    throw new Error("The research categories table returned invalid data.");
  }
  return value;
}
