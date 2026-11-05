import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../scripts/asset-inspection-client.js.txt',import.meta.url),'utf8');
const result={url:'https://docs.google.com/spreadsheets/d/new-file',stats:{checked:3,bad:4,unknown:0}};
function clientHarness({crypto,storage=new Map(),storageBlocked=false,reply=async()=>result}={}){
 const calls=[],button={disabled:false,addEventListener(type,fn){assert.equal(type,'click');this.click=fn;}},status={textContent:'',children:[],replaceChildren(){this.children=[];},append(...nodes){this.children.push(...nodes);}};
 const context=vm.createContext({crypto,console,$:id=>id==='assetInspectionCreateV382'?button:status,assetSavingV244:false,canEdit:true,v284Scoped:false,assetDirtyV244:new Set(),toast:()=>{},server:async(...args)=>{calls.push(args);return reply(...args);},document:{createElement:()=>({}),createTextNode:text=>({textContent:text})},sessionStorage:{getItem(key){if(storageBlocked)throw Error('저장소 차단');return storage.get(key)??null;},setItem(key,value){if(storageBlocked)throw Error('저장소 차단');storage.set(key,value);},removeItem(key){if(storageBlocked)throw Error('저장소 차단');storage.delete(key);}}});
 vm.runInContext(source,context);return {button,status,calls,context,storage};
}
test('UUID API가 없어도 유효한 요청을 보내고 실패 후 같은 키로 재시도하며 성공하면 지운다',async()=>{
 let attempts=0;const h=clientHarness({reply:async()=>{if(!attempts++)throw Error('응답 시간 초과');return result;}});await h.button.click();assert.equal(h.calls.length,1);assert.equal(h.calls[0][0],'createAssetInspectionV382');assert.match(h.calls[0][1],/^\w[\w-]{15,79}$/);assert.match(h.status.textContent,/생성 실패: 응답 시간 초과/);assert.equal(h.button.disabled,false);assert.equal(h.storage.size,1);
 await h.button.click();assert.equal(h.calls[1][1],h.calls[0][1]);assert.equal(h.storage.size,0);assert.equal(vm.runInContext('assetInspectionKeyV382',h.context),'');assert.equal(vm.runInContext('assetInspectionBusyV382',h.context),false);assert.equal(h.status.children[0].href,result.url);
});
test('실패 후 화면을 다시 열어도 저장된 요청키로 이어서 처리해 중복 생성을 피한다',async()=>{
 const storage=new Map(),first=clientHarness({storage,crypto:{randomUUID:()=> '12345678-1234-1234-1234-123456789012'},reply:async()=>{throw Error('연결 끊김');}});await first.button.click();const second=clientHarness({storage,crypto:{randomUUID:()=> '87654321-4321-4321-4321-210987654321'}});await second.button.click();assert.equal(second.calls[0][1],first.calls[0][1]);assert.equal(storage.size,0);await second.button.click();assert.equal(second.calls[1][1],'87654321-4321-4321-4321-210987654321');
});
test('UUID·저장소가 오류를 내도 실패 문구와 버튼 복구를 보장하고 진행 중 중복 클릭을 막는다',async()=>{
 let reject;const pending=new Promise((_,fail)=>{reject=fail;}),h=clientHarness({crypto:{randomUUID(){throw Error('지원하지 않음');}},storageBlocked:true,reply:()=>pending});const click=h.button.click();assert.equal(h.button.disabled,true);await h.button.click();assert.equal(h.calls.length,1);assert.match(h.calls[0][1],/^\w[\w-]{15,79}$/);reject(null);await click;assert.match(h.status.textContent,/생성 실패: 알 수 없는 오류/);assert.equal(h.button.disabled,false);assert.equal(vm.runInContext('assetInspectionBusyV382',h.context),false);
});
