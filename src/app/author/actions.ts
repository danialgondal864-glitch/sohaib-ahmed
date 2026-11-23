"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { parseEditorialForm } from "@/lib/editorial";
import { notifyAdministratorsOfSubmission } from "@/lib/email";
import { AUTHOR_MEDIA_BUCKET } from "@/lib/author-media";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUTHOR_MEDIA_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(avif|gif|jpg|png|webp)$/i;

function isOwnAuthorMediaPath(path: string, userId: string): boolean {
  const [ownerId, filename, ...remainingParts] = path.split("/");
  return ownerId === userId
    && remainingParts.length === 0
    && AUTHOR_MEDIA_FILENAME_PATTERN.test(filename ?? "");
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

function getOptionalWebUrl(formData: FormData, key: string, maxLength: number): string | null | undefined {
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
  try {
    const url = new URL(text);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function revalidateAuthorContent(slug?: string) {
  revalidatePath("/author");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath("/blogs");
  if (slug) {
    revalidatePath(`/blogs/${slug}`);
  }
}

export async function saveSubmission(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = getText(formData, "id", 36);
  if (id && !UUID_PATTERN.test(id)) {
    redirect("/author?status=invalid#submissions");
  }

  const { data: categoryRows, error: categoryError } = await supabase
    .from("categories")
    .select("id, name, content_type, parent_id")
    .eq("is_active", true);
  if (categoryError) {
    console.error("Unable to load categories for an author submission.", categoryError.code);
    redirect("/author?status=save-failed#submissions");
  }

  const categories = categoryRows ?? [];
  const editorial = parseEditorialForm(
    formData,
    new Set(categories.map((category) => category.name)),
    false
  );
  if (!editorial) {
    redirect("/author?status=invalid#submissions");
  }
  if (
    editorial.cover_image_path &&
    !editorial.cover_image_path.startsWith(`${user.id}/`)
  ) {
    redirect("/author?status=invalid#submissions");
  }

  const matchingCategory = categories.find((category) => category.name === editorial.category);
  const matchingSubcategory = editorial.subcategory_id
    ? categories.find((category) => category.id === editorial.subcategory_id)
    : null;
  if (
    !matchingCategory ||
    (matchingCategory.content_type !== "all" && matchingCategory.content_type !== editorial.content_type) ||
    (editorial.subcategory_id !== null &&
      (!matchingSubcategory || matchingSubcategory.parent_id !== matchingCategory.id))
  ) {
    redirect("/author?status=invalid#submissions");
  }

  const status = formData.get("intent") === "submit" ? "pending_review" : "draft";
  const payload = {
    ...editorial,
    published: false,
    workflow_status: status,
    updated_at: new Date().toISOString()
  };

  const { data, error } = id
    ? await supabase.from("posts")
        .update(payload)
        .eq("id", id)
        .eq("author_id", user.id)
        .select("slug")
        .maybeSingle()
    : await supabase.from("posts")
        .insert({ ...payload, author_id: user.id })
        .select("slug")
        .single();

  if (error || !data) {
    console.error("Unable to save author submission.", error?.code ?? "not_found");
    redirect("/author?status=save-failed#submissions");
  }

  revalidateAuthorContent(data.slug);
  if (status === "pending_review") {
    const emailStatus = await notifyAdministratorsOfSubmission({
      title: editorial.title,
      contentType: editorial.content_type
    });
    const statusMessage = emailStatus === "sent"
      ? "submitted"
      : emailStatus === "not_configured"
        ? "submitted-email-unconfigured"
        : "submitted-email-failed";
    redirect(`/author?status=${statusMessage}#submissions`);
  }
  redirect("/author?status=draft-saved#submissions");
}

export async function deleteSubmission(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = getText(formData, "id", 36);
  if (!id || !UUID_PATTERN.test(id)) {
    redirect("/author?status=invalid#submissions");
  }

  const { data, error } = await supabase.from("posts")
    .delete()
    .eq("id", id)
    .eq("author_id", user.id)
    .select("slug, cover_image_path")
    .maybeSingle();
  if (error || !data) {
    console.error("Unable to delete author submission.", error?.code ?? "not_found");
    redirect("/author?status=save-failed#submissions");
  }

  let mediaRetained = false;
  if (data.cover_image_path) {
    if (!isOwnAuthorMediaPath(data.cover_image_path, user.id)) {
      console.error("Submission cover path did not match its author.", id);
      mediaRetained = true;
    } else {
      const { error: mediaError } = await supabase.storage
        .from(AUTHOR_MEDIA_BUCKET)
        .remove([data.cover_image_path]);
      if (mediaError) {
        console.error("Unable to clean up submission media.", mediaError.statusCode ?? "storage_error");
        mediaRetained = true;
      }
    }
  }

  revalidateAuthorContent(data.slug);
  redirect(mediaRetained
    ? "/author?status=deleted-media-retained#submissions"
    : "/author?status=deleted#submissions");
}

export async function deleteAuthorMedia(formData: FormData) {
  const { supabase, user } = await requireUser();
  const path = getText(formData, "path", 160);
  if (!path || !isOwnAuthorMediaPath(path, user.id)) {
    redirect("/author?status=media-delete-failed#media");
  }

  const { data: references, error: referenceError } = await supabase.from("posts")
    .select("id")
    .eq("cover_image_path", path)
    .limit(1);
  if (referenceError) {
    console.error("Unable to check author media references.", referenceError.code);
    redirect("/author?status=media-delete-failed#media");
  }
  if (references && references.length > 0) {
    redirect("/author?status=media-in-use#media");
  }

  const { error } = await supabase.storage.from(AUTHOR_MEDIA_BUCKET).remove([path]);
  if (error) {
    console.error("Unable to delete author media.", error.statusCode ?? "storage_error");
    redirect("/author?status=media-delete-failed#media");
  }

  revalidatePath("/author");
  redirect("/author?status=media-deleted#media");
}

export async function markNotificationRead(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = getText(formData, "id", 36);
  const returnTo = formData.get("return_to") === "admin" ? "/admin" : "/author";
  if (!id || !UUID_PATTERN.test(id)) {
    redirect(`${returnTo}?status=invalid#notifications`);
  }

  const { error } = await supabase.from("author_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    console.error("Unable to mark author notification as read.", error.code);
    redirect(`${returnTo}?status=save-failed#notifications`);
  }

  revalidatePath(returnTo);
  redirect(`${returnTo}#notifications`);
}

export async function updateAuthorProfile(formData: FormData) {
  const { supabase, user } = await requireUser();
  const displayName = getOptionalText(formData, "display_name", 120);
  const authorSlug = getOptionalText(formData, "author_slug", 80);
  const bio = getOptionalText(formData, "bio", 1200);
  const avatarUrl = getOptionalWebUrl(formData, "avatar_url", 2048);
  const websiteUrl = getOptionalWebUrl(formData, "website_url", 2048);
  const isPublic = formData.get("author_profile_public") === "on";

  if (
    !displayName.valid ||
    !authorSlug.valid ||
    !bio.valid ||
    (authorSlug.value !== null && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(authorSlug.value)) ||
    (isPublic && authorSlug.value === null) ||
    avatarUrl === undefined ||
    websiteUrl === undefined
  ) {
    redirect("/author?status=profile-invalid#profile");
  }

  const { data, error } = await supabase.from("profiles")
    .update({
      display_name: displayName.value,
      author_slug: authorSlug.value,
      bio: bio.value,
      avatar_url: avatarUrl,
      website_url: websiteUrl,
      author_profile_public: isPublic
    })
    .eq("id", user.id)
    .select("author_slug")
    .single();
  if (error || !data) {
    console.error("Unable to update author profile.", error?.code ?? "no_profile");
    redirect(`/author?status=${error?.code === "23505" ? "profile-slug-taken" : "profile-failed"}#profile`);
  }

  revalidatePath("/author");
  if (data.author_slug) {
    revalidatePath(`/authors/${data.author_slug}`);
  }
  redirect("/author?status=profile-saved#profile");
}
