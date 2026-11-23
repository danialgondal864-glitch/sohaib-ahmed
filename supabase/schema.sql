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
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Administrator role changes require a trusted service-role request.';
  end if;

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
grant insert, update, delete on table public.posts to authenticated;

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

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique
    constraint categories_slug_format_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  blank_category_count bigint;
begin
  select count(*) into blank_category_count
  from public.posts
  where category is null
     or regexp_replace(category, '[[:space:]]', '', 'g') = '';

  if blank_category_count > 0 then
    raise exception using
      errcode = '23514',
      message = 'Category migration requires manual review.',
      detail = format('%s post(s) have NULL, blank, or whitespace-only categories.', blank_category_count);
  end if;
end;
$$;

do $$
declare
  invalid_category_detail text;
begin
  with candidate_names as (
    select 'post category'::text as source, category as original_name
    from public.posts
    union all
    select 'existing category', name
    from public.categories
    union all
    select 'seed category', name
    from (values
      ('AI & Emerging Technologies'),
      ('Latest AI Tools'),
      ('Research & Analysis'),
      ('Problem Solving'),
      ('Cloud & DevOps'),
      ('Future Technologies')
    ) as defaults(name)
  ),
  normalized_names as (
    select
      source,
      original_name,
      regexp_replace(original_name, '^[[:space:]]+|[[:space:]]+$', '', 'g') as normalized_name
    from candidate_names
  ),
  proposed_slugs as (
    select
      source,
      original_name,
      normalized_name,
      nullif(trim(both '-' from regexp_replace(lower(normalized_name), '[^a-z0-9]+', '-', 'g')), '') as slug
    from normalized_names
  )
  select format(
    'Source=%s; value=%L; normalized=%L; slug=%L. Existing category names must not be padded, and every category must produce a valid slug.',
    source,
    original_name,
    normalized_name,
    slug
  )
  into invalid_category_detail
  from proposed_slugs
  where original_name is null
     or normalized_name = ''
     or (source = 'existing category' and original_name is distinct from normalized_name)
     or slug is null
     or slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  limit 1;

  if invalid_category_detail is not null then
    raise exception using
      errcode = '23514',
      message = 'Category migration found an invalid category name.',
      detail = invalid_category_detail;
  end if;
end;
$$;

do $$
declare
  duplicate_normalized_name_count bigint;
begin
  select count(*) into duplicate_normalized_name_count
  from (
    select normalized_name
    from (
      select regexp_replace(name, '^[[:space:]]+|[[:space:]]+$', '', 'g') as normalized_name
      from public.categories
    ) normalized_categories
    group by normalized_name
    having count(*) > 1
  ) duplicates;

  if duplicate_normalized_name_count > 0 then
    raise exception using
      errcode = '23505',
      message = 'Category migration requires manual review.',
      detail = 'Multiple category names would normalize to the same name.';
  end if;
end;
$$;

do $$
declare
  duplicate_existing_slug_count bigint;
begin
  select count(*) into duplicate_existing_slug_count
  from (
    select slug
    from public.categories
    group by slug
    having count(*) > 1
  ) duplicates;

  if duplicate_existing_slug_count > 0 then
    raise exception using
      errcode = '23505',
      message = 'Category migration found duplicate existing category slugs.',
      detail = 'Existing category records do not have unique slugs.';
  end if;
end;
$$;

do $$
declare
  proposed_slug_collision text;
begin
  select format(
    'Slug "%s" is produced by distinct category names "%s" and "%s".',
    proposed.slug,
    min(proposed.name),
    max(proposed.name)
  )
  into proposed_slug_collision
  from (
    select distinct candidates.name, candidates.slug
    from (
      select
        regexp_replace(category, '^[[:space:]]+|[[:space:]]+$', '', 'g') as name,
        left(
          nullif(trim(both '-' from regexp_replace(lower(regexp_replace(category, '^[[:space:]]+|[[:space:]]+$', '', 'g')), '[^a-z0-9]+', '-', 'g')), ''),
          70
        ) as slug
      from public.posts
      union all
      select
        name,
        left(
          nullif(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''),
          70
        )
      from (values
        ('AI & Emerging Technologies'),
        ('Latest AI Tools'),
        ('Research & Analysis'),
        ('Problem Solving'),
        ('Cloud & DevOps'),
        ('Future Technologies')
      ) as defaults(name)
    ) candidates
  ) proposed
  group by proposed.slug
  having count(*) > 1
  limit 1;

  if proposed_slug_collision is not null then
    raise exception using
      errcode = '23505',
      message = 'Category migration found a normalized category slug collision.',
      detail = proposed_slug_collision;
  end if;
end;
$$;

do $$
declare
  existing_slug_collision text;
