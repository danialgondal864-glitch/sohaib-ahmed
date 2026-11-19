import { getSiteSettings } from "@/lib/settings";
import ContactForm from "./ContactForm";

export default async function Contact() {
  const settings = await getSiteSettings();
  return (
    <div className="page-shell container">
      <div className="page-intro">
        <p className="eyebrow">CONTACT</p>
        <h1>Good things start<br /><span className="gradient-text">with a conversation.</span></h1>
        <p>For professional opportunities, technical discussions or collaboration, get in touch.</p>
      </div>
      <div className="contact-grid">
        <div className="panel contact-details">
          <p className="eyebrow">CONTACT DETAILS</p>
          <h2>Let&apos;s connect.</h2>
          <p><span className="muted">EMAIL</span><br /><a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a></p>
          {settings.contactPhones.length > 0 && (
            <p><span className="muted">PHONE</span><br />{settings.contactPhones.join(" · ")}</p>
          )}
          {settings.contactLocation && (
            <p><span className="muted">LOCATION</span><br />{settings.contactLocation}</p>
          )}
          <p className="fine-print">Public contact details can be updated in the administrator settings.</p>
        </div>
        <ContactForm contactEmail={settings.contactEmail} />
      </div>
    </div>
  );
}
