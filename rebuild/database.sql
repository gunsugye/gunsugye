-- New application tables. Existing logbook_* tables remain independent.
create table public.app2_members (
 email text primary key check(email=lower(email)),
 role text not null check(role in ('admin','editor','company')),
 company smallint check(company between 1 and 8),
 enabled boolean not null default true,
 check(role <> 'company' or company is not null)
);
alter table public.app2_members enable row level security;
revoke all on public.app2_members from public,anon,authenticated;
grant select on public.app2_members to authenticated;
grant all on public.app2_members to service_role;
create policy member_self on public.app2_members for select to authenticated
 using (auth.uid() is not null and email=lower((select auth.jwt()->>'email')) and enabled);

create function public.app2_can_read(p_company smallint) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.app2_members m where m.enabled and (m.role in ('admin','editor') or m.company=p_company));
$$;
create function public.app2_can_write() returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.app2_members m where m.enabled and m.role in ('admin','editor'));
$$;
revoke all on function public.app2_can_read(smallint),public.app2_can_write() from public,anon;
grant execute on function public.app2_can_read(smallint),public.app2_can_write() to authenticated,service_role;

create table public.app2_journal (
 id uuid primary key default gen_random_uuid(),
 mode text not null check(mode in ('semester','training')),
 work_date date not null,
 company smallint check(company between 1 and 8),
 category text not null default '일반',
 title text not null check(length(trim(title)) between 1 and 200),
 details text not null default '' check(length(details)<=10000),
 status text not null default '진행 중' check(status in ('예정','진행 중','완료')),
 version bigint not null default 1,
 updated_at timestamptz not null default now()
);
create index app2_journal_scope_idx on public.app2_journal(mode,company,work_date desc,id);
create table public.app2_people (
 id uuid primary key default gen_random_uuid(),
 mode text not null check(mode in ('semester','training')),
 cohort smallint not null check(cohort between 1 and 999),
 company smallint not null check(company between 1 and 8),
 name text not null check(length(trim(name)) between 1 and 60),
 cadet_number text not null default '',
 firearm_number text not null default '',
 status text not null default '재학' check(status in ('재학','위탁','휴학','퇴교')),
 details text not null default '',
 version bigint not null default 1,
 updated_at timestamptz not null default now()
);
create unique index app2_people_number_idx on public.app2_people(mode,cadet_number) where cadet_number<>'';
create index app2_people_scope_idx on public.app2_people(mode,company,cohort,name,id);
create table public.app2_rooms (
 id uuid primary key default gen_random_uuid(),
 mode text not null check(mode in ('semester','training')),
 building text not null check(building in ('본관','동관','서관')),
 floor smallint not null check(floor between 1 and 20),
 room_number text not null check(length(trim(room_number)) between 1 and 20),
 company smallint check(company between 1 and 8),
 capacity smallint not null default 2 check(capacity between 1 and 20),
 details text not null default '',
 version bigint not null default 1,
 updated_at timestamptz not null default now(),
 unique(mode,building,floor,room_number)
);
create index app2_rooms_scope_idx on public.app2_rooms(mode,company,building,floor);
create function public.app2_touch() returns trigger language plpgsql set search_path='' as $$
begin new.version:=old.version+1; new.updated_at:=now(); return new; end;
$$;
revoke all on function public.app2_touch() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['app2_journal','app2_people','app2_rooms'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated,service_role',t);
  execute format('create policy scope_read on public.%I for select to authenticated using (public.app2_can_read(company) and (mode=''semester'' or (select public.app2_can_write())))',t);
  execute format('create policy editor_insert on public.%I for insert to authenticated with check ((select public.app2_can_write()))',t);
  execute format('create policy editor_update on public.%I for update to authenticated using ((select public.app2_can_write())) with check ((select public.app2_can_write()))',t);
  execute format('create policy editor_delete on public.%I for delete to authenticated using ((select public.app2_can_write()))',t);
  execute format('create trigger version_update before update on public.%I for each row execute function public.app2_touch()',t);
 end loop;
end $$;
-- Only access configuration is seeded. No operational records are imported.
insert into public.app2_members(email,role) values ('gunsugye@gmail.com','admin');
