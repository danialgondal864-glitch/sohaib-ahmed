-- Run this in Supabase SQL Editor.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant update (full_name) on table public.profiles to authenticated;
grant select on table public.profiles to service_role;
revoke update (role) on table public.profiles from service_role;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles for select to authenticated
using (auth.uid() = id);

create or replace function public.admin_update_user_role(target_user_id uuid, new_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role text;
  admin_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(739281642117);

  select profiles.role into current_role
  from public.profiles
  where profiles.id = target_user_id
  for update;

  if not found then
    return 'not_found';
  end if;

  if new_role is null or new_role not in ('user', 'admin') then
    return 'invalid_role';
  end if;

  if current_role = 'admin' and new_role = 'user' then
    select count(*) into admin_count
    from public.profiles
    where profiles.role = 'admin';
    if admin_count <= 1 then
      return 'last_admin';
    end if;
  end if;

  update public.profiles
  set role = new_role
  where id = target_user_id;

  return 'updated';
end;
$$;

revoke all on function public.admin_update_user_role(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_update_user_role(uuid, text) to service_role;

drop policy if exists "Users can update their own profile name" on public.profiles;
create policy "Users can update their own profile name"
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, full_name)
select id, nullif(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (id) do nothing;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null default 'Research',
  excerpt text not null default '',
  content text not null default '',
  verified_facts text[] not null default '{}',
  research_findings text[] not null default '{}',
  opinions text[] not null default '{}',
  proposed_solutions text[] not null default '{}',
  sources jsonb not null default '[]'::jsonb
    constraint posts_sources_array_check check (jsonb_typeof(sources) = 'array'),
  read_time integer not null default 5,
  published boolean not null default false,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.posts enable row level security;
revoke all on table public.posts from anon, authenticated;
grant select on table public.posts to anon, authenticated;

drop policy if exists "Published posts are viewable by everyone" on public.posts;
create policy "Published posts are viewable by everyone"
on public.posts for select
using (
  published = true
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

drop policy if exists "Authors can view their own drafts" on public.posts;
drop policy if exists "Authenticated users can create their own posts" on public.posts;
drop policy if exists "Authors can update their own posts" on public.posts;
drop policy if exists "Authors can delete their own posts" on public.posts;
drop policy if exists "Admins can create posts" on public.posts;
drop policy if exists "Admins can update posts" on public.posts;
drop policy if exists "Admins can delete posts" on public.posts;

create policy "Admins can create posts"
on public.posts for insert to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

create policy "Admins can update posts"
on public.posts for update to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

create policy "Admins can delete posts"
on public.posts for delete to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique
    constraint projects_slug_format_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  project_url text
    constraint projects_project_url_web_check check (
      project_url is null
      or (project_url ~* '^https?://' and project_url !~ '://[^/]*@')
    ),
  summary text not null,
  description text not null,
  stack text[] not null default '{}'
    constraint projects_stack_limit_check check (cardinality(stack) <= 20),
  featured boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0
    constraint projects_sort_order_check check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_public_order_idx
  on public.projects (featured desc, sort_order, created_at desc)
  where published = true;

alter table public.projects enable row level security;
revoke all on table public.projects from anon, authenticated;
grant select on table public.projects to anon, authenticated;
grant insert, update, delete on table public.projects to authenticated;

drop policy if exists "Published projects are viewable by everyone" on public.projects;
create policy "Published projects are viewable by everyone"
on public.projects for select to anon, authenticated
using (
  published = true
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can create projects" on public.projects;
create policy "Admins can create projects"
on public.projects for insert to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can update projects" on public.projects;
create policy "Admins can update projects"
on public.projects for update to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can delete projects" on public.projects;
create policy "Admins can delete projects"
on public.projects for delete to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

create or replace function public.set_project_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.set_project_updated_at() from public, anon, authenticated;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_project_updated_at();

create table if not exists public.bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists bookmarks_user_created_at_idx
  on public.bookmarks (user_id, created_at desc);
create index if not exists bookmarks_post_id_idx
  on public.bookmarks (post_id);
alter table public.bookmarks enable row level security;
revoke all on table public.bookmarks from anon, authenticated;
grant select, insert, delete on table public.bookmarks to authenticated;

drop policy if exists "Users can view their own bookmarks" on public.bookmarks;
create policy "Users can view their own bookmarks"
on public.bookmarks for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can bookmark published posts" on public.bookmarks;
create policy "Users can bookmark published posts"
on public.bookmarks for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.posts
    where posts.id = bookmarks.post_id
      and posts.published = true
  )
);

drop policy if exists "Users can remove their own bookmarks" on public.bookmarks;
create policy "Users can remove their own bookmarks"
on public.bookmarks for delete to authenticated
using (user_id = auth.uid());

-- Contact messages are inserted only through the rate-limited server RPC.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  source_hash text,
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
revoke all on table public.contact_messages from anon, authenticated;
grant select on table public.contact_messages to authenticated;

drop policy if exists "Admins can view contact messages" on public.contact_messages;
create policy "Admins can view contact messages"
on public.contact_messages for select to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create index if not exists contact_messages_source_hash_created_at_idx
  on public.contact_messages (source_hash, created_at desc)
  where source_hash is not null;

create or replace function public.submit_contact_message(
  p_name text,
  p_email text,
  p_subject text,
  p_message text,
  p_source_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_submissions integer;
begin
  if p_source_hash is null or p_source_hash !~ '^[0-9a-f]{64}$'
    or p_name is null or char_length(btrim(p_name)) not between 1 and 100
    or p_email is null or char_length(btrim(p_email)) not between 3 and 254
    or p_subject is null or char_length(btrim(p_subject)) not between 1 and 160
    or p_message is null or char_length(btrim(p_message)) not between 1 and 5000
  then
    raise exception using errcode = '22023', message = 'invalid_contact_message';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_source_hash, 0)
  );

  select count(*)
    into recent_submissions
    from public.contact_messages
   where source_hash = p_source_hash
     and created_at > pg_catalog.now() - interval '1 hour';

  if recent_submissions >= 3 then
    raise exception using errcode = 'P0001', message = 'contact_rate_limited';
  end if;

  insert into public.contact_messages (name, email, subject, message, source_hash)
  values (
    btrim(p_name),
    btrim(p_email),
    btrim(p_subject),
    btrim(p_message),
    p_source_hash
  );
end;
$$;

revoke all on function public.submit_contact_message(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_contact_message(text, text, text, text, text)
  to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'portfolio-public-media',
    'portfolio-public-media',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
  ),
  (
    'portfolio-private-media',
    'portfolio-private-media',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
  )
on conflict (id) do nothing;

drop policy if exists "Admins can list portfolio media" on storage.objects;
create policy "Admins can list portfolio media"
on storage.objects for select to authenticated
using (
  bucket_id in ('portfolio-public-media', 'portfolio-private-media')
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can upload portfolio media" on storage.objects;
create policy "Admins can upload portfolio media"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('portfolio-public-media', 'portfolio-private-media')
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can update portfolio media" on storage.objects;
create policy "Admins can update portfolio media"
on storage.objects for update to authenticated
using (
  bucket_id in ('portfolio-public-media', 'portfolio-private-media')
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  bucket_id in ('portfolio-public-media', 'portfolio-private-media')
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can delete portfolio media" on storage.objects;
create policy "Admins can delete portfolio media"
on storage.objects for delete to authenticated
using (
  bucket_id in ('portfolio-public-media', 'portfolio-private-media')
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create table if not exists public.site_settings (
  id integer primary key check (id = 1),
  site_title text not null
    constraint site_settings_title_length_check check (char_length(site_title) between 1 and 120),
  seo_description text not null
    constraint site_settings_description_length_check check (char_length(seo_description) between 1 and 320),
  contact_email text not null
    constraint site_settings_email_length_check check (char_length(contact_email) between 3 and 254),
  contact_phones text[] not null default '{}'
    constraint site_settings_phone_count_check check (cardinality(contact_phones) <= 5),
  contact_location text
    constraint site_settings_location_length_check check (contact_location is null or char_length(contact_location) <= 160),
  social_links jsonb not null default '[]'::jsonb
    constraint site_settings_social_links_check check (
      case
        when jsonb_typeof(social_links) = 'array' then jsonb_array_length(social_links) <= 8
        else false
      end
    ),
  announcement text
    constraint site_settings_announcement_length_check check (announcement is null or char_length(announcement) <= 240),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.site_settings enable row level security;
revoke all on table public.site_settings from anon, authenticated;
grant select on table public.site_settings to anon, authenticated;
grant update (
  site_title,
  seo_description,
  contact_email,
  contact_phones,
  contact_location,
  social_links,
  announcement,
  updated_by
) on table public.site_settings to authenticated;

insert into public.site_settings (
  id,
  site_title,
  seo_description,
  contact_email,
  contact_phones,
  contact_location
)
values (
  1,
  'Sohaib Ahmed | Cloud, DevOps & Infrastructure',
  'Personal portfolio of Sohaib Ahmed — Linux, cloud infrastructure, DevOps and technology research.',
  'sohaibg446@gmail.com',
  array['0321-5085443', '0314-3310064'],
  'Yusuf Town, 49 Tail, Sargodha, Punjab, Pakistan'
)
on conflict (id) do nothing;

drop policy if exists "Website settings are publicly readable" on public.site_settings;
create policy "Website settings are publicly readable"
on public.site_settings for select to anon, authenticated
using (id = 1);

drop policy if exists "Admins can update website settings" on public.site_settings;
create policy "Admins can update website settings"
on public.site_settings for update to authenticated
using (
  id = 1
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  id = 1
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create or replace function public.set_site_settings_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.set_site_settings_updated_at() from public, anon, authenticated;

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_site_settings_updated_at();

insert into public.projects (
  title,
  slug,
  project_url,
  summary,
  description,
  stack,
  featured,
  published,
  sort_order
)
values
  (
    'Bus Tracking System - Cloud Deployment & Infrastructure',
    'bus-tracking-system-cloud-deployment',
    null,
    'Cloud deployment and infrastructure administration for a full-stack bus tracking application on an Oracle Cloud Linux VM.',
    'Deployed and administered a full-stack application on an Oracle Cloud Linux VM using SSH for remote server configuration, service management, API/database connectivity, firewall setup, and troubleshooting.',
    array['Oracle Cloud Infrastructure (OCI)', 'Linux', 'Full-Stack Application'],
    true,
    true,
    0
  ),
  (
    'ForexCompanion - AI-Powered Forex Co-Pilot',
    'forexcompanion-ai-powered-forex-co-pilot',
    'https://forexcompanion.trade',
    'An AI-assisted Forex co-pilot combining a 7-indicator consensus engine with an LLM explanation layer.',
    'Built and deployed an AI-assisted Forex trading co-pilot combining a 7-indicator consensus engine with an LLM explanation layer; managed live deployment, custom DNS, and HTTPS routing.',
    array['7-Indicator Consensus Engine', 'LLM Explanation Layer', 'DNS', 'HTTPS'],
    false,
    true,
    1
  ),
  (
    'Lead Craft AI - AI Web Application',
    'lead-craft-ai',
    'https://lead-craft-ai.vercel.app',
    'A cloud-hosted web application deployed on Vercel and integrated with GitHub CI/CD.',
    'Deployed and maintained a cloud-hosted web application on Vercel integrated with GitHub CI/CD pipelines for automated builds and zero-downtime releases.',
    array['Vercel', 'GitHub CI/CD'],
    false,
    true,
    2
  ),
  (
    'CareerBridge - Web Platform',
    'careerbridge-web-platform',
    'https://careerbridge.cyou',
    'A live web platform configured with custom-domain routing and cloud hosting.',
    'Configured custom domain routing, DNS management, SSL/HTTPS certificates, and cloud hosting infrastructure for a live web platform.',
    array['DNS Management', 'SSL/HTTPS', 'Cloud Hosting'],
    false,
    true,
    3
  ),
  (
    'Paw Favortees - Web Application',
    'paw-favortees-web-application',
    'https://paw-favortees.vercel.app',
    'A responsive web application developed and deployed using Git/GitHub workflows.',
    'Developed and deployed a responsive web application using Git/GitHub version control and automated cloud deployment workflows.',
    array['Git', 'GitHub', 'Cloud Deployment'],
    false,
    true,
    4
  ),
  (
    'Personal Developer Portfolio',
    'personal-developer-portfolio',
    'https://sohaib-ahmed-five.vercel.app',
    'A personal portfolio presenting DevOps infrastructure projects and web deployments.',
    'Designed, built, and deployed a personal portfolio website showcasing DevOps infrastructure projects, web deployments, and professional profiles.',
    array['Git', 'GitHub', 'Cloud Deployment'],
    false,
    true,
    5
  )
on conflict (slug) do nothing;

update public.site_settings
set social_links = social_links || jsonb_build_array(jsonb_build_object(
  'label', 'LinkedIn',
  'url', 'https://linkedin.com/in/sohaib-ahmed-gondal-517a98225'
))
where id = 1
  and jsonb_array_length(social_links) < 8
  and not exists (
    select 1 from jsonb_array_elements(social_links) as item(link)
    where lower(link ->> 'label') = 'linkedin'
      or link ->> 'url' = 'https://linkedin.com/in/sohaib-ahmed-gondal-517a98225'
  );

update public.site_settings
set social_links = social_links || jsonb_build_array(jsonb_build_object(
  'label', 'GitHub',
  'url', 'https://github.com/asifgondal786'
))
where id = 1
  and jsonb_array_length(social_links) < 8
  and not exists (
    select 1 from jsonb_array_elements(social_links) as item(link)
    where lower(link ->> 'label') = 'github'
      or link ->> 'url' = 'https://github.com/asifgondal786'
  );

update public.site_settings
set social_links = social_links || jsonb_build_array(jsonb_build_object(
  'label', 'X',
  'url', 'https://x.com/commando_7jp91'
))
where id = 1
  and jsonb_array_length(social_links) < 8
  and not exists (
    select 1 from jsonb_array_elements(social_links) as item(link)
    where lower(link ->> 'label') = 'x'
      or link ->> 'url' = 'https://x.com/commando_7jp91'
  );
