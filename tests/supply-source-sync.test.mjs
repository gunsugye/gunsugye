import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const ctx=vm.createContext({});vm.runInContext(readFileSync('scripts/supply-source-sync.gs.txt','utf8'),ctx);
const headers=['명단ID','기수','중대','이름','교번','상태','수정시각','수량','세부내용'];
const row=['id','75','2','이름','123','수리 필요','old','0',''];
const cells=(first,last,initial)=>JSON.parse(JSON.stringify(ctx.supplySourceCellsV570_(headers,headers,row,first,last,initial)));
test('sheet edits copy only edited supply cells including zero and explicit clearing',()=>{
 assert.deepEqual(cells(8,9,false),[{column:8,value:'0'},{column:9,value:''}]);
});
test('initial import copies recorded values but does not manufacture blank deletions',()=>{
 assert.deepEqual(cells(1,9,true),[{column:6,value:'수리 필요'},{column:8,value:'0'}]);
});
test('identity and timestamps are not copied from sheet edits',()=>{assert.deepEqual(cells(1,5,false),[]);assert.deepEqual(cells(7,7,false),[]);});
test('deterministic database conflicts cannot trigger serialization retries',()=>{
 for(const file of ['scripts/supabase-store-schema.sql','scripts/supabase-runtime-schema.sql']){
  const sql=readFileSync(file,'utf8');assert.ok(!sql.includes("errcode='40001'"));assert.ok(sql.includes("errcode='PT409'"));
 }
 assert.ok(readFileSync('scripts/supabase-store-edge.ts','utf8').includes("result.code==='PT409'?'40001':result.code"));
});
