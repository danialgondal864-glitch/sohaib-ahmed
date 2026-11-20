import { createPost, deletePost, updatePost } from "@/app/admin/actions";
import { createProject, deleteProject, updateProject } from "@/app/admin/project-actions";
import { updateUserRole } from "@/app/admin/user-actions";
import { updateSiteSettings } from "@/app/admin/settings-actions";
import { createCategory, deleteCategory, updateCategory } from "@/app/admin/category-actions";
import ContactMessageControls from "@/app/admin/ContactMessageControls";
import CategoryForm from "@/app/admin/CategoryForm";
import MediaLibrary from "@/app/admin/MediaLibrary";
import PostForm from "@/app/admin/PostForm";
import ReviewControls from "@/app/admin/ReviewControls";
import ReportControls from "@/app/admin/ReportControls";
import { markNotificationRead } from "@/app/author/actions";
import ProjectForm from "@/app/admin/ProjectForm";
import SettingsForm from "@/app/admin/SettingsForm";
import UserRoleForm from "@/app/admin/UserRoleForm";
import { requireAdmin } from "@/lib/auth/admin";
import { parseResearchCategories } from "@/lib/categories";
import { isProjectRecord } from "@/lib/projects";
import type { AdminUser } from "@/lib/users";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteSettings } from "@/lib/settings";

type AdminPageProps = {
  searchParams: Promise<{ status?: string; usersPage?: string; inbox?: string }>;
};

const USERS_PER_PAGE = 50;

