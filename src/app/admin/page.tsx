import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(`Unable to verify your account: ${authError.message}`);
  }
  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Unable to verify administrator access: ${profileError.message}`);
  }
  if (profile?.role !== "admin") {
    notFound();
  }

  return (
    <div className="page-shell container">
      <div className="page-intro">
        <p className="eyebrow">ADMINISTRATION</p>
        <h1>Control <span className="gradient-text">center.</span></h1>
        <p>Signed in as {user.email}. Administrator access is verified on the server.</p>
      </div>
      <section className="panel">
        <h2>Administration tools</h2>
        <p>Role-based access is in place. Content, users, messages, media, and website settings management will be added in subsequent phases.</p>
      </section>
    </div>
  );
}
