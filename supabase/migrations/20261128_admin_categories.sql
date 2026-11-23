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
