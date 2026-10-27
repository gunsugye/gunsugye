import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {notificationReadCode} from '../scripts/notifications.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('수정사항 클릭은 화면 이동이 성공해야 해당 알림을 즉시 확인 처리한다',async()=>{
 const app=read('docs/assets/app.js'),start=app.indexOf('function changeOpenV283('),end=app.indexOf('async function changeDismissV283',start),calls=[],notices=[{id:'a',page:'all',title:'업무'},{id:'b',page:'all',title:'다른 업무'}];let canLeave=false;
 const state={items:notices,unread:[...notices]},context=vm.createContext({changeStateV283:state,viewNames:{all:['','전체']},switchView:()=>canLeave,$:()=>({value:''}),renderAll(){},changeRightRenderV283(){},server:async(...args)=>calls.push(args),toast(){}});
 new vm.Script(notificationReadCode+'\n'+app.slice(start,end)).runInContext(context);
 assert.equal(context.changeOpenV283('a',true),false);assert.equal(state.unread.length,2);assert.equal(calls.length,0);
 canLeave=true;assert.equal(context.changeOpenV283('a',true),true);assert.equal(state.unread.length,0);await new Promise(r=>setImmediate(r));
 assert.equal(calls[0][0],'dismissChangePageV286');assert.deepEqual(Array.from(calls[0][2]),['a','b']);
 assert.equal(state.items.length,2);
});

test('개별 확인은 한 건만 처리하고 실패하면 알림을 복원한다',async()=>{
 const state={items:[],unread:[{id:'a',page:'roster'},{id:'b',page:'roster'}]},context=vm.createContext({changeStateV283:state,changeRightRenderV283(){},server:async()=>{throw Error('연결 오류');},toast(){}});
 new vm.Script(notificationReadCode).runInContext(context);
 const pending=context.changeReadPageV309('roster',['a']);assert.equal(state.unread.length,1);
 await pending;assert.deepEqual(state.unread.map(x=>x.id).sort(),['a','b']);
});

const sourceUrl=new URL('../Code.gs.txt',import.meta.url);
if(existsSync(sourceUrl))test('서버는 화면에 있던 확인 대상만 저장하고 나중에 들어온 수정사항은 남긴다',()=>{
 const source=read('Code.gs.txt'),start=source.indexOf('function dismissChangePageV286('),end=source.indexOf('/** v2.88',start);
 const old='11111111-1111-1111-1111-111111111111',fresh='22222222-2222-2222-2222-222222222222';let saved=[];
 const context=vm.createContext({getChangesV283:()=>({unread:[{id:old,page:'all'},{id:fresh,page:'all'}]}),changeDismissedV283_:()=>new Set(saved),lockAndRun_:f=>f(),PropertiesService:{getUserProperties:()=>({setProperty:(_k,v)=>saved=JSON.parse(v)})}});
 new vm.Script(source.slice(start,end)).runInContext(context);context.dismissChangePageV286('all',[old]);assert.deepEqual(saved,[old]);
});

test('탭 이름에는 버전이 없고 업데이트가 수정사항보다 먼저 배치된다',()=>{
 const html=read('docs/index.html'),app=read('docs/assets/app.js');
 assert.ok(html.includes('<title>군수계 업무일지</title>'));assert.ok(app.includes("document.title='군수계 업무일지';"));assert.ok(!app.includes("document.title='군수계 업무일지 v2.99'"));
 assert.ok(html.includes('id="notificationDockV309"'));assert.ok(app.includes("dock.appendChild(panel)"));
});
