"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import type { ProjectContent } from "@/lib/projects";

function getText(formData: FormData, key: string, maxLength: number): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

function getOptionalWebUrl(formData: FormData, key: string): string | null | undefined {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim().length > 2048) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function parseProject(formData: FormData): ProjectContent | null {
  const title = getText(formData, "title", 160);
  const slug = getText(formData, "slug", 160);
  const summary = getText(formData, "summary", 400);
  const description = getText(formData, "description", 8000);
  const projectUrl = getOptionalWebUrl(formData, "project_url");
  const stackValue = formData.get("stack");
  const sortOrderValue = getText(formData, "sort_order", 5);
  const sortOrder = sortOrderValue ? Number(sortOrderValue) : NaN;
  const stack = typeof stackValue === "string"
    ? stackValue.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
    : null;

  if (
    !title ||
    !slug ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    !summary ||
    !description ||
    projectUrl === undefined ||
    !stack ||
    stack.length > 20 ||
    stack.some((item) => item.length > 80) ||
    !Number.isInteger(sortOrder) ||
    sortOrder < 0 ||
    sortOrder > 10000
  ) {
    return null;
  }

  return {
    title,
    slug,
    project_url: projectUrl,
    summary,
    description,
    stack,
    featured: formData.get("featured") === "on",
    published: formData.get("published") === "on",
    sort_order: sortOrder
  };
}

function invalidForm(): never {
  redirect("/admin?status=project-invalid");
}

function saveFailed(): never {
  redirect("/admin?status=project-save-failed");
}

function revalidateProjects() {
  revalidatePath("/admin");
  revalidatePath("/projects");
  revalidatePath("/");
}

export async function createProject(formData: FormData) {
  const { supabase } = await requireAdmin();
  const project = parseProject(formData);
  if (!project) {
    invalidForm();
  }

  const { data, error } = await supabase
    .from("projects")
    .insert(project)
    .select("id")
    .single();
  if (error || !data) {
    console.error("Unable to create portfolio project.", error?.code ?? "no_row_returned");
    saveFailed();
  }

  revalidateProjects();
  redirect("/admin?status=project-created");
}

export async function updateProject(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = getText(formData, "id", 36);
  const project = parseProject(formData);
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
    !project
  ) {
    invalidForm();
  }

  const { data: previousProject, error: previousProjectError } = await supabase
    .from("projects")
    .select("slug")
    .eq("id", id)
    .single();
  if (previousProjectError || !previousProject) {
    console.error("Unable to load portfolio project for update.", previousProjectError?.code ?? "not_found");
    saveFailed();
  }

  const { data, error } = await supabase
    .from("projects")
    .update(project)
    .eq("id", id)
    .select("id")
    .single();
  if (error || !data) {
    console.error("Unable to update portfolio project.", error?.code ?? "no_row_returned");
    saveFailed();
  }

  revalidateProjects();
  redirect("/admin?status=project-updated");
}

export async function deleteProject(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = getText(formData, "id", 36);
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    invalidForm();
  }

  const { data, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .select("id")
    .single();
  if (error || !data) {
    console.error("Unable to delete portfolio project.", error?.code ?? "no_row_returned");
    saveFailed();
  }

  revalidateProjects();
  redirect("/admin?status=project-deleted");
}
