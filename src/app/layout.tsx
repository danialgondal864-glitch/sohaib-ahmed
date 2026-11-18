import type { Metadata } from "next";
import "./globals.css";
import "./research.css";
import "./admin.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
export const metadata: Metadata = { title: "Sohaib Ahmed | Cloud, DevOps & Infrastructure", description: "Personal portfolio of Sohaib Ahmed — Linux, cloud infrastructure, DevOps and technology research." };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body><Header/><main>{children}</main><Footer/></body></html>; }