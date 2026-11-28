create table public.app2_meals (
 id uuid primary key default gen_random_uuid(),mode text not null check(mode in ('semester','training')),
 company smallint not null check(company between 1 and 8),work_date date not null,
 meal text not null check(meal in ('조식','중식','석식')),headcount integer not null check(headcount>=0),details text not null default '',
 version bigint not null default 1,updated_at timestamptz not null default now(),unique(mode,company,work_date,meal)
);
alter table public.app2_meals enable row level security;
revoke all on public.app2_meals from public,anon,authenticated;
grant select,insert,update,delete on public.app2_meals to authenticated,service_role;
create policy meal_read on public.app2_meals for select to authenticated using(public.app2_can_read(company) and (mode='semester' or public.app2_can_write()));
create policy meal_write on public.app2_meals for all to authenticated using(public.app2_can_write()) with check(public.app2_can_write());
create trigger version_update before update on public.app2_meals for each row execute function public.app2_touch();
