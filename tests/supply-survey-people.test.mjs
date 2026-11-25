import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const c=vm.createContext({});vm.runInContext(readFileSync(new URL('../scripts/supply-survey-people.gs.txt',import.meta.url),'utf8'),c);
const person={id:'p',cohort:'77기',company:'2중대',name:'홍길동',cadetNumber:'001'},items=[{id:'a',name:'모포'},{id:'b',name:'방탄모'}];
const row=(id,itemId,createdAt,requester=person,personId='p')=>({id,itemId,createdAt,requester,personId});
test('여러 품목·중복 명단·재제출을 4개 신원정보로 한 명에 묶고 품목별 최신 값을 선택한다',()=>{
 const other={...person,id:'duplicate',cohort:'７７기기',company:'２중대중대'};
 const out=c.supplySurveyPeopleV567_([row('old','a','2026-11-24'),row('b','b','2026-11-25',other,'duplicate'),row('new','a','2026-11-25')],[person,other],items);
 assert.equal(out.responded,1);assert.equal(out.activePeople,1);assert.equal(out.confirmedItems,2);assert.equal(out.responsePeople[0].records.length,3);assert.equal(out.responsePeople[0].items.find(r=>r.itemId==='a').id,'new');assert.equal(out.missing.length,0);
});
test('동명이인·다른 교번은 합치지 않으며 교번의 앞자리 0을 보존한다',()=>{
 const out=c.supplySurveyPeopleV567_([row('a','a','2026-11-25'),row('b','a','2026-11-25',{...person,cadetNumber:'1'},'other')],[person],items);assert.equal(out.responded,2);
});
test('이전 응답의 누락 교번은 명단ID로 보완하고 신원불명 응답은 임의로 합치지 않는다',()=>{
 const legacy={cohort:'77',company:'2',name:'홍길동'};
 const out=c.supplySurveyPeopleV567_([row('a','a','2026-11-25',legacy),row('b','b','2026-11-25')],[person],items);assert.equal(out.responded,1);
 const unknown=c.supplySurveyPeopleV567_([row('x','a','',legacy,'x'),row('y','a','',legacy,'y')],[],items);assert.equal(unknown.responded,2);
});
