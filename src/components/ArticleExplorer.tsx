"use client";

import { useMemo, useState } from "react";
import ArticleCard from "@/components/ArticleCard";
import type { PostCardData } from "@/lib/posts";

export default function ArticleExplorer({ posts }: { posts: PostCardData[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const categories = useMemo(
    () => Array.from(new Set(posts.map((post) => post.category).filter(Boolean))).sort(),
    [posts]
  );
  const filteredPosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesCategory = category === "all" || post.category === category;
      const matchesSearch =
        !query ||
        [post.title, post.excerpt, post.category].some((value) =>
          value.toLowerCase().includes(query)
        );
      return matchesCategory && matchesSearch;
    });
  }, [category, posts, search]);

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
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <p className="fine-print" role="status">
        Showing {filteredPosts.length} of {posts.length} publications.
      </p>
      {filteredPosts.length > 0 ? (
        <div className="article-grid">
          {filteredPosts.map((post) => <ArticleCard key={post.id} post={post} />)}
        </div>
      ) : (
        <div className="empty-research">
          <h3>No matching publications.</h3>
          <p>Try a different search or choose another category.</p>
        </div>
      )}
    </>
  );
}
