# Sohaib Ahmed — Personal Technology Portfolio

A Next.js App Router portfolio starter for Sohaib Ahmed, styled as a premium dark technology portfolio. CV-derived profile content is centralized in `src/lib/data.ts`.

## Included
- Home, About, Projects, Research & Blogs, Contact
- Supabase email/password sign-up and login
- Authenticated account dashboard and logout
- Supabase-backed published blog listing and article detail pages
- Responsive dark navy / cyan design
- SQL schema with row-level security policies
- Vercel-ready deployment configuration

## Development progress

- **Phase 1 — Authentication and authorization foundation:** server-verified dashboard sessions, server-side administrator role checks, profile provisioning on signup, and admin-only post management policies. The migration is prepared but has not been applied to any Supabase project.
- **Phase 2 — Password recovery and email authentication:** signup confirmation callbacks, password-reset email requests, and password updates are implemented. The Supabase email round-trip still requires project configuration and live verification.
- **Phase 3 — Contact submissions:** server-side validation, a database-backed limit of 3 messages per IP per rolling hour, HMAC-only IP fingerprints, and admin-only message reads are implemented. Apply the migration and configure the private service-role key before live submission testing.
- **Phase 4 — Research and bookmarks:** article search/category filters, separate research sections and source links, and per-user bookmarks with RLS are implemented. Apply the research/bookmarks migration before using bookmarks.
- **Phase 5 — Editorial administration:** server-authorized post create, update, publish/unpublish, and delete actions plus an admin-only contact inbox are implemented. Admin routes require the existing RLS migrations.
- **Phase 6 — Project administration:** a projects table with public-read/admin-write RLS, server-authorized CRUD, and published-project display with CV-backed fallback are implemented. Project migrations `20261121_projects_admin.sql` and `20261122_projects_admin_write_grants.sql` have been applied.
- **Phase 7 — User administration:** an admin-only paginated user list and protected role updates are implemented. Migrations `20261123_admin_user_management_grants.sql` and `20261124_admin_role_updates_atomic.sql` are applied. Self-role changes and concurrent demotions of the last administrator are blocked.
- **Phase 8 — Media library:** public website images and private administrator-only media use separate Supabase Storage buckets with admin-only object operations, 5 MB image limits, and MIME restrictions. Migration `20261125_media_storage_buckets.sql` is applied.
- **Phase 9 — Website settings:** administrators can update site metadata, public contact details, social links, and an optional homepage announcement. Migration `20261126_website_settings.sql` is applied.
- **Next phases:** authenticated production validation and security review.

### Architecture decisions

- Administrator status is stored in `public.profiles.role` and checked by the server before rendering `/admin`.
- Every editorial server action repeats the administrator check; post and contact-message access is also constrained by RLS.
- Client users can read their own profile and update only `full_name`; role changes require a trusted database operator.
- Post mutation is restricted by row-level security to administrator profiles. Public visitors can read published posts only.
- Administrator user management uses a server-only Supabase secret key after the current session is independently verified as an administrator. The user list is paginated, role inputs are validated, self-demotion is blocked, and an atomic database function serializes demotions to protect the last administrator.
- Storage object access is controlled by Supabase policies tied to the signed-in administrator profile. Public image URLs are intentionally public; private media access is limited to admins and uses one-minute signed links.
- Website settings are publicly readable because they contain only intentionally public presentation and contact details; only administrators can update them.
- Supabase SSR and browser clients use the public anon key. The server-only `SUPABASE_SERVICE_ROLE_KEY` is used by the contact API for its restricted RPC and by administrator-only user management after role verification; it is never sent to the browser.

## Requirements
- Node.js 20.9+
- Supabase project
- Vercel account (for deployment)

## Run locally
```bash
npm install
cp .env.example .env.local
```
Set the Supabase project URL and anon/public key in `.env.local`, then:
```bash
npm run dev
```
Open http://localhost:3000.

## Supabase setup
1. Create a Supabase project.
2. Run `supabase/migrations/20261116_initial_platform.sql` for a new project, followed by all remaining migrations in ascending version order. Apply pending migrations to an existing project in version order.
3. Copy Project URL and anon/public key from Project Settings → API, and set `SUPABASE_SERVICE_ROLE_KEY` from the same project for server-side contact submissions.
4. Add the values to `.env.local`. Keep the service-role key private; never prefix it with `NEXT_PUBLIC_` or expose it in browser code.
5. In Authentication → URL Configuration, set the Site URL to your production origin, for example `https://sohaib-ahmed-five.vercel.app`.
6. Add `https://sohaib-ahmed-five.vercel.app/auth/callback` and (for local development) `http://localhost:3000/auth/callback` to the allowed redirect URLs. Add the matching callback URL for any custom domain or Vercel preview environment you use.
7. Configure email confirmation and the Supabase confirmation/reset email templates. The confirmation link must return to the `emailRedirectTo` URL supplied by the app.

## Blog publishing
The blog reads from `public.posts` and displays only rows where `published = true`. Search and category filters operate over the loaded published articles.
Post creation and mutation are restricted by row-level security to administrators. Use the `/admin` editor for article CRUD. Set:
- `title`
- unique URL-safe `slug`
- `category`
- `excerpt`
- `content` (article body)
- `verified_facts`, `research_findings`, `opinions`, and `proposed_solutions` (text arrays; keep each claim in the appropriate section)
- `sources` (JSON array of objects with `title`, `url`, and optional `published_at`)
- `read_time`
- `published = true`
- `author_id` = the authenticated author's user UUID

Only publish factual research claims when their source links can be verified. Bookmark rows are private to the owning user; users can bookmark published posts only.
Do not grant end users direct post-management access or expose a Supabase service-role key in browser code.

## Project publishing
Projects are managed in the administrator dashboard and are visible publicly only after publication. Public visitors can read published projects; create, update, and delete require an administrator session and matching database RLS policies. When no project is published or the project migration is not yet installed, the Projects page displays the CV-backed Bus Tracking System content from `src/lib/data.ts`.

## Deploy to Vercel
1. Push this folder to a GitHub repository.
2. In Vercel, import the repository.
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` as Environment Variables. Keep the service-role key private and server-only. With the new Supabase key format, the publishable key is the public client key; the secret key maps to the server-only service role.
4. Deploy.
5. Add the Vercel production URL to Supabase Authentication → URL Configuration and allowed redirect URLs.
6. Redeploy after changing environment variables.

## Before production
- Replace or confirm the public phone/location details in `src/lib/data.ts`.
- Add verified LinkedIn and GitHub profile URLs when supplied.
- Add a real CV PDF download only after confirming which CV file should be publicly downloadable.
- The contact form stores submissions only after the contact migration and private service-role key are configured; until then, visitors can use the direct email link.
- Configure and verify the first administrator role before publishing content.
- Review privacy, cookie, and data-retention requirements.
- Add a real favicon/brand asset if desired.
- Promote an administrator only after signup and only from a trusted SQL editor, for example: `update public.profiles set role = 'admin' where id = '<verified-user-uuid>';`. Never expose a role-management API to untrusted clients.

## Accuracy note
The biography, education, skills, training status and Bus Tracking System project description are based on the supplied CV. No extra employment history, certifications, metrics or project claims have been invented.
