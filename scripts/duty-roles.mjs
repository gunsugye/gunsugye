export function dutyRoleInfoV367(row){
 const text=String(row.duty||'').normalize('NFKC').replace(/\s/g,''),company=Number(text.match(/([1-8])중대/)?.[1]||row.company)||0;
 const grade=Number(row.gradeOverride||text.match(/([1-4])학년/)?.[1]||({'75':4,'76':3,'77':2,'78':1})[String(row.cohort).replace(/기$/,'')])||0;
 const battalion=Number(row.battalionOverride||text.match(/([12])대대/)?.[1])||0;
 let organization=row.organization||(/동기/.test(text)?'동기회':/명예/.test(text)?'명예위':/생발|생활발전/.test(text)?'생발위':/전대/.test(text)?'전대':/대대/.test(text)&&battalion?battalion+'대대':/중대|편대|보좌|기수|교육|행정|보급|문화체육/.test(text)?'중대':'기타');
 let rank=90,series=['작전','인사','군수','체육','문화'].findIndex(s=>text.includes(s)),title=text;
 if(['전대','1대대','2대대'].includes(organization)){
  rank=/참모/.test(text)?(/보좌/.test(text)?10:1)+(series<0?8:series):/(전대장|대대장)/.test(text)?0:80;
 }else if(organization==='중대'){
  if(/중대장/.test(text))rank=0;
  else if(/편대장/.test(text))rank=1+(Number(text.match(/([1-4])편대장/)?.[1])||0)/10;
  else if(/보좌|교육|행정|보급|문화|체육/.test(text)){series=/문화|체육/.test(text)?3:/작전|교육/.test(text)?0:/인사|행정/.test(text)?1:/군수|보급/.test(text)?2:-1;rank=30+(series<0?8:series);if(/문화|체육/.test(text))title='문화체육보좌관';}
  else if(/기수/.test(text))rank=40;
  else rank=({4:10,3:20,2:50,1:60})[grade]||80;
 }else if(organization==='동기회')rank=/부회장/.test(text)?1:/회장/.test(text)?0:/총무/.test(text)?2:/친목활동부장/.test(text)?3:20;
 else if(organization==='명예위'||organization==='생발위')rank=/위원장/.test(text)&&!/부위원장/.test(text)?0:10;
 const orgOrder=({'전대':0,'1대대':1,'2대대':2,'중대':3,'동기회':4,'명예위':5,'생발위':6,'기타':9})[organization]??9;
 const ordinal=Number(text.match(/([12])(?:st|nd)/i)?.[1]||0);return {organization,company,grade,battalion,rank,title,sort:organization==='동기회'?[orgOrder,grade?5-grade:9,rank,battalion||9,company||9,ordinal]:[orgOrder,organization==='중대'?company:0,rank,grade?5-grade:9,battalion||9,company||9,ordinal]};
}
export function dutySortV367(rows){return [...rows].sort((a,b)=>{const x=dutyRoleInfoV367(a).sort,y=dutyRoleInfoV367(b).sort;for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]-y[i];return String(a.name||'').localeCompare(String(b.name||''),'ko');});}
export function dutyFamilyV367(row){
 const info=dutyRoleInfoV367(row),text=String(row.duty||'').normalize('NFKC').replace(/\s/g,'');
 if(['동기회','명예위','생발위'].includes(info.organization))return info.organization;
 if(/전대장|대대장|중대장/.test(text)&&!/보좌/.test(text))return '장';
 if(/작전|교육|1편대장/.test(text))return '작전';if(/인사|행정|2편대장/.test(text))return '인사';if(/군수|보급|3편대장/.test(text))return '군수';if(/문화|체육|4편대장/.test(text))return '문화 및 체육';
 if(info.organization==='중대'&&/기수/.test(text))return '중대기수';
 if(info.organization==='중대'&&info.rank>=10)return '중대임원';return '기타';
}
export function dutySaberRoleV367(row){
 if(row.saberRoleOverride==='none')return '';if(row.saberRoleOverride&&row.saberRoleOverride!=='auto')return row.saberRoleOverride;
 const info=dutyRoleInfoV367(row),text=String(row.duty||'').normalize('NFKC').replace(/\s/g,'');
 if(/보좌/.test(text))return '';
 if(['전대','1대대','2대대'].includes(info.organization)){
  if(/전대장|대대장/.test(text))return info.organization+'|대장생도';
  const series=['작전','인사','군수','체육','문화활동'].find(s=>text.includes(s)||(s==='문화활동'&&text.includes('문화')));return /참모/.test(text)&&series?info.organization+'|'+series+'참모생도':'';
 }
 if(info.organization==='중대'&&info.company){if(/중대장/.test(text))return info.company+'중대|중대장생도';const flight=text.match(/([1-4])편대장/);if(flight)return info.company+'중대|'+flight[1]+'편대장생도';}
 if(info.organization==='명예위'&&/위원장/.test(text))return '명예위원회|명예위원장생도';return '';
}
