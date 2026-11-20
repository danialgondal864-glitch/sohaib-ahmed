import type { SupabaseClient } from "@supabase/supabase-js";

export const AUTHOR_MEDIA_BUCKET = "author-submission-media";

export async function resolveCoverImageUrl(
  supabase: SupabaseClient,
  coverImageUrl: string | null,
  coverImagePath: string | null
): Promise<string | null> {
  if (!coverImagePath) {
    return coverImageUrl;
  }

  const { data, error } = await supabase.storage
    .from(AUTHOR_MEDIA_BUCKET)
    .createSignedUrl(coverImagePath, 300);
  if (error || !data?.signedUrl) {
    console.error("Unable to create a public cover image link.", error?.message ?? "No signed URL was returned.");
    throw new Error("Unable to load a publication cover image.");
  }
  return data.signedUrl;
}
