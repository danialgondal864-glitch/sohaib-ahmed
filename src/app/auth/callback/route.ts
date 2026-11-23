import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/public-env";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination =
    request.nextUrl.searchParams.get("next") === "/update-password"
      ? "/update-password"
      : "/dashboard";

  if (code) {
    if (!getSupabaseUrl() || !getSupabasePublishableKey()) {
      return NextResponse.redirect(new URL("/login?error=auth-callback", request.url));
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth-callback", request.url));
}
