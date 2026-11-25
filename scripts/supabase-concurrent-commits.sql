-- Ordinary row edits share a schema guard and lock only affected sheets.
-- Structural/settings writes acquire its exclusive counterpart before taking row locks.
-- A per-request guard keeps retries idempotent without locking the whole dataset.
do $migration$
declare source text:=pg_get_functiondef('public.logbook_transaction(uuid,uuid,text,text,jsonb)'::regprocedure);
old text:='perform 1 from public.logbook_datasets where id=p_dataset for update;';
replacement text:=$code$
 if exists(select 1 from jsonb_each(p_payload) e where e.key in ('schema','books','settings','attachments') and jsonb_array_length(e.value)>0) then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('logbook-schema:'||p_dataset::text,0));
 else
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('logbook-schema:'||p_dataset::text,0));
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('logbook-request:'||p_dataset::text||':'||p_request::text,0));
 perform 1 from public.logbook_datasets where id=p_dataset;
$code$;
begin
 if position('logbook-schema:' in source)>0 then return; end if;
 if position(old in source)=0 then raise exception 'Unexpected transaction function'; end if;
 execute replace(source,old,replacement);
end $migration$;
