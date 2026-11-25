-- A deterministic compare-and-swap conflict must not trigger PostgREST's
-- automatic serialization retries (SQLSTATE 40001).
do $migration$
declare fn regprocedure; definition text;
begin
 foreach fn in array array[
  'public.logbook_commit(uuid,uuid,text,text,jsonb)'::regprocedure,
  'public.logbook_transaction(uuid,uuid,text,text,jsonb)'::regprocedure
 ] loop
  definition := pg_get_functiondef(fn);
  definition := replace(definition, 'errcode=''40001''', 'errcode=''PT409''');
  execute definition;
 end loop;
end $migration$;
