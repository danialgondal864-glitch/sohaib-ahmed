alter table public.contact_messages
  add column if not exists is_read boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists status text not null default 'new';

alter table public.contact_messages
  add constraint contact_messages_status_check
  check (status in ('new', 'in_progress', 'resolved'));

alter table public.contact_messages
  add column if not exists updated_at timestamptz not null default now();

create index if not exists contact_messages_inbox_order_idx
  on public.contact_messages (archived_at, is_read, created_at desc);

alter table public.contact_messages enable row level security;
revoke all on table public.contact_messages from anon, authenticated;
grant select, delete on table public.contact_messages to authenticated;
grant update (is_read, archived_at, status, updated_at) on table public.contact_messages to authenticated;

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

drop policy if exists "Admins can update contact messages" on public.contact_messages;
create policy "Admins can update contact messages"
on public.contact_messages for update to authenticated
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

drop policy if exists "Admins can delete contact messages" on public.contact_messages;
create policy "Admins can delete contact messages"
on public.contact_messages for delete to authenticated
using (
  archived_at is not null
  and
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
