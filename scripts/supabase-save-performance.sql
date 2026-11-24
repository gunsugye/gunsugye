-- Keep exact JSONB equality; the hash is only a bounded-size lookup accelerator.
set local lock_timeout='5s';
create index if not exists logbook_rows_identity_lookup
 on public.logbook_rows(dataset_id,book_id,sheet_id,(pg_catalog.jsonb_hash(payload->'values'->0)))
 where row_number>1;
do $$
declare source text:=pg_get_functiondef('public.logbook_commit(uuid,uuid,text,text,jsonb)'::regprocedure);
old text:='and r.row_number>1 and r.payload->''values''->0=item->''values''->0';
new text:='and r.row_number>1 and pg_catalog.jsonb_hash(r.payload->''values''->0)=pg_catalog.jsonb_hash(item->''values''->0) and r.payload->''values''->0=item->''values''->0';
begin
 if position(new in source)>0 then return; end if;
 if position(old in source)=0 then raise exception 'Unexpected commit function; migration stopped'; end if;
 execute replace(source,old,new);
end $$;
