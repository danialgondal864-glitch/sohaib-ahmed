import { notFound } from "next/navigation";
import Link from "next/link";
import BookmarkButton from "@/components/BookmarkButton";
import { createClient } from "@/lib/supabase/server";

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

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    notFound();
  }

  const supabase = await createClient();
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
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

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    throw new Error(`Unable to verify your account: ${authError.message}`);
  }

  const verifiedFacts = readTextList(post.verified_facts);
  const findings = readTextList(post.research_findings);
  const opinions = readTextList(post.opinions);
  const proposals = readTextList(post.proposed_solutions);
  const { sources, invalidCount: invalidSources } = readSources(post.sources);

  return (
    <article className="article-page container">
      <p className="eyebrow">{post.category || "RESEARCH"} · {post.read_time || 5} MIN READ</p>
      <h1>{post.title}</h1>
      <p className="article-excerpt">{post.excerpt}</p>
      {user ? (
        <BookmarkButton postId={post.id} userId={user.id} />
      ) : (
        <p className="fine-print"><Link className="text-link" href="/login">Log in to save this article.</Link></p>
      )}
      <ResearchSection title="Verified facts" items={verifiedFacts} />
      <ResearchSection title="Research findings" items={findings} />
      <ResearchSection title="Opinions" items={opinions} />
      <ResearchSection title="Proposed solutions" items={proposals} />
      <div className="article-content">
        <h2>Article</h2>
        {post.content}
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
        <p className="error" role="note">Some source entries could not be displayed. Review their titles and HTTP(S) links.</p>
      )}
      {(verifiedFacts.length > 0 || findings.length > 0) && sources.length === 0 && (
        <p className="error" role="note">This article has factual research sections but no source links are attached yet.</p>
      )}
      <p className="fine-print">Research facts, findings, opinions, and proposed solutions are labeled separately. Sources are listed for verification.</p>
    </article>
  );
}
