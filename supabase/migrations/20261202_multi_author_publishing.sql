alter table public.profiles
  add column if not exists display_name text,
  add column if not exists bio text,
  add column if not exists avatar_url text,
  add column if not exists author_slug text,
  add column if not exists website_url text,
  add column if not exists author_profile_public boolean not null default false;

alter table public.profiles
  add constraint profiles_author_slug_format_check
    check (author_slug is null or author_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  add constraint profiles_author_bio_length_check
    check (bio is null or length(bio) <= 1200),
  add constraint profiles_author_avatar_url_check
    check (avatar_url is null or (avatar_url ~* '^https?://' and avatar_url !~ '://[^/]*@')),
  add constraint profiles_author_website_url_check
    check (website_url is null or (website_url ~* '^https?://' and website_url !~ '://[^/]*@'));

create unique index if not exists profiles_author_slug_unique_idx
  on public.profiles (author_slug)
  where author_slug is not null;

grant update (display_name, bio, avatar_url, author_slug, website_url, author_profile_public)
  on public.profiles to authenticated;

create or replace view public.author_profiles as
select
  id,
  coalesce(nullif(display_name, ''), nullif(full_name, ''), 'Author') as display_name,
  bio,
  avatar_url,
  author_slug,
  website_url
from public.profiles
where author_profile_public and author_slug is not null;

revoke all on public.author_profiles from public, anon, authenticated;
grant select on public.author_profiles to anon, authenticated;

alter table public.categories
  add column if not exists content_type text not null default 'all'
    constraint categories_content_type_check check (content_type in ('all', 'article', 'video', 'podcast')),
  add column if not exists parent_id uuid references public.categories(id) on delete set null,
  add column if not exists description text not null default ''
    constraint categories_description_length_check check (length(description) <= 500),
  add column if not exists sort_order integer not null default 0
    constraint categories_sort_order_check check (sort_order >= 0),
  add column if not exists is_active boolean not null default true;

drop policy if exists "Categories are publicly readable" on public.categories;
drop policy if exists "Active categories are publicly readable" on public.categories;
create policy "Active categories are publicly readable"
on public.categories for select to anon, authenticated
using (
  is_active
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

create or replace function public.guard_category_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception using errcode = '23514', message = 'A category cannot be its own parent.';
  end if;
  if exists (
    with recursive ancestors(id, parent_id) as (
      select categories.id, categories.parent_id
      from public.categories
      where categories.id = new.parent_id
      union all
      select categories.id, categories.parent_id
      from public.categories
      join ancestors on categories.id = ancestors.parent_id
    )
    select 1 from ancestors where ancestors.id = new.id
  ) then
    raise exception using errcode = '23514', message = 'Category nesting cannot contain a cycle.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_category_parent() from public, anon, authenticated;
drop trigger if exists categories_guard_parent on public.categories;
create trigger categories_guard_parent
  before insert or update on public.categories
  for each row execute function public.guard_category_parent();

alter table public.posts
  add column if not exists content_type text not null default 'article'
    constraint posts_content_type_check check (content_type in ('article', 'video', 'podcast')),
  add column if not exists workflow_status text not null default 'draft'
    constraint posts_workflow_status_check check (
      workflow_status in ('draft', 'pending_review', 'changes_requested', 'approved', 'rejected', 'published', 'archived')
    ),
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists review_feedback text,
  add column if not exists published_at timestamptz,
  add column if not exists scheduled_at timestamptz,
  add column if not exists cover_image_url text,
  add column if not exists cover_image_path text,
  add column if not exists video_url text,
  add column if not exists audio_url text,
  add column if not exists duration_seconds integer,
  add column if not exists tags text[] not null default '{}',
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists featured boolean not null default false,
  add column if not exists subcategory_id uuid references public.categories(id) on delete set null;

update public.posts
set workflow_status = case when published then 'published' else 'draft' end,
    published_at = case when published then coalesce(published_at, created_at) else published_at end
where workflow_status = 'draft' and published;

alter table public.posts
  add constraint posts_content_lengths_check
    check (
      length(title) between 1 and 200
      and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      and length(excerpt) between 1 and 500
      and length(content) <= 50000
    ) not valid,
  add constraint posts_research_array_limits_check
    check (
      cardinality(verified_facts) <= 50
      and cardinality(research_findings) <= 50
      and cardinality(opinions) <= 50
      and cardinality(proposed_solutions) <= 50
      and jsonb_array_length(sources) <= 50
    ) not valid,
  add constraint posts_read_time_check
    check (read_time between 1 and 120),
  add constraint posts_duration_seconds_check
    check (duration_seconds is null or duration_seconds between 1 and 86400),
  add constraint posts_tags_count_check
    check (cardinality(tags) <= 30),
  add constraint posts_cover_image_url_check
    check (cover_image_url is null or (cover_image_url ~* '^https?://' and cover_image_url !~ '://[^/]*@')),
  add constraint posts_cover_image_path_check
    check (
      cover_image_path is null
      or cover_image_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](avif|gif|jpg|png|webp)$'
    ),
  add constraint posts_cover_image_source_exclusive_check
    check (cover_image_path is null or cover_image_url is null),
  add constraint posts_video_url_check
    check (video_url is null or (video_url ~* '^https?://' and video_url !~ '://[^/]*@')),
  add constraint posts_audio_url_check
    check (audio_url is null or (audio_url ~* '^https?://' and audio_url !~ '://[^/]*@')),
  add constraint posts_video_published_url_check
    check (not published or content_type <> 'video' or video_url is not null),
  add constraint posts_podcast_published_url_check
    check (not published or content_type <> 'podcast' or audio_url is not null);

create index if not exists posts_workflow_author_idx
  on public.posts (author_id, workflow_status, updated_at desc);
create index if not exists posts_publication_type_idx
  on public.posts (content_type, published_at desc)
  where published and workflow_status = 'published';
create index if not exists posts_schedule_idx
  on public.posts (scheduled_at)
  where scheduled_at is not null and workflow_status = 'approved';
create index if not exists categories_parent_order_idx
  on public.categories (parent_id, sort_order, name);

drop policy if exists "Published posts are viewable by everyone" on public.posts;
create policy "Published posts are viewable by everyone"
on public.posts for select to anon, authenticated
using (
  (
    published
    and workflow_status = 'published'
    and (scheduled_at is null or scheduled_at <= now())
  )
  or author_id = auth.uid()
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

drop policy if exists "Authors can create their own submissions" on public.posts;
create policy "Authors can create their own submissions"
on public.posts for insert to authenticated
with check (
  author_id = auth.uid()
  and not published
  and workflow_status in ('draft', 'pending_review')
);

drop policy if exists "Authors can update their own editable submissions" on public.posts;
create policy "Authors can update their own editable submissions"
on public.posts for update to authenticated
using (
  author_id = auth.uid()
  and workflow_status in ('draft', 'changes_requested', 'rejected')
)
with check (
  author_id = auth.uid()
  and not published
  and workflow_status in ('draft', 'pending_review')
);

drop policy if exists "Authors can delete their own editable submissions" on public.posts;
create policy "Authors can delete their own editable submissions"
on public.posts for delete to authenticated
using (
  author_id = auth.uid()
  and workflow_status in ('draft', 'changes_requested', 'rejected')
);

create or replace function public.guard_post_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_is_admin boolean;
begin
  select exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ) into caller_is_admin;

  if caller_is_admin or auth.role() = 'service_role' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.author_id is distinct from auth.uid()
      or new.published
      or new.workflow_status not in ('draft', 'pending_review')
      or new.reviewed_by is not null
      or new.reviewed_at is not null
      or new.review_feedback is not null
      or new.published_at is not null
      or new.scheduled_at is not null
      or (
        new.cover_image_path is not null
        and split_part(new.cover_image_path, '/', 1) <> auth.uid()::text
      )
      or new.featured
    then
      raise exception using errcode = '42501', message = 'Authors may only create their own draft or review submission.';
    end if;

    if not exists (
      select 1 from public.categories
      where categories.name = new.category
        and categories.is_active
        and categories.content_type in ('all', new.content_type)
    ) then
      raise exception using errcode = '23503', message = 'Select an active category for this content type.';
    end if;

    if new.workflow_status = 'pending_review' then
      if (new.content_type = 'video' and new.video_url is null)
        or (new.content_type = 'podcast' and new.audio_url is null) then
        raise exception using errcode = '22023', message = 'Add the video or audio URL before submitting for review.';
      end if;
      new.submitted_at := now();
    else
      new.submitted_at := null;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.author_id is distinct from auth.uid()
      or old.workflow_status not in ('draft', 'changes_requested', 'rejected')
      or new.author_id is distinct from old.author_id
      or new.published
      or new.workflow_status not in ('draft', 'pending_review')
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at
      or new.review_feedback is distinct from old.review_feedback
      or new.published_at is distinct from old.published_at
      or new.scheduled_at is distinct from old.scheduled_at
      or (
        new.cover_image_path is not null
        and split_part(new.cover_image_path, '/', 1) <> auth.uid()::text
      )
      or new.featured is distinct from old.featured
    then
      raise exception using errcode = '42501', message = 'Authors may only edit their own drafts or requested changes.';
    end if;

    if not exists (
      select 1 from public.categories
      where categories.name = new.category
        and categories.is_active
        and categories.content_type in ('all', new.content_type)
    ) then
      raise exception using errcode = '23503', message = 'Select an active category for this content type.';
    end if;

    if new.workflow_status = 'pending_review' and old.workflow_status <> 'pending_review' then
      if (new.content_type = 'video' and new.video_url is null)
        or (new.content_type = 'podcast' and new.audio_url is null) then
        raise exception using errcode = '22023', message = 'Add the video or audio URL before submitting for review.';
      end if;
      new.submitted_at := now();
    else
      new.submitted_at := old.submitted_at;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.author_id = auth.uid()
      and old.workflow_status in ('draft', 'changes_requested', 'rejected') then
      return old;
    end if;
    raise exception using errcode = '42501', message = 'Authors may only delete their own editable submissions.';
  end if;

  return null;
end;
$$;

revoke all on function public.guard_post_workflow() from public, anon, authenticated;
drop trigger if exists posts_guard_workflow on public.posts;
create trigger posts_guard_workflow
  before insert or update or delete on public.posts
  for each row execute function public.guard_post_workflow();

create or replace function public.validate_post_category_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.categories
    where categories.name = new.category
      and categories.content_type in ('all', new.content_type)
  ) then
    raise exception using errcode = '23503', message = 'Select a category compatible with this publication type.';
  end if;

  if new.subcategory_id is not null and not exists (
    select 1
    from public.categories as child
    join public.categories as parent on parent.id = child.parent_id
    where child.id = new.subcategory_id
      and child.content_type in ('all', new.content_type)
      and parent.name = new.category
  ) then
    raise exception using errcode = '23503', message = 'Select a subcategory under the selected category.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_post_category_assignment() from public, anon, authenticated;
