import type { ProjectRecord } from "@/lib/projects";

type ProjectFormProps = {
  action: (formData: FormData) => Promise<void>;
  project?: ProjectRecord;
};

export default function ProjectForm({ action, project }: ProjectFormProps) {
  return (
    <form action={action} className="admin-post-form">
      {project && <input type="hidden" name="id" value={project.id} />}
      <label>
        Project title
        <input name="title" defaultValue={project?.title} maxLength={160} required />
      </label>
      <label>
        URL slug
        <input
          name="slug"
          defaultValue={project?.slug}
          maxLength={160}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          required
        />
      </label>
      <label>
        Summary
        <textarea name="summary" defaultValue={project?.summary} maxLength={400} rows={2} required />
      </label>
      <label>
        Details
        <textarea name="description" defaultValue={project?.description} maxLength={8000} rows={6} required />
      </label>
      <label>
        Technologies (one per line)
        <textarea name="stack" defaultValue={project?.stack.join("\n")} maxLength={2000} rows={3} />
      </label>
      <label>
        Display order
        <input
          name="sort_order"
          type="number"
          min={0}
          max={10000}
          defaultValue={project?.sort_order ?? 0}
          required
        />
      </label>
      <label className="admin-checkbox">
        <input name="featured" type="checkbox" defaultChecked={project?.featured ?? false} />
        Feature this project
      </label>
      <label className="admin-checkbox">
        <input name="published" type="checkbox" defaultChecked={project?.published ?? false} />
        Publish this project
      </label>
      <button className="button" type="submit">{project ? "Save project" : "Create project"}</button>
    </form>
  );
}
