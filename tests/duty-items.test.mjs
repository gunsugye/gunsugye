import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {dutyRoleInfoV367} from '../scripts/duty-roles.mjs';import {dutyItemRequirementsV368,dutyItemsNavSourceV368} from '../scripts/duty-items.mjs';import {normalizeNavigation} from '../scripts/navigation.mjs';

function dutyItemsFixture(){
 const elements=new Map(),element=selector=>{if(!elements.has(selector))elements.set(selector,{value:'',checked:false,textContent:'',innerHTML:'',addEventListener(){},querySelectorAll:()=>[],reportValidity(){},checkValidity:()=>true});return elements.get(selector);};
 const panel={dataset:{dutyItems:'dutyItems'},querySelector:element,querySelectorAll:()=>[],addEventListener(){}};
 const context=vm.createContext({dutyRoleInfoV367,document:{querySelector:()=>panel,querySelectorAll:()=>[panel],createElement:()=>({appendChild(){}})},window:{addEventListener(){}},$:()=>({prepend(){}}),switchView(){},dutyItemsV368:[{id:'badge',label:'흉장',view:'dutyItems'},{id:'block',label:'블럭',view:'dutyItems'},{id:'door',label:'방문 앞 명패',view:'dutyItems'},{id:'triangle',label:'삼각명패',view:'dutyItems'}],dutyOrderRowsV372:rows=>rows,dutyAccordionV373:(rows,render)=>render(rows),escapeH:s=>String(s).replaceAll('"','&quot;')});
 vm.runInContext('const dutyItemRequirementsV368='+dutyItemRequirementsV368.toString()+';'+readFileSync(new URL('../scripts/duty-items-client.js.txt',import.meta.url),'utf8'),context);
 element('[data-item-filter]').value='all';
 vm.runInContext("dutyItemsDataV368={rows:[{id:'aide',name:'보좌관 인원',duty:'전대군수참모보좌관'},{id:'society',name:'동기회 인원',duty:'동기회장'},{id:'leader',name:'장 인원',duty:'전대장'}],items:[{personId:'aide',item:'badge',quantity:3}]};dutyItemsRenderV368();",context);
 return {context,element};
}

test('기준 0개 칸은 비우고 기준이 있는 등록 0개와 미등록 입력칸은 유지한다',()=>{
 const {context,element}=dutyItemsFixture(),html=element('[data-item-rows]').innerHTML;
 assert.doesNotMatch(html,/data-item-person="aide" data-item-quantity="badge"/);
 assert.doesNotMatch(html,/data-item-person="society" data-item-quantity="block"/);
 assert.match(html,/data-item-person="aide" data-item-quantity="block"/);
 assert.match(html,/data-item-person="society" data-item-quantity="badge"/);
 assert.match(html,/data-item-person="leader" data-item-quantity="door"/);
 assert.equal(vm.runInContext("dutyItemsDataV368.items[0].quantity",context),3);
 vm.runInContext("dutyItemSetDraftV368('leader','badge',0);dutyItemsRenderV368();",context);
 assert.match(element('[data-item-rows]').innerHTML,/data-item-person="leader" data-item-quantity="badge"[^>]*value="0"/);
});

