-- Preserve canonical bytes while avoiding a recursive SQL call per scalar cell.
create or replace function public.logbook_canonical_json(p jsonb) returns text
language sql immutable strict set search_path='' as $$
select case jsonb_typeof(p)
when 'object' then '{'||coalesce((select string_agg(to_jsonb(e.key)::text||':'||
 case when jsonb_typeof(e.value) in ('object','array') then public.logbook_canonical_json(e.value) else e.value::text end,
 ',' order by e.key collate "C") from jsonb_each(p) e),'')||'}'
when 'array' then '['||coalesce((select string_agg(
 case when jsonb_typeof(e.value) in ('object','array') then public.logbook_canonical_json(e.value) else e.value::text end,
 ',' order by e.ord) from jsonb_array_elements(p) with ordinality e(value,ord)),'')||']'
else p::text end; $$;

create or replace function public.logbook_seed(p_dataset uuid,p_book jsonb,p_sheet jsonb,p_rows jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare n integer; stored jsonb;
begin
 perform 1 from public.logbook_datasets where id=p_dataset and activated_at is null for update;
 if not found then raise exception 'Snapshot replacement is disabled after cutover'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) with ordinality r(value,ord) where (r.value->>'number')::integer is distinct from r.ord)
 then raise exception 'Non-contiguous source rows'; end if;
 insert into public.logbook_books(dataset_id,id,metadata) values(p_dataset,p_book->>'id',p_book-'sheets')
 on conflict(dataset_id,id) do update set metadata=excluded.metadata;
 insert into public.logbook_sheets(dataset_id,book_id,id,title,columns_count,rows_count,position,metadata)
 values(p_dataset,p_book->>'id',(p_sheet->>'id')::bigint,p_sheet->>'title',(p_sheet->>'columns')::integer,jsonb_array_length(p_rows),(p_sheet->>'position')::integer,p_sheet-'id'-'title'-'rows'-'columns'-'position'-'revision')
 on conflict(dataset_id,book_id,id) do update set title=excluded.title,columns_count=excluded.columns_count,rows_count=excluded.rows_count,position=excluded.position,metadata=excluded.metadata,revision=public.logbook_sheets.revision+1;
 delete from public.logbook_rows where dataset_id=p_dataset and book_id=p_book->>'id' and sheet_id=(p_sheet->>'id')::bigint;
 insert into public.logbook_rows(dataset_id,book_id,sheet_id,row_number,payload)
 select p_dataset,p_book->>'id',(p_sheet->>'id')::bigint,r.ord,r.value from jsonb_array_elements(p_rows) with ordinality r(value,ord);
 get diagnostics n=row_count;
 select coalesce(jsonb_agg(payload order by row_number),'[]') into stored from public.logbook_rows
 where dataset_id=p_dataset and book_id=p_book->>'id' and sheet_id=(p_sheet->>'id')::bigint;
 return jsonb_build_object('ok',true,'rows',n,'checksum',encode(extensions.digest(convert_to(public.logbook_canonical_json(stored),'UTF8'),'sha256'),'hex'));
end $$;
revoke all on function public.logbook_canonical_json(jsonb),public.logbook_seed(uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.logbook_canonical_json(jsonb),public.logbook_seed(uuid,jsonb,jsonb,jsonb) to service_role;
