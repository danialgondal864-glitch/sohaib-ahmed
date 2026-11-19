"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";

function getText(formData: FormData, name: string, maxLength: number): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
}

function parsePhones(value: string): string[] | null {
  const phones = value.split(/\r?\n/).map((phone) => phone.trim()).filter(Boolean);
  return phones.length <= 5 && phones.every((phone) =>
    phone.length <= 32 && /^[+()\d.\-\s]+$/.test(phone)
  ) ? phones : null;
}

function parseSocialLinks(value: string): Array<{ label: string; url: string }> | null {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 8) {
    return null;
  }

  const links: Array<{ label: string; url: string }> = [];
  for (const line of lines) {
    const separator = line.indexOf("|");
    if (separator <= 0) {
      return null;
    }
    const label = line.slice(0, separator).trim();
    const rawUrl = line.slice(separator + 1).trim();
    if (!label || label.length > 40 || rawUrl.length > 2048) {
      return null;
    }
    try {
      const url = new URL(rawUrl);
      if (
        (url.protocol !== "https:" && url.protocol !== "http:") ||
        !url.hostname ||
        url.username ||
        url.password
      ) {
        return null;
      }
      if (links.some((link) =>
        link.label.toLowerCase() === label.toLowerCase() ||
        link.url.toLowerCase() === url.toString().toLowerCase()
      )) {
        return null;
      }
      links.push({ label, url: url.toString() });
    } catch {
      return null;
    }
  }
  return links;
}

export async function updateSiteSettings(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const siteTitle = getText(formData, "site_title", 120);
  const seoDescription = getText(formData, "seo_description", 320);
  const contactEmail = getText(formData, "contact_email", 254);
  const phonesText = formData.get("contact_phones");
  const locationValue = formData.get("contact_location");
  const socialLinksText = formData.get("social_links");
  const announcementValue = formData.get("announcement");

  if (
    !siteTitle ||
    !seoDescription ||
    !contactEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) ||
    typeof phonesText !== "string" ||
    phonesText.length > 170 ||
    typeof locationValue !== "string" ||
    locationValue.trim().length > 160 ||
    typeof socialLinksText !== "string" ||
    socialLinksText.length > 17000 ||
    typeof announcementValue !== "string" ||
    announcementValue.trim().length > 240
  ) {
    redirect("/admin?status=settings-invalid#settings");
  }

  const contactPhones = parsePhones(phonesText);
  const socialLinks = parseSocialLinks(socialLinksText);
  if (!contactPhones || !socialLinks) {
    redirect("/admin?status=settings-invalid#settings");
  }

  const { data, error } = await supabase
    .from("site_settings")
    .update({
      site_title: siteTitle,
      seo_description: seoDescription,
      contact_email: contactEmail,
      contact_phones: contactPhones,
      contact_location: locationValue.trim() || null,
      social_links: socialLinks,
      announcement: announcementValue.trim() || null,
      updated_by: user.id
    })
    .eq("id", 1)
    .select("id")
    .single();
  if (error || !data) {
    console.error("Unable to update website settings.", error?.code ?? "no_row_returned");
    redirect("/admin?status=settings-failed#settings");
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin");
  redirect("/admin?status=settings-updated#settings");
}