begin
  select format(
    'Slug "%s" is proposed for "%s" but belongs to existing category "%s".',
    proposed.proposed_slug,
    proposed.proposed_name,
    existing.name
  )
  into existing_slug_collision
  from (
    select distinct
      left(
        nullif(trim(both '-' from regexp_replace(lower(regexp_replace(category, '^[[:space:]]+|[[:space:]]+$', '', 'g')), '[^a-z0-9]+', '-', 'g')), ''),
        70
      ) as proposed_slug,
      regexp_replace(category, '^[[:space:]]+|[[:space:]]+$', '', 'g') as proposed_name
    from public.posts
    union
    select
      left(
        nullif(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''),
        70
      ),
      name
    from (values
      ('AI & Emerging Technologies'),
      ('Latest AI Tools'),
      ('Research & Analysis'),
      ('Problem Solving'),
      ('Cloud & DevOps'),
      ('Future Technologies')
    ) as defaults(name)
  ) proposed
  join public.categories existing
    on existing.slug = proposed.proposed_slug
  where regexp_replace(existing.name, '^[[:space:]]+|[[:space:]]+$', '', 'g') is distinct from proposed.proposed_name
  limit 1;

  if existing_slug_collision is not null then
    raise exception using
      errcode = '23505',
      message = 'Category migration found an existing category slug collision.',
      detail = existing_slug_collision;
  end if;
end;
$$;

do $$
declare
  unrepresentable_category_count bigint;
begin
  select count(*) into unrepresentable_category_count
  from (
    select distinct
      regexp_replace(category, '^[[:space:]]+|[[:space:]]+$', '', 'g') as name,
      nullif(trim(both '-' from regexp_replace(lower(regexp_replace(category, '^[[:space:]]+|[[:space:]]+$', '', 'g')), '[^a-z0-9]+', '-', 'g')), '') as slug
    from public.posts
  ) proposed
  where proposed.name is null
     or proposed.name = ''
     or proposed.slug is null
     or proposed.slug not similar to '[a-z0-9]+(-[a-z0-9]+)*';

  if unrepresentable_category_count > 0 then
    raise exception using
      errcode = '23514',
      message = 'Category migration found a category name that cannot produce a valid slug.',
      detail = 'Normalize or remove invalid category values before migration.';
  end if;
end;
$$;

update public.categories
set name = regexp_replace(name, '^[[:space:]]+|[[:space:]]+$', '', 'g')
where name is distinct from regexp_replace(name, '^[[:space:]]+|[[:space:]]+$', '', 'g');

with category_names as (
  select distinct regexp_replace(category, '^[[:space:]]+|[[:space:]]+$', '', 'g') as name
  from public.posts
  union
  select name
  from (values
    ('AI & Emerging Technologies'),
    ('Latest AI Tools'),
    ('Research & Analysis'),
    ('Problem Solving'),
    ('Cloud & DevOps'),
    ('Future Technologies')
  ) as defaults(name)
),
normalized as (
  select
    name,
    nullif(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), '') as base_slug
  from category_names
),
disambiguated as (
  select
    name,
    base_slug,
    row_number() over (partition by base_slug order by name) as collision_number
  from normalized
)
insert into public.categories (name, slug)
select
  name,
  case
    when collision_number = 1 then left(base_slug, 70)
    else left(base_slug, 70) || '-' || substr(md5(name), 1, 8)
  end
from disambiguated
on conflict do nothing;

update public.posts
set category = regexp_replace(category, '^[[:space:]]+|[[:space:]]+$', '', 'g')
where category is distinct from regexp_replace(category, '^[[:space:]]+|[[:space:]]+$', '', 'g');

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.posts'::regclass
      and conname = 'posts_category_name_fkey'
  ) then
    alter table public.posts
      add constraint posts_category_name_fkey
      foreign key (category)
      references public.categories(name)
      on update cascade
      on delete restrict
      not valid;
  end if;
end;
$$;

alter table public.posts validate constraint posts_category_name_fkey;
create index if not exists posts_category_idx on public.posts (category);

alter table public.categories enable row level security;
revoke all on table public.categories from anon, authenticated;
grant select on table public.categories to anon, authenticated;
grant insert, update, delete on table public.categories to authenticated;

