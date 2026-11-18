alter table public.contact_messages
  add column if not exists source_hash text;

create index if not exists contact_messages_source_hash_created_at_idx
  on public.contact_messages (source_hash, created_at desc)
  where source_hash is not null;

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
