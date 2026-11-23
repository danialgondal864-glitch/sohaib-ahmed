import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey } from "@/lib/supabase/server-env";

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = getSupabaseSecretKey();
  if (!supabaseUrl || !secretKey) {
    throw new Error("Supabase server administration is not configured.");
  }

  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });
}
