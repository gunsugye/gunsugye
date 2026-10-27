import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {requestMemo,requestObjectMemo,requestPerformanceCode} from '../scripts/performance.mjs';

test('중복 설정 조회를 요청 안에서만 합치며 쓰기와 다음 요청은 다시 읽는다',()=>{
 let scope={},reads=0,current='old';const read=requestMemo(()=>{reads++;return current;},()=>scope);
 assert.equal(read(),'old');assert.equal(read(),'old');assert.equal(reads,1);
 scope=false;current='updated';assert.equal(read(),'updated');assert.equal(reads,2);
 scope={};assert.equal(read(),'updated');assert.equal(reads,3);
 let objects=0;const a={},b={},lookup=requestObjectMemo(x=>{objects++;return x;},()=>scope);
 lookup(a);lookup(a);lookup(b);assert.equal(objects,2);scope={};lookup(a);assert.equal(objects,3);
});

test('동일 조회의 시트 열기와 메뉴 읽기는 1회로 줄고 새 호출은 갱신된다',()=>{
 const calls={config:0,open:0,pages:0},sheet={};
 const context=vm.createContext({config_:()=>{calls.config++;return {};},fullEditorsV281_:()=>[],limitedEditorEmailsV226_:()=>[],accessProfilesV284_:()=>({}),accessPolicyV284_:()=>({}),spreadsheet_:()=>{calls.open++;return sheet;},wxPages_:()=>{calls.pages++;return [];}});
 new vm.Script(requestPerformanceCode+`\nglobalThis.run=()=>{pagesReadRequestV307_={};for(let i=0;i<4;i++){config_();wxPages_(spreadsheet_());}};`).runInContext(context);
 context.run();assert.deepEqual(calls,{config:1,open:1,pages:1});context.run();assert.deepEqual(calls,{config:2,open:2,pages:2});
});

test('브라우저는 진행 중인 동일 조회만 합치고 완료 후 새로 조회하며 쓰기는 합치지 않는다',async()=>{
 const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{hidden:false,value:'',textContent:'',addEventListener(){}});return elements.get(id);};
 let complete=null;const calls=[],completions=[];
 const context=vm.createContext({
  window:{LOGBOOK_CONFIG:{googleClientId:'client.apps.googleusercontent.com',apiUrl:'https://api.example'}},
  document:{getElementById:el,createElement:()=>({}),body:{appendChild(){}}},
  localStorage:{getItem:()=>JSON.stringify({token:'session.ok.signature',expiresAt:Date.now()+100000}),removeItem(){}},
  fetch:async(_url,options)=>{const b=JSON.parse(options.body);calls.push(b.method);if(b.method==='getBootstrap')return {status:200,ok:true,json:async()=>({ok:true,result:{}})};return new Promise(resolve=>{complete=()=>resolve({status:200,ok:true,json:async()=>({ok:true,result:{items:[]}})});completions.push(complete);});},
  AbortSignal,Date,Proxy,console,setTimeout,clearTimeout,location:{reload(){}},confirm:()=>true
 });
 new vm.Script(readFileSync(new URL('../docs/assets/pages.js',import.meta.url),'utf8')).runInContext(context);
 await new Promise(r=>setImmediate(r));
 const run=()=>new Promise((resolve,reject)=>context.window.google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getRosterData());
 const first=run(),second=run();assert.equal(calls.filter(x=>x==='getRosterData').length,1);complete();await Promise.all([first,second]);
 const third=run();assert.equal(calls.filter(x=>x==='getRosterData').length,2);complete();await third;
 const write=()=>new Promise((resolve,reject)=>context.window.google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).saveEntry({title:'검증'}));
 completions.length=0;const w1=write(),w2=write();assert.equal(calls.filter(x=>x==='saveEntry').length,2);for(const done of completions)done();await Promise.all([w1,w2]);
});
