-- Service-only runtime API. Atomic records, schema and settings changes.
alter table public.logbook_datasets add column revision bigint not null default 0;
alter table public.logbook_datasets add column activated_at timestamptz;
alter table public.logbook_sheets add column metadata jsonb not null default '{}';

create function public.logbook_manifest(p_dataset uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('id',d.id,'revision',d.revision,'activatedAt',d.activated_at,'settings',d.settings,
 'attachments',coalesce((select jsonb_agg(a-'content') from jsonb_array_elements(d.attachments) a),'[]'),
 'books',coalesce((select jsonb_agg(b.metadata||jsonb_build_object('id',b.id,'sheets',
 coalesce((select jsonb_agg(s.metadata||jsonb_build_object('id',s.id,'title',s.title,'columns',s.columns_count,'rows',s.rows_count,'revision',s.revision) order by s.position)
 from public.logbook_sheets s where s.dataset_id=b.dataset_id and s.book_id=b.id),'[]'))) from public.logbook_books b where b.dataset_id=d.id),'[]'))
 from public.logbook_datasets d where d.id=p_dataset;
$$;

create function public.logbook_attachment(p_dataset uuid,p_id text) returns jsonb
language sql stable set search_path='' as $$
 select a from public.logbook_datasets d cross join lateral jsonb_array_elements(d.attachments) a where d.id=p_dataset and a->>'id'=p_id;
$$;

create function public.logbook_transaction(p_dataset uuid,p_request uuid,p_actor text,p_method text,p_payload jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare x jsonb; s public.logbook_sheets%rowtype; prior jsonb; digest text:=md5(p_payload::text); saved text; out jsonb;
begin
 -- All transactions serialize briefly on the dataset row, not across application execution.
 perform 1 from public.logbook_datasets where id=p_dataset for update;
 if not found then raise exception 'Unknown dataset'; end if;
 select request_hash into saved from public.logbook_commits where dataset_id=p_dataset and request_id=p_request;
 if found then
  if saved<>digest then raise exception 'Request ID reused with different content'; end if;
  return jsonb_build_object('ok',true,'duplicate',true);
 end if;
 for x in select value from jsonb_array_elements(coalesce(p_payload->'books','[]')) where value->'before'='null'::jsonb loop
  insert into public.logbook_books(dataset_id,id,metadata) values(p_dataset,x->>'id',x->'after');
 end loop;
 for x in select value from jsonb_array_elements(coalesce(p_payload->'schema','[]')) loop
  if x->>'op'='create' then
   insert into public.logbook_sheets(dataset_id,book_id,id,title,columns_count,rows_count,position,metadata)
   values(p_dataset,x->>'book',(x->>'sheet')::bigint,x->>'title',0,0,
    coalesce((select max(position)+1 from public.logbook_sheets where dataset_id=p_dataset and book_id=x->>'book'),1),coalesce(x->'metadata','{}'));
  else
   select * into strict s from public.logbook_sheets where dataset_id=p_dataset and book_id=x->>'book' and id=(x->>'sheet')::bigint for update;
   if s.revision<>(x->>'revision')::bigint then raise exception 'Record changed; reload before saving' using errcode='40001'; end if;
   if x->>'op'='delete' then
    delete from public.logbook_sheets where dataset_id=p_dataset and book_id=s.book_id and id=s.id;
   elsif x->>'op'='rename' then
    update public.logbook_sheets set title=x->>'title' where dataset_id=p_dataset and book_id=s.book_id and id=s.id;
   else raise exception 'Unsupported schema action'; end if;
  end if;
 end loop;
 -- The original row compare-and-swap function remains the single write implementation.
 out:=public.logbook_commit(p_dataset,p_request,p_actor,p_method,coalesce(p_payload->'changes','[]'));
 for x in select value from jsonb_array_elements(coalesce(p_payload->'schema','[]')) where value->>'op'='rename' loop
  if not exists(select 1 from jsonb_array_elements(coalesce(p_payload->'changes','[]')) c where c->>'book'=x->>'book' and c->>'sheet'=x->>'sheet') then
   update public.logbook_sheets set revision=revision+1 where dataset_id=p_dataset and book_id=x->>'book' and id=(x->>'sheet')::bigint;
  end if;
 end loop;
 for x in select value from jsonb_array_elements(coalesce(p_payload->'settings','[]')) loop
  select settings->(x->>'key') into prior from public.logbook_datasets where id=p_dataset;
  if coalesce(prior,'null'::jsonb) is distinct from x->'before' then raise exception 'Settings changed; reload before saving' using errcode='40001'; end if;
  update public.logbook_datasets set settings=case when x->'after'='null'::jsonb then settings-(x->>'key') else jsonb_set(settings,array[x->>'key'],x->'after') end where id=p_dataset;
 end loop;
 for x in select value from jsonb_array_elements(coalesce(p_payload->'books','[]')) where value->'before'<>'null'::jsonb loop
  select metadata into strict prior from public.logbook_books where dataset_id=p_dataset and id=x->>'id';
  if prior is distinct from x->'before' then raise exception 'Book metadata changed' using errcode='40001'; end if;
  update public.logbook_books set metadata=x->'after' where dataset_id=p_dataset and id=x->>'id';
 end loop;
 for x in select value from jsonb_array_elements(coalesce(p_payload->'attachments','[]')) loop
  if exists(select 1 from public.logbook_datasets d cross join lateral jsonb_array_elements(d.attachments) a where d.id=p_dataset and a->>'id'=x->>'id' and a is distinct from x) then raise exception 'Attachment ID exists'; end if;
  update public.logbook_datasets set attachments=attachments||jsonb_build_array(x) where id=p_dataset and not exists(select 1 from jsonb_array_elements(attachments) a where a->>'id'=x->>'id');
 end loop;
 update public.logbook_commits set request_hash=digest where dataset_id=p_dataset and request_id=p_request;
 update public.logbook_datasets set revision=revision+1 where id=p_dataset;
 return out;
end $$;
revoke all on function public.logbook_manifest(uuid),public.logbook_attachment(uuid,text),public.logbook_transaction(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.logbook_manifest(uuid),public.logbook_attachment(uuid,text),public.logbook_transaction(uuid,uuid,text,text,jsonb) to service_role;
