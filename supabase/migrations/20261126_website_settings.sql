create table if not exists public.site_settings (
  id integer primary key check (id = 1),
  site_title text not null
    constraint site_settings_title_length_check check (char_length(site_title) between 1 and 120),
  seo_description text not null
    constraint site_settings_description_length_check check (char_length(seo_description) between 1 and 320),
  contact_email text not null
    constraint site_settings_email_length_check check (char_length(contact_email) between 3 and 254),
  contact_phones text[] not null default '{}'
    constraint site_settings_phone_count_check check (cardinality(contact_phones) <= 5),
  contact_location text
    constraint site_settings_location_length_check check (contact_location is null or char_length(contact_location) <= 160),
  social_links jsonb not null default '[]'::jsonb
    constraint site_settings_social_links_check check (
      case
        when jsonb_typeof(social_links) = 'array' then jsonb_array_length(social_links) <= 8
        else false
      end
    ),
  announcement text
    constraint site_settings_announcement_length_check check (announcement is null or char_length(announcement) <= 240),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.site_settings enable row level security;
revoke all on table public.site_settings from anon, authenticated;
grant select on table public.site_settings to anon, authenticated;
grant update (
  site_title,
  seo_description,
  contact_email,
  contact_phones,
  contact_location,
  social_links,
  announcement,
  updated_by
) on table public.site_settings to authenticated;

insert into public.site_settings (
  id,
  site_title,
  seo_description,
  contact_email,
  contact_phones,
  contact_location
)
values (
  1,
  'Sohaib Ahmed | Cloud, DevOps & Infrastructure',
  'Personal portfolio of Sohaib Ahmed — Linux, cloud infrastructure, DevOps and technology research.',
  'sohaibg446@gmail.com',
  array['0321-5085443', '0314-3310064'],
  'Yusuf Town, 49 Tail, Sargodha, Punjab, Pakistan'
)
on conflict (id) do nothing;

drop policy if exists "Website settings are publicly readable" on public.site_settings;
create policy "Website settings are publicly readable"
on public.site_settings for select to anon, authenticated
using (id = 1);

drop policy if exists "Admins can update website settings" on public.site_settings;
create policy "Admins can update website settings"
on public.site_settings for update to authenticated
using (
  id = 1
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  id = 1
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create or replace function public.set_site_settings_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.set_site_settings_updated_at() from public, anon, authenticated;

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_site_settings_updated_at();
