import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {trainingCapacitySummaryV473,trainingManagementViewsV473} from '../scripts/training-management.mjs';
import {trainingGroups,trainingShellJs} from '../scripts/training-shell.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('성무훈련 메뉴는 새 관리 흐름과 기존 일지만 남긴다',()=>{
 const ids=trainingGroups.flatMap(group=>group.items.map(item=>item[0]));
 assert.deepEqual(ids,['trainJournal','trainCalendar','train','trainPersonnel','trainSupply','trainSupplyRequests','trainUniform','trainUniformRequests','trainSaber','trainHandoff']);
 for(const removed of ['trainMeal','trainEquipment','trainRooms','trainRoomAssets','trainAssetRequests','trainRoster','trainRepairs','trainSurveys'])assert.equal(ids.includes(removed),false);
 assert.deepEqual(trainingManagementViewsV473,ids);
});

test('성무기초군사훈련 선택은 최초 생성 화면인 훈련 현황을 연다',()=>{
 const base="querySelectorAll('[data-train-nav]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.trainNav==='train'?'trainJournal':'today')));";
 assert.match(trainingShellJs(base),/dataset\.trainNav==='train'\?'train':'today'/);
});

test('지도생도별 기본 정원 8명과 초과 상태를 따로 계산한다',()=>{
 const people=[{id:'leader-a',type:'지도생도',unit:'1',name:'지도A',active:'예'},{id:'leader-b',type:'지도생도',unit:'2',name:'지도B',active:'예'}];
 for(let i=0;i<9;i++)people.push({id:'r'+i,type:'예비생도',instructorId:'leader-a',active:'예'});
 for(let i=0;i<8;i++)people.push({id:'s'+i,type:'예비생도',instructorId:'leader-b',active:'예'});
 assert.deepEqual(trainingCapacitySummaryV473(people,8),[
  {id:'leader-a',unit:'1',name:'지도A',count:9,capacity:8,over:true},
  {id:'leader-b',unit:'2',name:'지도B',count:8,capacity:8,over:false}
 ]);
});

test('새 훈련 서버는 기존 일지를 지우지 않고 요청·예도·이관 차단 규칙을 포함한다',()=>{
 const source=read('scripts/training-management-server.gs.txt');
 assert.doesNotThrow(()=>new Function(source));
 assert.equal(/deleteSheet|clearContents\s*\(/.test(source),false);
 assert.match(source,/legacyPreserved:true,journalPreserved:true/);
 assert.match(source,/person\.instructorId!==actor\.person\.id/);
 assert.match(source,/미처리 수정 요청/);
 assert.match(source,/미반납 예도/);
 assert.match(source,/담당 정원 초과/);
 assert.match(source,/일반학기 중대 미입력/);
 assert.match(source,/sourceRoleId/);
 assert.match(source,/expectedSnapshot!==p\.snapshot/);
 assert.match(source,/일반학기 피복 사이즈 충돌/);
 assert.match(source,/function startNewTrainingCycleV473\(\)/);
 assert.match(source,/old\.status!==['"]이관완료['"]/);
 assert.match(source,/previousTrainingId/);
 assert.match(source,/대대작전참모생도/);
 assert.match(source,/대대인사참모생도/);
 assert.match(source,/대대체육참모생도/);
 assert.match(source,/TRAIN_V473_FIXED_POSTS/);
 assert.match(source,/trainV473RegularCandidates_/);
});

test('생성 화면은 담당자 요청과 대대군수참모 처리 API를 모두 연결한다',()=>{
 const html=read('docs/index.html'),client=read('scripts/training-management-client.js.txt'),methods=JSON.parse(read('apps-script/methods.json'));
 assert.doesNotThrow(()=>new Function(client));
 for(const id of ['trainDashboardV473','trainOrgV473','trainSupplyRowsV473','trainUniformRowsV473','trainSaberRowsV473','trainHandoffResultV473'])assert.match(html,new RegExp(`id="${id}"`));
 for(const method of ['startNewTrainingCycleV473','getTrainingWorkspaceV473','submitTrainingRequestV473','resolveTrainingRequestV473','saveTrainingSaberLoanV473','previewTrainingHandoffV473','applyTrainingHandoffV473'])assert.ok(methods.includes(method),method);
 assert.match(read('scripts/training-management.mjs'),/trainingScopeV473=true/);
 assert.match(client,/trainPersonRegularPickV473/);
 assert.match(client,/trainFixedPostsV477/);
});

