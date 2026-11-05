import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';

const codeUrl=new URL('../Code.gs.txt',import.meta.url);
const hasCode=existsSync(codeUrl);
const source=hasCode?readFileSync(codeUrl,'utf8'):'';
function take(name){
 const start=source.indexOf('function '+name+'(');
 assert.notEqual(start,-1,name+' 함수가 필요합니다.');
 const end=source.indexOf('\n}\n',start);
 assert.notEqual(end,-1,name+' 함수 끝을 찾을 수 없습니다.');
 return source.slice(start,end+3);
}

test('현재는 정예관·점호열외(당직)을 포함하고 전체는 국외·파견만 제외한다',{skip:!hasCode},()=>{
 const context=vm.createContext({});
 vm.runInContext(['smartPresentNowV395_','laborStatusV259_','laborEligibilityStatusV392_','laborAbsentAllV259_','laborAbsentNowV259_'].map(take).join('\n'),context);
 const isCurrent=value=>!context.laborAbsentNowV259_(value);
 const isWhole=value=>!context.laborAbsentAllV259_(value);

 assert.equal(isCurrent(' 정 예 관 '),true);
 assert.equal(isCurrent(' 점호 열외 （ 당직 ） '),true);
 for(const status of ['특별외출','청원휴가','','국외','파견','기타'])assert.equal(isCurrent(status),false,status+'은 현재 인원이 아닙니다.');

 for(const status of ['정예관','특별외출','점호열외(당직)','청원휴가','','위탁','휴학','퇴교','기타'])assert.equal(isWhole(status),true,status+'은 전체 인원에 포함됩니다.');
 for(const status of ['국외','파견','국 외','장기 파견'])assert.equal(isWhole(status),false,status+'은 전체 인원에서 제외됩니다.');

 // 스마트당직 원본 상태가 있으면 뒤에 덧붙인 휴학·위탁 등의 참고 문구보다 우선합니다.
 assert.equal(isCurrent({locationStatus:'정예관',duty:'정예관 위탁 휴학'}),true);
 assert.equal(isWhole({locationStatus:'정예관',duty:'정예관 위탁 휴학'}),true);
 assert.equal(isCurrent({locationStatus:'점호열외(당직)',duty:'국외 파견'}),true);
 assert.equal(isWhole({locationStatus:'점호열외(당직)',duty:'국외 파견'}),true);
 // 과거 스냅샷처럼 전용 필드가 없으면 기존 duty 값을 안전하게 사용합니다.
 assert.equal(isWhole({duty:'국외'}),false);
 assert.equal(isCurrent({locationStatus:null,duty:'정예관'}),true);
});

test('그룹 인원과 독방 대상은 같은 현재·전체 상태 규칙을 사용한다',{skip:!hasCode},()=>{
 const context=vm.createContext({
  laborGradeSetV261_:()=>[],laborGradeMatchV261_:()=>true,
  laborPersonKeyV259_:p=>p.personKey||p.name,
  laborDistributionGroupKeyV268_:()=> '본관 · 1층',
  laborSoloPairStateV264_:()=>({pairs:{},blocked:[]}),
  laborMainCategoryV375_:()=>'',laborUnitV259_:value=>String(value||'').replace(/중대$/,'')
 });
 vm.runInContext([
  'smartPresentNowV395_','laborStatusV259_','laborEligibilityStatusV392_','laborAbsentAllV259_','laborAbsentNowV259_',
  'laborPhysicalKeyV260_','laborRoomOccupancyV260_','laborGroupsV259_','laborPairsV259_'
 ].map(take).join('\n'),context);

 const fixtures=[
  ['현재','정예관','위탁 휴학'],
  ['외출','특별외출','정예관'],
  ['열외','점호열외(당직)','정예관'],
  ['휴가','청원휴가','정예관'],
  ['빈칸','','정예관'],
  ['국외','국외','정예관'],
  ['파견','파견','정예관'],
  ['기타','위탁','국외 파견']
 ];
 const assigned=fixtures.map(([key,locationStatus,duty],i)=>{
  const room={id:'room-'+i,room:String(101+i),building:'본관',floor:'1층',slots:[]};
  return {personKey:key,name:'가상'+(i+1),cohort:'77',company:'1',roomId:room.id,room,matched:true,locationStatus,duty};
 });
 const smart={people:assigned.map(({room,roomId,matched,...person})=>person)};
 const groupCount=mode=>context.laborGroupsV259_('floor',mode,smart,assigned,'all').reduce((sum,row)=>sum+row.count,0);
 const pairs=mode=>context.laborPairsV259_(assigned,mode,'all',2,'floor');

 assert.equal(groupCount('current'),2);
 assert.equal(pairs('current').activeCount,2);
 assert.deepEqual(Array.from(pairs('current').singles.filter(p=>p.active),p=>p.key),['현재','열외']);
 assert.equal(groupCount('whole'),6);
 assert.equal(pairs('whole').activeCount,6);
 assert.equal(pairs('whole').pairs.length,3);
 assert.deepEqual(Array.from(pairs('whole').singles.filter(p=>p.active),p=>p.key),['현재','외출','열외','휴가','빈칸','기타']);
});

