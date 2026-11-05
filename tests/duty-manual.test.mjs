import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {dutyRoleInfoV367,dutySaberRoleV367} from '../scripts/duty-roles.mjs';
import {dutySplitAssignmentsV391,dutyFixedRolesV391,dutyFixedRoleValidV391,dutyAssignmentKeyV391} from '../scripts/duty-assignments.mjs';
const shared={dutyRoleInfoV367,dutySaberRoleV367,dutySplitAssignmentsV391,dutyFixedRolesV391,dutyFixedRoleValidV391,dutyAssignmentKeyV391};
test('기존 명단 ID·수정사항을 보존해 직접 입력으로 전환하고 PDF 없이 추가·수정·삭제한다',()=>{
 const rows=[['ID','원본키','명단JSON','수정시각','수정자'],['old-id','pdf-key',JSON.stringify({version:'pdf-v1',source:{name:'검증',duty:'전대군수참모',cohort:'75',company:'1'},edits:{duty:'전대인사참모'}}),'old-time','fixture']],props=new Map([['DUTY_INDEX_VERSION_V367','pdf-v1']]);let sequence=0,locked=false,legacy=true;
 const sheet={getLastRow:()=>rows.length,getRange:(r,c,n,w)=>({getDisplayValues:()=>rows.slice(r-1,r-1+n).map(v=>v.slice(c-1,c-1+w)),setValues:values=>values.forEach((v,i)=>rows[r-1+i]=v)}),appendRow:v=>rows.push(v),deleteRow:r=>rows.splice(r-1,1)};
 const c=vm.createContext({...shared,ensureRows_:()=>{},requireOwner_:()=>{},accessPolicyV284_:()=>({legacy}),spreadsheet_:()=>({getSheetByName:()=>sheet}),text_:(s,n)=>String(s??'').slice(0,n),PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},lockAndRun_:fn=>{assert.equal(locked,false,'중첩 잠금 금지');locked=true;try{return fn();}finally{locked=false;}},Utilities:{getUuid:()=>String(++sequence)},iso_:()=>String(++sequence),config_:()=>({email:'fixture'}),saberRolesV276_:()=>[],dormPlanDataV315_:()=>{throw Error('PDF를 읽으면 안 됩니다.');}});
 vm.runInContext(readFileSync(new URL('../scripts/duty-roster-server.gs.txt',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../scripts/duty-manual-server.gs.txt',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../scripts/duty-items-server.gs.txt',import.meta.url),'utf8'),c);
 const initial=c.getDutyCadetsV369();assert.equal(initial.records[0].id,'old-id');assert.equal(initial.records[0].duty,'전대인사참모');assert.equal(c.getDutyCadetsV369().records.length,1);assert.equal(JSON.parse(rows[1][2]).previousVersion,'pdf-v1');
 const patch={name:'직접검증',cohort:'77기',company:'3중대',duty:'교육보좌관',building:'정예 동관',floor:'1층',room:'110'};let added=c.addDutyCadetV369(patch);assert.equal(added.cohort,'77');assert.equal(added.company,'3');assert.equal(added.room,'110');assert.throws(()=>c.addDutyCadetV369(patch),/이미 등록/);
 added=c.saveDormDutyCadetV367(added.id,{...patch,duty:'행정보좌관'},added.updatedAt);assert.equal(added.duty,'행정보좌관');assert.throws(()=>c.deleteDutyCadetV369(added.id,'wrong'),/다른 곳/);assert.throws(()=>c.syncDormDutyCadetsV367('new-pdf',[]),/직접 입력/);assert.equal(c.dutyItemRosterV368_().rows.length,2);c.deleteDutyCadetV369(added.id,added.updatedAt);assert.equal(c.getDutyCadetsV369().records.length,1);legacy=false;assert.throws(()=>c.addDutyCadetV369(patch),/전체 관리자/);
});

