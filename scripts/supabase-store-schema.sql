-- Compatibility storage: preserve existing workbook, sheet, record IDs and typed values.
-- Datasets stay isolated until all compatibility and source-delta checks pass.
create table public.logbook_datasets (
 id uuid primary key references public.logbook_import_runs(id),
 settings jsonb not null default '{}',
 attachments jsonb not null default '[]',
 created_at timestamptz not null default now()
);
create table public.logbook_books (
 dataset_id uuid not null references public.logbook_datasets(id),
 id text not null,
 metadata jsonb not null,
 primary key(dataset_id,id)
);
create table public.logbook_sheets (
 dataset_id uuid not null,
 book_id text not null,
 id bigint not null,
 title text not null,
 columns_count integer not null check(columns_count>=0),
 rows_count integer not null check(rows_count>=0),
 revision bigint not null default 0,
 position integer not null,
 primary key(dataset_id,book_id,id),
 unique(dataset_id,book_id,title),
 foreign key(dataset_id,book_id) references public.logbook_books(dataset_id,id)
);
create table public.logbook_rows (
 dataset_id uuid not null,
 book_id text not null,
 sheet_id bigint not null,
 row_number integer not null check(row_number>0),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 primary key(dataset_id,book_id,sheet_id,row_number),
 foreign key(dataset_id,book_id,sheet_id) references public.logbook_sheets(dataset_id,book_id,id) on delete cascade
);
create table public.logbook_commits (
 dataset_id uuid not null references public.logbook_datasets(id),
 request_id uuid not null,
 request_hash text not null,
 actor text not null,
 method text not null,
 created_at timestamptz not null default now(),
 primary key(dataset_id,request_id)
);
create index logbook_rows_identity_lookup
 on public.logbook_rows(dataset_id,book_id,sheet_id,(pg_catalog.jsonb_hash(payload->'values'->0))) where row_number>1;
alter table public.logbook_datasets enable row level security;
alter table public.logbook_books enable row level security;
alter table public.logbook_sheets enable row level security;
alter table public.logbook_rows enable row level security;
alter table public.logbook_commits enable row level security;
revoke all on public.logbook_datasets,public.logbook_books,public.logbook_sheets,public.logbook_rows,public.logbook_commits from public,anon,authenticated;
grant all on public.logbook_datasets,public.logbook_books,public.logbook_sheets,public.logbook_rows,public.logbook_commits to service_role;

create function public.logbook_materialize(p_run uuid) returns jsonb
language plpgsql set search_path='' as $$
declare m jsonb; b jsonb; s jsonb; n integer; total bigint;
begin
 select manifest into strict m from public.logbook_import_runs where id=p_run and status='verified' for update;
 if exists(select 1 from public.logbook_datasets where id=p_run) then raise exception 'Dataset already exists'; end if;
 insert into public.logbook_datasets(id,settings,attachments) values(p_run,coalesce(m->'settings','{}'),coalesce(m->'attachments','[]'));
 for b in select value from jsonb_array_elements(m->'books') loop
  insert into public.logbook_books values(p_run,b->>'id',b-'sheets');n:=0;
  for s in select value from jsonb_array_elements(b->'sheets') loop
   n:=n+1;
   insert into public.logbook_sheets(dataset_id,book_id,id,title,columns_count,rows_count,position)
    values(p_run,b->>'id',(s->>'id')::bigint,s->>'title',(s->>'columns')::integer,(s->>'rows')::integer,n);
   insert into public.logbook_rows(dataset_id,book_id,sheet_id,row_number,payload)
    select p_run,c.book_id,c.sheet_id,(r->>'number')::integer,r from public.logbook_import_chunks c
    cross join lateral jsonb_array_elements(c.payload) r where c.run_id=p_run and c.book_id=b->>'id' and c.sheet_id=(s->>'id')::bigint;
   select count(*) into total from public.logbook_rows where dataset_id=p_run and book_id=b->>'id' and sheet_id=(s->>'id')::bigint;
   if total<>(s->>'rows')::integer or exists(select 1 from public.logbook_rows where dataset_id=p_run and book_id=b->>'id' and sheet_id=(s->>'id')::bigint and row_number>total) then raise exception 'Incomplete sheet'; end if;
  end loop;
 end loop;
 return jsonb_build_object('ok',true,'rows',(select count(*) from public.logbook_rows where dataset_id=p_run));
end $$;

create function public.logbook_read_sheet(p_dataset uuid,p_book text,p_sheet bigint) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('id',s.id,'title',s.title,'rows',s.rows_count,'columns',s.columns_count,'revision',s.revision,
 'payload',coalesce((select jsonb_agg(r.payload order by r.row_number) from public.logbook_rows r
 where r.dataset_id=s.dataset_id and r.book_id=s.book_id and r.sheet_id=s.id),'[]'))
 from public.logbook_sheets s where dataset_id=p_dataset and book_id=p_book and id=p_sheet;
