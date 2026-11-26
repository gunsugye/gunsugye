export function supplyOverview(item){
 const out={people:0,quantity:0,repair:0,unusable:0,shortage:0,absent:0,incomplete:0,issues:[]};
 const schema=item.schema||{},blank=v=>v===undefined||v===null||String(v).trim()==='';
 const numeric=v=>!blank(v)&&Number.isFinite(Number(v))&&Number(v)>=0;
 for(const p of item.rows||[]){
  out.people++;const extra=p.extra||{},flags=new Set(),reasons=[];
  const mark=(type,text)=>{flags.add(type);reasons.push(text);};
  const fields=[['수량',extra.수량],...(schema.includeStatus===false?[]:[['상태',p.status]]),...(schema.fields||[]).filter(f=>!['수량','상태','세부사항','세부내용'].includes(f)).map(f=>[f,extra[f]])];
  if(numeric(extra.수량))out.quantity+=Number(extra.수량);
  for(const [key,value] of fields){
   if(blank(value)){mark('incomplete',key+' 미작성');continue;}
   const text=String(value).trim();
   if(/사용\s*불가|교체\s*필요/.test(text))mark('unusable',key+' · 사용불가');
   else if(/수리\s*필요/.test(text))mark('repair',key+' · 수리 필요');
   if(text==='무'&&schema.options?.[key]?.includes('유'))mark('absent',key+' 없음');
   const max=key==='수량'?(item.quantityRange?.max??schema.quantityRange?.max):schema.numeric?.[key];
   if(max!==undefined&&numeric(value)&&Number(value)<Number(max))mark('shortage',key+' '+(Number(max)-Number(value))+'개 부족');
  }
  for(const flag of flags)out[flag]++;
  if(flags.size)out.issues.push({...p,reasons,flags:[...flags]});
 }
 return out;
}

// Group only already-authorized item results, and deduplicate people across items.
export function supplyOverviewPeople(entries){
 const groups={repair:new Map(),unusable:new Map(),incomplete:new Map()};
 for(const {item,summary} of entries){
  for(const person of summary?.issues||[]){
   const id=String(person.id||'');if(!id)continue;
   for(const kind of Object.keys(groups)){
    if(!person.flags?.includes(kind))continue;
    const existing=groups[kind].get(id)||{id,name:person.name,cohort:person.cohort,company:person.company,items:[]};
    const reasons=(person.reasons||[]).filter(reason=>kind==='repair'?/수리\s*필요/.test(reason):kind==='unusable'?/사용\s*불가/.test(reason):/미작성/.test(reason));
    existing.items.push({name:item.name,reasons});groups[kind].set(id,existing);
   }
  }
 }
 return Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,[...v.values()]]));
}
