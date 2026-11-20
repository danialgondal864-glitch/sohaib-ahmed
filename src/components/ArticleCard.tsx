import Link from "next/link";
import Image from "next/image";
import type { PostCardData } from "@/lib/posts";

export default function ArticleCard({ post }: { post: PostCardData }) {
  const contentType = post.content_type ?? "article";
  const duration = post.duration_seconds && post.duration_seconds > 0
    ? `${Math.floor(post.duration_seconds / 60)} min`
    : null;
  return (
    <Link className="article-card" href={`/blogs/${post.slug}`}>
      {post.cover_image_url && (
        <Image
          className="publication-cover"
          src={post.cover_image_url}
          alt=""
          width={600}
          height={338}
          loading="lazy"
          unoptimized
        />
      )}
      <div className="article-top">
        <span className="eyebrow">
          {[post.category || "Research", post.subcategory].filter(Boolean).join(" / ")} · {contentType}
        </span>
        <span className="muted">
          {contentType === "article" ? `${post.read_time || 5} min read` : duration ?? contentType}
        </span>
      </div>
      <h3>{post.title}</h3>
      <p>{post.excerpt}</p>
      {post.author_name && (
        <span className="muted">By {post.author_name}</span>
      )}
      {post.tags && post.tags.length > 0 && (
        <span className="publication-tags">{post.tags.slice(0, 4).join(" · ")}</span>
      )}
      <span className="text-link">Explore publication ↗</span>
    </Link>
  );
}