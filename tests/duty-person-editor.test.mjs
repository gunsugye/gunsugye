import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {dutyPersonKeyV398,dutyPersonCandidatesV398,dutyPersonSearchV398} from '../scripts/duty-person-editor.mjs';
import {dutyOrgKeyV372} from '../scripts/duty-order.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const plan=()=>({rooms:[{building:'본관',floor:'1층',room:'132-1',members:[{cohort:'75기',company:'1중대',name:'검증갑'},{cohort:'76',company:'5',name:'검증갑'},{cohort:'77',company:'3',name:'검증을'},{cohort:'78',company:'8',name:'스마트누락'}]}],comparison:{missingRoom:[{cohort:'78',company:'7',name:'미배정'}],missingSmart:[{cohort:'78',company:'8',name:'스마트누락'}]}});

test('스마트당직·현재 방 배정의 인적사항을 연결하고 기준 밖 인원과 잘못된 식별자는 제외한다',()=>{
 const data=plan();data.rooms.push({...data.rooms[0]});data.rooms[0].members.push({name:'기수미확인',company:'2'});
 const before=JSON.stringify(data),rows=dutyPersonCandidatesV398(data);assert.equal(JSON.stringify(data),before);
 assert.equal(rows.length,4);assert.ok(!rows.some(p=>p.name==='스마트누락'||p.name==='기수미확인'));
 const first=rows.find(p=>p.cohort==='75');assert.equal(first.company,'1');assert.equal(first.room,'132-1');assert.equal(first.gradeOverride,'4');assert.equal(first.battalionOverride,'1');
 assert.equal(rows.find(p=>p.company==='5').battalionOverride,'2');assert.equal(rows.find(p=>p.company==='5').gradeOverride,'3');
 const missing=rows.find(p=>p.name==='미배정');assert.equal(missing.assigned,false);assert.equal(missing.room,'');assert.equal(missing.battalionOverride,'2');
 assert.throws(()=>dutyPersonCandidatesV398({...data,comparison:{error:'스마트 연결 실패'}}),/스마트 연결 실패/);
});

test('이름 검색은 동명이인·영문 구분자를 보존하고 부분 검색을 자동 확정하지 않는다',()=>{
 const people=dutyPersonCandidatesV398(plan());let result=dutyPersonSearchV398('검증갑',people);assert.equal(result.exact,true);assert.equal(result.rows.length,2);assert.notEqual(dutyPersonKeyV398(result.rows[0]),dutyPersonKeyV398(result.rows[1]));
 result=dutyPersonSearchV398('검증',people);assert.equal(result.exact,false);assert.equal(result.rows.length,3);
 assert.equal(dutyPersonSearchV398('없는이름',people).rows.length,0);
 const aliases=[{name:'검증갑A'},{name:'검증갑B'}];assert.equal(dutyPersonSearchV398('검증갑',aliases).rows.length,2);assert.equal(dutyPersonSearchV398('검증갑A',aliases).rows.length,1);
});

function fixture(server=async()=>plan()){
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,required:false,readOnly:false,style:{},tagName:'INPUT',events:{},addEventListener(event,fn){this.events[event]=fn;},setAttribute(){},after(){},closest(){return this.label||(this.label={hidden:false,style:{},after(){}});}});return nodes.get(id);};
 const fields={};for(const key of ['name','cohort','company','building','floor','room','gradeOverride','battalionOverride','duty','organization','dutyCompanyOverride','familyOverride'])fields[key]=node('field:'+key);
 fields.gradeOverride.tagName=fields.battalionOverride.tagName=fields.familyOverride.tagName='SELECT';
 const form=node('dutyFormV367');form.elements=fields;form.querySelector=()=>node('heading');
 const dialog={open:true,addEventListener(type,fn){this[type]=fn;}},calls=[],context=vm.createContext({$:node,document:{createElement:()=>node('created:'+nodes.size)},dutyDialogV367:dialog,dutyEditRowV367:null,dutySavingV367:false,dutyPersonKeyV398,dutyPersonCandidatesV398,dutyPersonSearchV398,dutyOrgKeyV372,dutyOrgLabelV372:s=>s,dutyAssignmentLabelV372:node('assignment-label'),dutyFamilyLabelV372:node('family-label'),dutySyncFixedRoleV391(){},escapeH:s=>String(s).replaceAll('<','&lt;').replaceAll('"','&quot;'),server:async(...args)=>{calls.push(args);return server(...args);},setTimeout,clearTimeout});
 vm.runInContext(read('scripts/duty-person-editor-client.js.txt'),context);
 const open=async person=>{context.dutyEditRowV367=person||null;for(const [key,field]of Object.entries(fields))field.value=person?.[key]||'';context.LOGBOOK_DUTY_EDITOR.open(person);await tick();};
 const type=async name=>{fields.name.value=name;fields.name.events.input();vm.runInContext('clearTimeout(dutyPersonTimerV398);dutyPersonSearchFormV398();',context);await tick();};
 return {context,fields,node,dialog,calls,open,type};
}

