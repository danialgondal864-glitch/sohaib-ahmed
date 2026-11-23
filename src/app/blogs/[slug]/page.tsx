import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import BookmarkButton from "@/components/BookmarkButton";
import MarkdownContent from "@/components/MarkdownContent";
import ReportContentForm from "@/app/blogs/ReportContentForm";
import { createClient } from "@/lib/supabase/server";
import { resolveCoverImageUrl } from "@/lib/author-media";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/public-env";

type ResearchSource = {
  title: string;
  url: string;
  publishedAt?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTextList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

function readSources(value: unknown): { sources: ResearchSource[]; invalidCount: number } {
  if (!Array.isArray(value)) {
    return { sources: [], invalidCount: value == null ? 0 : 1 };
  }

  const sources: ResearchSource[] = [];
  let invalidCount = 0;

  for (const item of value) {
    if (!isRecord(item) || typeof item.title !== "string" || typeof item.url !== "string") {
      invalidCount++;
      continue;
    }

    try {
      const url = new URL(item.url);
      if (
        (url.protocol !== "https:" && url.protocol !== "http:") ||
        url.username ||
        url.password
      ) {
        invalidCount++;
        continue;
      }

      const source: ResearchSource = { title: item.title.trim(), url: url.toString() };
      if (item.published_at !== undefined) {
        const publishedAtValue = item.published_at;
        if (
          typeof publishedAtValue === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(publishedAtValue)
        ) {
          const publishedAt = new Date(`${publishedAtValue}T00:00:00.000Z`);
          if (
            !Number.isNaN(publishedAt.getTime()) &&
            publishedAt.toISOString().slice(0, 10) === publishedAtValue
          ) {
            source.publishedAt = publishedAtValue;
          } else {
            invalidCount++;
          }
        } else {
          invalidCount++;
        }
      }
      if (source.title) {
        sources.push(source);
      } else {
        invalidCount++;
      }
    } catch {
      invalidCount++;
    }
  }

  return { sources, invalidCount };
}

function ResearchSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="research-section">
      <h2>{title}</h2>
      <ul>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul>
    </section>
  );
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!getSupabaseUrl() || !getSupabasePublishableKey()) {
    return {};
  }
  const supabase = await createClient();
  const { data: post, error } = await supabase.from("posts")
    .select("title, excerpt, content_type, seo_title, seo_description")
    .eq("slug", slug)
    .eq("published", true)
    .eq("workflow_status", "published")
    .maybeSingle();
  if (error) {
    throw new Error(`Unable to load publication metadata: ${error.message}`);
  }
  if (!post) {
    return {};
  }
  const title = post.seo_title || post.title;
  const description = post.seo_description || post.excerpt;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: post.content_type === "article" ? "article" : "website"
    }
  };
}

