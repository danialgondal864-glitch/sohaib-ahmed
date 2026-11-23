import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/public-env";

export async function requireUser() {
  if (!getSupabaseUrl() || !getSupabasePublishableKey()) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error?.message === "Auth session missing!") {
    redirect("/login");
  }
  if (error) {
    throw new Error(`Unable to verify your account: ${error.message}`);
  }
  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}
