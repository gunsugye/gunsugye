import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {normalizeNavigation} from '../scripts/navigation.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('개발 요청은 중복 등록을 방지하고 관리자만 충돌 검사 후 처리한다',()=>{
 const rows=[];let manager=false,clock=0;
 const sheet={getLastRow:()=>rows.length+1,appendRow:r=>rows.push(r),getRange:(start,col,n,width)=>({getDisplayValues:()=>rows.slice(start-2,start-2+n).map(r=>r.slice(col-1,col-1+width)),setValues:values=>values.forEach((r,i)=>rows[start-2+i].splice(col-1,width,...r))})};
 const ss={getSheetByName:()=>sheet};
 const c=vm.createContext({config_:()=>({email:'user@example.test',canManageUsers:manager,role:'조회 전용'}),spreadsheet_:()=>ss,lockAndRun_:fn=>fn(),iso_:()=>String(++clock),safeCell_:s=>/^[=+@-]/.test(s)?"'"+s:s,Utilities:{getUuid:()=>String(clock)}});
 vm.runInContext(read('scripts/development-requests-server.gs.txt'),c);
 const input={title:'배치도 수정',body:'현재 동작과 원하는 동작',type:'오류',key:'unique'};
 c.createDevelopmentRequestV381(input);c.createDevelopmentRequestV381(input);assert.equal(rows.length,1);
 let r=c.getDevelopmentRequestsV381().requests[0];assert.equal(r.status,'접수');assert.equal('key' in r,false);assert.equal('row' in r,false);
 const update={id:r.id,expectedUpdatedAt:r.updatedAt,status:'진행 중',result:'확인 중',version:''};
 assert.throws(()=>c.updateDevelopmentRequestV381(update),/관리자/);manager=true;c.updateDevelopmentRequestV381(update);
 assert.throws(()=>c.updateDevelopmentRequestV381(update),/변경/);
 r=c.getDevelopmentRequestsV381().requests[0];assert.throws(()=>c.updateDevelopmentRequestV381({...update,expectedUpdatedAt:r.updatedAt,status:'완료',result:''}),/입력/);
 c.updateDevelopmentRequestV381({...update,expectedUpdatedAt:r.updatedAt,status:'완료',result:'표시 수정',version:'3.81'});
 assert.equal(c.getDevelopmentRequestsV381().requests[0].version,'3.81');
 assert.throws(()=>c.createDevelopmentRequestV381({...input,title:' '}),/입력/);
});
test('개발 요청 메뉴는 기존 구성에 한 번 추가하고 이후 삭제를 유지한다',()=>{
 const defaults=[{id:'other',title:'기타',items:['developmentRequests']}],available=['developmentRequests'];let value=normalizeNavigation({schemaVersion:2,groups:[]},defaults,available);assert.deepEqual(value.groups[0].items,available);value.groups=[];assert.deepEqual(normalizeNavigation(value,defaults,available).groups,[]);
 const js=read('docs/assets/app.js');assert.ok(js.includes("if(v==='developmentRequests')devLoadV381();"));assert.ok(js.includes("devDirtyV381()"));assert.ok(read('docs/index.html').includes('id="developmentRequestsView"'));
});
