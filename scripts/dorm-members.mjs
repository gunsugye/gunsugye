export function dormMemberCohortsV343(members){
 const clean=v=>String(v||'').normalize('NFKC').trim().replace(/기$/,'');
 const rows=members.map(p=>({...p,cohort:clean(p.cohort)}));
 const known=[...new Set(rows.map(p=>p.cohort).filter(c=>/^\d{2,3}$/.test(c)))];
 if(known.length===1)rows.forEach(p=>{if(!p.cohort)p.cohort=known[0];});
 return rows;
}
export function dormPdfNamesV343(tokens,limit){
 const lines=[];
 for(const t of [...tokens].sort((a,b)=>a.y-b.y||a.x-b.x)){
  let line=lines.find(l=>Math.abs(l.y-t.y)<3);if(!line){line={y:t.y,items:[]};lines.push(line);}line.items.push(t);
 }
 const names=[];
 for(const line of lines){
  // 괄호가 여러 PDF 토큰으로 나뉘어도 근무 문구 전체를 제외합니다.
  const text=line.items.sort((a,b)=>a.x-b.x).map(t=>t.str).join(' ').normalize('NFKC').replace(/\([^)]*\)/g,' ').replace(/\([^)]*$/g,' ');
  for(const name of text.split(/\s+/))if(/^[가-힣]{2,4}[A-D]?$/.test(name)&&!/(공실|독방|근무|중대|훈육|위원|동기|회장|총무|생도|화장|계단|보좌|문화|교육|명예|편집|사무)/.test(name)&&!names.includes(name))names.push(name);
 }
 return names.slice(0,limit);
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
