import type { Metadata } from "next";
import "./globals.css";
import "./research.css";
import "./admin.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getSiteSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    title: settings.siteTitle,
    description: settings.seoDescription
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
        <Footer settings={settings} />
      </body>
    </html>
  );
}