const statusMessages: Record<string, string> = {
  created: "Article created.",
  updated: "Article updated.",
  deleted: "Article deleted.",
  invalid: "Check the publication fields, media URLs, and source JSON, then try again.",
  "save-failed": "The publication could not be saved. Check that the slug is unique and the publishing migration is applied.",
  "project-created": "Project created.",
  "project-updated": "Project updated.",
  "project-deleted": "Project deleted.",
  "project-invalid": "Check the project fields and try again.",
  "project-save-failed": "The project could not be saved. Check that the slug is unique and the projects migration is applied.",
  "user-role-updated": "User role updated.",
  "user-role-invalid": "The selected user or role is invalid.",
  "user-role-self": "You cannot change your own administrator role.",
  "user-role-last-admin": "The last administrator cannot be demoted.",
  "user-role-failed": "The user role could not be updated. Please try again.",
  "settings-updated": "Website settings updated.",
  "settings-invalid": "Check the website settings fields and try again.",
  "settings-failed": "Website settings could not be saved. Please try again.",
  "category-created": "Category created.",
  "category-updated": "Category updated.",
  "category-deleted": "Category deleted.",
  "category-invalid": "Check the category name, URL slug, type, and parent.",
  "category-duplicate": "A category with that name or slug already exists.",
  "category-in-use": "This category is still used by one or more articles.",
  "category-failed": "The category could not be saved. Please try again.",
  "review-updated": "The publication review decision was saved.",
  "review-invalid": "Check the review action, feedback, or scheduled time.",
  "review-failed": "The review decision could not be saved. Refresh and try again.",
  "report-updated": "The content report was updated.",
  "report-invalid": "Check the report status and notes.",
  "report-failed": "The report could not be updated. Refresh and try again.",
  "message-updated": "Contact message updated.",
  "message-invalid": "The selected contact message action is invalid.",
  "message-failed": "The contact message could not be changed. Please refresh and try again.",
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { supabase, user } = await requireAdmin();
  const siteSettings = await getSiteSettings();
  const { status, usersPage: usersPageValue, inbox } = await searchParams;
  const showArchivedMessages = inbox === "archived";
  const { data: categoryRows, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, slug, description, content_type, parent_id, sort_order, is_active, created_at, updated_at")
    .order("sort_order")
    .order("name");
  if (categoriesError) {
    throw new Error(`Unable to load research categories: ${categoriesError.message}`);
  }
  const categories = parseResearchCategories(categoryRows);
  const parsedUsersPage = Number(usersPageValue);
  const usersPage = Number.isSafeInteger(parsedUsersPage) && parsedUsersPage > 0
    ? parsedUsersPage
    : 1;
  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (postsError) {
    throw new Error(`Unable to load research articles: ${postsError.message}`);
  }

  const { data: reports, error: reportsError } = await supabase.from("content_reports")
    .select("id, post_title, post_slug, reason, details, status, admin_notes, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (reportsError) {
    throw new Error(`Unable to load content reports: ${reportsError.message}`);
  }
  const { data: notifications, error: notificationsError } = await supabase.from("author_notifications")
    .select("id, message, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (notificationsError) {
    throw new Error(`Unable to load administrator notifications: ${notificationsError.message}`);
  }

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  const projectSetupMissing =
    projectsError?.code === "PGRST205" ||
    projectsError?.code === "42P01";

  if (projectsError && !projectSetupMissing) {
    throw new Error(`Unable to load portfolio projects: ${projectsError.message}`);
  }
  const projectRows: unknown = projects ?? [];
  const projectRecords = Array.isArray(projectRows)
    ? projectRows.filter(isProjectRecord)
    : null;
  if (
    !projectSetupMissing &&
    (!Array.isArray(projectRows) || !projectRecords || projectRecords.length !== projectRows.length)
  ) {
    throw new Error("The portfolio projects table returned invalid data.");
  }

  const adminClient = createAdminClient();
  const { data: authUsers, error: authUsersError } = await adminClient.auth.admin.listUsers({
    page: usersPage,
    perPage: USERS_PER_PAGE
  });
  if (authUsersError) {
    throw new Error(`Unable to load platform users: ${authUsersError.message}`);
  }
  let hasNextUsersPage = false;
  if (authUsers.users.length === USERS_PER_PAGE) {
    const { data: nextUsers, error: nextUsersError } = await adminClient.auth.admin.listUsers({
      page: usersPage + 1,
      perPage: USERS_PER_PAGE
    });
    if (nextUsersError) {
      throw new Error(`Unable to check for additional platform users: ${nextUsersError.message}`);
    }
    hasNextUsersPage = nextUsers.users.length > 0;
  }
  const authUserIds = authUsers.users.map((authUser) => authUser.id);
  const { data: profiles, error: profilesError } = authUserIds.length > 0
    ? await adminClient.from("profiles").select("id, role").in("id", authUserIds)
    : { data: [], error: null };
  if (profilesError) {
    throw new Error(`Unable to load user roles: ${profilesError.message}`);
  }
  const profileRoles = new Map((profiles ?? []).map((profile) => [profile.id, profile.role]));
  const adminUsers: AdminUser[] = authUsers.users.map((authUser) => ({
    id: authUser.id,
    email: authUser.email ?? null,
    fullName: typeof authUser.user_metadata.full_name === "string"
      ? authUser.user_metadata.full_name
      : null,
    role: profileRoles.get(authUser.id) === "admin" ? "admin" : "user",
    emailConfirmedAt: authUser.email_confirmed_at ?? null,
    createdAt: authUser.created_at
  }));
  let messagesQuery = supabase
    .from("contact_messages")
    .select("id, name, email, subject, message, created_at, is_read, archived_at, status, updated_at")
    .order("created_at", { ascending: false })
    .limit(50);
  messagesQuery = showArchivedMessages
    ? messagesQuery.not("archived_at", "is", null)
    : messagesQuery.is("archived_at", null);
  const { data: messages, error: messagesError } = await messagesQuery;
  const messageSetupMissing =
    messagesError?.code === "PGRST205" ||
    messagesError?.code === "42P01";

  if (messagesError && !messageSetupMissing) {
    throw new Error(`Unable to load contact messages: ${messagesError.message}`);
  }

  const statusMessage = status ? statusMessages[status] : undefined;

  return (
    <div className="page-shell container">
      <div className="page-intro">
        <p className="eyebrow">ADMINISTRATION</p>
        <h1>Control <span className="gradient-text">center.</span></h1>
        <p>Signed in as {user.email}. Administrator access is verified for each page and mutation.</p>
      </div>
      {statusMessage && <p className="success" role="status">{statusMessage}</p>}

      <section className="section-inner">
        <div className="section-heading">
          <div>
            <p className="eyebrow">EDITORIAL</p>
            <h2>Publications</h2>
          </div>
        </div>
        <div className="panel">
          <h3>Create a publication</h3>
          <p>Only publish factual claims with verifiable sources. Use the separate research fields to label facts, findings, opinions, and proposed solutions.</p>
          <PostForm action={createPost} categories={categories} />
        </div>
        <div className="section-heading" id="review-queue">
          <div>
            <p className="eyebrow">MODERATION</p>
            <h2>Review queue</h2>
          </div>
        </div>
        <div className="admin-list">
          {(posts ?? []).filter((post) => post.workflow_status === "pending_review").map((post) => (
            <details className="panel admin-item" key={`review-${post.id}`}>
              <summary>
                <span>{post.title}</span>
                <span className="muted">{post.content_type} · {post.category} · submitted {post.submitted_at ? new Date(post.submitted_at).toLocaleString() : "recently"}</span>
              </summary>
              <p>{post.excerpt}</p>
              <ReviewControls id={post.id} status={post.workflow_status} />
            </details>
          ))}
          {(posts ?? []).every((post) => post.workflow_status !== "pending_review") && (
            <div className="empty-research"><p>No submissions are waiting for review.</p></div>
          )}
        </div>
        {(notifications ?? []).length > 0 && (
          <div className="panel" id="notifications">
            <h3>Notifications</h3>
            <ul className="author-notifications">
              {(notifications ?? []).map((notification) => (
                <li className={notification.read_at ? "" : "unread"} key={notification.id}>
                  <div>
                    <p>{notification.message}</p>
                    <span className="muted">{new Date(notification.created_at).toLocaleString()}</span>
                  </div>
                  {!notification.read_at && (
                    <form action={markNotificationRead}>
                      <input type="hidden" name="id" value={notification.id} />
                      <input type="hidden" name="return_to" value="admin" />
                      <button className="button button-ghost" type="submit">Mark read</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="admin-list">
          {(posts ?? []).map((post) => (
            <details className="panel admin-item" key={post.id}>
              <summary>
                <span>{post.title}</span>
                <span className="muted">{post.workflow_status} · {post.content_type} · {post.category}</span>
              </summary>
              <PostForm action={updatePost} post={post} categories={categories} />
              <ReviewControls id={post.id} status={post.workflow_status} />
              <p className="fine-print">Deleting a publication also removes its bookmarks.</p>
              <form action={deletePost}>
                <input type="hidden" name="id" value={post.id} />
                <button className="button button-ghost" type="submit">Delete article</button>
              </form>
            </details>
          ))}
          {(posts ?? []).length === 0 && (
            <div className="empty-research">
              <h3>No articles yet.</h3>
              <p>Create a draft above. The public research page lists only published articles.</p>
            </div>
          )}
        </div>
      </section>

      <section className="section-inner" id="categories">
        <div className="section-heading">
          <div>
            <p className="eyebrow">EDITORIAL ORGANIZATION</p>
            <h2>Categories</h2>
          </div>
        </div>
        <div className="panel">
          <h3>Create a category</h3>
          <p>Category renames update associated articles. Categories cannot be deleted while articles still use them.</p>
          <CategoryForm action={createCategory} categories={categories} />
        </div>
        <div className="admin-list">
          {categories.map((category) => (
            <details className="panel admin-item" key={category.id}>
              <summary>
                <span>{category.name}</span>
                <span className="muted">{category.slug}</span>
              </summary>
              <CategoryForm action={updateCategory} category={category} categories={categories} />
              <form action={deleteCategory}>
                <input type="hidden" name="id" value={category.id} />
                <button className="button button-ghost" type="submit">Delete category</button>
              </form>
            </details>
          ))}
          {categories.length === 0 && (
            <div className="empty-research">
              <h3>No categories yet.</h3>
              <p>Create a category before publishing a research article.</p>
            </div>
          )}
        </div>
      </section>

      <section className="section-inner" id="reports">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TRUST & SAFETY</p>
            <h2>Content reports</h2>
          </div>
        </div>
        <div className="admin-list">
          {(reports ?? []).map((report) => (
            <article className="panel" key={report.id}>
              <div className="admin-message-header">
                <div>
                  <h3>{report.post_title}</h3>
                  <p className="muted">/{report.post_slug} · {report.reason.replace(/_/g, " ")} · {report.status}</p>
                </div>
                <span className="muted">{new Date(report.created_at).toLocaleString()}</span>
              </div>
              {report.details && <p className="admin-message-body">{report.details}</p>}
              <ReportControls id={report.id} status={report.status} adminNotes={report.admin_notes} />
            </article>
          ))}
          {(reports ?? []).length === 0 && (
            <div className="empty-research"><p>No content reports have been filed.</p></div>
          )}
        </div>
      </section>

      <section className="section-inner" id="users">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ACCESS CONTROL</p>
            <h2>Users</h2>
          </div>
        </div>
        <p className="muted">
          {adminUsers.length} {adminUsers.length === 1 ? "account" : "accounts"} on this page.
          Role changes are protected by server authorization and database policies.
        </p>
        <div className="admin-list">
          {adminUsers.map((adminUser) => (
            <article className="panel admin-item" key={adminUser.id}>
              <div className="admin-message-header">
                <div>
                  <h3>{adminUser.fullName || adminUser.email || "Account"}</h3>
                  <p>{adminUser.email || "No email address"} · {adminUser.role}</p>
                </div>
                <p className="fine-print">
                  {adminUser.emailConfirmedAt ? "Email verified" : "Email not verified"} · Joined{" "}
                  <time dateTime={adminUser.createdAt}>
                    {new Date(adminUser.createdAt).toLocaleDateString()}
                  </time>
                </p>
              </div>
              <UserRoleForm
                action={updateUserRole}
                user={adminUser}
                disabled={adminUser.id === user.id}
              />
            </article>
          ))}
          {adminUsers.length === 0 && (
            <div className="empty-research">
              <h3>No accounts found on this page.</h3>
            </div>
          )}
        </div>
        <div className="admin-pagination">
          {usersPage > 1 && <a className="button button-ghost" href={`/admin?usersPage=${usersPage - 1}#users`}>Previous users</a>}
          {hasNextUsersPage && <a className="button button-ghost" href={`/admin?usersPage=${usersPage + 1}#users`}>Next users</a>}
        </div>
      </section>

      <section className="section-inner">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PORTFOLIO</p>
            <h2>Projects</h2>
          </div>
        </div>
        {projectSetupMissing ? (
          <div className="panel">
            <p>Project management is not configured. Apply the projects migration to enable project publishing.</p>
          </div>
        ) : (
          <>
            <div className="panel">
              <h3>Create a project</h3>
              <p>Use accurate project details and only publish work that is ready to appear in the public portfolio.</p>
              <ProjectForm action={createProject} />
            </div>
            <div className="admin-list">
              {(projectRecords ?? []).map((project) => (
                <details className="panel admin-item" key={project.id}>
                  <summary>
                    <span>{project.title}</span>
                    <span className="muted">
                      {project.published ? "Published" : "Draft"}{project.featured ? " · Featured" : ""}
                    </span>
                  </summary>
                  <ProjectForm action={updateProject} project={project} />
                  <form action={deleteProject}>
                    <input type="hidden" name="id" value={project.id} />
                    <button className="button button-ghost" type="submit">Delete project</button>
                  </form>
                </details>
              ))}
              {(projectRecords ?? []).length === 0 && (
                <div className="empty-research">
                  <h3>No managed projects yet.</h3>
                  <p>The existing CV project remains visible on the public portfolio until a project is published here.</p>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <section className="section-inner">
        <div className="section-heading">
          <div>
            <p className="eyebrow">INBOX</p>
            <h2 id="contact-inbox">Contact messages</h2>
          </div>
        </div>
        {messageSetupMissing ? (
          <div className="panel">
            <p>Contact message access is not configured. Apply the contact-message migrations to enable the inbox.</p>
          </div>
        ) : (
          <>
            <nav className="admin-inbox-tabs" aria-label="Contact message views">
              <a
                className={`button ${!showArchivedMessages ? "" : "button-ghost"}`}
                href="/admin#contact-inbox"
                aria-current={!showArchivedMessages ? "page" : undefined}
              >
                Inbox
              </a>
              <a
                className={`button ${showArchivedMessages ? "" : "button-ghost"}`}
                href="/admin?inbox=archived#contact-inbox"
                aria-current={showArchivedMessages ? "page" : undefined}
              >
                Archived
              </a>
            </nav>
            {(messages ?? []).length > 0 ? (
          <div className="admin-list">
            {(messages ?? []).map((message) => (
              <article className="panel admin-item" key={message.id}>
                <div className="admin-message-header">
                  <div>
                    <h3>{message.subject}{!message.is_read ? " · Unread" : ""}</h3>
                    <p><a href={`mailto:${message.email}`}>{message.name} · {message.email}</a></p>
                  </div>
                  <time className="fine-print" dateTime={message.created_at}>
                    {new Date(message.created_at).toLocaleString()}
                  </time>
                </div>
                <p className="fine-print">Status: {message.status.replace("_", " ")} · {showArchivedMessages ? "Archived" : "In inbox"}</p>
                <p className="admin-message-body">{message.message}</p>
                <ContactMessageControls message={message} archived={showArchivedMessages} />
              </article>
            ))}
          </div>
            ) : (
          <div className="empty-research">
            <h3>{showArchivedMessages ? "No archived messages." : "No contact messages yet."}</h3>
            <p>{showArchivedMessages ? "Archived contact messages will appear here." : "Messages submitted through the public contact form will appear here."}</p>
          </div>
            )}
          </>
        )}
      </section>

      <section className="section-inner">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ASSETS</p>
            <h2>Media library</h2>
          </div>
        </div>
        <MediaLibrary />
      </section>

      <section className="section-inner" id="settings">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CONFIGURATION</p>
            <h2>Website settings</h2>
          </div>
        </div>
        <div className="panel">
          <p>Manage search metadata, public contact details, social links, and the optional homepage announcement.</p>
          <SettingsForm action={updateSiteSettings} settings={siteSettings} />
        </div>
      </section>
    </div>
  );
}
