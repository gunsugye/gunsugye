import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {dutyRoleInfoV367} from '../scripts/duty-roles.mjs';

function dutyContext(rows,options={}){
 const context=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='DUTY_ROSTER_MANUAL_V369'?'yes':''})},dutyRosterRecordsV367_:()=>rows.map((p,i)=>({id:'duty-'+i,data:{version:'manual-v369',source:p}})),dutyRosterPublicV367_:r=>r.data.source,dutyRoleInfoV367,...options});
 vm.runInContext(readFileSync(new URL('../scripts/smart-inactive.gs.txt',import.meta.url),'utf8').split('function smartAllStatusHintsV323_')[0]+'\n'+readFileSync(new URL('../scripts/labor-duty-groups.gs.txt',import.meta.url),'utf8'),context);return context;
}

function loadBuildingGroups(context){
 const code=readFileSync(new URL('../Code.gs.txt',import.meta.url),'utf8');
 for(const name of ['laborBuildingGroupKeyV361_','laborGroupsByBuildingV361_']){const start=code.indexOf('function '+name+'(');vm.runInContext(code.slice(start,code.indexOf('\n}\n',start)+3),context);}
}
test('근무생도 명단과 기수·중대·이름을 대조하며 생활실 조직으로 추정하지 않는다',()=>{const rows=[{cohort:'75',company:'4',name:'검증갑A',organization:'전대'},{cohort:'76',company:'2',name:'검증을',organization:'명예위'},{cohort:'77',company:'3',name:'검증병A',organization:'전대'},{cohort:'77',company:'3',name:'검증병B',organization:'동기회'}],c=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='DUTY_ROSTER_MANUAL_V369'?'yes':''})},dutyRosterRecordsV367_:()=>rows.map(p=>({data:{version:'manual-v369',source:p}})),dutyRosterPublicV367_:r=>r.data.source,dutyRoleInfoV367});vm.runInContext(readFileSync(new URL('../scripts/smart-inactive.gs.txt',import.meta.url),'utf8').split('function smartAllStatusHintsV323_')[0]+'\n'+readFileSync(new URL('../scripts/labor-duty-groups.gs.txt',import.meta.url),'utf8'),c);const assigned=[{cohort:'75기',company:'４중대',name:'검증갑',room:{building:'정예 본관',group:'동생명'}},{cohort:'76',company:'2',name:'검증을',room:{building:'정예 본관',group:'전(대)대'}},{cohort:'77',company:'3',name:'검증병',room:{building:'정예 본관',group:'동생명'}},{cohort:'78',company:'1',name:'미등록',room:{building:'정예 본관',group:'전(대)대'}}];c.laborAttachDutyV375_(assigned);assert.equal(c.laborMainCategoryV375_(assigned[0]),'전대·대대 근무');assert.equal(c.laborMainCategoryV375_(assigned[1]),'동생명');assert.equal(c.laborMainCategoryV375_(assigned[2]),'');assert.equal(c.laborMainCategoryV375_(assigned[3]),'');});
test('본관 특수 근무는 층별·중대별 모두 별도 행으로 계산하며 인원을 중복하지 않는다',()=>{const source=readFileSync(new URL('../scripts/labor-duty-groups.gs.txt',import.meta.url),'utf8'),c=vm.createContext({laborGradeSetV261_:()=>[],laborGradeMatchV261_:()=>true,laborAbsentNowV259_:()=>false,laborAbsentAllV259_:()=>false,laborPersonKeyV259_:p=>p.name,laborDistributionGroupKeyV268_:p=>p.company+'중대'});vm.runInContext(source,c);
 const code=readFileSync(new URL('../Code.gs.txt',import.meta.url),'utf8');for(const name of ['laborBuildingGroupKeyV361_','laborGroupsByBuildingV361_']){const start=code.indexOf('function '+name+'(');vm.runInContext(code.slice(start,code.indexOf('\n}\n',start)+3),c);}
 const people=[{name:'검증장',company:'1'},{name:'검증동기',company:'1'},{name:'검증일반',company:'1'},{name:'검증서관',company:'7'}],assigned=people.map((p,i)=>({...p,personKey:p.name,matched:true,dutyCategoryKnownV375:i<2,dutyCategoryV375:i===0?'전대·대대 근무':i===1?'동생명':'',room:{building:i===3?'정예 서관':'정예 본관',floor:'1층',group:i===0?'전(대)대':i===1?'동생명':'1중대'}}));for(const dim of ['floor','company']){const groups=c.laborGroupsByBuildingV361_('whole',{people},assigned,'all',{'정예 본관':dim,'정예 서관':dim});assert.equal(groups.reduce((s,g)=>s+g.count,0),4);assert.equal(groups.find(g=>g.label==='전대·대대 근무').count,1);assert.equal(groups.find(g=>g.label==='동생명').count,1);assert.equal(groups.filter(g=>g.building==='정예 본관').reduce((s,g)=>s+g.count,0),3);}
 assigned[0].dutyCategoryKnownV375=true;assigned[0].dutyCategoryV375='동생명';assert.equal(c.laborMainCategoryV375_(assigned[0]),'동생명');assigned[0].dutyCategoryV375='';assert.equal(c.laborMainCategoryV375_(assigned[0]),'');assert.equal(c.laborMainCategoryV375_(assigned[3]),'');
});

