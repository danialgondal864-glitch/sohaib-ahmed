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
- **Next phases:** contact submission; research publishing and bookmarks; admin CRUD for content and site data; production validation.

### Architecture decisions

- Administrator status is stored in `public.profiles.role` and checked by the server before rendering `/admin`.
- Client users can read their own profile and update only `full_name`; role changes require a trusted database operator.
- Post mutation is restricted by row-level security to administrator profiles. Public visitors can read published posts only.
- The public anon key is used for Supabase SSR clients. No service-role key is used by this application.

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
2. For a new project, open SQL Editor and run `supabase/schema.sql`. To upgrade a project that already ran the original schema, run `supabase/migrations/20261117_profiles_and_admin_roles.sql`.
3. Copy Project URL and anon/public key from Project Settings → API.
4. Add them to `.env.local`.
5. In Authentication → URL Configuration, set your local Site URL to `http://localhost:3000`.
6. Add `http://localhost:3000/auth/callback` and `https://sohaib-ahmed-five.vercel.app/auth/callback` to the allowed redirect URLs. Add the matching callback URL for any custom domain or Vercel preview environment you use.
7. Configure email confirmation and the Supabase confirmation/reset email templates. The confirmation link must return to the `emailRedirectTo` URL supplied by the app.

## Blog publishing
The blog reads from `public.posts` and displays only rows where `published = true`.
Post creation and mutation are restricted by row-level security to administrators. Until the admin editor is implemented, use a trusted Supabase SQL Editor session. Set:
- `title`
- unique URL-safe `slug`
- `category`
- `excerpt`
- `content` (plain text for now)
- `read_time`
- `published = true`
- `author_id` = the authenticated author's user UUID

Do not grant end users direct post-management access or expose a Supabase service-role key in browser code.

## Deploy to Vercel
1. Push this folder to a GitHub repository.
2. In Vercel, import the repository.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as Environment Variables.
4. Deploy.
5. Add the Vercel production URL to Supabase Authentication → URL Configuration and allowed redirect URLs.
6. Redeploy after changing environment variables.

## Before production
- Replace or confirm the public phone/location details in `src/lib/data.ts`.
- Add verified LinkedIn and GitHub profile URLs when supplied.
- Add a real CV PDF download only after confirming which CV file should be publicly downloadable.
- Add server-side contact form submission with rate limiting and spam protection; current contact form opens the visitor's email app.
- Configure and verify the first administrator role before publishing content.
- Review privacy, cookie, and data-retention requirements.
- Add a real favicon/brand asset if desired.
- Promote an administrator only after signup and only from a trusted SQL editor, for example: `update public.profiles set role = 'admin' where id = '<verified-user-uuid>';`. Never expose a role-management API to untrusted clients.

## Accuracy note
The biography, education, skills, training status and Bus Tracking System project description are based on the supplied CV. No extra employment history, certifications, metrics or project claims have been invented.