function assignmentHarness(options={}){
 const composites=['3학년중대임원,군수보좌관','4학년중대임원 · 2편대장','교육보좌관 · 중대기수'];let sequence=0,locked=false,appendCount=0,rewriteFailed=false;
 const props=new Map([['DUTY_ROSTER_MANUAL_V369','yes'],['DUTY_INDEX_VERSION_V367','manual-v369']]);
 const rows=[['ID','원본키','명단JSON','수정시각','수정자'],...composites.map((duty,i)=>['old-'+i,'source-'+i,JSON.stringify({version:'manual-v369',source:{name:'분리검증'+i,cohort:'75',company:'1',organization:'중대',duty,saberRoleOverride:i===1?'1중대|2편대장생도':'',familyOverride:''},edits:{}}),'old-time-'+i,'fixture'])];
 const itemRows=[['키','근무명단ID','품목','수량','수정시각','수정자'],...composites.map((duty,i)=>['old-'+i+'|block','old-'+i,'block','2','old-item','fixture'])];
 const makeSheet=values=>({getLastRow:()=>values.length,getRange:(r,c,n=1,w=5)=>({getDisplayValues:()=>values.slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+w)),setValues:next=>{if(values===rows&&options.rewriteError&&!rewriteFailed&&r>1&&r<=4){rewriteFailed=true;throw Error('원행 수정 실패');}next.forEach((row,i)=>values[r-1+i]=row);}}),appendRow:row=>{appendCount++;if(options.appendErrorAt===appendCount)throw Error('신규행 추가 실패');values.push(row);if(options.appendCommittedErrorAt===appendCount)throw Error('추가 후 응답 실패');},deleteRow:r=>values.splice(r-1,1)});
 const roster=makeSheet(rows),items=makeSheet(itemRows),c=vm.createContext({...shared,requireOwner_:()=>{},accessPolicyV284_:()=>({legacy:true}),spreadsheet_:()=>({getSheetByName:name=>name==='근무생도명단'?roster:name==='근무생도물품'?items:null}),text_:(s,n)=>String(s??'').slice(0,n),PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key),setProperty:(key,value)=>props.set(key,value)})},lockAndRun_:fn=>{assert.equal(locked,false,'명단 준비는 물품 쓰기 잠금 전에 완료해야 함');locked=true;try{return fn();}finally{locked=false;}},Utilities:{getUuid:()=> 'new-'+(++sequence)},iso_:()=> 'time-'+(++sequence),config_:()=>({email:'fixture'}),saberRolesV276_:()=>[{id:'1중대|2편대장생도'}],dormPlanDataV315_:()=>{throw Error('직접 입력 명단에서 PDF를 읽지 않음');},ensureRows_:()=>{}});
 for(const path of ['duty-roster-server.gs.txt','duty-manual-server.gs.txt','duty-items-server.gs.txt'])vm.runInContext(readFileSync(new URL('../scripts/'+path,import.meta.url),'utf8'),c);
 return {c,rows,itemRows,props};
}

test('겸직 분리기는 완성된 직책만 나누고 전대·대대 기존 이름·생도·차수 별칭을 그대로 허용한다',()=>{
 for(const [value,expected] of [['3학년중대임원,군수보좌관',['3학년중대임원','군수보좌관']],['4학년여생도임원 · 2편대장',['4학년여생도임원','2편대장']],['교육보좌관/중대기수',['교육보좌관','중대기수']],['문화·체육보좌관',['문화·체육보좌관']],['군수/보급보좌관',['군수/보급보좌관']]])assert.deepEqual(dutySplitAssignmentsV391(value),expected);
 assert.equal(dutyFixedRolesV391('전대').length,11);assert.equal(dutyFixedRolesV391('1대대').length,6);
 for(const row of [{organization:'전대',duty:'전대작전참모'},{organization:'전대',duty:'전대 작전참모보좌관생도1st'},{organization:'1대대',duty:'대대장생도'},{organization:'1대대',duty:'1대대 문화참모생도'}])assert.ok(dutyFixedRoleValidV391(row),row.duty);
 assert.equal(dutyFixedRoleValidV391({organization:'1대대',duty:'전대장'}),false);assert.equal(dutyFixedRoleValidV391({organization:'전대',duty:'없는참모'}),false);
 const p={name:'검증',cohort:'75',company:'1',organization:'1대대'};assert.equal(dutyAssignmentKeyV391({...p,duty:'1대대장'}),dutyAssignmentKeyV391({...p,duty:'대대장생도'}));assert.equal(dutyAssignmentKeyV391({...p,duty:'1대대문화참모'}),dutyAssignmentKeyV391({...p,duty:'1대대문화활동참모생도'}));
});

