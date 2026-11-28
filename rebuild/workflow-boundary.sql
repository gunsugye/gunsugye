-- Privileged implementations stay outside the exposed public API schema.
alter function public.app2_submit(uuid,jsonb) set schema app2_private;
alter function public.app2_review(uuid[],text,text) set schema app2_private;
alter function public.app2_transfer_training(uuid[]) set schema app2_private;
create function public.app2_submit(p_batch uuid,p_items jsonb) returns jsonb language sql security invoker set search_path='' as $$ select app2_private.app2_submit(p_batch,p_items); $$;
create function public.app2_review(p_ids uuid[],p_action text,p_reason text default '') returns int language sql security invoker set search_path='' as $$ select app2_private.app2_review(p_ids,p_action,p_reason); $$;
create function public.app2_transfer_training(p_ids uuid[]) returns int language sql security invoker set search_path='' as $$ select app2_private.app2_transfer_training(p_ids); $$;
revoke all on function public.app2_submit(uuid,jsonb),public.app2_review(uuid[],text,text),public.app2_transfer_training(uuid[]) from public,anon;
grant execute on function public.app2_submit(uuid,jsonb),public.app2_review(uuid[],text,text),public.app2_transfer_training(uuid[]) to authenticated;
create index app2_members_person_idx on public.app2_members(person_id);
