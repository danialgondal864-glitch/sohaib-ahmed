export type ProjectContent = {
  title: string;
  slug: string;
  summary: string;
  description: string;
  stack: string[];
  featured: boolean;
  published: boolean;
  sort_order: number;
};

export type ProjectRecord = ProjectContent & {
  id: string;
  created_at: string;
  updated_at: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isProjectContent(value: unknown): value is ProjectContent {
  return isRecord(value) &&
    typeof value.title === "string" &&
    typeof value.slug === "string" &&
    typeof value.summary === "string" &&
    typeof value.description === "string" &&
    Array.isArray(value.stack) &&
    value.stack.every((item) => typeof item === "string") &&
    typeof value.featured === "boolean" &&
    typeof value.published === "boolean" &&
    Number.isInteger(value.sort_order);
}

export function isProjectRecord(value: unknown): value is ProjectRecord {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string" &&
    isProjectContent(value);
}