drop policy if exists "Categories are publicly readable" on public.categories;
do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_attribute
    where attrelid = 'public.categories'::regclass
      and attname = 'is_active'
      and not attisdropped
  ) then
    execute $policy$
      create policy "Categories are publicly readable"
      on public.categories for select to anon, authenticated
      using (
        is_active
        or exists (
          select 1 from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
    $policy$;
  else
    execute $policy$
      create policy "Categories are publicly readable"
      on public.categories for select to anon, authenticated
      using (true)
    $policy$;
  end if;
end;
$$;

drop policy if exists "Admins can create categories" on public.categories;
create policy "Admins can create categories"
on public.categories for insert to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can update categories" on public.categories;
create policy "Admins can update categories"
on public.categories for update to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can delete categories" on public.categories;
create policy "Admins can delete categories"
on public.categories for delete to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create or replace function public.set_category_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.set_category_updated_at() from public, anon, authenticated;

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_category_updated_at();

alter table public.contact_messages
  add column if not exists is_read boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists status text not null default 'new',
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.contact_messages'::regclass
      and conname = 'contact_messages_status_check'
  ) then
    alter table public.contact_messages
      add constraint contact_messages_status_check
      check (status in ('new', 'in_progress', 'resolved'));
  end if;
end;
$$;

create index if not exists contact_messages_inbox_order_idx
  on public.contact_messages (archived_at, is_read, created_at desc);

alter table public.contact_messages enable row level security;
revoke all on table public.contact_messages from anon, authenticated;
grant select, delete on table public.contact_messages to authenticated;
grant update (is_read, archived_at, status, updated_at) on table public.contact_messages to authenticated;

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

drop policy if exists "Admins can update contact messages" on public.contact_messages;
create policy "Admins can update contact messages"
on public.contact_messages for update to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can delete contact messages" on public.contact_messages;
create policy "Admins can delete contact messages"
on public.contact_messages for delete to authenticated
using (
  archived_at is not null
  and
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

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

-- Multi-author publishing, moderation, reports, and scheduled delivery.
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists bio text,
  add column if not exists avatar_url text,
  add column if not exists author_slug text,
  add column if not exists website_url text,
  add column if not exists author_profile_public boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_author_slug_format_check'
  ) then
    alter table public.profiles
      add constraint profiles_author_slug_format_check
        check (author_slug is null or author_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_author_bio_length_check'
  ) then
    alter table public.profiles
      add constraint profiles_author_bio_length_check
        check (bio is null or length(bio) <= 1200);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_author_avatar_url_check'
  ) then
    alter table public.profiles
      add constraint profiles_author_avatar_url_check
        check (avatar_url is null or (avatar_url ~* '^https?://' and avatar_url !~ '://[^/]*@'));
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_author_website_url_check'
  ) then
    alter table public.profiles
      add constraint profiles_author_website_url_check
        check (website_url is null or (website_url ~* '^https?://' and website_url !~ '://[^/]*@'));
  end if;
end;
$$;

create unique index if not exists profiles_author_slug_unique_idx
  on public.profiles (author_slug)
  where author_slug is not null;

grant update (display_name, bio, avatar_url, author_slug, website_url, author_profile_public)
  on public.profiles to authenticated;

create or replace view public.author_profiles as
select
  id,
  coalesce(nullif(display_name, ''), nullif(full_name, ''), 'Author') as display_name,
  bio,
  avatar_url,
  author_slug,
  website_url
from public.profiles
where author_profile_public and author_slug is not null;

revoke all on public.author_profiles from public, anon, authenticated;
grant select on public.author_profiles to anon, authenticated;

alter table public.categories
  add column if not exists content_type text not null default 'all'
    constraint categories_content_type_check check (content_type in ('all', 'article', 'video', 'podcast')),
  add column if not exists parent_id uuid references public.categories(id) on delete set null,
  add column if not exists description text not null default ''
    constraint categories_description_length_check check (length(description) <= 500),
  add column if not exists sort_order integer not null default 0
    constraint categories_sort_order_check check (sort_order >= 0),
  add column if not exists is_active boolean not null default true;

