-- Seed is permanently disabled once the dataset accepts application writes.
create function public.logbook_seed(p_dataset uuid,p_book jsonb,p_sheet jsonb,p_rows jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare r jsonb; n integer;
begin
 perform 1 from public.logbook_datasets where id=p_dataset and activated_at is null for update;
 if not found then raise exception 'Snapshot replacement is disabled after cutover'; end if;
 insert into public.logbook_books(dataset_id,id,metadata) values(p_dataset,p_book->>'id',p_book-'sheets')
 on conflict(dataset_id,id) do update set metadata=excluded.metadata;
 insert into public.logbook_sheets(dataset_id,book_id,id,title,columns_count,rows_count,position,metadata)
 values(p_dataset,p_book->>'id',(p_sheet->>'id')::bigint,p_sheet->>'title',(p_sheet->>'columns')::integer,jsonb_array_length(p_rows),(p_sheet->>'position')::integer,p_sheet-'id'-'title'-'rows'-'columns'-'position'-'revision')
 on conflict(dataset_id,book_id,id) do update set title=excluded.title,columns_count=excluded.columns_count,rows_count=excluded.rows_count,position=excluded.position,metadata=excluded.metadata,revision=public.logbook_sheets.revision+1;
 delete from public.logbook_rows where dataset_id=p_dataset and book_id=p_book->>'id' and sheet_id=(p_sheet->>'id')::bigint;
 n:=0;
 for r in select value from jsonb_array_elements(p_rows) loop
  n:=n+1;if (r->>'number')::integer<>n then raise exception 'Non-contiguous source rows'; end if;
  insert into public.logbook_rows values(p_dataset,p_book->>'id',(p_sheet->>'id')::bigint,n,r);
 end loop;
 return jsonb_build_object('ok',true,'rows',n,'checksum',encode(extensions.digest(convert_to(public.logbook_canonical_json(p_rows),'UTF8'),'sha256'),'hex'));
end $$;
create function public.logbook_seed_manifest(p_dataset uuid,p_manifest jsonb) returns jsonb
language plpgsql set search_path='' as $$
begin
 perform 1 from public.logbook_datasets where id=p_dataset and activated_at is null for update;
 if not found then raise exception 'Snapshot replacement is disabled after cutover'; end if;
 -- Fail instead of silently deleting tables if the source inventory changed.
 if exists(select 1 from public.logbook_sheets s where dataset_id=p_dataset and not exists(select 1 from jsonb_array_elements(p_manifest->'books') b cross join lateral jsonb_array_elements(b->'sheets') t where s.book_id=b->>'id' and s.id=(t->>'id')::bigint)) then raise exception 'Source inventory changed; reconcile removed tabs'; end if;
 update public.logbook_datasets set settings=p_manifest->'settings',attachments=p_manifest->'attachments',revision=revision+1 where id=p_dataset;
 return jsonb_build_object('ok',true);
end $$;
create function public.logbook_activate(p_dataset uuid) returns jsonb
language plpgsql set search_path='' as $$
begin
 update public.logbook_datasets set activated_at=coalesce(activated_at,now()) where id=p_dataset;
 return jsonb_build_object('ok',found);
end $$;
revoke all on function public.logbook_seed(uuid,jsonb,jsonb,jsonb),public.logbook_seed_manifest(uuid,jsonb),public.logbook_activate(uuid) from public,anon,authenticated;
grant execute on function public.logbook_seed(uuid,jsonb,jsonb,jsonb),public.logbook_seed_manifest(uuid,jsonb),public.logbook_activate(uuid) to service_role;
