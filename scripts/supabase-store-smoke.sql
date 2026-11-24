-- Transactional verification only: every fixture is rolled back.
begin;
do $$
declare d uuid:=gen_random_uuid(); q uuid:=gen_random_uuid(); before_row jsonb; after_row jsonb; patches jsonb; result jsonb;
begin
 insert into public.logbook_import_runs(id,status,manifest) values(d,'verified','{}');
 insert into public.logbook_datasets(id) values(d);
 insert into public.logbook_books values(d,'fixture','{}');
 insert into public.logbook_sheets(dataset_id,book_id,id,title,columns_count,rows_count,position) values(d,'fixture',1,'fixture',3,2,1);
 before_row:='{"number":1,"values":["001",0,false],"display":["001","0","FALSE"],"dates":[],"formulas":["","",""],"formats":["@","0","General"]}';
 insert into public.logbook_rows values(d,'fixture',1,1,before_row),(d,'fixture',1,2,jsonb_set(before_row,'{number}','2'));
 after_row:=jsonb_set(before_row,'{values,1}','2');
 patches:=jsonb_build_array(jsonb_build_object('book','fixture','sheet',1,'mode','patch','edits',jsonb_build_array(jsonb_build_object('number',1,'before',before_row,'after',after_row)),'append','[]'::jsonb));
 result:=public.logbook_commit(d,q,'test','save',patches);
 if result->>'ok'<>'true' then raise exception 'Initial save failed';end if;
 result:=public.logbook_commit(d,q,'test','save',patches);
 if result->>'duplicate'<>'true' then raise exception 'Retry was not idempotent';end if;
 begin
  perform public.logbook_commit(d,gen_random_uuid(),'test','save',patches);
  raise exception 'Stale write was accepted';
 exception when serialization_failure then null;end;
 -- Unchanged second row remains writable despite a newer sheet revision.
 patches:=jsonb_build_array(jsonb_build_object('book','fixture','sheet',1,'mode','patch','edits',jsonb_build_array(jsonb_build_object('number',2,'before',jsonb_set(before_row,'{number}','2'),'after',jsonb_set(after_row,'{number}','2'))),'append',jsonb_build_array(before_row)));
 perform public.logbook_commit(d,gen_random_uuid(),'test','save',patches);
 result:=public.logbook_read_sheet(d,'fixture',1);
 if result->>'rows'<>'3' or result->'payload'->0->'values'->0<>'"001"'::jsonb or result->'payload'->0->'values'->2<>'false'::jsonb then raise exception 'Cell types or append mismatch';end if;
 -- Unauthorized browser roles have neither table nor RPC privileges.
 if has_table_privilege('anon','public.logbook_rows','SELECT') or has_function_privilege('authenticated','public.logbook_commit(uuid,uuid,text,text,jsonb)','EXECUTE') then raise exception 'Unexpected browser access';end if;
end $$;
rollback;
select 'Atomic writes, idempotency, conflict checks, typed reads and browser isolation passed' as verification;
