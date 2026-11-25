-- Havn: user accounts, Havn Plus subscriptions and the Havn Crew community space.
-- Safe to run more than once. Nothing here drops or rewrites existing tables.

create or replace function public.is_plus(u uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = u
      and s.status in ('active', 'trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

create or replace function public.month_key() returns text
language sql immutable as $$ select to_char(now() at time zone 'utc', 'YYYY-MM') $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique,
  name text not null default '',
  headline text not null default '',
  bio text not null default '',
  location text not null default '',
  avatar_url text,
  links jsonb not null default '{}'::jsonb,
  open_to_work boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_shape check (handle is null or handle ~ '^[a-z0-9][a-z0-9_.-]{2,29}$'),
  constraint profiles_name_len check (length(name) <= 80),
  constraint profiles_headline_len check (length(headline) <= 140),
  constraint profiles_bio_len check (length(bio) <= 2000)
);
alter table public.profiles enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text; cand text; n int := 0;
begin
  base := lower(regexp_replace(split_part(coalesce(new.email, 'havn'), '@', 1), '[^a-z0-9]', '', 'g'));
  if length(base) < 3 then base := base || 'user'; end if;
  base := left(base, 24);
  cand := base;
  while exists (select 1 from public.profiles p where p.handle = cand) loop
    n := n + 1; cand := left(base, 24) || n::text;
  end loop;
  insert into public.profiles (id, handle) values (new.id, cand)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, handle)
select u.id,
       left(coalesce(nullif(regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9]', '', 'g'), ''), 'havn'), 20)
       || substr(replace(u.id::text, '-', ''), 1, 4)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'plus',
  period text not null default 'month',
  status text not null default 'inactive',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_period check (period in ('month', 'year')),
  constraint subscriptions_status check (status in ('inactive', 'trialing', 'active', 'past_due', 'canceled'))
);
create index if not exists subscriptions_status_idx on public.subscriptions (status);
alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_read_self on public.subscriptions;
create policy subscriptions_read_self on public.subscriptions for select to authenticated using (user_id = auth.uid());

create table if not exists public.saved_jobs (
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id text not null,
  title text,
  company text,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id),
  constraint saved_jobs_id_len check (length(job_id) <= 120)
);
alter table public.saved_jobs enable row level security;
drop policy if exists saved_jobs_own on public.saved_jobs;
create policy saved_jobs_own on public.saved_jobs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.saved_searches (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  filters jsonb not null default '{}'::jsonb,
  notify boolean not null default true,
  created_at timestamptz not null default now(),
  constraint saved_searches_name_len check (length(name) <= 80)
);
create index if not exists saved_searches_user_idx on public.saved_searches (user_id);
alter table public.saved_searches enable row level security;
drop policy if exists saved_searches_own on public.saved_searches;
create policy saved_searches_own on public.saved_searches for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.tracked_applications (
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id text not null,
  stage text not null default 'applied',
  title text,
  company text,
  note text,
  at timestamptz not null default now(),
  primary key (user_id, job_id),
  constraint tracked_stage check (stage in ('applied', 'interview', 'offer', 'rejected')),
  constraint tracked_note_len check (note is null or length(note) <= 4000)
);
alter table public.tracked_applications enable row level security;
drop policy if exists tracked_own on public.tracked_applications;
create policy tracked_own on public.tracked_applications for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.cvs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'CV',
  job_id text,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cvs_content_len check (length(content) <= 60000)
);
create index if not exists cvs_user_idx on public.cvs (user_id, updated_at desc);
alter table public.cvs enable row level security;
drop policy if exists cvs_own on public.cvs;
create policy cvs_own on public.cvs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.usage_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null default public.month_key(),
  kind text not null,
  used int not null default 0,
  primary key (user_id, month, kind)
);
alter table public.usage_counters enable row level security;
drop policy if exists usage_read_self on public.usage_counters;
create policy usage_read_self on public.usage_counters for select to authenticated using (user_id = auth.uid());

create or replace function public.use_quota(kind text, free_limit int)
returns json language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); n int;
begin
  if u is null then return json_build_object('ok', false, 'error', 'signin'); end if;
  if kind not in ('ai_search', 'ai_cv', 'ai_match') then return json_build_object('ok', false, 'error', 'kind'); end if;
  if public.is_plus(u) then return json_build_object('ok', true, 'plus', true, 'left', null); end if;
  insert into public.usage_counters (user_id, month, kind, used)
  values (u, public.month_key(), kind, 1)
  on conflict (user_id, month, kind) do update set used = public.usage_counters.used + 1
  returning used into n;
  if n > greatest(free_limit, 0) then
    update public.usage_counters set used = used - 1
      where user_id = u and month = public.month_key() and kind = use_quota.kind;
    return json_build_object('ok', false, 'error', 'limit', 'limit', free_limit);
  end if;
  return json_build_object('ok', true, 'plus', false, 'left', greatest(free_limit, 0) - n);
