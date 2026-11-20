import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import PublicationGrid from "@/components/PublicationGrid";
import { createClient } from "@/lib/supabase/server";
import { resolveCoverImageUrl } from "@/lib/author-media";
import type { PostCardData } from "@/lib/posts";

type AuthorPageProps = {
  params: Promise<{ slug: string }>;
};

async function getAuthor(slug: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("author_profiles")
    .select("id, display_name, bio, avatar_url, author_slug, website_url")
    .eq("author_slug", slug)
    .maybeSingle();
  if (error) {
    throw new Error(`Unable to load author profile: ${error.message}`);
  }
  return data;
}

export async function generateMetadata({ params }: AuthorPageProps): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthor(slug);
  if (!author) {
    return { title: "Author not found" };
  }
  return {
    title: author.display_name,
    description: author.bio || `Publications by ${author.display_name}.`
  };
}

export default async function PublicAuthorPage({ params }: AuthorPageProps) {
  const { slug } = await params;
  const author = await getAuthor(slug);
  if (!author) {
    notFound();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("posts")
    .select("id, title, slug, category, content_type, excerpt, read_time, created_at, cover_image_url, cover_image_path")
    .eq("author_id", author.id)
    .eq("published", true)
    .eq("workflow_status", "published")
    .order("published_at", { ascending: false });
  if (error) {
    throw new Error(`Unable to load the author's publications: ${error.message}`);
  }

  const publications: PostCardData[] = await Promise.all((data ?? []).map(async (post) => {
    const { cover_image_path: coverImagePath, ...publicPost } = post;
    return {
      ...publicPost,
      cover_image_url: await resolveCoverImageUrl(supabase, post.cover_image_url, coverImagePath)
    };
  }));

  return (
    <div className="page-shell container">
      <header className="page-intro author-profile-header">
        {author.avatar_url && (
          <Image
            className="author-avatar"
            src={author.avatar_url}
            alt={`${author.display_name} profile`}
            loading="lazy"
            referrerPolicy="no-referrer"
            width={104}
            height={104}
            unoptimized
          />
        )}
        <p className="eyebrow">CONTRIBUTOR</p>
        <h1>{author.display_name}</h1>
        {author.bio && <p>{author.bio}</p>}
        {author.website_url && (
          <a className="text-link" href={author.website_url} target="_blank" rel="noopener noreferrer">
            Author website ↗
          </a>
        )}
      </header>
      <section className="section-inner">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PUBLIC WORK</p>
            <h2>Publications by {author.display_name}</h2>
          </div>
        </div>
        {publications.length > 0 ? (
          <PublicationGrid posts={publications} />
        ) : (
          <div className="empty-research"><p>No public publications yet.</p></div>
        )}
      </section>
    </div>
  );
}
