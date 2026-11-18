import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
function fixture(){
 const props=new Map(),items=[{id:'a'},{id:'b'}];let allowed=true;
 const c=vm.createContext({Map,Set,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},referenceAdminV409_(){if(!allowed)throw Error('denied');},lockAndRun_:fn=>fn(),spreadsheet_:()=>({}),supplyOne_:()=>({}),supplyWriteAudit_(){},supplyRegistryItems_:()=>c.supplyOrderedItemsV500_(items)});
 vm.runInContext(read('../scripts/supply-quantity-order-server.gs.txt'),c);
 return {c,items,deny(){allowed=false;}};
}
test('quantity range validates changes and preserves legacy values',()=>{
 const {c}=fixture();
 for(const r of [{min:-1,max:2},{min:4,max:3},{min:0.5,max:2},{min:0,max:1001}])assert.throws(()=>c.supplyValidateQuantityRangeV500_(r));
 c.saveSupplyQuantityRangeV500('a',{min:1,max:3},{min:0,max:10});
 c.supplyCheckQuantityV500_('a','9','9');c.supplyCheckQuantityV500_('a','','9');c.supplyCheckQuantityV500_('a','2','9');
 assert.throws(()=>c.supplyCheckQuantityV500_('a','9','2'));
 assert.throws(()=>c.supplyCheckQuantityV500_('a','1.5','2'));
 assert.throws(()=>c.saveSupplyQuantityRangeV500('a',{min:0,max:5},{min:0,max:10}));
});
test('item order rejects stale, duplicate and unauthorized changes',()=>{
 const f=fixture(),{c}=f;
 assert.equal(c.saveSupplyOrderV500(['b','a'],['a','b']).items.map(x=>x.id).join(','),'b,a');
 f.items.push({id:'c'});assert.equal(c.supplyRegistryItems_().map(x=>x.id).join(','),'b,a,c');
 assert.throws(()=>c.saveSupplyOrderV500(['a','b','c'],['a','b','c']));
 assert.throws(()=>c.saveSupplyOrderV500(['a','a','c'],['b','a','c']));
 f.deny();assert.throws(()=>c.saveSupplyOrderV500(['a','b','c'],['b','a','c']),/denied/);
});
test('quantity dropdown preserves zero and out-of-range records',()=>{
 const c=vm.createContext({supplyItem:{quantityRange:{min:0,max:2}},escapeH:String});
 vm.runInContext(read('../scripts/supply-quantity-order-client.js.txt'),c);
 const html=value=>c.supplyQuantityInputV500({id:'p',name:'example'},{extra:{수량:value}},'');
 assert.match(html(0),/<select/);assert.match(html(0),/value="0" selected/);
 assert.match(html(8),/value="8" selected/);assert.match(html(8),/기존값/);
 assert.doesNotMatch(html(''),/value="0" selected/);
});