end $$;
revoke all on function public.use_quota(text, int) from public;
grant execute on function public.use_quota(text, int) to authenticated;

create or replace function public.my_plan() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'plus', public.is_plus(auth.uid()),
    'subscription', (select json_build_object('status', s.status, 'period', s.period, 'ends', s.current_period_end,
                                              'cancelAtPeriodEnd', s.cancel_at_period_end)
                     from public.subscriptions s where s.user_id = auth.uid()),
    'usage', (select coalesce(json_object_agg(c.kind, c.used), '{}'::json)
              from public.usage_counters c where c.user_id = auth.uid() and c.month = public.month_key())
  );
$$;
grant execute on function public.my_plan() to authenticated;

create table if not exists public.posts (
  id bigint generated always as identity primary key,
  author uuid not null references auth.users (id) on delete cascade,
  body text not null,
  job_id text,
  job_title text,
  job_company text,
  comment_count int not null default 0,
  like_count int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  constraint posts_body_len check (length(btrim(body)) between 1 and 5000)
);
create index if not exists posts_created_idx on public.posts (created_at desc) where hidden = false;
create index if not exists posts_author_idx on public.posts (author, created_at desc);
alter table public.posts enable row level security;

drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select to authenticated using (hidden = false or author = auth.uid() or public.is_admin());
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated with check (author = auth.uid());
drop policy if exists posts_update_own on public.posts;
create policy posts_update_own on public.posts for update to authenticated
  using (author = auth.uid() or public.is_admin()) with check (author = auth.uid() or public.is_admin());
drop policy if exists posts_delete_own on public.posts;
create policy posts_delete_own on public.posts for delete to authenticated using (author = auth.uid() or public.is_admin());

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts (id) on delete cascade,
  author uuid not null references auth.users (id) on delete cascade,
  parent_id bigint references public.comments (id) on delete cascade,
  body text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  constraint comments_body_len check (length(btrim(body)) between 1 and 3000)
);
create index if not exists comments_post_idx on public.comments (post_id, created_at);
alter table public.comments enable row level security;

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to authenticated using (hidden = false or author = auth.uid() or public.is_admin());
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated with check (author = auth.uid());
drop policy if exists comments_update_own on public.comments;
create policy comments_update_own on public.comments for update to authenticated
  using (author = auth.uid() or public.is_admin()) with check (author = auth.uid() or public.is_admin());
drop policy if exists comments_delete_own on public.comments;
create policy comments_delete_own on public.comments for delete to authenticated using (author = auth.uid() or public.is_admin());

create table if not exists public.reactions (
  post_id bigint references public.posts (id) on delete cascade,
  comment_id bigint references public.comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint reactions_target check (num_nonnulls(post_id, comment_id) = 1)
);
create unique index if not exists reactions_post_one on public.reactions (post_id, user_id) where post_id is not null;
create unique index if not exists reactions_comment_one on public.reactions (comment_id, user_id) where comment_id is not null;
alter table public.reactions enable row level security;
drop policy if exists reactions_read on public.reactions;
create policy reactions_read on public.reactions for select to authenticated using (true);
drop policy if exists reactions_own on public.reactions;
create policy reactions_own on public.reactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.bump_counts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'comments' then
    if tg_op = 'INSERT' then update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    elsif tg_op = 'DELETE' then update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id; end if;
  else
    if tg_op = 'INSERT' and new.post_id is not null then update public.posts set like_count = like_count + 1 where id = new.post_id;
    elsif tg_op = 'DELETE' and old.post_id is not null then update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id; end if;
  end if;
  return null;
end $$;

drop trigger if exists comments_count on public.comments;
create trigger comments_count after insert or delete on public.comments
  for each row execute function public.bump_counts();
drop trigger if exists reactions_count on public.reactions;
create trigger reactions_count after insert or delete on public.reactions
  for each row execute function public.bump_counts();

