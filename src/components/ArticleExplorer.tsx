import Link from "next/link";
import ArticleCard from "@/components/ArticleCard";
import PublicationPagination from "@/components/PublicationPagination";
import { POSTS_PER_PAGE, type PostCardData } from "@/lib/posts";

export default function ArticleExplorer({
  posts,
  categories,
  totalPosts,
  page,
  pageCount,
  search,
  category,
  contentType
}: {
  posts: PostCardData[];
  categories?: Array<{ name: string; content_type: string }>;
  totalPosts: number;
  page: number;
  pageCount: number;
  search: string;
  category: string;
  contentType: string;
}) {
  const availableCategories = (categories ?? []).filter((item) =>
    item.content_type === "all" || contentType === "all" || item.content_type === contentType
  );
  const pageParams = {
    ...(search ? { search } : {}),
    ...(category !== "all" ? { category } : {}),
    ...(contentType !== "all" ? { type: contentType } : {})
  };
  const firstResult = totalPosts === 0 ? 0 : (page - 1) * POSTS_PER_PAGE + 1;
  const lastResult = Math.min(page * POSTS_PER_PAGE, totalPosts);

  return (
    <>
      <form className="research-controls" action="/blogs" method="get">
        <label>
          Search publications
          <input
            type="search"
            name="search"
            defaultValue={search}
            maxLength={80}
            placeholder="Search titles, summaries, authors, or tags"
          />
        </label>
        <label>
          Publication type
          <select name="type" defaultValue={contentType}>
            <option value="all">All publication types</option>
            <option value="article">Articles</option>
            <option value="video">Videos</option>
            <option value="podcast">Podcasts</option>
          </select>
        </label>
        <label>
          Research category
          <select name="category" defaultValue={category}>
            <option value="all">All categories</option>
            {availableCategories.map((item) => (
              <option key={item.name} value={item.name}>{item.name}</option>
            ))}
          </select>
        </label>
        <div className="research-filter-actions">
          <button className="button" type="submit">Apply filters</button>
          {(search || category !== "all" || contentType !== "all") && (
            <Link className="text-link" href="/blogs">Clear filters</Link>
          )}
        </div>
      </form>
      <p className="fine-print" role="status">
        Showing {firstResult}–{lastResult} of {totalPosts} publications.
      </p>
      {posts.length > 0 ? (
        <>
          <div className="article-grid">
            {posts.map((post) => <ArticleCard key={post.id} post={post} />)}
          </div>
          <PublicationPagination
            path="/blogs"
            params={pageParams}
            page={page}
            pageCount={pageCount}
          />
        </>
      ) : (
        <div className="empty-research">
          <h3>No matching publications.</h3>
          <p>Try a different search or choose another publication type or category.</p>
        </div>
      )}
    </>
  );
}
