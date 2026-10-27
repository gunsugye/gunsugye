import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../scripts/dorm-corrections-server.gs.txt',import.meta.url),'utf8');
function fixture(duplicate=false){
 const props=new Map(),writes=[],backups=[];
 const room={id:'r1',row:2,building:'정예 동관',floor:'3층',room:'343-4',capacity:2,entries:[{cohort:'75',company:'3',name:'검증가'},{cohort:'76',company:'4',name:'검증나'}]};
 const ss={getId:()=> 'main',getSheetByName:()=>null};
 const sh={copyTo:()=>({setName:n=>backups.push(n),getName:()=> 'backup'}),getRange:(row,col)=>({setValue:value=>{assert.equal(backups.length,1);writes.push({row,col,value});}})};
 const c=vm.createContext({requireAdminV281_:()=>{},lockAndRun_:f=>f(),DORM_PLAN_DEFAULT_V315_:{correction:{building:'정예 동관',floor:'3층',fromRoom:'343-4',room:'343-3',cohort:'75',company:'3',group:'3중대',names:['검증가','검증나']}},spreadsheet_:()=>ss,livingSourceV272_:()=>({id:'main'}),PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},dormUnifiedReadV248_:()=>({sh,list:duplicate?[room,{...room,id:'r2',room:'343-3'}]:[room]}),protectLimitedSheetV226_:()=>{},dormUnifiedSaveV248_:(_sh,_r,entries)=>{assert.equal(backups.length,1);writes.push({entries:JSON.parse(JSON.stringify(entries))});},iso_:()=> 'now',DORM_ROSTER_V240:{TAB:'legacy'}});
 vm.runInContext(code,c);return {c,props,writes,backups};
}
test('확인된 호실 정정은 백업 후 배정자와 조직을 고치며 재호출 시 반복하지 않는다',()=>{
 const f=fixture();assert.equal(f.c.applyDormCorrectionsV315().changed,true);
 assert.deepEqual(f.writes[0].entries.map(p=>[p.cohort,p.company]),[['75','3'],['75','3']]);
 assert.equal(f.writes.find(x=>x.col===5).value,'343-3');assert.equal(f.writes.find(x=>x.col===15).value,'3중대');
 const count=f.writes.length;assert.equal(f.c.applyDormCorrectionsV315().changed,false);assert.equal(f.writes.length,count);
});
test('대상 호실이 중복되면 정정하지 않고 검토 대상으로 남긴다',()=>{
 const f=fixture(true),result=f.c.applyDormCorrectionsV315();assert.equal(result.review,true);assert.equal(f.writes.length,0);assert.equal(f.backups.length,0);
});
