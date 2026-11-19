export type ProjectContent = {
  title: string;
  slug: string;
  project_url: string | null;
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
    (value.project_url === null ||
      typeof value.project_url === "string" && isWebUrl(value.project_url)) &&
    typeof value.summary === "string" &&
    typeof value.description === "string" &&
    Array.isArray(value.stack) &&
    value.stack.every((item) => typeof item === "string") &&
    typeof value.featured === "boolean" &&
    typeof value.published === "boolean" &&
    Number.isInteger(value.sort_order);
}

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password;
  } catch {
    return false;
  }
}

export function isProjectRecord(value: unknown): value is ProjectRecord {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string" &&
    isProjectContent(value);
}
