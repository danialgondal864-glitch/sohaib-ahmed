"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { notifyAuthorOfReview } from "@/lib/email";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVIEW_ACTIONS = new Set([
  "approve",
  "request_changes",
  "reject",
  "publish",
  "schedule",
  "unpublish",
  "archive",
  "restore"
]);

function getText(formData: FormData, key: string, maxLength: number): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim();
  return text.length <= maxLength ? text : null;
}

export async function reviewContent(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = getText(formData, "id", 36);
  const action = getText(formData, "action", 32);
  const feedback = getText(formData, "feedback", 4000);
  const scheduledAtValue = getText(formData, "scheduled_at", 32);
  const timezoneOffsetValue = getText(formData, "timezone_offset_minutes", 4);

  if (
    !id ||
    !UUID_PATTERN.test(id) ||
    !action ||
    !REVIEW_ACTIONS.has(action) ||
    ((action === "request_changes" || action === "reject") && !feedback)
  ) {
    redirect("/admin?status=review-invalid#review-queue");
  }

  let scheduledAt: string | null = null;
  if (action === "schedule") {
    const timezoneOffset = timezoneOffsetValue ? Number(timezoneOffsetValue) : NaN;
    const localDateAsUtc = scheduledAtValue
      ? Date.parse(`${scheduledAtValue}:00Z`)
      : NaN;
    if (
      !Number.isInteger(timezoneOffset) ||
      Math.abs(timezoneOffset) > 840 ||
      Number.isNaN(localDateAsUtc)
    ) {
      redirect("/admin?status=review-invalid#review-queue");
    }
    const date = new Date(localDateAsUtc + timezoneOffset * 60_000);
    if (date.getTime() <= Date.now()) {
      redirect("/admin?status=review-invalid#review-queue");
    }
    scheduledAt = date.toISOString();
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("slug, title, author_id")
    .eq("id", id)
    .maybeSingle();
  if (postError || !post) {
    console.error("Unable to load publication for review.", postError?.code ?? "not_found");
    redirect("/admin?status=review-failed#review-queue");
  }

  const { error } = await supabase.rpc("review_content", {
    p_post_id: id,
    p_action: action,
    p_feedback: feedback,
    p_scheduled_at: scheduledAt
  });
  if (error) {
    console.error("Unable to apply content review decision.", error.code);
    redirect("/admin?status=review-failed#review-queue");
  }

  revalidatePath("/admin");
  revalidatePath("/author");
  revalidatePath("/blogs");
  revalidatePath(`/blogs/${post.slug}`);
  let status = "review-updated";
  if (post.author_id) {
    const emailStatus = await notifyAuthorOfReview({
      authorId: post.author_id,
      title: post.title,
      slug: post.slug,
      action,
      feedback
    });
    if (emailStatus === "not_configured") {
      status = "review-updated-email-unconfigured";
    } else if (emailStatus === "failed") {
      status = "review-updated-email-failed";
    }
  }
  redirect(`/admin?status=${status}#review-queue`);
}
