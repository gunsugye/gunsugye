create or replace function public.logbook_read_sheets(p_dataset uuid,p_sheets jsonb) returns jsonb
language sql stable set search_path='' set work_mem='16MB' as $$
 with requested as materialized (
 select value->>'book' book,(value->>'sheet')::bigint sheet,ordinality pos
 from jsonb_array_elements(p_sheets) with ordinality
 ), selected as materialized (
 select distinct book,sheet from requested
 ), payloads as materialized (
 select r.book_id,r.sheet_id,jsonb_agg(r.payload order by r.row_number) payload
 from selected q join public.logbook_rows r on r.dataset_id=p_dataset and r.book_id=q.book and r.sheet_id=q.sheet
 group by r.book_id,r.sheet_id
 )
 select coalesce(jsonb_agg(jsonb_build_object('book',q.book,'sheet',q.sheet,'data',
 case when s.id is null then null else jsonb_build_object('id',s.id,'title',s.title,'rows',s.rows_count,'columns',s.columns_count,'revision',s.revision,'payload',coalesce(p.payload,'[]'::jsonb)) end) order by q.pos),'[]'::jsonb)
 from requested q left join public.logbook_sheets s on s.dataset_id=p_dataset and s.book_id=q.book and s.id=q.sheet
 left join payloads p on p.book_id=q.book and p.sheet_id=q.sheet;
$$;
revoke all on function public.logbook_read_sheets(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.logbook_read_sheets(uuid,jsonb) to service_role;
