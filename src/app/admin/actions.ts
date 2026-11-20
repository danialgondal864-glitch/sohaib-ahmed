"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { parseEditorialForm } from "@/lib/editorial";

function getText(formData: FormData, key: string, maxLength: number): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : null;
}


function invalidForm(): never {
  redirect("/admin?status=invalid");
}

function saveFailed(): never {
  redirect("/admin?status=save-failed");
}

export async function createPost(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("name");
  if (categoriesError) {
    console.error("Unable to load research categories for article creation.", categoriesError.code);
    saveFailed();
  }
  const post = parseEditorialForm(formData, new Set((categories ?? []).map((category) => category.name)), true);
  if (!post) {
    invalidForm();
  }

  const { data, error } = await supabase.from("posts").insert({
    ...post,
    workflow_status: post.published ? "published" : "draft",
    published_at: post.published ? new Date().toISOString() : null,
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
  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("name");
  if (categoriesError) {
    console.error("Unable to load research categories for article update.", categoriesError.code);
    saveFailed();
  }
  const post = parseEditorialForm(formData, new Set((categories ?? []).map((category) => category.name)), true);
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !post) {
    invalidForm();
  }

  const { data: existingPost, error: existingPostError } = await supabase
    .from("posts")
    .select("slug, workflow_status, published_at")
    .eq("id", id)
    .single();
  if (existingPostError || !existingPost) {
    console.error("Unable to load research article for update.", existingPostError?.code ?? "not_found");
    saveFailed();
  }

  const { data, error } = await supabase
    .from("posts")
    .update({
      ...post,
      workflow_status: post.published
        ? "published"
        : existingPost.workflow_status === "published"
          ? "draft"
          : existingPost.workflow_status,
      published_at: post.published
        ? existingPost.published_at ?? new Date().toISOString()
        : null
    })
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