$$;

-- One transaction for all changed sheets. Disjoint row edits can commit concurrently.
-- Appends allocate row positions under a brief PostgreSQL row lock.
create function public.logbook_commit(p_dataset uuid,p_request uuid,p_actor text,p_method text,p_changes jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare change jsonb; edit jsonb; cur public.logbook_sheets%rowtype; prior jsonb; target integer;
 digest text:=md5(p_changes::text); existing text; item jsonb;
begin
 if jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes)>200 then raise exception 'Invalid changes'; end if;
 insert into public.logbook_commits(dataset_id,request_id,request_hash,actor,method) values(p_dataset,p_request,digest,p_actor,p_method)
 on conflict do nothing;
 if not found then
  select request_hash into existing from public.logbook_commits where dataset_id=p_dataset and request_id=p_request;
  if existing<>digest then raise exception 'Request ID reused with different content';end if;
  return jsonb_build_object('ok',true,'duplicate',true);
 end if;
 -- Deterministic lock order prevents deadlocks for multi-sheet edits.
 for change in select value from jsonb_array_elements(p_changes) order by value->>'book', (value->>'sheet')::bigint loop
  select * into strict cur from public.logbook_sheets where dataset_id=p_dataset and book_id=change->>'book' and id=(change->>'sheet')::bigint for update;
  if change->>'mode'='replace' then
   if cur.revision<>(change->>'revision')::bigint then raise exception 'Record changed; reload before saving' using errcode='40001';end if;
   if jsonb_typeof(change->'rows')<>'array' then raise exception 'Invalid rows';end if;
   delete from public.logbook_rows where dataset_id=p_dataset and book_id=cur.book_id and sheet_id=cur.id;
   insert into public.logbook_rows(dataset_id,book_id,sheet_id,row_number,payload)
    select p_dataset,cur.book_id,cur.id,(r->>'number')::integer,r from jsonb_array_elements(change->'rows') r;
   cur.rows_count:=jsonb_array_length(change->'rows');
   if exists(select 1 from public.logbook_rows where dataset_id=p_dataset and book_id=cur.book_id and sheet_id=cur.id and row_number>cur.rows_count) then raise exception 'Non-contiguous rows';end if;
  elsif change->>'mode'='patch' then
   for edit in select value from jsonb_array_elements(change->'edits') loop
    target:=(edit->>'number')::integer;
    select payload into prior from public.logbook_rows where dataset_id=p_dataset and book_id=cur.book_id and sheet_id=cur.id and row_number=target;
    if prior is null or prior is distinct from edit->'before' then raise exception 'Record changed; reload before saving' using errcode='40001';end if;
    if target<>(edit->'after'->>'number')::integer then raise exception 'Invalid row number';end if;
    update public.logbook_rows set payload=edit->'after' where dataset_id=p_dataset and book_id=cur.book_id and sheet_id=cur.id and row_number=target;
   end loop;
   for item in select value from jsonb_array_elements(coalesce(change->'append','[]')) loop
    -- Existing API IDs are unique even when two callers read the same pre-append snapshot.
    if cur.rows_count>0 and coalesce(item->'values'->>0,'')<>''
       and exists(select 1 from public.logbook_rows h where h.dataset_id=p_dataset and h.book_id=cur.book_id and h.sheet_id=cur.id and h.row_number=1 and (h.payload->'values'->>0) ~ '(ID|아이디)$')
       and exists(select 1 from public.logbook_rows r where r.dataset_id=p_dataset and r.book_id=cur.book_id and r.sheet_id=cur.id and r.row_number>1 and pg_catalog.jsonb_hash(r.payload->'values'->0)=pg_catalog.jsonb_hash(item->'values'->0) and r.payload->'values'->0=item->'values'->0)
    then raise exception 'Record changed; reload before saving' using errcode='40001';end if;
    cur.rows_count:=cur.rows_count+1;
    insert into public.logbook_rows values(p_dataset,cur.book_id,cur.id,cur.rows_count,jsonb_set(item,'{number}',to_jsonb(cur.rows_count)));
   end loop;
  else raise exception 'Unsupported change mode';end if;
  update public.logbook_sheets set revision=revision+1,rows_count=cur.rows_count,columns_count=greatest(columns_count,coalesce((change->>'columns')::integer,columns_count))
   where dataset_id=p_dataset and book_id=cur.book_id and id=cur.id;
 end loop;
 return jsonb_build_object('ok',true,'duplicate',false);
end $$;
revoke all on function public.logbook_materialize(uuid),public.logbook_read_sheet(uuid,text,bigint),public.logbook_commit(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.logbook_materialize(uuid),public.logbook_read_sheet(uuid,text,bigint),public.logbook_commit(uuid,uuid,text,text,jsonb) to service_role;