test('겸직은 일반 중대 근무와 함께 있어도 특수 분류를 유지하고 전대·대대와 동생명을 한 번만 배정한다',()=>{
 const people=['겸직갑','겸직을','겸직병','일반정'].map(name=>({cohort:'75',company:'1',name}));
 const rows=[{...people[0],organization:'전대'},{...people[0],organization:'중대'},{...people[1],organization:'중대'},{...people[1],organization:'명예위'},{...people[2],organization:'동기회'},{...people[2],organization:'2대대'},{...people[2],organization:'전대'},{...people[3],organization:'중대'}];
 const context=dutyContext(rows),assigned=people.map(p=>({...p,room:{building:'정예 본관'}}));context.laborAttachDutyV375_(assigned);
 assert.deepEqual(assigned.map(p=>context.laborMainCategoryV375_(p)),['전대·대대 근무','동생명','전대·대대 근무','']);
 rows.reverse();context.laborAttachDutyV375_(assigned);assert.deepEqual(assigned.map(p=>context.laborMainCategoryV375_(p)),['전대·대대 근무','동생명','전대·대대 근무','']);
 rows.splice(0,rows.length);context.laborAttachDutyV375_(assigned);assert.ok(assigned.every(p=>context.laborMainCategoryV375_(p)===''&&!p.dutyCategoryKnownV375));
});

test('동·서관 근무생도도 실제 거주 관을 유지하며 층별·중대별 분배에 한 번씩 반영한다',()=>{
 const people=[{cohort:'75',company:'1',name:'동관근무'},{cohort:'76',company:'7',name:'서관동생명'},{cohort:'77',company:'3',name:'동관일반'}];
 const rows=[{...people[0],organization:'전대'},{...people[0],organization:'중대'},{...people[1],organization:'생발위'},{...people[1],organization:'동기회'}];
 const context=dutyContext(rows,{laborGradeSetV261_:()=>[],laborGradeMatchV261_:()=>true,laborAbsentNowV259_:()=>false,laborAbsentAllV259_:()=>false,laborPersonKeyV259_:p=>p.name,laborDistributionGroupKeyV268_:(p,dim)=>dim==='company'?p.company+'중대':p.room.floor});loadBuildingGroups(context);
 const assigned=people.map((p,i)=>({...p,personKey:p.name,matched:true,room:{building:i===1?'정예 서관':'정예 동관',floor:i===0?'1층':'2층'}}));context.laborAttachDutyV375_(assigned);
 for(const dimension of ['floor','company']){const groups=context.laborGroupsByBuildingV361_('whole',{people},assigned,'all',{'정예 동관':dimension,'정예 서관':dimension});assert.equal(groups.reduce((sum,row)=>sum+row.count,0),3);assert.equal(groups.find(row=>row.building==='정예 동관'&&row.label==='전대·대대 근무').count,1);assert.equal(groups.find(row=>row.building==='정예 서관'&&row.label==='동생명').count,1);assert.equal(groups.filter(row=>row.building==='정예 동관').reduce((sum,row)=>sum+row.count,0),2);assert.equal(groups.some(row=>row.building==='정예 본관'),false);}
});

test('층별·중대별은 모든 관에 전대·대대와 동생명 빈 분류도 유지한다',()=>{
 const buildings=['정예 본관','정예 동관','정예 서관'],people=buildings.map((building,i)=>({cohort:'77',company:String(i+1),name:'일반'+i}));
 const context=dutyContext([],{laborGradeSetV261_:()=>[],laborGradeMatchV261_:()=>true,laborAbsentNowV259_:()=>false,laborAbsentAllV259_:()=>false,laborPersonKeyV259_:p=>p.name,laborDistributionGroupKeyV268_:p=>p.company+'중대'});loadBuildingGroups(context);
 const assigned=people.map((p,i)=>({...p,personKey:p.name,matched:true,room:{building:buildings[i],floor:'1층'}}));
 for(const dimension of ['floor','company']){const groups=context.laborGroupsByBuildingV361_('whole',{people},assigned,'all',Object.fromEntries(buildings.map(building=>[building,dimension])));assert.equal(groups.reduce((sum,row)=>sum+row.count,0),3);for(const building of buildings)for(const label of ['전대·대대 근무','동생명']){const special=groups.filter(row=>row.building===building&&row.label===label);assert.equal(special.length,1);assert.equal(special[0].count,0);assert.equal(special[0].source,0);}}
});

