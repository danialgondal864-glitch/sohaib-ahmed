import type { createCategory, updateCategory } from "@/app/admin/category-actions";
import type { ResearchCategory } from "@/lib/categories";

type CategoryFormProps = {
  action: typeof createCategory | typeof updateCategory;
  category?: ResearchCategory;
};

export default function CategoryForm({ action, category }: CategoryFormProps) {
  return (
    <form action={action} className="admin-category-form">
      {category && <input type="hidden" name="id" value={category.id} />}
      <label>
        Category name
        <input name="name" defaultValue={category?.name} maxLength={80} required />
      </label>
      <label>
        URL slug
        <input
          name="slug"
          defaultValue={category?.slug}
          maxLength={80}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          required
        />
      </label>
      <button className="button button-ghost" type="submit">
        {category ? "Save category" : "Create category"}
      </button>
    </form>
  );
}
