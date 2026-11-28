-- Domain model for the independent app. No legacy business records are imported.
create schema if not exists app2_private;
revoke all on schema app2_private from public,anon;
grant usage on schema app2_private to authenticated;
alter table public.app2_members drop constraint app2_members_role_check;
alter table public.app2_members add constraint app2_members_role_check check(role in ('admin','editor','company','personal','mentor'));
alter table public.app2_members add column person_id uuid references public.app2_people(id) on delete set null;
alter table public.app2_people add column email text not null default '';
alter table public.app2_people add column phone text not null default '';
alter table public.app2_people add column mentor_id uuid references public.app2_people(id) on delete set null;
create index app2_people_mentor_idx on public.app2_people(mentor_id);
create unique index app2_people_email_idx on public.app2_people(mode,lower(email)) where email<>'';

create function app2_private.member() returns public.app2_members language sql stable security definer set search_path='' as $$
 select m from public.app2_members m where auth.uid() is not null and m.enabled and m.email=lower((select auth.jwt()->>'email'));
$$;
revoke all on function app2_private.member() from public,anon;
grant execute on function app2_private.member() to authenticated;
create or replace function public.app2_can_write() returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((app2_private.member()).role in ('admin','editor'),false);
$$;
create function public.app2_is_admin() returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((app2_private.member()).role='admin',false);
$$;
create function public.app2_me() returns uuid language sql stable security invoker set search_path='' as $$ select (app2_private.member()).person_id; $$;
create or replace function public.app2_can_read(p_company smallint) returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((app2_private.member()).role in ('admin','editor') or ((app2_private.member()).role='company' and (app2_private.member()).company=p_company),false);
$$;
revoke all on function public.app2_is_admin(),public.app2_me() from public,anon;
grant execute on function public.app2_is_admin(),public.app2_me() to authenticated;
drop policy member_self on public.app2_members;
create policy members_read on public.app2_members for select to authenticated using(public.app2_is_admin() or (email=lower((select auth.jwt()->>'email')) and auth.uid() is not null));
grant insert,update,delete on public.app2_members to authenticated;
create policy members_admin on public.app2_members for all to authenticated using(public.app2_is_admin()) with check(public.app2_is_admin());
-- Prevent accidental removal/demotion of the last administrator.
create function app2_private.protect_admin() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.role='admin' and old.enabled and (tg_op='DELETE' or new.role<>'admin' or not new.enabled) then
  perform pg_advisory_xact_lock(8211401);
  if not exists(select 1 from public.app2_members where role='admin' and enabled and email<>old.email) then raise exception '마지막 관리자 권한은 제거할 수 없습니다.'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
revoke all on function app2_private.protect_admin() from public,anon,authenticated;
create trigger protect_last_admin before update or delete on public.app2_members for each row execute function app2_private.protect_admin();

create function app2_private.can_person(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.app2_people p cross join lateral app2_private.member() m
 where p.id=p_id and (m.role in ('admin','editor') or (m.role='company' and p.mode='semester' and p.company=m.company) or m.person_id=p.id or (m.role='mentor' and p.mode='training' and p.mentor_id=m.person_id)));
$$;
revoke all on function app2_private.can_person(uuid) from public,anon;
grant execute on function app2_private.can_person(uuid) to authenticated;
drop policy scope_read on public.app2_people;
create policy people_read on public.app2_people for select to authenticated using(app2_private.can_person(id));