test('겸직 분배도 현재·전체 인원과 학년 필터를 적용하며 누락 호실·일반 인원을 중복하지 않는다',()=>{
 const people=[{cohort:'75',company:'1',name:'전대재실',duty:''},{cohort:'75',company:'2',name:'동생명재실',duty:''},{cohort:'76',company:'3',name:'일반재실',duty:''},{cohort:'75',company:'4',name:'겸직외출',duty:'외출'},{cohort:'75',company:'5',name:'전대위탁',duty:'위탁'},{cohort:'75',company:'6',name:'미배정',duty:''}];
 const rows=[{...people[0],organization:'전대'},{...people[0],organization:'중대'},{...people[1],organization:'명예위'},{...people[1],organization:'중대'},{...people[3],organization:'1대대'},{...people[3],organization:'동기회'},{...people[4],organization:'전대'}];
 const context=dutyContext(rows,{laborGradeSetV261_:grade=>grade==='all'?[]:[grade],laborGradeMatchV261_:(p,grades)=>!grades.length||grades.includes(p.cohort),laborAbsentNowV259_:duty=>/외출|위탁/.test(duty),laborAbsentAllV259_:duty=>/위탁/.test(duty),laborPersonKeyV259_:p=>p.name,laborDistributionGroupKeyV268_:(p,dim)=>dim==='company'?p.company+'중대':p.room.floor});loadBuildingGroups(context);
 const assigned=people.slice(0,5).map((p,i)=>({...p,personKey:p.name,matched:true,room:{building:'정예 본관',floor:i%2?'2층':'1층'}}));context.laborAttachDutyV375_(assigned);
 for(const dimension of ['floor','company'])for(const [mode,grade,total,command,society] of [['whole','all',5,2,1],['current','all',4,1,1],['whole','75',4,2,1]]){const groups=context.laborGroupsByBuildingV361_(mode,{people},assigned,grade,{'정예 본관':dimension});assert.equal(groups.reduce((sum,row)=>sum+row.count,0),total);assert.equal(groups.find(row=>row.label==='전대·대대 근무').count,command);assert.equal(groups.find(row=>row.label==='동생명').count,society);assert.equal(groups.find(row=>row.unlocated).count,1);}
});

test('관별 카드의 층별·중대별 표에는 해당 관의 전대·대대와 동생명 분배 행이 표시된다',()=>{
 const buildings=['정예 본관','정예 동관','정예 서관'],root={innerHTML:''},elements={laborBuildingRatesV357:root,laborModeV259:{value:'whole'},laborDivisorV259:{value:'2'},laborStatsV259:{before(){}}};
 const context=vm.createContext({$:id=>elements[id]||null,qsa:()=>[],escapeH:value=>String(value),laborFmtV259:value=>String(value),laborExplanationV324:()=>'',laborBuildingVisibilityV357:()=>{},document:{createElement:()=>({})}});
 const source=readFileSync(new URL('../scripts/labor-cards-client.js.txt',import.meta.url),'utf8'),start=source.indexOf('function laborBuildingRenderV357('),end=source.indexOf('\nfunction laborCardsDistributePairsV375',start);vm.runInContext('let laborMainSoloV374=null;\n'+source.slice(start,end),context);
 for(const dimension of ['floor','company']){
  const groups=buildings.flatMap((building,i)=>[{building,key:building+'|duty:전대·대대 근무',label:'전대·대대 근무',count:i+1,quota:(i+1)/2},{building,key:building+'|duty:동생명',label:'동생명',count:i+2,quota:(i+2)/2}]);context.laborBuildingRenderV357({buildings,groups,buildingDivisors:Object.fromEntries(buildings.map(building=>[building,2])),buildingDimensions:Object.fromEntries(buildings.map(building=>[building,dimension]))});
  const cards=root.innerHTML.split('<section class="labor-card-v374"').slice(1);assert.equal(cards.length,3);for(const [i,card] of cards.entries()){assert.match(card,new RegExp('data-labor-section="'+buildings[i]+'"'));assert.match(card,/<td>전대·대대 근무<\/td><td>\d명/);assert.match(card,/<td>동생명<\/td><td>\d명/);assert.ok(card.includes('value="'+dimension+'" selected'));}
 }
});
