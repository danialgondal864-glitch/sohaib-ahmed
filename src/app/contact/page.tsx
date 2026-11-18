import { profile } from "@/lib/data";
import ContactForm from "./ContactForm";

export default function Contact() {
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
          <p><span className="muted">EMAIL</span><br /><a href={`mailto:${profile.email}`}>{profile.email}</a></p>
          <p><span className="muted">PHONE</span><br />{profile.phones.join(" · ")}</p>
          <p><span className="muted">LOCATION</span><br />{profile.location}</p>
          <p className="fine-print">Contact details are displayed from the CV supplied for this portfolio.</p>
        </div>
        <ContactForm contactEmail={profile.email} />
      </div>
    </div>
  );
}
