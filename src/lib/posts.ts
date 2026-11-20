export type PostCardData = {
  id: string;
  title: string;
  slug: string;
  category: string;
  subcategory?: string | null;
  content_type?: "article" | "video" | "podcast";
  excerpt: string;
  read_time: number;
  created_at: string;
  duration_seconds?: number | null;
  cover_image_url?: string | null;
  cover_image_path?: string | null;
  tags?: string[];
  author_name?: string | null;
  author_slug?: string | null;
};
