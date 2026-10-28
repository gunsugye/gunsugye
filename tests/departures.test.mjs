import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source=readFileSync(new URL('../scripts/departures-server.gs.txt',import.meta.url),'utf8');
function fixture(){
 const members=[{id:'a',cohort:'77',company:'1',name:'대상가',updatedAt:'v1',firearmNumber:'G1'},{id:'b',cohort:'77',company:'1',name:'대상나',updatedAt:'v1',firearmNumber:'G2'},{id:'c',cohort:'77',company:'1',name:'동명자',updatedAt:'v1'}];
 const clothes=members.map((p,i)=>({...p,id:'u'+p.id,sizes:{공사티:'100'},updatedAt:'u1'})),archives=[],events=[],tables=new Map();
 let ref=Array.from({length:100},(_,i)=>({name:'기준'+i,cohort:'78',company:'1'})).concat([{name:'동명자',cohort:'78',company:'2'}]);
 const uniformKey=r=>[r.cohort,r.company,r.name].join('|');
 const context=vm.createContext({
  config_:()=>({canManageUsers:true,email:'admin@example.com'}),fullEditorsV281_:()=>[],spreadsheet_:()=>({getSheetByName:n=>tables.get(n)}),
  smartReferenceV253_:()=>({items:ref,mode:'시험 원본'}),smartReferenceHintsV255_:()=>({url:'',rows:[]}),uniformNameV278_:s=>String(s).trim(),uniformKeyV278_:uniformKey,
  rosterRequired_:()=>({}),rosterRows_:()=>members,uniformTabV278_:()=>({deleteRow:r=>{events.push('delete-uniform');clothes.splice(r-2,1);}}),
  uniformRowsV278_:()=>clothes.map((r,i)=>({...r,row:i+2})),specialArchiveItemsV255_:()=>archives,
  supplyRegistryItems_:()=>[{id:'item',name:'물품'}],supplyOne_:()=>({sh:{},headers:[]}),
  supplyRows_:()=>members.map(p=>({id:p.id,status:'정상',detail:'',extra:{수량:'1'},updatedAt:'s1'})),
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_a,s)=>createHash('sha256').update(s).digest(),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url')},
  SMART_V253:{STATUSES:['퇴교','퇴학','휴학','위탁']},lockAndRun_:f=>f(),text_:(v,n)=>String(v||'').slice(0,n),iso_:()=> '2026-10-27T00:00:00Z',safeCell_:String,
  supplyValidateProcessingV276_:(items,choices)=>{for(const i of items)if(!choices?.[i.id]?.action)throw Error('군수품 미확인');},
  specialSheetV255_:(_ss,name)=>{if(!tables.has(name)){const rows=[];tables.set(name,{rows,appendRow:r=>{events.push(name);rows.push(r);},getLastRow:()=>rows.length+1,getRange:r=>({setValue:v=>{rows[r-2][8]=v;}})});}return tables.get(name);},
  moveRosterSpecialLockedV305_:(id,status,note,expected,choices)=>{events.push('move-roster');const i=members.findIndex(p=>p.id===id);assert.equal(expected,members[i].updatedAt);archives.push({...members[i],status});members.splice(i,1);return {supplySync:{warnings:[]}};},
  uniformLogV278_:()=>events.push('uniform-log'),specialArchiveFindV255_:(_ss,id)=>archives.find(x=>x.id===id)
 });
 new vm.Script(readFileSync(new URL('../scripts/smart-inactive.gs.txt',import.meta.url),'utf8')+'\n'+source).runInContext(context);
 return {context,members,clothes,events,tables,setRef:v=>ref=v,plan:c=>({id:c.id,token:c.token,status:'휴학',gunAction:'별도 보관',uniformAction:'보관',dispositions:{item:{action:'반납 완료'}}})};
}
test('스마트당직 미등재만 후보로 만들고 동명·소속 불일치는 자동 처리에서 제외한다',()=>{
 const f=fixture(),d=f.context.getDepartureDashboardV305();
 assert.equal(d.ready,true);assert.equal(d.candidates.length,2);assert.equal(d.review.length,2);
 assert.equal(d.candidates[0].supplies.length,1);assert.equal(d.candidates[0].uniforms.length,1);
 assert.equal(f.events.length,0);
 f.setRef([]);assert.equal(f.context.getDepartureDashboardV305().ready,false);assert.equal(f.events.length,0);
});
test('스마트당직에 남은 퇴학 인원도 후보로 만들고 퇴학 상태로 총기·군수품·피복을 처리한다',()=>{
 const f=fixture(),base=Array.from({length:100},(_,i)=>({name:'기준'+i,cohort:'78',company:'1'}));
 f.setRef(base.concat([{...f.members[0],duty:'퇴 학'},{...f.members[1],duty:''}]));
 f.context.smartReferenceHintsV255_=()=>({url:'configured',rows:[{status:'퇴학',preview:[{value:f.members[1].name}]}]});
 const d=f.context.getDepartureDashboardV305();assert.ok(d.candidates.some(c=>c.name==='대상가'));assert.ok(d.candidates.some(c=>c.name==='대상나'));
 const c=d.candidates.find(c=>c.name==='대상가');assert.equal(f.context.processDepartureV305({...f.plan(c),status:'퇴학'}).ok,true);
 assert.equal(f.tables.get('피복_상태이동보관').rows[0][7],'퇴학');assert.equal(f.tables.get('인원일괄처리이력').rows[0][4],'퇴학');
});
test('원본이 바뀌거나 물품 미확인 상태이면 기록을 이동하지 않는다',()=>{
 const f=fixture(),c=f.context.getDepartureDashboardV305().candidates[0];
 assert.throws(()=>f.context.processDepartureV305({...f.plan(c),dispositions:{}}),/미확인/);
 assert.equal(f.events.length,0);f.clothes[0].sizes.공사티='105';
 assert.throws(()=>f.context.processDepartureV305(f.plan(c)),/변경/);assert.equal(f.events.length,0);
 f.context.config_=()=>({canManageUsers:false,email:'scoped@example.com'});
 assert.throws(()=>f.context.getDepartureDashboardV305(),/전체 편집자/);
});
test('앞 인원 삭제로 행 번호가 바뀌어도 다음 인원의 동일한 원본은 처리하며 피복을 먼저 보관한다',()=>{
 const f=fixture(),rows=f.context.getDepartureDashboardV305().candidates;
 for(const c of rows)assert.equal(f.context.processDepartureV305(f.plan(c)).ok,true);
 assert.equal(f.members.length,1);assert.equal(f.clothes.length,1);
 assert.ok(f.events.indexOf('피복_상태이동보관')<f.events.indexOf('delete-uniform'));
 assert.equal(f.tables.get('인원일괄처리이력').rows.length,2);
 assert.equal(f.tables.get('피복_상태이동보관').rows.length,2);
});
test('상태 이동 후 피복 처리 실패는 일부 처리로 보고하여 전체 성공으로 오인하지 않는다',()=>{
 const f=fixture(),c=f.context.getDepartureDashboardV305().candidates[0];
 f.context.uniformLogV278_=()=>{throw Error('이력 쓰기 실패');};
 const result=f.context.processDepartureV305(f.plan(c));
 assert.equal(result.ok,false);assert.equal(result.partial,true);assert.equal(f.clothes.length,3);
 assert.match(f.tables.get('인원일괄처리이력').rows[0][8],/일부 처리됨/);
});