drop policy if exists "Categories are publicly readable" on public.categories;
drop policy if exists "Active categories are publicly readable" on public.categories;
create policy "Active categories are publicly readable"
on public.categories for select to anon, authenticated
using (
  is_active
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

create or replace function public.guard_category_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception using errcode = '23514', message = 'A category cannot be its own parent.';
  end if;
  if exists (
    with recursive ancestors(id, parent_id) as (
      select categories.id, categories.parent_id
      from public.categories
      where categories.id = new.parent_id
      union all
      select categories.id, categories.parent_id
      from public.categories
      join ancestors on categories.id = ancestors.parent_id
    )
    select 1 from ancestors where ancestors.id = new.id
  ) then
    raise exception using errcode = '23514', message = 'Category nesting cannot contain a cycle.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_category_parent() from public, anon, authenticated;
drop trigger if exists categories_guard_parent on public.categories;
create trigger categories_guard_parent
  before insert or update on public.categories
  for each row execute function public.guard_category_parent();

alter table public.posts
  add column if not exists content_type text not null default 'article'
    constraint posts_content_type_check check (content_type in ('article', 'video', 'podcast')),
  add column if not exists workflow_status text not null default 'draft'
    constraint posts_workflow_status_check check (
      workflow_status in ('draft', 'pending_review', 'changes_requested', 'approved', 'rejected', 'published', 'archived')
    ),
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists review_feedback text,
  add column if not exists published_at timestamptz,
  add column if not exists scheduled_at timestamptz,
  add column if not exists cover_image_url text,
  add column if not exists cover_image_path text,
  add column if not exists video_url text,
  add column if not exists audio_url text,
  add column if not exists duration_seconds integer,
  add column if not exists tags text[] not null default '{}',
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists featured boolean not null default false,
  add column if not exists subcategory_id uuid references public.categories(id) on delete set null;

update public.posts
set workflow_status = case when published then 'published' else 'draft' end,
    published_at = case when published then coalesce(published_at, created_at) else published_at end
where workflow_status = 'draft' and published;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.posts'::regclass
      and conname = 'posts_content_lengths_check'
  ) then
    alter table public.posts
      add constraint posts_content_lengths_check
        check (
          length(title) between 1 and 200
          and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
          and length(excerpt) between 1 and 500
          and length(content) <= 50000
        ) not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.posts'::regclass
      and conname = 'posts_research_array_limits_check'
  ) then
    alter table public.posts
      add constraint posts_research_array_limits_check
        check (
          cardinality(verified_facts) <= 50
          and cardinality(research_findings) <= 50
          and cardinality(opinions) <= 50
          and cardinality(proposed_solutions) <= 50
          and jsonb_array_length(sources) <= 50
        ) not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.posts'::regclass
      and conname = 'posts_read_time_check'
  ) then
    alter table public.posts
      add constraint posts_read_time_check
        check (read_time between 1 and 120);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.posts'::regclass
      and conname = 'posts_duration_seconds_check'
  ) then
    alter table public.posts
      add constraint posts_duration_seconds_check
        check (duration_seconds is null or duration_seconds between 1 and 86400);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.posts'::regclass
      and conname = 'posts_tags_count_check'
  ) then
    alter table public.posts
      add constraint posts_tags_count_check
        check (cardinality(tags) <= 30);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.posts'::regclass
      and conname = 'posts_cover_image_url_check'
  ) then
    alter table public.posts
      add constraint posts_cover_image_url_check
        check (cover_image_url is null or (cover_image_url ~* '^https?://' and cover_image_url !~ '://[^/]*@'));
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.posts'::regclass
      and conname = 'posts_cover_image_path_check'
  ) then
    alter table public.posts
      add constraint posts_cover_image_path_check
        check (
          cover_image_path is null
          or cover_image_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](avif|gif|jpg|png|webp)$'
        );
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.posts'::regclass
      and conname = 'posts_cover_image_source_exclusive_check'
  ) then
    alter table public.posts
      add constraint posts_cover_image_source_exclusive_check
        check (cover_image_path is null or cover_image_url is null);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.posts'::regclass
      and conname = 'posts_video_url_check'
  ) then
    alter table public.posts
      add constraint posts_video_url_check
        check (video_url is null or (video_url ~* '^https?://' and video_url !~ '://[^/]*@'));
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.posts'::regclass
      and conname = 'posts_audio_url_check'
  ) then
    alter table public.posts
      add constraint posts_audio_url_check
        check (audio_url is null or (audio_url ~* '^https?://' and audio_url !~ '://[^/]*@'));
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.posts'::regclass
      and conname = 'posts_video_published_url_check'
  ) then
    alter table public.posts
      add constraint posts_video_published_url_check
        check (not published or content_type <> 'video' or video_url is not null);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.posts'::regclass
      and conname = 'posts_podcast_published_url_check'
  ) then
    alter table public.posts
      add constraint posts_podcast_published_url_check
        check (not published or content_type <> 'podcast' or audio_url is not null);
  end if;
end;
$$;

create index if not exists posts_workflow_author_idx
  on public.posts (author_id, workflow_status, updated_at desc);
create index if not exists posts_publication_type_idx
  on public.posts (content_type, published_at desc)
  where published and workflow_status = 'published';
create index if not exists posts_schedule_idx
  on public.posts (scheduled_at)
  where scheduled_at is not null and workflow_status = 'approved';
create index if not exists categories_parent_order_idx
  on public.categories (parent_id, sort_order, name);

