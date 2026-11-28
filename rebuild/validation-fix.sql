create or replace function app2_private.validate_values(p_catalog text,p_values jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare f jsonb; v jsonb; k text;
begin
 if jsonb_typeof(p_values)<>'object' or octet_length(p_values::text)>20000 then raise exception '입력값 형식 또는 크기를 확인하세요.'; end if;
 if not exists(select 1 from public.app2_catalog where id=p_catalog and enabled) then raise exception '사용할 수 없는 품목입니다.'; end if;
 for k in select jsonb_object_keys(p_values) loop
  if not exists(select 1 from public.app2_catalog c,jsonb_array_elements(c.fields) as entry(value) where c.id=p_catalog and entry.value->>'key'=k) then raise exception '등록되지 않은 항목: %',k; end if;
 end loop;
 for f in select jsonb_array_elements(fields) from public.app2_catalog where id=p_catalog loop
  v=p_values->(f->>'key'); if v is null or v='null'::jsonb or v='""'::jsonb then continue; end if;
  if f->>'type'='quantity' and (jsonb_typeof(v)<>'number' or (v::text)::numeric<0 or trunc((v::text)::numeric)<>(v::text)::numeric or (v::text)::numeric>100000) then raise exception '수량은 0 이상의 정수여야 합니다.'; end if;
  if f->>'type'='select' and not (f->'options' @> jsonb_build_array(v)) then raise exception '선택 항목을 확인하세요: %',f->>'label'; end if;
  if f->>'type'='text' and (jsonb_typeof(v)<>'string' or length(v::text)>5000) then raise exception '문자열 길이를 확인하세요.'; end if;
 end loop;
end $$;
