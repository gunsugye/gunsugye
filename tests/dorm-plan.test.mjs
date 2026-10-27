import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {correctDormSource} from '../scripts/dorm-corrections.mjs';
const code=readFileSync(new URL('../scripts/dorm-plan-server.gs.txt',import.meta.url),'utf8');
function fixture(){
 const properties=new Map(),writes=[],backups=[],books=[];
 for(const id of ['main','linked']){
  const room={id:id+'-room',building:'정예 동관',floor:'3층',corridor:'복도',room:'343-3',group:'3중대',capacity:2,outsideCount:1,updatedAt:'old',slots:[{occupied:true},{occupied:true}]};
  const entries=[{cohort:'75',company:'3',name:'검증가',status:'확인'},{cohort:'76',company:'3',name:'검증나',status:'확인'}];
  const raw=Array(43).fill('');raw[0]=room.id;raw[4]=room.room;raw[9]='old';raw[15]='75';raw[17]='검증가';raw[22]='76';raw[24]='검증나';
  const ss={getId:()=>id},sh={getLastRow:()=>2,getMaxColumns:()=>43,getRange:(row,col,n=1,w=1)=>({getValues:()=>row===2&&n===1?[raw.slice(col-1,col-1+w)]:[],setValues:v=>{assert.equal(backups.length,2);writes.push({id,row,col,values:JSON.parse(JSON.stringify(v))});}}),copyTo:()=>({setName:name=>{backups.push({id,name});},getName:()=>id+' backup'})};ss.getSheetByName=()=>sh;
  books.push({ss,sh,room,raw,entries});
 }
 let allowed=true;
 const c=vm.createContext({
  DORM_PLAN_DEFAULT_V315_:{filename:'test.pdf',base64:'JVBERi0xLjQK',layout:[]},requireOwner_:()=>{if(!allowed)throw Error('권한 없음');},lockAndRun_:f=>f(),spreadsheet_:()=>books[0].ss,livingSourceV272_:()=>({id:'linked'}),SpreadsheetApp:{openById:id=>books.find(b=>b.ss.getId()===id).ss,flush(){}},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v)})},
  dormTabV234_:ss=>books.find(b=>b.ss===ss).sh,dormReadV234_:sh=>[books.find(b=>b.sh===sh).room],
  dormUnifiedReadV248_:ss=>{const b=books.find(b=>b.ss===ss),r={...b.room,row:2,entries:b.entries};return {sh:b.sh,list:[r],byId:new Map([[r.id,r]])};},
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_alg,s)=>createHash('sha256').update(s).digest(),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),getUuid:()=> 'new-version'},
  text_:(v,n)=>String(v||'').trim().slice(0,n),iso_:()=> 'new',
  dormCheckV234_:(payload,old)=>({...payload,id:old?.id||'new-room'}),dormValuesV234_:r=>[r.id,r.building,r.floor,r.corridor,r.room,r.capacity,JSON.stringify(r.slots),'',r.verified?'Y':'N','new',r.femaleRoom?'Y':'N','',false,r.outsideCount,r.group],
  dormEnsureUnifiedV248_:ss=>books.find(b=>b.ss===ss).sh,ensureRows_:()=>{},
  dormUnifiedSaveV248_:(sh,r,members)=>{assert.equal(backups.length,2);writes.push({id:books.find(b=>b.sh===sh).ss.getId(),members:JSON.parse(JSON.stringify(members)),row:r.row});},protectLimitedSheetV226_:()=>{},DriveApp:{createFile:()=>({getId:()=> 'plan-file'})}
 });vm.runInContext(code,c);
 return {c,books,writes,backups,properties,deny:()=>allowed=false};
}
test('도면 배정 저장은 호실 ID를 유지하며 두 연결 파일의 인원과 통합명단을 함께 갱신한다',()=>{
 const f=fixture(),plan=f.c.getDormPlanV315(),room=plan.rooms[0];
 const result=f.c.saveDormPlanV315({version:plan.version,changes:[{...room,members:[{cohort:'75',company:'3',name:'검증가'}]}]});
 assert.equal(result.files,2);assert.equal(f.backups.length,2);
 for(const book of f.books){const record=f.writes.find(w=>w.id===book.ss.getId()&&w.col===1).values[0];assert.equal(record[0],book.room.id);assert.equal(JSON.parse(record[6]).filter(s=>s.occupied).length,1);assert.equal(record[13],1);assert.equal(f.writes.find(w=>w.id===book.ss.getId()&&w.members).members.length,1);}
});
test('오래된 호실 버전·불완전한 기수·권한 없는 요청은 백업과 수정 전에 차단한다',()=>{
 for(const kind of ['stale','identity','denied']){
  const f=fixture(),plan=f.c.getDormPlanV315(),room=plan.rooms[0];if(kind==='stale')room.token='old';if(kind==='identity')room.members[0].cohort='';if(kind==='denied')f.deny();
  assert.throws(()=>f.c.saveDormPlanV315({version:plan.version,changes:[room]}));assert.equal(f.writes.length,0);assert.equal(f.backups.length,0);
 }
});
test('확인한 두 사람의 원본 정정만 적용하며 다른 호실의 동명이인은 바꾸지 않는다',()=>{
 const fix={building:'정예 동관',floor:'3층',fromRoom:'343-4',room:'343-3',cohort:'75',company:'3',group:'3중대',names:['검증가','검증나']};
 const rows=[['정예 동관','3층','복도','343-4','76','4','검증나','N','확인'],['정예 본관','2층','복도','259','76','4','검증나','N','확인']];
 const output=correctDormSource('const DORM_PDF_ROSTER_V241='+JSON.stringify(rows)+';',fix);const result=JSON.parse(output.match(/=(.*);/)[1]);
 assert.deepEqual(result[0].slice(3,6),['343-3','75','3']);assert.deepEqual(result[1],rows[1]);
});
test('PDF 갱신은 미검토 배정을 변경하지 않고 문서 버전을 검사한다',()=>{
 const f=fixture(),p=f.c.getDormPlanV315();
 const result=f.c.saveDormPlanV315({version:p.version,changes:[],pdf:{filename:'new.pdf',base64:'JVBERi0xLjQK',layout:[{building:'정예 동관',floor:'3층',room:'343-3',page:8,x:.1,y:.1,width:.1,height:.1,fullBox:true}]}});
 assert.equal(result.rooms,0);assert.equal(f.writes.length,0);assert.equal(f.properties.get('DORM_PLAN_FILE_V315'),'plan-file');
 const g=fixture();assert.throws(()=>g.c.saveDormPlanV315({version:'stale',changes:[]}));
});
