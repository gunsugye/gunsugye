alter table public.app2_members add column duty_id uuid references public.app2_duties(id) on delete set null;
create index app2_members_duty_idx on public.app2_members(duty_id);
create function app2_private.sync_duty_member() returns trigger language plpgsql security definer set search_path='' as $$
declare email_value text; role_value text;
begin
 if tg_op in ('UPDATE','DELETE') then update public.app2_members set enabled=false where duty_id=old.id and role<>'admin'; end if;
 if tg_op='DELETE' then return old; end if;
 email_value=lower(trim(new.email));if email_value='' then return new; end if;
 role_value=case
  when new.mode='training' and new.position='지도생도' then 'mentor'
  when new.mode='training' and new.position='대대군수참모생도' then 'editor'
  when new.mode='semester' and new.unit~'(전대|대대)' and new.position~'(군수|보급)' then 'editor'
  when new.mode='semester' and new.position~'((군수|보급).*보좌관|3.*편대장)' then 'company'
  else null end;
 if role_value is null then return new; end if;
 insert into public.app2_members(email,role,company,person_id,enabled,duty_id)
 values(email_value,role_value,new.company,new.person_id,true,new.id)
 on conflict(email) do update set role=excluded.role,company=excluded.company,person_id=excluded.person_id,enabled=true,duty_id=excluded.duty_id
 where public.app2_members.role<>'admin';
 return new;
end $$;
revoke all on function app2_private.sync_duty_member() from public,anon,authenticated;
create trigger sync_duty_membership after insert or update or delete on public.app2_duties for each row execute function app2_private.sync_duty_member();
