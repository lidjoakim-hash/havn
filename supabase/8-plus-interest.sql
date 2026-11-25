-- Havn Plus waiting list: who asked to be told when billing opens.
-- Safe to run more than once.

create table if not exists public.plus_interest (
  user_id uuid primary key references auth.users (id) on delete cascade,
  period text not null default 'year',
  created_at timestamptz not null default now(),
  constraint plus_interest_period check (period in ('month', 'year'))
);
alter table public.plus_interest enable row level security;
drop policy if exists plus_interest_self on public.plus_interest;
create policy plus_interest_self on public.plus_interest for select to authenticated using (user_id = auth.uid());

create or replace function public.want_plus(period text default 'year')
returns json language plpgsql security definer set search_path = public as $fn$
declare u uuid := auth.uid();
begin
  if u is null then return json_build_object('ok', false, 'error', 'signin'); end if;
  if period not in ('month', 'year') then period := 'year'; end if;
  insert into public.plus_interest (user_id, period) values (u, period)
    on conflict (user_id) do update set period = excluded.period, created_at = now();
  return json_build_object('ok', true);
end $fn$;
revoke all on function public.want_plus(text) from public;
grant execute on function public.want_plus(text) to authenticated;

select 'ok' as plus_interest_ready;
