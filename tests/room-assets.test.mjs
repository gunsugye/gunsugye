import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const server=readFileSync(new URL('../scripts/room-assets-server.gs.txt',import.meta.url),'utf8');
export function fixture(){
 const rows=[['room','desk','2','1','1','Y','old','수리 필요(미보고)','기존 합산 메모','']];let writes=0;
 const sh={getLastRow:()=>rows.length+1,getMaxColumns:()=>10,getRange:(row,col,n=1,width=1)=>({getDisplayValues:()=>rows.slice(row-2,row-2+n).map(r=>r.slice(col-1,col-1+width)),setValues:values=>{writes++;values.forEach((v,i)=>rows[row-2+i]=v);}})};
 const c=vm.createContext({requireOwner_:()=>{},lockAndRun_:fn=>fn(),spreadsheet_:()=>({getSheetByName:()=>sh}),assetV244Rooms_:()=>[{id:'room'}],assetV244Catalog_:()=>[{id:'desk',name:'책상'},{id:'fridge',name:'냉장고'}],ROOM_ASSET_V244:{CATALOG:'cat',RECORDS:'data'},ROOM_ASSET_STATUSES_V246:['정상','수리 필요(보고)','수리 필요(미보고)','교체 필요'],canonicalRepairStateV216_:v=>v,iso_:()=> 'new',safeCell_:v=>v,assetEnsureV246_:()=>{},ensureRows_:()=>{}});
 vm.runInContext(server,c);return {c,rows,sh,writes:()=>writes};
}
const slots=()=>[{position:'1',status:'정상',details:'1번 메모',unavailable:false},{position:'2',status:'교체 필요',details:'2번 메모',unavailable:true}];
test('공유 비품 저장은 잠금 안에서 배정 검증을 실행하고 관리자 권한 검사는 유지한다',()=>{const f=fixture();let locked=false;f.c.lockAndRun_=fn=>{locked=true;try{return fn();}finally{locked=false;}};assert.throws(()=>f.c.assetSaveRoomV331_('room',[{itemId:'desk',expectedUpdatedAt:'old',slots:slots()}],()=>{assert.equal(locked,true);throw Error('배정 변경');}),/배정 변경/);assert.equal(f.writes(),0);f.c.requireOwner_=()=>{throw Error('관리자 전용');};assert.throws(()=>f.c.saveDormInventoryRoomV244('room',[]),/관리자 전용/);assert.equal(f.writes(),0);});
test('자리별 상태·메모·사용불가를 저장하고 기존 합산 기록을 보존한다',()=>{
 const {c,rows}=fixture();c.saveDormInventoryRoomV244('room',[{itemId:'desk',expectedUpdatedAt:'old',slots:slots()}]);
 const stored=JSON.parse(rows[0][9]);assert.deepEqual(stored.slots,slots());assert.equal(stored.legacy.details,'기존 합산 메모');
 assert.deepEqual(Array.from(rows[0].slice(2,5)),['2','1','1']);assert.equal(rows[0][7],'교체 필요');
 assert.equal(c.assetPositionsV311_('냉장고')[0],'common');assert.equal(c.assetPositionsV311_('공기청정기').length,1);assert.equal(c.assetPositionsV311_('신발장').length,2);
});
test('중복 자리·오래된 버전·잘못된 상태는 쓰기 전에 거절한다',()=>{
 for(const change of [{itemId:'desk',expectedUpdatedAt:'stale',slots:slots()},{itemId:'desk',expectedUpdatedAt:'old',slots:[slots()[0],slots()[0]]},{itemId:'desk',expectedUpdatedAt:'old',slots:slots().map(s=>({...s,status:'알 수 없음'}))}]){
  const f=fixture();assert.throws(()=>f.c.saveDormInventoryRoomV244('room',[change]));assert.equal(f.writes(),0);
 }
});
test('미선택 자리를 정상으로 추정하지 않고 공용 체크 값도 검증한다',()=>{
 const f=fixture();const s=slots();s[1].status='';const summary=f.c.assetSlotSummaryV311_(s);assert.equal(summary.confirmed,false);assert.equal(summary.normal,1);
 assert.throws(()=>f.c.assetValidateSlotsV311_([{position:'common',status:'정상',details:'',unavailable:'false'}],['common']));
});
