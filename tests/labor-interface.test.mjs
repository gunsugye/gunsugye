import test from 'node:test';import assert from 'node:assert/strict';
import {distributionExplanation} from '../scripts/labor-interface.mjs';
import {readFileSync,existsSync} from 'node:fs';import vm from 'node:vm';

test('외출 항목은 원본 비고의 행 제목을 연결하고 중복 항목을 함께 표시한다',{skip:!existsSync(new URL('../Code.gs.txt',import.meta.url))},()=>{
 const source=readFileSync(new URL('../Code.gs.txt',import.meta.url),'utf8');
 const take=name=>{const start=source.indexOf('function '+name+'(');return source.slice(start,source.indexOf('\n}\n',start)+3);};
 const context=vm.createContext({});vm.runInContext(['dormTriplesV241_','dormOutingCategoriesV357_','dormNamesMatchedV240_'].map(take).join('\n'),context);
 const entries=[{text:'77.1.검증갑, 77.1.검증을',category:'특별외출'},{text:'77.1.검증갑',category:'청원휴가'},{text:'77.1.검증갑',category:'특별외출'},{text:'76.2.검증병',category:'입원'}];
 const result=context.dormOutingCategoriesV357_(entries);assert.equal(result.get('77.1.검증갑'),'특별외출 · 청원휴가');assert.equal(result.get('77.1.검증을'),'특별외출');assert.equal(result.get('76.2.검증병'),'입원');assert.equal(result.has('77.1.검증'),false);
 const matched=context.dormNamesMatchedV240_(entries.map(e=>e.text),[{cohort:'77',company:'1',name:'검증갑',roomId:'r1',verified:true}]);assert.equal(matched.matched,1);assert.equal(matched.records.length,1);
});

test('관별 기준은 각 관의 수량·잔여분을 계산하고 저장할 총수량을 보존한다',{skip:!existsSync(new URL('../Code.gs.txt',import.meta.url))},()=>{
 const source=readFileSync(new URL('../Code.gs.txt',import.meta.url),'utf8');
 const take=name=>{const start=source.indexOf('function '+name+'(');return source.slice(start,source.indexOf('\n}\n',start)+3);};
 const buildings=['정예 본관','정예 동관','정예 서관'],rooms=buildings.map((building,i)=>({id:String(i),building}));
 const people=Array.from({length:13},(_,i)=>({cohort:'77',company:'1',name:'검증'+i,duty:''}));
 const roster=people.slice(0,12).map((p,i)=>({...p,roomId:String(i<5?0:i<8?1:2)}));
 const context=vm.createContext({laborAttachDutyV375_:()=>{},LABOR_V259:{DIVISORS:[1,2,3,4,5,6]},LABOR_GRADES_V261:['all'],laborGradeSetV261_:()=>[],spreadsheet_:()=>({}),laborSmartV259_:()=>({people,byKey:new Map(people.map(p=>[p.name,p])),totals:{},source:'test'}),laborLivingV262_:()=>({rooms,roster}),laborPersonKeyV259_:p=>p.name,laborGroupsV259_:()=>[...buildings.map((key,i)=>({key,label:key,count:[5,3,4][i]})),{key:'호실 미확인',label:'호실 미확인',count:1}],laborPairsV259_:()=>({singles:[],pairs:[],unpaired:[]}),laborGradeMatchV261_:()=>true,laborAbsentAllV259_:()=>false,laborAbsentNowV259_:()=>false,config_:()=>({canEdit:true}),iso_:()=>'',laborDistributionGroupKeyV268_:p=>p.room.building});
 vm.runInContext(readFileSync(new URL('../scripts/labor-duty-groups.gs.txt',import.meta.url),'utf8').split('function laborAttachDutyV375_')[0],context);
 vm.runInContext(['laborBuildingDimensionsV361_','laborBuildingGroupKeyV361_','laborGroupsByBuildingV361_','laborBuildingRatiosV357_','laborRatioSummaryV357_','getLaborCalcV259','laborSnapshotV265_','laborSummaryV265_'].map(take).join('\n'),context);
 const result=context.getLaborCalcV259('whole','building',2,'all',{'정예 본관':2,'정예 동관':1,'정예 서관':1},{'정예 본관':'building','정예 동관':'building','정예 서관':'building'});
 const byKey=new Map(result.groups.map(g=>[g.key,g]));assert.deepEqual(buildings.map(b=>byKey.get(b).quota),[2.5,3,4]);assert.equal(byKey.get('호실 미확인').quota,.5);assert.equal(byKey.get('정예 본관').remainder,1);assert.equal(byKey.get('정예 동관').divisor,1);
 assert.deepEqual(Object.values(context.laborBuildingDimensionsV361_({},buildings,{})),['floor','floor','floor']);
 const snap=context.laborSnapshotV265_(result);assert.equal(snap.groups.reduce((s,g)=>s+g.quota,0),10);assert.equal(snap.buildingDivisors['정예 본관'],2);assert.match(context.laborSummaryV265_(snap),/정예 동관 1인 1개/);
 rooms.forEach(r=>r.floor='1층');rooms.push({id:'3',building:'정예 동관',floor:'2층'});roster[6].roomId='3';roster[0].company='2';people[0].company='2';context.laborDistributionGroupKeyV268_=(p,dim)=>dim==='company'?p.company+'중대':dim==='floor'?p.room.floor:p.room.building;
 const mixed=context.getLaborCalcV259('whole','building',2,'all',{'정예 본관':2,'정예 동관':1,'정예 서관':1},{'정예 본관':'company','정예 동관':'floor','정예 서관':'building'});
 assert.equal(mixed.groups.filter(g=>g.building==='정예 본관'&&g.count>0).length,2);assert.equal(mixed.groups.filter(g=>g.building==='정예 동관'&&g.count>0).length,2);assert.equal(mixed.groups.reduce((s,g)=>s+g.quota,0),10);
 const mixedSnap=context.laborSnapshotV265_(mixed);assert.equal(mixedSnap.buildingDimensions['정예 본관'],'company');assert.ok(mixedSnap.groups.some(g=>g.label==='정예 본관 · 2중대'));assert.ok(mixedSnap.groups.some(g=>g.label==='정예 동관 · 2층'));
 context.laborPairsV259_=()=>({singles:[],pairs:[{a:people[0].name,b:people[1].name}],unpaired:[]});
 const paired=context.getLaborCalcV259('whole','building',2,'all',{'정예 본관':2,'정예 동관':1,'정예 서관':1},{'정예 본관':'company','정예 동관':'floor'});
 const company2=paired.groups.find(g=>g.key==='정예 본관|2중대'),company1=paired.groups.find(g=>g.key==='정예 본관|1중대');assert.equal(company2.count,1);assert.equal(company2.allocationCount,2);assert.equal(company1.count,4);assert.equal(company1.allocationCount,3);assert.equal(paired.groups.reduce((s,g)=>s+g.quota,0),10);
 assert.throws(()=>context.getLaborCalcV259('whole','building',2,'all',{}, {'정예 본관':'invalid'}),/분배 단위/);
 assert.throws(()=>context.getLaborCalcV259('whole','building',2,'all',{'없는관':1}),/지급 기준/);
 assert.throws(()=>context.getLaborCalcV259('whole','company',2,'all',{}),/관별 계산/);
 assert.throws(()=>context.getLaborCalcV259('total','building',2,'all',{}),/관별 계산/);
 assert.throws(()=>context.getLaborCalcV259('whole','building',2,'all',{'정예 본관':0}),/지급 기준/);
 assert.equal(context.getLaborCalcV259('whole','building',2,'all').buildingDivisors,null);
});