test('이름 한 명 일치는 자동 입력하고 동명이인은 기수·중대 체크박스로 한 명만 선택한다',async()=>{
 const h=fixture();await h.open(null);await h.type('검증을');assert.equal(h.fields.cohort.value,'77');assert.equal(h.fields.company.value,'3');assert.equal(h.fields.building.value,'본관');assert.equal(h.fields.floor.value,'1층');assert.equal(h.fields.room.value,'132-1');assert.equal(h.fields.gradeOverride.value,'2');assert.equal(h.fields.battalionOverride.value,'1');assert.equal(h.context.LOGBOOK_DUTY_EDITOR.beforeSubmit(),true);
 await h.type('검증갑');assert.equal(h.fields.cohort.value,'');assert.equal(h.context.LOGBOOK_DUTY_EDITOR.beforeSubmit(),false);
 assert.match(h.node('dutyPersonChoicesV398').innerHTML,/75기 1중대 검증갑/);assert.match(h.node('dutyPersonChoicesV398').innerHTML,/76기 5중대 검증갑/);assert.match(h.node('dutyPersonChoicesV398').innerHTML,/type="checkbox"/);
 h.node('dutyPersonChoicesV398').events.change({target:{dataset:{dutyPerson:'1'},checked:true}});assert.equal(h.fields.cohort.value,'76');assert.equal(h.fields.company.value,'5');assert.equal(h.fields.battalionOverride.value,'2');assert.equal(h.context.LOGBOOK_DUTY_EDITOR.beforeSubmit(),true);
 const patch={};h.context.LOGBOOK_DUTY_EDITOR.patch(patch);assert.equal(patch.cohort,'76');assert.equal(patch.gradeOverride,'3');assert.equal((h.node('dutyPersonChoicesV398').innerHTML.match(/ checked/g)||[]).length,1);
 await h.type('없는이름');assert.equal(h.fields.room.value,'');assert.equal(h.context.LOGBOOK_DUTY_EDITOR.beforeSubmit(),false);
});

test('기타 외 근무 수정은 근무·소속·계열을 고정하고 기타와 신규 추가는 편집할 수 있다',async()=>{
 const h=fixture(),person={name:'검증을',cohort:'77',company:'3',organization:'중대',duty:'교육보좌관',dutyCompanyOverride:'3',familyOverride:'작전'};await h.open(person);
 assert.equal(h.fields.duty.disabled,true);assert.equal(h.fields.duty.closest('label').hidden,true);assert.equal(h.node('dutyAssignmentV372').disabled,true);
 const patch={duty:'변조',organization:'기타',dutyCompanyOverride:'8',familyOverride:'군수'};h.context.LOGBOOK_DUTY_EDITOR.patch(patch);assert.equal(patch.duty,'교육보좌관');assert.equal(patch.organization,'중대');assert.equal(patch.dutyCompanyOverride,'3');assert.equal(patch.familyOverride,'작전');
 await h.open({...person,organization:'기타',duty:'별도 근무'});assert.equal(h.fields.duty.disabled,false);assert.equal(h.context.LOGBOOK_DUTY_EDITOR.locked(),false);
 await h.open(null);assert.equal(h.node('dutyAssignmentV372').disabled,false);assert.equal(h.context.LOGBOOK_DUTY_EDITOR.locked(),false);
});

test('다른 편집창을 열거나 이름을 바꾸면 늦은 조회 결과가 이전 인원을 덮어쓰지 않는다',async()=>{
 const pending=[];const h=fixture(()=>new Promise(resolve=>pending.push(resolve)));
 await h.open(null);assert.equal(h.context.LOGBOOK_DUTY_EDITOR.beforeSubmit(),false);await h.open(null);await h.type('검증을');
 pending[0]({...plan(),rooms:[]});await tick();assert.equal(h.fields.cohort.value,'');
 pending[1](plan());await tick();assert.equal(h.fields.cohort.value,'77');
 await h.type('검증갑');assert.equal(h.fields.cohort.value,'');h.dialog.close();assert.equal(h.context.LOGBOOK_DUTY_EDITOR.beforeSubmit(),false);
});

test('앱 제출 경로는 고정 근무 보존과 자동 입력 검증을 저장 전에 호출한다',()=>{
 const app=read('docs/assets/app.js');assert.match(app,/if\(dutySavingV367\|\|!globalThis\.LOGBOOK_DUTY_EDITOR\.beforeSubmit\(e.target\)\)return/);
 assert.match(app,/if\(!globalThis\.LOGBOOK_DUTY_EDITOR\.locked\(\)\)dutyApplyOrgFormV372\(patch\);globalThis\.LOGBOOK_DUTY_EDITOR\.patch\(patch\);await enqueue/);
 assert.ok(read('scripts/build.mjs').includes("dutyPersonEditorJsV398(js,read('scripts/duty-person-editor-client.js.txt'))"));
});
