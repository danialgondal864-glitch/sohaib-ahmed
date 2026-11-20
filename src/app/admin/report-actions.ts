"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPORT_STATUSES = new Set(["new", "in_review", "resolved", "dismissed"]);

function getText(formData: FormData, key: string, maxLength: number): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim();
  return text.length <= maxLength ? text : null;
}

export async function updateContentReport(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = getText(formData, "id", 36);
  const status = getText(formData, "status", 32);
  const adminNotes = getText(formData, "admin_notes", 2000);
  if (!id || !UUID_PATTERN.test(id) || !status || !REPORT_STATUSES.has(status) || adminNotes === null) {
    redirect("/admin?status=report-invalid#reports");
  }

  const { data, error } = await supabase.from("content_reports")
    .update({
      status,
      admin_notes: adminNotes || null,
      handled_by: user.id,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("Unable to update content report.", error?.code ?? "not_found");
    redirect("/admin?status=report-failed#reports");
  }

  revalidatePath("/admin");
  redirect("/admin?status=report-updated#reports");
}
