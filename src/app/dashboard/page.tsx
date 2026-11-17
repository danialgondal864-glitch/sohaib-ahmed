import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(`Unable to verify your account: ${error.message}`);
  }
  if (!user) {
    redirect("/login");
  }

  async function logout() {
    "use server";

    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(`Unable to sign out: ${error.message}`);
    }
    redirect("/");
  }

  const displayName = user.user_metadata?.full_name || "there";

  return (
    <div className="page-shell container">
      <div className="page-intro">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>Welcome, <span className="gradient-text">{displayName}.</span></h1>
        <p>{user.email}</p>
      </div>
      <div className="panel">
        <h2>Your portfolio account</h2>
        <p>You&apos;re signed in. Article bookmarking and member features can be added as the platform evolves.</p>
        <form action={logout}>
          <button className="button button-ghost" type="submit">Log out</button>
        </form>
      </div>
    </div>
  );
}
