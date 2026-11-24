create function public.logbook_decode_rows(p jsonb) returns jsonb language sql immutable strict set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object('number',r.value->'number','dates',r.value->'dates','values',coalesce((select jsonb_agg(p->'dictionary'->(x.value::text)::integer order by x.ord) from jsonb_array_elements(r.value->'cells'->0) with ordinality x(value,ord)),'[]'::jsonb),
'display',coalesce((select jsonb_agg(p->'dictionary'->(x.value::text)::integer order by x.ord) from jsonb_array_elements(r.value->'cells'->1) with ordinality x(value,ord)),'[]'::jsonb),
'formulas',coalesce((select jsonb_agg(p->'dictionary'->(x.value::text)::integer order by x.ord) from jsonb_array_elements(r.value->'cells'->2) with ordinality x(value,ord)),'[]'::jsonb),
'formats',coalesce((select jsonb_agg(p->'dictionary'->(x.value::text)::integer order by x.ord) from jsonb_array_elements(r.value->'cells'->3) with ordinality x(value,ord)),'[]'::jsonb)) order by r.ord),'[]'::jsonb) from jsonb_array_elements(p->'rows') with ordinality r(value,ord);
$$;
revoke all on function public.logbook_decode_rows(jsonb) from public,anon,authenticated;
grant execute on function public.logbook_decode_rows(jsonb) to service_role;

create function public.logbook_canonical_json(p jsonb) returns text language sql immutable strict set search_path='' as $$
select case jsonb_typeof(p)
when 'object' then '{'||coalesce((select string_agg(to_jsonb(e.key)::text||':'||public.logbook_canonical_json(e.value),',' order by e.key collate "C") from jsonb_each(p) e),'')||'}'
when 'array' then '['||coalesce((select string_agg(public.logbook_canonical_json(e.value),',' order by e.ord) from jsonb_array_elements(p) with ordinality e(value,ord)),'')||']'
else p::text end; $$;
revoke all on function public.logbook_canonical_json(jsonb) from public,anon,authenticated;
grant execute on function public.logbook_canonical_json(jsonb) to service_role;