test('스마트당직 C/F/I/L 이름과 D/G/J/M 상태를 개인별로 함께 읽는다',{skip:!hasCode},()=>{
 const makeGrid=unit=>{
  const rows=[['','1학년','(78기)','','2학년','(77기)','','3학년','(76기)','','4학년','(75기)']];
  for(let row=1;row<=4;row++)rows.push([
   '',`가상${unit}일${row}`,'정예관','',`가상${unit}이${row}`,'국외',
   '',`가상${unit}삼${row}`,'파견','',`가상${unit}사${row}`,'점호열외(당직)'
  ]);
  while(rows.length<31)rows.push(Array(12).fill(''));
  return rows;
 };
 const sheets=new Map(Array.from({length:8},(_,i)=>{
  const unit=i+1,grid=makeGrid(unit);
  return [unit+'중대',{getName:()=>unit+'중대',getSheetId:()=>unit,getRange:()=>({getDisplayValues:()=>grid})}];
 }));
 const book={getSheetByName:name=>sheets.get(name)||null,getSheets:()=>[...sheets.values()]};
 const context=vm.createContext({
  text_:(value,max)=>String(value??'').trim().slice(0,max),
  SpreadsheetApp:{openById:()=>book},
  SMART_V253:{SOURCE_TAB:'스마트당직_비교원본'}
 });
 vm.runInContext(['smartCohortV253_','smartCohortHeaderV2541_','smartLiveV253_','smartLiveUnitV255_','smartSnapshotV253_'].map(take).join('\n'),context);

 const one=context.smartLiveUnitV255_({id:'book',gid:null},1);
 assert.equal(one.length,16);
 assert.deepEqual(Array.from(one.slice(0,4),p=>[p.cohort,p.company,p.name,p.cell,p.locationStatus]),[
  ['78기','1','가상1일1','C62','정예관'],
  ['78기','1','가상1일2','C63','정예관'],
  ['78기','1','가상1일3','C64','정예관'],
  ['78기','1','가상1일4','C65','정예관']
 ]);
 assert.deepEqual(Array.from([one[0],one[4],one[8],one[12]],p=>[p.name,p.cell,p.locationStatus]),[
  ['가상1일1','C62','정예관'],['가상1이1','F62','국외'],['가상1삼1','I62','파견'],['가상1사1','L62','점호열외(당직)']
 ]);
 assert.ok(one.every(p=>p.locationStatus===p.duty));

 const all=context.smartLiveV253_(book);
 assert.equal(all.length,128);
 assert.ok(all.every(p=>p.locationStatus===p.duty));

 const snapshotSheet={getLastRow:()=>2,getRange:()=>({getDisplayValues:()=>[['78기','1','가상스냅샷','1중대','C62','정예관']]})};
 const snapshot=context.smartSnapshotV253_({getSheetByName:()=>snapshotSheet});
 assert.equal(snapshot[0].locationStatus,'정예관');
 assert.equal(snapshot[0].duty,'정예관');
});
