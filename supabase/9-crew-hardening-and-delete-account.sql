-- Havn 9: Crew hardening + delete my account (25 Nov 2026)
-- Run once in Supabase > SQL editor. Safe to run again.

-- 1) Authors may edit the text of their own posts and comments, but not
--    un-hide a post a moderator hid, change who wrote it, or change the counters.
--    Counter triggers run as the table owner, so they still work.
create or replace function public.crew_guard_post() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and not public.is_admin() then
    if new.hidden is distinct from old.hidden
       or new.author is distinct from old.author
       or new.like_count is distinct from old.like_count
       or new.comment_count is distinct from old.comment_count
       or new.created_at is distinct from old.created_at then
      raise exception 'Only the text can be changed';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists crew_guard_post on public.posts;
create trigger crew_guard_post before update on public.posts
  for each row execute function public.crew_guard_post();

create or replace function public.crew_guard_comment() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and not public.is_admin() then
    if new.hidden is distinct from old.hidden
       or new.author is distinct from old.author
       or new.post_id is distinct from old.post_id
       or new.parent_id is distinct from old.parent_id
       or new.created_at is distinct from old.created_at then
      raise exception 'Only the text can be changed';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists crew_guard_comment on public.comments;
create trigger crew_guard_comment before update on public.comments
  for each row execute function public.crew_guard_comment();

-- 2) Delete my account: removes the sign-in and, through "on delete cascade",
--    profile, saved jobs, searches, CVs, tracker, Crew posts, comments,
--    messages, notifications and Plus interest. Quick-apply applications sent
--    with the same email are deleted too.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid(); mail text;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select email into mail from auth.users where id = uid;
  if mail is not null then
    delete from public.job_applications where lower(email) = lower(mail);
  end if;
  delete from auth.users where id = uid;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
