import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {dutyRoleInfoV367,dutySaberRoleV367} from '../scripts/duty-roles.mjs';import {dutyOrgKeyV372} from '../scripts/duty-order.mjs';import {dutyItemRequirementsV368} from '../scripts/duty-items.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function fixture(){
 let counter=0,admin=true;const props=new Map([['DUTY_ROSTER_MANUAL_V369','yes'],['DUTY_INDEX_VERSION_V367','manual-v369']]);
 const person={id:'owner',name:'검증갑',cohort:'75',company:'1'},other={id:'other',name:'검증갑',cohort:'76',company:'2'},people=[person,other];
 const roster=[{id:'d1',data:{version:'manual-v369',source:{...person,duty:'전대장',organization:'전대'}}},{id:'d2',data:{version:'manual-v369',source:{...other,duty:'전대군수참모',organization:'전대'}}}];
 const sheet=(rows=[])=>({rows,getMaxColumns:()=>26,getLastRow(){return this.rows.length;},getRange(r,c,n,w){return {getDisplayValues:()=>this.rows.slice(r-1,r-1+n).map(row=>Array.from({length:w},(_,i)=>String(row[c-1+i]??''))),setValues:values=>{values.forEach((row,i)=>{this.rows[r-1+i]||=[];row.forEach((value,j)=>this.rows[r-1+i][c-1+j]=value);});}};},appendRow(row){this.rows.push(row);}});
 const quantities=sheet([['키','인원','품목','수량','시각','계정'],['d1|badge','d1','badge',1,'old','admin'],['d2|badge','d2','badge',9,'old','admin']]),saber=sheet([['ID'],['전대|대장생도','전대','전대','전대장','hidden','serial','정상','원래 내용','old','admin']]),tables=new Map([['예도현황',saber]]),ss={getSheetByName:name=>tables.get(name)||null,insertSheet(name){const result=sheet();tables.set(name,result);return result;}};
 const c=vm.createContext({Map,Set,PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key),setProperty:(key,value)=>props.set(key,value)})},SABER_V276:{TAB:'예도현황'},spreadsheet_:()=>ss,personalPersonV331_:()=>({person,ss}),rosterRequired_:()=>({}),rosterRows_:()=>people,smartPersonIdentityV322_:p=>[String(p.cohort).replace(/기$/,''),String(p.company).replace(/중대$/,''),p.name],dutyRosterRecordsV367_:()=>roster,dutyRosterPublicV367_:row=>({...row.data.source,id:row.id}),dutyItemDataV368_:()=>quantities.rows.slice(1).map(row=>row.map(String)),dutyItemSheetV368_:()=>quantities,dutyRoleInfoV367,dutySaberRoleV367,dutyOrgKeyV372,dutyItemRequirementsV368,personalHashV330_:value=>createHash('sha256').update(JSON.stringify(value)).digest('hex'),canonicalRepairStateV216_:value=>value,setupTab_:(sh,headers)=>sh.appendRow(headers),Utilities:{getUuid:()=>String(++counter)},iso_:()=>String(++counter),lockAndRun_:fn=>fn(),ensureRows_:()=>{},safeCell_:value=>value,config_:()=>({email:'admin'}),assetRequestAdminV336_:()=>{if(!admin)throw Error('권한 없음');}});
 vm.runInContext(dutyItemRequirementsV368.toString()+'\n'+read('scripts/personal-duty-server.gs.txt')+'\n'+read('scripts/duty-requests-server.gs.txt'),c);
 return {c,person,other,people,roster,ss,tables,quantities,saber,setAdmin:value=>admin=value};
}
test('근무생도 개인 조회는 기수·중대·이름이 일치하는 본인 물품만 반환하고 평생도는 숨긴다',()=>{
 const f=fixture(),result=f.c.personalDutyV400_(f.person,f.ss);assert.equal(result.isDuty,true);assert.equal(result.assignments.length,1);assert.equal(result.assignments[0].items.find(item=>item.item==='badge').quantity,1);assert.equal(result.assignments[0].saber.status,'정상');assert.equal(JSON.stringify(result).includes('전대군수참모'),false);
 f.roster[0].data.source.duty='군수보좌관';f.roster[0].data.source.organization='중대';assert.equal(f.c.personalDutyV400_(f.person,f.ss).assignments[0].items.some(item=>item.item==='badge'),false);
 const regular={...f.person,id:'x',name:'평생도'};f.people.push(regular);assert.equal(f.c.personalDutyV400_(regular,f.ss).isDuty,false);f.people.push({...f.person,id:'duplicate'});assert.throws(()=>f.c.personalDutyV400_(f.person,f.ss),/동명/);
});
test('개인 요청은 원본 수량을 보존하고 타인·비대상 품목·중복·잘못된 수량을 거절한다',()=>{
 const f=fixture(),duty=f.c.personalDutyV400_(f.person,f.ss),input={snapshot:duty.snapshot,personId:'other',changes:[{key:'d1|badge',value:{quantity:2}}]};
 f.c.personalDutyRequestV400_(input);assert.equal(f.quantities.rows[1][3],1);f.c.personalDutyRequestV400_(input);assert.equal(f.c.getDutyRequestsV400().requests.length,1);
 for(const changes of [[{key:'d2|badge',value:{quantity:2}}],[{key:'d1|badge',value:{quantity:-1}}],[{key:'d1|badge',value:{quantity:2.5}}],[...input.changes,...input.changes]])assert.throws(()=>f.c.personalDutyRequestV400_({...input,changes}));
 assert.throws(()=>f.c.personalDutyRequestV400_({...input,snapshot:'old'}),/변경/);f.setAdmin(false);assert.throws(()=>f.c.getDutyRequestsV400(),/권한/);
});
test('관리자 반영은 해당 수량만 변경하고 요청 상태 충돌과 이후 변경을 검사한다',()=>{
 const f=fixture(),duty=f.c.personalDutyV400_(f.person,f.ss),changes=[{key:'d1|badge',value:{quantity:2}}];f.c.personalDutyRequestV400_({snapshot:duty.snapshot,changes});let request=f.c.getDutyRequestsV400().requests[0];
 f.quantities.rows[1][3]=3;assert.throws(()=>f.c.resolveDutyRequestV400(request.id,'apply',changes,'','대기'),/요청 이후/);assert.equal(f.quantities.rows[1][3],3);
 f.quantities.rows[1][3]=1;f.c.resolveDutyRequestV400(request.id,'apply',changes,'확인','대기');assert.equal(f.quantities.rows[1][3],2);assert.equal(Number(f.quantities.rows[2][3]),9);assert.equal(f.c.getDutyRequestsV400().requests[0].status,'반영 완료');assert.throws(()=>f.c.resolveDutyRequestV400(request.id,'apply',changes,'','대기'),/상태/);
 f.c.resolveDutyRequestV400(request.id,'delete',[],'','반영 완료');assert.equal(f.quantities.rows[1][3],2);assert.equal(f.c.getDutyRequestsV400().requests.length,0);
});
test('예도는 수량 대상에서 제외하고 상태 요청을 승인하면 기존 예도 기록에 반영한다',()=>{
 const f=fixture(),duty=f.c.personalDutyV400_(f.person,f.ss);assert.equal(duty.assignments[0].items.some(item=>item.item==='saber'),false);const changes=[{key:'saber|전대|대장생도',value:{status:'수리 필요(보고)',detail:'손잡이 확인'}}];assert.throws(()=>f.c.personalDutyRequestV400_({snapshot:duty.snapshot,changes:[{key:'d1|saber',value:{quantity:1}}]}));f.c.personalDutyRequestV400_({snapshot:duty.snapshot,changes});assert.equal(f.saber.rows[1][6],'정상');const request=f.c.getDutyRequestsV400().requests[0];f.c.resolveDutyRequestV400(request.id,'apply',changes,'반영','대기');assert.equal(f.saber.rows[1][6],'수리 필요(보고)');assert.equal(f.saber.rows[1][7],'손잡이 확인');assert.equal(f.saber.rows[1][5],'serial');
});

