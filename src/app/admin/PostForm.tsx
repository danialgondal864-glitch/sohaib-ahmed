import { RESEARCH_CATEGORIES } from "@/lib/posts";

type PostRecord = {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  content: string;
  verified_facts: string[];
  research_findings: string[];
  opinions: string[];
  proposed_solutions: string[];
  sources: unknown;
  read_time: number;
  published: boolean;
};

type PostFormProps = {
  action: (formData: FormData) => Promise<void>;
  post?: PostRecord;
};

function listValue(value: unknown): string {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").join("\n")
    : "";
}

export default function PostForm({ action, post }: PostFormProps) {
  const sources = Array.isArray(post?.sources)
    ? JSON.stringify(post.sources, null, 2)
    : "[]";

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
        Category
        <select name="category" defaultValue={post?.category || RESEARCH_CATEGORIES[0]} required>
          {RESEARCH_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
      <label>
        Summary
        <textarea name="excerpt" defaultValue={post?.excerpt} maxLength={500} rows={3} required />
      </label>
      <label>
        Article
        <textarea name="content" defaultValue={post?.content} maxLength={50000} rows={10} required />
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
      <label className="admin-checkbox">
        <input name="published" type="checkbox" defaultChecked={post?.published ?? false} />
        Publish this article
      </label>
      <button className="button" type="submit">{post ? "Save changes" : "Create article"}</button>
    </form>
  );
}
