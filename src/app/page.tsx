import Link from "next/link";
import { ArrowUpRight, Cloud, Server, ShieldCheck, GitBranch, Terminal, Cpu } from "lucide-react";
import { profile } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/settings";
import ArticleCard from "@/components/ArticleCard";
import type { PostCardData } from "@/lib/posts";

export default async function Home() {
  const settings = await getSiteSettings();
  let posts: PostCardData[] = [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("posts")
      .select("id, title, slug, category, content_type, excerpt, read_time, created_at, cover_image_url, duration_seconds, tags")
      .eq("published", true)
      .eq("workflow_status", "published")
      .order("published_at", { ascending: false })
      .limit(3);

    if (error) {
      console.error("Unable to load home page publications.", error.code);
    } else {
      posts = data ?? [];
    }
  } catch (error) {
    console.error(
      "Unable to initialize home page publications.",
      error instanceof Error ? error.message : "unknown_error"
    );
  }

  const icons = [Cloud, Server, ShieldCheck, GitBranch, Terminal, Cpu];

  return (
    <>
      <section className="hero">
        <div className="hero-grid" />
        <div className="container hero-content">
          <div className="hero-copy">
            <span className="status"><i /> OPEN TO OPPORTUNITIES</span>
            {settings.announcement && (
              <p className="hero-announcement" role="note">{settings.announcement}</p>
            )}
            <p className="eyebrow">COMPUTER SCIENCE · CLOUD · DEVOPS</p>
            <h1>Engineering the<br /><span className="gradient-text">digital foundation.</span></h1>
            <p className="hero-lead">{profile.summary}</p>
            <div className="hero-actions">
              <Link className="button" href="/projects">
                Explore my work <ArrowUpRight size={17} />
              </Link>
              <Link className="button button-ghost" href="/contact">Let’s connect</Link>
            </div>
            <div className="hero-meta">
              <span>📍 Sargodha, Pakistan</span>
              <span>Linux · Cloud · Infrastructure</span>
            </div>
          </div>
          <div className="terminal-card">
            <div className="terminal-head">
              <div className="dots"><i /><i /><i /></div>
              <span>sohaib@cloud:~</span>
              <span>•••</span>
            </div>
            <div className="terminal-body">
              <p className="terminal-muted"># a little about my approach</p>
              <p><b>const</b> engineer = {"{"}</p>
              <p className="indent"><em>focus</em>: <strong>{'"Reliable systems"'}</strong>,</p>
              <p className="indent"><em>interests</em>: [</p>
              <p className="indent2">{'"Linux", "Cloud",'}</p>
              <p className="indent2">{'"DevOps", "Automation"'}</p>
              <p className="indent">],</p>
              <p className="indent"><em>mindset</em>: <strong>{'"Always learning"'}</strong></p>
              <p>{"}"};</p>
              <div className="terminal-prompt">
                <span>➜</span> ready_to_build<span className="cursor">_</span>
              </div>
            </div>
            <div className="terminal-foot">
              <span><i /> SYSTEMS THINKING</span>
              <span>01 / 04</span>
            </div>
          </div>
        </div>
        <div className="hero-bottom container">
          <span>SCROLL TO EXPLORE</span>
          <span className="line" />
        </div>
      </section>

      <section className="section container">
        <div className="section-heading">
          <div>
            <p className="eyebrow">WHAT I WORK WITH</p>
            <h2>Technology with <span className="gradient-text">purpose.</span></h2>
          </div>
          <p className="section-note">
            Building a strong foundation across systems, infrastructure and modern development practices.
          </p>
        </div>
        <div className="skill-grid">
          {profile.skills.slice(0, 6).map((skill, index) => {
            const Icon = icons[index];
            return (
              <div className="skill-card" key={skill.group}>
                <Icon />
                <h3>{skill.group}</h3>
                <p>{skill.items.slice(0, 4).join(" · ")}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SELECTED EXPERIENCE</p>
              <h2>Work in <span className="gradient-text">practice.</span></h2>
            </div>
            <Link className="text-link" href="/projects">All projects ↗</Link>
          </div>
          <Link className="project-feature" href="/projects">
            <div className="project-visual">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="server-stack">
                <Server size={58} />
                <span>OCI · LINUX VM</span>
              </div>
            </div>
            <div className="project-info">
              <span className="eyebrow">CLOUD DEPLOYMENT · INFRASTRUCTURE</span>
              <h3>{profile.project.title}</h3>
              <p>{profile.project.description}</p>
              <div className="tag-row">
                {profile.project.stack.map((item) => <span key={item}>{item}</span>)}
              </div>
              <span className="text-link">View project details ↗</span>
            </div>
          </Link>
        </div>
      </section>

      <section className="section container">
        <div className="section-heading">
          <div>
            <p className="eyebrow">IDEAS, RESEARCH & DISCOVERY</p>
            <h2>Stay curious. <span className="gradient-text">Keep exploring.</span></h2>
          </div>
          <Link className="text-link" href="/blogs">Visit the knowledge hub ↗</Link>
        </div>
        {posts.length > 0 ? (
          <div className="article-grid">
            {posts.map((post) => <ArticleCard key={post.id} post={post} />)}
          </div>
        ) : (
          <div className="empty-research">
            <div className="empty-icon"><Cpu /></div>
            <div>
              <h3>The research desk is taking shape.</h3>
              <p>
                Explore practical notes on AI tools, emerging technologies, cloud infrastructure and
                solution-driven engineering.
              </p>
            </div>
            <Link className="text-link" href="/blogs">Explore research topics ↗</Link>
          </div>
        )}
      </section>

      <section className="cta-section container">
        <div>
          <p className="eyebrow">HAVE A PROJECT OR AN IDEA?</p>
          <h2>Let’s build something<br /><span className="gradient-text">meaningful.</span></h2>
        </div>
        <Link className="button" href="/contact">Start a conversation <ArrowUpRight /></Link>
      </section>
    </>
  );
}
