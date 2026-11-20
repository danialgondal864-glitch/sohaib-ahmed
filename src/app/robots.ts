import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://sohaib-ahmed-five.vercel.app")
    .replace(/\/+$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/blogs/", "/authors/"],
      disallow: ["/admin", "/author", "/dashboard", "/login", "/signup", "/api/"]
    },
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