function portalFixtureV404(){
 const nodes=new Map(),create=(tag='div')=>({tagName:tag.toUpperCase(),style:{},dataset:{},children:[],value:'',hidden:false,append(...nodes){this.children.push(...nodes);},prepend(...nodes){this.children.unshift(...nodes);},replaceChildren(...nodes){this.children=nodes;},setAttribute(){},addEventListener(){}}),get=id=>{if(!nodes.has(id))nodes.set(id,create());return nodes.get(id);},calls=[];
 const c=vm.createContext({$:get,element:(tag,text='')=>Object.assign(create(tag),{textContent:text}),document:{createElement:create},window:{addEventListener(){}},busy:false,token:'own',ticket:1,request:async(path,body)=>{calls.push({path,body});return {requested:true};}});vm.runInContext(read('scripts/personal-duty-portal.js.txt'),c);const all=node=>[node,...node.children.flatMap(all)];return {c,get,calls,all};
}
test('근무명을 첫 행에 표시하고 두 번째 행은 품목·수량·세부사항 3열이며 비대상 품목은 숨긴다',()=>{
 const h=portalFixtureV404();h.c.personalDutyRenderV400({duty:{isDuty:true,snapshot:'s',assignments:[{id:'own',duty:'군수보좌관',items:[{item:'block',label:'블럭',required:2,quantity:1},{item:'badge',label:'흉장',required:0,quantity:null}]}]}});
 const root=h.get('personalDutyCardsV400'),form=root.children[0],table=form.children[0],head=table.children.find(node=>node.tagName==='THEAD');assert.equal(head.children[0].children[0].textContent,'군수보좌관 · 흉장·블럭·명패');assert.equal(head.children[0].children[0].colSpan,3);assert.deepEqual(head.children[1].children.map(node=>node.textContent),['품목','수량','세부사항']);assert.equal(h.all(form).filter(node=>node.tagName==='SELECT').length,1);assert.equal(h.all(form).filter(node=>node.tagName==='BUTTON').length,1);assert.equal(h.get('personalDutyV400').hidden,false);
 h.c.personalDutyResetV400();assert.equal(h.get('personalDutyV400').hidden,true);assert.equal(h.get('personalRegularV400').hidden,false);assert.doesNotMatch(read('docs/me/index.html'),/personalDutyTabV400|personalRegularTabV400/);
});
test('수량 선택지는 0부터 기준값과 직접 입력이며 여러 품목과 세부사항을 한 번에 요청한다',async()=>{
 const h=portalFixtureV404();h.c.personalDutyRenderV400({duty:{isDuty:true,snapshot:'snapshot',assignments:[{id:'own',duty:'전대장',saber:{key:'전대|대장생도',status:'정상',detail:''},items:[{item:'badge',label:'흉장',required:2,quantity:2,detail:''}]}]}});
 const form=h.get('personalDutyCardsV400').children[0],fields=h.all(form),selects=fields.filter(node=>node.tagName==='SELECT'),numbers=fields.filter(node=>node.tagName==='INPUT');assert.deepEqual(selects[0].children.map(node=>node.value),['','정상','수리 필요(보고)','수리 필요(미보고)','교체 필요']);assert.equal(fields.filter(node=>node.tagName==='TABLE').length,2);assert.deepEqual(selects[1].children.map(node=>node.value),['','0','1','2','direct']);
 selects[0].value='수리 필요(보고)';selects[0].onchange();assert.equal(numbers[0].hidden,true);selects[1].value='direct';selects[1].onchange();assert.equal(numbers[0].hidden,false);numbers[0].value='4';fields.find(node=>node.tagName==='TEXTAREA').value='지급 확인';form.oninput();await form.onsubmit({preventDefault(){}});assert.equal(h.calls.length,1);assert.equal(h.calls[0].path,'duty-request');assert.equal(h.calls[0].body.changes.length,2);assert.equal(h.calls[0].body.changes[0].value.status,'수리 필요(보고)');assert.equal(h.calls[0].body.changes[0].value.detail,'지급 확인');assert.equal(h.calls[0].body.changes[1].value.quantity,4);
});

