import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/public-env";

export async function requireAdmin() {
  if (!getSupabaseUrl() || !getSupabasePublishableKey()) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError?.message === "Auth session missing!") {
    redirect("/login");
  }
  if (authError) {
    throw new Error(`Unable to verify your account: ${authError.message}`);
  }
  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Unable to verify administrator access: ${profileError.message}`);
  }
  if (profile?.role !== "admin") {
    notFound();
  }

  return { supabase, user };
}