test('1인 1개인 관은 자동·수동 독방 짝과 미지정에서 제외한다',{skip:!existsSync(new URL('../Code.gs.txt',import.meta.url))},()=>{
 const source=readFileSync(new URL('../Code.gs.txt',import.meta.url),'utf8'),start=source.indexOf('function laborPairsV259_('),fn=source.slice(start,source.indexOf('\n}\n',start)+3);
 const assigned=Array.from({length:4},(_,i)=>({personKey:'p'+i,cohort:'77',company:'1',matched:true,duty:'',room:{id:String(i),building:i<2?'본관':'동관',room:String(i)}}));
 const context=vm.createContext({laborGradeSetV261_:()=>[],laborGradeMatchV261_:()=>true,laborAbsentAllV259_:()=>false,laborAbsentNowV259_:()=>false,laborRoomOccupancyV260_:()=>({counts:new Map(assigned.map(p=>[p.room.id,1])),details:[]}),laborPhysicalKeyV260_:r=>r.id,laborSoloPairStateV264_:()=>({pairs:{p2:'p3'},blocked:[]}),laborUnitV259_:x=>x});vm.runInContext(readFileSync(new URL('../scripts/labor-duty-groups.gs.txt',import.meta.url),'utf8').split('function laborAttachDutyV375_')[0]+'\n'+fn,context);
 const result=context.laborPairsV259_(assigned,'whole','all',1,'building',{'본관':2,'동관':1});
 assert.equal(result.pairs.length,1);assert.equal(result.pairs[0].a,'p0');assert.equal(result.pairs[0].b,'p1');assert.equal(result.unpaired.length,0);assert.equal(result.singles.length,4);
 const bothTwo=context.laborPairsV259_(assigned,'whole','all',2,'building',{'본관':2,'동관':2});assert.equal(bothTwo.pairs.length,2);assert.equal(bothTwo.singles.length,4);assert.equal(bothTwo.activeCount,4);
});

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
