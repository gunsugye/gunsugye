import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {supplyQuantityOrderServerV500} from '../scripts/supply-quantity-order.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
function fixture(){
 const props=new Map(),items=[{id:'a'},{id:'b'}];let allowed=true;
 const c=vm.createContext({Map,Set,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},referenceAdminV409_(){if(!allowed)throw Error('denied');},lockAndRun_:fn=>fn(),spreadsheet_:()=>({}),supplyOne_:()=>({}),supplyWriteAudit_(){},supplyRegistryItems_:()=>c.supplyOrderedItemsV500_(items)});
 vm.runInContext(read('../scripts/supply-quantity-order-server.gs.txt'),c);
 return {c,items,deny(){allowed=false;}};
}
test('quantity range validates changes and preserves legacy values',()=>{
 const {c}=fixture();
 for(const r of [{max:-1},{max:0.5},{max:null},{max:''},{max:1001}])assert.throws(()=>c.supplyValidateQuantityRangeV500_(r));
 assert.equal(c.supplyQuantityRangeV500_('a').max,1);
 assert.equal(c.supplyValidateQuantityRangeV500_({min:2,max:3}).min,0);
 c.saveSupplyQuantityRangeV500('a',{min:0,max:3},{min:0,max:1});
 c.supplyCheckQuantityV500_('a','9','9');c.supplyCheckQuantityV500_('a','','9');c.supplyCheckQuantityV500_('a','2','9');
 c.supplyCheckQuantityV500_('a','9','2');
 assert.throws(()=>c.supplyCheckQuantityV500_('a','100001','2'));
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
 const c=vm.createContext({document:{addEventListener(){}},supplyItem:{quantityRange:{min:0,max:2}},escapeH:String});
 vm.runInContext(read('../scripts/supply-quantity-order-client.js.txt'),c);
 const html=value=>c.supplyQuantityInputV500({id:'p',name:'example'},{extra:{수량:value}},'');
 assert.match(html(0),/<select/);assert.match(html(0),/value="0" selected/);
 assert.match(html(8),/value="8" selected/);assert.match(html(8),/직접 입력/);assert.match(html(0),/value="__direct">직접 입력/);
 assert.doesNotMatch(html(''),/value="0" selected/);
});
test('item configuration exposes quantity bounds and validates them before schema save',()=>{
 const compiled=read('../docs/assets/app.js');
 assert.doesNotMatch(compiled,/name="quantityMin"/);assert.match(compiled,/name="quantityMax"/);assert.doesNotMatch(compiled,/고정 항목: 수량/);
 const schema=read('../scripts/supply-schema-server.gs.txt');
 const seed="function registry(){return sh.getRange(2,1,n,4).getDisplayValues().filter(r=>r[0]).map(r=>({id:r[0],name:r[1],sheetId:Number(r[2]),createdAt:r[3]}));}\nfunction saveSupplyRow(itemId,source){}\nfunction normalizeSupplyCohort(){}\n"+schema;
 const {c}=fixture();vm.runInContext(supplyQuantityOrderServerV500(seed,''),c);
 assert.equal(c.supplySchemaValidateV408_({fields:[],quantityRange:{min:2,max:8}},'item').quantityRange.max,8);
 assert.equal(c.supplySchemaValidateV408_({fields:[],quantityRange:{min:8,max:2}},'item').quantityRange.min,0);
 assert.throws(()=>c.supplySchemaValidateV408_({fields:[],quantityRange:{max:-1}},'item'));
});
test('direct input restores selection before opening and dispatches only validated numeric changes',()=>{
 let handler,submitted=0,stopped=false;const input={value:'',focus(){}},form={elements:{quantity:input}},cancel={},message={};
 const dialog={querySelector:s=>s==='form'?form:s==='[data-cancel]'?cancel:message,showModal(){},close(){this.onclose?.();},remove(){}};
 const document={addEventListener:(type,fn)=>handler=fn,createElement:type=>type==='dialog'?dialog:{},body:{append(){}}};
 const select={value:'__direct',dataset:{quantityValue:'1'},options:[{value:'0'},{value:'1'},{value:'__direct'}],closest(){return this;},querySelector(){return this.options.at(-1);},insertBefore(option){this.options.splice(-1,0,option);},dispatchEvent(){submitted++;handler({target:this});}};
 const c=vm.createContext({document,canEdit:true,Event:class{},escapeH:String});vm.runInContext(read('../scripts/supply-quantity-order-client.js.txt'),c);
 handler({target:select,stopImmediatePropagation(){stopped=true;}});
 assert.equal(stopped,true);assert.equal(select.value,'1');assert.equal(submitted,0);assert.equal(input.value,'1');
 input.value='1.5';form.onsubmit({preventDefault(){}});assert.equal(submitted,0);
 input.value='7';form.onsubmit({preventDefault(){}});assert.equal(select.value,'7');assert.equal(select.dataset.quantityValue,'7');assert.equal(submitted,1);assert.equal(select.options.at(-1).value,'__direct');
});
