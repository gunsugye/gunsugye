import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../scripts/asset-inspection-client.js.txt',import.meta.url),'utf8');
const result={url:'https://docs.google.com/spreadsheets/d/new-file',stats:{checked:3,bad:4,unknown:0}};
function clientHarness({crypto,storage=new Map(),storageBlocked=false,reply=async()=>result,open=()=>null}={}){
 const calls=[],events=[],toasts=[],button={disabled:false,addEventListener(type,fn){assert.equal(type,'click');this.click=fn;}},status={textContent:'',children:[],replaceChildren(){this.children=[];},append(...nodes){this.children.push(...nodes);}};
 const context=vm.createContext({crypto,console,$:id=>id==='assetInspectionCreateV382'?button:status,assetSavingV244:false,canEdit:true,v284Scoped:false,assetDirtyV244:new Set(),toast:message=>toasts.push(message),window:{open(...args){events.push({type:'open',args});return open(...args);}},server:async(...args)=>{events.push({type:'server',args});calls.push(args);return reply(...args);},document:{createElement:()=>({}),createTextNode:text=>({textContent:text})},sessionStorage:{getItem(key){if(storageBlocked)throw Error('저장소 차단');return storage.get(key)??null;},setItem(key,value){if(storageBlocked)throw Error('저장소 차단');storage.set(key,value);},removeItem(key){if(storageBlocked)throw Error('저장소 차단');storage.delete(key);}}});
 vm.runInContext(source,context);return {button,status,calls,events,toasts,context,storage};
}
function preparedTab(){const navigations=[];return {closed:false,closes:0,opener:{},document:{title:'',body:{textContent:''}},location:{replace:url=>navigations.push(url)},navigations,close(){this.closes++;this.closed=true;}};}
test('UUID API가 없어도 유효한 요청을 보내고 실패 후 같은 키로 재시도하며 성공하면 지운다',async()=>{
 let attempts=0;const h=clientHarness({reply:async()=>{if(!attempts++)throw Error('응답 시간 초과');return result;}});await h.button.click();assert.equal(h.calls.length,1);assert.equal(h.calls[0][0],'createAssetInspectionV382');assert.match(h.calls[0][1],/^\w[\w-]{15,79}$/);assert.match(h.status.textContent,/생성 실패: 응답 시간 초과/);assert.equal(h.button.disabled,false);assert.equal(h.storage.size,1);
 await h.button.click();assert.equal(h.calls[1][1],h.calls[0][1]);assert.equal(h.storage.size,0);assert.equal(vm.runInContext('assetInspectionKeyV382',h.context),'');assert.equal(vm.runInContext('assetInspectionBusyV382',h.context),false);assert.equal(h.status.children[0].href,result.url);
});
test('실패 후 화면을 다시 열어도 저장된 요청키로 이어서 처리해 중복 생성을 피한다',async()=>{
 const storage=new Map(),first=clientHarness({storage,crypto:{randomUUID:()=> '12345678-1234-1234-1234-123456789012'},reply:async()=>{throw Error('연결 끊김');}});await first.button.click();const second=clientHarness({storage,crypto:{randomUUID:()=> '87654321-4321-4321-4321-210987654321'}});await second.button.click();assert.equal(second.calls[0][1],first.calls[0][1]);assert.equal(storage.size,0);await second.button.click();assert.equal(second.calls[1][1],'87654321-4321-4321-4321-210987654321');
});
test('UUID·저장소가 오류를 내도 실패 문구와 버튼 복구를 보장하고 진행 중 중복 클릭을 막는다',async()=>{
 let reject;const pending=new Promise((_,fail)=>{reject=fail;}),h=clientHarness({crypto:{randomUUID(){throw Error('지원하지 않음');}},storageBlocked:true,reply:()=>pending});const click=h.button.click();assert.equal(h.button.disabled,true);await h.button.click();assert.equal(h.calls.length,1);assert.equal(h.events.filter(event=>event.type==='open').length,1);assert.match(h.calls[0][1],/^\w[\w-]{15,79}$/);reject(null);await click;assert.match(h.status.textContent,/생성 실패: 알 수 없는 오류/);assert.equal(h.button.disabled,false);assert.equal(vm.runInContext('assetInspectionBusyV382',h.context),false);
});
test('클릭 직후 서버 대기 전에 탭을 준비하고 opener를 끊은 뒤 생성된 점검표로 이동한다',async()=>{
 let complete;const pending=new Promise(resolve=>{complete=resolve;}),tab=preparedTab(),h=clientHarness({open:()=>tab,reply:()=>pending}),click=h.button.click();assert.deepEqual(h.events.map(event=>event.type),['open','server']);assert.deepEqual(h.events[0].args,['about:blank','_blank']);assert.equal(tab.opener,null);assert.match(tab.document.title,/점검표 생성 중/);assert.match(tab.document.body.textContent,/완료되면 자동으로/);assert.equal(tab.navigations.length,0);complete(result);await click;assert.deepEqual(tab.navigations,[result.url]);assert.equal(tab.closes,0);assert.equal(h.status.children[0].href,result.url);assert.equal(h.status.children[0].rel,'noopener');assert.equal(h.toasts.length,0);assert.equal(h.storage.size,0);
});
test('서버 실패나 잘못된 결과 주소는 준비한 탭을 닫고 같은 생성 요청을 재시도할 수 있게 남긴다',async()=>{
 for(const reply of [async()=>{throw Error('서버 연결 실패');},async()=>({...result,url:'javascript:alert(1)'})]){const tab=preparedTab(),h=clientHarness({open:()=>tab,reply});await h.button.click();assert.equal(tab.closes,1);assert.equal(tab.navigations.length,0);assert.match(h.status.textContent,/생성 실패:/);assert.equal(h.storage.size,1);assert.equal(h.button.disabled,false);}
});
test('팝업 차단·탭 닫힘·창 접근 오류가 있어도 생성 결과 링크와 성공 상태는 유지한다',async()=>{
 for(const failure of ['blocked','closed','open-error','opener-error','navigation-error']){const tab=preparedTab();if(failure==='closed')tab.closed=true;if(failure==='opener-error')Object.defineProperty(tab,'opener',{set(){throw Error('접근 차단');}});if(failure==='navigation-error')tab.location.replace=()=>{throw Error('이동 차단');};const h=clientHarness({open:()=>{if(failure==='open-error')throw Error('팝업 차단');return failure==='blocked'?null:tab;}});await h.button.click();assert.equal(h.calls.length,1,failure);assert.equal(h.status.children[0].href,result.url,failure);assert.equal(h.storage.size,0,failure);assert.equal(h.button.disabled,false,failure);assert.equal(h.toasts.length,1,failure);assert.match(h.toasts[0],/새 점검표 열기/);assert.equal(tab.navigations.length,0,failure);if(failure==='opener-error'||failure==='navigation-error')assert.equal(tab.closes,1,failure);}
 const tab=preparedTab();Object.defineProperty(tab,'document',{get(){throw Error('안내 화면 접근 차단');}});const h=clientHarness({open:()=>tab});await h.button.click();assert.deepEqual(tab.navigations,[result.url]);assert.equal(h.toasts.length,0);
});
test('권한·미저장·저장 중 가드가 막으면 새 탭이나 생성 요청을 만들지 않는다',async()=>{
 for(const guard of ['canEdit=false','v284Scoped=true','assetSavingV244=true',"assetDirtyV244.add('desk')"]){const h=clientHarness();vm.runInContext(guard,h.context);await h.button.click();assert.equal(h.events.length,0,guard);assert.equal(h.calls.length,0,guard);assert.equal(h.storage.size,0,guard);}
});
