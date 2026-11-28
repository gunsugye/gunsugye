begin;
insert into public.app2_people(id,mode,cohort,company,name) values
 ('10000000-0000-4000-8000-000000000001','semester',77,2,'WORKFLOW_TEST'),
 ('10000000-0000-4000-8000-000000000002','semester',77,3,'OTHER_TEST');
insert into public.app2_members(email,role,person_id) values ('workflow@example.invalid','personal','10000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000099","email":"workflow@example.invalid"}',true);
do $$ declare response jsonb; payload jsonb='[{"person_id":"10000000-0000-4000-8000-000000000001","catalog_id":"blanket","version":0,"values":{"quantity":1,"status":"정상"}}]'; begin
 response=public.app2_submit('10000000-0000-4000-8000-000000000003',payload);
 if response->0->>'status'<>'검토 대기' then raise exception 'Request routing failed';end if;
 if exists(select 1 from public.app2_inventory where person_id='10000000-0000-4000-8000-000000000001') then raise exception 'Unapproved record written';end if;
 if response<>public.app2_submit('10000000-0000-4000-8000-000000000003',payload) then raise exception 'Idempotency failed';end if;
 begin
  perform public.app2_submit('10000000-0000-4000-8000-000000000004',replace(payload::text,'000000000001','000000000002')::jsonb);
  raise exception 'FORBIDDEN_SUBMIT_ALLOWED';
 exception when raise_exception then if sqlerrm='FORBIDDEN_SUBMIT_ALLOWED' then raise; end if; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000098","email":"gunsugye@gmail.com"}',true);
do $$ declare ids uuid[]; begin
 select array_agg(id) into ids from public.app2_requests where batch_id='10000000-0000-4000-8000-000000000003';
 if public.app2_review(ids,'반영 완료')<>1 then raise exception 'Review count failed';end if;
 if not exists(select 1 from public.app2_inventory where person_id='10000000-0000-4000-8000-000000000001' and values->>'quantity'='1') then raise exception 'Review apply failed';end if;
end $$;
insert into public.app2_surveys(mode,section,title,starts_at,ends_at) values('semester','supplies','TEST',now()-interval '1 hour',now()+interval '1 hour');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000099","email":"workflow@example.invalid"}',true);
do $$ declare response jsonb; begin
 response=public.app2_submit('10000000-0000-4000-8000-000000000005','[{"person_id":"10000000-0000-4000-8000-000000000001","catalog_id":"blanket","version":1,"values":{"quantity":0,"status":"수리 필요"}}]');
 if response->0->>'status'<>'반영 완료' then raise exception 'Survey routing failed';end if;
 if not exists(select 1 from public.app2_inventory where person_id='10000000-0000-4000-8000-000000000001' and values->>'quantity'='0' and version=2) then raise exception 'Survey write failed';end if;
 begin
 perform public.app2_submit('10000000-0000-4000-8000-000000000006','[{"person_id":"10000000-0000-4000-8000-000000000001","catalog_id":"blanket","version":1,"values":{"quantity":1,"status":"정상"}}]');
 raise exception 'STALE_WRITE_ALLOWED';
 exception when raise_exception then if sqlerrm='STALE_WRITE_ALLOWED' then raise; end if; end;
end $$;
select 'PASS: requests, approval, survey writes, ownership, idempotency, stale version' as verification;
rollback;
