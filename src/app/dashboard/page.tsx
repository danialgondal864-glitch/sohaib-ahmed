import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ArticleCard from "@/components/ArticleCard";
import type { PostCardData } from "@/lib/posts";

export default async function Dashboard() {
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    throw new Error(`Unable to verify your account role: ${profileError.message}`);
  }
  const isAdmin = profile?.role === "admin";

  async function logout() {
    "use server";

    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(`Unable to sign out: ${error.message}`);
    }
    redirect("/");
  }

  const { data: bookmarks, error: bookmarksError } = await supabase
    .from("bookmarks")
    .select("post_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const migrationMissing =
    bookmarksError?.code === "PGRST205" || bookmarksError?.code === "42P01";
  if (bookmarksError && !migrationMissing) {
    throw new Error(`Unable to load saved articles: ${bookmarksError.message}`);
  }

  const postIds = (bookmarks ?? []).map((bookmark) => bookmark.post_id);
  let savedPosts: PostCardData[] = [];

  if (postIds.length > 0) {
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select("id, title, slug, category, excerpt, read_time, created_at")
      .in("id", postIds)
      .eq("published", true);

    if (postsError) {
      throw new Error(`Unable to load saved articles: ${postsError.message}`);
    }

    const postsById = new Map<string, PostCardData>();
    for (const post of posts ?? []) {
      postsById.set(post.id, post);
    }
    savedPosts = postIds.flatMap((id) => {
      const post = postsById.get(id);
      return post ? [post] : [];
    });
  }

  const displayName = user.user_metadata?.full_name || "there";

  return (
    <div className="page-shell container">
      <div className="page-intro">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>Welcome, <span className="gradient-text">{displayName}.</span></h1>
        <p>{user.email}</p>
        {isAdmin && (
          <Link className="button" href="/admin">Open admin dashboard</Link>
        )}
      </div>
      <section className="section-inner" id="saved-articles">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR LIBRARY</p>
            <h2>Saved articles</h2>
          </div>
        </div>
        {migrationMissing ? (
          <div className="panel">
            <p>Saved articles are not configured yet. Please check back later.</p>
          </div>
        ) : savedPosts.length > 0 ? (
          <div className="article-grid">
            {savedPosts.map((post) => <ArticleCard key={post.id} post={post} />)}
          </div>
        ) : (
          <div className="empty-research">
            <h3>No saved articles yet.</h3>
            <p>Bookmark a published article to keep it in your library.</p>
            <Link className="text-link" href="/blogs">Explore research</Link>
          </div>
        )}
      </section>
      <div className="panel">
        <h2>Your portfolio account</h2>
        <p>You&apos;re signed in. Your saved articles are private to your account.</p>
        <form action={logout}>
          <button className="button button-ghost" type="submit">Log out</button>
        </form>
      </div>
    </div>
  );
}
