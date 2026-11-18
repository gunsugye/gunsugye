import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {canonicalConditionV497,conditionTextV497,conditionServerV497} from '../scripts/condition-states.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('기존 교체 필요와 사용불가 표기는 같은 공식 상태로 변환한다',()=>{
 for(const value of ['교체 필요','교체필요','사용불가','사용 불가',' 사용  불가 '])assert.equal(canonicalConditionV497(value),'사용 불가');
 for(const value of ['수리 필요','수리 필요(보고)','수리필요(미보고)'])assert.equal(canonicalConditionV497(value),'수리 필요');
 assert.equal(canonicalConditionV497('정상'),'정상');assert.equal(canonicalConditionV497('위탁'),'위탁');
});
test('군수품 선택지는 상태 값과 표시가 일치하며 수리 필요와 사용 불가가 한 번씩 나온다',()=>{
 const source=read('docs/assets/app.js'),fn=source.split('\n').find(line=>line.startsWith('function supplyStatusHTML('));
 const context=vm.createContext({escapeH:String});vm.runInContext(fn,context);
 const html=context.supplyStatusHTML('사용 불가');
 assert.equal((html.match(/value="수리 필요"/g)||[]).length,1);assert.equal((html.match(/value="사용 불가"/g)||[]).length,1);
 assert.match(html,/<option value="사용 불가" selected>사용 불가<\/option>/);
 assert.doesNotMatch(html,/교체 필요/);
});
test('서버에서 읽은 상태만 정규화하고 세부사항·이름과 검증 토큰은 보존한다',()=>{
 let output;const context=vm.createContext({ContentService:{createTextOutput:s=>{output=s;return {setMimeType(){}};},MimeType:{JSON:'json'}}});
 vm.runInContext(read('apps-script/Gateway.gs'),context);
 context.pagesJson_({ok:true,result:{status:'교체필요',firearmStatus:'사용불가',detail:'교체필요 부품 설명',snapshot:'old-token',slots:[{status:'수리 필요(보고)'}]}});
 const data=JSON.parse(output).result;assert.equal(data.status,'사용 불가');assert.equal(data.firearmStatus,'사용 불가');assert.equal(data.slots[0].status,'수리 필요');assert.equal(data.detail,'교체필요 부품 설명');assert.equal(data.snapshot,'old-token');
});
test('서버의 저장 검증은 과거 명칭도 받아 사용 불가로 통일한다',()=>{
 const source=conditionServerV497("const REPAIR_STATES_V216 = Object.freeze(['정상','수리 필요','교체 필요']);\nfunction canonicalRepairStateV216_(value){\n return value;\n}"),fn=source.match(/function canonicalRepairStateV216_\(value\)\{[\s\S]*?\n\}/)?.[0];assert.ok(fn);
 const context=vm.createContext({});vm.runInContext(fn,context);
 assert.equal(context.canonicalRepairStateV216_('교체 필요'),'사용 불가');assert.equal(context.canonicalRepairStateV216_('사용불가'),'사용 불가');
 assert.match(source,/REPAIR_STATES_V216 = Object.freeze\(\['정상','수리 필요','사용 불가'\]\)/);
});
test('개인·지도생도 앱과 정적 선택지에도 과거 상태명이나 중복 선택지가 남지 않는다',()=>{
 for(const path of ['docs/assets/app.js','docs/index.html','docs/me/portal.js','docs/me/index.html','docs/instructor.html','docs/assets/instructor.js']){
  const source=read(path);assert.doesNotMatch(source,/교체 필요/,path);assert.doesNotMatch(source,/<option[^>]*>수리 필요<\/option><option[^>]*>수리 필요<\/option>/,path);
 }
 const tuple="[['정상','정상'],['수리 필요','수리 필요'],['수리 필요','수리 필요']]";
 assert.equal(conditionTextV497(tuple),"[['정상','정상'],['수리 필요','수리 필요'],['사용 불가','사용 불가']]");
 assert.match(read('docs/me/portal.js'),/text.includes\('사용불가'\)/);
});
