import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const base=['명단ID','기수','중대','이름','교번','상태','세부내용','수정시각','명단상태'];
function fixture(rows){
 const calls=[],schema={fields:['수량','종류'],options:{종류:['구형','신형']}};
 const context=vm.createContext({Map,Set,JSON,String,PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'supabase'})},SUPPLY:{BASE:base,LEGACY_BASE:[...base.slice(0,6),'사이즈','수량','세부내용','수정시각','명단상태'],CORE:9,MAX_PERSONS:5000},canonicalRepairStateV216_:s=>s,supplySchemaV408_:()=>schema,supplyQuantityRangeV500_:()=>({min:0,max:1,standard:1}),personalHashV330_:v=>JSON.stringify(v),pagesStorageRpc_:q=>{calls.push(q);return [{id:'item',headers:[...base,'수량','종류'],rows,choices:{수량:['0','1']}}];}});
 const code=read('Code.gs.txt'),start=code.indexOf('function supplyRows_('),end=code.indexOf('function supplyActivePayload_',start);
 vm.runInContext(code.slice(start,end)+read('scripts/supabase-person-supplies.gs.txt'),context);
 return {context,calls,load:()=>context.personalSupplyReadModelV572_({getId:()=> 'book'},{id:'person'},[{id:'item',sheetId:1,name:'품목'}]).get('item')};
}
test('native personal read preserves zero, details, status, and snapshot inputs in one call',()=>{
 const f=fixture([['person','75','2','테스트','123','수리 필요','설명','time','재학','0','신형']]),o=f.load();
 assert.equal(o.value.extra.수량,'0');assert.equal(o.value.detail,'설명');assert.equal(o.value.status,'수리 필요');
 assert.equal(o.old.updatedAt,'time');assert.equal(o.schema.options.종류[1],'신형');
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].person,'person');
 assert.deepEqual(JSON.parse(o.snapshot),['person','item','time',JSON.parse(JSON.stringify(o.value)),JSON.parse(JSON.stringify(o.schema)),{min:0,max:1,standard:1}]);
});
test('native personal read rejects duplicate records and preserves blanks for absent people',()=>{
 assert.match(fixture([['person'],['person']]).load().error.message,/중복/);
 const o=fixture([]).load();assert.equal(o.value.extra.수량,'');assert.equal(o.value.status,'');
});
