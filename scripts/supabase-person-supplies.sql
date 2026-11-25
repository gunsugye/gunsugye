-- Server-only, indexed personal read model. Existing IDs and display values stay intact.
create or replace function public.logbook_person_supplies(p_dataset uuid,p_book text,p_person text,p_items jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
begin
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>70 or length(p_person)>100 or p_person='' then
  raise exception 'Invalid personal supply query';
 end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',i->>'id','headers',h.payload->'display',
  'rows',coalesce((select jsonb_agg(r.payload->'display' order by r.row_number) from public.logbook_rows r
   where r.dataset_id=p_dataset and r.book_id=p_book and r.sheet_id=s.id and r.row_number>1
   and pg_catalog.jsonb_hash(r.payload->'values'->0)=pg_catalog.jsonb_hash(to_jsonb(p_person))
   and r.payload->'values'->>0=p_person),'[]'),
  'choices',coalesce((select jsonb_object_agg(f.value,coalesce((select jsonb_agg(v) from
   (select distinct r.payload->'display'->>(col.n::integer-1) v from public.logbook_rows r
    where r.dataset_id=p_dataset and r.book_id=p_book and r.sheet_id=s.id and r.row_number>1
    and coalesce(r.payload->'display'->>(col.n::integer-1),'')<>'' order by v) q),'[]'))
   from jsonb_array_elements_text(coalesce(i->'choices','[]')) f(value)
   join lateral jsonb_array_elements_text(h.payload->'display') with ordinality col(value,n) on col.value=f.value),'{}'))),'[]')
 from jsonb_array_elements(p_items) i
 join public.logbook_sheets s on s.dataset_id=p_dataset and s.book_id=p_book and s.id=(i->>'sheet')::bigint
 join public.logbook_rows h on h.dataset_id=s.dataset_id and h.book_id=s.book_id and h.sheet_id=s.id and h.row_number=1);
end $$;
revoke all on function public.logbook_person_supplies(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.logbook_person_supplies(uuid,text,text,jsonb) to service_role;
