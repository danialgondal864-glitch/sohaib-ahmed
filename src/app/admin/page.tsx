import { createPost, deletePost, updatePost } from "@/app/admin/actions";
import PostForm from "@/app/admin/PostForm";
import { requireAdmin } from "@/lib/auth/admin";
import { RESEARCH_CATEGORIES } from "@/lib/posts";

type AdminPageProps = {
  searchParams: Promise<{ status?: string }>;
};

const statusMessages: Record<string, string> = {
  created: "Article created.",
  updated: "Article updated.",
  deleted: "Article deleted.",
  invalid: "Check the article fields and source JSON, then try again.",
  "save-failed": "The article could not be saved. Check that the slug is unique and the research migration is applied.",
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { supabase, user } = await requireAdmin();
  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (postsError) {
    throw new Error(`Unable to load research articles: ${postsError.message}`);
  }

  const { data: messages, error: messagesError } = await supabase
    .from("contact_messages")
    .select("id, name, email, subject, message, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const messageSetupMissing =
    messagesError?.code === "PGRST205" ||
    messagesError?.code === "42P01" ||
    messagesError?.code === "42501";

  if (messagesError && !messageSetupMissing) {
    throw new Error(`Unable to load contact messages: ${messagesError.message}`);
  }

  const { status } = await searchParams;
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
            <h2>Research articles</h2>
          </div>
        </div>
        <div className="panel">
          <h3>Create an article</h3>
          <p>Only publish factual claims with verifiable sources. Use the separate research fields to label facts, findings, opinions, and proposed solutions.</p>
          <PostForm action={createPost} />
        </div>
        <div className="admin-list">
          {(posts ?? []).map((post) => (
            <details className="panel admin-item" key={post.id}>
              <summary>
                <span>{post.title}</span>
                <span className="muted">{post.published ? "Published" : "Draft"} · {post.category}</span>
              </summary>
              <PostForm action={updatePost} post={post} />
              <p className="fine-print">Deleting an article also removes its bookmarks.</p>
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
        <p className="fine-print">Categories: {RESEARCH_CATEGORIES.join(" · ")}</p>
      </section>

      <section className="section-inner">
        <div className="section-heading">
          <div>
            <p className="eyebrow">INBOX</p>
            <h2>Contact messages</h2>
          </div>
        </div>
        {messageSetupMissing ? (
          <div className="panel">
            <p>Contact message access is not configured. Apply the contact-message migrations to enable the inbox.</p>
          </div>
        ) : (messages ?? []).length > 0 ? (
          <div className="admin-list">
            {(messages ?? []).map((message) => (
              <article className="panel admin-item" key={message.id}>
                <div className="admin-message-header">
                  <div>
                    <h3>{message.subject}</h3>
                    <p><a href={`mailto:${message.email}`}>{message.name} · {message.email}</a></p>
                  </div>
                  <time className="fine-print" dateTime={message.created_at}>
                    {new Date(message.created_at).toLocaleString()}
                  </time>
                </div>
                <p className="admin-message-body">{message.message}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-research">
            <h3>No contact messages yet.</h3>
            <p>Messages submitted through the public contact form will appear here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
