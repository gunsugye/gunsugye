import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {repairServer} from '../scripts/repairs.mjs';
test('네 가지 상태와 이전 표기를 호환하며 교체 필요도 포함한다',()=>{
 const source=repairServer(readFileSync(new URL('../Code.gs.txt',import.meta.url),'utf8'));
 const c=vm.createContext({});
 for(const name of ['canonicalRepairStateV216_','isRepairStateV216_'])vm.runInContext(source.match(new RegExp('function '+name+'\\(value\\)\\{[\\s\\S]*?\\n\\}'))[0],c);
 for(const old of ['수리필요(보고 완료)','수리 필요(보고 완료)','수리 필요(보고)'])assert.equal(c.canonicalRepairStateV216_(old),'수리 필요(보고)');
 assert.equal(c.canonicalRepairStateV216_('수리 필요'),'수리 필요(미보고)');
 assert.equal(c.isRepairStateV216_('교체 필요'),true);
 assert.equal(c.isRepairStateV216_('정상'),false);
 assert.equal(c.isRepairStateV216_('수리 완료'),false);
});
test('통합 목록은 총기·군수품·공용비품·예도·생활실 비품을 함께 조회한다',()=>{
 const source=repairServer(readFileSync(new URL('../Code.gs.txt',import.meta.url),'utf8'));
 const table=rows=>({getLastRow:()=>rows.length+1,getMaxColumns:()=>11,getLastColumn:()=>11,getRange:()=>({getDisplayValues:()=>rows})});
 const saber=table([['s1','','1중대','직책','담당','','교체 필요','교체 내용','now','']]);
 const inventory=table([]);
 const supply=table([]);
 const ss={getSheetByName:n=>n==='예도'?saber:n==='비품'?inventory:null,getSheets:()=>[{getSheetId:()=>1,...supply}]};
 const c=vm.createContext({config_:()=>({sheetId:'test',canEdit:true}),SpreadsheetApp:{openById:()=>ss},
 rosterTab_:()=>table([]),rosterRows_:()=>[{id:'p1',name:'가상',firearmStatus:'수리 필요(보고)'}],
 supplyRegistryItems_:()=>[{id:'i1',name:'군수품',sheetId:1}],supplyRegistry_:()=>({}),
 SUPPLY:{LEGACY_BASE:['명단ID'],BASE:['명단ID']},supplyRows_:()=>[{id:'p1',status:'교체 필요'}],
 equipmentSheet_:()=>({}),equipmentRows_:()=>[{id:'e1',washerBad:2,dryerBad:0}],
 SABER_V276:{TAB:'예도'},ROOM_ASSET_V244:{RECORDS:'비품',CATALOG:'품목'},
 assetV244Catalog_:()=>[{id:'a1',name:'침대'}],assetV244Rooms_:()=>[{id:'r1',building:'관',floor:'1층',room:'101'}],
 assetV244Records_:()=>[{roomId:'r1',itemId:'a1',status:'수리 필요(미보고)',repair:2}],iso_:()=> 'now'});
 // 군수품 헤더를 정상으로 제공합니다.
 ss.getSheets=()=>[{getSheetId:()=>1,...table([['명단ID']])}];
 for(const name of ['canonicalRepairStateV216_','isRepairStateV216_','getRepairDashboardV219'])vm.runInContext(source.match(new RegExp('function '+name+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}'))[0],c);
 const result=c.getRepairDashboardV219();
 assert.deepEqual(Array.from(result.items,x=>x.type).sort(),['equipment','gun','roomAsset','saber','supply']);
 assert.equal(result.items.find(x=>x.type==='equipment').count,2);
 assert.equal(result.items.find(x=>x.type==='roomAsset').count,2);
 assert.equal(result.warnings.length,0);
});
