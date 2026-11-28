create table public.app2_batches(id uuid primary key,submitted_by text not null,payload jsonb not null,response jsonb not null,created_at timestamptz not null default now());
alter table public.app2_batches enable row level security;
revoke all on public.app2_batches from public,anon,authenticated;
grant select on public.app2_batches to authenticated;
grant all on public.app2_batches to service_role;
create policy batches_self on public.app2_batches for select to authenticated using(submitted_by=lower((select auth.jwt()->>'email')) and (app2_private.member()).email is not null);

create function public.app2_submit(p_batch uuid,p_items jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.app2_members; item jsonb; p public.app2_people; c public.app2_catalog; inv public.app2_inventory; survey uuid; room uuid; answer jsonb='[]'; old public.app2_batches; request_id uuid; s text;f jsonb;
begin
 m=app2_private.member();
 if auth.uid() is null or m.email is null or m.role='company' then raise exception '제출 권한이 없습니다.'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 or octet_length(p_items::text)>500000 then raise exception '한 번에 1~100개 항목을 제출하세요.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_batch::text,0));
 select * into old from public.app2_batches where id=p_batch;
 if found then if old.submitted_by<>m.email or old.payload<>p_items then raise exception '기존 제출 번호와 내용이 다릅니다. 새로 제출하세요.'; end if;return old.response; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  select * into strict p from public.app2_people where id=(item->>'person_id')::uuid;
  if not (m.role in ('admin','editor') or m.person_id=p.id or (m.role='mentor' and p.mode='training' and p.mentor_id=m.person_id)) then raise exception '본인 또는 담당 인원의 기록만 제출할 수 있습니다.'; end if;
  select * into strict c from public.app2_catalog where id=item->>'catalog_id' and enabled;
  perform app2_private.validate_values(c.id,item->'values');room=null;
  if c.section='assets' then
   select o.room_id into strict room from public.app2_occupancy o where o.person_id=p.id;
  end if;
  select * into inv from public.app2_inventory i where i.catalog_id=c.id and ((room is not null and i.room_id=room) or (room is null and i.person_id=p.id)) for update;
  if coalesce(inv.version,0)<>coalesce((item->>'version')::bigint,0) then raise exception '다른 기록이 먼저 저장되었습니다: %. 다시 읽어 주세요.',c.name; end if;
  survey=null;
  select id into survey from public.app2_surveys v where enabled and mode=p.mode and section=c.section and (company is null or company=p.company) and (cohort is null or cohort=p.cohort) and starts_at<=now() and ends_at>now() order by starts_at desc,id limit 1;
  if survey is not null then
   for f in select value from jsonb_array_elements(c.fields) loop
    if coalesce((f->>'optional')::boolean,false)=false and (item->'values'->(f->>'key') is null or item->'values'->(f->>'key') in ('null'::jsonb,'""'::jsonb)) then raise exception '%: % 미작성',c.name,f->>'label'; end if;
   end loop;
  end if;
  if inv.values=item->'values' and survey is null then continue; end if;
  s=case when survey is null then '검토 대기' else '반영 완료' end;
  insert into public.app2_requests(batch_id,mode,person_id,catalog_id,room_id,inventory_id,company,base_version,before_values,values,survey_id,status,submitted_by)
  values(p_batch,p.mode,p.id,c.id,room,inv.id,p.company,coalesce(inv.version,0),coalesce(inv.values,'{}'),item->'values',survey,s,m.email) returning id into request_id;
  if survey is not null then
   if inv.id is null then
    insert into public.app2_inventory(mode,person_id,room_id,catalog_id,company,values) values(p.mode,case when room is null then p.id else null end,room,c.id,p.company,item->'values') returning * into inv;
   else update public.app2_inventory set values=item->'values' where id=inv.id returning * into inv; end if;
   update public.app2_requests set inventory_id=inv.id,reviewed_at=now(),reviewed_by=m.email where id=request_id;
  end if;
  answer=answer||jsonb_build_array(jsonb_build_object('id',request_id,'catalog_id',c.id,'status',s));
 end loop;
 insert into public.app2_batches values(p_batch,m.email,p_items,answer,now());
 return answer;
end $$;
revoke all on function public.app2_submit(uuid,jsonb) from public,anon;
grant execute on function public.app2_submit(uuid,jsonb) to authenticated;

create function public.app2_review(p_ids uuid[],p_action text,p_reason text default '') returns int language plpgsql security definer set search_path='' as $$
declare r public.app2_requests; inv public.app2_inventory; m public.app2_members; n int=0;
begin
 m=app2_private.member();if auth.uid() is null or m.role not in ('admin','editor') or m.email is null then raise exception '검토 권한이 없습니다.'; end if;
 if p_action not in ('반영 완료','반려','삭제') or cardinality(p_ids) not between 1 and 200 then raise exception '검토 대상과 처리 방법을 확인하세요.'; end if;
 if p_action='반려' and length(trim(p_reason))=0 then raise exception '반려 사유를 입력하세요.'; end if;
 for r in select * from public.app2_requests where id=any(p_ids) order by id for update loop
  if r.status<>'검토 대기' then continue; end if;
  if p_action='반영 완료' then
   select * into inv from public.app2_inventory i where i.catalog_id=r.catalog_id and ((r.room_id is not null and i.room_id=r.room_id) or (r.room_id is null and i.person_id=r.person_id)) for update;
   if coalesce(inv.version,0)<>r.base_version then raise exception '기존 값이 변경된 요청이 있습니다. 요청 % 내용을 다시 확인하세요.',r.id; end if;
   perform app2_private.validate_values(r.catalog_id,r.values);
   if inv.id is null then insert into public.app2_inventory(mode,person_id,room_id,catalog_id,company,values) values(r.mode,case when r.room_id is null then r.person_id else null end,r.room_id,r.catalog_id,r.company,r.values) returning * into inv;
   else update public.app2_inventory set values=r.values where id=inv.id returning * into inv; end if;
  end if;
  update public.app2_requests set status=p_action,reviewed_at=now(),reviewed_by=m.email,reason=p_reason,inventory_id=coalesce(inv.id,inventory_id) where id=r.id;n=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.app2_review(uuid[],text,text) from public,anon;
grant execute on function public.app2_review(uuid[],text,text) to authenticated;

create function public.app2_transfer_training(p_ids uuid[]) returns int language plpgsql security definer set search_path='' as $$
declare p public.app2_people; target uuid;n int=0;
begin
 if auth.uid() is null or not public.app2_can_write() then raise exception '이관 권한이 없습니다.'; end if;
 if cardinality(p_ids) not between 1 and 100 then raise exception '1~100명을 선택하세요.'; end if;
 for p in select * from public.app2_people where id=any(p_ids) and mode='training' order by id for update loop
  if p.cadet_number='' then raise exception '%: 교번을 먼저 입력하세요.',p.name; end if;
  if exists(select 1 from public.app2_people where mode='semester' and cadet_number=p.cadet_number) then raise exception '%: 이미 일반학기에 등록된 교번입니다.',p.name; end if;
  insert into public.app2_people(mode,cohort,company,name,cadet_number,firearm_number,status,details,email,phone) values('semester',p.cohort,p.company,p.name,p.cadet_number,p.firearm_number,p.status,p.details,p.email,p.phone) returning id into target;
  insert into public.app2_inventory(mode,person_id,catalog_id,company,values) select 'semester',target,catalog_id,p.company,values from public.app2_inventory where person_id=p.id;
  n=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.app2_transfer_training(uuid[]) from public,anon;
grant execute on function public.app2_transfer_training(uuid[]) to authenticated;
