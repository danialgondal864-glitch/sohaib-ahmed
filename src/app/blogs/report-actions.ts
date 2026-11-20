"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/user";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPORT_REASONS = new Set(["misinformation", "spam", "copyright", "abuse", "other"]);

function getText(formData: FormData, key: string, maxLength: number): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim();
  return text.length <= maxLength ? text : null;
}

export async function reportContent(formData: FormData) {
  const { supabase, user } = await requireUser();
  const postId = getText(formData, "post_id", 36);
  const reason = getText(formData, "reason", 32);
  const details = getText(formData, "details", 2000);
  if (
    !postId ||
    !UUID_PATTERN.test(postId) ||
    !reason ||
    !REPORT_REASONS.has(reason) ||
    details === null
  ) {
    redirect("/blogs?report=report-invalid");
  }

  const { data: post, error: postError } = await supabase.from("posts")
    .select("title, slug")
    .eq("id", postId)
    .eq("published", true)
    .eq("workflow_status", "published")
    .maybeSingle();
  if (postError || !post) {
    console.error("Unable to load reported publication.", postError?.code ?? "not_found");
    redirect("/blogs?report=report-failed");
  }

  const { error } = await supabase.from("content_reports").insert({
    post_id: postId,
    post_title: post.title,
    post_slug: post.slug,
    reporter_id: user.id,
    reason,
    details
  });
  if (error) {
    console.error("Unable to create content report.", error.code);
    redirect(`/blogs/${post.slug}?report=${error.code === "23505" ? "already-reported" : "report-failed"}`);
  }

  revalidatePath("/admin");
  redirect(`/blogs/${post.slug}?report=reported`);
}
