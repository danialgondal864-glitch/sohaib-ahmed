revoke update (role) on table public.profiles from service_role;

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
