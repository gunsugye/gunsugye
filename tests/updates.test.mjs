import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));

function noticeFixture(){
 const elements=new Map(),events=new Map(),stored=new Map();let clock=100000,reloads=0,requests=0,release={id:'aaaaaaaaaaaaaaaa',version:'3.08',title:'검증 업데이트',notes:['첫 번째 변경']};
 const element=id=>{if(!elements.has(id))elements.set(id,{hidden:true,textContent:'',children:[],addEventListener:(n,f)=>events.set(id+':'+n,f),replaceChildren(...nodes){this.children=nodes;},append(){}});return elements.get(id);};
 const context=vm.createContext({
  document:{documentElement:{dataset:{releaseId:'aaaaaaaaaaaaaaaa'}},visibilityState:'visible',getElementById:element,createElement:()=>({textContent:''}),querySelector:()=>({append(){}}),addEventListener:(n,f)=>events.set(n,f)},
  window:{addEventListener:(n,f)=>events.set(n,f),logbookReloadState:()=>({dirty:false})},
  Date:class extends Date{static now(){return clock;}},AbortSignal,setInterval:f=>events.set('interval',f),
  localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},
  fetch:async url=>{assert.match(url,/^\.\/release\.json\?t=/);requests++;return {ok:true,json:async()=>release};},location:{reload:()=>reloads++}
 });
 new vm.Script(read('docs/assets/updates.js')).runInContext(context);
 return {context,events,element,stored,advance:()=>{clock+=61000;},setRelease:r=>release=r,get reloads(){return reloads;},get requests(){return requests;}};
}
test('새 업데이트 알림은 배포 정보로 자동 표시하며 닫기·재표시와 저장 전 적용 보류를 지원한다',async()=>{
 const f=noticeFixture();f.context.window.LOGBOOK_UPDATES.start();await tick();
 assert.equal(f.element('pagesUpdateNotice').hidden,false);assert.equal(f.requests,1);
 assert.equal(f.element('pagesUpdateNotes').children[0].textContent,'첫 번째 변경');
 f.events.get('pagesUpdateClose:click')();f.advance();f.events.get('interval')();await tick();
 assert.equal(f.element('pagesUpdateNotice').hidden,true);
 f.setRelease({id:'bbbbbbbbbbbbbbbb',version:'3.09',title:'다음 버전',notes:['다음 변경']});f.advance();f.events.get('focus')();await tick();
 assert.equal(f.element('pagesUpdateNotice').hidden,false);assert.equal(f.element('pagesUpdateApply').textContent,'새 버전 적용');
 f.context.window.logbookReloadState=()=>({dirty:true});f.events.get('pagesUpdateApply:click')();assert.equal(f.reloads,0);
 f.context.window.logbookReloadState=()=>({dirty:false});f.events.get('pagesUpdateApply:click')();assert.equal(f.reloads,1);
});

test('생성된 배포 정보와 첫 화면 버전이 같고 새로고침 전에 로그인 덮개를 숨길 수 있다',()=>{
 const html=read('docs/index.html'),release=JSON.parse(read('docs/release.json'));
 assert.ok(html.includes('data-release-id="'+release.id+'"'));assert.ok(html.includes('v'+release.version+' · '+release.title));
 assert.ok(html.indexOf("setAttribute('data-session-restoring'")<html.indexOf('<body'));
 assert.ok(read('docs/assets/pages.css').includes('html[data-session-restoring="true"] .pages-login{display:none}'));
});

test('저장 세션 재접속은 서버 응답 전 화면부터 열며 검증 요청을 중복 전송하지 않는다',async()=>{
 const elements=new Map(),scripts=[],get=id=>{if(!elements.has(id))elements.set(id,{hidden:id==='pagesSession',value:'',textContent:'',addEventListener(){}});return elements.get(id);};
 let resolveFetch,requests=0;
 const context=vm.createContext({window:{LOGBOOK_CONFIG:{googleClientId:'client.apps.googleusercontent.com',apiUrl:'https://api.example'}},
  document:{documentElement:{dataset:{appVersion:'abc'},removeAttribute(){}},getElementById:get,createElement:()=>({}),body:{appendChild:s=>scripts.push(s)}},
  localStorage:{getItem:()=>JSON.stringify({token:'session.valid.signature',expiresAt:Date.now()+60000}),removeItem(){}},
  fetch:()=>{requests++;return new Promise(r=>resolveFetch=r);},AbortSignal,Date,Proxy,console,setTimeout,clearTimeout,location:{reload(){}}
 });
 new vm.Script(read('docs/assets/pages.js')).runInContext(context);
 assert.equal(get('pagesLogin').hidden,true);assert.equal(scripts.length,1);assert.equal(get('pagesSession').hidden,true);
 const result=new Promise((resolve,reject)=>context.window.google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).readCompressedV282('getBootstrap'));
 assert.equal(requests,1);resolveFetch({ok:true,status:200,json:async()=>({ok:true,result:{userEmail:'verified@example.com',entries:[]}})});
 assert.equal((await result).userEmail,'verified@example.com');assert.equal(get('pagesAccount').textContent,'verified@example.com');assert.equal(requests,1);
});

test('저장된 세션을 서버가 거절하면 로그인 화면으로 복귀한다',async()=>{
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{hidden:false,value:'',textContent:'',addEventListener(){}});return elements.get(id);};let forgotten=false;
 const context=vm.createContext({window:{LOGBOOK_CONFIG:{googleClientId:'client.apps.googleusercontent.com',apiUrl:'https://api.example'}},
 document:{documentElement:{dataset:{},removeAttribute(){}},getElementById:get,createElement:()=>({}),body:{appendChild(){}}},
 localStorage:{getItem:()=>JSON.stringify({token:'session.invalid.signature',expiresAt:Date.now()+60000}),removeItem:()=>forgotten=true},
 fetch:async()=>({ok:false,status:401,json:async()=>({ok:false,error:'로그인 필요'})}),AbortSignal,Date,Proxy,console,setTimeout,clearTimeout,location:{reload(){}}
 });new vm.Script(read('docs/assets/pages.js')).runInContext(context);await tick();
 assert.equal(get('pagesLogin').hidden,false);assert.equal(forgotten,true);assert.equal(get('pagesSession').hidden,true);
});
