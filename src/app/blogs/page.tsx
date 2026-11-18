import ArticleExplorer from "@/components/ArticleExplorer";
import { createClient } from "@/lib/supabase/server";
import type { PostCardData } from "@/lib/posts";

const topics = [
  {
    title: "AI & Emerging Technologies",
    description: "Research on AI developments, practical applications and emerging technology."
  },
  {
    title: "Latest AI Tools",
    description: "Hands-on tool discoveries, comparisons, workflows and useful guides."
  },
  {
    title: "Research & Analysis",
    description: "Evidence-led exploration of technical questions and new ideas."
  },
  {
    title: "Problem Solving",
    description: "Clear problem definitions, investigation and practical solution paths."
  },
  {
    title: "Cloud & DevOps",
    description: "Linux, cloud platforms, containers, deployment and operations."
  },
  {
    title: "Future Technologies",
    description: "Innovations worth understanding and their possible impact."
  }
];

export default async function Blogs() {
  const isConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  let posts: PostCardData[] = [];

  if (isConfigured) {
    const supabase = await createClient();
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
        {topics.map((topic, index) => (
          <div className="topic-card" key={topic.title}>
            <span className="topic-number">0{index + 1}</span>
            <h3>{topic.title}</h3>
            <p>{topic.description}</p>
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
          <ArticleExplorer posts={posts} />
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