create table if not exists public.follows (
  follower uuid not null references auth.users (id) on delete cascade,
  following uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, following),
  constraint follows_not_self check (follower <> following)
);
alter table public.follows enable row level security;
drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows for select to authenticated using (true);
drop policy if exists follows_own on public.follows;
create policy follows_own on public.follows for all to authenticated
  using (follower = auth.uid()) with check (follower = auth.uid());

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  actor uuid references auth.users (id) on delete set null,
  post_id bigint references public.posts (id) on delete cascade,
  comment_id bigint references public.comments (id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notifications_kind check (kind in ('mention', 'comment', 'like', 'follow', 'message', 'job'))
);
create index if not exists notifications_user_idx on public.notifications (user_id, read, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_mark on public.notifications;
create policy notifications_mark on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notify_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare h text; target uuid; owner uuid; body text;
begin
  body := new.body;
  if tg_table_name = 'comments' then
    select p.author into owner from public.posts p where p.id = new.post_id;
    if owner is not null and owner <> new.author then
      insert into public.notifications (user_id, kind, actor, post_id, comment_id)
      values (owner, 'comment', new.author, new.post_id, new.id);
    end if;
  end if;
  for h in select distinct lower(m[1]) from regexp_matches(body, '@([a-z0-9][a-z0-9_.-]{2,29})', 'gi') m loop
    select p.id into target from public.profiles p where p.handle = h;
    if target is not null and target <> new.author then
      insert into public.notifications (user_id, kind, actor, post_id, comment_id)
      values (target, 'mention', new.author,
              case when tg_table_name = 'comments' then new.post_id else new.id end,
              case when tg_table_name = 'comments' then new.id else null end);
    end if;
  end loop;
  return null;
end $$;

drop trigger if exists posts_notify on public.posts;
create trigger posts_notify after insert on public.posts for each row execute function public.notify_activity();
drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments for each row execute function public.notify_activity();

create table if not exists public.conversations (
  id bigint generated always as identity primary key,
  a uuid not null references auth.users (id) on delete cascade,
  b uuid not null references auth.users (id) on delete cascade,
  last_at timestamptz not null default now(),
  constraint conversations_pair check (a < b)
);
create unique index if not exists conversations_pair_idx on public.conversations (a, b);
alter table public.conversations enable row level security;
drop policy if exists conversations_mine on public.conversations;
create policy conversations_mine on public.conversations for select to authenticated
  using (a = auth.uid() or b = auth.uid());

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references public.conversations (id) on delete cascade,
  sender uuid not null references auth.users (id) on delete cascade,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint messages_body_len check (length(btrim(body)) between 1 and 4000)
);
create index if not exists messages_conv_idx on public.messages (conversation_id, created_at);
alter table public.messages enable row level security;

drop policy if exists messages_mine on public.messages;
create policy messages_mine on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c
          where c.id = conversation_id and (c.a = auth.uid() or c.b = auth.uid()))
);
drop policy if exists messages_read_mark on public.messages;
create policy messages_read_mark on public.messages for update to authenticated using (
  exists (select 1 from public.conversations c
          where c.id = conversation_id and (c.a = auth.uid() or c.b = auth.uid()))
);

create or replace function public.send_message(to_user uuid, body text)
returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); x uuid; y uuid; conv bigint; recent int;
begin
  if me is null then return json_build_object('ok', false, 'error', 'signin'); end if;
  if not public.is_plus(me) then return json_build_object('ok', false, 'error', 'plus'); end if;
  if to_user is null or to_user = me then return json_build_object('ok', false, 'error', 'recipient'); end if;
  if not exists (select 1 from public.profiles p where p.id = to_user) then
    return json_build_object('ok', false, 'error', 'recipient'); end if;
  if length(btrim(coalesce(body, ''))) < 1 or length(body) > 4000 then
    return json_build_object('ok', false, 'error', 'body'); end if;
  select count(*) into recent from public.messages m
    where m.sender = me and m.created_at > now() - interval '1 hour';
  if recent >= 60 then return json_build_object('ok', false, 'error', 'limit'); end if;

  x := least(me, to_user); y := greatest(me, to_user);
  insert into public.conversations (a, b) values (x, y)
    on conflict (a, b) do update set last_at = now()
    returning id into conv;
  insert into public.messages (conversation_id, sender, body) values (conv, me, btrim(body));
  insert into public.notifications (user_id, kind, actor) values (to_user, 'message', me);
  return json_build_object('ok', true, 'conversation', conv);
end $$;
revoke all on function public.send_message(uuid, text) from public;
grant execute on function public.send_message(uuid, text) to authenticated;

create or replace function public.feed(before timestamptz default null, lim int default 20)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x.created_at desc), '[]'::json) from (
    select p.id, p.body, p.job_id, p.job_title, p.job_company, p.created_at,
           p.comment_count, p.like_count,
           pr.handle, pr.name, pr.headline, pr.avatar_url,
           public.is_plus(p.author) as author_plus,
           exists (select 1 from public.reactions r where r.post_id = p.id and r.user_id = auth.uid()) as liked,
           p.author = auth.uid() as mine
    from public.posts p
    join public.profiles pr on pr.id = p.author
    where p.hidden = false and (feed.before is null or p.created_at < feed.before)
    order by p.created_at desc
    limit least(greatest(lim, 1), 50)
  ) x;
$$;
grant execute on function public.feed(timestamptz, int) to authenticated;

select 'ok' as accounts_and_crew_ready;
