import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {armorySpecsV493,armoryCompanyV493,armoryNumberV493,armoryOperatingRecordsV559,armoryModelV493} from '../scripts/armory.mjs';
import {normalizeNavigation} from '../scripts/navigation.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const roster=Array.from({length:8},(_,i)=>({id:'p'+i,cohort:'77',company:(i+1)+'중대',name:'예시'+i,firearmNumber:'00'+i,firearmStatus:'정상'}));
test('같은 중대 표기 통합과 퇴교 총기 자동 이전은 중복·삭제·재배정을 제외한다',()=>{
 assert.equal(new Set(['4','4중대','４중대','4 중대'].map(armoryCompanyV493)).size,1);
 const archived=[{number:'A',status:'퇴교'},{number:'ａ',status:'퇴학'},{number:'B',status:'위탁'},{number:'C',status:'퇴교',deletedAt:'date'},{number:'D',status:'퇴교'}];
 const records=armoryOperatingRecordsV559([{firearmNumber:'D'}],[{id:'b1-a1',spares:['A','X']}],archived);
 assert.deepEqual(records[0].spares,['X']);
 assert.equal(records[3].spares.length,1);assert.equal(armoryNumberV493(records[3].spares[0]),'A');
 assert.deepEqual(records[3].manualSpares,[]);
 const scoped=armoryModelV493(roster,records,'2');assert.equal(scoped.groups.length,1);assert.equal(scoped.groups[0].automaticSpares.length,0);
});
test('8개 중대는 4개 무기고로 연결되며 중복 총기는 수량에서 제외한다',()=>{
 const rows=[...roster,{...roster[0],id:'duplicate',company:'１중대',name:'겸직'},{id:'unknown',company:'미정',name:'미분류',firearmNumber:'unknown'}];
 const model=armoryModelV493(rows,[{id:'b1-a1',pistols:0,bayonets:5,spares:['SPARE']}]);
 assert.deepEqual(model.groups.map(g=>g.assignedCount),[2,2,2,2]);assert.equal(model.totalUnique,9);assert.equal(model.duplicates.length,1);assert.equal(model.unclassified.length,1);
 assert.equal(model.groups[0].pistols,0);assert.equal(model.groups[1].pistols,null);
 const scoped=armoryModelV493(rows,[],'2');assert.equal(scoped.groups.length,1);assert.equal(scoped.groups[0].assigned.length,1);assert.equal(scoped.groups[0].assigned[0].company,'2중대');assert.equal(scoped.unclassified.length,0);
});
test('기존 사용자 메뉴를 두 그룹으로 한 번 분리하고 통합 하위 항목을 중복 생성하지 않는다',()=>{
 const defaults=[{id:'weapons',title:'총기/무기고',items:['firearms','firearmRequests']},{id:'devices',title:'군수품/장비',items:['supply','saber']}],allowed=['firearms','firearmRequests','supply','saber'];
 const input={schemaVersion:2,groups:[{id:'g_abcdefgh',title:'총기/군수품/장비',items:['supply','firearms','saber','firearmRequests']}],labels:{supply:'사용자 군수품'},liveMenuPlacementV411:true,saberRestoredV326:true};
 const migrated=normalizeNavigation(input,defaults,allowed);
 assert.deepEqual(migrated.groups.find(g=>g.id==='weapons').items,['firearms','firearmRequests']);assert.equal(migrated.groups.find(g=>g.id==='g_abcdefgh').title,'군수품/장비');
 assert.equal(migrated.labels.supply,'사용자 군수품');assert.equal(migrated.labels.firearms,'총기·무기고 관리 현황');
 assert.equal(migrated.groups.flatMap(g=>g.items).includes('armory'),false);
 assert.deepEqual(normalizeNavigation(migrated,defaults,allowed),migrated);
 migrated.groups.find(g=>g.id==='weapons').items=[];assert.deepEqual(normalizeNavigation(migrated,defaults,allowed).groups.find(g=>g.id==='weapons').items,[]);
});
function fixture(){
 const cells=[['무기고ID','권총','대검','여유번호','버전','시각','계정']];let exists=false,admin=true,policy={legacy:true};
 const sheet={getLastRow:()=>cells.length,setFrozenRows(){},getRange(row,col,n,width){return {getDisplayValues:()=>Array.from({length:n},(_,i)=>Array.from({length:width},(_,j)=>String(cells[row-1+i]?.[col-1+j]??''))),setValues:values=>{for(let i=0;i<values.length;i++)cells[row-1+i]=values[i];}};}};
 const ss={getSheetByName:()=>exists?sheet:null,insertSheet:()=>{exists=true;return sheet;}};
 const context=vm.createContext({armorySpecsV493,armoryCompanyV493,armoryNumberV493,armoryModelV493,armoryOperatingRecordsV559,specialGunItemsV255_:()=>[],referenceAdminV409_:()=>{if(!admin)throw Error('권한 없음');},lockAndRun_:fn=>fn(),spreadsheet_:()=>ss,rosterTab_:()=>({}),rosterRows_:()=>roster,ensureRows_(){},safeCell_:v=>v,Utilities:{getUuid:()=>Math.random().toString(16)},iso_:()=>new Date().toISOString(),config_:()=>({email:'test@example.com',canManageUsers:admin}),fullEditorsV281_:()=>[],accessGuardV284_:()=>policy});
 vm.runInContext(read('scripts/armory-server.gs.txt'),context);
 return {context,cells,setAdmin:v=>admin=v,setPolicy:v=>policy=v};
}
test('무기고 수량과 번호를 저장하고 재조회하며 미입력과 0을 구분한다',()=>{
 const {context}=fixture();assert.equal(context.getArmoryV493().groups[0].pistols,null);
 context.saveArmoryV493({id:'b1-a1',expectedVersion:'',pistols:'0',bayonets:'',spares:['000SPARE']});
 const g=context.getArmoryV493().groups[0];assert.equal(g.pistols,0);assert.equal(g.bayonets,null);assert.equal(g.spares[0],'000SPARE');assert.ok(g.version);
 context.saveArmoryV493({id:g.id,expectedVersion:g.version,pistols:'3',bayonets:'9',spares:[]});assert.equal(context.getArmoryV493().groups[0].spares.length,0);
});
test('기존 배정·다른 무기고·동일 입력 중복과 음수·소수·오래된 저장을 차단한다',()=>{
 const {context}=fixture(),valid={id:'b1-a1',expectedVersion:'',pistols:'2',bayonets:'4',spares:['SPARE']};
 for(const patch of [{spares:['０００']},{spares:['AA','aa']},{pistols:'-1'},{bayonets:'1.2'},{id:'invalid'}])assert.throws(()=>context.saveArmoryV493({...valid,...patch}));
 context.saveArmoryV493(valid);assert.throws(()=>context.saveArmoryV493(valid),/다른 사용자가/);
 assert.throws(()=>context.saveArmoryV493({...valid,id:'b2-a1'}),/다른 무기고/);
});
test('중대 조회에는 소속 인원만 반환하고 수량 수정은 서버에서도 차단한다',()=>{
 const f=fixture();f.setAdmin(false);f.setPolicy({registered:true,reader:true,company:'2'});
 const data=f.context.getArmoryV493();assert.equal(data.canEdit,false);assert.equal(data.groups.length,1);assert.deepEqual(Array.from(data.groups[0].assigned,p=>p.company),['2중대']);
 assert.throws(()=>f.context.saveArmoryV493({id:'b1-a1'}),/권한/);
});
test('생성 앱은 기존 총기 화면에서 통합 조회 API를 사용한다',()=>{
 const app=read('docs/assets/app.js');assert.match(app,/async function firearmsLoadV410\(\)\{firearmsInitV410\(\);armoryInitV493\(\);/);assert.match(app,/const rows=await armoryLoadV493\(\);s.rows=rows;/);assert.match(app,/총기·무기고 관리 현황/);
 const methods=JSON.parse(read('apps-script/methods.json'));for(const method of ['getArmoryV493','saveArmoryV493'])assert.ok(methods.includes(method));
});
test('총기 화면은 저장 후에도 동일 중대를 합치고 수리 명단은 접어서 표시한다',()=>{
 const elements=new Map(),root={querySelector:key=>{if(!elements.has(key))elements.set(key,{});return elements.get(key);}};
 const context=vm.createContext({canEdit:false,$:()=>root,firearmSummaryV410:rows=>({people:rows.length,quantity:rows.length}),escapeH:v=>String(v??''),companyLabelV257:v=>v+'중대'});
 const built=read('docs/assets/app.js'),helper=built.match(/^function armoryCompanyV493\(value\)\{[^\n]+/m);
 assert.ok(helper,'배포 코드에 중대 정규화 함수가 있어야 합니다');
 vm.runInContext(helper[0],context);
 vm.runInContext(read('scripts/firearms-client.js.txt'),context);
 vm.runInContext("firearmsStateV410.rows=[{id:'a',name:'가',company:'4',cohort:'77',firearmStatus:'수리 필요'},{id:'b',name:'나',company:'４중대',cohort:'77',firearmStatus:'수리 필요'}];firearmsRenderV410();",context);
 assert.equal((elements.get('[data-gun-summary]').innerHTML.match(/4중대/g)||[]).length,1);
 assert.match(elements.get('[data-gun-summary]').innerHTML,/<th>4중대<\/th><td>2<\/td>/);
 assert.match(elements.get('[data-gun-issues]').innerHTML,/<details class="gun-company-v559"><summary>4중대 · 2명/);
 assert.doesNotMatch(elements.get('[data-gun-issues]').innerHTML,/<details[^>]*\bopen\b/);
});
