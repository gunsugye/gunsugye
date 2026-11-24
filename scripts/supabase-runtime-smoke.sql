begin;
do $$
declare d uuid:=gen_random_uuid(); q uuid:=gen_random_uuid(); p jsonb; result jsonb;
begin
 insert into public.logbook_import_runs(id,status,manifest) values(d,'verified','{}');
 insert into public.logbook_datasets(id) values(d);
 insert into public.logbook_books values(d,'fixture','{"id":"fixture"}');
 p:='{"schema":[{"op":"create","book":"fixture","sheet":1,"title":"new"}],"changes":[{"book":"fixture","sheet":1,"mode":"patch","edits":[],"append":[{"number":1,"values":["001",0,false],"display":["001","0","FALSE"],"dates":[],"formulas":["","",""],"formats":["@","0","General"]}]}],"settings":[{"key":"order","before":null,"after":"a,b"}],"attachments":[{"id":"attachment","content":"data"}]}';
 result:=public.logbook_transaction(d,q,'test','test',p);
 if result->>'ok'<>'true' then raise exception 'Create failed'; end if;
 result:=public.logbook_transaction(d,q,'test','test',p);
 if result->>'duplicate'<>'true' then raise exception 'Duplicate transaction not recognized'; end if;
 if (public.logbook_manifest(d)->'settings'->>'order')<>'a,b' or public.logbook_attachment(d,'attachment')->>'content'<>'data' then raise exception 'Metadata not persisted'; end if;
 begin
  perform public.logbook_transaction(d,gen_random_uuid(),'test','test','{"schema":[{"op":"create","book":"fixture","sheet":2,"title":"must-rollback"}],"settings":[{"key":"order","before":null,"after":"wrong"}]}');
  raise exception 'Stale settings accepted';
 exception when serialization_failure then null;end;
 if exists(select 1 from public.logbook_sheets where dataset_id=d and id=2) then raise exception 'Partial schema persisted'; end if;
 perform public.logbook_transaction(d,gen_random_uuid(),'test','test',jsonb_build_object('schema','[{"op":"rename","book":"fixture","sheet":1,"title":"renamed","revision":1}]'::jsonb,'changes',jsonb_build_array(jsonb_build_object('book','fixture','sheet',1,'revision',1,'mode','replace','rows',public.logbook_read_sheet(d,'fixture',1)->'payload'))));
 if public.logbook_read_sheet(d,'fixture',1)->>'title'<>'renamed' then raise exception 'Rename failed'; end if;
 perform public.logbook_transaction(d,gen_random_uuid(),'test','test','{"schema":[{"op":"delete","book":"fixture","sheet":1,"revision":2}]}');
 if exists(select 1 from public.logbook_rows where dataset_id=d) then raise exception 'Delete did not cascade'; end if;
 perform public.logbook_activate(d);
 begin
  perform public.logbook_seed_manifest(d,'{}');raise exception 'Active dataset accepted stale source';
 exception when raise_exception then if sqlerrm='Active dataset accepted stale source' then raise;end if;end;
 if has_function_privilege('anon','public.logbook_transaction(uuid,uuid,text,text,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.logbook_seed(uuid,jsonb,jsonb,jsonb)','EXECUTE') then raise exception 'Browser RPC access';end if;
end $$;
rollback;
select 'Schema, settings, attachments, retry, atomic rollback, rename/delete and cutover guard passed' as verification;
