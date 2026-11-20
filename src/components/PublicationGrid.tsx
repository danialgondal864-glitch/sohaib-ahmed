"use client";

import { useEffect, useState } from "react";
import ArticleCard from "@/components/ArticleCard";
import type { PostCardData } from "@/lib/posts";

const PAGE_SIZE = 12;

export default function PublicationGrid({ posts }: { posts: PostCardData[] }) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [posts]);
  const pageCount = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const pagePosts = posts.slice(firstIndex, firstIndex + PAGE_SIZE);

  return (
    <>
      <p className="fine-print" role="status">
        Showing {posts.length === 0 ? 0 : firstIndex + 1}–{Math.min(firstIndex + PAGE_SIZE, posts.length)} of {posts.length} publications.
      </p>
      <div className="article-grid">
        {pagePosts.map((post) => <ArticleCard key={post.id} post={post} />)}
      </div>
      {pageCount > 1 && (
        <nav className="publication-pagination" aria-label="Publication pages">
          <button
            className="button button-ghost"
            type="button"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span aria-live="polite">Page {currentPage} of {pageCount}</span>
          <button
            className="button button-ghost"
            type="button"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage === pageCount}
          >
            Next
          </button>
        </nav>
      )}
    </>
  );
}
