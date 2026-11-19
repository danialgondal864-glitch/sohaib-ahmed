import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SocialLink = {
  label: string;
  url: string;
};

export type SiteSettings = {
  siteTitle: string;
  seoDescription: string;
  contactEmail: string;
  contactPhones: string[];
  contactLocation: string | null;
  socialLinks: SocialLink[];
  announcement: string | null;
};

type SiteSettingsRow = {
  id: 1;
  site_title: string;
  seo_description: string;
  contact_email: string;
  contact_phones: string[];
  contact_location: string | null;
  social_links: SocialLink[];
  announcement: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSocialLink(value: unknown): value is SocialLink {
  if (
    !isRecord(value) ||
    typeof value.label !== "string" ||
    value.label.trim().length === 0 ||
    value.label.length > 40 ||
    typeof value.url !== "string" ||
    value.url.length > 2048
  ) {
    return false;
  }
  try {
    const url = new URL(value.url);
    return Boolean(value.label.trim()) &&
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password;
  } catch {
    return false;
  }
}

function isSettingsRecord(value: unknown): value is SiteSettingsRow {
  return isRecord(value) &&
    value.id === 1 &&
    typeof value.site_title === "string" &&
    value.site_title.length > 0 &&
    value.site_title.length <= 120 &&
    typeof value.seo_description === "string" &&
    value.seo_description.length > 0 &&
    value.seo_description.length <= 320 &&
    typeof value.contact_email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.contact_email) &&
    Array.isArray(value.contact_phones) &&
    value.contact_phones.length <= 5 &&
    value.contact_phones.every((phone) =>
      typeof phone === "string" &&
      phone.length > 0 &&
      phone.length <= 32 &&
      /^[+()\d.\-\s]+$/.test(phone)
    ) &&
    (value.contact_location === null ||
      typeof value.contact_location === "string" && value.contact_location.length <= 160) &&
    Array.isArray(value.social_links) &&
    value.social_links.length <= 8 &&
    value.social_links.every(isSocialLink) &&
    (value.announcement === null ||
      typeof value.announcement === "string" && value.announcement.length <= 240);
}

export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("id, site_title, seo_description, contact_email, contact_phones, contact_location, social_links, announcement")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load website settings: ${error.message}`);
  }
  const row: unknown = data;
  if (!isSettingsRecord(row)) {
    throw new Error("Website settings are missing or contain invalid data.");
  }

  return {
    siteTitle: row.site_title,
    seoDescription: row.seo_description,
    contactEmail: row.contact_email,
    contactPhones: row.contact_phones,
    contactLocation: row.contact_location,
    socialLinks: row.social_links,
    announcement: row.announcement
  };
});
