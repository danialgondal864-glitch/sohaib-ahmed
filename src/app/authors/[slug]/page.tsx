import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import ArticleCard from "@/components/ArticleCard";
import PublicationPagination from "@/components/PublicationPagination";
import { createClient } from "@/lib/supabase/server";
import { resolveCoverImageUrl } from "@/lib/author-media";
import { POSTS_PER_PAGE, type PostCardData } from "@/lib/posts";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/public-env";

type AuthorPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

function parsePage(value: string | string[] | undefined): number {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 1_000_000 ? parsed : 1;
}

async function getAuthor(slug: string) {
  if (!getSupabaseUrl() || !getSupabasePublishableKey()) {
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

export default async function PublicAuthorPage({ params, searchParams }: AuthorPageProps) {
  const [{ slug }, queryParams] = await Promise.all([params, searchParams]);
  const author = await getAuthor(slug);
  if (!author) {
    notFound();
  }

  const supabase = await createClient();
  const authorId = author.id;
  const requestedPage = parsePage(queryParams.page);
  function buildPublicationsQuery() {
    return supabase.from("posts")
      .select("id, title, slug, category, content_type, excerpt, read_time, created_at, cover_image_url, cover_image_path", { count: "exact" })
      .eq("author_id", authorId)
      .eq("published", true)
      .eq("workflow_status", "published")
      .order("published_at", { ascending: false })
      .order("id");
  }
  const firstResult = await buildPublicationsQuery()
    .range((requestedPage - 1) * POSTS_PER_PAGE, requestedPage * POSTS_PER_PAGE - 1);
  if (firstResult.error) {
    throw new Error(`Unable to load the author's publications: ${firstResult.error.message}`);
  }
  const totalPublications = firstResult.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalPublications / POSTS_PER_PAGE));
  const page = Math.min(requestedPage, pageCount);
  const publicationRows = page === requestedPage
    ? firstResult.data ?? []
    : await (async () => {
        const correctedResult = await buildPublicationsQuery()
          .range((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE - 1);
        if (correctedResult.error) {
          throw new Error(`Unable to load the author's publications: ${correctedResult.error.message}`);
        }
        return correctedResult.data ?? [];
      })();

  const publications: PostCardData[] = await Promise.all(publicationRows.map(async (post) => {
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
        <p className="fine-print" role="status">
          Showing {totalPublications === 0 ? 0 : (page - 1) * POSTS_PER_PAGE + 1}–
          {Math.min(page * POSTS_PER_PAGE, totalPublications)} of {totalPublications} publications.
        </p>
        {publications.length > 0 ? (
          <>
            <div className="article-grid">
              {publications.map((post) => <ArticleCard key={post.id} post={post} />)}
            </div>
            <PublicationPagination
              path={`/authors/${encodeURIComponent(slug)}`}
              params={{}}
              page={page}
              pageCount={pageCount}
            />
          </>
        ) : (
          <div className="empty-research"><p>No public publications yet.</p></div>
        )}
      </section>
    </div>
  );
}