test('일괄 수량·기준 적용은 기준 0개 인원의 숨겨진 기록을 덮어쓰지 않는다',()=>{
 const {context,element}=dutyItemsFixture();
 vm.runInContext("for(const p of dutyItemsDataV368.rows)dutyItemSelectedV368.add(p.id);",context);
 element('[data-item-kind]').value='badge';element('[data-item-bulk-qty]').value='4';
 element('[data-item-bulk]').onclick();
 assert.equal(vm.runInContext("dutyItemDraftV368.has('aide|badge')",context),false);
 assert.equal(vm.runInContext("dutyItemDraftV368.get('leader|badge').quantity",context),4);
 assert.match(element('[data-item-status]').textContent,/2명 적용/);
 vm.runInContext('dutyItemDraftV368.clear();',context);element('[data-item-standard]').onclick();
 assert.equal(vm.runInContext("dutyItemDraftV368.has('aide|badge')",context),false);
 assert.equal(vm.runInContext("dutyItemDraftV368.get('society|badge').quantity",context),2);
 vm.runInContext("dutyItemDraftV368.clear();dutyItemSelectedV368.clear();dutyItemSelectedV368.add('aide');",context);
 element('[data-item-bulk]').onclick();assert.equal(vm.runInContext('dutyItemDraftV368.size',context),0);
 assert.match(element('[data-item-status]').textContent,/대상자가 없습니다/);
});
test('장·참모·보좌관·동생명의 흉장/블럭 기준과 모든 인원의 명패 기준을 적용한다',()=>{
 const req=new vm.Script('('+dutyItemRequirementsV368.toString()+')(row)'),context=vm.createContext({dutyRoleInfoV367,row:null});
 for(const [duty,badge,block] of [['전대장',2,2],['2대대장',2,2],['3중대장',2,2],['1편대장',2,2],['전대군수참모',2,2],['전대군수참모보좌관',0,2],['문화체육보좌관',0,2],['군수(보급)보좌관',0,2],['동기회장',2,0],['명예위원장',2,0],['생발위4학년1대대',2,0],['동기회보좌관',2,0],['4학년중대임원',0,0],['직책 미표기',0,0]]){context.row={duty};const result=req.runInContext(context);assert.equal(result.badge,badge,duty);assert.equal(result.block,block,duty);assert.equal(result.door,1);assert.equal(result.triangle,1);}
 context.row={duty:'4학년중대임원'};assert.equal(req.runInContext(context).review,true);
});
test('물품 메뉴를 예도 바로 아래 한 번 추가하고 사용자 삭제·제한 목록을 보존한다',()=>{
 const defaults=[{id:'devices',title:'장비',items:['saber','dutyItems','repairs']}],available=defaults[0].items;
 const next=normalizeNavigation({schemaVersion:2,groups:[{id:'devices',title:'장비',items:['saber','repairs']}]},defaults,available);assert.deepEqual(next.groups[0].items,available);next.groups[0].items=next.groups[0].items.filter(x=>x!=='dutyItems');assert.ok(!normalizeNavigation(next,defaults,available).groups[0].items.includes('dutyItems'));
 const legacy=normalizeNavigation({schemaVersion:2,dutyItemsAddedV368:true,groups:[{id:'devices',title:'장비',items:['saber','dutyBadge','dutyBlock','dutyNameplate','repairs']}]},defaults,available);assert.deepEqual(legacy.groups[0].items,available);assert.deepEqual(normalizeNavigation(legacy,defaults,available),legacy);
 assert.ok(!normalizeNavigation({schemaVersion:2,groups:[]},defaults,['saber']).groups.flatMap(g=>g.items).includes('dutyItems'));const source="const NAV_FIXED_V233=['saber','repairs'];";assert.equal(dutyItemsNavSourceV368(dutyItemsNavSourceV368(source)),dutyItemsNavSourceV368(source));
});
test('물품 수량은 일괄 저장하며 미등록/0 구분, 기존 기록 보존, 충돌·편성안·권한·수량 검증을 적용한다',()=>{
 let legacy=true,version='manual-v369',indexed=true,writes=0;const records=[['키','근무명단ID','품목','수량','수정시각','수정자']],props=new Map(),sheet={getLastRow:()=>records.length,getRange:(r,c,n,w)=>({getDisplayValues:()=>records.slice(r-1,r-1+n).map(v=>v.slice(c-1,c-1+w)),setValues:rows=>{writes++;rows.forEach((row,i)=>records[r-1+i]=row);}})};
 const context=vm.createContext({dutyManualReadyV369_:()=>{if(!indexed)throw Error('명단을 먼저 불러오세요.');},dutyRosterAdminV367_:()=>{if(!legacy)throw Error('권한 없음');},spreadsheet_:()=>({getSheetByName:()=>sheet}),PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},dormPlanDataV315_:()=>({version}),dutyRosterStateV367_:()=>({indexVersion:indexed?version:'old',records:[{id:'p1'},{id:'p2'}]}),lockAndRun_:fn=>fn(),text_:(s,n)=>String(s||'').slice(0,n),iso_:()=>String(writes),config_:()=>({email:'fixture@example.com'}),Utilities:{getUuid:()=>String(writes)},ensureRows_:()=>{}});vm.runInContext(readFileSync(new URL('../scripts/duty-items-server.gs.txt',import.meta.url),'utf8'),context);
 assert.equal(context.getDutyItemsV368().items.length,0);const changes=[{personId:'p1',item:'badge',quantity:2},{personId:'p1',item:'door',quantity:0},{personId:'p2',item:'triangle',quantity:1}];const result=context.saveDutyItemsV368('manual-v369','',changes);assert.equal(writes,1);assert.equal(context.getDutyItemsV368().items.find(r=>r.item==='door').quantity,0);assert.equal(context.getDutyItemsV368().items.find(r=>r.personId==='p2'&&r.item==='door'),undefined);
 assert.throws(()=>context.saveDutyItemsV368('manual-v369','',changes),/다른 곳/);assert.throws(()=>context.saveDutyItemsV368('old',result.revision,changes),/편성안/);assert.throws(()=>context.saveDutyItemsV368('manual-v369',result.revision,[{personId:'missing',item:'badge',quantity:2}]),/없는 인원/);
 for(const quantity of [-1,1.5,1001,'2',null])assert.throws(()=>context.saveDutyItemsV368('manual-v369',result.revision,[{personId:'p1',item:'badge',quantity}]),/정수/);assert.equal(writes,1);
 const saved=context.saveDutyItemsV368('manual-v369',result.revision,[{personId:'p1',item:'badge',quantity:1}]);assert.equal(context.getDutyItemsV368().items.length,3);assert.equal(context.getDutyItemsV368().revision,saved.revision);indexed=false;assert.throws(()=>context.getDutyItemsV368(),/먼저/);indexed=true;legacy=false;assert.throws(()=>context.getDutyItemsV368(),/권한/);assert.equal(writes,2);
});
