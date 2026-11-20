# Sohaib Ahmed — Personal Technology Portfolio

A Next.js App Router portfolio starter for Sohaib Ahmed, styled as a premium dark technology portfolio. CV-derived profile content is centralized in `src/lib/data.ts`.

## Included
- Home, About, Projects, Research & Blogs, Contact
- Supabase email/password sign-up and login
- Authenticated account dashboard and logout
- Supabase-backed published blog listing and article detail pages
- Multi-author articles, video and podcast submissions with administrator review
- Author profiles, workflow notifications, review history, content reports and scheduled publishing
- Markdown authoring with safe rendering, source sections, dynamic categories, tags and SEO metadata
- Responsive dark navy / cyan design
- Additive Supabase migration with ownership-aware publishing RLS and workflow triggers
- Vercel-ready deployment configuration

## Development progress

- **Phase 1 — Authentication and authorization foundation:** server-verified dashboard sessions, administrator role checks, profile provisioning on signup, and protected post policies are implemented and deployed.
- **Phase 2 — Password recovery and email authentication:** signup confirmation callbacks, password-reset requests, and password updates are implemented; the user confirmed successful signup, confirmation, and login flows.
- **Phase 3 — Contact submissions:** server-side validation, database-backed rate limiting, HMAC-only IP fingerprints, and administrator-only message reads are implemented and deployed.
- **Phase 4 — Research and bookmarks:** article search/category filters, separate research sections and source links, and per-user bookmarks with RLS are implemented and deployed.
- **Phase 5 — Editorial administration:** server-authorized post CRUD and an administrator-only contact inbox are implemented and deployed.
- **Phase 6 — Project administration:** a projects table with public-read/admin-write RLS, server-authorized CRUD, and published-project display with CV-backed fallback are implemented. Project migrations `20261121_projects_admin.sql` and `20261122_projects_admin_write_grants.sql` have been applied.
- **Phase 7 — User administration:** an admin-only paginated user list and protected role updates are implemented. Migrations `20261123_admin_user_management_grants.sql` and `20261124_admin_role_updates_atomic.sql` are applied. Self-role changes and concurrent demotions of the last administrator are blocked.
- **Phase 8 — Media library:** public website images and private administrator-only media use separate Supabase Storage buckets with admin-only object operations, 5 MB image limits, and MIME restrictions. Migration `20261125_media_storage_buckets.sql` is applied.
- **Phase 9 — Website settings:** administrators can update site metadata, public contact details, social links, and an optional homepage announcement. Migration `20261126_website_settings.sql` is applied.
- **Phase 10 — CV refresh:** added the SparkSolution internship, updated skills and career objective, added the CV-listed projects and public links, and refreshed LinkedIn/GitHub/X links. Migration `20261127_cv_projects_and_links.sql` is applied.
- **Phase 11 — Admin categories:** category CRUD with public category browsing, post reassignment on rename, and deletion protection while articles reference a category.
- **Phase 12 — Contact inbox workflow:** read/unread, archive/restore, delete, and new/in-progress/resolved statuses, protected by administrator-only policies.
- **Phase 13 — Multi-author publishing (implemented in source, not production-verified):** author drafts and submissions, server/database-enforced ownership and review transitions, administrator review decisions, feedback/audit history, in-app notifications, article/video/podcast metadata, public author profiles, category hierarchy, tags, Markdown editing, reports, SEO metadata, sitemap, and scheduled publication endpoint.
- **Remaining:** apply and verify `20261202_multi_author_publishing.sql` in Supabase; test regular-user/admin/unauthenticated RLS behavior and all review/report flows; configure `CRON_SECRET` and a compatible Vercel Cron plan; complete production smoke tests and deployment. Contributor file uploads and email notifications are not implemented yet; video/audio/cover media are currently external HTTPS URLs.

### Architecture decisions

- Administrator status is stored in `public.profiles.role` and checked by the server before rendering `/admin`.
- Administrator and author server actions verify the session and database permissions independently; post, contact-message, report, and notification access is also constrained by RLS.
- Users can update their own permitted profile fields; role changes remain restricted to administrator-only server logic.
- Post mutation is restricted to administrators and the owner of an editable draft/requested-change/declined submission. Public visitors can read published posts only.
- Administrator user management uses a server-only Supabase secret key after the current session is independently verified as an administrator. The user list is paginated, role inputs are validated, self-demotion is blocked, and an atomic database function serializes demotions to protect the last administrator.
- Storage object access is controlled by Supabase policies tied to the signed-in administrator profile. Public image URLs are intentionally public; private media access is limited to admins and uses one-minute signed links.
- Website settings are publicly readable because they contain only intentionally public presentation and contact details; only administrators can update them.
- Public project links accept only HTTP/HTTPS URLs; CV project seeds use conflict-safe inserts so existing administrator-managed project rows are not overwritten.
- Category updates cascade the displayed category name to related posts; a foreign key prevents deleting categories still in use.
- Publication ownership, submission states, administrator decisions, and publish visibility are enforced by Supabase RLS and database triggers; author-facing controls are not the authorization boundary.
- `public.review_content` verifies the administrator role and performs a workflow transition atomically. Review history and in-app author/admin notifications are written by database triggers.
- Public author profiles use a restricted view that exposes only profile presentation fields; private profiles remain unavailable to anonymous readers.
- Markdown is rendered with raw HTML disabled. Video links are restricted to YouTube/Vimeo in the application, while podcast and image URLs accept HTTP(S) links without embedded credentials.
- Scheduled publishing is executed by a server-only Vercel Cron endpoint protected by `CRON_SECRET`; the endpoint invokes a database function granted only to `service_role`.
- Contributor media uses external URLs for now. Do not make a draft-media bucket public; a private upload and publish-time promotion workflow remains to be designed and tested.
- Contact message workflow fields and delete/update operations are restricted by RLS and server actions that independently verify administrator access.
- Authenticated post write grants are paired with the existing admin-only RLS policies, enabling the administrator article CRUD forms without granting writes to ordinary users.
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
3. Copy Project URL and publishable key from Project Settings → API, and set `SUPABASE_SERVICE_ROLE_KEY` from the same project for server-only privileged operations.
4. Add the values to `.env.local`. Keep the service-role key private; never prefix it with `NEXT_PUBLIC_` or expose it in browser code.
5. In Authentication → URL Configuration, set the Site URL to your production origin, for example `https://sohaib-ahmed-five.vercel.app`.
6. Add `https://sohaib-ahmed-five.vercel.app/auth/callback` and (for local development) `http://localhost:3000/auth/callback` to the allowed redirect URLs. Add the matching callback URL for any custom domain or Vercel preview environment you use.
7. Configure email confirmation and the Supabase confirmation/reset email templates. The confirmation link must return to the `emailRedirectTo` URL supplied by the app.

