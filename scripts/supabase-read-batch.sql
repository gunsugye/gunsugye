create function public.logbook_read_sheets(p_dataset uuid,p_sheets jsonb) returns jsonb
language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('book',s->>'book','sheet',(s->>'sheet')::bigint,'data',public.logbook_read_sheet(p_dataset,s->>'book',(s->>'sheet')::bigint))),'[]')
 from jsonb_array_elements(p_sheets) s;
$$;
revoke all on function public.logbook_read_sheets(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.logbook_read_sheets(uuid,jsonb) to service_role;
