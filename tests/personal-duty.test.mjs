import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {dutyRoleInfoV367,dutySaberRoleV367} from '../scripts/duty-roles.mjs';import {dutyOrgKeyV372} from '../scripts/duty-order.mjs';import {dutyItemRequirementsV368} from '../scripts/duty-items.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function fixture(){
 let counter=0,admin=true;const props=new Map([['DUTY_ROSTER_MANUAL_V369','yes'],['DUTY_INDEX_VERSION_V367','manual-v369']]);
 const person={id:'owner',name:'검증갑',cohort:'75',company:'1'},other={id:'other',name:'검증갑',cohort:'76',company:'2'},people=[person,other];
 const roster=[{id:'d1',data:{version:'manual-v369',source:{...person,duty:'전대장',organization:'전대'}}},{id:'d2',data:{version:'manual-v369',source:{...other,duty:'전대군수참모',organization:'전대'}}}];
 const sheet=(rows=[])=>({rows,getLastRow(){return this.rows.length;},getRange(r,c,n,w){return {getDisplayValues:()=>this.rows.slice(r-1,r-1+n).map(row=>Array.from({length:w},(_,i)=>String(row[c-1+i]??''))),setValues:values=>{values.forEach((row,i)=>{this.rows[r-1+i]||=[];row.forEach((value,j)=>this.rows[r-1+i][c-1+j]=value);});}};},appendRow(row){this.rows.push(row);}});
 const quantities=sheet([['키','인원','품목','수량','시각','계정'],['d1|badge','d1','badge',1,'old','admin'],['d2|badge','d2','badge',9,'old','admin']]),saber=sheet([['ID'],['전대|대장생도','전대','전대','전대장','hidden','serial','정상','원래 내용','old','admin']]),tables=new Map([['예도현황',saber]]),ss={getSheetByName:name=>tables.get(name)||null,insertSheet(name){const result=sheet();tables.set(name,result);return result;}};
 const c=vm.createContext({Map,Set,PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key),setProperty:(key,value)=>props.set(key,value)})},SABER_V276:{TAB:'예도현황'},spreadsheet_:()=>ss,personalPersonV331_:()=>({person,ss}),rosterRequired_:()=>({}),rosterRows_:()=>people,smartPersonIdentityV322_:p=>[String(p.cohort).replace(/기$/,''),String(p.company).replace(/중대$/,''),p.name],dutyRosterRecordsV367_:()=>roster,dutyRosterPublicV367_:row=>({...row.data.source,id:row.id}),dutyItemDataV368_:()=>quantities.rows.slice(1).map(row=>row.map(String)),dutyItemSheetV368_:()=>quantities,dutyRoleInfoV367,dutySaberRoleV367,dutyOrgKeyV372,dutyItemRequirementsV368,personalHashV330_:value=>createHash('sha256').update(JSON.stringify(value)).digest('hex'),canonicalRepairStateV216_:value=>value,setupTab_:(sh,headers)=>sh.appendRow(headers),Utilities:{getUuid:()=>String(++counter)},iso_:()=>String(++counter),lockAndRun_:fn=>fn(),ensureRows_:()=>{},safeCell_:value=>value,config_:()=>({email:'admin'}),assetRequestAdminV336_:()=>{if(!admin)throw Error('권한 없음');}});
 vm.runInContext(dutyItemRequirementsV368.toString()+'\n'+read('scripts/personal-duty-server.gs.txt')+'\n'+read('scripts/duty-requests-server.gs.txt'),c);
 return {c,person,other,people,roster,ss,tables,quantities,saber,setAdmin:value=>admin=value};
}
test('근무생도 개인 조회는 기수·중대·이름이 일치하는 본인 물품만 반환하고 평생도는 숨긴다',()=>{
 const f=fixture(),result=f.c.personalDutyV400_(f.person,f.ss);assert.equal(result.isDuty,true);assert.equal(result.assignments.length,1);assert.equal(result.assignments[0].items[0].quantity,1);assert.equal(result.assignments[0].saber.status,'정상');assert.equal(JSON.stringify(result).includes('전대군수참모'),false);
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
test('예도 상태 요청과 확인 완료는 원본을 유지하며 수정 반영은 상태·세부사항만 갱신한다',()=>{
 const f=fixture(),duty=f.c.personalDutyV400_(f.person,f.ss),changes=[{key:'saber|전대|대장생도',value:{status:'교체 필요',detail:'검증 내용'}}];f.c.personalDutyRequestV400_({snapshot:duty.snapshot,changes});let request=f.c.getDutyRequestsV400().requests[0];f.c.resolveDutyRequestV400(request.id,'confirm',[],'확인만','대기');assert.equal(f.saber.rows[1][6],'정상');
 f.c.personalDutyRequestV400_({snapshot:duty.snapshot,changes});request=f.c.getDutyRequestsV400().requests[0];f.c.resolveDutyRequestV400(request.id,'apply',changes,'반영','대기');assert.equal(f.saber.rows[1][6],'교체 필요');assert.equal(f.saber.rows[1][7],'검증 내용');assert.equal(f.saber.rows[1][5],'serial');
});
test('평생도 탭이 기본이고 근무생도 탭은 인증된 배정 정보가 있을 때만 노출하며 로그아웃 시 초기화한다',()=>{
 const source=read('scripts/personal-duty-portal.js.txt');assert.match(source,/duty\.isDuty!==true/);assert.match(source,/personalDutyDraftsV400\.clear/);assert.match(source,/request\('duty-request'/);assert.match(read('docs/me/portal.js'),/personalDutyResetV400\(\);/);assert.match(read('docs/me/index.html'),/id="personalDutyTabV400"[^>]*hidden/);
});

test('개인 화면은 본인 물품만 요청하고 로그아웃 시 근무생도 탭·임시 입력을 비운다',async()=>{
 const nodes=new Map(),create=(tag='div')=>({tagName:tag.toUpperCase(),textContent:'',children:[],hidden:false,value:'',events:{},append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},setAttribute(key,value){this[key]=value;},addEventListener(name,fn){this.events[name]=fn;}}),get=id=>{if(!nodes.has(id))nodes.set(id,create());return nodes.get(id);};
 const calls=[],c=vm.createContext({$:get,element:(tag,text='')=>Object.assign(create(tag),{textContent:text}),document:{createElement:create},window:{addEventListener(){}},busy:false,token:'authenticated',ticket:1,request:async(path,body)=>{calls.push({path,body});return {requested:true};}});
 vm.runInContext(read('scripts/personal-duty-portal.js.txt'),c);c.personalDutyRenderV400({duty:null});assert.equal(get('personalDutyTabV400').hidden,true);
 c.personalDutyRenderV400({duty:{isDuty:true,snapshot:'signed-record-snapshot',assignments:[{id:'own-duty',duty:'보좌관',organization:'중대',items:[{item:'block',label:'블럭',required:2,quantity:1,shortage:1},{item:'badge',label:'흉장',required:0,quantity:0,shortage:0}]}]}});
 assert.equal(get('personalDutyTabV400').hidden,false);const card=get('personalDutyCardsV400').children[0],form=card.children.find(child=>child.tagName==='FORM'),labels=form.children.filter(child=>child.tagName==='LABEL');assert.equal(labels.length,1);
 labels[0].children[0].value='2';form.oninput();await form.onsubmit({preventDefault(){}});assert.equal(calls[0].path,'duty-request');assert.equal(calls[0].body.snapshot,'signed-record-snapshot');assert.equal(calls[0].body.changes[0].key,'own-duty|block');assert.equal(calls[0].body.changes[0].value.quantity,2);
 c.personalDutyResetV400();assert.equal(get('personalDutyTabV400').hidden,true);assert.equal(get('personalDutyCardsV400').children.length,0);assert.equal(get('personalRegularV400').hidden,false);
});
