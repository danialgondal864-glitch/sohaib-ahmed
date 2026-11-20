"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORY_TYPES = new Set(["all", "article", "video", "podcast"]);

function getText(formData: FormData, key: string, maxLength: number): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
}

function getCategory(formData: FormData) {
  const name = getText(formData, "name", 80);
  const slug = getText(formData, "slug", 80);
  const descriptionValue = formData.get("description");
  const description = typeof descriptionValue === "string" && descriptionValue.trim().length <= 500
    ? descriptionValue.trim()
    : null;
  const contentType = getText(formData, "content_type", 16);
  const parentIdValue = formData.get("parent_id");
  const parentId = typeof parentIdValue === "string" && parentIdValue.length <= 36
    ? parentIdValue.trim() || null
    : undefined;
  const sortOrderValue = getText(formData, "sort_order", 5);
  const sortOrder = sortOrderValue ? Number(sortOrderValue) : NaN;
  const isActiveValue = getText(formData, "is_active", 5);
  if (
    !name ||
    !slug ||
    description === null ||
    !contentType ||
    !CATEGORY_TYPES.has(contentType) ||
    parentId === undefined ||
    (parentId !== null && !UUID_PATTERN.test(parentId)) ||
    !Number.isInteger(sortOrder) ||
    sortOrder < 0 ||
    sortOrder > 10000 ||
    (isActiveValue !== "true" && isActiveValue !== "false") ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  ) {
    return null;
  }
  return {
    name,
    slug,
    description,
    content_type: contentType,
    parent_id: parentId,
    sort_order: sortOrder,
    is_active: isActiveValue === "true"
  };
}

function revalidateCategories() {
  revalidatePath("/admin");
  revalidatePath("/blogs");
  revalidatePath("/blogs/[slug]", "page");
}

export async function createCategory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const category = getCategory(formData);
  if (!category) {
    redirect("/admin?status=category-invalid#categories");
  }

  const { error } = await supabase.from("categories").insert(category);
  if (error) {
    console.error("Unable to create research category.", error.code);
    redirect(`/admin?status=${error.code === "23505" ? "category-duplicate" : "category-failed"}#categories`);
  }

  revalidateCategories();
  redirect("/admin?status=category-created#categories");
}

export async function updateCategory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = getText(formData, "id", 36);
  const category = getCategory(formData);
  if (!id || !UUID_PATTERN.test(id) || !category || category.parent_id === id) {
    redirect("/admin?status=category-invalid#categories");
  }

  const { data, error } = await supabase
    .from("categories")
    .update(category)
    .eq("id", id)
    .select("id")
    .single();
  if (error || !data) {
    console.error("Unable to update research category.", error?.code ?? "not_found");
    redirect(`/admin?status=${error?.code === "23505" ? "category-duplicate" : "category-failed"}#categories`);
  }

  revalidateCategories();
  redirect("/admin?status=category-updated#categories");
}

export async function deleteCategory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = getText(formData, "id", 36);
  if (!id || !UUID_PATTERN.test(id)) {
    redirect("/admin?status=category-invalid#categories");
  }

  const { data, error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .select("id")
    .single();
  if (error || !data) {
    console.error("Unable to delete research category.", error?.code ?? "not_found");
    redirect(`/admin?status=${error?.code === "23503" ? "category-in-use" : "category-failed"}#categories`);
  }

  revalidateCategories();
  redirect("/admin?status=category-deleted#categories");
}
