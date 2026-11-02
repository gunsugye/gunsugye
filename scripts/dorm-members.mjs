export function dormMemberCohortsV343(members){
 const clean=v=>String(v||'').normalize('NFKC').trim().replace(/기$/,'');
 const rows=members.map(p=>({...p,cohort:clean(p.cohort)}));
 const known=[...new Set(rows.map(p=>p.cohort).filter(c=>/^\d{2,3}$/.test(c)))];
 if(known.length===1)rows.forEach(p=>{if(!p.cohort)p.cohort=known[0];});
 return rows;
}
export function dormPdfNamesV343(tokens,limit){
 return dormPdfPeopleV365(tokens,limit).map(p=>p.name);
}
export function dormPdfPeopleV365(tokens,limit){
 const lines=[];
 for(const t of [...tokens].sort((a,b)=>a.y-b.y||a.x-b.x)){
  let line=lines.find(l=>Math.abs(l.y-t.y)<3);if(!line){line={y:t.y,items:[]};lines.push(line);}line.items.push(t);
 }
 const people=[],text=lines.map(line=>line.items.sort((a,b)=>a.x-b.x).map(t=>t.str).join(' ')).join('\n').normalize('NFKC');let depth=0,owner=null,duty='';
 const finish=review=>{if(owner){owner.isDuty=true;const label=duty.replace(/\s+/g,'').trim();owner.duty=[owner.duty,label].filter(Boolean).join(' · ');if(review)owner.dutyReview=true;}duty='';};
 for(const part of text.match(/[^()]+|[()]/g)||[]){
  if(part==='('){if(depth===0){owner=people[people.length-1]||null;duty='';}else duty+='(';depth++;continue;}
  if(part===')'){if(depth){depth--;if(!depth)finish(false);else duty+=')';}continue;}
  if(depth){duty+=part;continue;}
  for(const name of part.split(/\s+/))if(/^[가-힣]{2,4}[A-D]?$/.test(name)&&!/(공실|독방|근무|중대|훈육|위원|동기|회장|총무|생도|화장|계단|보좌|문화|교육|명예|편집|사무)/.test(name)&&!people.some(p=>p.name===name)&&people.length<limit)people.push({name,isDuty:false,duty:''});
 }
 if(depth)finish(true);return people;
}
export function dormPdfMembersV343(names,oldMembers,reference,company){
 return dormMemberCohortsV343(names.map(name=>{
  const local=oldMembers.filter(p=>p.name===name);
  if(local.length===1&&local[0].cohort)return {...local[0]};
  const matches=reference.filter(p=>p.name===name&&(!company||String(p.company).normalize('NFKC').replace(/중대$/,'')===company));
  const identities=new Map(matches.filter(p=>p.cohort).map(p=>[[p.cohort,p.company,p.name].join('|'),p]));
  if(identities.size===1)return {...identities.values().next().value};
  return {name,company:local[0]?.company||company,cohort:''};
 }));
}
