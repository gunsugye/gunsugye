import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {dormPdfPeopleV365,dormPdfNamesV343} from '../scripts/dorm-members.mjs';import {dormPdfDutyRegionV365,dutyCadetRowsV365} from '../scripts/duty-cadets.mjs';
test('두 줄과 여러 토큰의 괄호 근무를 위 이름에 연결하고 다음 이름과 구분한다',()=>{
 const t=(str,y,x=10)=>({str,y,x}),tokens=[t('검증갑',10),t('(',20),t('전대군수',20,15),t('참모',30),t(')',30,30),t('검증을',45),t('(근무)',55)];
 const people=dormPdfPeopleV365(tokens,2);assert.deepEqual(people,[{name:'검증갑',isDuty:true,duty:'전대군수참모'},{name:'검증을',isDuty:true,duty:'근무'}]);assert.deepEqual(dormPdfNamesV343(tokens,2),['검증갑','검증을']);
 assert.equal(dormPdfPeopleV365([t('검증갑',10),t('(군수',20),t('참모',30)],2)[0].dutyReview,true);
 assert.equal(dormPdfPeopleV365([t('검증갑',10),t('()',20)],2)[0].isDuty,true);
 assert.equal(dormPdfPeopleV365([t('검증갑',10),t('검증을',30),t('(근무)',40)],2)[0].isDuty,false);
});
test('PDF 원본 호실 범위로 판독해 옆 방 근무 표시와 이동 후 좌표를 섞지 않는다',()=>{
 const t=(str,x,y,width=20)=>({str,x,y,width,height:10}),tokens=[t('132-1',20,110),t('검증갑',20,140),t('(군수',20,155),t('참모)',20,165),t('133-1',80,110),t('(다른근무)',80,150)];
 const boxes=[{x:10,y:100,width:50,height:120},{x:70,y:100,width:50,height:120}],region=dormPdfDutyRegionV365(tokens,boxes,'132-1');assert.equal(dormPdfPeopleV365(region,2)[0].duty,'군수참모');assert.ok(!region.some(t=>t.str.includes('다른')));assert.equal(dormPdfDutyRegionV365(tokens,boxes,'999-1'),null);
});
test('근무생도 명단은 현재 배정과 대조하고 동명이인·미배정은 확인 대상으로 남긴다',()=>{
 const anchor={building:'정예 본관',floor:'1층',room:'132-1',sourceRoom:'132-1',roomId:'a',page:2,pdfMembers:[{name:'검증갑',cohort:'77',company:'1'}]},people=[{name:'검증갑',isDuty:true,duty:'군수참모'},{name:'검증을',isDuty:true,duty:'당직'}];
 const rooms=[{id:'b',building:'정예 동관',floor:'2층',room:'220-1',members:[{name:'검증갑',cohort:'77기',company:'1중대'}]},{id:'c',building:'정예 서관',floor:'1층',room:'101',members:[{name:'검증을',cohort:'77',company:'1'}]},{id:'d',building:'정예 서관',floor:'2층',room:'201',members:[{name:'검증을',cohort:'76',company:'1'}]}];
 const rows=dutyCadetRowsV365([{anchor,people}],rooms),a=rows.find(p=>p.name==='검증갑'),b=rows.find(p=>p.name==='검증을');assert.equal(a.room,'220-1');assert.equal(a.cohort,'77');assert.equal(a.review,'현재 배정');assert.equal(b.review,'배정명단 확인 필요');assert.equal(b.cohort,'');
});
test('근무생도 PDF 조회는 전체 관리자만 허용하고 기본 조회에 PDF 본문을 넣지 않는다',()=>{
 let legacy=true,reads=0;const c=vm.createContext({dutyRosterStateV367_:()=>({}),saberRolesV276_:()=>[],requireOwner_:()=>{},accessPolicyV284_:()=>({legacy}),dormPlanDataV315_:()=>{reads++;return {filename:'fixture.pdf',version:'v1',base64:'private',layout:[{room:'132',pdfMembers:[{name:'검증',isDuty:true,duty:'군수'}]}]};},spreadsheet_:()=>({}),dormRosterReadV240_:()=>[],dormReadV234_:()=>[],dormTabV234_:()=>({}),dormPlanBindLayoutV321_:x=>x});vm.runInContext(readFileSync(new URL('../scripts/duty-cadets-server.gs.txt',import.meta.url),'utf8'),c);
 assert.equal(c.getDormDutyCadetsV365(false).base64,undefined);assert.equal(c.getDormDutyCadetsV365(true).base64,'private');legacy=false;assert.throws(()=>c.getDormDutyCadetsV365(true),/전체 관리자/);assert.equal(reads,2);
});
