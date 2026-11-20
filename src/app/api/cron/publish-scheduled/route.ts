import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expected || Buffer.byteLength(expected) < 32 || !authorization?.startsWith("Bearer ")) {
    return false;
  }

  const provided = authorization.slice("Bearer ".length);
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("publish_scheduled_content");
  if (error) {
    console.error("Scheduled content publishing failed.", error.code);
    return NextResponse.json({ error: "Scheduled publishing failed" }, { status: 500 });
  }

  return NextResponse.json({ published: data });
}
