import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function fixture(){
 const cfg={trainingId:'current',cohort:'79',status:'진행 중'};
 const me={id:'guide',trainingId:'current',type:'지도생도',unit:'2',email:'guide@example.com',active:'예'};
 const people=[me,{id:'mine',trainingId:'current',type:'예비생도',unit:'2',instructorId:'guide',active:'예',name:'담당'},{id:'other',trainingId:'current',type:'예비생도',unit:'2',instructorId:'other-guide',active:'예'},{id:'old',trainingId:'old',type:'예비생도',unit:'2',instructorId:'guide',active:'예'},{id:'wrong-unit',trainingId:'current',type:'예비생도',unit:'3',instructorId:'guide',active:'예'}];
 const assets=people.map(p=>({id:'a-'+p.id,trainingId:p.trainingId,personId:p.id,kind:'피복',itemName:'상의'}));
 const requests=[{id:'r1',trainingId:'current',personId:'mine',requestedBy:me.email},{id:'r2',trainingId:'current',personId:'other',requestedBy:me.email},{id:'r3',trainingId:'current',personId:'mine',requestedBy:'other@example.com'}];
 const context=vm.createContext({getSaberV276:()=>{},config_:()=>({email:'guide@example.com'}),fullEditorsV281_:()=>[]});
 vm.runInContext(read('scripts/training-management-server.gs.txt'),context);
 context.trainV473Book_=()=>({});
 context.trainV473Config_=()=>cfg;
 context.trainV473Rows_=(_ss,name)=>name==='훈련인원_v2'?people:name==='훈련물품현황_v2'?assets:name==='훈련수정요청_v2'?requests:[];
 return {context,people,me,cfg};
}
test('지도생도 앱은 같은 훈련·같은 중대·본인 담당 인원과 요청만 반환한다',()=>{
 const {context}=fixture(),result=context.getInstructorWorkspaceV489();
 assert.deepEqual(Array.from(result.people,p=>p.id),['mine']);
 assert.deepEqual(Array.from(result.assets,a=>a.id),['a-mine']);
 assert.deepEqual(Array.from(result.requests,r=>r.id),['r1']);
 assert.equal(result.bookUrl,undefined);
});
test('인증 이메일 변경·삭제·다른 직책은 유지 세션이 있어도 지도생도 앱 접근을 거절한다',()=>{
 for(const mutate of [p=>p.email='new@example.com',p=>p.active='아니요',p=>p.type='중대장생도']){
  const {context,me}=fixture();mutate(me);assert.throws(()=>context.getInstructorWorkspaceV489());
 }
});
test('앱 요청은 기존 승인 절차로 전달하고 외부 물품 ID를 그대로 사용하지 않는다',()=>{
 const {context}=fixture();let got;context.submitTrainingRequestV473=x=>(got=x,{status:'대기'});
 const result=context.submitInstructorRequestV489({personId:'mine',assetId:'other-asset',kind:'피복'});
 assert.equal(got.assetId,'');assert.equal(result.status,'대기');
});
test('임시 접속은 지도생도를 선택하고 담당 인원만 반환하며 일반 권한을 남기지 않는다',()=>{
 const {context,me}=fixture();
 const list=context.trainV490Temporary_('list');assert.equal(list.length,1);assert.equal(list[0].email,undefined);assert.equal(list[0].phone,undefined);
 assert.deepEqual(Array.from(context.trainV490Temporary_('get','guide').people,p=>p.id),['mine']);
 assert.throws(()=>context.trainV490Temporary_('get','other'));
 assert.throws(()=>context.trainV490Temporary_('resolve','guide'));
 me.active='아니요';assert.throws(()=>context.trainV490Temporary_('get','guide'));
 assert.throws(()=>context.getInstructorWorkspaceV489());
});
test('임시 접속 수정 요청도 담당 인원 검증과 관리자 승인 경로를 유지한다',()=>{
 const {context}=fixture();let actor;
 context.submitTrainingRequestV473=input=>{actor=context.trainV473Actor_();assert.equal(input.assetId,'');return {status:'대기'};};
 assert.equal(context.trainV490Temporary_('submit','guide',{assetId:'fake'}).status,'대기');
 assert.equal(actor.manager,false);assert.equal(actor.email,'temporary:guide');
 assert.equal(context.trainV473Actor_().email,'guide@example.com');
});
test('별도 앱의 생성 파일과 조회·요청 API가 연결된다',()=>{
 assert.doesNotThrow(()=>new Function(read('scripts/instructor-portal.js')));
 const methods=JSON.parse(read('apps-script/methods.json'));
 for(const name of ['getInstructorWorkspaceV489','submitInstructorRequestV489'])assert.ok(methods.includes(name),name);
 assert.match(read('docs/instructor.html'),/instructor.js\?v=/);
 assert.match(read('scripts/instructor-portal.js'),/logbook.instructor.session.v1/);
});
