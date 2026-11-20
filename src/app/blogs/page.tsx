import ArticleExplorer from "@/components/ArticleExplorer";
import { createClient } from "@/lib/supabase/server";
import { parseResearchCategories } from "@/lib/categories";
import type { PostCardData } from "@/lib/posts";

const topicDescriptions: Record<string, string> = {
  "AI & Emerging Technologies": "Research on AI developments, practical applications and emerging technology.",
  "Latest AI Tools": "Hands-on tool discoveries, comparisons, workflows and useful guides.",
  "Research & Analysis": "Evidence-led exploration of technical questions and new ideas.",
  "Problem Solving": "Clear problem definitions, investigation and practical solution paths.",
  "Cloud & DevOps": "Linux, cloud platforms, containers, deployment and operations.",
  "Future Technologies": "Innovations worth understanding and their possible impact."
};

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
      .select("id, name, slug, created_at, updated_at")
      .order("name");
    if (categoriesError) {
      throw new Error(`Unable to load research categories: ${categoriesError.message}`);
    }
    categories = parseResearchCategories(categoryRows);
    const { data, error } = await supabase
      .from("posts")
      .select("id, title, slug, category, excerpt, read_time, created_at")
      .eq("published", true)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Unable to load research articles: ${error.message}`);
    }

    posts = data ?? [];
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
            <p>{topicDescriptions[category.name] ?? "Explore articles, research, and practical notes in this topic."}</p>
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
          <ArticleExplorer posts={posts} categoryNames={categories.map((category) => category.name)} />
        ) : (
          <div className="empty-research">
            <h3>{isConfigured ? "No published articles yet." : "Research publishing is not configured yet."}</h3>
            <p>Published articles will appear here with category filters, search, clearly labeled research sections, and source references.</p>
          </div>
        )}
      </section>
    </div>
  );
}
