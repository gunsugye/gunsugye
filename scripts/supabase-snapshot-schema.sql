-- Private migration staging. No browser roles can read or write these records.
create table public.logbook_import_runs (
 id uuid primary key,
 status text not null default 'copying' check (status in ('copying','verified','failed')),
 created_at timestamptz not null default now(),
 manifest jsonb not null,
 verified_at timestamptz,
 check (jsonb_typeof(manifest)='object')
);
create table public.logbook_import_chunks (
 run_id uuid not null references public.logbook_import_runs(id),
 book_id text not null,
 sheet_id bigint not null,
 start_row integer not null check(start_row>0),
 row_count integer not null check(row_count between 1 and 200),
 checksum text not null check(checksum ~ '^[0-9a-f]{64}$'),
 payload jsonb not null,
 primary key(run_id,book_id,sheet_id,start_row),
 check (jsonb_typeof(payload)='array' and jsonb_array_length(payload)=row_count)
);
alter table public.logbook_import_runs enable row level security;
alter table public.logbook_import_chunks enable row level security;
revoke all on public.logbook_import_runs,public.logbook_import_chunks from public,anon,authenticated;
grant select,insert,update on public.logbook_import_runs,public.logbook_import_chunks to service_role;
comment on table public.logbook_import_runs is 'Whole-workbook migration snapshots; not the active application datastore until verified and explicitly cut over.';