drop policy if exists "Published posts are viewable by everyone" on public.posts;
create policy "Published posts are viewable by everyone"
on public.posts for select to anon, authenticated
using (
  (
    published
    and workflow_status = 'published'
    and (scheduled_at is null or scheduled_at <= now())
  )
  or author_id = auth.uid()
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

drop policy if exists "Authors can create their own submissions" on public.posts;
create policy "Authors can create their own submissions"
on public.posts for insert to authenticated
with check (
  author_id = auth.uid()
  and not published
  and workflow_status in ('draft', 'pending_review')
);

drop policy if exists "Authors can update their own editable submissions" on public.posts;
create policy "Authors can update their own editable submissions"
on public.posts for update to authenticated
using (
  author_id = auth.uid()
  and workflow_status in ('draft', 'changes_requested', 'rejected')
)
with check (
  author_id = auth.uid()
  and not published
  and workflow_status in ('draft', 'pending_review')
);

drop policy if exists "Authors can delete their own editable submissions" on public.posts;
create policy "Authors can delete their own editable submissions"
on public.posts for delete to authenticated
using (
  author_id = auth.uid()
  and workflow_status in ('draft', 'changes_requested', 'rejected')
);

create or replace function public.guard_post_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_is_admin boolean;
begin
  select exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ) into caller_is_admin;

  if caller_is_admin or auth.role() = 'service_role' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.author_id is distinct from auth.uid()
      or new.published
      or new.workflow_status not in ('draft', 'pending_review')
      or new.reviewed_by is not null
      or new.reviewed_at is not null
      or new.review_feedback is not null
      or new.published_at is not null
      or new.scheduled_at is not null
      or (
        new.cover_image_path is not null
        and split_part(new.cover_image_path, '/', 1) <> auth.uid()::text
      )
      or new.featured
    then
      raise exception using errcode = '42501', message = 'Authors may only create their own draft or review submission.';
    end if;

    if not exists (
      select 1 from public.categories
      where categories.name = new.category
        and categories.is_active
        and categories.content_type in ('all', new.content_type)
    ) then
      raise exception using errcode = '23503', message = 'Select an active category for this content type.';
    end if;

    if new.workflow_status = 'pending_review' then
      if (new.content_type = 'video' and new.video_url is null)
        or (new.content_type = 'podcast' and new.audio_url is null) then
        raise exception using errcode = '22023', message = 'Add the video or audio URL before submitting for review.';
      end if;
      new.submitted_at := now();
    else
      new.submitted_at := null;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.author_id is distinct from auth.uid()
      or old.workflow_status not in ('draft', 'changes_requested', 'rejected')
      or new.author_id is distinct from old.author_id
      or new.published
      or new.workflow_status not in ('draft', 'pending_review')
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at
      or new.review_feedback is distinct from old.review_feedback
      or new.published_at is distinct from old.published_at
      or new.scheduled_at is distinct from old.scheduled_at
      or (
        new.cover_image_path is not null
        and split_part(new.cover_image_path, '/', 1) <> auth.uid()::text
      )
      or new.featured is distinct from old.featured
    then
      raise exception using errcode = '42501', message = 'Authors may only edit their own drafts or requested changes.';
    end if;

    if not exists (
      select 1 from public.categories
      where categories.name = new.category
        and categories.is_active
        and categories.content_type in ('all', new.content_type)
    ) then
      raise exception using errcode = '23503', message = 'Select an active category for this content type.';
    end if;

    if new.workflow_status = 'pending_review' and old.workflow_status <> 'pending_review' then
      if (new.content_type = 'video' and new.video_url is null)
        or (new.content_type = 'podcast' and new.audio_url is null) then
        raise exception using errcode = '22023', message = 'Add the video or audio URL before submitting for review.';
      end if;
      new.submitted_at := now();
    else
      new.submitted_at := old.submitted_at;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.author_id = auth.uid()
      and old.workflow_status in ('draft', 'changes_requested', 'rejected') then
      return old;
    end if;
    raise exception using errcode = '42501', message = 'Authors may only delete their own editable submissions.';
  end if;

  return null;
end;
$$;

revoke all on function public.guard_post_workflow() from public, anon, authenticated;
drop trigger if exists posts_guard_workflow on public.posts;
create trigger posts_guard_workflow
  before insert or update or delete on public.posts
  for each row execute function public.guard_post_workflow();

create or replace function public.validate_post_category_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.categories
    where categories.name = new.category
      and categories.content_type in ('all', new.content_type)
  ) then
    raise exception using errcode = '23503', message = 'Select a category compatible with this publication type.';
  end if;

  if new.subcategory_id is not null and not exists (
    select 1
    from public.categories as child
    join public.categories as parent on parent.id = child.parent_id
    where child.id = new.subcategory_id
      and child.content_type in ('all', new.content_type)
      and parent.name = new.category
  ) then
    raise exception using errcode = '23503', message = 'Select a subcategory under the selected category.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_post_category_assignment() from public, anon, authenticated;
drop trigger if exists posts_validate_category_assignment on public.posts;
create trigger posts_validate_category_assignment
  before insert or update on public.posts
  for each row execute function public.validate_post_category_assignment();

