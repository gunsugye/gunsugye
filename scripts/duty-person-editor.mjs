export function dutyPersonKeyV398(person){
 const norm=value=>String(value??'').normalize('NFKC').replace(/\s/g,'');
 return [norm(person.cohort).replace(/(?:기)+$/,''),norm(person.company).replace(/(?:중대)+$/,''),norm(person.name)].join('|');
}
export function dutyPersonCandidatesV398(plan){
 if(!plan||plan.comparison?.error||!plan.comparison||!Array.isArray(plan.comparison.missingRoom)||!Array.isArray(plan.comparison.missingSmart))throw Error(plan?.comparison?.error||'스마트당직 대조 결과를 확인할 수 없습니다.');
 const missing=new Set(plan.comparison.missingSmart.map(dutyPersonKeyV398)),seen=new Set(),rows=[];
 const push=(person,room)=>{
  const cohort=String(person.cohort??'').normalize('NFKC').replace(/\s|기/g,''),company=String(person.company??'').normalize('NFKC').replace(/\s|중대/g,''),name=String(person.name??'').normalize('NFKC').trim();
  if(!/^\d{2,3}$/.test(cohort)||! /^[1-8]$/.test(company)||!name)return;
  const row={name,cohort,company,building:String(room?.building||''),floor:String(room?.floor||''),room:String(room?.room||''),gradeOverride:/^[1-4]$/.test(String(person.gradeOverride||person.grade||''))?String(person.gradeOverride||person.grade):String(({'75':4,'76':3,'77':2,'78':1})[cohort]||''),battalionOverride:Number(company)<=4?'1':'2',assigned:!!room};
  if(missing.has(dutyPersonKeyV398(row)))return;
  const key=JSON.stringify([dutyPersonKeyV398(row),row.building,row.floor,row.room]);if(seen.has(key))return;seen.add(key);rows.push({...row,key});
 };
 for(const room of plan.rooms||[])for(const person of room.members||[])push(person,room);
 for(const person of plan.comparison.missingRoom)push(person,null);
 return rows.sort((a,b)=>a.cohort.localeCompare(b.cohort,undefined,{numeric:true})||Number(a.company)-Number(b.company)||a.name.localeCompare(b.name,'ko')||a.room.localeCompare(b.room,undefined,{numeric:true}));
}
export function dutyPersonSearchV398(value,people){
 const name=String(value||'').normalize('NFKC').replace(/\s/g,'');if(!name)return {rows:[],exact:false};
 const norm=value=>String(value||'').normalize('NFKC').replace(/\s/g,''),base=value=>value.replace(/([가-힣])[A-D]$/,'$1');
 const exact=people.filter(person=>norm(person.name)===name);if(exact.length)return {rows:exact,exact:true};
 const aliases=people.filter(person=>base(norm(person.name))===base(name)&&(name===base(name)||norm(person.name)===base(norm(person.name))));if(aliases.length)return {rows:aliases,exact:true};
 return {rows:people.filter(person=>norm(person.name).includes(name)),exact:false};
}
export function dutyPersonEditorJsV398(js,client){
 const open="dutySetOrgFormV372(initial);$('dutyEditStatusV367').textContent='';dutyDialogV367.showModal();";
 const submit="e.preventDefault();if(dutySavingV367)return;dutySavingV367=true;const form=e.target,patch=Object.fromEntries(new FormData(form));";
 const patch='dutyApplyOrgFormV372(patch);await enqueue(()=>dutyEditRowV367?';
 for(const marker of [open,submit,patch])if(js.split(marker).length!==2)throw Error('근무생도 편집 위치를 확인하세요: '+marker);
 js=js.replace(open,"dutySetOrgFormV372(initial);$('dutyEditStatusV367').textContent='';dutyDialogV367.showModal();globalThis.LOGBOOK_DUTY_EDITOR.open(initial);")
  .replace(submit,"e.preventDefault();if(dutySavingV367||!globalThis.LOGBOOK_DUTY_EDITOR.beforeSubmit(e.target))return;dutySavingV367=true;const form=e.target,patch=Object.fromEntries(new FormData(form));")
  .replace(patch,'if(!globalThis.LOGBOOK_DUTY_EDITOR.locked())dutyApplyOrgFormV372(patch);globalThis.LOGBOOK_DUTY_EDITOR.patch(patch);await enqueue(()=>dutyEditRowV367?');
 const end=js.lastIndexOf('})();');if(end<0)throw Error('앱 초기화 끝을 찾지 못했습니다.');
 return js.slice(0,end)+'\n'+[dutyPersonKeyV398,dutyPersonCandidatesV398,dutyPersonSearchV398].map(fn=>fn.toString()).join('\n')+'\n'+client+'\n'+js.slice(end);
}
