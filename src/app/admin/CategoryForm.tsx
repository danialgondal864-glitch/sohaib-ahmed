import type { createCategory, updateCategory } from "@/app/admin/category-actions";
import type { ResearchCategory } from "@/lib/categories";

type CategoryFormProps = {
  action: typeof createCategory | typeof updateCategory;
  category?: ResearchCategory;
  categories?: ResearchCategory[];
};

export default function CategoryForm({ action, category, categories = [] }: CategoryFormProps) {
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
      <label>
        Description
        <input name="description" defaultValue={category?.description} maxLength={500} />
      </label>
      <label>
        Content type
        <select name="content_type" defaultValue={category?.content_type ?? "all"} required>
          <option value="all">All content</option>
          <option value="article">Articles</option>
          <option value="video">Videos</option>
          <option value="podcast">Podcasts</option>
        </select>
      </label>
      <label>
        Parent category
        <select name="parent_id" defaultValue={category?.parent_id ?? ""}>
          <option value="">Top-level category</option>
          {categories.filter((item) => item.id !== category?.id).map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </label>
      <label>
        Display order
        <input
          name="sort_order"
          type="number"
          min={0}
          max={10000}
          defaultValue={category?.sort_order ?? 0}
          required
        />
      </label>
      <label>
        Visibility
        <select name="is_active" defaultValue={String(category?.is_active ?? true)}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </label>
      <button className="button button-ghost" type="submit">
        {category ? "Save category" : "Create category"}
      </button>
    </form>
  );
}
