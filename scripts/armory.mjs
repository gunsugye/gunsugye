import {insertAppClient} from './app-client.mjs';
export function armorySpecsV493(){return [
 {id:'b1-a1',name:'1대대 1무기고',companies:['1','2']},
 {id:'b1-a2',name:'1대대 2무기고',companies:['3','4']},
 {id:'b2-a1',name:'2대대 1무기고',companies:['5','6']},
 {id:'b2-a2',name:'2대대 2무기고',companies:['7','8']}
];}
export function armoryCompanyV493(value){return String(value??'').normalize('NFKC').replace(/\s|중대/g,'');}
export function armoryNumberV493(value){return String(value??'').normalize('NFKC').replace(/\s/g,'').toUpperCase();}
export function armoryOperatingRecordsV559(rows,records,archived){
 const assigned=new Set(rows.map(r=>armoryNumberV493(r.firearmNumber)).filter(Boolean));
 const operating=new Map();
 for(const r of archived){const n=armoryNumberV493(r.number);if(['퇴교','퇴학'].includes(r.status)&&!r.deletedAt&&n&&!assigned.has(n))operating.set(n,r.number);}
 return armorySpecsV493().map(g=>{const record=records.find(r=>r.id===g.id)||{id:g.id},manual=(record.spares||[]).filter(n=>!operating.has(armoryNumberV493(n))),automatic=g.id==='b2-a2'?[...operating.values()]:[];
 return {...record,manualSpares:manual,automaticSpares:automatic,spares:[...manual,...automatic]};});
}
export function armoryModelV493(rows,records,company='',repairs=[]){
 const active=repairs.filter(r=>r.status==='수리 중'),moving=new Map(active.map(r=>[armoryNumberV493(r.number),r]));
 rows=rows.map(r=>({...r,repairTransfer:moving.get(armoryNumberV493(r.firearmNumber))||null}));
 const specs=armorySpecsV493().filter(g=>!company||g.companies.includes(company));
 const visible=rows.filter(r=>!company||armoryCompanyV493(r.company)===company);
 const groups=specs.map(g=>{
  const assigned=visible.filter(r=>g.companies.includes(armoryCompanyV493(r.company))),record=records.find(r=>r.id===g.id)||{};
  const numbers=new Set(assigned.filter(r=>!r.repairTransfer).map(r=>armoryNumberV493(r.firearmNumber)).filter(Boolean));
  const inbound=g.id==='b2-a2'?active:[],base=(record.spares||[]).filter(n=>!moving.has(armoryNumberV493(n))),spares=[...base,...inbound.map(r=>r.number)];
  return {...g,assigned,assignedCount:numbers.size,repairCount:assigned.filter(r=>r.repairTransfer).length,repairSpares:inbound.map(r=>company&&armoryCompanyV493(r.company)!==company?{number:r.number,status:r.status}:r),missing:assigned.filter(r=>!armoryNumberV493(r.firearmNumber)).length,pistols:record.pistols??null,bayonets:record.bayonets??null,spares,manualSpares:(record.manualSpares??record.spares??[]).filter(n=>!moving.has(armoryNumberV493(n))),automaticSpares:record.automaticSpares||[],version:record.version||'',updatedAt:record.updatedAt||''};
 });
 const gunLocations=new Map();
 for(const g of groups){for(const r of g.assigned){const n=armoryNumberV493(r.firearmNumber);if(n&&!r.repairTransfer){if(!gunLocations.has(n))gunLocations.set(n,[]);gunLocations.get(n).push(g.name+' · '+r.name);}}for(const n of g.spares){const key=armoryNumberV493(n);if(!gunLocations.has(key))gunLocations.set(key,[]);gunLocations.get(key).push(g.name+' · 운영용 총기');}}
 return {groups,unclassified:company?[]:visible.filter(r=>!armorySpecsV493().some(g=>g.companies.includes(armoryCompanyV493(r.company)))),duplicates:[...gunLocations].filter(([,places])=>places.length>1).map(([number,places])=>({number,places})),totalUnique:gunLocations.size,company};
}
export function armoryNavV493(source,server=false){
 const group=server?'const NAV_GROUPS_V233=[':'const NAV_GROUP_DEFAULT_V233=[';
 return source.replace(group,group+"{id:'weapons',title:'총기/무기고',items:['firearms','firearmRequests']},")
 .replace(/\{id:'devices',title:'총기\/군수품\/장비',items:\[([^\]]*)\]\}/,(_,items)=>"{id:'devices',title:'군수품/장비',items:["+items.split(',').filter(x=>!['\'firearms\'','\'firearmRequests\''].includes(x)).join(',')+"]}");
}
export function armoryClientV493(source,client){
 source=armoryNavV493(source).replaceAll('총기 관리 현황','총기·무기고 관리 현황')
 .replace('총기 수량·수리·교체 현황을 확인하고 상태를 관리합니다.','무기고별 보유 수량과 인원별 총기 상태를 함께 관리합니다.')
 .replace('async function firearmsLoadV410(){firearmsInitV410();','async function firearmsLoadV410(){firearmsInitV410();armoryInitV493();')
 .replace("const data=await server('getRosterData');s.rows=data.items||[];","const rows=await armoryLoadV493();s.rows=rows;")
 .replace("v==='trainPersonnel'||v==='trainSupply'","v==='firearms'||v==='firearmRequests'||v==='trainPersonnel'||v==='trainSupply'")
 .replace('window.logbookReloadState=()=>({busy:!!(', 'window.logbookReloadState=()=>({busy:!!(armorySavingV493||');
 return insertAppClient(source,armoryCompanyV493.toString()+'\n'+client);
}
export function armoryServerV493(source,server){
 source=armoryNavV493(source,true).replace('function accessGuardV284_(name,args){',"function accessGuardV284_(name,args){if(name==='getArmoryV493')return accessGuardV284_('getRosterData',[]);if(['saveArmoryV493','saveArmoryRepairV563'].includes(name)){referenceAdminV409_();return accessPolicyV284_();}");
 return source+'\n'+[armorySpecsV493,armoryCompanyV493,armoryNumberV493,armoryOperatingRecordsV559,armoryModelV493].map(f=>f.toString()).join('\n')+'\n'+server;
}
