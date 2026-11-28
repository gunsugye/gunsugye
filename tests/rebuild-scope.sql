begin;
insert into public.app2_people(id,mode,cohort,company,name) values
('20000000-0000-4000-8000-000000000001','semester',77,2,'SCOPE2'),
('20000000-0000-4000-8000-000000000002','semester',77,3,'SCOPE3'),
('20000000-0000-4000-8000-000000000003','training',77,2,'MENTOR'),
('20000000-0000-4000-8000-000000000004','training',79,1,'TRAINEE');
update public.app2_people set mentor_id='20000000-0000-4000-8000-000000000003' where id='20000000-0000-4000-8000-000000000004';
insert into public.app2_rooms(id,mode,building,floor,room_number,company,capacity) values ('20000000-0000-4000-8000-000000000010','semester','동관',1,'TEST',3,2);
insert into public.app2_occupancy(mode,person_id,room_id,seat,company) values
('semester','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000010',1,2),
('semester','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000010',2,3);
insert into public.app2_inventory(mode,room_id,catalog_id,company,values) values('semester','20000000-0000-4000-8000-000000000010','asset-0',3,'{"quantity":2,"status":"정상"}');
insert into public.app2_members(email,role,company) values('scope@example.invalid','company',2);
insert into public.app2_duties(mode,person_id,company,unit,position,email) values ('training','20000000-0000-4000-8000-000000000003',2,'1중대','지도생도','mentor@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000099","email":"scope@example.invalid"}',true);
do $$ begin
 if (select count(*) from public.app2_people)<>1 then raise exception 'Company person scope failed';end if;
 if (select count(*) from public.app2_rooms)<>1 or (select count(*) from public.app2_inventory)<>1 then raise exception 'Mixed room read failed';end if;
 if (select count(*) from public.app2_occupancy)<>1 then raise exception 'Other occupants leaked';end if;
 if public.app2_can_write() then raise exception 'Company can write';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000098","email":"mentor@example.invalid"}',true);
do $$ begin
 if (select count(*) from public.app2_people)<>2 then raise exception 'Mentor person scope failed';end if;
 if (select count(*) from public.app2_rooms)<>0 then raise exception 'Mentor room leak';end if;
 if public.app2_can_write() then raise exception 'Mentor editor escalation';end if;
end $$;
select 'PASS: mixed room visibility, company isolation, automatic mentor role, assigned trainee scope' as verification;
rollback;
