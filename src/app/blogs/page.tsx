import ArticleExplorer from "@/components/ArticleExplorer";
import { createClient } from "@/lib/supabase/server";
import { parseResearchCategories } from "@/lib/categories";
import { resolveCoverImageUrl } from "@/lib/author-media";
import { CONTENT_TYPES } from "@/lib/editorial";
import { POSTS_PER_PAGE, type PostCardData } from "@/lib/posts";

type BlogsProps = {
  searchParams: Promise<{
    search?: string | string[];
    category?: string | string[];
    type?: string | string[];
    page?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parsePage(value: string | string[] | undefined): number {
  const parsed = Number(firstParam(value));
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 1_000_000 ? parsed : 1;
}

function normalizeSearch(value: string | string[] | undefined): string {
  return firstParam(value)
    .slice(0, 80)
    .replace(/[^a-zA-Z0-9 -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function Blogs({ searchParams }: BlogsProps) {
  const params = await searchParams;
  const isConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  let posts: PostCardData[] = [];
  let categories: ReturnType<typeof parseResearchCategories> = [];
  let totalPosts = 0;
  let page = 1;
  let pageCount = 1;
  const search = normalizeSearch(params.search);
  const requestedPage = parsePage(params.page);
  const candidateType = firstParam(params.type);
  const contentType = CONTENT_TYPES.find((type) => type === candidateType) ?? "all";
  let selectedCategory = "all";
  let selectedSubcategoryId: string | null = null;

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
    const categoryCandidate = firstParam(params.category);
    const selectedCategoryRow = categories.find((item) =>
      item.name === categoryCandidate &&
      (item.content_type === "all" || contentType === "all" || item.content_type === contentType)
    );
    selectedCategory = selectedCategoryRow?.name ?? "all";
    selectedSubcategoryId = selectedCategoryRow?.parent_id ? selectedCategoryRow.id : null;

    let matchingAuthorIds: string[] = [];
    if (search) {
      const { data: matchingAuthors, error: matchingAuthorsError } = await supabase
        .from("author_profiles")
        .select("id")
        .ilike("display_name", `%${search}%`)
        .limit(1000);
      if (matchingAuthorsError) {
        throw new Error(`Unable to search public author profiles: ${matchingAuthorsError.message}`);
      }
      matchingAuthorIds = (matchingAuthors ?? []).map((author) => author.id);
    }

    function buildPostsQuery() {
      let query = supabase
        .from("posts")
        .select("id, title, slug, category, subcategory_id, content_type, excerpt, read_time, duration_seconds, cover_image_url, cover_image_path, tags, created_at, author_id", { count: "exact" })
        .eq("published", true)
        .eq("workflow_status", "published");
      if (contentType !== "all") {
        query = query.eq("content_type", contentType);
      }
      if (selectedCategory !== "all") {
        query = selectedSubcategoryId
          ? query.eq("subcategory_id", selectedSubcategoryId)
          : query.eq("category", selectedCategory);
      }
      if (search) {
        const searchFilters = [
          `title.ilike.%${search}%`,
          `excerpt.ilike.%${search}%`,
          `category.ilike.%${search}%`
        ];
        if (matchingAuthorIds.length > 0) {
          searchFilters.push(`author_id.in.(${matchingAuthorIds.join(",")})`);
        }
        if (/^[a-zA-Z0-9-]{1,40}$/.test(search)) {
          searchFilters.push(`tags.cs.{${search}}`);
        }
        query = query.or(searchFilters.join(","));
      }
      return query.order("published_at", { ascending: false }).order("id");
    }

    const firstResult = await buildPostsQuery()
      .range((requestedPage - 1) * POSTS_PER_PAGE, requestedPage * POSTS_PER_PAGE - 1);
    if (firstResult.error) {
      throw new Error(`Unable to load published content: ${firstResult.error.message}`);
    }
    totalPosts = firstResult.count ?? 0;
    pageCount = Math.max(1, Math.ceil(totalPosts / POSTS_PER_PAGE));
    page = Math.min(requestedPage, pageCount);
    const pageRows = page === requestedPage
      ? firstResult.data ?? []
      : await (async () => {
          const correctedResult = await buildPostsQuery()
            .range((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE - 1);
          if (correctedResult.error) {
            throw new Error(`Unable to load published content: ${correctedResult.error.message}`);
          }
          return correctedResult.data ?? [];
        })();

    const subcategoryNames = new Map(categories.map((item) => [item.id, item.name]));
    const authorIds = Array.from(new Set(pageRows
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
    posts = await Promise.all(pageRows.map(async (post) => {
      const author = post.author_id ? authors.get(post.author_id) : undefined;
      const { cover_image_path: coverImagePath, ...publicPost } = post;
      return {
        ...publicPost,
        cover_image_url: await resolveCoverImageUrl(supabase, post.cover_image_url, coverImagePath),
        subcategory: post.subcategory_id ? subcategoryNames.get(post.subcategory_id) ?? null : null,
        author_name: author?.display_name ?? null,
        author_slug: author?.author_slug ?? null
      };
    }));
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
        {isConfigured ? (
          <ArticleExplorer
            posts={posts}
            categories={categories.map((category) => ({
              name: category.name,
              content_type: category.content_type
            }))}
            totalPosts={totalPosts}
            page={page}
            pageCount={pageCount}
            search={search}
            category={selectedCategory}
            contentType={contentType}
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
