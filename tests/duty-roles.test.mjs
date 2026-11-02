import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {dutyRoleInfoV367 as info,dutyFamilyV367 as family,dutySortV367 as sort,dutySaberRoleV367 as saber} from '../scripts/duty-roles.mjs';
test('지정한 근무 계열에 편대장과 보좌관을 연결한다',()=>{
 for(const [group,roles] of Object.entries({'장':['전대장','1대대장','3중대장'],'작전':['전대작전참모','1편대장','전대작전참모보좌관','교육보좌관'],'인사':['전대인사참모','2편대장','1대대인사참모보좌관','행정보좌관'],'군수':['전대군수참모','3편대장','전대군수참모보좌관','군수(보급)보좌관'],'문화 및 체육':['전대문화활동참모','전대체육참모','4편대장','전대문화활동참모보좌관','전대체육참모보좌관','문화체육보좌관']}))for(const duty of roles)assert.equal(family({duty}),group,duty);
 assert.equal(info({duty:'3중대체육보좌관'}).title,'문화체육보좌관');assert.equal(info({duty:'전대체육참모'}).title,'전대체육참모');assert.equal(family({duty:'4학년여생도중대임원'}),'중대임원');
});
test('전대·중대·동생명 서열과 학년·대대 순으로 정렬한다',()=>{
 const sorted=duties=>sort(duties.map((duty,i)=>({duty,name:String(i),company:'1'}))).map(r=>r.duty);
 assert.deepEqual(sorted(['전대문화활동참모보좌관','전대장','전대군수참모','전대작전참모보좌관','전대인사참모','전대문화활동참모','전대작전참모','전대체육참모']),['전대장','전대작전참모','전대인사참모','전대군수참모','전대체육참모','전대문화활동참모','전대작전참모보좌관','전대문화활동참모보좌관']);
 assert.deepEqual(sorted(['1학년중대임원','2학년중대임원','중대기수','교육보좌관','3학년중대임원','4학년중대임원','1편대장','중대장']),['중대장','1편대장','4학년중대임원','3학년중대임원','교육보좌관','중대기수','2학년중대임원','1학년중대임원']);
 assert.deepEqual(sorted(['명예위3학년2대대','명예위4학년2대대','명예위원장','명예위4학년1대대']),['명예위원장','명예위4학년1대대','명예위4학년2대대','명예위3학년2대대']);
 assert.deepEqual(sorted(['동기회4학년총무','동기회4학년친목활동부장','동기회4학년부회장','동기회4학년회장','동기회3학년회장']),['동기회4학년회장','동기회4학년부회장','동기회4학년총무','동기회4학년친목활동부장','동기회3학년회장']);
});
test('예도는 명확한 직책만 연결하고 보좌관·불명확한 편대장을 추측하지 않는다',()=>{
 assert.equal(saber({duty:'전대군수참모'}),'전대|군수참모생도');assert.equal(saber({duty:'2대대장'}),'2대대|대장생도');assert.equal(saber({duty:'3편대장',company:2}),'2중대|3편대장생도');assert.equal(saber({duty:'편대장',company:2}),'');assert.equal(saber({duty:'전대군수참모보좌관'}),'');assert.equal(saber({duty:'전대장',saberRoleOverride:'none'}),'');
});
test('근무명단 수정은 재동기화 후 보존하고 충돌·과거 편성안·권한 오류를 차단한다',()=>{
 let version='v1',legacy=true,clock=0;const values=[['ID','원본키','명단JSON','수정시각','수정자']],props=new Map();const sheet={getLastRow:()=>values.length,getRange:(r,c,n=1,w=5)=>({getDisplayValues:()=>values.slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+w)),setValues:rows=>{rows.forEach((row,i)=>values[r-1+i]=row);}}),appendRow:row=>values.push(row)};
 const c=vm.createContext({Map,Set,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},requireOwner_:()=>{},accessPolicyV284_:()=>({legacy}),spreadsheet_:()=>({getSheetByName:()=>sheet}),text_:(s,n)=>String(s??'').slice(0,n),iso_:()=>String(++clock),config_:()=>({email:'fixture@example.com'}),Utilities:{getUuid:()=>String(++clock)},lockAndRun_:fn=>fn(),dormPlanDataV315_:()=>({version}),saberRolesV276_:()=>[],dutySaberRoleV367:saber});vm.runInContext(readFileSync(new URL('../scripts/duty-roster-server.gs.txt',import.meta.url),'utf8'),c);
 const source={sourceKey:'page-room-name-role',name:'검증',cohort:'77',company:'1',duty:'교육보좌관',page:2};let row=c.syncDormDutyCadetsV367(version,[source]).records[0];const original=row.updatedAt;row=c.saveDormDutyCadetV367(row.id,{name:'검증',cohort:'77',company:'1',duty:'행정보좌관'},original);assert.equal(row.duty,'행정보좌관');assert.throws(()=>c.saveDormDutyCadetV367(row.id,{name:'검증',duty:'교육'},original),/다른 곳/);assert.equal(c.syncDormDutyCadetsV367(version,[source]).records[0].duty,'행정보좌관');
 values.splice(1,0,['','','','','']);row=c.saveDormDutyCadetV367(row.id,{name:'검증',duty:'문화체육보좌관'},row.updatedAt);assert.equal(values[1][0],'');assert.equal(JSON.parse(values[2][2]).edits.duty,'문화체육보좌관');version='v2';assert.throws(()=>c.saveDormDutyCadetV367(row.id,{name:'검증',duty:'교육'},row.updatedAt),/현재 편성안/);legacy=false;assert.throws(()=>c.syncDormDutyCadetsV367(version,[source]),/전체 관리자/);
});
