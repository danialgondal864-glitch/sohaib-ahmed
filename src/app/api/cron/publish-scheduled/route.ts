import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAuthorOfScheduledPublication } from "@/lib/email";

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
  const runStartedAt = new Date().toISOString();
  const { data: duePosts, error: duePostsError } = await supabase
    .from("posts")
    .select("id")
    .eq("workflow_status", "approved")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", runStartedAt);
  if (duePostsError) {
    console.error("Unable to load due publications for scheduled email notifications.", duePostsError.code);
    return NextResponse.json({ error: "Scheduled publishing failed" }, { status: 500 });
  }

  const { data, error } = await supabase.rpc("publish_scheduled_content");
  if (error) {
    console.error("Scheduled content publishing failed.", error.code);
    return NextResponse.json({ error: "Scheduled publishing failed" }, { status: 500 });
  }

  const dueIds = (duePosts ?? []).map((post) => post.id);
  let emailNotifications = { sent: 0, notConfigured: 0, failed: 0 };
  if (dueIds.length > 0) {
    const { data: publishedPosts, error: publishedPostsError } = await supabase
      .from("posts")
      .select("id, author_id, title, slug")
      .in("id", dueIds)
      .eq("workflow_status", "published")
      .gte("published_at", runStartedAt);
    if (publishedPostsError) {
      console.error("Scheduled content was published, but email recipients could not be loaded.", publishedPostsError.code);
      return NextResponse.json({ published: data, emailNotifications: "recipient_lookup_failed" });
    }

    const statuses = await Promise.all((publishedPosts ?? [])
      .filter((post): post is typeof post & { author_id: string } => post.author_id !== null)
      .map((post) => notifyAuthorOfScheduledPublication({
        authorId: post.author_id,
        title: post.title,
        slug: post.slug
      })));
    emailNotifications = statuses.reduce((counts, status) => {
      if (status === "sent") {
        counts.sent++;
      } else if (status === "not_configured") {
        counts.notConfigured++;
      } else {
        counts.failed++;
      }
      return counts;
    }, emailNotifications);
  }

  return NextResponse.json({ published: data, emailNotifications });
}
