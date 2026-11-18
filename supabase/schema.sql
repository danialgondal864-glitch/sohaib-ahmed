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

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles for select to authenticated
using (auth.uid() = id);

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
