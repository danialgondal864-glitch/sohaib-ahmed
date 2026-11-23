import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/public-env";

export async function createClient() {
  const cookieStore = await cookies();
  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      } catch {
        // Server Components cannot write refreshed cookies; middleware handles token refresh.
      }
    }
  };

  return createServerClient(
    getSupabaseUrl()!,
    getSupabasePublishableKey()!,
    { cookies: cookieMethods }
  );
}