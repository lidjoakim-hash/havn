-- Havn Quick apply without an account: candidates send name, email, optional phone/CV link and a note.
-- Only the owner (admin) can read applications. Visitors can only add or update their own application through apply_job().
create table if not exists public.job_applications (
  job_id text not null,
  email text not null,
  job_title text,
  company text,
  name text not null,
  phone text,
  link text,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (job_id, email)
);
create index if not exists job_applications_created on public.job_applications (created_at desc);
alter table public.job_applications enable row level security;
drop policy if exists job_applications_admin on public.job_applications;
create policy job_applications_admin on public.job_applications for select using (public.is_admin());

create or replace function public.apply_job(j text, title text, co text, n text, e text, ph text, l text, msg text) returns json
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  e := lower(trim(coalesce(e, '')));
  if j is null or length(j) > 120 or length(trim(coalesce(n, ''))) < 2 or length(n) > 120
     or e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(e) > 200
     or length(trim(coalesce(msg, ''))) < 5 or length(msg) > 4000
     or length(coalesce(ph, '')) > 40 or length(coalesce(l, '')) > 500 then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;
  select count(*) into recent from public.job_applications where email = e and created_at > now() - interval '1 day';
  if recent >= 25 then return json_build_object('ok', false, 'error', 'limit'); end if;
  insert into public.job_applications (job_id, email, job_title, company, name, phone, link, note)
  values (j, e, left(title, 200), left(co, 200), trim(n), nullif(trim(ph), ''), nullif(trim(l), ''), trim(msg))
  on conflict (job_id, email) do update
    set name = excluded.name, phone = excluded.phone, link = excluded.link, note = excluded.note, updated_at = now();
  return json_build_object('ok', true);
end $$;
revoke all on function public.apply_job(text, text, text, text, text, text, text, text) from public;
grant execute on function public.apply_job(text, text, text, text, text, text, text, text) to anon, authenticated;

select 'ok' as quick_apply_ready;
