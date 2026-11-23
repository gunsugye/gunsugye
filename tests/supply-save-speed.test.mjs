import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../Code.gs.txt',import.meta.url),'utf8');
const app=readFileSync(new URL('../docs/assets/app.js',import.meta.url),'utf8');

test('군수품 한 명 저장은 전체 품목 행을 읽지 않는다',()=>{
 const start=source.indexOf('function supplyRows_('),end=source.indexOf('\nfunction supplyActivePayload_',start);
 const calls=[],values=[['id-1','75','1','김가','1','정상','', 'old','재학'],['id-2','75','1','김나','2','정상','', 'old','재학']];
 const sheet={getLastRow:()=>3,getRange:(row,col,count,width)=>{calls.push([row,col,count,width]);return {getDisplayValues:()=>values.slice(row-2,row-2+count).map(r=>r.slice(col-1,col-1+width))};}};
 const context=vm.createContext({SUPPLY:{MAX_PERSONS:5000,LEGACY_BASE:['legacy'],CORE:9},canonicalRepairStateV216_:x=>x});
 vm.runInContext(source.slice(start,end),context);
 const result=context.supplyRows_(sheet,['ID','기수','중대','이름','교번','상태','세부사항','수정시각','재학'],'id-2');
 assert.equal(result.length,1);assert.equal(result[0].id,'id-2');assert.equal(result[0].row,3);
 assert.deepEqual(calls,[[2,1,2,1],[3,1,1,9]]);
});

test('군수품 수정은 자동 저장 없이 검토한 뒤 일괄 저장한다',()=>{
 assert.match(app,/function supplyReviewOpenV531\(ids\)/);
 assert.match(app,/supplyTrack\(x\);supplyReviewUpdateV531\(\)/);
 assert.doesNotMatch(app,/supplyTrack\(x\);supplyScheduleSaveV530\(x\.dataset\.id\)/);
 assert.match(app,/server\('saveSupplyRowsV531',itemId,copies\)/);
 assert.match(source,/if\(same\)return \{\.\.\.person,status,detail,updatedAt:old\.updatedAt/);
 assert.match(source,/function getSupplyCatalog\(selectedId,includeSelected\)/);
 assert.match(app,/server\('getSupplyCatalog',selectId\|\|supplySelected,true\)/);
 assert.equal((source.match(/if\(name==='getSupplyCatalog'\)\{ret\.sheetUrl='';if\(ret\.selected\)\{ret\.selected\.rows=\(ret\.selected\.rows\|\|\[\]\)\.filter\(belongs\)/g)||[]).length,2);
});

test('군수품 일괄 저장은 전체 검증 후 쓰고 동일 요청 재시도 시 중복 저장하지 않는다',()=>{
 const code=readFileSync(new URL('../scripts/supply-review-server.gs.txt',import.meta.url),'utf8'),stored=[],writes=[],audits=[];
 const sh={getLastRow:()=>stored.length+1,getRange:(row,col,count,width)=>({setValues:values=>{writes.push([row,count]);values.forEach((cells,i)=>{stored[row-2+i]={row:row+i,id:cells[0],status:cells[5],detail:cells[6],updatedAt:cells[7],extra:{수량:cells[9]}};});}})};
 const context=vm.createContext({requireOwner_(){},lockAndRun_:fn=>fn(),spreadsheet_:()=>({}),supplyEnsureQuantityV500_:()=>({sh,item:{id:'item',name:'모포'},legacy:false,fields:['수량']}),supplyRoster_:()=>[{id:'a',cohort:'75',company:'1',name:'가',cadetNumber:'1'},{id:'b',cohort:'75',company:'1',name:'나',cadetNumber:'2'}],supplyRows_:()=>stored,SUPPLY:{STATUSES:['','정상','수리 필요','사용 불가']},text_:v=>String(v??''),canonicalRepairStateV216_:v=>v,supplyCheckQuantityV500_(){},supplyPresetValidateValueV520_(){},supplySchemaV408_:()=>({}),iso_:()=> 'new',safeCell_:v=>v,ensureRows_(){},supplyWriteAudit_:(...args)=>audits.push(args)});
 vm.runInContext(code,context);
 const a={id:'a',updatedAt:'',status:'정상',detail:'',extra:{수량:'1'}},b={id:'b',updatedAt:'',status:'정상',detail:'',extra:{수량:'1'}};
 assert.throws(()=>context.saveSupplyRowsV531('item',[a,{...b,status:'오류'}]),/상태/);assert.equal(writes.length,0);
 const first=context.saveSupplyRowsV531('item',[a,b]);assert.equal(first.saved,2);assert.deepEqual(writes,[[2,2]]);assert.equal(audits.length,1);
 const retry=context.saveSupplyRowsV531('item',[a,b]);assert.equal(retry.saved,0);assert.equal(writes.length,1);assert.equal(audits.length,1);
});
