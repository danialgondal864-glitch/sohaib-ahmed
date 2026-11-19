import Link from "next/link";
import type { SiteSettings } from "@/lib/settings";

export default function Footer({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <Link className="brand" href="/">
            <span className="brand-mark">SA</span>
            <span>SOHAIB<span className="accent">.</span></span>
          </Link>
          <p>Cloud · DevOps · Infrastructure</p>
        </div>
        <div className="footer-links">
          <Link href="/about">About</Link>
          <Link href="/blogs">Research</Link>
          <Link href="/contact">Contact</Link>
          <a href={`mailto:${settings.contactEmail}`}>Email</a>
          {settings.socialLinks.map((link) => (
            <a href={link.url} key={link.label} target="_blank" rel="noopener noreferrer">
              {link.label}
            </a>
          ))}
        </div>
        <small>© {new Date().getFullYear()} Sohaib Ahmed. Built with curiosity.</small>
      </div>
    </footer>
  );
}