create table public.app2_occupancy (
 id uuid primary key default gen_random_uuid(), mode text not null check(mode in ('semester','training')),
 person_id uuid not null references public.app2_people(id), room_id uuid not null references public.app2_rooms(id),
 seat smallint not null check(seat between 1 and 20), company smallint not null check(company between 1 and 8),
 version bigint not null default 1, updated_at timestamptz not null default now(),unique(person_id),unique(room_id,seat)
);
create index app2_occupancy_room_idx on public.app2_occupancy(room_id);
create function app2_private.can_room(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and ((select public.app2_can_write()) or exists(select 1 from public.app2_occupancy o where o.room_id=p_id and app2_private.can_person(o.person_id)));
$$;
revoke all on function app2_private.can_room(uuid) from public,anon;
grant execute on function app2_private.can_room(uuid) to authenticated;
drop policy scope_read on public.app2_rooms;
create policy rooms_read on public.app2_rooms for select to authenticated using(app2_private.can_room(id));

create table public.app2_catalog (
 id text primary key, section text not null check(section in ('supplies','duty','saber','uniform','assets','firearm','shared')),
 name text not null, fields jsonb not null check(jsonb_typeof(fields)='array'), position int not null default 0,
 enabled boolean not null default true, version bigint not null default 1,updated_at timestamptz not null default now()
);
create table public.app2_inventory (
 id uuid primary key default gen_random_uuid(), mode text not null check(mode in ('semester','training')),
 person_id uuid references public.app2_people(id), room_id uuid references public.app2_rooms(id),
 catalog_id text not null references public.app2_catalog(id),company smallint check(company between 1 and 8),
 values jsonb not null default '{}' check(jsonb_typeof(values)='object'),
 version bigint not null default 1,updated_at timestamptz not null default now(),check(person_id is null or room_id is null)
);
create unique index app2_inventory_person_idx on public.app2_inventory(person_id,catalog_id) where person_id is not null;
create unique index app2_inventory_room_idx on public.app2_inventory(room_id,catalog_id) where room_id is not null;
create index app2_inventory_scope_idx on public.app2_inventory(mode,company,catalog_id);
create index app2_inventory_catalog_idx on public.app2_inventory(catalog_id);
create table public.app2_duties (
 id uuid primary key default gen_random_uuid(),mode text not null check(mode in ('semester','training')),
 person_id uuid not null references public.app2_people(id), company smallint not null check(company between 1 and 8),
 unit text not null, position text not null, email text not null default '',phone text not null default '',
 version bigint not null default 1,updated_at timestamptz not null default now(),unique(mode,unit,position,person_id)
);
create index app2_duties_person_idx on public.app2_duties(person_id);
create table public.app2_labor (
 id uuid primary key default gen_random_uuid(),mode text not null check(mode in ('semester','training')),company smallint not null check(company between 1 and 8),
 work_date date not null,title text not null, headcount int not null check(headcount>=0),hours numeric not null check(hours>=0),details text not null default '',
 version bigint not null default 1,updated_at timestamptz not null default now()
);
create table public.app2_surveys (
 id uuid primary key default gen_random_uuid(),mode text not null check(mode in ('semester','training')),company smallint check(company between 1 and 8),cohort smallint,
 section text not null check(section in ('supplies','duty','saber','uniform','assets','firearm')),
 title text not null,starts_at timestamptz not null,ends_at timestamptz not null,enabled boolean not null default true,
 version bigint not null default 1,updated_at timestamptz not null default now(),check(ends_at>starts_at)
);
create table public.app2_requests (
 id uuid primary key default gen_random_uuid(),batch_id uuid not null,mode text not null check(mode in ('semester','training')),
 person_id uuid not null references public.app2_people(id),catalog_id text not null references public.app2_catalog(id),
 room_id uuid references public.app2_rooms(id),inventory_id uuid references public.app2_inventory(id) on delete set null,
 company smallint not null,base_version bigint not null default 0,before_values jsonb not null default '{}',values jsonb not null,
 survey_id uuid references public.app2_surveys(id),status text not null check(status in ('검토 대기','반영 완료','반려','삭제')),
 created_at timestamptz not null default now(),submitted_by text not null,reviewed_at timestamptz,reviewed_by text,reason text not null default '',unique(batch_id,catalog_id,person_id)
);
create index app2_requests_scope_idx on public.app2_requests(mode,company,status,created_at desc);
create index app2_requests_person_idx on public.app2_requests(person_id,catalog_id,created_at desc);
create index app2_requests_survey_idx on public.app2_requests(survey_id);
create index app2_requests_inventory_idx on public.app2_requests(inventory_id);
create index app2_requests_catalog_idx on public.app2_requests(catalog_id);
create index app2_requests_room_idx on public.app2_requests(room_id);
create table public.app2_settings (id text primary key, value jsonb not null,version bigint not null default 1,updated_at timestamptz not null default now());

create function app2_private.validate_values(p_catalog text,p_values jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare f jsonb; v jsonb; k text;
begin
 if jsonb_typeof(p_values)<>'object' or octet_length(p_values::text)>20000 then raise exception '입력값 형식 또는 크기를 확인하세요.'; end if;
 if not exists(select 1 from public.app2_catalog where id=p_catalog and enabled) then raise exception '사용할 수 없는 품목입니다.'; end if;
 for k in select jsonb_object_keys(p_values) loop
  if not exists(select 1 from public.app2_catalog c,jsonb_array_elements(c.fields) as entry(value) where c.id=p_catalog and entry.value->>'key'=k) then raise exception '등록되지 않은 항목: %',k; end if;
 end loop;
 for f in select jsonb_array_elements(fields) from public.app2_catalog where id=p_catalog loop
  v=p_values->(f->>'key'); if v is null or v='null'::jsonb or v='""'::jsonb then continue; end if;
  if f->>'type'='quantity' and (jsonb_typeof(v)<>'number' or (v::text)::numeric<0 or trunc((v::text)::numeric)<>(v::text)::numeric or (v::text)::numeric>100000) then raise exception '수량은 0 이상의 정수여야 합니다.'; end if;
  if f->>'type'='select' and not (f->'options' @> jsonb_build_array(v)) then raise exception '선택 항목을 확인하세요: %',f->>'label'; end if;
  if f->>'type'='text' and (jsonb_typeof(v)<>'string' or length(v::text)>5000) then raise exception '문자열 길이를 확인하세요.'; end if;
 end loop;
end $$;
revoke all on function app2_private.validate_values(text,jsonb) from public,anon;
grant execute on function app2_private.validate_values(text,jsonb) to authenticated;
create function app2_private.domain_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.app2_people; r public.app2_rooms;
begin
 if new.person_id is not null then select * into strict p from public.app2_people where id=new.person_id; if new.mode<>p.mode then raise exception '인원과 운영 구분이 다릅니다.'; end if; new.company=p.company; end if;
 if tg_table_name in ('app2_occupancy','app2_inventory') then
 if new.room_id is not null then
  select * into strict r from public.app2_rooms where id=new.room_id;
  if new.mode<>r.mode then raise exception '방과 운영 구분이 다릅니다.'; end if;
  if tg_table_name='app2_occupancy' then if new.seat>r.capacity then raise exception '방 정원보다 큰 자리는 배정할 수 없습니다.'; end if; end if;
 end if;
 end if;
 if tg_table_name='app2_inventory' then perform app2_private.validate_values(new.catalog_id,new.values); end if;
 return new;
end $$;
revoke all on function app2_private.domain_guard() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['app2_occupancy','app2_inventory','app2_duties','app2_labor','app2_surveys','app2_catalog','app2_settings'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated,service_role',t);
  execute format('create policy editors on public.%I for all to authenticated using ((select public.app2_can_write())) with check ((select public.app2_can_write()))',t);
  execute format('create trigger version_update before update on public.%I for each row execute function public.app2_touch()',t);
 end loop;
 foreach t in array array['app2_occupancy','app2_inventory','app2_duties'] loop
  execute format('create trigger scope_guard before insert or update on public.%I for each row execute function app2_private.domain_guard()',t);
 end loop;
end $$;
create policy catalog_read on public.app2_catalog for select to authenticated using((app2_private.member()).email is not null);
create policy settings_read on public.app2_settings for select to authenticated using((app2_private.member()).email is not null);
create policy occupancy_read on public.app2_occupancy for select to authenticated using(app2_private.can_person(person_id));
create policy duties_read on public.app2_duties for select to authenticated using(app2_private.can_person(person_id));
create policy inventory_read on public.app2_inventory for select to authenticated using(app2_private.can_person(person_id) or app2_private.can_room(room_id));
create policy labor_read on public.app2_labor for select to authenticated using(public.app2_can_read(company) and mode='semester');
create policy survey_read on public.app2_surveys for select to authenticated using((app2_private.member()).email is not null);
alter table public.app2_requests enable row level security;
revoke all on public.app2_requests from public,anon,authenticated;
grant select on public.app2_requests to authenticated;
grant all on public.app2_requests to service_role;
create policy request_read on public.app2_requests for select to authenticated using(app2_private.can_person(person_id));
