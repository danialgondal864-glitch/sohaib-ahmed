alter table public.posts enable row level security;
revoke all on table public.posts from anon, authenticated;
grant select on table public.posts to anon, authenticated;
