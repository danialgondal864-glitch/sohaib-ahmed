alter table public.posts
  add column if not exists verified_facts text[] not null default '{}',
  add column if not exists research_findings text[] not null default '{}',
  add column if not exists opinions text[] not null default '{}',
  add column if not exists proposed_solutions text[] not null default '{}',
  add column if not exists sources jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.posts'::regclass
      and conname = 'posts_sources_array_check'
  ) then
    alter table public.posts
      add constraint posts_sources_array_check
      check (jsonb_typeof(sources) = 'array');
  end if;
end;
$$;

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
