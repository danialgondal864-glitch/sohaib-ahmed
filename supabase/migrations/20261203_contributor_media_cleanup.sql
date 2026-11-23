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