test('기존 세 종류 겸직은 예도·블럭 대상의 원 ID와 물품을 유지하고 다른 근무만 새 ID로 만든다',()=>{
 const h=assignmentHarness(),itemsBefore=JSON.stringify(h.itemRows),state=h.c.getDutyCadetsV369();assert.equal(state.records.length,6);assert.deepEqual(['old-0','old-1','old-2'].map(id=>state.records.find(row=>row.id===id).duty),['군수보좌관','2편대장','교육보좌관']);assert.equal(JSON.stringify(h.itemRows),itemsBefore);
 assert.deepEqual(state.records.filter(row=>row.id.startsWith('new-')).map(row=>row.duty),['3학년중대임원','4학년중대임원','중대기수']);assert.ok(state.records.filter(row=>row.id.startsWith('new-')).every(row=>row.saberRoleOverride==='auto'));assert.equal(state.records.find(row=>row.id==='old-1').saberRoleOverride,'1중대|2편대장생도');assert.equal(dutySaberRoleV367(state.records.find(row=>row.id==='old-1')),'1중대|2편대장생도');
 for(const row of h.rows.slice(1,4)){const data=JSON.parse(row[2]);assert.ok(data.splitOriginalDuty);assert.equal(data.splitDuties.length,2);assert.equal(row[1],'source-'+row[0].slice(-1));}
 assert.equal(h.c.getDutyItemsV368().items.length,3);assert.equal(h.c.getDutyCadetsV369().records.length,6);assert.equal(h.props.get('DUTY_ASSIGNMENTS_SPLIT_V391'),'yes');
});

test('겸직 분리의 추가 실패·추가 후 응답 실패·원행 수정 실패를 재시도해도 근무 유실이나 중복이 없다',()=>{
 for(const options of [{appendErrorAt:2},{appendCommittedErrorAt:1},{rewriteError:true}]){const h=assignmentHarness(options),itemBefore=JSON.stringify(h.itemRows);assert.throws(()=>h.c.getDutyCadetsV369(),/실패/);assert.equal(h.props.get('DUTY_ASSIGNMENTS_SPLIT_V391'),undefined);const state=h.c.getDutyCadetsV369();assert.equal(state.records.length,6);assert.equal(new Set(state.records.map(dutyAssignmentKeyV391)).size,6);assert.equal(JSON.stringify(h.itemRows),itemBefore);assert.deepEqual(['old-0','old-1','old-2'].map(id=>state.records.find(row=>row.id===id).duty),['군수보좌관','2편대장','교육보좌관']);assert.equal(h.c.getDutyCadetsV369().records.length,6);}
});

