import type { updateSiteSettings } from "@/app/admin/settings-actions";
import type { SiteSettings } from "@/lib/settings";

type SettingsFormProps = {
  action: typeof updateSiteSettings;
  settings: SiteSettings;
};

export default function SettingsForm({ action, settings }: SettingsFormProps) {
  return (
    <form action={action} className="admin-post-form">
      <label>
        Site title
        <input name="site_title" defaultValue={settings.siteTitle} maxLength={120} required />
      </label>
      <label>
        SEO description
        <textarea
          name="seo_description"
          defaultValue={settings.seoDescription}
          maxLength={320}
          rows={3}
          required
        />
      </label>
      <label>
        Public contact email
        <input name="contact_email" type="email" defaultValue={settings.contactEmail} maxLength={254} required />
      </label>
      <label>
        Public phone numbers (one per line, up to 5)
        <textarea name="contact_phones" defaultValue={settings.contactPhones.join("\n")} maxLength={170} rows={3} />
      </label>
      <label>
        Public location (leave blank to hide)
        <input name="contact_location" defaultValue={settings.contactLocation ?? ""} maxLength={160} />
      </label>
      <label>
        Social links (one per line as <code>Label | https://example.com</code>)
        <textarea
          name="social_links"
          defaultValue={settings.socialLinks.map((link) => `${link.label} | ${link.url}`).join("\n")}
          maxLength={17000}
          rows={4}
        />
      </label>
      <label>
        Optional homepage announcement (leave blank to hide)
        <textarea name="announcement" defaultValue={settings.announcement ?? ""} maxLength={240} rows={2} />
      </label>
      <button className="button" type="submit">Save website settings</button>
    </form>
  );
}
