import "./projects.css";
import { ArrowUpRight, Cloud, Network, Server, Terminal } from "lucide-react";
import { profile } from "@/lib/data";
import { isProjectContent, type ProjectContent } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";

const cvProject: ProjectContent = {
  title: profile.project.title,
  slug: "bus-tracking-system-cloud-deployment",
  project_url: null,
  summary: profile.project.description,
  description: profile.project.description,
  stack: profile.project.stack,
  featured: true,
  published: true,
  sort_order: 0
};

async function getProjects(): Promise<{ projects: ProjectContent[]; usingCvProject: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("title, slug, project_url, summary, description, stack, featured, published, sort_order")
    .eq("published", true)
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error && error.code !== "PGRST205" && error.code !== "42P01") {
    throw new Error(`Unable to load portfolio projects: ${error.message}`);
  }

  const projectRows: unknown = data ?? [];
  if (!Array.isArray(projectRows) || !projectRows.every(isProjectContent)) {
    throw new Error("The portfolio projects table returned invalid data.");
  }
  const projects = projectRows;
  return projects.length > 0
    ? { projects, usingCvProject: false }
    : { projects: [cvProject], usingCvProject: true };
}

export default async function Projects() {
  const { projects, usingCvProject } = await getProjects();
  const includesBusTracking = projects.some((project) =>
    project.slug === "bus-tracking-system-cloud-deployment"
  );

  return (
    <div className="page-shell container">
      <div className="page-intro">
        <p className="eyebrow">PROJECTS & TECHNICAL PORTFOLIO</p>
        <h1>Learning by <span className="gradient-text">building.</span></h1>
        <p>
          Selected practical work and infrastructure experience. Project details are based on the supplied CV
          and information approved for publication.
        </p>
      </div>

      <div className="project-list">
        {projects.map((project) => (
          <article className="project-detail panel" key={project.slug}>
            <div className="project-visual project-visual-large">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="server-stack">
                <Server size={70} />
                <span>{project.stack.slice(0, 2).join(" · ") || "TECHNOLOGY PROJECT"}</span>
              </div>
            </div>
            <div>
              <p className="eyebrow">
                {project.featured ? "FEATURED PROJECT" : "PROJECT"}
                {project.slug === "bus-tracking-system-cloud-deployment" ? " · CLOUD INFRASTRUCTURE" : ""}
              </p>
              <h2>{project.title}</h2>
              <p>{project.summary}</p>
              {project.description !== project.summary && <p>{project.description}</p>}
              <div className="tag-row">
                {project.stack.map((technology) => <span key={technology}>{technology}</span>)}
              </div>
              {project.project_url && (
                <a
                  className="button button-ghost"
                  href={project.project_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visit project <ArrowUpRight size={16} />
                </a>
              )}
            </div>
          </article>
        ))}
      </div>

      {includesBusTracking && (
        <section className="section-inner">
          <p className="eyebrow">IMPLEMENTATION AREAS</p>
          <h2>What the work involved</h2>
          <div className="skill-grid">
            <div className="skill-card"><Cloud /><h3>Cloud deployment</h3><p>Oracle Cloud Linux virtual machine environment.</p></div>
            <div className="skill-card"><Terminal /><h3>Remote administration</h3><p>SSH-based server administration and configuration.</p></div>
            <div className="skill-card"><Network /><h3>Application connectivity</h3><p>API and database connectivity checks.</p></div>
            <div className="skill-card"><Server /><h3>Operations</h3><p>Service management and troubleshooting deployment issues.</p></div>
          </div>
        </section>
      )}
      {usingCvProject && (
        <p className="fine-print">
          This portfolio currently features the project documented in the CV. More projects can be added when
          their details and evidence are available.
        </p>
      )}
    </div>
  );
}
