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

test('군수품 입력은 짧게 모아 저장하고 연결 오류만 재시도한다',()=>{
 assert.match(app,/function supplyScheduleSaveV530\(id\)/);
 assert.match(app,/supplyTrack\(x\);supplyScheduleSaveV530\(x\.dataset\.id\)/);
 assert.match(app,/supplyWriteWithRetryV530\(itemId,copy\)/);
 assert.match(source,/if\(same\)return \{\.\.\.person,status,detail,updatedAt:old\.updatedAt/);
 assert.match(source,/function getSupplyCatalog\(selectedId,includeSelected\)/);
 assert.match(app,/server\('getSupplyCatalog',selectId\|\|supplySelected,true\)/);
});
