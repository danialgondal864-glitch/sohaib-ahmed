import Link from "next/link";
import type { PostCardData } from "@/lib/posts";

export default function ArticleCard({ post }: { post: PostCardData }) {
  return (
    <Link className="article-card" href={`/blogs/${post.slug}`}>
      <div className="article-top">
        <span className="eyebrow">{post.category || "Research"}</span>
        <span className="muted">{post.read_time || 5} min read</span>
      </div>
      <h3>{post.title}</h3>
      <p>{post.excerpt}</p>
      <span className="text-link">Explore article ↗</span>
    </Link>
  );
}