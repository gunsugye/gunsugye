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
 c.personalInterfaceOrderV359(['uniform','room','uniform','unknown']);assert.deepEqual(order.map(x=>x.id),['uniform','room','assets','firearm','supplies']);assert.equal(order[0],cards.get('uniform'));
 c.personalInterfaceOrderV359();assert.deepEqual(order.map(x=>x.id),defaults);
});
