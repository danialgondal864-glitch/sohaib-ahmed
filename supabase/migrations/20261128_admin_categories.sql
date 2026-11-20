create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique
    constraint categories_slug_format_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

with category_names as (
  select distinct btrim(category) as name
  from public.posts
  where btrim(category) <> ''
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
    coalesce(
      nullif(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''),
      'category'
    ) as base_slug
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

alter table public.posts
  add constraint posts_category_name_fkey
  foreign key (category)
  references public.categories(name)
  on update cascade
  on delete restrict
  not valid;

alter table public.posts validate constraint posts_category_name_fkey;
create index if not exists posts_category_idx on public.posts (category);

alter table public.categories enable row level security;
revoke all on table public.categories from anon, authenticated;
grant select on table public.categories to anon, authenticated;
grant insert, update, delete on table public.categories to authenticated;

drop policy if exists "Categories are publicly readable" on public.categories;
create policy "Categories are publicly readable"
on public.categories for select to anon, authenticated
using (true);

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
