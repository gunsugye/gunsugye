import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync,existsSync} from 'node:fs';import {createHash} from 'node:crypto';
import {correctDormSource} from '../scripts/dorm-corrections.mjs';
const code=readFileSync(new URL('../scripts/dorm-plan-server.gs.txt',import.meta.url),'utf8');
test('국외와 파견 인원은 누락에서 제외하고 스마트당직에 없는 배정자는 퇴교로 표시한다',()=>{
 const f=fixture(),reference=[{name:'검증가A',cohort:'77기',company:'3',duty:'국외'},{name:'검증나',cohort:'76기',company:'8',duty:'파견'}];
 const r=f.c.dormPlanCompareV318_([{members:[{name:'검증다',cohort:'77',company:'7'}]}],reference);
 assert.equal(r.missingRoom.length,0);assert.equal(r.excludedCount,2);assert.equal(r.missingSmart[0].status,'퇴교');
 assert.equal(f.c.dormPlanKeyV315_({building:'별관',floor:'1층',room:'132-1'}),f.c.dormPlanKeyV315_({building:'별관',floor:'1층',room:'132-8'}));
});
test('중대별 상태 명단을 같은 소속 범위에서 대조하고 별도 위탁 명단도 읽는다',()=>{
 const source=readFileSync(new URL('../scripts/smart-inactive.gs.txt',import.meta.url),'utf8');
 const sheets=Array.from({length:8},(_,i)=>({name:(i+1)+'중대',id:i,grid:i===2?[['위탁','검증가'],['1','검증다','국외','검증라']]:[['현황','']]})).concat([{name:'위탁명단',id:8,grid:[['이름'],['검증나']]}]);
 sheets.forEach(s=>Object.assign(s,{getName:()=>s.name,getSheetId:()=>s.id,getLastRow:()=>s.grid.length,getLastColumn:()=>2,getRange:()=>({getDisplayValues:()=>s.grid})}));
 const book={getId:()=> 'book',getSheetByName:n=>sheets.find(s=>s.name===n),getSheets:()=>sheets};
 const c=vm.createContext({smartReferenceHintsV255_:()=>({url:'',rows:[]}),smartConfiguredV255_:()=>Object.fromEntries(Array.from({length:8},(_,i)=>[String(i+1),'url'+i])),smartUrlV255_:()=>({id:'book',gid:0}),SpreadsheetApp:{openById:()=>book}});vm.runInContext(source,c);
 const hints=c.smartAllStatusHintsV323_();assert.equal(hints.readOk,true);assert.ok(hints.rows.some(r=>r.sheet==='위탁명단'));
 const people=[{name:'검증가A',cohort:'77',company:'3'},{name:'검증가B',cohort:'77',company:'8'},{name:'검증나',cohort:'76',company:'8'}];
 const key=p=>[p.cohort,p.company,p.name].join('|'),excluded=c.smartInactiveKeysV322_(people,hints.rows,['위탁'],key);
 assert.ok(excluded.has(key(people[0])));assert.equal(excluded.has(key(people[1])),false);assert.ok(excluded.has(key(people[2])));
 assert.equal(hints.rows.some(r=>r.company==='3'&&r.status==='국외'),false);
});
test('숫자 접미사와 방 소속 중대는 양방향으로 갱신하며 기본 번호와 ID를 유지한다',{skip:!existsSync(new URL('../Code.gs.txt',import.meta.url))},()=>{
 const f=fixture(),source=readFileSync(new URL('../Code.gs.txt',import.meta.url),'utf8'),start=source.indexOf('function dormCheckV234_('),end=source.indexOf('function dormValuesV234_',start);
 f.c.dormGroupV242_=(group)=>group;f.c.dormPurposeV250_=(group)=>group;vm.runInContext(source.slice(start,end),f.c);
 const old=f.books[0].room;
 const suffix=f.c.dormCheckV234_({...old,room:'343-5'},old);assert.equal(suffix.group,'5중대');assert.equal(suffix.id,old.id);
 const group=f.c.dormCheckV234_({...old,group:'7중대'},old);assert.equal(group.room,'343-7');assert.equal(group.id,old.id);
});
test('전각 중대·기수 접미사·일대일 이름 별칭은 대조하되 실제 미등재와 동명이인은 유지한다',()=>{
 const f=fixture(),p=(name,cohort,company)=>({name,cohort,company});
 const reference=[p('검증가A','77기','3'),p('검증나B','77기','3'),p('검증다','77기','4'),p('검증라','76기','7'),p('검증마','76기','8')];
 const members=[p('검증나','77','3'),p('검증다','77','４'),p('검증바','77','7'),p('검증라','76','７'),p('검증사','77','8')];
 const r=f.c.dormPlanCompareV318_([{members}],reference);assert.deepEqual(Array.from(r.missingRoom,p=>p.name),['검증가A','검증마']);assert.deepEqual(Array.from(r.missingSmart,p=>p.name),['검증바','검증사']);
 const ambiguous=f.c.dormPlanCompareV318_([{members:[p('검증나','77','3')]}],[p('검증나A','77기','3'),p('검증나B','77기','3')]);assert.equal(ambiguous.missingRoom.length,2);assert.equal(ambiguous.missingSmart.length,1);
 const bothMarked=f.c.dormPlanCompareV318_([{members:[p('검증나A','77','3')]}],[p('검증나B','77기','3')]);assert.equal(bothMarked.missingRoom.length,1);
});
test('퇴학·퇴교와 참고 명단 별칭을 방 배정 누락에서 제외한다',()=>{
 const f=fixture(),reference=[{name:'검증가A',cohort:'77기',company:'3',duty:'퇴 학'},{name:'검증나',cohort:'77기',company:'3',duty:'퇴교'},{name:'검증다B',cohort:'77기',company:'4'}];
 const r=f.c.dormPlanCompareV318_([],reference,[{status:'퇴학',preview:[{value:'검증다'}]}]);assert.equal(r.missingRoom.length,0);assert.equal(r.excludedCount,3);
});
test('도면에 없는 신규 표 호실도 배치도에서 편집할 수 있고 원본 줄은 유지한다',()=>{
 const client=readFileSync(new URL('../scripts/dorm-plan-client.js.txt',import.meta.url),'utf8'),c=vm.createContext({});vm.runInContext(client,c);
 const room={building:'별관',floor:'1층',room:'132'},plan={layout:[{...room,room:'131',page:1,x:0,y:0}],rooms:[room]};
 c.dormPlanAddUnplacedV320(plan);assert.equal(plan.layout.length,2);assert.equal(plan.layout[1].room,'132');assert.equal(plan.layout[1].unplaced,true);assert.equal(plan.layout[0].page,1);
 c.dormPlanAddUnplacedV320(plan);assert.equal(plan.layout.length,2);
});
test('저장 성공 시 관련 화면을 무효화하고 실패한 저장은 갱신하지 않는다',async()=>{
 const client=readFileSync(new URL('../scripts/dorm-plan-client.js.txt',import.meta.url),'utf8'),events=[],timers=[];let fail=false;
 const node={addEventListener:(...args)=>events.push(args)};
 const c=vm.createContext({$:()=>node,window:{addEventListener(){}},server:async()=>{if(fail)throw Error('저장 실패');return {ok:true};},dormOpenV234(){},setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout(){},view:'dorm',repairLoaded:true,assetDataV244:{},laborResultV259:{},dormLoadedV234:true,rosterLoaded:true,supplyLoaded:true,eqLoaded:true,smartReportV253:{},departuresDataV305:{}});
 vm.runInContext(client+';dormPlanInitV315();',c);await c.server('saveDormV234',{});
 assert.equal(c.dormLoadedV234,false);assert.equal(c.assetDataV244,null);assert.equal(c.laborResultV259,null);assert.equal(c.repairLoaded,false);assert.equal(timers.length,1);
 c.dormLoadedV234=true;fail=true;await assert.rejects(c.server('saveDormV234',{}));assert.equal(c.dormLoadedV234,true);assert.equal(timers.length,1);
});
test('스마트 당직에만 있는 휴학·위탁 인원을 제외하되 동명이인과 부분 이름은 남긴다',()=>{
 const f=fixture(),person=(name,company='1',duty='')=>({name,company,cohort:'78',duty});
 const reference=[person('검증가','1','휴 학'),person('검증나'),person('검증다'),person('검증다','2'),person('검증라'),person('검증마'),person('검증바','1','위탁')];
 const hints=[{status:'휴학',preview:[{value:'78.1.검증나, 검증다'}]},{status:'위탁',preview:[{value:'검증라마'}]}];
 const result=f.c.dormPlanCompareV318_([],reference,hints);
 assert.equal(result.excludedCount,3);assert.deepEqual(Array.from(result.missingRoom,p=>p.name),['검증다','검증다','검증라','검증마']);
 f.c.smartReferenceV253_=()=>({items:reference});f.c.smartReferenceHintsV255_=()=>({url:'configured',rows:[],warning:'조회 실패'});
 assert.equal(f.c.getDormPlanV315().comparison.error,'조회 실패');
});
test('도면에만 있는 방은 접미사 변경과 최초 배정을 함께 저장한다',()=>{
 const f=fixture(),source={building:'정예 본관',floor:'1층',room:'132'};
 f.c.DORM_PLAN_DEFAULT_V315_.layout=[{...source,page:1,x:.1,y:.1,width:.1,height:.1}];
 const p=f.c.getDormPlanV315();
 f.c.saveDormPlanV315({version:p.version,changes:[{...source,previousRoom:'132',room:'132-1',token:'new',members:[{cohort:'78',company:'1',name:'검증다'}]}]});
 assert.equal(f.writes.filter(w=>w.members).length,2);assert.equal(f.savedPlans[0].layout[0].room,'132-1');
 const g=fixture();assert.throws(()=>g.c.saveDormPlanV315({version:'initial-v315',changes:[{...source,previousRoom:'131',room:'132-1',token:'new',members:[]}]}));assert.equal(g.writes.length,0);
});
test('기수와 중대를 포함해 양방향 누락을 구분하고 조회 실패는 누락으로 표시하지 않는다',()=>{
 const f=fixture(),same={cohort:'78',company:'1',name:'검증가'},other={cohort:'77기',company:'2',name:'검증나'};
 const r=f.c.dormPlanCompareV318_([{building:'별관',floor:'1층',room:'132',members:[same]}],[{...same,cohort:'78기'},other]);
 assert.equal(r.missingRoom.length,1);assert.equal(r.missingRoom[0].name,'검증나');assert.equal(r.missingSmart.length,0);
 assert.equal(f.c.dormPlanCompareV318_([{members:[same]}],[{...same,company:'2'}]).missingSmart.length,1);
 assert.ok(f.c.dormPlanCompareV318_([],[]).error);assert.ok(f.c.getDormPlanV315().comparison.error);
});
function fixture(){
 const properties=new Map(),writes=[],backups=[],books=[],savedPlans=[];
 for(const id of ['main','linked']){
  const room={id:id+'-room',building:'정예 동관',floor:'3층',corridor:'복도',room:'343-3',group:'3중대',capacity:2,outsideCount:1,updatedAt:'old',slots:[{occupied:true},{occupied:true}]};
  const entries=[{cohort:'75',company:'3',name:'검증가',status:'확인'},{cohort:'76',company:'3',name:'검증나',status:'확인'}];
  const raw=Array(43).fill('');raw[0]=room.id;raw[4]=room.room;raw[9]='old';raw[15]='75';raw[17]='검증가';raw[22]='76';raw[24]='검증나';
  const ss={getId:()=>id},sh={getLastRow:()=>2,getMaxColumns:()=>43,getRange:(row,col,n=1,w=1)=>({getValues:()=>row===2&&n===1?[raw.slice(col-1,col-1+w)]:[],setValues:v=>{assert.equal(backups.length,2);writes.push({id,row,col,values:JSON.parse(JSON.stringify(v))});}}),copyTo:()=>({setName:name=>{backups.push({id,name});},getName:()=>id+' backup'})};ss.getSheetByName=()=>sh;
  ss.getSheetByName=()=>null;books.push({ss,sh,room,raw,entries});
 }
 let allowed=true;
 const c=vm.createContext({
  DORM_PLAN_DEFAULT_V315_:{filename:'test.pdf',base64:'JVBERi0xLjQK',layout:[]},requireOwner_:()=>{if(!allowed)throw Error('권한 없음');},lockAndRun_:f=>f(),spreadsheet_:()=>books[0].ss,livingSourceV272_:()=>({id:'linked'}),SpreadsheetApp:{openById:id=>books.find(b=>b.ss.getId()===id).ss,flush(){}},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v)})},
  dormTabV234_:ss=>books.find(b=>b.ss===ss).sh,dormReadV234_:sh=>[books.find(b=>b.sh===sh).room],
  dormRosterReadV240_:ss=>{const b=books.find(b=>b.ss===ss);return b.entries.map(p=>({...p,roomId:b.room.id,verified:true}));},
  dormUnifiedReadV248_:ss=>{const b=books.find(b=>b.ss===ss),r={...b.room,row:2,entries:b.entries};return {sh:b.sh,list:[r],byId:new Map([[r.id,r]])};},
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_alg,s)=>createHash('sha256').update(s).digest(),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),getUuid:()=> 'new-version'},
  text_:(v,n)=>String(v||'').trim().slice(0,n),iso_:()=> 'new',
  dormCheckV234_:(payload,old)=>({...payload,id:old?.id||'new-room'}),dormValuesV234_:r=>[r.id,r.building,r.floor,r.corridor,r.room,r.capacity,JSON.stringify(r.slots),'',r.verified?'Y':'N','new',r.femaleRoom?'Y':'N','',false,r.outsideCount,r.group],
  dormEnsureUnifiedV248_:ss=>books.find(b=>b.ss===ss).sh,ensureRows_:()=>{},
  dormUnifiedSaveV248_:(sh,r,members)=>{assert.equal(backups.length,2);writes.push({id:books.find(b=>b.sh===sh).ss.getId(),members:JSON.parse(JSON.stringify(members)),row:r.row});},protectLimitedSheetV226_:()=>{},DriveApp:{createFile:()=>({getId:()=> 'plan-file'})}
 });vm.runInContext(readFileSync(new URL('../scripts/smart-inactive.gs.txt',import.meta.url),'utf8')+'\n'+code,c);
 c.smartAllStatusHintsV323_=()=>c.smartReferenceHintsV255_();
 c.DriveApp.createFile=(_name,data)=>{savedPlans.push(JSON.parse(data));return {getId:()=> 'plan-file'};};
 return {c,books,writes,backups,properties,savedPlans,deny:()=>allowed=false};
}
test('도면 배정 저장은 호실 ID를 유지하며 두 연결 파일의 인원과 통합명단을 함께 갱신한다',()=>{
 const f=fixture(),plan=f.c.getDormPlanV315(),room=plan.rooms[0];
 const result=f.c.saveDormPlanV315({version:plan.version,changes:[{...room,members:[{cohort:'75',company:'3',name:'검증가'}]}]});
 assert.equal(result.files,2);assert.equal(f.backups.length,2);
 for(const book of f.books){const record=f.writes.find(w=>w.id===book.ss.getId()&&w.col===1).values[0];assert.equal(record[0],book.room.id);assert.equal(JSON.parse(record[6]).filter(s=>s.occupied).length,1);assert.equal(record[13],1);assert.equal(f.writes.find(w=>w.id===book.ss.getId()&&w.members).members.length,1);}
});
test('오래된 호실 버전·불완전한 기수·권한 없는 요청은 백업과 수정 전에 차단한다',()=>{
 for(const kind of ['stale','identity','denied']){
  const f=fixture(),plan=f.c.getDormPlanV315(),room=plan.rooms[0];if(kind==='stale')room.token='old';if(kind==='identity')room.members[0].cohort='';if(kind==='denied')f.deny();
  assert.throws(()=>f.c.saveDormPlanV315({version:plan.version,changes:[room]}));assert.equal(f.writes.length,0);assert.equal(f.backups.length,0);
 }
});
test('확인한 두 사람의 원본 정정만 적용하며 다른 호실의 동명이인은 바꾸지 않는다',()=>{
 const fix={building:'정예 동관',floor:'3층',fromRoom:'343-4',room:'343-3',cohort:'75',company:'3',group:'3중대',names:['검증가','검증나']};
 const rows=[['정예 동관','3층','복도','343-4','76','4','검증나','N','확인'],['정예 본관','2층','복도','259','76','4','검증나','N','확인']];
 const output=correctDormSource('const DORM_PDF_ROSTER_V241='+JSON.stringify(rows)+';',fix);const result=JSON.parse(output.match(/=(.*);/)[1]);
 assert.deepEqual(result[0].slice(3,6),['343-3','75','3']);assert.deepEqual(result[1],rows[1]);
});
test('PDF 갱신은 미검토 배정을 변경하지 않고 문서 버전을 검사한다',()=>{
 const f=fixture(),p=f.c.getDormPlanV315();
 const result=f.c.saveDormPlanV315({version:p.version,changes:[],pdf:{filename:'new.pdf',base64:'JVBERi0xLjQK',layout:[{building:'정예 동관',floor:'3층',room:'343-3',page:8,x:.1,y:.1,width:.1,height:.1,fullBox:true}]}});
 assert.equal(result.rooms,0);assert.equal(f.writes.length,0);assert.equal(f.properties.get('DORM_PLAN_FILE_V315'),'plan-file');
 const g=fixture();assert.throws(()=>g.c.saveDormPlanV315({version:'stale',changes:[]}));
});
test('일반 배치도 조회에는 PDF 본문을 보내지 않으며 갱신 분석 시에만 요청한다',()=>{
 const f=fixture(),light=f.c.getDormPlanV315();assert.equal(Object.hasOwn(light,'base64'),false);assert.equal(f.c.getDormPlanV315(true).base64,'JVBERi0xLjQK');assert.equal(light.rooms.length,1);
});
test('호실 접미사 변경은 두 파일의 ID와 배정자 중대를 유지하고 도면 원본 좌표를 보존한다',()=>{
 const f=fixture();f.c.DORM_PLAN_DEFAULT_V315_.layout=[{building:'정예 동관',floor:'3층',room:'343-3',sourceRoom:'343-4',page:8,x:.1,y:.1,width:.1,height:.1}];
 const p=f.c.getDormPlanV315(),r=p.rooms[0];
 f.c.saveDormPlanV315({version:p.version,changes:[{...r,previousRoom:r.room,room:'343-1'}]});
 for(const b of f.books){const row=f.writes.find(w=>w.id===b.ss.getId()&&w.col===1).values[0];assert.equal(row[0],b.room.id);assert.equal(row[4],'343-1');assert.equal(row[14],'1중대');assert.equal(f.writes.find(w=>w.id===b.ss.getId()&&w.members).members[0].company,'3');}
 assert.equal(f.savedPlans[0].layout[0].room,'343-1');assert.equal(f.savedPlans[0].layout[0].sourceRoom,'343-4');
});
test('이미 있는 호실 번호로 변경하거나 동일한 원본 호실을 두 번 변경하면 쓰기 전에 차단한다',()=>{
 for(const collision of [true,false]){const f=fixture(),p=f.c.getDormPlanV315(),r=p.rooms[0];
 if(collision){const read=f.c.dormReadV234_;f.c.dormReadV234_=sh=>read(sh).concat(sh===f.books[1].sh?[{...f.books[1].room,id:'another-room',room:'343-1'}]:[]);}
 const changes=[{...r,previousRoom:r.room,room:'343-1'}];if(!collision)changes.push({...r,previousRoom:r.room,room:'343-2'});
 assert.throws(()=>f.c.saveDormPlanV315({version:p.version,changes}));assert.equal(f.backups.length,0);assert.equal(f.writes.length,0);}
});
test('여러 호실의 접미사 차이를 연결하고 고정 ID로 이후 번호 수정까지 유지한다',()=>{
 const f=fixture(),rooms=Array.from({length:30},(_,i)=>({id:'r'+i,building:'정예 본관',floor:'1층',room:String(132+i)+'-1'}));
 const layout=rooms.map(r=>({building:r.building,floor:r.floor,room:r.room.split('-')[0],page:1,x:.1,y:.2}));
 const bound=f.c.dormPlanBindLayoutV321_(layout,rooms);assert.equal(bound.length,30);
 bound.forEach((a,i)=>{assert.equal(a.roomId,rooms[i].id);assert.equal(a.room,rooms[i].room);assert.equal(a.sourceRoom,layout[i].room);assert.equal(a.x,.1);});
 const renamed=rooms.map(r=>({...r,room:r.room.replace('-1','-2')})),again=f.c.dormPlanBindLayoutV321_(bound,renamed);
 assert.equal(again[0].room,'132-2');assert.equal(again[0].roomId,'r0');assert.equal(again[0].sourceRoom,'132');
 const ambiguous=f.c.dormPlanBindLayoutV321_([layout[0]],[rooms[0],{...rooms[0],id:'other',room:'132-2'}]);assert.ok(ambiguous[0].linkWarning);assert.equal(ambiguous[0].roomId,undefined);
});
test('배치도와 아래 표는 같은 명단 조회를 사용하고 연결 파일의 옛 표기를 중복 표시하지 않는다',()=>{
 const f=fixture();f.books[1].room.room='343';
 f.c.dormRosterReadV240_=ss=>[{roomId:f.books.find(b=>b.ss===ss).room.id,cohort:'78',company:'3',name:ss===f.books[0].ss?'표의최신명단':'연결파일옛명단',verified:true}];
 f.c.DORM_PLAN_DEFAULT_V315_.layout=[{building:'정예 동관',floor:'3층',room:'343',page:1,x:.1,y:.1}];
 const p=f.c.getDormPlanV315();assert.equal(p.rooms.length,1);assert.equal(p.rooms[0].members[0].name,'표의최신명단');assert.equal(p.layout[0].room,'343-3');assert.equal(p.layout[0].roomId,'main-room');
 f.c.saveDormPlanV315({version:p.version,changes:[{...p.rooms[0],members:[{cohort:'78',company:'3',name:'저장명단'}]}]});
 for(const b of f.books){const write=f.writes.find(w=>w.id===b.ss.getId()&&w.col===1);assert.equal(write.row,2);assert.equal(write.values[0][0],b.room.id);assert.equal(write.values[0][4],'343-3');}
});
test('PDF의 불완전한 명단도 기준본과 두 파일에 기록하며 이후 수동 편집에는 검증을 적용한다',()=>{
 const f=fixture(),p=f.c.getDormPlanV315(),room=p.rooms[0],member={name:'PDF이름',cohort:'',company:'3'};
 f.c.saveDormPlanV315({version:p.version,pdfImport:true,pdf:{filename:'new.pdf',base64:'JVBERi0xLjQK',layout:[{building:room.building,floor:room.floor,room:room.room,page:1,x:.1,y:.1,width:.1,height:.1,pdfMembers:[member]}]},changes:[{...room,members:[member]}]});
 assert.equal(f.savedPlans[0].layout[0].roomId,room.id);assert.equal(f.savedPlans[0].layout[0].pdfMembers[0].name,'PDF이름');
 for(const b of f.books){assert.equal(f.writes.find(w=>w.id===b.ss.getId()&&w.members).members[0].status,'PDF확인필요');assert.equal(f.properties.get('DORM_ROOM_OVERRIDE_V321_'+b.ss.getId()+'_'+b.room.id),'1');}
 assert.throws(()=>f.c.dormPlanValidateMembersV315_([member],2));
});
test('수정한 방의 이전 명단은 되살리지 않고 다른 방의 기존 명단은 유지한다',{skip:!existsSync(new URL('../Code.gs.txt',import.meta.url))},()=>{
 const source=readFileSync(new URL('../Code.gs.txt',import.meta.url),'utf8'),start=source.indexOf('function dormRosterReadV240_('),end=source.indexOf('function dormUnifiedReadyV249_',start);
 const props={'DORM_ROOM_OVERRIDE_V321_main_room-a':'1'},c=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperties:()=>props})},dormUnifiedReadyV249_:()=>false,dormUnifiedRosterReadV248_:()=>[],dormLegacyRosterReadV249_:()=>[{roomId:'room-a',name:'제외한이름'},{roomId:'room-b',name:'유지할이름'}]});
 vm.runInContext(source.slice(start,end),c);const result=c.dormRosterReadV240_({getId:()=> 'main'});assert.equal(result.length,1);assert.equal(result[0].roomId,'room-b');
});