test('같은 사람의 다른 조직·직책은 별도 ID로 저장하고 동일 배정의 추가·수정은 차단한다',()=>{
 const h=assignmentHarness();h.c.getDutyCadetsV369();const base={name:'추가검증',cohort:'75',company:'1',organization:'전대',duty:'전대군수참모'};
 const first=h.c.addDutyCadetV369(base),second=h.c.addDutyCadetV369({...base,organization:'1대대',duty:'1대대군수참모'});assert.notEqual(first.id,second.id);assert.throws(()=>h.c.addDutyCadetV369({...base,duty:'전대 군수참모생도'}),/이미 등록/);assert.throws(()=>h.c.saveDormDutyCadetV367(second.id,base,second.updatedAt),/이미 등록/);assert.throws(()=>h.c.addDutyCadetV369({...base,duty:'잘못된참모'}),/정해진 근무명/);
 const combined={...base,organization:'중대',duty:'4학년중대임원 · 2편대장',saberRoleOverride:'1중대|2편대장생도'},before=h.c.getDutyCadetsV369().records.length;h.c.addDutyCadetV369(combined);const after=h.c.getDutyCadetsV369().records;assert.equal(after.length,before+2);const added=after.filter(row=>row.name===base.name&&row.organization==='중대');assert.deepEqual(added.map(row=>row.duty),['4학년중대임원','2편대장']);assert.equal(added.find(row=>row.duty==='4학년중대임원').saberRoleOverride,'auto');assert.equal(added.find(row=>row.duty==='2편대장').saberRoleOverride,'1중대|2편대장생도');
});

test('기존 자유 근무명은 조회에서 차단하거나 자동 개명하지 않는다',()=>{
 const h=assignmentHarness();h.rows.push(['legacy','legacy-source',JSON.stringify({version:'manual-v369',source:{name:'이전명단',cohort:'75',company:'1',organization:'전대',duty:'이전 자유 근무명'},edits:{}}),'legacy-time','fixture']);const state=h.c.getDutyCadetsV369();assert.equal(state.records.find(row=>row.id==='legacy').duty,'이전 자유 근무명');assert.equal(state.records.length,7);assert.equal(h.props.get('DUTY_ASSIGNMENTS_SPLIT_V391'),'yes');
});

test('원 ID에 남길 근무가 이미 다른 행에 있으면 그 겸직만 검토로 남기고 원문·물품·예도 연결을 보존한다',()=>{
 const h=assignmentHarness(),source=JSON.parse(h.rows[1][2]);h.rows.push(['same-role','same-source',JSON.stringify({version:'manual-v369',source:{...source.source,duty:'군수보좌관'},edits:{}}),'same-time','fixture']);const itemsBefore=JSON.stringify(h.itemRows),state=h.c.getDutyCadetsV369(),original=state.records.find(row=>row.id==='old-0');assert.equal(original.duty,'3학년중대임원,군수보좌관');assert.equal(original.sourceKey,'source-0');assert.equal(original.splitReview,'겸직 분리 확인 필요');assert.equal(JSON.stringify(h.itemRows),itemsBefore);assert.equal(state.records.filter(row=>row.name===original.name).length,2);assert.equal(state.records.find(row=>row.id==='old-1').duty,'2편대장');assert.equal(state.records.find(row=>row.id==='old-1').saberRoleOverride,'1중대|2편대장생도');assert.equal(state.records.find(row=>row.id==='old-2').duty,'교육보좌관');assert.equal(h.props.get('DUTY_ASSIGNMENTS_SPLIT_V391'),'yes');assert.equal(h.c.getDutyCadetsV369().records.length,state.records.length);
 const edited=h.c.saveDormDutyCadetV367(original.id,{name:original.name,cohort:'75',company:'1',organization:'중대',duty:'3학년중대임원'},original.updatedAt);assert.equal(edited.id,original.id);assert.equal(edited.splitReview,'');assert.equal(JSON.stringify(h.itemRows),itemsBefore);
});

test('물품 저장도 준비 단계에서 먼저 겸직을 분리해 중첩 잠금을 만들지 않는다',()=>{
 const h=assignmentHarness();h.c.saveDutyItemsV368('manual-v369','',[{personId:'old-0',item:'block',quantity:1}]);assert.equal(h.c.getDutyCadetsV369().records.length,6);assert.equal(h.c.getDutyItemsV368().items.find(row=>row.personId==='old-0').quantity,1);assert.equal(h.c.getDutyItemsV368().items.filter(row=>row.personId.startsWith('new-')).length,0);
});
