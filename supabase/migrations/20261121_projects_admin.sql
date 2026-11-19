create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique
    constraint projects_slug_format_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
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
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can create projects" on public.projects;
create policy "Admins can create projects"
on public.projects for insert to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can update projects" on public.projects;
create policy "Admins can update projects"
on public.projects for update to authenticated
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

drop policy if exists "Admins can delete projects" on public.projects;
create policy "Admins can delete projects"
on public.projects for delete to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
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
