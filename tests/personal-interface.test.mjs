import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../scripts/personal-interface-server.gs.txt',import.meta.url),'utf8');
test('개인 화면 순서는 관리자만 저장하며 누락·중복·임의 항목·동시 수정을 거절한다',()=>{
 const props=new Map();let admin=true,serial=0;
 const c=vm.createContext({config_:()=>({canManageUsers:admin}),PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},Utilities:{getUuid:()=>String(++serial)},lockAndRun_:fn=>fn()});vm.runInContext(source,c);
 const defaults=c.getPersonalInterfaceV359();assert.deepEqual(Array.from(defaults.order),['room','assets','firearm','uniform','supplies']);assert.equal(props.size,0);
 const order=['firearm','room','assets','supplies','uniform'];const saved=c.savePersonalInterfaceV359(order,'');assert.equal(saved.version,'1');assert.deepEqual(Array.from(c.getPersonalInterfaceV359().order),order);
 assert.throws(()=>c.savePersonalInterfaceV359(order,''),/다른 곳/);assert.throws(()=>c.savePersonalInterfaceV359(['room'],'1'),/표시 항목/);assert.throws(()=>c.savePersonalInterfaceV359(['room','room','assets','firearm','uniform'],'1'),/표시 항목/);assert.throws(()=>c.savePersonalInterfaceV359(['room','assets','firearm','uniform','타인명단'],'1'),/표시 항목/);
 admin=false;assert.throws(()=>c.savePersonalInterfaceV359(order,'1'),/관리자/);assert.throws(()=>c.getPersonalInterfaceV359(),/관리자/);assert.deepEqual(Array.from(c.personalInterfaceReadV359_().order),order);assert.equal(props.size,1);
});
test('개인 화면은 기존 카드 DOM을 옮기며 미설정·잘못된 항목은 기본 순서로 보완한다',()=>{
 const defaults=['room','assets','firearm','uniform','supplies'],cards=new Map(defaults.map(id=>[id,{id,closest(){return this;}}])),order=[];
 const c=vm.createContext({$:id=>cards.get(id),document:{querySelector:()=>({appendChild(card){const i=order.indexOf(card);if(i>=0)order.splice(i,1);order.push(card);}})}});vm.runInContext(readFileSync(new URL('../scripts/personal-interface-portal.js.txt',import.meta.url),'utf8'),c);
 c.personalInterfaceOrderV359(['uniform','room','uniform','unknown']);assert.deepEqual(order.map(x=>x.id),['uniform','room','firearm','assets','supplies']);assert.equal(order[0],cards.get('uniform'));
 c.personalInterfaceOrderV359();assert.deepEqual(order.map(x=>x.id),['room','firearm','assets','uniform','supplies']);
});

test('관리 설정은 두 구성의 순서를 함께 저장하고 기존 배열 저장과 동시 수정 검사를 유지한다',()=>{
 const props=new Map();let serial=0;const c=vm.createContext({config_:()=>({canManageUsers:true}),PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key),setProperty:(key,value)=>props.set(key,value)})},Utilities:{getUuid:()=>String(++serial)},lockAndRun_:fn=>fn()});vm.runInContext(source,c);
 const defaults=c.getPersonalInterfaceV359(),regular=[...defaults.order].reverse(),duty=[...defaults.dutyInterfaceOrder];[duty[4],duty[5]]=[duty[5],duty[4]];let saved=c.savePersonalInterfaceV359({regular,duty},'');assert.deepEqual([...saved.order],regular);assert.deepEqual([...saved.dutyInterfaceOrder],duty);
 saved=c.savePersonalInterfaceV359([...regular].reverse(),saved.version);assert.deepEqual([...saved.dutyInterfaceOrder],duty);assert.throws(()=>c.savePersonalInterfaceV359({regular,duty},'1'),/다른 곳/);assert.throws(()=>c.savePersonalInterfaceV359({regular,duty:['saber']},saved.version),/표시 항목/);
});

test('관리에서 구분을 바꿔도 두 구성의 수정이 보존되고 한 번에 저장된다',async()=>{
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},style:{},setAttribute(){},addEventListener(event,fn){this[event]=fn;},contentWindow:{postMessage(){}},getBoundingClientRect:()=>({top:0})});return nodes.get(id);};
 let saved;const c=vm.createContext({$:get,escapeH:String,canManageUsersV281:true,view:'personalInterface',PERSONAL_PREVIEW_HTML_V360:'preview',window:{addEventListener(){}},server:async(name,value)=>name==='savePersonalInterfaceV359'?(saved=JSON.parse(JSON.stringify(value)),{order:value.regular,dutyInterfaceOrder:value.duty,version:'new'}):({order:['room','assets','firearm','uniform','supplies'],dutyInterfaceOrder:['room','firearm','duty','assets','uniform','supplies'],version:'old'}),enqueue:fn=>fn()});
 vm.runInContext(readFileSync(new URL('../scripts/personal-interface-client.js.txt',import.meta.url),'utf8'),c);await c.personalInterfaceLoadV359();vm.runInContext('personalInterfaceOrderV359.reverse();personalInterfaceRenderV359();',c);c.personalInterfaceSwitchV401('duty');vm.runInContext('personalInterfaceOrderV359.reverse();personalInterfaceRenderV359();',c);await get('personalInterfaceSaveV359').click();assert.equal(saved.regular[0],'supplies');assert.equal(saved.duty.length,6);assert.equal(saved.duty.indexOf('duty'),saved.duty.indexOf('room')+2);assert.equal(saved.duty.indexOf('assets'),saved.duty.indexOf('duty')+1);c.personalInterfaceSwitchV401('regular');assert.equal(vm.runInContext('personalInterfaceOrderV359[0]',c),'supplies');assert.equal(vm.runInContext('personalInterfaceDirtyV359',c),false);
});
