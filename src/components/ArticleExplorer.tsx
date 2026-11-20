"use client";

import { useMemo, useState } from "react";
import PublicationGrid from "@/components/PublicationGrid";
import type { PostCardData } from "@/lib/posts";

export default function ArticleExplorer({
  posts,
  categories
}: {
  posts: PostCardData[];
  categories?: Array<{ name: string; content_type: string }>;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [contentType, setContentType] = useState("all");
  const categoryOptions = useMemo(
    () => categories ?? Array.from(new Set(posts.map((post) => post.category).filter(Boolean)))
      .sort()
      .map((name) => ({ name, content_type: "all" })),
    [categories, posts]
  );
  const availableCategories = categoryOptions.filter((item) =>
    item.content_type === "all" || contentType === "all" || item.content_type === contentType
  );
  const filteredPosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesType = contentType === "all" || (post.content_type ?? "article") === contentType;
      const matchesCategory = category === "all" || post.category === category;
      const matchesSearch =
        !query ||
        [post.title, post.excerpt, post.category, post.author_name ?? "", ...(post.tags ?? [])]
          .some((value) => value.toLowerCase().includes(query));
      return matchesType && matchesCategory && matchesSearch;
    });
  }, [category, contentType, posts, search]);

  return (
    <>
      <div className="research-controls">
        <label>
          Search publications
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search titles, summaries, or categories"
          />
        </label>
        <label>
          Publication type
          <select
            value={contentType}
            onChange={(event) => {
              setContentType(event.target.value);
              setCategory("all");
            }}
          >
            <option value="all">All publication types</option>
            <option value="article">Articles</option>
            <option value="video">Videos</option>
            <option value="podcast">Podcasts</option>
          </select>
        </label>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {availableCategories.map((item) => (
              <option key={item.name} value={item.name}>{item.name}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="fine-print" role="status">
        Matching publications: {filteredPosts.length} of {posts.length}.
      </p>
      {filteredPosts.length > 0 ? (
        <PublicationGrid posts={filteredPosts} />
      ) : (
        <div className="empty-research">
          <h3>No matching publications.</h3>
          <p>Try a different search or choose another category.</p>
        </div>
      )}
    </>
  );
}
