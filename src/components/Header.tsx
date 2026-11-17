"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, X, Terminal } from "lucide-react";

const links = [["Home","/"],["About","/about"],["Projects","/projects"],["Research & Blogs","/blogs"],["Contact","/contact"]];
export default function Header() {
  const [open,setOpen] = useState(false);
  return <header className="site-header"><div className="nav-wrap">
    <Link className="brand" href="/"><span className="brand-mark"><Terminal size={19}/></span><span>SOHAIB<span className="accent">.</span></span></Link>
    <nav className={open ? "nav-links show" : "nav-links"}>{links.map(([n,h])=><Link key={h} href={h} onClick={()=>setOpen(false)}>{n}</Link>)}</nav>
    <div className="nav-actions"><Link className="login-link" href="/login">Log in</Link><Link className="button button-small" href="/signup">Get started <span>↗</span></Link></div>
    <button className="menu-toggle" aria-label="Toggle menu" onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button>
  </div></header>;
}