export default async function BlogPost({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ report?: string }>;
}) {
  const [{ slug }, { report }] = await Promise.all([params, searchParams]);
  if (!getSupabaseUrl() || !getSupabasePublishableKey()) {
    notFound();
  }

  const supabase = await createClient();
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .eq("workflow_status", "published")
    .single();

  if (postError?.code === "PGRST116") {
    notFound();
  }
  if (postError) {
    throw new Error(`Unable to load research article: ${postError.message}`);
  }
  if (!post) {
    notFound();
  }
  const coverImageUrl = await resolveCoverImageUrl(supabase, post.cover_image_url, post.cover_image_path);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    throw new Error(`Unable to verify your account: ${authError.message}`);
  }

  const verifiedFacts = readTextList(post.verified_facts);
  const findings = readTextList(post.research_findings);
  const opinions = readTextList(post.opinions);
  const proposals = readTextList(post.proposed_solutions);
  const { sources, invalidCount: invalidSources } = readSources(post.sources);
  const contentType = post.content_type ?? "article";
  const { data: author, error: authorError } = post.author_id
    ? await supabase.from("author_profiles")
        .select("display_name, author_slug")
        .eq("id", post.author_id)
        .maybeSingle()
    : { data: null, error: null };
  if (authorError) {
    throw new Error(`Unable to load publication author: ${authorError.message}`);
  }
  const { data: subcategory, error: subcategoryError } = post.subcategory_id
    ? await supabase.from("categories")
        .select("name")
        .eq("id", post.subcategory_id)
        .maybeSingle()
    : { data: null, error: null };
  if (subcategoryError) {
    throw new Error(`Unable to load publication subcategory: ${subcategoryError.message}`);
  }

  return (
    <article className="article-page container">
      <p className="eyebrow">
        {post.category || "RESEARCH"}{subcategory?.name ? ` / ${subcategory.name}` : ""} · {contentType.toUpperCase()}
        {contentType === "article" ? ` · ${post.read_time || 5} MIN READ` : ""}
      </p>
      <h1>{post.title}</h1>
      <p className="article-excerpt">{post.excerpt}</p>
      {coverImageUrl && (
        <Image
          className="publication-cover publication-cover-detail"
          src={coverImageUrl}
          alt=""
          width={1200}
          height={675}
          priority
          unoptimized
        />
      )}
      {author?.author_slug && (
        <p className="fine-print">
          By <Link className="text-link" href={`/authors/${author.author_slug}`}>{author.display_name}</Link>
        </p>
      )}
      {user ? (
        <BookmarkButton postId={post.id} userId={user.id} />
      ) : (
        <p className="fine-print"><Link className="text-link" href="/login">Log in to save this publication.</Link></p>
      )}
      {contentType === "video" && post.video_url && (
        <section className="research-section">
          <h2>Watch this video</h2>
          <a className="button" href={post.video_url} target="_blank" rel="noopener noreferrer">
            Open video on its hosting platform ↗
          </a>
        </section>
      )}
      {contentType === "podcast" && post.audio_url && (
        <section className="research-section">
          <h2>Listen to this episode</h2>
          <audio controls preload="none" src={post.audio_url}>
            <a href={post.audio_url}>Download or open the audio</a>
          </audio>
          {post.duration_seconds && (
            <p className="fine-print">Duration: {Math.floor(post.duration_seconds / 60)} minutes</p>
          )}
        </section>
      )}
      <ResearchSection title="Verified facts" items={verifiedFacts} />
      <ResearchSection title="Research findings" items={findings} />
      <ResearchSection title="Opinions" items={opinions} />
      <ResearchSection title="Proposed solutions" items={proposals} />
      <div className="article-content">
        <h2>{contentType === "article" ? "Article" : "Show notes"}</h2>
        <MarkdownContent source={post.content} />
      </div>
      {sources.length > 0 && (
        <section className="research-section">
          <h2>Sources</h2>
          <ol>
            {sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
                {source.publishedAt && <span className="muted"> · Published {source.publishedAt}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
      {invalidSources > 0 && (
        <p className="error" role="note">Some source entries or metadata could not be displayed. Review their titles, dates, and HTTP(S) links.</p>
      )}
      {(verifiedFacts.length > 0 || findings.length > 0) && sources.length === 0 && (
        <p className="error" role="note">This article has factual research sections but no source links are attached yet.</p>
      )}
      <p className="fine-print">Research facts, findings, opinions, and proposed solutions are labeled separately. Sources are listed for verification.</p>
      {report === "reported" && <p className="success" role="status">Thank you. Your report was sent to the administrators.</p>}
      {report === "already-reported" && <p className="fine-print" role="status">You have already sent a report for this reason.</p>}
      {report === "report-failed" && <p className="error" role="status">The report could not be sent. Please try again later.</p>}
      <section className="research-section">
        <h2>Report this publication</h2>
        {user ? (
          <ReportContentForm postId={post.id} />
        ) : (
          <p><Link className="text-link" href="/login">Log in to report a concern.</Link></p>
        )}
      </section>
    </article>
  );
}
