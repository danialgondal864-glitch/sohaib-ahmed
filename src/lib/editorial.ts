export const CONTENT_TYPES = ["article", "video", "podcast"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export type EditorialInput = {
  title: string;
  slug: string;
  category: string;
  subcategory_id: string | null;
  content_type: ContentType;
  excerpt: string;
  content: string;
  verified_facts: string[];
  research_findings: string[];
  opinions: string[];
  proposed_solutions: string[];
  sources: Array<{ title: string; url: string; published_at?: string }>;
  read_time: number;
  video_url: string | null;
  audio_url: string | null;
  cover_image_url: string | null;
  cover_image_path: string | null;
  duration_seconds: number | null;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  published: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getText(formData: FormData, key: string, maxLength: number): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim();
  return text.length <= maxLength ? text : null;
}

function getOptionalText(
  formData: FormData,
  key: string,
  maxLength: number
): { valid: boolean; value: string | null } {
  const value = formData.get(key);
  if (value === null) {
    return { valid: true, value: null };
  }
  if (typeof value !== "string") {
    return { valid: false, value: null };
  }
  const text = value.trim();
  return text.length <= maxLength
    ? { valid: true, value: text || null }
    : { valid: false, value: null };
}

function getTextList(formData: FormData, key: string): string[] | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }

  const items = value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  if (items.length > 50 || items.some((item) => item.length > 1500)) {
    return null;
  }
  return items;
}

function getSources(formData: FormData): EditorialInput["sources"] | null {
  const value = formData.get("sources");
  if (typeof value !== "string" || value.length > 20_000) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length > 50) {
    return null;
  }

  const sources: EditorialInput["sources"] = [];
  for (const item of parsed) {
    if (!isRecord(item) || typeof item.title !== "string" || typeof item.url !== "string") {
      return null;
    }

    const title = item.title.trim();
    if (!title || title.length > 250 || item.url.length > 2048) {
      return null;
    }
    let url: URL;
    try {
      url = new URL(item.url);
    } catch {
      return null;
    }
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
      return null;
    }

    const source: EditorialInput["sources"][number] = { title, url: url.toString() };
    if (item.published_at !== undefined) {
      if (typeof item.published_at !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.published_at)) {
        return null;
      }
      const date = new Date(`${item.published_at}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== item.published_at) {
        return null;
      }
      source.published_at = item.published_at;
    }
    sources.push(source);
  }
  return sources;
}

function getWebUrl(
  formData: FormData,
  key: string,
  maxLength: number,
  acceptedHosts?: ReadonlySet<string>
): string | null | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return undefined;
  }
  const text = value.trim();
  if (!text) {
    return null;
  }
  if (text.length > maxLength) {
    return undefined;
  }

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return undefined;
  }
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password ||
    (acceptedHosts && !acceptedHosts.has(url.hostname.toLowerCase()))
  ) {
    return undefined;
  }
  return url.toString();
}

function getTags(formData: FormData): string[] | null {
  const value = formData.get("tags");
  if (typeof value !== "string") {
    return null;
  }
  const tags = Array.from(new Set(value.split(/[,\r\n]/).map((tag) => tag.trim()).filter(Boolean)));
  if (tags.length > 30 || tags.some((tag) => tag.length > 40)) {
    return null;
  }
  return tags;
}

export function parseEditorialForm(
  formData: FormData,
  categoryNames: ReadonlySet<string>,
  isAdmin: boolean
): EditorialInput | null {
  const title = getText(formData, "title", 200);
  const slug = getText(formData, "slug", 200);
  const category = getText(formData, "category", 80);
  const subcategory = getOptionalText(formData, "subcategory_id", 36);
  const subcategoryId = subcategory.value;
  const contentTypeValue = getText(formData, "content_type", 16);
  const contentType = CONTENT_TYPES.includes(contentTypeValue as ContentType)
    ? contentTypeValue as ContentType
    : null;
  const excerpt = getText(formData, "excerpt", 500);
  const content = getText(formData, "content", 50_000);
  const verifiedFacts = getTextList(formData, "verified_facts");
  const findings = getTextList(formData, "research_findings");
  const opinions = getTextList(formData, "opinions");
  const proposals = getTextList(formData, "proposed_solutions");
  const sources = getSources(formData);
  const tags = getTags(formData);
  const readTimeValue = getText(formData, "read_time", 3);
  const readTime = readTimeValue ? Number(readTimeValue) : NaN;
  const videoUrl = getWebUrl(formData, "video_url", 2048, new Set([
    "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
    "vimeo.com", "www.vimeo.com", "player.vimeo.com"
  ]));
  const audioUrl = getWebUrl(formData, "audio_url", 2048);
  const coverImagePath = getOptionalText(formData, "cover_image_path", 128);
  const coverImageUrl = getWebUrl(formData, "cover_image_url", 2048);
  const selectedCoverImagePath = coverImageUrl ? null : coverImagePath.value;
  const coverImageUploadInProgress = formData.get("cover_image_uploading") === "true";
  const durationValue = getOptionalText(formData, "duration_seconds", 5);
  const duration = durationValue.value ? Number(durationValue.value) : null;
  const seoTitle = getOptionalText(formData, "seo_title", 120);
  const seoDescription = getOptionalText(formData, "seo_description", 320);
  const published = isAdmin && formData.get("published") === "on";
  const submitting = formData.get("intent") === "submit";

  if (
    !title ||
    !slug ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    !category ||
    !categoryNames.has(category) ||
    !subcategory.valid ||
    (subcategoryId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subcategoryId)) ||
    !contentType ||
    !excerpt ||
    !content ||
    !verifiedFacts ||
    !findings ||
    !opinions ||
    !proposals ||
    !sources ||
    !tags ||
    videoUrl === undefined ||
    audioUrl === undefined ||
    !coverImagePath.valid ||
    coverImageUploadInProgress ||
    (coverImagePath.value !== null &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(avif|gif|jpg|png|webp)$/i.test(coverImagePath.value)) ||
    coverImageUrl === undefined ||
    !durationValue.valid ||
    !seoTitle.valid ||
    !seoDescription.valid ||
    !Number.isInteger(readTime) ||
    readTime < 1 ||
    readTime > 120 ||
    (duration !== null && (!Number.isInteger(duration) || duration < 1 || duration > 86400))
  ) {
    return null;
  }

  if (
    (submitting || published) &&
    ((contentType === "video" && !videoUrl) || (contentType === "podcast" && !audioUrl))
  ) {
    return null;
  }
  if ((submitting || published) && contentType === "article" &&
    (verifiedFacts.length > 0 || findings.length > 0) && sources.length === 0) {
    return null;
  }

  return {
    title,
    slug,
    category,
    subcategory_id: subcategoryId,
    content_type: contentType,
    excerpt,
    content,
    verified_facts: verifiedFacts,
    research_findings: findings,
    opinions,
    proposed_solutions: proposals,
    sources,
    read_time: readTime,
    video_url: videoUrl,
    audio_url: audioUrl,
    cover_image_url: coverImageUrl,
    cover_image_path: selectedCoverImagePath,
    duration_seconds: duration,
    tags,
    seo_title: seoTitle.value,
    seo_description: seoDescription.value,
    published
  };
}
