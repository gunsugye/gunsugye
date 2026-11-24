import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../scripts/survey-forms-server.gs.txt',import.meta.url),'utf8');
function context(extra={}){const c=vm.createContext({surveyKindV416_:kind=>{if(!['firearm','uniform','asset','duty'].includes(kind))throw Error('kind');return kind;},...extra});vm.runInContext(source,c);return c;}
test('전수조사별 문항은 품목 기준을 사용하고 세부사항은 선택 입력이다',()=>{
 const c=context({UNIFORM_V278:{ITEMS:['전투화','단화']},ROOM_ASSET_V244:{CATALOG:'catalog'},assetV244Catalog_:()=>[{name:'책상'}]});
 for(const kind of ['firearm','uniform','asset','duty']){const fields=c.surveyFormFieldsV566_(kind,{getSheetByName:()=>({})});assert.ok(fields.length);assert.ok(fields.filter(f=>f.title.includes('세부사항')).every(f=>f.required===false));}
 assert.ok(c.surveyFormFieldsV566_('duty',{}).some(f=>f.title==='아크릴판 · 수량'&&f.options.includes('해당 없음')));
 assert.ok(c.surveyFormFieldsV566_('uniform',{}).some(f=>f.title==='전투화 · 사이즈'));
 assert.throws(()=>c.surveyFormFieldsV566_('unknown',{}));
});
test('동일 조사 폼은 재사용하고 마감 후 생성은 거부한다',()=>{
 let mode='direct',created=0;const meta={ready:true,id:'form',kind:'duty',campaignId:'survey',closed:false,title:'조사',endsAt:'2099-01-01'};
 const c=context({assetRequestAdminV336_(){},supplyFormCreateRunV548_:fn=>fn(),surveyPolicyV416_:()=>({id:'survey',label:'조사',endsAt:'2099-01-01',mode}),PropertiesService:{getScriptProperties:()=>({getProperty:()=>JSON.stringify(meta)})},FormApp:{create:()=>created++},ScriptApp:{getProjectTriggers:()=>[{getHandlerFunction:()=> 'pagesSurveyFormsClose_'}]}});
 assert.equal(c.createSurveyFormV566('duty').id,'form');assert.equal(created,0);mode='request';assert.throws(()=>c.createSurveyFormV566('duty'),/기간/);
});
test('폼 제목·종료일을 갱신하고 지난 조사와 종료된 조사는 닫는다',()=>{
 const stored=new Map(),calls=[],meta={ready:true,id:'form',kind:'firearm',campaignId:'old',closed:false,title:'이전',endsAt:'2099-01-01'};
 const c=context({PropertiesService:{getScriptProperties:()=>({getProperties:()=>Object.fromEntries(stored),setProperty:(k,v)=>stored.set(k,v)})},FormApp:{openById:()=>({setTitle:v=>calls.push(['title',v]),setAcceptingResponses:v=>calls.push(['open',v])})},surveyPolicyV416_:()=>({id:'new',label:'새 조사',endsAt:'2099-03-01',mode:'direct'})});
 c.surveyFormSyncV566_(meta,{id:'old',label:'변경',endsAt:'2099-02-01',mode:'direct'});assert.ok(calls.some(v=>v[0]==='title'&&v[1]==='변경'));
 c.surveyFormsCloseV566_();assert.equal(calls.at(-1)[1],false);assert.equal(JSON.parse([...stored.values()][0]).closed,true);
});
test('기간 저장 후 폼 동기화 실패는 저장 성공과 재시도 안내를 함께 반환한다',()=>{
 const c=context({surveyPeriodSetBaseV566_:()=>({id:'survey',mode:'request'}),PropertiesService:{getScriptProperties:()=>({getProperty:()=>JSON.stringify({ready:true,kind:'duty',id:'form'})})},FormApp:{openById:()=>{throw Error('network');}}});
 const result=c.setSurveyPeriodV416('duty',{enabled:false});assert.equal(result.mode,'request');assert.match(result.formWarning,/자동 재시도/);
});
test('생성 API와 종료 트리거가 배포 코드에 연결된다',()=>{
 const built=readFileSync(new URL('../apps-script/Legacy.gs',import.meta.url),'utf8'),methods=JSON.parse(readFileSync(new URL('../apps-script/methods.json',import.meta.url),'utf8'));
 assert.ok(built.includes('surveyFormsClose: function()'));assert.ok(JSON.stringify(methods).includes('createSurveyFormV566'));assert.ok(JSON.stringify(methods).includes('getSurveyFormV566'));
});
