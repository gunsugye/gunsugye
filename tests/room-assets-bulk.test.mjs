import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fixture} from './room-assets.test.mjs';
const code=readFileSync(new URL('../scripts/room-assets-bulk.gs.txt',import.meta.url),'utf8');
function bulkFixture(){const f=fixture();vm.runInContext(code,f.c);return f;}
test('1번 일괄 입력은 2번의 상태·메모·사용불가를 유지한다',()=>{
 const f=bulkFixture();f.rows[0][9]=JSON.stringify({slots:[{position:'1',status:'정상',details:'1번 유지',unavailable:false},{position:'2',status:'교체 필요',details:'2번 유지',unavailable:true}],legacy:null});
 f.c.bulkSetDormInventoryScopeV246(['room'],{itemId:'desk',position:'1',status:'수리 필요(보고)',details:'',unavailable:'keep',includeMissing:true},[['room|desk','old']]);
 const slots=JSON.parse(f.rows[0][9]).slots;
 assert.equal(slots[0].status,'수리 필요(보고)');assert.equal(slots[0].details,'1번 유지');
 assert.deepEqual(slots[1],{position:'2',status:'교체 필요',details:'2번 유지',unavailable:true});
});
test('전체 정상 처리는 개인별 2개와 공용 1개를 만들고 충돌 시 쓰지 않는다',()=>{
 const options={itemId:'ALL',position:'all',status:'정상',unavailable:'no',details:'',includeMissing:true};
 const f=bulkFixture();const result=f.c.bulkSetDormInventoryScopeV246(['room'],options,[['room|desk','old']]);
 assert.equal(result.updated,1);assert.equal(result.created,1);
 assert.equal(JSON.parse(f.rows.find(r=>r[1]==='fridge')[9]).slots.length,1);
 const g=bulkFixture();assert.throws(()=>g.c.bulkSetDormInventoryScopeV246(['room'],options,[['room|desk','stale']]));assert.equal(g.writes(),0);
});
test('전체 초기화는 최신 버전·최고 관리자 권한을 확인하고 백업 후 점검 기록만 비운다',()=>{
 const f=bulkFixture();let backup=false,admin=true,audited=false;
 f.c.requireAdminV281_=()=>{if(!admin)throw Error('최고 관리자 전용');};
 f.c.Utilities={DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_alg,value)=>createHash('sha256').update(value).digest(),base64EncodeWebSafe:bytes=>Buffer.from(bytes).toString('base64url')};
 f.sh.getLastColumn=()=>10;
 const range=f.sh.getRange;f.sh.getRange=(...args)=>({...range(...args),getValues:()=>f.rows.map(r=>[...r]),clearContent:()=>{assert.equal(backup,true);f.rows.length=0;}});
 f.sh.copyTo=()=>{const copy=f.rows.map(r=>[...r]);return {setName:()=>{assert.equal(copy[0][8],'기존 합산 메모');backup=true;},getName:()=> 'backup'};};
 f.c.protectLimitedSheetV226_=()=>{};f.c.writeAudit_=()=>{audited=true;};
 const snapshot=f.c.getDormInventoryResetV313();assert.equal(snapshot.records,1);
 assert.throws(()=>f.c.clearDormInventoryRecordsV313('stale'));assert.equal(backup,false);
 admin=false;assert.throws(()=>f.c.clearDormInventoryRecordsV313(snapshot.token));admin=true;
 const result=f.c.clearDormInventoryRecordsV313(snapshot.token);assert.equal(result.removed,1);assert.equal(f.rows.length,0);assert.equal(audited,true);
});
