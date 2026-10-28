import test from 'node:test';import assert from 'node:assert/strict';
import {assetOverviewGroups} from '../scripts/asset-overview.mjs';
test('건물·중대 전환 시 호실 소속으로 집계하며 누락 기록과 비활성 품목을 더하지 않는다',()=>{
 const rooms=[{id:'a',building:'정예 본관',group:'1중대',room:'132-1'},{id:'b',building:'정예 동관',group:'１중대',room:'220-여',femaleRoom:true},{id:'c',building:'정예 본관',group:'동생명',room:'130-동'}];
 const items=[{id:'desk',name:'책상'},{id:'fridge',name:'냉장고'}];
 const records=[{roomId:'a',itemId:'desk',quantity:2,normal:1,repair:1,confirmed:true,slots:[{unavailable:true}]},{roomId:'b',itemId:'desk',quantity:2,normal:0,repair:1,confirmed:false},{roomId:'a',itemId:'fridge',quantity:1,normal:1,repair:0,confirmed:true},{roomId:'a',itemId:'inactive',quantity:100,normal:100},{roomId:'outside',itemId:'desk',quantity:100}];
 const building=assetOverviewGroups(rooms,items,records,'building');assert.equal(building.length,2);assert.equal(building[0].quantity,3);assert.equal(building[0].rooms,2);assert.equal(building[0].completed,1);
 const company=assetOverviewGroups(rooms,items,records,'company'),one=company.find(r=>r.label==='1중대');assert.equal(one.rooms,2);assert.equal(one.quantity,5);assert.equal(one.unknown,1);assert.equal(one.unavailable,1);assert.equal(one.items.find(i=>i.id==='desk').quantity,4);
 assert.equal(company.find(r=>r.label==='동생명').quantity,0);assert.equal(assetOverviewGroups([],items,records,'company').length,0);
 assert.equal(building.reduce((s,r)=>s+r.quantity,0),company.reduce((s,r)=>s+r.quantity,0));
});
