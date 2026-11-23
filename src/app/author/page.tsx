import Link from "next/link";
import { saveSubmission, deleteSubmission, markNotificationRead, updateAuthorProfile } from "@/app/author/actions";
import PostForm from "@/app/admin/PostForm";
import AuthorMediaLibrary from "@/components/AuthorMediaLibrary";
import { parseResearchCategories } from "@/lib/categories";
import { requireUser } from "@/lib/auth/user";

type AuthorPageProps = {
  searchParams: Promise<{ status?: string }>;
};

const statusMessages: Record<string, string> = {
  submitted: "Your publication was submitted for administrator review.",
  "submitted-email-unconfigured": "Your publication was submitted. Email delivery is not configured; administrators can still see the in-app notification.",
  "submitted-email-failed": "Your publication was submitted, but its email notification could not be delivered. Administrators can still see the in-app notification.",
  "draft-saved": "Your draft was saved.",
  deleted: "Your draft was deleted.",
  "deleted-media-retained": "Your submission was deleted, but its cover image was retained because another publication may still use it or storage cleanup failed. You can review it in Uploaded media.",
  "media-deleted": "The unused uploaded file was deleted.",
  "media-in-use": "This file is still attached to a publication and cannot be deleted.",
  "media-delete-failed": "The file could not be deleted. It may still be in use; refresh and try again.",
  "profile-saved": "Your author profile was saved.",
  invalid: "Check the publication fields, category, links, and sources, then try again.",
  "save-failed": "The change could not be saved. Refresh the page and try again.",
  "profile-invalid": "Check the author profile fields and use valid HTTP(S) links.",
  "profile-slug-taken": "That author profile URL is already in use.",
  "profile-failed": "The author profile could not be saved. Please try again."
};

const workflowLabels: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Declined",
  published: "Published",
  archived: "Archived"
};

