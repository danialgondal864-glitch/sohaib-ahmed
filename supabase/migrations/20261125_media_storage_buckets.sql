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