## Blog publishing
The Knowledge Hub reads only published rows and supports articles, externally hosted videos, and podcasts. Authors use `/author` to save a draft or submit it for review. Administrators use the review queue in `/admin` to approve, request changes, decline, publish, schedule, unpublish, archive, or restore content. Public browsing includes dynamic active categories, type filters, tags, search, author pages, and SEO metadata.

Article bodies use Markdown. Raw HTML is not rendered. Video URLs must use YouTube or Vimeo; podcast audio and cover-image URLs must be HTTP(S) without embedded credentials. Contributor media upload is not available yet.

The database migration adds:
- Contributor profile fields and a restricted public author-profile view.
- Content type, category hierarchy, submission/review/publish states, tags, media URLs, and SEO fields.
- RLS and triggers preventing authors from publishing, changing review decisions, or editing another author's content.
- Atomic administrator review actions, review audit history, owner-scoped notifications, and authenticated content reports.
- A `service_role`-only function used by the protected scheduled-publishing endpoint.

For administrator-managed content, use the `/admin` editor. Set:
- `title`
- unique URL-safe `slug`
- `category`
- `content_type` (`article`, `video`, or `podcast`)
- `excerpt`
- `content` (Markdown article body or show notes)
- `verified_facts`, `research_findings`, `opinions`, and `proposed_solutions` (text arrays; keep each claim in the appropriate section)
- `sources` (JSON array of objects with `title`, `url`, and optional `published_at`)
- `read_time`
- `published = true` only when approved for public release
- `author_id` = the authenticated author's user UUID

Only publish factual research claims when their source links can be verified. Authors can edit drafts, requested changes, and declined submissions; database rules prevent them from publishing or editing content after submission. Bookmark rows remain private to the owning user.
Never expose a Supabase service-role key in browser code.

## Project publishing
Projects are managed in the administrator dashboard and are visible publicly only after publication. Public visitors can read published projects; create, update, and delete require an administrator session and matching database RLS policies. When no project is published or the project migration is not yet installed, the Projects page displays the CV-backed Bus Tracking System content from `src/lib/data.ts`.

## Deploy to Vercel
1. Push this folder to a GitHub repository.
2. In Vercel, import the repository.
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, and a high-entropy `CRON_SECRET` as Environment Variables. Keep the Supabase secret key private and server-only.
4. Deploy.
5. Add the Vercel production URL to Supabase Authentication → URL Configuration and allowed redirect URLs.
6. Redeploy after changing environment variables.
7. The scheduled publication cron in `vercel.json` runs daily at 00:00 UTC for the confirmed Hobby plan. Vercel Hobby has per-hour timing precision, so scheduled content may publish on the next daily run—up to about 24 hours after its selected time. Upgrade to Pro/Enterprise and change the schedule to a minute-level cadence if closer timing is required. See [Vercel Cron limits](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing).

## Before production
- Replace or confirm the public phone/location details in `src/lib/data.ts`.
- Add verified LinkedIn and GitHub profile URLs when supplied.
- Add a real CV PDF download only after confirming which CV file should be publicly downloadable.
- The contact form stores submissions only after the contact migration and private service-role key are configured; until then, visitors can use the direct email link.
- Configure and verify the first administrator role before publishing content.
- Apply all migrations through `20261202_multi_author_publishing.sql` before deploying this version; the new routes expect those columns, tables, policies, and functions.
- Add `CRON_SECRET` to Vercel before enabling scheduled publication. Test the endpoint with a valid and invalid bearer token.
- Test author submission and direct PostgREST write attempts with a normal account, then review and publish with an administrator. A successful UI flow alone is not a substitute for RLS verification.
- Contributor image/audio/video file upload and email notification delivery remain pending.
- Review privacy, cookie, and data-retention requirements.
- Add a real favicon/brand asset if desired.
- Promote an administrator only after signup and only from a trusted SQL editor, for example: `update public.profiles set role = 'admin' where id = '<verified-user-uuid>';`. Never expose a role-management API to untrusted clients.

## Accuracy note
The biography, education, skills, training status and Bus Tracking System project description are based on the supplied CV. No extra employment history, certifications, metrics or project claims have been invented.