test('세부사항은 요청만으로 기록을 바꾸지 않고 승인 시 저장되며 수량만 요청하는 기존 경로에서도 보존한다',()=>{
 const f=fixture();let duty=f.c.personalDutyV400_(f.person,f.ss),changes=[{key:'d1|badge',value:{quantity:2,detail:'세부사항 기록'}}];f.c.personalDutyRequestV400_({snapshot:duty.snapshot,changes});assert.equal(f.quantities.rows[1][6],undefined);let request=f.c.getDutyRequestsV400().requests[0];f.c.resolveDutyRequestV400(request.id,'apply',changes,'','대기');assert.equal(f.quantities.rows[1][6],'세부사항 기록');assert.equal(f.c.personalDutyV400_(f.person,f.ss).assignments[0].items.find(item=>item.item==='badge').detail,'세부사항 기록');
 duty=f.c.personalDutyV400_(f.person,f.ss);changes=[{key:'d1|badge',value:{quantity:1}}];f.c.personalDutyRequestV400_({snapshot:duty.snapshot,changes});request=f.c.getDutyRequestsV400().requests[0];f.c.resolveDutyRequestV400(request.id,'apply',changes,'','대기');assert.equal(f.quantities.rows[1][6],'세부사항 기록');assert.equal(Number(f.quantities.rows[1][3]),1);
});

test('전대군수참모생도는 과거 분류·연결값과 관계없이 예도 상태 배정을 표시한다',()=>{const f=fixture();f.roster[0].data.source.duty='전대군수참모생도';f.roster[0].data.source.organization='기타';f.roster[0].data.source.saberRoleOverride='none';const assignment=f.c.personalDutyV400_(f.person,f.ss).assignments[0];assert.equal(assignment.saber.key,'전대|군수참모생도');assert.equal(assignment.items.some(item=>item.item==='saber'),false);});

test('전대·대대 전체 참모와 8개 중대장·편대장, 명예위원장의 예도 연결을 점검한다',()=>{
 const f=fixture();let count=0;
 for(const unit of ['전대','1대대','2대대'])for(const title of ['장','작전참모','인사참모','군수참모','체육참모','문화활동참모']){const duty=unit+title+'생도',expected=unit+'|'+(title==='장'?'대장':title)+'생도';assert.equal(f.c.personalSaberRoleV406_({duty,organization:'기타',saberRoleOverride:'none'}),expected,duty);count++;}
 for(let company=1;company<=8;company++)for(const title of ['장','1편대장','2편대장','3편대장','4편대장']){const duty=company+'중대'+title+'생도',expected=company+'중대|'+(title==='장'?'중대장':title)+'생도';assert.equal(f.c.personalSaberRoleV406_({duty,company:'1',organization:'기타'}),expected,duty);count++;}
 assert.equal(f.c.personalSaberRoleV406_({duty:'명예위원장생도'}),'명예위원회|명예위원장생도');assert.equal(count,58);
 for(const duty of ['군수보좌관생도','전대군수참모보좌관생도','동기회장','생활발전위원장','편대장'])assert.equal(f.c.personalSaberRoleV406_({duty}), '', duty);
});
