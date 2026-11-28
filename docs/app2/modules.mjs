const field=(key,label,type='text',options)=>({key,label,type,options});
const company=field('company','중대','select',['1','2','3','4','5','6','7','8']);
export const modules={
 journal:{table:'app2_journal',label:'업무일지',order:'work_date',fields:[field('work_date','일자','date'),company,field('category','분류'),field('title','제목'),field('status','상태','select',['예정','진행 중','완료']),field('details','내용','textarea')]},
 people:{table:'app2_people',label:'명단(총기번호) 관리',order:'name',fields:[field('cohort','기수','number'),company,field('name','이름'),field('cadet_number','교번'),field('firearm_number','총기번호'),field('status','학적','select',['재학','위탁','휴학','퇴교']),field('details','비고','textarea')]},
 rooms:{table:'app2_rooms',label:'생활실 관리',order:'room_number',fields:[field('building','관','select',['본관','동관','서관']),field('floor','층','number'),field('room_number','호실'),company,field('capacity','정원','number'),field('details','비고','textarea')]},
 labor:{table:'app2_labor',label:'사역 기록',order:'work_date',fields:[field('work_date','일자','date'),company,field('title','사역명'),field('headcount','인원','number'),field('hours','시간','number'),field('details','내용','textarea')]}
};
modules.people.fields.push(field('email','이메일','email'),field('phone','전화번호'));
modules.meals={table:'app2_meals',label:'식수 관리',order:'work_date',fields:[field('work_date','일자','date'),company,field('meal','식사','select',['조식','중식','석식']),field('headcount','식수 인원','number'),field('details','비고','textarea')]};
export function moduleFor(name){return {'일자별 업무일지':'journal','전체 업무 관리':'journal','명단(총기번호) 관리':'people','예비생도 관리':'people','생활실 방 관리':'rooms','사역 계산':'labor','사역 내역':'labor','식수 관리':'meals'}[name];}
export function normalizeRecord(kind,values){
 const config=modules[kind];if(!config)throw new Error('지원하지 않는 업무입니다.');
 const out={};
 for(const f of config.fields){const value=String(values[f.key]??'').trim();
  if(f.type==='number'||f.key==='company'){out[f.key]=value?Number(value):null;if(out[f.key]!==null&&!Number.isInteger(out[f.key]))throw new Error(`${f.label}: 정수를 입력하세요.`);}
  else out[f.key]=value;
  if(f.options&&value&&!f.options.includes(value))throw new Error(`${f.label}: 선택값을 확인하세요.`);
 }
 if(!['semester','training'].includes(values.mode))throw new Error('운영 구분을 확인하세요.');out.mode=values.mode;
 if(out.company!==null&&(out.company<1||out.company>8))throw new Error('중대를 확인하세요.');
 if(kind==='journal'&&(!/^\d{4}-\d{2}-\d{2}$/.test(out.work_date)||!out.title||!out.category||!out.status))throw new Error('일자, 분류, 제목, 상태를 입력하세요.');
 if(kind==='people'&&(!out.name||!out.company||!out.cohort||out.cohort<1||out.cohort>999||!out.status))throw new Error('기수, 중대, 이름, 학적을 입력하세요.');
 if(kind==='rooms'&&(!out.building||!out.room_number||!out.floor||out.floor<1||out.floor>20||!out.capacity||out.capacity<1||out.capacity>20))throw new Error('관, 층(1~20), 호실, 정원(1~20)을 입력하세요.');
 if(kind==='labor'&&(!out.title||!out.company||!out.work_date||out.headcount===null||out.headcount<0||out.hours===null||out.hours<0))throw new Error('일자·중대·사역명·인원·시간을 확인하세요.');
 if(kind==='meals'&&(!out.company||!out.work_date||!out.meal||out.headcount===null||out.headcount<0))throw new Error('일자·중대·식사·식수 인원을 확인하세요.');
 return out;
}
