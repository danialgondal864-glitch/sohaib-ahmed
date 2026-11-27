export const AUTHOR_SUBMISSION_FIELDS = [
  "id",
  "intent",
  "title",
  "slug",
  "content_type",
  "category",
  "subcategory_id",
  "excerpt",
  "content",
  "video_url",
  "audio_url",
  "cover_image_url",
  "cover_image_path",
  "duration_seconds",
  "tags",
  "seo_title",
  "seo_description",
  "verified_facts",
  "research_findings",
  "opinions",
  "proposed_solutions",
  "sources",
  "read_time"
] as const;

export type AuthorSubmissionField = (typeof AUTHOR_SUBMISSION_FIELDS)[number];
export type AuthorSubmissionValues = Partial<Record<AuthorSubmissionField, string>>;
export type AuthorSubmissionStatus = "idle" | "invalid" | "slug-taken" | "save-failed";

export type AuthorSubmissionState = {
  status: AuthorSubmissionStatus;
  values: AuthorSubmissionValues;
  revision: number;
};

export const INITIAL_AUTHOR_SUBMISSION_STATE: AuthorSubmissionState = {
  status: "idle",
  values: {},
  revision: 0
};