create table if not exists public.content_reviews (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete set null,
  post_title text not null,
  post_slug text not null,
  reviewer_id uuid references public.profiles(id) on delete set null,
  action text not null,
  previous_status text,
  new_status text not null,
  feedback text,
  scheduled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists content_reviews_post_created_idx
  on public.content_reviews (post_id, created_at desc);
create index if not exists content_reviews_reviewer_created_idx
  on public.content_reviews (reviewer_id, created_at desc);

alter table public.content_reviews enable row level security;
revoke all on table public.content_reviews from anon, authenticated;
grant select on table public.content_reviews to authenticated;

drop policy if exists "Authors and admins can read content review history" on public.content_reviews;
create policy "Authors and admins can read content review history"
on public.content_reviews for select to authenticated
using (
  reviewer_id = auth.uid()
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
  or exists (
    select 1 from public.posts
    where posts.id = content_reviews.post_id and posts.author_id = auth.uid()
  )
);

create or replace function public.record_content_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_status text;
  action_name text;
begin
  if tg_op = 'INSERT' then
    old_status := null;
  else
    old_status := old.workflow_status;
    if old.workflow_status is not distinct from new.workflow_status
      and old.published is not distinct from new.published then
      return new;
    end if;
  end if;

  action_name := case
    when new.workflow_status = 'pending_review' then 'submitted'
    when new.workflow_status = 'changes_requested' then 'requested_changes'
    when new.workflow_status = 'published' then 'published'
    when new.workflow_status = 'archived' then 'archived'
    when new.workflow_status = 'rejected' then 'rejected'
    when old_status = 'published' and new.workflow_status = 'approved' then 'unpublished'
    when old_status = 'archived' and new.workflow_status = 'draft' then 'restored'
    when new.scheduled_at is not null then 'scheduled'
    when new.workflow_status = 'approved' then 'approved'
    else 'status_changed'
  end;

  insert into public.content_reviews (
    post_id, post_title, post_slug, reviewer_id, action,
    previous_status, new_status, feedback, scheduled_at
  ) values (
    new.id, new.title, new.slug, auth.uid(), action_name,
    old_status, new.workflow_status, new.review_feedback, new.scheduled_at
  );
  return new;
end;
$$;

revoke all on function public.record_content_review() from public, anon, authenticated;
drop trigger if exists posts_record_content_review on public.posts;
create trigger posts_record_content_review
  after insert or update on public.posts
  for each row execute function public.record_content_review();

create table if not exists public.author_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  notification_type text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists author_notifications_user_order_idx
  on public.author_notifications (user_id, created_at desc);

alter table public.author_notifications enable row level security;
revoke all on table public.author_notifications from anon, authenticated;
grant select on table public.author_notifications to authenticated;
grant update (read_at) on table public.author_notifications to authenticated;

drop policy if exists "Users can read their own author notifications" on public.author_notifications;
create policy "Users can read their own author notifications"
on public.author_notifications for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can mark their own author notifications read" on public.author_notifications;
create policy "Users can mark their own author notifications read"
on public.author_notifications for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.notify_content_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_type text;
  notification_message text;
begin
  if new.workflow_status = 'pending_review' and tg_op = 'INSERT' then
    insert into public.author_notifications (user_id, post_id, notification_type, message)
    select profiles.id, new.id, 'submission_received',
      'A new ' || new.content_type || ' submission is ready for review: ' || new.title
    from public.profiles
    where profiles.role = 'admin';
  elsif tg_op = 'UPDATE' then
    if new.workflow_status = 'pending_review'
      and old.workflow_status is distinct from new.workflow_status then
      insert into public.author_notifications (user_id, post_id, notification_type, message)
      select profiles.id, new.id, 'submission_received',
        'A new ' || new.content_type || ' submission is ready for review: ' || new.title
      from public.profiles
      where profiles.role = 'admin';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if old.workflow_status is distinct from new.workflow_status
      and new.author_id is not null and new.workflow_status <> 'pending_review' then
    notification_type := case
      when new.workflow_status = 'changes_requested' then 'changes_requested'
      when new.workflow_status = 'approved' and old.workflow_status = 'published' then 'unpublished'
      when new.workflow_status = 'approved' and new.scheduled_at is not null then 'scheduled'
      when new.workflow_status = 'approved' then 'approved'
      when new.workflow_status = 'published' then 'published'
      when new.workflow_status = 'rejected' then 'rejected'
      when new.workflow_status = 'archived' then 'archived'
      when new.workflow_status = 'draft' and old.workflow_status = 'archived' then 'restored'
      else 'status_changed'
    end;
    notification_message := case notification_type
      when 'changes_requested' then 'Changes were requested for: ' || new.title
      when 'unpublished' then 'Your publication was unpublished: ' || new.title
      when 'scheduled' then 'Your publication is scheduled: ' || new.title
      when 'approved' then 'Your submission was approved: ' || new.title
      when 'published' then 'Your publication is live: ' || new.title
      when 'rejected' then 'Your submission was declined: ' || new.title
      when 'archived' then 'Your publication was archived: ' || new.title
      when 'restored' then 'Your publication was restored to draft: ' || new.title
      else 'The status of your content changed: ' || new.title
    end;
    insert into public.author_notifications (user_id, post_id, notification_type, message)
    values (new.author_id, new.id, notification_type, notification_message);
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.notify_content_workflow() from public, anon, authenticated;
drop trigger if exists posts_notify_content_workflow on public.posts;
create trigger posts_notify_content_workflow
  after insert or update on public.posts
  for each row execute function public.notify_content_workflow();

create or replace function public.review_content(
  p_post_id uuid,
  p_action text,
  p_feedback text default null,
  p_scheduled_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  current_post public.posts%rowtype;
  current_user_id uuid := auth.uid();
  feedback_text text := nullif(btrim(p_feedback), '');
begin
  if not exists (
    select 1 from public.profiles
    where profiles.id = current_user_id and profiles.role = 'admin'
  ) then
    raise exception using errcode = '42501', message = 'Administrator access is required.';
  end if;

  if feedback_text is not null and length(feedback_text) > 4000 then
    raise exception using errcode = '22023', message = 'Review feedback must be 4000 characters or fewer.';
  end if;

  select * into current_post
  from public.posts
  where posts.id = p_post_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Content was not found.';
  end if;
  current_status := current_post.workflow_status;

  if p_action = 'approve' then
    if current_status <> 'pending_review' then
      raise exception using errcode = '22023', message = 'Only pending submissions can be approved.';
    end if;
    update public.posts set workflow_status = 'approved', published = false,
      scheduled_at = null, reviewed_by = current_user_id, reviewed_at = now(),
      review_feedback = null, updated_at = now()
    where id = p_post_id;
  elsif p_action = 'request_changes' then
    if current_status <> 'pending_review' or feedback_text is null then
      raise exception using errcode = '22023', message = 'Pending submissions require feedback before changes can be requested.';
    end if;
    update public.posts set workflow_status = 'changes_requested', published = false,
      scheduled_at = null, reviewed_by = current_user_id, reviewed_at = now(),
      review_feedback = feedback_text, updated_at = now()
    where id = p_post_id;
  elsif p_action = 'reject' then
    if current_status <> 'pending_review' or feedback_text is null then
      raise exception using errcode = '22023', message = 'Pending submissions require feedback before rejection.';
    end if;
    update public.posts set workflow_status = 'rejected', published = false,
      scheduled_at = null, reviewed_by = current_user_id, reviewed_at = now(),
      review_feedback = feedback_text, updated_at = now()
    where id = p_post_id;
  elsif p_action = 'publish' then
    if current_status not in ('draft', 'approved') then
      raise exception using errcode = '22023', message = 'Only drafts or approved content can be published.';
    end if;
    update public.posts set workflow_status = 'published', published = true,
      published_at = now(), scheduled_at = null, reviewed_by = current_user_id,
      reviewed_at = now(), review_feedback = null, updated_at = now()
    where id = p_post_id;
  elsif p_action = 'schedule' then
    if current_status not in ('draft', 'approved')
      or p_scheduled_at is null
      or p_scheduled_at <= now() then
      raise exception using errcode = '22023', message = 'Choose a future publication time for a draft or approved submission.';
    end if;
    update public.posts set workflow_status = 'approved', published = false,
      scheduled_at = p_scheduled_at, reviewed_by = current_user_id,
      reviewed_at = now(), review_feedback = null, updated_at = now()
    where id = p_post_id;
  elsif p_action = 'unpublish' then
    if current_status <> 'published' then
      raise exception using errcode = '22023', message = 'Only published content can be unpublished.';
    end if;
    update public.posts set workflow_status = 'approved', published = false,
      scheduled_at = null, reviewed_by = current_user_id, reviewed_at = now(),
      updated_at = now()
    where id = p_post_id;
  elsif p_action = 'archive' then
    if current_status = 'archived' then
      raise exception using errcode = '22023', message = 'Content is already archived.';
    end if;
    update public.posts set workflow_status = 'archived', published = false,
      scheduled_at = null, reviewed_by = current_user_id, reviewed_at = now(),
      updated_at = now()
    where id = p_post_id;
  elsif p_action = 'restore' then
    if current_status <> 'archived' then
      raise exception using errcode = '22023', message = 'Only archived content can be restored.';
    end if;
    update public.posts set workflow_status = 'draft', published = false,
      scheduled_at = null, reviewed_by = current_user_id, reviewed_at = now(),
      review_feedback = null, updated_at = now()
    where id = p_post_id;
  else
    raise exception using errcode = '22023', message = 'Unknown content review action.';
  end if;

  return p_action;
end;
$$;

revoke all on function public.review_content(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.review_content(uuid, text, text, timestamptz) to authenticated;

create or replace function public.publish_scheduled_content()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  published_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Scheduled publishing requires a trusted server request.';
  end if;

  update public.posts
  set workflow_status = 'published',
      published = true,
      published_at = now(),
      scheduled_at = null,
      reviewed_at = coalesce(reviewed_at, now()),
      updated_at = now()
  where workflow_status = 'approved'
    and scheduled_at is not null
    and scheduled_at <= now();

  get diagnostics published_count = row_count;
  return published_count;
end;
$$;

revoke all on function public.publish_scheduled_content() from public, anon, authenticated;
grant execute on function public.publish_scheduled_content() to service_role;

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete set null,
  post_title text not null,
  post_slug text not null,
  reporter_id uuid references public.profiles(id) on delete set null,
  reason text not null check (reason in ('misinformation', 'spam', 'copyright', 'abuse', 'other')),
  details text not null default '' check (length(details) <= 2000),
  status text not null default 'new' check (status in ('new', 'in_review', 'resolved', 'dismissed')),
  admin_notes text,
  handled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists content_reports_reporter_reason_unique_idx
  on public.content_reports (post_id, reporter_id, reason)
  where reporter_id is not null;
create index if not exists content_reports_status_created_idx
  on public.content_reports (status, created_at desc);

alter table public.content_reports enable row level security;
revoke all on table public.content_reports from anon, authenticated;
grant select on table public.content_reports to authenticated;
grant insert (post_id, post_title, post_slug, reporter_id, reason, details)
  on public.content_reports to authenticated;
grant update (status, admin_notes, handled_by, updated_at)
  on public.content_reports to authenticated;

drop policy if exists "Authenticated users can report published content" on public.content_reports;
create policy "Authenticated users can report published content"
on public.content_reports for insert to authenticated
with check (
  reporter_id = auth.uid()
  and exists (
    select 1 from public.posts
    where posts.id = content_reports.post_id
      and posts.title = content_reports.post_title
      and posts.slug = content_reports.post_slug
      and posts.published
      and posts.workflow_status = 'published'
  )
);

drop policy if exists "Admins can read content reports" on public.content_reports;
create policy "Admins can read content reports"
on public.content_reports for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can update content reports" on public.content_reports;
create policy "Admins can update content reports"
on public.content_reports for update to authenticated
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'author-submission-media',
  'author-submission-media',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do nothing;

drop policy if exists "Authors can upload their own submission covers" on storage.objects;
create policy "Authors can upload their own submission covers"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'author-submission-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authors and admins can read submission covers" on storage.objects;
create policy "Authors and admins can read submission covers"
on storage.objects for select to authenticated
using (
  bucket_id = 'author-submission-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
    or exists (
      select 1 from public.posts
      where posts.cover_image_path = storage.objects.name
        and posts.published
        and posts.workflow_status = 'published'
        and (posts.scheduled_at is null or posts.scheduled_at <= now())
    )
  )
);

drop policy if exists "Published submission covers are publicly readable" on storage.objects;
create policy "Published submission covers are publicly readable"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'author-submission-media'
  and exists (
    select 1 from public.posts
    where posts.cover_image_path = storage.objects.name
      and posts.published
      and posts.workflow_status = 'published'
      and (posts.scheduled_at is null or posts.scheduled_at <= now())
  )
);

create or replace function public.can_delete_author_submission_media(p_object_name text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  folder_names text[];
  caller_is_admin boolean;
begin
  if auth.uid() is null or p_object_name is null then
    return false;
  end if;

  folder_names := storage.foldername(p_object_name);
  if folder_names is null
    or array_length(folder_names, 1) <> 1
    or folder_names[1] is null then
    return false;
  end if;

  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  ) into caller_is_admin;

  if not caller_is_admin and folder_names[1] <> auth.uid()::text then
    return false;
  end if;

  return not exists (
    select 1
    from public.posts
    where posts.cover_image_path = p_object_name
  );
end;
$$;

revoke all on function public.can_delete_author_submission_media(text) from public, anon;
grant execute on function public.can_delete_author_submission_media(text) to authenticated;

drop policy if exists "Admins can upload contributor submission covers" on storage.objects;
create policy "Admins can upload contributor submission covers"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'author-submission-media'
  and array_length(storage.foldername(name), 1) = 1
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Authors and admins can delete unused submission covers" on storage.objects;
create policy "Authors and admins can delete unused submission covers"
on storage.objects for delete to authenticated
using (
  bucket_id = 'author-submission-media'
  and public.can_delete_author_submission_media(name)
);
