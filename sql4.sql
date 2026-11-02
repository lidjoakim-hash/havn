-- 1) Split long texts for every imported source (anything with a "source"), not only the first four.
create or replace function public.split_job_text() returns trigger
language plpgsql security definer set search_path = public as $$
declare d text; s text; h text;
begin
  if new.collection <> 'jobs' or coalesce(new.data->>'source', '') = '' then
    return new;
  end if;
  d := coalesce(new.data->>'description', '');
  if d = '' then return new; end if;
  insert into public.docs (collection, id, data, updated_at)
  values ('jobtext', new.id, jsonb_build_object('description', d, 'requirements', coalesce(new.data->>'requirements', ''), 'benefits', coalesce(new.data->>'benefits', '')), now())
  on conflict (collection, id) do update set data = excluded.data, updated_at = now();
  s := left(regexp_replace(d, '\s+', ' ', 'g'), 300);
  select left(string_agg(x, ' | '), 1000) into h from (
    select trim(x) as x
    from regexp_split_to_table(d, E'\\n+|\\.\\s+') as x
    where length(trim(x)) between 6 and 400
      and x ~* '(lønn|løn|lön|salary|salariu|gehalt|compensation|pay |kr|nok|sek|eur|€|\$|£|usd|norsk|norwegian|english|engelsk|german|deutsch|tysk|swedish|svensk|dansk|polish|polsk|romanian|språk|language|erfaring|erfarenhet|experience|years|junior|senior|lærling|trainee|graduate|internship|student|remote|hjemmekontor|distans|relocation|visa|bolig|housing|accommodation|lønnstrinn|tariff)'
    limit 14
  ) t;
  new.data := (new.data - 'description' - 'requirements' - 'benefits')
    || jsonb_build_object('summary', s, 'hints', coalesce(h, ''), 'hasText', true);
  return new;
end $$;

-- 2) Remember deleted jobs for a week, so the job index can drop them without re-reading everything.
create table if not exists public.job_deletions (id text not null, at timestamptz not null default now());
create index if not exists job_deletions_at on public.job_deletions (at);
alter table public.job_deletions enable row level security;
drop policy if exists job_deletions_read on public.job_deletions;
create policy job_deletions_read on public.job_deletions for select using (true);
grant select on public.job_deletions to anon, authenticated;

create or replace function public.drop_job_text() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.collection = 'jobs' then
    delete from public.docs where collection = 'jobtext' and id = old.id;
    insert into public.job_deletions (id) values (old.id);
  end if;
  return old;
end $$;

-- 3) Index for "what changed since" reads, and weekly cleanup of old deletion notes.
create index if not exists docs_jobs_updated on public.docs (updated_at) where collection = 'jobs';
select cron.unschedule('havn-purge-deletions') where exists (select 1 from cron.job where jobname = 'havn-purge-deletions');
select cron.schedule('havn-purge-deletions', '5 3 * * *', $$ delete from public.job_deletions where at < now() - interval '8 days'; $$);

select 'ok' as done;