drop trigger if exists posts_validate_category_assignment on public.posts;
create trigger posts_validate_category_assignment
  before insert or update on public.posts
  for each row execute function public.validate_post_category_assignment();

create table if not exists public.content_reviews (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete set null,
  post_title text not null,
  post_slug text not null,
  reviewer_id uuid references public.profiles(id) on delete set null,
  action text not null,
  previous_status text,
  new_status text not null,
  feedback text,
  scheduled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists content_reviews_post_created_idx
  on public.content_reviews (post_id, created_at desc);
create index if not exists content_reviews_reviewer_created_idx
  on public.content_reviews (reviewer_id, created_at desc);

alter table public.content_reviews enable row level security;
revoke all on table public.content_reviews from anon, authenticated;
grant select on table public.content_reviews to authenticated;

drop policy if exists "Authors and admins can read content review history" on public.content_reviews;
create policy "Authors and admins can read content review history"
on public.content_reviews for select to authenticated
using (
  reviewer_id = auth.uid()
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
  or exists (
    select 1 from public.posts
    where posts.id = content_reviews.post_id and posts.author_id = auth.uid()
  )
);

create or replace function public.record_content_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_status text;
  action_name text;
begin
  if tg_op = 'INSERT' then
    old_status := null;
  else
    old_status := old.workflow_status;
    if old.workflow_status is not distinct from new.workflow_status
      and old.published is not distinct from new.published then
      return new;
    end if;
  end if;

  action_name := case
    when new.workflow_status = 'pending_review' then 'submitted'
    when new.workflow_status = 'changes_requested' then 'requested_changes'
    when new.workflow_status = 'published' then 'published'
    when new.workflow_status = 'archived' then 'archived'
    when new.workflow_status = 'rejected' then 'rejected'
    when old_status = 'published' and new.workflow_status = 'approved' then 'unpublished'
    when old_status = 'archived' and new.workflow_status = 'draft' then 'restored'
    when new.scheduled_at is not null then 'scheduled'
    when new.workflow_status = 'approved' then 'approved'
    else 'status_changed'
  end;

  insert into public.content_reviews (
    post_id, post_title, post_slug, reviewer_id, action,
    previous_status, new_status, feedback, scheduled_at
  ) values (
    new.id, new.title, new.slug, auth.uid(), action_name,
    old_status, new.workflow_status, new.review_feedback, new.scheduled_at
  );
  return new;
end;
$$;

revoke all on function public.record_content_review() from public, anon, authenticated;
drop trigger if exists posts_record_content_review on public.posts;
create trigger posts_record_content_review
  after insert or update on public.posts
  for each row execute function public.record_content_review();

create table if not exists public.author_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  notification_type text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists author_notifications_user_order_idx
  on public.author_notifications (user_id, created_at desc);

alter table public.author_notifications enable row level security;
revoke all on table public.author_notifications from anon, authenticated;
grant select on table public.author_notifications to authenticated;
grant update (read_at) on table public.author_notifications to authenticated;

drop policy if exists "Users can read their own author notifications" on public.author_notifications;
create policy "Users can read their own author notifications"
on public.author_notifications for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can mark their own author notifications read" on public.author_notifications;
create policy "Users can mark their own author notifications read"
on public.author_notifications for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.notify_content_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_type text;
  notification_message text;
begin
  if new.workflow_status = 'pending_review' and tg_op = 'INSERT' then
    insert into public.author_notifications (user_id, post_id, notification_type, message)
    select profiles.id, new.id, 'submission_received',
      'A new ' || new.content_type || ' submission is ready for review: ' || new.title
    from public.profiles
    where profiles.role = 'admin';
  elsif tg_op = 'UPDATE' then
    if new.workflow_status = 'pending_review'
      and old.workflow_status is distinct from new.workflow_status then
      insert into public.author_notifications (user_id, post_id, notification_type, message)
      select profiles.id, new.id, 'submission_received',
        'A new ' || new.content_type || ' submission is ready for review: ' || new.title
      from public.profiles
      where profiles.role = 'admin';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if old.workflow_status is distinct from new.workflow_status
      and new.author_id is not null and new.workflow_status <> 'pending_review' then
    notification_type := case
      when new.workflow_status = 'changes_requested' then 'changes_requested'
      when new.workflow_status = 'approved' and old.workflow_status = 'published' then 'unpublished'
      when new.workflow_status = 'approved' and new.scheduled_at is not null then 'scheduled'
      when new.workflow_status = 'approved' then 'approved'
      when new.workflow_status = 'published' then 'published'
      when new.workflow_status = 'rejected' then 'rejected'
      when new.workflow_status = 'archived' then 'archived'
      when new.workflow_status = 'draft' and old.workflow_status = 'archived' then 'restored'
      else 'status_changed'
    end;
    notification_message := case notification_type
      when 'changes_requested' then 'Changes were requested for: ' || new.title
      when 'unpublished' then 'Your publication was unpublished: ' || new.title
      when 'scheduled' then 'Your publication is scheduled: ' || new.title
      when 'approved' then 'Your submission was approved: ' || new.title
      when 'published' then 'Your publication is live: ' || new.title
      when 'rejected' then 'Your submission was declined: ' || new.title
      when 'archived' then 'Your publication was archived: ' || new.title
      when 'restored' then 'Your publication was restored to draft: ' || new.title
      else 'The status of your content changed: ' || new.title
    end;
    insert into public.author_notifications (user_id, post_id, notification_type, message)
    values (new.author_id, new.id, notification_type, notification_message);
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.notify_content_workflow() from public, anon, authenticated;
drop trigger if exists posts_notify_content_workflow on public.posts;
create trigger posts_notify_content_workflow
  after insert or update on public.posts
  for each row execute function public.notify_content_workflow();

create or replace function public.review_content(
  p_post_id uuid,
  p_action text,
  p_feedback text default null,
  p_scheduled_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  current_post public.posts%rowtype;
  current_user_id uuid := auth.uid();
  feedback_text text := nullif(btrim(p_feedback), '');
begin
  if not exists (
    select 1 from public.profiles
    where profiles.id = current_user_id and profiles.role = 'admin'
  ) then
    raise exception using errcode = '42501', message = 'Administrator access is required.';
  end if;

  if feedback_text is not null and length(feedback_text) > 4000 then
    raise exception using errcode = '22023', message = 'Review feedback must be 4000 characters or fewer.';
  end if;

  select * into current_post
  from public.posts
  where posts.id = p_post_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Content was not found.';
  end if;
  current_status := current_post.workflow_status;

  if p_action = 'approve' then
    if current_status <> 'pending_review' then
      raise exception using errcode = '22023', message = 'Only pending submissions can be approved.';
    end if;
    update public.posts set workflow_status = 'approved', published = false,
      scheduled_at = null, reviewed_by = current_user_id, reviewed_at = now(),
      review_feedback = null, updated_at = now()
    where id = p_post_id;
  elsif p_action = 'request_changes' then
    if current_status <> 'pending_review' or feedback_text is null then
      raise exception using errcode = '22023', message = 'Pending submissions require feedback before changes can be requested.';
    end if;
    update public.posts set workflow_status = 'changes_requested', published = false,
      scheduled_at = null, reviewed_by = current_user_id, reviewed_at = now(),
      review_feedback = feedback_text, updated_at = now()
    where id = p_post_id;
  elsif p_action = 'reject' then
    if current_status <> 'pending_review' or feedback_text is null then
      raise exception using errcode = '22023', message = 'Pending submissions require feedback before rejection.';
    end if;
    update public.posts set workflow_status = 'rejected', published = false,
      scheduled_at = null, reviewed_by = current_user_id, reviewed_at = now(),
      review_feedback = feedback_text, updated_at = now()
    where id = p_post_id;
  elsif p_action = 'publish' then
    if current_status not in ('draft', 'approved') then
      raise exception using errcode = '22023', message = 'Only drafts or approved content can be published.';
    end if;
    update public.posts set workflow_status = 'published', published = true,
      published_at = now(), scheduled_at = null, reviewed_by = current_user_id,
      reviewed_at = now(), review_feedback = null, updated_at = now()
    where id = p_post_id;
  elsif p_action = 'schedule' then
    if current_status not in ('draft', 'approved')
      or p_scheduled_at is null
      or p_scheduled_at <= now() then
      raise exception using errcode = '22023', message = 'Choose a future publication time for a draft or approved submission.';
    end if;
    update public.posts set workflow_status = 'approved', published = false,
      scheduled_at = p_scheduled_at, reviewed_by = current_user_id,
      reviewed_at = now(), review_feedback = null, updated_at = now()
    where id = p_post_id;
  elsif p_action = 'unpublish' then
    if current_status <> 'published' then
      raise exception using errcode = '22023', message = 'Only published content can be unpublished.';
    end if;
    update public.posts set workflow_status = 'approved', published = false,
      scheduled_at = null, reviewed_by = current_user_id, reviewed_at = now(),
      updated_at = now()
    where id = p_post_id;
  elsif p_action = 'archive' then
    if current_status = 'archived' then
      raise exception using errcode = '22023', message = 'Content is already archived.';
    end if;
    update public.posts set workflow_status = 'archived', published = false,
      scheduled_at = null, reviewed_by = current_user_id, reviewed_at = now(),
      updated_at = now()
    where id = p_post_id;
  elsif p_action = 'restore' then
    if current_status <> 'archived' then
      raise exception using errcode = '22023', message = 'Only archived content can be restored.';
    end if;
    update public.posts set workflow_status = 'draft', published = false,
      scheduled_at = null, reviewed_by = current_user_id, reviewed_at = now(),
      review_feedback = null, updated_at = now()
    where id = p_post_id;
  else
    raise exception using errcode = '22023', message = 'Unknown content review action.';
  end if;

  return p_action;
end;
$$;

revoke all on function public.review_content(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.review_content(uuid, text, text, timestamptz) to authenticated;

create or replace function public.publish_scheduled_content()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  published_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Scheduled publishing requires a trusted server request.';
  end if;

  update public.posts
  set workflow_status = 'published',
      published = true,
      published_at = now(),
      scheduled_at = null,
      reviewed_at = coalesce(reviewed_at, now()),
      updated_at = now()
  where workflow_status = 'approved'
    and scheduled_at is not null
    and scheduled_at <= now();

  get diagnostics published_count = row_count;
  return published_count;
end;
$$;

revoke all on function public.publish_scheduled_content() from public, anon, authenticated;
grant execute on function public.publish_scheduled_content() to service_role;

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete set null,
  post_title text not null,
  post_slug text not null,
  reporter_id uuid references public.profiles(id) on delete set null,
  reason text not null check (reason in ('misinformation', 'spam', 'copyright', 'abuse', 'other')),
  details text not null default '' check (length(details) <= 2000),
  status text not null default 'new' check (status in ('new', 'in_review', 'resolved', 'dismissed')),
  admin_notes text,
  handled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists content_reports_reporter_reason_unique_idx
  on public.content_reports (post_id, reporter_id, reason)
  where reporter_id is not null;
create index if not exists content_reports_status_created_idx
  on public.content_reports (status, created_at desc);

alter table public.content_reports enable row level security;
revoke all on table public.content_reports from anon, authenticated;
grant select on table public.content_reports to authenticated;
grant insert (post_id, post_title, post_slug, reporter_id, reason, details)
  on public.content_reports to authenticated;
grant update (status, admin_notes, handled_by, updated_at)
  on public.content_reports to authenticated;

drop policy if exists "Authenticated users can report published content" on public.content_reports;
create policy "Authenticated users can report published content"
on public.content_reports for insert to authenticated
with check (
  reporter_id = auth.uid()
  and exists (
    select 1 from public.posts
    where posts.id = content_reports.post_id
      and posts.title = content_reports.post_title
      and posts.slug = content_reports.post_slug
      and posts.published
      and posts.workflow_status = 'published'
  )
);

drop policy if exists "Admins can read content reports" on public.content_reports;
create policy "Admins can read content reports"
on public.content_reports for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can update content reports" on public.content_reports;
create policy "Admins can update content reports"
on public.content_reports for update to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'author-submission-media',
  'author-submission-media',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do nothing;

drop policy if exists "Authors can upload their own submission covers" on storage.objects;
create policy "Authors can upload their own submission covers"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'author-submission-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authors and admins can read submission covers" on storage.objects;
create policy "Authors and admins can read submission covers"
on storage.objects for select to authenticated
using (
  bucket_id = 'author-submission-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
    or exists (
      select 1 from public.posts
      where posts.cover_image_path = storage.objects.name
        and posts.published
        and posts.workflow_status = 'published'
        and (posts.scheduled_at is null or posts.scheduled_at <= now())
    )
  )
);

drop policy if exists "Published submission covers are publicly readable" on storage.objects;
create policy "Published submission covers are publicly readable"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'author-submission-media'
  and exists (
    select 1 from public.posts
    where posts.cover_image_path = storage.objects.name
      and posts.published
      and posts.workflow_status = 'published'
      and (posts.scheduled_at is null or posts.scheduled_at <= now())
  )
);
