import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const rows=[{id:'senior',name:'선임',cohort:'75',company:'1',cadetNumber:'7501'},{id:'guide',name:'지도예시',cohort:'76기',company:'２중대',cadetNumber:'7601'},{id:'other',name:'동명예시',cohort:'76',company:'3',cadetNumber:'7602'},{id:'duplicate',name:'동명예시',cohort:'76',company:'4',cadetNumber:'7603'},{id:'sophomore',name:'후임',cohort:'77',company:'1'},{id:'freshman',name:'신입',cohort:'78',company:'1'}];
function serverFixture(){
 const ss={},sheet={};let available=true,source=rows,written=[];
 const context=vm.createContext({getSaberV276:()=>{},spreadsheet_:()=>ss,rosterTab_:book=>{assert.equal(book,ss);return available?sheet:null;},rosterRows_:tab=>{assert.equal(tab,sheet,'명단 탭을 읽어야 합니다');return source;},iso_:()=>'',safeCell_:x=>x});
 vm.runInContext(read('scripts/training-management-server.gs.txt'),context);
 return {context,setMissing:()=>available=false,setRows:value=>source=value,reference:{getSheetByName:()=>({clear(){written.push('clear');},getRange(){return {setValues:values=>written.push(values)};}})},written};
}
test('훈련 후보와 기준 명단 갱신은 스프레드시트의 실제 명단 탭을 읽는다',()=>{
 const f=serverFixture(),candidates=f.context.trainV473DutyCandidates_();assert.equal(candidates.length,6);assert.equal(candidates[1].cohort,'76');assert.equal(candidates[1].company,'2');
 f.context.trainV473SyncRegularCandidates_(f.reference);assert.equal(f.written[2][1][0],'guide');
 f.setMissing();assert.throws(()=>f.context.trainV473DutyCandidates_(),/기준 시트/);
});
test('75·76·77·78기 중 3학년인 76기만 지도생도로 검색하며 동명이인을 보존한다',()=>{
 const {context}=serverFixture();assert.deepEqual(Array.from(context.trainV473GuideCandidates_(),p=>p.id),['guide','other','duplicate']);
});
test('빈 일반학기 명단으로 갱신할 때 기존 훈련 참조 명단을 지우지 않는다',()=>{
 const f=serverFixture();f.setRows([]);assert.throws(()=>f.context.trainV473SyncRegularCandidates_(f.reference),/기존 참조 명단을 유지/);assert.equal(f.written.length,0);
});
function clientFixture(){
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,innerHTML:'',textContent:'',style:{},classList:{toggle(){}},closest(){return this;},setAttribute(){},showModal(){this.open=true;}});return nodes.get(id);};
 const requests=[],context=vm.createContext({$:node,server:async name=>{requests.push(name);return name==='getTrainingGuideCandidatesV483'?rows.filter(p=>p.cohort.startsWith('76')).map(p=>({...p,cohort:'76',company:p.company.replace('２','2').replace('중대','')})):rows;},toast(){},escapeH:String,view:'trainPersonnel'});
 const source=read('scripts/training-management-client.js.txt');vm.runInContext(source.slice(0,source.indexOf('function trainV473Init(){')),context);vm.runInContext('trainStateV473.canManage=true;',context);
 return {context,node,requests};
}
test('지도생도 이름 한 명 일치 시 자동 입력하고 동명이인일 때만 선택을 요구한다',async()=>{
 const {context,node,requests}=clientFixture();node('trainPersonTypeV473').value='지도생도';node('trainPersonNameV473').value='지도예시';
 await context.trainV473LoadGuideCandidatesV483();assert.deepEqual(requests,['getTrainingGuideCandidatesV483']);assert.equal(node('trainPersonRegularIdV487').value,'guide');assert.equal(node('trainPersonCohortV473').value,'76');assert.equal(node('trainPersonRegularCompanyV473').value,'2');assert.equal(node('trainPersonDuplicateWrapV487').hidden,true);
 node('trainPersonNameV473').value='동명예시';context.trainV473GuideNameLookupV481();assert.equal(node('trainPersonRegularIdV487').value,'');assert.equal(node('trainPersonDuplicateWrapV487').hidden,false);assert.match(node('trainPersonDuplicatePickV487').innerHTML,/7602/);assert.match(node('trainPersonDuplicatePickV487').innerHTML,/7603/);
});
test('대대본부 직책 입력창도 브라우저 toggle 이벤트 없이 일반학기 명단을 불러온다',async()=>{
 const {context,requests}=clientFixture();context.trainV473OpenPerson('',{type:'대대군수참모생도',unit:'대대본부'});await new Promise(r=>setTimeout(r,0));assert.ok(requests.includes('getTrainingDutyCandidatesV487'));
});
