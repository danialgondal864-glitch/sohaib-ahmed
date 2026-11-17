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

alter table public.posts enable row level security;

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
create policy "Admins can create posts"
on public.posts for insert to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can update posts" on public.posts;
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

drop policy if exists "Admins can delete posts" on public.posts;
create policy "Admins can delete posts"
on public.posts for delete to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);
