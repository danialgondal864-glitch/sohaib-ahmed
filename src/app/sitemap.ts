import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  return configuredUrl ? configuredUrl.replace(/\/+$/, "") : "https://sohaib-ahmed-five.vercel.app";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const routes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/projects`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/blogs`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/contact`, changeFrequency: "monthly", priority: 0.6 }
  ];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return routes;
  }

  const supabase = await createClient();
  const [{ data: posts, error: postsError }, { data: authors, error: authorsError }] = await Promise.all([
    supabase.from("posts")
      .select("slug, updated_at")
      .eq("published", true)
      .eq("workflow_status", "published"),
    supabase.from("author_profiles").select("author_slug")
  ]);
  if (postsError) {
    throw new Error(`Unable to load public publications for the sitemap: ${postsError.message}`);
  }
  if (authorsError) {
    throw new Error(`Unable to load public authors for the sitemap: ${authorsError.message}`);
  }

  for (const post of posts ?? []) {
    routes.push({
      url: `${siteUrl}/blogs/${post.slug}`,
      lastModified: post.updated_at,
      changeFrequency: "monthly",
      priority: 0.7
    });
  }
  for (const author of authors ?? []) {
    routes.push({
      url: `${siteUrl}/authors/${author.author_slug}`,
      changeFrequency: "monthly",
      priority: 0.5
    });
  }

  return routes;
}
