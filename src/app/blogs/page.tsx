import ArticleExplorer from "@/components/ArticleExplorer";
import { createClient } from "@/lib/supabase/server";
import { parseResearchCategories } from "@/lib/categories";
import type { PostCardData } from "@/lib/posts";

export default async function Blogs() {
  const isConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  let posts: PostCardData[] = [];
  let categories: ReturnType<typeof parseResearchCategories> = [];

  if (isConfigured) {
    const supabase = await createClient();
    const { data: categoryRows, error: categoriesError } = await supabase
      .from("categories")
      .select("id, name, slug, description, content_type, parent_id, sort_order, is_active, created_at, updated_at")
      .eq("is_active", true)
      .order("sort_order")
      .order("name");
    if (categoriesError) {
      throw new Error(`Unable to load research categories: ${categoriesError.message}`);
    }
    categories = parseResearchCategories(categoryRows);
    const { data, error } = await supabase
      .from("posts")
      .select("id, title, slug, category, subcategory_id, content_type, excerpt, read_time, duration_seconds, cover_image_url, tags, created_at, author_id")
      .eq("published", true)
      .eq("workflow_status", "published")
      .order("published_at", { ascending: false });

    if (error) {
      throw new Error(`Unable to load published content: ${error.message}`);
    }

    const subcategoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const authorIds = Array.from(new Set((data ?? [])
      .map((post) => post.author_id)
      .filter((id): id is string => typeof id === "string")));
    const { data: authorRows, error: authorsError } = authorIds.length > 0
      ? await supabase.from("author_profiles")
          .select("id, display_name, author_slug")
          .in("id", authorIds)
      : { data: [], error: null };
    if (authorsError) {
      throw new Error(`Unable to load public author details: ${authorsError.message}`);
    }
    const authors = new Map((authorRows ?? []).map((author) => [author.id, author]));
    posts = (data ?? []).map((post) => {
      const author = post.author_id ? authors.get(post.author_id) : undefined;
      return {
        ...post,
        subcategory: post.subcategory_id ? subcategoryNames.get(post.subcategory_id) ?? null : null,
        author_name: author?.display_name ?? null,
        author_slug: author?.author_slug ?? null
      };
    });
  }

  return (
    <div className="page-shell container">
      <div className="page-intro">
        <p className="eyebrow">THE KNOWLEDGE HUB</p>
        <h1>Research. Discover.<br /><span className="gradient-text">Find better solutions.</span></h1>
        <p>A research-driven space for technology exploration, practical problem solving, innovative ideas and useful AI tools.</p>
      </div>
      <div className="topic-grid">
        {categories.map((category, index) => (
          <div className="topic-card" key={category.id}>
            <span className="topic-number">{String(index + 1).padStart(2, "0")}</span>
            <h3>{category.name}</h3>
            <p>{category.description || "Explore publications in this topic."}</p>
          </div>
        ))}
      </div>
      <section className="section-inner">
        <div className="section-heading">
          <div>
            <p className="eyebrow">LATEST PUBLICATIONS</p>
            <h2>From the research desk</h2>
          </div>
        </div>
        {posts.length > 0 ? (
          <ArticleExplorer
            posts={posts}
            categories={categories.map((category) => ({
              name: category.name,
              content_type: category.content_type
            }))}
          />
        ) : (
          <div className="empty-research">
            <h3>{isConfigured ? "No published content yet." : "Research publishing is not configured yet."}</h3>
            <p>Published articles, videos, and podcasts will appear here with category filters, search, and source references.</p>
          </div>
        )}
      </section>
    </div>
  );
}
