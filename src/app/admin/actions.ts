"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { RESEARCH_CATEGORIES } from "@/lib/posts";

type PostInput = {
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  content: string;
  verified_facts: string[];
  research_findings: string[];
  opinions: string[];
  proposed_solutions: string[];
  sources: Array<{ title: string; url: string; published_at?: string }>;
  read_time: number;
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

  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : null;
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

function getSources(formData: FormData): PostInput["sources"] | null {
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

  const sources: PostInput["sources"] = [];
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
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password
    ) {
      return null;
    }

    const source: PostInput["sources"][number] = { title, url: url.toString() };
    if (item.published_at !== undefined) {
      if (
        typeof item.published_at !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(item.published_at)
      ) {
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

function parsePost(formData: FormData): PostInput | null {
  const title = getText(formData, "title", 200);
  const slug = getText(formData, "slug", 200);
  const category = getText(formData, "category", 80);
  const excerpt = getText(formData, "excerpt", 500);
  const content = getText(formData, "content", 50_000);
  const verifiedFacts = getTextList(formData, "verified_facts");
  const findings = getTextList(formData, "research_findings");
  const opinions = getTextList(formData, "opinions");
  const proposals = getTextList(formData, "proposed_solutions");
  const sources = getSources(formData);
  const readTimeValue = getText(formData, "read_time", 3);
  const readTime = readTimeValue ? Number(readTimeValue) : NaN;
  const isCategory = RESEARCH_CATEGORIES.some((item) => item === category);
  const published = formData.get("published") === "on";

  if (
    !title ||
    !slug ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    !category ||
    !isCategory ||
    !excerpt ||
    !content ||
    !verifiedFacts ||
    !findings ||
    !opinions ||
    !proposals ||
    !sources ||
    !Number.isInteger(readTime) ||
    readTime < 1 ||
    readTime > 120
  ) {
    return null;
  }

  if (published && (verifiedFacts.length > 0 || findings.length > 0) && sources.length === 0) {
    return null;
  }

  return {
    title,
    slug,
    category,
    excerpt,
    content,
    verified_facts: verifiedFacts,
    research_findings: findings,
    opinions,
    proposed_solutions: proposals,
    sources,
    read_time: readTime,
    published
  };
}

function invalidForm(): never {
  redirect("/admin?status=invalid");
}

function saveFailed(): never {
  redirect("/admin?status=save-failed");
}

export async function createPost(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const post = parsePost(formData);
  if (!post) {
    invalidForm();
  }

  const { data, error } = await supabase.from("posts").insert({
    ...post,
    author_id: user.id
  }).select("id").single();
  if (error || !data) {
    console.error("Unable to create research article.", error?.code ?? "no_row_returned");
    saveFailed();
  }

  revalidatePath("/admin");
  revalidatePath("/blogs");
  redirect("/admin?status=created");
}

export async function updatePost(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = getText(formData, "id", 36);
  const post = parsePost(formData);
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !post) {
    invalidForm();
  }

  const { data: existingPost, error: existingPostError } = await supabase
    .from("posts")
    .select("slug")
    .eq("id", id)
    .single();
  if (existingPostError || !existingPost) {
    console.error("Unable to load research article for update.", existingPostError?.code ?? "not_found");
    saveFailed();
  }

  const { data, error } = await supabase
    .from("posts")
    .update(post)
    .eq("id", id)
    .select("id")
    .single();
  if (error || !data) {
    console.error("Unable to update research article.", error?.code ?? "no_row_returned");
    saveFailed();
  }

  revalidatePath("/admin");
  revalidatePath("/blogs");
  revalidatePath(`/blogs/${existingPost.slug}`);
  revalidatePath(`/blogs/${post.slug}`);
  redirect("/admin?status=updated");
}

export async function deletePost(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = getText(formData, "id", 36);
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    invalidForm();
  }

  const { data, error } = await supabase
    .from("posts")
    .delete()
    .eq("id", id)
    .select("slug")
    .single();
  if (error || !data) {
    console.error("Unable to delete research article.", error?.code ?? "no_row_returned");
    saveFailed();
  }

  revalidatePath("/admin");
  revalidatePath("/blogs");
  revalidatePath(`/blogs/${data.slug}`);
  redirect("/admin?status=deleted");
}
