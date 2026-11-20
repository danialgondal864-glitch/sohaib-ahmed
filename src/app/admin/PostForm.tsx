import type { ResearchCategory } from "@/lib/categories";
import MarkdownEditor from "@/components/MarkdownEditor";

type PostRecord = {
  id: string;
  title: string;
  slug: string;
  category: string;
  subcategory_id: string | null;
  content_type: "article" | "video" | "podcast";
  excerpt: string;
  content: string;
  verified_facts: string[];
  research_findings: string[];
  opinions: string[];
  proposed_solutions: string[];
  sources: unknown;
  read_time: number;
  published: boolean;
  video_url: string | null;
  audio_url: string | null;
  cover_image_url: string | null;
  duration_seconds: number | null;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
};

type PostFormProps = {
  action: (formData: FormData) => Promise<void>;
  post?: PostRecord;
  categories: ResearchCategory[];
  isAdmin?: boolean;
};

function listValue(value: unknown): string {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").join("\n")
    : "";
}

export default function PostForm({ action, post, categories, isAdmin = true }: PostFormProps) {
  const sources = Array.isArray(post?.sources)
    ? JSON.stringify(post.sources, null, 2)
    : "[]";
  const selectableCategories = categories.filter((category) =>
    category.is_active || category.name === post?.category
  );

  return (
    <form action={action} className="admin-post-form">
      {post && <input type="hidden" name="id" value={post.id} />}
      <label>
        Title
        <input name="title" defaultValue={post?.title} maxLength={200} required />
      </label>
      <label>
        URL slug
        <input name="slug" defaultValue={post?.slug} maxLength={200} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
      </label>
      <label>
        Publication type
        <select name="content_type" defaultValue={post?.content_type ?? "article"} required>
          <option value="article">Article</option>
          <option value="video">Video</option>
          <option value="podcast">Podcast</option>
        </select>
      </label>
      <label>
        Category
        <select
          name="category"
          defaultValue={post?.category || selectableCategories[0]?.name}
          required
          disabled={selectableCategories.length === 0}
        >
          {selectableCategories.map((category) => (
            <option key={category.id} value={category.name}>
              {category.name}{category.content_type !== "all" ? ` · ${category.content_type}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label>
        Subcategory
        <select name="subcategory_id" defaultValue={post?.subcategory_id ?? ""}>
          <option value="">No subcategory</option>
          {categories.filter((item) => item.parent_id).map((item) => {
            const parent = categories.find((candidate) => candidate.id === item.parent_id);
            return (
              <option key={item.id} value={item.id}>
                {parent ? `${parent.name} / ` : ""}{item.name}
              </option>
            );
          })}
        </select>
      </label>
      <label>
        Summary
        <textarea name="excerpt" defaultValue={post?.excerpt} maxLength={500} rows={3} required />
      </label>
      <label>
        Article body or show notes
        <MarkdownEditor name="content" initialValue={post?.content} maxLength={50000} rows={10} required />
      </label>
      <label>
        Video URL (YouTube or Vimeo)
        <input name="video_url" type="url" defaultValue={post?.video_url ?? ""} maxLength={2048} />
      </label>
      <label>
        Podcast audio URL
        <input name="audio_url" type="url" defaultValue={post?.audio_url ?? ""} maxLength={2048} />
      </label>
      <label>
        Cover image URL
        <input name="cover_image_url" type="url" defaultValue={post?.cover_image_url ?? ""} maxLength={2048} />
      </label>
      <label>
        Duration in seconds (video or podcast)
        <input
          name="duration_seconds"
          type="number"
          min={1}
          max={86400}
          defaultValue={post?.duration_seconds ?? ""}
        />
      </label>
      <label>
        Tags (comma-separated)
        <input name="tags" defaultValue={post?.tags?.join(", ")} maxLength={1200} />
      </label>
      <label>
        SEO title
        <input name="seo_title" defaultValue={post?.seo_title ?? ""} maxLength={120} />
      </label>
      <label>
        SEO description
        <textarea name="seo_description" defaultValue={post?.seo_description ?? ""} maxLength={320} rows={2} />
      </label>
      <label>
        Verified facts (one per line)
        <textarea name="verified_facts" defaultValue={listValue(post?.verified_facts)} rows={4} />
      </label>
      <label>
        Research findings (one per line)
        <textarea name="research_findings" defaultValue={listValue(post?.research_findings)} rows={4} />
      </label>
      <label>
        Opinions (one per line)
        <textarea name="opinions" defaultValue={listValue(post?.opinions)} rows={4} />
      </label>
      <label>
        Proposed solutions (one per line)
        <textarea name="proposed_solutions" defaultValue={listValue(post?.proposed_solutions)} rows={4} />
      </label>
      <label>
        Sources (JSON array with title, URL, and optional published_at)
        <textarea name="sources" defaultValue={sources} rows={5} required />
      </label>
      <label>
        Estimated reading time in minutes
        <input
          name="read_time"
          type="number"
          min={1}
          max={120}
          defaultValue={post?.read_time ?? 5}
          required
        />
      </label>
      {isAdmin ? (
        <>
          <label className="admin-checkbox">
            <input name="published" type="checkbox" defaultChecked={post?.published ?? false} />
            Publish now (administrator override)
          </label>
          <button className="button" type="submit" disabled={selectableCategories.length === 0}>
            {post ? "Save changes" : "Create publication"}
          </button>
        </>
      ) : (
        <div className="author-form-actions">
          <button className="button button-ghost" type="submit" name="intent" value="draft">
            Save draft
          </button>
          <button className="button" type="submit" name="intent" value="submit">
            Submit for review
          </button>
        </div>
      )}
    </form>
  );
}
