-- Havn: anonymous counts of job views and apply clicks per day (no cookies, no personal data).
-- Used for the owner's admin overview and to show employers how their job is doing.
create table if not exists public.job_stats (
  job_id text not null,
  day date not null default current_date,
  views integer not null default 0,
  applies integer not null default 0,
  primary key (job_id, day)
);
create index if not exists job_stats_day on public.job_stats (day);
alter table public.job_stats enable row level security;
drop policy if exists job_stats_admin_read on public.job_stats;
create policy job_stats_admin_read on public.job_stats for select using (public.is_admin());

-- the site calls this; it only ever adds 1, so nobody can read or rewrite the counts through it
create or replace function public.track(j text, k text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if j is null or length(j) > 120 or k not in ('v', 'a') then return; end if;
  insert into public.job_stats (job_id, day, views, applies)
  values (j, current_date, case when k = 'v' then 1 else 0 end, case when k = 'a' then 1 else 0 end)
  on conflict (job_id, day) do update
    set views = public.job_stats.views + excluded.views, applies = public.job_stats.applies + excluded.applies;
end $$;
revoke all on function public.track(text, text) from public;
grant execute on function public.track(text, text) to anon, authenticated;

-- totals for one job (any visitor may see how many views a job has had; used on the employer's own listing)
create or replace function public.job_totals(j text) returns table (views bigint, applies bigint)
language sql security definer set search_path = public stable as $$
  select coalesce(sum(views), 0), coalesce(sum(applies), 0) from public.job_stats where job_id = j;
$$;
grant execute on function public.job_totals(text) to anon, authenticated;

select 'ok' as job_stats_ready;
