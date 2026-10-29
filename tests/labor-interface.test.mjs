import test from 'node:test';import assert from 'node:assert/strict';
import {distributionExplanation} from '../scripts/labor-interface.mjs';
import {readFileSync,existsSync} from 'node:fs';import vm from 'node:vm';

test('사역 생활실 조회는 관리 화면의 최신 호실·명단을 읽고 별도 파일로 되돌아가지 않는다',{skip:!existsSync(new URL('../apps-script/Legacy.gs',import.meta.url))},()=>{
 const source=readFileSync(new URL('../apps-script/Legacy.gs',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('function laborLivingV262_(){'),source.indexOf('/** 읽기 전용 점검:',source.indexOf('function laborLivingV262_(){')));
 const sheet={getSheetId:()=>9},book={getUrl:()=> 'main'},rooms=[{id:'132',room:'132-1'}];
 let roster=[{roomId:'132',name:'테스트'}];
 const context=vm.createContext({spreadsheet_:()=>book,dormTabV234_:(ss,create)=>{assert.equal(ss,book);assert.equal(create,false);return sheet;},dormReadV234_:()=>rooms,dormRosterReadV240_:ss=>{assert.equal(ss,book);return roster;},SpreadsheetApp:{openById:()=>{throw Error('별도 파일 조회 금지');}}});
 vm.runInContext(fn,context);
 assert.equal(context.laborLivingV262_().roster,roster);
 roster=[{roomId:'156',name:'변경배정'}];rooms[0]={id:'156',room:'156-2'};
 const next=context.laborLivingV262_();assert.equal(next.roster,roster);assert.equal(next.rooms[0].room,'156-2');assert.equal(next.url,'main#gid=9');
 rooms.length=0;assert.throws(()=>context.laborLivingV262_(),/등록된 호실이 없습니다/);
});
test('분배 설명은 반 개와 온전한 개수를 구분하고 소수 수량을 올림 지급으로 바꾸지 않는다',()=>{
 assert.equal(distributionExplanation({full:2,remainder:1},2),'1명 · 0.5개');
 assert.equal(distributionExplanation({full:3,remainder:0},2),'—');
 assert.equal(distributionExplanation({full:0,remainder:0},2),'—');
 assert.equal(distributionExplanation({full:0,remainder:1},2),'1명 · 0.5개');
 assert.match(distributionExplanation({full:1,remainder:2},3),/약 0\.667개/);
});

test('사역 스마트 명단은 전각·기수·유일한 이름을 대조하고 별도 위탁 명단을 적용한다',{skip:!existsSync(new URL('../Code.gs.txt',import.meta.url))},()=>{
 const source=readFileSync(new URL('../Code.gs.txt',import.meta.url),'utf8');
 const helpers=source.slice(source.indexOf('function laborUnitV259_'),source.indexOf('/** v2.64 · 예전 단순',source.indexOf('function laborUnitV259_')));
 const people=[{cohort:'77기',company:'4',name:'테스트갑',duty:''},{cohort:'76기',company:'7',name:'테스트을',duty:''},{cohort:'76기',company:'8',name:'테스트병',duty:''},{cohort:'77기',company:'3',name:'테스트정A',duty:''}];
 const roster=[{cohort:'77',company:'４',name:'테스트갑'},{cohort:'76',company:'７',name:'테스트을'},{cohort:'77',company:'3',name:'테스트정'}];
 const context=vm.createContext({smartConfiguredV255_:()=>({}),PropertiesService:{getScriptProperties:()=>({getProperty:()=>''})},SMART_V253:{SOURCE_PROP:'source'},smartSnapshotV253_:()=>people,dormRosterReadV240_:()=>roster,smartAllStatusHintsV323_:()=>({rows:[{company:'8',status:'위탁',preview:[{value:'테스트병'}]}],readOk:true})});
 vm.runInContext(readFileSync(new URL('../scripts/smart-inactive.gs.txt',import.meta.url),'utf8').split('function smartAllStatusHintsV323_')[0]+'\n'+helpers,context);
 const result=context.laborSmartV259_({});
 for(const p of roster)assert.ok(result.byKey.has(context.laborPersonKeyV259_(p)));
 const absent=result.people.find(p=>p.name==='테스트병');assert.ok(context.laborAbsentAllV259_(absent.duty));assert.ok(context.laborAbsentNowV259_(absent.duty));
 assert.equal(people[2].duty,'');assert.equal(people[3].name,'테스트정A');
 context.smartAllStatusHintsV323_=()=>({error:true,warning:'상태 조회 실패'});assert.throws(()=>context.laborSmartV259_({}),/상태 조회 실패/);
});
