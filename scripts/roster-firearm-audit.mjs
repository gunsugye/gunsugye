import {insertAppClient} from './app-client.mjs';
export function rosterGunNumberV417(value){const number=String(value??'').normalize('NFKC').replace(/\s/g,'');return ['','-','—','미등록','없음'].includes(number)?'':number;}
export function rosterGunAuditV417(rows){
 const groups=new Map(),missing=[];
 for(const person of rows){const number=rosterGunNumberV417(person.firearmNumber);if(!number){missing.push(person);continue;}if(!groups.has(number))groups.set(number,[]);groups.get(number).push(person);}
 const counts={normal:0,reported:0,unreported:0,replacement:0,unknown:0};
 for(const people of groups.values()){const states=new Set(people.map(p=>p.firearmStatus==='수리 필요'?'수리 필요(미보고)':p.firearmStatus||'')),status=states.size===1?[...states][0]:'';counts[({'정상':'normal','수리 필요(보고)':'reported','수리 필요(미보고)':'unreported','교체 필요':'replacement'})[status]||'unknown']++;}
 const duplicates=[...groups].filter(([,people])=>people.length>1).map(([number,people])=>({number,people}));
 return {people:rows.length,registered:rows.length-missing.length,quantity:groups.size,missing,duplicates,duplicatePeople:duplicates.reduce((n,g)=>n+g.people.length,0),...counts};
}
export function rosterGunAuditClientV417(source,client){const marker='  rosterIdentityOnlyV410();';if(!source.includes(marker))throw Error('명단 현황 연결 위치 없음');return insertAppClient(source.replace(marker,marker+'\n  rosterGunAuditRenderV417();'),[rosterGunNumberV417,rosterGunAuditV417].map(f=>f.toString()).join('\n')+'\n'+client);}
