import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
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
