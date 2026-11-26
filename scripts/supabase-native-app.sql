-- Server-only state replacing Apps Script ScriptProperties for authenticated sessions.
create table if not exists public.logbook_runtime (
 dataset_id uuid not null references public.logbook_datasets(id),
 key text not null, value text not null, updated_at timestamptz not null default now(),
 primary key(dataset_id,key)
);
alter table public.logbook_runtime enable row level security;
revoke all on public.logbook_runtime from public,anon,authenticated;
grant all on public.logbook_runtime to service_role;

create or replace function public.logbook_app_context(p_dataset uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('manifest',public.logbook_manifest(p_dataset),'runtime',coalesce(
  (select jsonb_object_agg(key,value) from public.logbook_runtime where dataset_id=p_dataset),'{}'));
$$;

create or replace function public.logbook_app_commit(p_dataset uuid,p_request uuid,p_actor text,p_method text,p_payload jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare x jsonb; prior text; out jsonb;
begin
 for x in select value from jsonb_array_elements(coalesce(p_payload->'runtime','[]')) order by value->>'key' loop
  if (x->>'key') !~ '^(PAGES_(PERSONAL_)?SESSION_|NATIVE_)' then raise exception 'Invalid runtime key'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('logbook-runtime:'||p_dataset::text||':'||(x->>'key'),0));
 end loop;
 out:=public.logbook_transaction(p_dataset,p_request,p_actor,p_method,p_payload);
 if out->>'duplicate'='true' then return out; end if;
 for x in select value from jsonb_array_elements(coalesce(p_payload->'runtime','[]')) order by value->>'key' loop
  select value into prior from public.logbook_runtime where dataset_id=p_dataset and key=x->>'key';
  if prior is distinct from (x->>'before') then raise exception 'Session state changed' using errcode='PT409'; end if;
  if x->'after'='null'::jsonb then delete from public.logbook_runtime where dataset_id=p_dataset and key=x->>'key';
  else insert into public.logbook_runtime(dataset_id,key,value) values(p_dataset,x->>'key',x->>'after')
   on conflict(dataset_id,key) do update set value=excluded.value,updated_at=now();
  end if;
 end loop;
 return out;
end $$;

create table if not exists public.logbook_auth_limits (
 dataset_id uuid not null references public.logbook_datasets(id), key text not null,
 until_at timestamptz not null, attempts integer not null, primary key(dataset_id,key)
);
alter table public.logbook_auth_limits enable row level security;
revoke all on public.logbook_auth_limits from public,anon,authenticated;
grant all on public.logbook_auth_limits to service_role;
create or replace function public.logbook_auth_attempt(p_dataset uuid,p_name text,p_ip text) returns boolean
language plpgsql set search_path='' as $$
declare k text; n integer;
begin
 if length(p_name)<>64 or length(p_ip)<20 then raise exception 'Invalid auth limiter key'; end if;
 k:='ip:'||p_ip;
  insert into public.logbook_auth_limits(dataset_id,key,until_at,attempts) values(p_dataset,k,now()+interval '15 minutes',1)
  on conflict(dataset_id,key) do update set attempts=case when logbook_auth_limits.until_at<=now() then 1 else logbook_auth_limits.attempts+1 end,
   until_at=case when logbook_auth_limits.until_at<=now() then now()+interval '15 minutes' else logbook_auth_limits.until_at end
  returning attempts into n;
 return n<=2400;
end $$;
revoke all on function public.logbook_app_context(uuid),public.logbook_app_commit(uuid,uuid,text,text,jsonb),public.logbook_auth_attempt(uuid,text,text) from public,anon,authenticated;
grant execute on function public.logbook_app_context(uuid),public.logbook_app_commit(uuid,uuid,text,text,jsonb),public.logbook_auth_attempt(uuid,text,text) to service_role;
