"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

function getUserId(formData: FormData): string | null {
  const value = formData.get("user_id");
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export async function updateUserRole(formData: FormData) {
  const { user: actor } = await requireAdmin();
  const userId = getUserId(formData);
  const role = formData.get("role");
  if (!userId || (role !== "user" && role !== "admin")) {
    redirect("/admin?status=user-role-invalid#users");
  }
  if (userId === actor.id) {
    redirect("/admin?status=user-role-self#users");
  }

  const adminClient = createAdminClient();
  const { data: result, error } = await adminClient.rpc("admin_update_user_role", {
    target_user_id: userId,
    new_role: role
  });
  if (error) {
    console.error("Unable to update user role.", error.code);
    redirect("/admin?status=user-role-failed#users");
  }
  if (result === "last_admin") {
    redirect("/admin?status=user-role-last-admin#users");
  }
  if (result !== "updated") {
    redirect("/admin?status=user-role-failed#users");
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirect("/admin?status=user-role-updated#users");
}
