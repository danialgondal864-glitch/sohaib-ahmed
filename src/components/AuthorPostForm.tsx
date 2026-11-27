"use client";

import { useActionState } from "react";
import type { ResearchCategory } from "@/lib/categories";
import AuthorMediaUpload from "@/components/AuthorMediaUpload";
import MarkdownEditor from "@/components/MarkdownEditor";
import { saveSubmission } from "@/app/author/actions";
import {
  INITIAL_AUTHOR_SUBMISSION_STATE,
  type AuthorSubmissionField,
  type AuthorSubmissionStatus
} from "@/lib/author-submission-state";

type AuthorPostRecord = {
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
  video_url: string | null;
  audio_url: string | null;
  cover_image_url: string | null;
  cover_image_path: string | null;
  duration_seconds: number | null;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
};

type AuthorPostFormProps = {
  post?: AuthorPostRecord;
  categories: ResearchCategory[];
  userId: string;
  errorMessages: Record<Exclude<AuthorSubmissionStatus, "idle">, string>;
};

function listValue(value: unknown): string {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").join("\n")
    : "";
}

export default function AuthorPostForm({
  post,
  categories,
  userId,
  errorMessages
}: AuthorPostFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveSubmission,
    INITIAL_AUTHOR_SUBMISSION_STATE
  );
  const selectableCategories = categories.filter((category) =>
    category.is_active || category.name === post?.category
  );
  const fieldValue = (field: AuthorSubmissionField, fallback = "") =>
    state.revision > 0 && Object.prototype.hasOwnProperty.call(state.values, field)
      ? state.values[field] ?? ""
      : fallback;
  const errorMessage = state.status === "idle" ? "" : errorMessages[state.status];
  const sources = Array.isArray(post?.sources)
    ? JSON.stringify(post.sources, null, 2)
    : "[]";

  return (
    <form action={formAction} className="admin-post-form" key={state.revision}>
      {post && <input type="hidden" name="id" value={fieldValue("id", post.id)} />}
      <label>
        Title
        <input name="title" defaultValue={fieldValue("title", post?.title ?? "")} maxLength={200} required />
      </label>
      <label>
        URL slug
        <input
          name="slug"
          defaultValue={fieldValue("slug", post?.slug ?? "")}
          maxLength={200}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          required
        />
      </label>
      <label>
        Publication type
        <select name="content_type" defaultValue={fieldValue("content_type", post?.content_type ?? "article")} required>
          <option value="article">Article</option>
          <option value="video">Video</option>
          <option value="podcast">Podcast</option>
        </select>
      </label>
      <label>
        Category
        <select
          name="category"
          defaultValue={fieldValue("category", post?.category || selectableCategories[0]?.name || "")}
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
        <select name="subcategory_id" defaultValue={fieldValue("subcategory_id", post?.subcategory_id ?? "")}>
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
        <textarea name="excerpt" defaultValue={fieldValue("excerpt", post?.excerpt ?? "")} maxLength={500} rows={3} required />
      </label>
      <label>
        Article body or show notes
        <MarkdownEditor
          name="content"
          initialValue={fieldValue("content", post?.content ?? "")}
          maxLength={50000}
          rows={10}
          required
        />
      </label>
      <label>
        Video URL (YouTube or Vimeo)
        <input name="video_url" type="url" defaultValue={fieldValue("video_url", post?.video_url ?? "")} maxLength={2048} />
      </label>
      <label>
        Podcast audio URL
        <input name="audio_url" type="url" defaultValue={fieldValue("audio_url", post?.audio_url ?? "")} maxLength={2048} />
      </label>
      <label>
        Cover image URL (optional)
        <input name="cover_image_url" type="url" defaultValue={fieldValue("cover_image_url", post?.cover_image_url ?? "")} maxLength={2048} />
      </label>
      <AuthorMediaUpload
        userId={userId}
        initialPath={fieldValue("cover_image_path", post?.cover_image_path ?? "")}
      />
      <label>
        Duration in seconds (video or podcast)
        <input
          name="duration_seconds"
          type="number"
          min={1}
          max={86400}
          defaultValue={fieldValue("duration_seconds", post?.duration_seconds?.toString() ?? "")}
        />
      </label>
      <label>
        Tags (comma-separated)
        <input name="tags" defaultValue={fieldValue("tags", post?.tags?.join(", ") ?? "")} maxLength={1200} />
      </label>
      <label>
        SEO title
        <input name="seo_title" defaultValue={fieldValue("seo_title", post?.seo_title ?? "")} maxLength={120} />
      </label>
      <label>
        SEO description
        <textarea name="seo_description" defaultValue={fieldValue("seo_description", post?.seo_description ?? "")} maxLength={320} rows={2} />
      </label>
      <label>
        Verified facts (one per line)
        <textarea name="verified_facts" defaultValue={fieldValue("verified_facts", listValue(post?.verified_facts))} rows={4} />
      </label>
      <label>
        Research findings (one per line)
        <textarea name="research_findings" defaultValue={fieldValue("research_findings", listValue(post?.research_findings))} rows={4} />
      </label>
      <label>
        Opinions (one per line)
        <textarea name="opinions" defaultValue={fieldValue("opinions", listValue(post?.opinions))} rows={4} />
      </label>
      <label>
        Proposed solutions (one per line)
        <textarea name="proposed_solutions" defaultValue={fieldValue("proposed_solutions", listValue(post?.proposed_solutions))} rows={4} />
      </label>
      <label>
        Sources (JSON array with title, URL, and optional published_at)
        <textarea name="sources" defaultValue={fieldValue("sources", sources)} rows={5} required />
      </label>
      <label>
        Estimated reading time in minutes
        <input
          name="read_time"
          type="number"
          min={1}
          max={120}
          defaultValue={fieldValue("read_time", post?.read_time?.toString() ?? "5")}
          required
        />
      </label>
      {errorMessage && <p className="error" role="alert">{errorMessage}</p>}
      {state.status === "idle" && isPending && <p className="muted" role="status">Saving publication...</p>}
      <div className="author-form-actions">
        <button className="button button-ghost" type="submit" name="intent" value="draft" disabled={isPending}>
          Save draft
        </button>
        <button className="button" type="submit" name="intent" value="submit" disabled={isPending}>
          Submit for review
        </button>
      </div>
    </form>
  );
}