export default async function AuthorPage({ searchParams }: AuthorPageProps) {
  const { supabase, user } = await requireUser();
  const { status } = await searchParams;

  const [{ data: postRows, error: postsError }, { data: categoryRows, error: categoriesError }, { data: profile, error: profileError }, { data: notifications, error: notificationsError }] =
    await Promise.all([
      supabase.from("posts").select("*").eq("author_id", user.id).order("updated_at", { ascending: false }),
      supabase.from("categories")
        .select("id, name, slug, description, content_type, parent_id, sort_order, is_active, created_at, updated_at")
        .order("sort_order")
        .order("name"),
      supabase.from("profiles")
        .select("full_name, display_name, bio, avatar_url, author_slug, website_url, author_profile_public")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("author_notifications")
        .select("id, post_id, notification_type, message, read_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30)
    ]);

  if (postsError) {
    throw new Error(`Unable to load your publications: ${postsError.message}`);
  }
  if (categoriesError) {
    throw new Error(`Unable to load publication categories: ${categoriesError.message}`);
  }
  if (profileError) {
    throw new Error(`Unable to load your author profile: ${profileError.message}`);
  }
  if (notificationsError) {
    throw new Error(`Unable to load author notifications: ${notificationsError.message}`);
  }

  const posts = postRows ?? [];
  const categories = parseResearchCategories(categoryRows);
  const postIds = posts.map((post) => post.id);
  const { data: reviews, error: reviewsError } = postIds.length > 0
    ? await supabase.from("content_reviews")
        .select("id, post_id, action, previous_status, new_status, feedback, created_at")
        .in("post_id", postIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (reviewsError) {
    throw new Error(`Unable to load your review history: ${reviewsError.message}`);
  }

  const statusMessage = status ? statusMessages[status] : undefined;
  const editableStatuses = new Set(["draft", "changes_requested", "rejected"]);
  const displayName = profile?.display_name || profile?.full_name || user.user_metadata?.full_name || "Author";

  return (
    <div className="page-shell container">
      <div className="page-intro">
        <p className="eyebrow">AUTHOR STUDIO</p>
        <h1>Publish with <span className="gradient-text">purpose.</span></h1>
        <p>Signed in as {user.email}. Save private drafts or submit your work for administrator review.</p>
        <div className="hero-actions">
          <Link className="button button-ghost" href="/dashboard">Account dashboard</Link>
          <Link className="button button-ghost" href="/blogs">Public knowledge hub</Link>
        </div>
      </div>
      {statusMessage && <p className="success" role="status">{statusMessage}</p>}

      <section className="section-inner" id="submissions">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR WORK</p>
            <h2>Create a publication</h2>
          </div>
        </div>
        <div className="panel">
          <p>Contributors can submit articles, videos, and podcasts. Submissions stay private until an administrator approves and publishes them. Video and podcast media are linked from an external HTTPS provider in this release.</p>
          <PostForm action={saveSubmission} categories={categories} isAdmin={false} userId={user.id} />
        </div>
        <div className="admin-list">
          {posts.map((post) => {
            const editable = editableStatuses.has(post.workflow_status);
            const postReviews = (reviews ?? []).filter((review) => review.post_id === post.id);
            return (
              <details className="panel admin-item" key={post.id}>
                <summary>
                  <span>{post.title}</span>
                  <span className="muted">
                    {workflowLabels[post.workflow_status] ?? post.workflow_status} · {post.content_type} · {post.category}
                  </span>
                </summary>
                <p className="fine-print">{post.excerpt}</p>
                {post.review_feedback && (
                  <div className="panel review-feedback">
                    <h3>Latest administrator feedback</h3>
                    <p>{post.review_feedback}</p>
                  </div>
                )}
                {editable ? (
                  <>
                    <PostForm action={saveSubmission} post={post} categories={categories} isAdmin={false} userId={user.id} />
                    <form action={deleteSubmission}>
                      <input type="hidden" name="id" value={post.id} />
                      <button className="button button-ghost" type="submit">Delete submission</button>
                    </form>
                  </>
                ) : (
                  <p className="fine-print">This item cannot be edited while it is {workflowLabels[post.workflow_status]?.toLowerCase() ?? post.workflow_status}.</p>
                )}
                {postReviews.length > 0 && (
                  <div className="review-history">
                    <h3>Review history</h3>
                    <ol>
                      {postReviews.map((review) => (
                        <li key={review.id}>
                          <strong>{review.action.replace(/_/g, " ")}</strong>
                          <span className="muted"> · {new Date(review.created_at).toLocaleString()}</span>
                          {review.feedback && <p>{review.feedback}</p>}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </details>
            );
          })}
          {posts.length === 0 && (
            <div className="empty-research">
              <h3>No publications yet.</h3>
              <p>Start with a draft above. Your work remains private until it is approved and published.</p>
            </div>
          )}
        </div>
      </section>

      <section className="section-inner" id="notifications">
        <div className="section-heading">
          <div>
            <p className="eyebrow">UPDATES</p>
            <h2>Notifications</h2>
          </div>
        </div>
        {(notifications ?? []).length > 0 ? (
          <ul className="author-notifications">
            {(notifications ?? []).map((notification) => (
              <li className={notification.read_at ? "" : "unread"} key={notification.id}>
                <div>
                  <p>{notification.message}</p>
                  <span className="muted">{new Date(notification.created_at).toLocaleString()}</span>
                </div>
                {!notification.read_at && (
                  <form action={markNotificationRead}>
                    <input type="hidden" name="id" value={notification.id} />
                    <button className="button button-ghost" type="submit">Mark read</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-research"><p>No notifications yet.</p></div>
        )}
      </section>

      <AuthorMediaLibrary userId={user.id} />

      <section className="section-inner" id="profile">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PUBLIC PRESENCE</p>
            <h2>Author profile</h2>
          </div>
        </div>
        <div className="panel">
          <p>Publish a profile card at <code>/authors/{profile?.author_slug || "your-name"}</code>. Your profile remains private until you enable public visibility.</p>
          <form action={updateAuthorProfile} className="admin-post-form">
            <label>
              Display name
              <input name="display_name" defaultValue={profile?.display_name ?? profile?.full_name ?? displayName} maxLength={120} />
            </label>
            <label>
              Profile URL slug
              <input name="author_slug" defaultValue={profile?.author_slug ?? ""} maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
            </label>
            <label>
              Short biography
              <textarea name="bio" defaultValue={profile?.bio ?? ""} maxLength={1200} rows={4} />
            </label>
            <label>
              Avatar image URL
              <input name="avatar_url" type="url" defaultValue={profile?.avatar_url ?? ""} maxLength={2048} />
            </label>
            <label>
              Website URL
              <input name="website_url" type="url" defaultValue={profile?.website_url ?? ""} maxLength={2048} />
            </label>
            <label className="admin-checkbox">
              <input
                name="author_profile_public"
                type="checkbox"
                defaultChecked={profile?.author_profile_public ?? false}
              />
              Make this author profile public
            </label>
            <button className="button" type="submit">Save author profile</button>
          </form>
        </div>
      </section>
    </div>
  );
}
