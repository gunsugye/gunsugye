const calendarShift = function calendarShift(day, amount) {
  const date = new Date(day + 'T00:00:00Z'); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10);
};
const calendarEscape = function calendarEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
};
const calendarSegments = function calendarSegments(entries, start, count, today) {
  const end = calendarShift(start, count - 1), seen = new Set();
  const ranges = entries.filter(e => e.id && /^\d{4}-\d{2}-\d{2}$/.test(e.date || '')).flatMap(entry => {
    if (seen.has(entry.id)) return []; seen.add(entry.id);
    let finish = entry.date;
    if (entry.workType === 'long') {
      finish = entry.status === '완료' ? entry.completedOn || entry.date : entry.due ? [entry.date, entry.due, today].sort().pop() : end;
    }
    if (finish < start || entry.date > end) return [];
    return [{ entry, start: entry.date, end: finish }];
  }).sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end) || String(a.entry.id).localeCompare(String(b.entry.id)));
  const weeks = [], previous = new Map();
  for (let offset = 0; offset < count; offset += 7) {
    const first = calendarShift(start, offset), last = calendarShift(first, 6), occupied = [], segments = [];
    for (const range of ranges) {
      if (range.end < first || range.start > last) continue;
      const from = range.start < first ? first : range.start, to = range.end > last ? last : range.end;
      const column = Math.round((Date.parse(from) - Date.parse(first)) / 86400000), span = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
      const free = lane => !occupied[lane]?.some(([a, b]) => column <= b && column + span - 1 >= a);
      let lane = previous.get(range.entry.id) ?? 0;
      if (!free(lane)) { lane = 0; while (!free(lane)) lane++; }
      occupied[lane] ||= []; occupied[lane].push([column, column + span - 1]); previous.set(range.entry.id, lane);
      segments.push({ entry: range.entry, column, span, lane, continuesBefore: range.start < first, continuesAfter: range.end > last });
    }
    weeks.push({ first, lanes: Math.max(1, occupied.length), segments });
  }
  return weeks;
};
const calendarHTML = function calendarHTML(entries, options) {
  const { start, count, today, selected, month, training = false, miniMode = '', details = {} } = options;
  const esc = calendarEscape;
  const headings = ['일','월','화','수','목','금','토'].map(d => `<div class="wx-weekday">${d}</div>`).join('');
  return headings + calendarSegments(entries, start, count, today).map(week => {
    const days = Array.from({ length: 7 }, (_, column) => {
      const day = calendarShift(week.first, column), other = day.slice(0, 7) !== month;
      const action = miniMode ? `data-v298-date="${day}" data-v298-mode="${miniMode}"` : `${training ? 'data-v292-day' : 'data-wx-day'}="${day}"`;
      return `<button type="button" class="wx-day range-day${day === selected ? ' selected' : ''}${day === today ? ' today' : ''}${other ? ' range-other-month' : ''}" ${action} aria-label="${day}"><strong>${Number(day.slice(-2))}</strong><div class="range-day-details">${details[day] || ''}</div></button>`;
    }).join('');
    const bars = week.segments.map(segment => {
      const { entry, column, span, lane, continuesBefore, continuesAfter } = segment;
      const state = { '완료': 'done', '진행 중': 'running', '보류': 'hold' }[entry.status] || 'pending';
      const type = entry.workType === 'long' ? '장기업무' : '당일업무';
      const description = `${type} · ${entry.title} · ${entry.status} · 시작 ${entry.date}${entry.time ? ' ' + entry.time : ''}${entry.due ? ' · 마감 ' + entry.due + (entry.dueTime ? ' ' + entry.dueTime : '') : entry.workType === 'long' && !entry.completedOn ? ' · 종료 미정' : ''}${entry.completedOn ? ' · 완료 ' + entry.completedOn : ''}`;
      return `<button type="button" class="calendar-range range-${state}${entry.workType === 'long' ? ' range-long' : ' range-daily'}${continuesBefore ? ' range-before' : ''}${continuesAfter ? ' range-after' : ''}" style="grid-column:${column + 1}/span ${span};grid-row:${lane + 1}" data-calendar-entry="${esc(entry.id)}" title="${esc(description)}" aria-label="${esc(description)}"><span aria-hidden="true">${continuesBefore ? '‹ ' : ''}</span><span class="range-title">${entry.time ? esc(entry.time) + ' ' : ''}${esc(entry.title)}${entry.dueTime ? ' · 마감 ' + esc(entry.dueTime) : ''}</span><span class="range-status">${entry.status === '완료' ? '✓' : continuesAfter ? '›' : ''}</span></button>`;
    }).join('');
    return `<div class="calendar-range-week" style="--range-lanes:${week.lanes}">${days}<div class="calendar-range-layer">${bars}</div></div>`;
  }).join('');
};
const navModelV301_ = function normalizeNavigation(value, defaults, available) {
  const known = new Map(defaults.map(g => [g.id, g]));
  const allowed = new Set(available), used = new Set(), groups = [];
  const valid = value && Array.isArray(value.groups);
  const modern = valid && value.schemaVersion === 2;
  const hiddenGroups = new Set(valid && Array.isArray(value.hiddenGroups) ? value.hiddenGroups : []);
  const excluded = new Set(valid && Array.isArray(value.hiddenItems) ? value.hiddenItems : []);
  for (const g of valid ? value.groups : defaults) {
    if (!g || !known.has(g.id) || groups.some(x => x.id === g.id)) continue;
    if (!modern && hiddenGroups.has(g.id)) { for (const id of g.items || []) excluded.add(id); continue; }
    const items = [];
    for (const originalId of Array.isArray(g.items) ? g.items : []) {
      const id=originalId==='access'?'staff':['dutyBadge','dutyBlock','dutyNameplate'].includes(originalId)?'dutyItems':originalId;
      if (allowed.has(id) && !used.has(id) && (modern || !excluded.has(id))) { items.push(id); used.add(id); }
    }
    groups.push({ id: g.id, title: g.id==='devices'&&g.title==='장비'?'총기/군수품/장비':String(g.title || known.get(g.id).title).trim().slice(0, 25) || known.get(g.id).title, items });
  }
  if (!modern) {
    for (const g of defaults) {
      if (hiddenGroups.has(g.id)) { for (const id of g.items) excluded.add(id); continue; }
      if (!groups.some(x => x.id === g.id)) groups.push({ id: g.id, title: g.title, items: [] });
    }
    for (const id of available) {
      if (used.has(id) || excluded.has(id)) continue;
      const preferred = defaults.find(g => g.items.includes(id));
      const target = groups.find(g => g.id === preferred?.id) || groups.find(g => g.id === 'other') || groups[0];
      if (target) { target.items.push(id); used.add(id); }
    }
  }
  const labels = {};
  if(valid&&!value.dutyRequestsAddedV400&&allowed.has('dutyRequests')&&!used.has('dutyRequests')){const def=defaults.find(g=>g.id==='devices');if(def){let group=groups.find(g=>g.id==='devices');if(!group){group={id:def.id,title:def.title,items:[]};groups.push(group);}const pos=group.items.indexOf('dutyItems');group.items.splice(pos<0?group.items.length:pos+1,0,'dutyRequests');used.add('dutyRequests');}}
  if(valid&&!value.developmentRequestsAddedV381&&allowed.has('developmentRequests')&&!used.has('developmentRequests')){const def=defaults.find(g=>g.id==='other');if(def){let group=groups.find(g=>g.id==='other');if(!group){group={id:def.id,title:def.title,items:[]};groups.push(group);}group.items.push('developmentRequests');used.add('developmentRequests');}}
  if(valid&&!value.dutyCadetsAddedV365&&allowed.has('dutyCadets')&&!used.has('dutyCadets')){const def=defaults.find(g=>g.id==='devices');if(def){let group=groups.find(g=>g.id==='devices');if(!group){group={id:def.id,title:def.title,items:[]};groups.push(group);}const pos=group.items.indexOf('roster');group.items.splice(pos<0?0:pos+1,0,'dutyCadets');used.add('dutyCadets');}}
  if(valid&&!value.personalInterfaceAddedV359&&allowed.has('personalInterface')&&!used.has('personalInterface')){const def=defaults.find(g=>g.id==='personalInfo');if(def){let group=groups.find(g=>g.id==='personalInfo');if(!group){group={id:def.id,title:def.title,items:[]};groups.push(group);}group.items.push('personalInterface');used.add('personalInterface');}}
  if(valid&&!value.uniformRequestsAddedV351&&allowed.has('uniformRequests')&&!used.has('uniformRequests')){const def=defaults.find(g=>g.id==='uniform');if(def){let group=groups.find(g=>g.id==='uniform');if(!group){group={id:def.id,title:def.title,items:[]};groups.push(group);}group.items.push('uniformRequests');used.add('uniformRequests');}}
  if(valid&&!value.assetRequestsAddedV336&&allowed.has('assetRequests')&&!used.has('assetRequests')){const def=defaults.find(g=>g.id==='facility');if(def){let group=groups.find(g=>g.id==='facility');if(!group){group={id:def.id,title:def.title,items:[]};groups.push(group);}group.items.push('assetRequests');used.add('assetRequests');}}
  if(valid&&!value.saberRestoredV326&&allowed.has('saber')&&!used.has('saber')){
    const def=defaults.find(g=>g.items.includes('saber'));
    if(def){let group=groups.find(g=>g.id===def.id);if(!group){group={id:def.id,title:def.title,items:[]};groups.push(group);}const before=group.items.indexOf('repairs');group.items.splice(before<0?group.items.length:before,0,'saber');used.add('saber');}
  }
  if(valid&&!value.departuresAddedV305&&allowed.has('departures')&&!used.has('departures')){
    const def=defaults.find(g=>g.id==='departures');
    if(def){let group=groups.find(g=>g.id===def.id);if(!group){group={id:def.id,title:def.title,items:[]};groups.unshift(group);}group.items.push('departures');used.add('departures');}
  }
  if(valid&&!value.dutyItemsAddedV368){const ids=['dutyItems'].filter(id=>allowed.has(id)&&!used.has(id));if(ids.length){const def=defaults.find(g=>g.id==='devices');if(def){let group=groups.find(g=>g.id==='devices');if(!group){group={id:def.id,title:def.title,items:[]};groups.push(group);}const pos=group.items.indexOf('saber');group.items.splice(pos<0?group.items.length:pos+1,0,...ids);ids.forEach(id=>used.add(id));}}}
  for (const [id, label] of Object.entries(valid ? value.labels || {} : {})) {
    if (used.has(id) && typeof label === 'string' && label.trim()) labels[id] = id==='staff'&&['군수계 명단','편집 권한 부여'].includes(label.trim())?'군수계 명단·권한 관리':label.trim().slice(0, 50);
  }
  return { schemaVersion: 2, groups, labels, dutyRequestsAddedV400:true,developmentRequestsAddedV381:true,departuresAddedV305:true, saberRestoredV326:true,assetRequestsAddedV336:true,uniformRequestsAddedV351:true,personalInterfaceAddedV359:true,dutyCadetsAddedV365:true,dutyItemsAddedV368:true };
};
const journalVisibleOn = function journalVisibleOn(entry, day) {
  if (entry.workType !== 'long') return entry.date === day;
  if (day < entry.date) return false;
  return entry.status !== '완료' || day <= (entry.completedOn || entry.date);
};
const journalDuePassed = function journalDuePassed(entry, day, time) {
  return !!entry.due && (entry.due < day || (entry.due === day && !!entry.dueTime && entry.dueTime < time));
};
const journalOverdue=e=>{const now=new Date(),pad=n=>String(n).padStart(2,'0');return journalDuePassed(e,[now.getFullYear(),pad(now.getMonth()+1),pad(now.getDate())].join('-'),pad(now.getHours())+':'+pad(now.getMinutes()));};

'use strict';
(()=>{
const KEY='logistics-work-journal-v1';
const DEFAULT_CATS=['보급','피복','급식','시설','장비','행정','기타'];
const STATUSES=['미착수','진행 중','완료','보류'];
const PRIORITIES=['보통','높음','긴급'];
// 담당자 직책 목록. 이후 추가/수정이 필요하면 이 부분만 변경하세요.
const OWNER_GROUPS=[
  {label:'군수 담당',items:['군수 담당 중대장','군수 담당 훈육관']},
  {label:'군수참모생도',items:['전대 군수참모생도','1대대 군수참모생도','2대대 군수참모생도']},
  {label:'군수참모보좌관생도',items:['군수참모보좌관생도1st','군수참모보좌관생도2nd']},
  {label:'중대별 3편대장생도',items:Array.from({length:8},(_,i)=>`${i+1}중대 3편대장생도`)},
  {label:'중대별 군수보좌관생도',items:Array.from({length:8},(_,i)=>`${i+1}중대 군수보좌관생도`)},
  {label:'기타',items:['기타']}
];
const OWNER_VALUES=new Set(OWNER_GROUPS.flatMap(group=>group.items));
// v2.90 · 훈련 모드에서만 사용하는 업무일지 작성자 7개 직책.
// 별도 시트/열을 만들지 않고 기존 업무기록의 category에 '기훈(분류)' 형태로 저장합니다.
const TRAIN_OWNERS_V290=[
  '군수 담당 중대장','군수 담당 훈육관','기훈 작전 중대장','기훈 작전 훈육관',
  '전대군수참모생도','기훈군수참모생도','기타'
];
const TRAIN_OWNER_VALUES_V290=new Set(TRAIN_OWNERS_V290);
const TRAIN_CATEGORY_RE_V290=/^기훈\((.*)\)$/;
function trainIsJournalModeV290(){return view==='trainJournal'||view==='trainCalendar';}
function trainBaseCategoryV290(cat){const match=String(cat||'').match(TRAIN_CATEGORY_RE_V290);return match?match[1]:String(cat||'');}
function trainCategoryV290(cat){const base=trainBaseCategoryV290(cat).trim()||'기타';return '기훈('+base+')';}

const $=id=>document.getElementById(id);
const qs=(s,r=document)=>r.querySelector(s);
const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
function localISO(d=new Date()){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function dateFromISO(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function shiftDate(s,step){const d=dateFromISO(s);d.setDate(d.getDate()+step);return localISO(d)}
function prettyDate(s,week=true){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return '-';return dateFromISO(s).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',...(week?{weekday:'short'}:{})})}
function escapeH(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function truncate(s,n=180){s=String(s??'');return s.length>n?s.slice(0,n)+'…':s}
function getEmpty(){return {version:1,categories:[...DEFAULT_CATS],entries:[],notes:{}}}
let storageOK=true; // 레거시 변수 (사용하지 않음)
function readData(){return getEmpty()} // Google Sheets에서만 데이터를 로드합니다.
function normalizeData(d){if(!d||typeof d!=='object'||Array.isArray(d)||!Array.isArray(d.entries))throw Error('올바른 백업 데이터가 아닙니다.');const entries=d.entries.slice(0,50000).filter(e=>e&&typeof e==='object'&&/^\d{4}-\d{2}-\d{2}$/.test(e.date||'')).map(e=>({id:String(e.id||makeId()).slice(0,100),title:String(e.title||'제목 없음').slice(0,150),date:String(e.date),dueTime:/^([01]\d|2[0-3]):[0-5]\d$/.test(e.dueTime||'')?e.dueTime:'',workType:e.workType==='long'?'long':'daily',completedOn:/^\d{4}-\d{2}-\d{2}$/.test(e.completedOn||'')?e.completedOn:'',time:/^\d{2}:\d{2}$/.test(e.time||'')?e.time:'',category:String(e.category||'기타').slice(0,60),status:STATUSES.includes(e.status)?e.status:'미착수',priority:PRIORITIES.includes(e.priority)?e.priority:'보통',due:/^\d{4}-\d{2}-\d{2}$/.test(e.due||'')?e.due:'',owner:String(e.owner||'').slice(0,100),detail:String(e.detail||'').slice(0,10000),follow:String(e.follow||'').slice(0,10000),createdAt:String(e.createdAt||new Date().toISOString()),updatedAt:String(e.updatedAt||new Date().toISOString())}));let cats=Array.isArray(d.categories)?d.categories.map(v=>String(v).trim().slice(0,60)).filter(Boolean).slice(0,60):DEFAULT_CATS;cats=[...new Set(cats)];if(!cats.length)cats=[...DEFAULT_CATS];const notes={};if(d.notes&&typeof d.notes==='object'&&!Array.isArray(d.notes)){for(const [k,v] of Object.entries(d.notes).slice(0,20000)){if(/^\d{4}-\d{2}-\d{2}$/.test(k))notes[k]=String(v).slice(0,10000)}}return {version:1,categories:cats,entries,notes}}
function makeId(){return (window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2)}
let data=getEmpty(),view='today',selectedDay=localISO(),toastTimer;
let trainSharedModeV289=false;
let v288ActiveTerm='',v288ViewingTerm='';
function v288ShowActiveTerm(term){v288ActiveTerm=String(term||'').trim();const badge=$('v288ActiveTermBadge');if(!badge)return;badge.textContent='현재 근무: '+(document.body.classList.contains('v294-training-mode')?'00기 성무기초군사훈련':v288ActiveTerm||'미설정');badge.classList.remove('hidden');}
let initialFormSnapshot='',modalReadOnly=true,modalSaving=false;
let ready=false,canEdit=false,canManageUsersV281=false,canEditJournal=false,canEditCalendar=false,cloudEmail='',sheetUrl='',syncPending=0,syncError=false,queue=Promise.resolve(),noteTimer=null,savedNotes={};
/** v2.73 · Apps Script 콜백이 사라져도 무한 대기하지 않습니다. */
/** v2.82 · 대용량 조회는 gzip 전송 (Google Sheets 데이터 캐싱 없음). */
const COMPRESSED_READS_V282=new Set(['getBootstrap','getRosterData','getDormV234','getUniformV278','getLaborCalcV259','getSupplyItemData']);
async function decodeReadV282(value){
 if(!value||value.__compressedV282!=='gzip-base64')return value;
 if(!('DecompressionStream' in window))throw Error('Chrome 압축 해제 기능을 사용할 수 없습니다. 브라우저를 업데이트하세요.');
 const raw=atob(String(value.data||''));const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
 const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
 return JSON.parse(await new Response(stream).text());
}
function repairResponseV310(value){
  if(Array.isArray(value))return value.map(repairResponseV310);
  if(value&&typeof value==='object'){for(const key of Object.keys(value)){
   if((key==='status'||key==='firearmStatus')&&typeof value[key]==='string'){
    const s=value[key].replace(/\s+/g,'');
    if(['수리필요(보고완료)','수리필요(보고)'].includes(s))value[key]='수리 필요(보고)';
    else if(['수리필요','수리필요(미보고)'].includes(s))value[key]='수리 필요(미보고)';
    else if(s==='교체필요')value[key]='교체 필요';
   }else repairResponseV310(value[key]);
  }}return value;
 }
function server(method,...args){return new Promise((resolve,reject)=>{
 let settled=false;
 const maxWait=90000;
 const timer=setTimeout(()=>finish(new Error('서버 응답 시간 초과 ('+Math.round(maxWait/1000)+'초). 자동 재시도하지 않습니다. 새로고침 후 저장 결과를 확인하세요.'),true),maxWait);
 function finish(value,isError){if(settled)return;settled=true;clearTimeout(timer);if(isError)reject(value);else {resolve(repairResponseV310(value));if(ready && CHANGE_WRITE_NAMES_V283.has(method))setTimeout(()=>changeHistoryLoadV283(),750);}}
 try{
  if(typeof google==='undefined'||!google.script||!google.script.run)throw Error('Google Apps Script 배포 주소에서 실행해야 합니다. HTML 파일을 직접 열면 저장되지 않습니다.');
  const packed=COMPRESSED_READS_V282.has(method),target=packed?'readCompressedV282':method,argv=packed?[method,...args]:args;
  google.script.run.withSuccessHandler(value=>{
   if(!packed){finish(value,false);return;}
   decodeReadV282(value).then(v=>finish(v,false)).catch(e=>finish(e,true));
  }).withFailureHandler(e=>finish(Error(e&&e.message?e.message:String(e)),true))[target](...argv);
 }catch(e){finish(e,true);}
});}
async function inspectConnectionV272(){
 const area=$('connectionResultV272');area.classList.remove('hidden');area.textContent='업무일지·생활실·공용비품 연결 상태 확인 중… (최대 30초)';
 try{
  const result=await server('diagnoseConnectionV272');
  const rows=(result.checks||[]).map(c=>{
   const symbol=c.status==='ok'?'✓':c.status==='warn'?'!':'×';
   const color=c.status==='ok'?'#277b55':c.status==='warn'?'#9d6826':'#bf3d3d';
   return '<div style="padding:6px 2px;border-bottom:1px solid #e8edf3"><b style="color:'+color+'">'+symbol+' '+escapeH(c.key)+'</b><div style="padding-left:18px;font-size:12px">'+escapeH(c.detail)+'</div></div>';
  }).join('');
  area.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><strong>Google Sheets 연결 진단 · 서버 v'+escapeH(result.version||'?')+'</strong><button class="small-link" type="button" id="closeConnectionV272">닫기</button></div>'+rows+
  (canManageUsersV281?'<button class="btn btn-soft" type="button" id="changeLivingV272" style="margin-top:8px;padding:6px 10px;font-size:12px">생활실 시트 연결 주소 변경</button>':'');
  $('closeConnectionV272').addEventListener('click',()=>area.classList.add('hidden'));
  if(canEdit&&$('changeLivingV272'))$('changeLivingV272').addEventListener('click',async()=>{
   const url=prompt('최신 생활실현황 탭의 Google Sheets 링크를 붙여넣으세요. 기존 데이터는 수정되지 않습니다.');if(url===null)return;
   try{const r=await server('setLivingSourceV272',url);alert('생활실 연결 주소 갱신 완료. 호실 '+r.rooms+'개 확인.\n'+(r.sameAsMain?'관리 화면과 동일한 시트입니다.':'관리 화면과 다른 시트입니다.'));await inspectConnectionV272();if(eqLoaded)await loadEquipment();}
   catch(e){alert('연결 주소 변경 실패: '+e.message);}
  });
 }catch(e){area.textContent='연동 진단 실패: '+e.message+' · 새 버전 배포 여부, Apps Script 실행자/접근 권한을 확인해 주세요.';}
}
function enqueue(task){syncPending++;syncError=false;updateSaveIndicator();
  const attempt=queue.catch(()=>{}).then(()=>task());
  queue=attempt;
  return attempt.then(value=>{syncPending--;updateSaveIndicator();return value},err=>{syncPending--;syncError=true;updateSaveIndicator();throw err});}
function mustEdit(area='owner'){const allowed=area==='journal'?canEditJournal:area==='calendar'?canEditCalendar:canEdit;if(!ready||!allowed){toast('이 계정에는 해당 항목을 수정할 권한이 없습니다.');return false;}return true;}
function flushNote(){if(noteTimer){clearTimeout(noteTimer);noteTimer=null;}if(!ready||!canEditJournal)return;
  const pending=pendingNote;if(!pending)return;pendingNote=null;
  enqueue(async()=>{await server('saveNote',pending.day,pending.value,savedNotes[pending.day]||'');savedNotes[pending.day]=pending.value;})
    .catch(err=>{alert('메모 저장 실패: '+err.message+'\n현재 입력한 내용은 화면에만 남아 있으니 복사해 보관하고 다시 시도하세요.');});}
let pendingNote=null;
async function loadCloud(){if(syncPending||pendingNote){toast('저장 중입니다. 저장 완료 후 새로고침하세요.');return;}
  ready=false;syncError=false;updateSaveIndicator();$('cloudBanner').classList.remove('failed');$('cloudBanner').textContent='군수계 구글 계정과 기록을 확인하고 있습니다...';
  try{const result=await server('getBootstrap');data=normalizeData(result);canEdit=!!result.canEdit;canManageUsersV281=!!result.canManageUsers;canEditJournal=!!result.canEditJournal;canEditCalendar=!!result.canEditCalendar;cloudEmail=result.userEmail||'';sheetUrl=result.sheetUrl||'';v288ShowActiveTerm(result.staffTermV288||'');v284Scoped=!!result.accessScopedV284;v284Views=result.allowedViews||[];v284Company=result.company||'';v284CanViewStaff=!!result.canViewStaff;ready=true;if(canManageUsersV281)server('applyDormCorrectionsV315').then(r=>{if(r.changed){dormLoadedV234=false;toast('343-3호 배정 정정 완료 · 변경 전 기록을 백업했습니다.');if(view==='dorm'){dormReloadV234();if(dormPlanV315)dormPlanLoadV315();}}else if(r.review)toast('343-3호 정정 확인 필요: '+r.message);}).catch(e=>toast('생활실 정정 확인 실패: '+e.message));navAfterCloudV220(result);if(v284Scoped&&!v284IsAllowed(view)){const first=v284Views.find(x=>viewNames[x]);if(first)view=first;}if(result.serverVersion!=='2.99'){$('connectionResultV272').classList.remove('hidden');$('connectionResultV272').textContent='화면은 v2.99인데 실행 중인 서버는 구버전입니다. Apps Script 웹 앱을 「새 버전」으로 배포한 뒤 다시 열어 주세요.';}
    savedNotes={...data.notes};document.body.dataset.readonly=canEdit?'false':'true';$('dailyMemo').readOnly=!canEditJournal;
    $('newEntryBtn').classList.toggle('limited-entry-visible',canEditJournal&&!canEdit);
    $('cloudBanner').textContent='● '+(result.role||'조회 전용')+' | 접속 계정: '+cloudEmail+' | '+(v284Company?v284Company+'중대 · ':'')+(v284Scoped?'허용된 항목만 조회·수정 가능':'기록 '+data.entries.length+'건 · '+(canEdit?'전체 항목 편집 가능':canEditJournal?'업무일지·캘린더만 수정 가능':'조회만 가능'));
    $('accessManageV281').classList.toggle('hidden',!canManageUsersV281);
    $('openSheet').href=sheetUrl||'#';$('categoryEditor').readOnly=!canEdit;
    refresh();v284PositionChanges();$('changeHistoryLinkV283').classList.toggle('hidden',v284Scoped&&!v284IsAllowed('changes'));if(v284Scoped){switchView(view);$('journalModeBar').classList.add('hidden');$('openSheet').classList.add('hidden');}else{$('journalModeBar').classList.remove('hidden');$('openSheet').classList.remove('hidden');}eqLoaded=false;rosterLoaded=false;if(view==='dorm')dormReloadV234();if(view==='laborCalc')laborLoadV259();if(view==='laborRecords')laborRecordsLoadV264();if(view==='roomAsset')assetLoadV244();if(view==='equipment')loadEquipment();if(view==='roster')loadRoster();supplyLoaded=false;if(view==='supply')supplyLoadCatalog();if(view==='uniform'){uniformStateV278.loaded=false;uniformLoadV278(true);}repairLoaded=false;if(view==='repairs')loadRepairDashboard();wxLoaded=false;wxLoadError='';wxLoadAll();if(window.__cloudBootV273)window.__cloudBootV273.ready();changeHistoryLoadV283();toast('Google Sheets에서 최신 기록을 불러왔습니다.');
  }catch(err){syncError=true;if(window.__cloudBootV273)window.__cloudBootV273.error(err.message||String(err));$('cloudBanner').classList.add('failed');$('cloudBanner').textContent='연결 실패: '+err.message+' | Google Sheets 공유 권한과 앱 배포 옵션을 확인하세요.';
    $('openSheet').href='#';}finally{updateSaveIndicator();}}

function saveData(){throw Error('이 앱은 로컬 저장을 사용하지 않습니다. 클라우드 저장 함수를 사용하세요.');}
function updateSaveIndicator(){ $('saveIndicator').classList.toggle('warning',!!syncError); $('saveText').textContent=syncError?'Google Sheets 연결/저장 실패':syncPending?'Google Sheets 저장 중...':ready?(canEditJournal?'Google Sheets에 저장됨':'Google Sheets 조회 전용'):'Google Sheets 연결 중...'; }
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.add('hidden'),2800)}
function statusClass(s){return s==='진행 중'?'진행중':s}
function icon(name){const paths={calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',flag:'<path d="M5 21V4m0 1c6-4 8 4 15 0v10c-7 4-9-4-15 0"/>',check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',alert:'<path d="M12 3 2 21h20L12 3zM12 9v5M12 18h.01"/>',layers:'<path d="m12 3 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>'};return '<svg viewBox="0 0 24 24">'+paths[name]+'</svg>'}
function entryHTML(e,showDate=false){const due=e.due?`<span>마감: ${escapeH(prettyDate(e.due,false))}${e.dueTime?' '+escapeH(e.dueTime):''}</span>`:'';const detail=e.detail?`<p class="entry-desc">${escapeH(truncate(e.detail,360))}</p>`:'';const follow=e.follow?`<div class="followup"><strong>추후 조치</strong>${escapeH(truncate(e.follow,300))}</div>`:'';return `<article class="entry"><div class="entry-top"><span class="entry-time">${escapeH(showDate?e.date.slice(5):e.time||'— : —')}</span><div class="entry-main"><div class="entry-heading"><span class="cat">${escapeH(e.category)}</span><span class="pill">${e.workType==='long'?'장기업무':'당일업무'}</span><span class="pill status-${statusClass(e.status)}">${escapeH(e.status)}</span>${e.priority!=='보통'?`<span class="pill priority-${escapeH(e.priority)}">${escapeH(e.priority)}</span>`:''}<h3>${escapeH(e.title)}</h3></div>${detail}<div class="entry-meta">${e.workType==='long'?`<span>시작: ${escapeH(e.date)}${e.completedOn?' · 완료: '+escapeH(e.completedOn):''}</span>`:''}${e.owner?`<span>담당: ${escapeH(e.owner)}</span>`:''}${due}${showDate?`<span>업무일: ${escapeH(prettyDate(e.date,false))}</span>`:''}</div>${follow}</div><div class="entry-actions">${canEditJournal?`<button class="text-action" data-action="edit" data-id="${escapeH(e.id)}">수정</button><button class="text-action delete" data-action="delete" data-id="${escapeH(e.id)}">삭제</button>`:`<button class="text-action" data-action="view" data-id="${escapeH(e.id)}">보기</button>`}</div></div></article>`}
function emptyHTML(message,small='새 업무를 등록하면 여기에 표시됩니다.',btn=true){return `<div class="empty"><div class="empty-visual">▤</div><strong>${escapeH(message)}</strong><p>${escapeH(small)}</p>${btn&&canEditJournal?'<button class="btn btn-soft" data-action="add">+ 업무 등록하기</button>':''}</div>`}
function renderStats(target,defs){target.innerHTML=defs.map(x=>`<div class="stat"><div class="stat-top"><span class="stat-label">${escapeH(x.label)}</span><span class="stat-icon ${escapeH(x.color||'')}">${icon(x.icon)}</span></div><div class="stat-number">${x.value}</div><div class="stat-foot">${escapeH(x.foot)}</div></div>`).join('')}

/* v2.98 · 일지 첫 화면: 월간 달력 + 미완료/마감 임박 업무 우선순위.
 * 기존 업무기록 시트만 읽고 저장/권한 체계는 변경하지 않습니다. */
const v298Months={general:localISO().slice(0,7),training:localISO().slice(0,7)};
const v298Expanded={general:false,training:false};
function v298DueClass(e,today){
 if(e.status==='완료')return 'green';
 if(journalOverdue(e))return 'red';
 if(e.due&&e.due<=shiftDate(today,3))return 'orange';
 return e.status==='진행 중'?'blue':e.status==='보류'?'orange':'gray';
}
function v298PriorityInfo(e,today){
 if(!e.due)return {rank:5,label:'마감일 미지정'};
 if(journalOverdue(e))return {rank:0,label:'마감 경과 · '+prettyDate(e.due,false)};
 if(e.due===today)return {rank:1,label:'오늘 마감'};
 if(e.due<=shiftDate(today,3))return {rank:2,label:'마감 임박 · '+prettyDate(e.due,false)};
 if(e.due<=shiftDate(today,7))return {rank:3,label:'7일 이내 · '+prettyDate(e.due,false)};
 return {rank:4,label:'마감 '+prettyDate(e.due,false)};
}
function v298Render(mode){
 const training=mode==='training',prefix=training?'v298Training':'v298General';
 const calendar=$(prefix+'Calendar'),list=$(prefix+'Priority'),monthEl=$(prefix+'Month'),countEl=$(prefix+'Count'),more=$(prefix+'More');
 if(!calendar||!list||!monthEl||!countEl||!more)return;
 const today=localISO(),month=v298Months[mode],selected=training?trainJournalDateV292:selectedDay;
 const entries=training?data.entries.filter(e=>TRAIN_CATEGORY_RE_V290.test(String(e.category||''))):data.entries;
 monthEl.textContent=Number(month.slice(0,4))+'년 '+Number(month.slice(5,7))+'월';
 const [y,m]=month.split('-').map(Number),days=new Date(y,m,0).getDate(),offset=new Date(y,m-1,1).getDay();
 const gridStart=calendarShift(month+'-01',-offset),count=Math.ceil((offset+days)/7)*7,dayDetails={};
 for(const entry of entries){if(entry.due&&entry.status!=='완료')dayDetails[entry.due]=(dayDetails[entry.due]||'')+'<span class="wx-cal-pill due">마감</span>';}
 calendar.innerHTML=calendarHTML(entries,{start:gridStart,count,today,selected,month,miniMode:mode,details:dayDetails});
 const active=entries.filter(e=>e.status!=='완료').map(e=>({...v298PriorityInfo(e,today),e})).sort((a,b)=>a.rank-b.rank||((a.e.due||'9999-99-99')+'T'+(a.e.dueTime||'23:59')).localeCompare((b.e.due||'9999-99-99')+'T'+(b.e.dueTime||'23:59'))||(({긴급:0,높음:1,보통:2})[a.e.priority]??2)-(({긴급:0,높음:1,보통:2})[b.e.priority]??2)||String(a.e.date||'').localeCompare(String(b.e.date||'')));
 countEl.textContent=active.length+'건 미완료';
 const visible=v298Expanded[mode]?active.slice(0,80):active.slice(0,7);
 list.innerHTML=visible.length?visible.map(({e,label})=>{
  const color=v298DueClass(e,today);
  return `<button type="button" class="v298-priority-row" data-v298-open="${escapeH(e.id)}" title="${escapeH(e.title)} 상세 보기"><i class="v298-priority-bar v298-${color}"></i><span class="v298-task-main"><strong>${escapeH(e.title)}</strong><small>${escapeH(e.category||'기타')} · ${escapeH(e.status||'미착수')} · ${escapeH(label)}${e.dueTime?' · '+escapeH(e.dueTime):''}${e.time?' · 업무 '+escapeH(e.time):''}</small></span><span class="v298-chevron">›</span></button>`;
 }).join(''):'<div class="v298-empty">미완료 업무가 없습니다. 새 업무를 등록하면 이곳에 우선 표시돼요.</div>';
 more.classList.toggle('hidden',active.length<=7);more.textContent=v298Expanded[mode]?'간략히 보기':'미완료 업무 더 보기 ('+Math.min(active.length,80)+'건)';
}
function v298Click(e){const range=e.target.closest('[data-calendar-entry]');if(range){showModal(range.dataset.calendarEntry);return;}
 const task=e.target.closest('[data-v298-open]');if(task){showModal(task.dataset.v298Open);return;}
 const date=e.target.closest('[data-v298-date]');if(date){const mode=date.dataset.v298Mode,d=date.dataset.v298Date;if(mode==='training'){trainJournalDateV292=d;trainJournalRenderV292();}else{flushNote();selectedDay=d;renderToday();}return;}
 const shift=e.target.closest('[data-v298-shift]');if(shift){const mode=shift.dataset.v298Mode,[y,m]=v298Months[mode].split('-').map(Number);v298Months[mode]=localISO(new Date(y,m-1+Number(shift.dataset.v298Shift),1)).slice(0,7);v298Render(mode);return;}
 const home=e.target.closest('[data-v298-today]');if(home){const mode=home.dataset.v298Today,d=localISO();v298Months[mode]=d.slice(0,7);if(mode==='training'){trainJournalDateV292=d;trainJournalRenderV292();}else{flushNote();selectedDay=d;renderToday();}return;}
 const more=e.target.closest('[data-v298-more]');if(more){const mode=more.dataset.v298More;v298Expanded[mode]=!v298Expanded[mode];v298Render(mode);return;}
 const full=e.target.closest('[data-v298-full]');if(full){if(full.dataset.v298Full==='training'){trainCalendarSelectedV292=trainJournalDateV292;trainCalendarMonthV292=v298Months.training;switchView('trainCalendar');}else{wxSelectedDay=selectedDay;wxCalendarMonth=v298Months.general;switchView('calendar');}}
}
document.addEventListener('click',v298Click);
function renderToday(){const today=localISO(),dayItems=data.entries.filter(e=>journalVisibleOn(e,selectedDay)).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));const unfinished=data.entries.filter(e=>e.status!=='완료');const late=unfinished.filter(e=>journalOverdue(e)).length;const dueToday=unfinished.filter(e=>e.due===today&&!journalOverdue(e)).length;const doneDay=dayItems.filter(e=>e.status==='완료').length;renderStats($('dashboardStats'),[{label:'선택일 업무',value:dayItems.length,foot:'선택한 날짜 기준',icon:'calendar'},{label:'미완료 업무',value:unfinished.length,foot:'전체 기록 기준',icon:'flag',color:'amber'},{label:'선택일 완료',value:doneDay,foot:'선택일 업무 중',icon:'check',color:'green'},{label:'마감 점검',value:late+dueToday,foot:`지연 ${late}건 · 오늘 ${dueToday}건`,icon:'alert',color:'red'}]);$('selectedDate').value=selectedDay;$('selectedDateSub').textContent=`${prettyDate(selectedDay)} · ${dayItems.length}건의 기록`;$('dailyEntries').innerHTML=dayItems.length?dayItems.map(e=>entryHTML(e)).join(''):emptyHTML('이 날짜에 등록된 업무가 없습니다.');$('dailyMemo').value=data.notes[selectedDay]||'';$('memoCount').textContent=$('dailyMemo').value.length+'자';const deadlines=unfinished.filter(e=>!!e.due).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,5);$('deadlineList').innerHTML=deadlines.length?deadlines.map(e=>`<div class="deadline"><div class="deadline-mark ${journalOverdue(e)?'late':''}"></div><div class="deadline-info"><div class="deadline-name" title="${escapeH(e.title)}">${escapeH(e.title)}</div><div class="deadline-meta">${journalOverdue(e)?'마감 경과':e.due===today?'오늘 마감':prettyDate(e.due,false)} · ${escapeH(e.status)}</div></div><button class="small-link" data-action="edit" data-id="${escapeH(e.id)}">보기</button></div>`).join(''):'<p style="color:#98a7b6;font-size:12px;line-height:1.7">마감일이 등록된 미완료 업무가 없습니다.</p>';v298Render('general');}
function allFiltered(){const s=$('search').value.trim().toLocaleLowerCase(),status=$('statusFilter').value,cat=$('catFilter').value,sort=$('sortFilter').value;let arr=data.entries.filter(e=>(!status||e.status===status)&&(!cat||e.category===cat)&&(!s||[e.title,e.detail,e.follow,e.owner,e.category].some(x=>String(x).toLocaleLowerCase().includes(s))));if(sort==='due')arr.sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||b.date.localeCompare(a.date));else if(sort==='oldest')arr.sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt));else arr.sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));return arr}
function renderAll(){const entries=allFiltered();$('allCount').textContent=`${entries.length}건 표시 / 전체 ${data.entries.length}건`;$('allEntries').innerHTML=entries.length?entries.map(e=>entryHTML(e,true)).join(''):emptyHTML(data.entries.length?'검색 조건에 맞는 업무가 없습니다.':'아직 등록된 업무가 없습니다.',data.entries.length?'다른 검색어나 조건을 사용해 보세요.':'업무를 추가해 기록을 시작하세요.',!data.entries.length)}
function renderBars(el,series,total,color=''){if(!series.length){el.innerHTML='<div style="padding:35px 0;color:#9cabbc;font-size:12px;text-align:center">선택한 월에 기록이 없습니다.</div>';return}const max=Math.max(...series.map(v=>v.value),1);el.innerHTML=series.map(x=>`<div class="bar-row"><span class="bar-label" title="${escapeH(x.label)}">${escapeH(x.label)}</span><div class="bar-track"><div class="bar-fill ${color}" style="width:${Math.round(x.value/max*100)}%"></div></div><span class="bar-value">${x.value}</span></div>`).join('')}
function renderMonthly(){const mon=$('statMonth').value||localISO().slice(0,7),items=data.entries.filter(e=>e.date.startsWith(mon)),done=items.filter(e=>e.status==='완료').length,counts=Object.fromEntries(STATUSES.map(v=>[v,items.filter(e=>e.status===v).length]));renderStats($('monthlyStats'),[{label:'월간 전체 업무',value:items.length,foot:`${mon} 업무일 기준`,icon:'layers'},{label:'완료 업무',value:done,foot:'완료 상태인 기록',icon:'check',color:'green'},{label:'미완료 업무',value:items.length-done,foot:'미착수 · 진행 중 · 보류',icon:'flag',color:'amber'},{label:'완료율',value:items.length?Math.round(done/items.length*100)+'%':'0%',foot:'완료 / 월간 전체 업무',icon:'calendar'}]);const catNames=[...new Set([...data.categories,...items.map(e=>e.category)])];renderBars($('categoryBars'),catNames.map(c=>({label:c,value:items.filter(e=>e.category===c).length})).filter(v=>v.value).sort((a,b)=>b.value-a.value),items.length);renderBars($('statusBars'),STATUSES.map(s=>({label:s,value:counts[s]})),items.length,'green')}

let editorSavingV281=false;
async function loadFullEditorsV281(){
 if(!canManageUsersV281)return;
 const label=$('accessStatusV281');label.textContent='등록된 전체 편집자를 확인 중…';
 try{
  const r=await server('listFullEditorsV281');
  $('accessOwnerV281').textContent='최고 관리자: '+r.owner;
  const list=$('accessListV281');
  list.innerHTML=r.editors?.length?r.editors.map(email=>'<div class="access-person-v281"><div><strong>'+escapeH(email)+'</strong><div>전체 항목 편집 허용</div></div><button class="btn btn-danger" type="button" data-revoke-editor-v281="'+escapeH(email)+'">권한 회수</button></div>').join(''):'<p class="help">등록된 전체 편집자가 없습니다.</p>';
  label.textContent='전체 편집자 '+(r.editors||[]).length+'명 · 제한 편집자 '+(r.limited||[]).length+'명 (기존 권한 유지)';
 }catch(e){label.textContent='편집 권한 목록 확인 실패: '+e.message;}
}
async function grantFullEditorClickV281(){
 if(!canManageUsersV281||editorSavingV281)return;
 const email=$('accessEmailV281').value.trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return alert('Google 계정 이메일을 입력해 주세요.');
 if(!confirm(email+' 계정에 모든 업무관리 항목의 등록·수정·삭제 권한과 관련 Google Sheets 파일의 편집권한을 부여할까요?'))return;
 editorSavingV281=true;const btn=$('accessAddV281');btn.disabled=true;
 try{
  const r=await server('grantFullEditorV281',email);
  $('accessEmailV281').value='';await Promise.all([loadFullEditorsV281(),v284AccessLoad()]);
  alert((r.already?'이미 등록된 계정입니다.':'전체 편집 권한을 부여했습니다.')+(r.warnings?.length?'\n추가 확인: '+r.warnings.join(' / '):''));
 }catch(e){alert('권한 부여 실패: '+e.message);}finally{editorSavingV281=false;btn.disabled=false;}
}
async function revokeFullEditorClickV281(email){
 if(!canManageUsersV281||editorSavingV281)return;
 if(!confirm(email+' 계정의 전체 편집 권한을 회수할까요? 즉시 앱 수정이 차단됩니다.'))return;
 editorSavingV281=true;
 try{const r=await server('revokeFullEditorV281',email);await Promise.all([loadFullEditorsV281(),v284AccessLoad()]);alert('앱 편집 권한을 회수했습니다.'+(r.warnings?.length?'\nGoogle Sheets 공유 확인 필요: '+r.warnings.join(' / '):''));}
 catch(e){alert('권한 회수 실패: '+e.message);}finally{editorSavingV281=false;}
}
function initEditorUIV281(){
 $('accessAddV281').addEventListener('click',grantFullEditorClickV281);
 $('accessListV281').addEventListener('click',e=>{const el=e.target.closest('[data-revoke-editor-v281]');if(el)revokeFullEditorClickV281(el.dataset.revokeEditorV281);});
 $('accessRefreshV281').addEventListener('click',loadFullEditorsV281);
}
function renderSettings(){$('categoryEditor').value=data.categories.join(', ');$('totalDataCount').textContent=`현재 업무 ${data.entries.length}건 · 날짜별 메모 ${Object.keys(data.notes).filter(k=>data.notes[k].trim()).length}건`;settingsLoadV258();if(canManageUsersV281)loadFullEditorsV281();}
/* v2.94 · 현재 운영 모드별로 주 메뉴만 전환합니다. */
function v294SyncModeMenu(v){
 const training=["train","trainJournal","trainCalendar","trainPersonnel","trainTasks","trainStats","trainSupply","trainUniform","trainUniformRequests","trainMeal","trainEquipment","trainRooms","trainRoomAssets","trainAssetRequests","trainRoster","trainSaber","trainRepairs","trainSurveys"].includes(v);
 document.body.classList.toggle('v294-training-mode',training);v288ShowActiveTerm(v288ActiveTerm);
 const trainNav=$('trainingSidebarMenuV294');if(trainNav)trainNav.classList.toggle('hidden',!training);
 const generalNav=$('sidebarMenu');if(generalNav)generalNav.classList.toggle('hidden',training);
 const caption=$('v294MenuHeading');if(caption)caption.textContent=training?'훈련 업무 메뉴':'일반학기 메뉴';
 qsa('#trainingSidebarMenuV294 [data-training-quick]').forEach(b=>{
  const on=b.dataset.trainingQuick===v;
  b.classList.toggle('active',on);b.setAttribute('aria-current',on?'page':'false');
  const allowed=!v284Scoped||v284IsAllowed(b.dataset.trainingQuick);
  b.classList.toggle('hidden',!allowed);
 });
 qsa('.mobile-nav .v294-mobile-training').forEach(b=>{b.classList.toggle('hidden',!training||v284Scoped&&!v284IsAllowed(b.dataset.trainingQuick));b.classList.toggle('active',b.dataset.trainingQuick===v);});
 qsa('[data-train-nav]').forEach(b=>{const on=b.dataset.trainNav===(training?'train':'today');b.classList.toggle('btn-primary',on);b.setAttribute('aria-pressed',on?'true':'false');});
}

const viewScrollV285=Object.create(null);
const viewNames={dutyRequests:['DUTY ITEM REQUESTS','근무생도 물품 수정 요청','예도·흉장·블럭·명패 요청을 확인하고 반영합니다.'],developmentRequests:['DEVELOPMENT REQUESTS','개발 요청 관리','수정 요청과 처리 결과를 기록합니다.'],dutyItems:['DUTY ITEMS','흉장·블럭·명패','근무생도별 물품 수량을 한 번에 관리합니다.'],dutyCadets:['DUTY CADET ROSTER','근무생도 명단','직접 등록한 근무생도 명단을 관리합니다.'],personalInterface:['MY LOGISTICS INTERFACE','인터페이스 관리','개인 조회앱에 표시할 정보 순서를 관리합니다.'],trainPersonnel:["BASIC MILITARY TRAINING","인원관리","인원 등록 전 · 메뉴 준비"],trainTasks:["BASIC MILITARY TRAINING","전체 업무 관리","인원 등록 전 · 메뉴 준비"],trainStats:["BASIC MILITARY TRAINING","업무 통계","인원 등록 전 · 메뉴 준비"],trainSupply:["BASIC MILITARY TRAINING","군수품 관리","인원 등록 전 · 메뉴 준비"],trainUniform:["BASIC MILITARY TRAINING","피복 사이즈표","인원 등록 전 · 메뉴 준비"],trainUniformRequests:["BASIC MILITARY TRAINING","피복 사이즈 수정 요청","인원 등록 전 · 메뉴 준비"],trainMeal:["BASIC MILITARY TRAINING","급식 관리","인원 등록 전 · 메뉴 준비"],trainEquipment:["BASIC MILITARY TRAINING","공용비품","인원 등록 전 · 메뉴 준비"],trainRooms:["BASIC MILITARY TRAINING","생활실 인원 현황","인원 등록 전 · 메뉴 준비"],trainRoomAssets:["BASIC MILITARY TRAINING","생활실 비품","인원 등록 전 · 메뉴 준비"],trainAssetRequests:["BASIC MILITARY TRAINING","비품 수정 요청","인원 등록 전 · 메뉴 준비"],trainRoster:["BASIC MILITARY TRAINING","명단·총기 관리","인원 등록 전 · 메뉴 준비"],trainSaber:["BASIC MILITARY TRAINING","예도 관리","인원 등록 전 · 메뉴 준비"],trainRepairs:["BASIC MILITARY TRAINING","수리 필요 목록","인원 등록 전 · 메뉴 준비"],trainSurveys:["BASIC MILITARY TRAINING","조사 관리","인원 등록 전 · 메뉴 준비"],uniformRequests:['UNIFORM SIZE REQUESTS','피복 사이즈 수정 요청','현재 사이즈와 요청 내용을 비교하고 검토·반영합니다.'],assetRequests:['ROOM INVENTORY REQUESTS','생활실 비품 관리 수정 요청','요청 내용과 현재 기록을 비교하고 확인 또는 수정 반영합니다.'],departures:['PERSONNEL MANAGEMENT','퇴교자(휴학자/위탁) 일괄 관리','스마트당직 미등재 인원의 총기·군수품·피복을 함께 확인하고 처리합니다.'],laborRecords:['DISTRIBUTION HISTORY','사역 내역','저장된 사역 계산과 품목·실제 수량·세부 사항을 확인합니다.'],laborCalc:['DISTRIBUTION CALCULATOR','사역 계산','스마트당직 B8 총원과 생활실 배정 명단을 기준으로 사역 수량을 계산합니다.'],roomAsset:['ROOM INVENTORY','생활실 비품 관리','호실별 비품 종류·수량·정상·요수리 상태를 관리합니다.'],dorm:['DORMITORY OCCUPANCY','생활실 인원 현황','관·층·복도별 배정·외출·현재 인원을 확인하고 공실과 여생도방을 관리합니다.'],train:['BASIC MILITARY TRAINING','성무기초군사훈련','훈련 업무일지와 훈련 캘린더는 전용 화면에서 관리하고, 일반학기에는 통합 표시합니다.'],trainJournal:['BASIC MILITARY TRAINING · JOURNAL','성무기초군사훈련 · 업무일지','훈련 기록만 별도 화면으로 조회·작성합니다. 일반학기 업무기록 시트와 저장 공간은 공유합니다.'],trainCalendar:['BASIC MILITARY TRAINING · CALENDAR','성무기초군사훈련 · 캘린더','기훈(항목)으로 분류된 훈련 업무만 표시합니다. 일반학기 캘린더에는 두 종류 모두 표시됩니다.'],calendar:['WORKSPACE CALENDAR','캘린더','마감일·일정·특이사항을 날짜별로 기록하고 관리합니다.'],uniform:['UNIFORM SIZE INVENTORY','피복 사이즈표','기수·중대별 품목 사이즈와 수량을 관리합니다.'],saber:['CEREMONIAL SWORD INVENTORY','예도 관리','직책별 예도 상태와 세부사항을 기록합니다.'],repairs:['REPAIR STATUS','수리 필요 목록','총기·군수품·공용비품에서 수리 필요 현황을 통합 조회합니다.'],supply:['LOGISTICS ITEMS','군수품 관리 현황','품목별 시트와 관리 항목별 열을 생성하고 개인별 상태를 관리합니다.'],roster:['CADET ROSTER','명단(총기번호) 관리','기수·중대별 명단에서 총기상태와 비고를 바로 수정합니다.'],equipment:['FACILITY INVENTORY','공용비품 현황','세탁기·건조기 정상/고장 및 사용 인원을 관리합니다.'],today:['DAILY OPERATION LOG','일자별 업무일지','날짜별 업무 내용과 진행 상황을 관리합니다.'],all:['TASK MANAGEMENT','전체 업무 관리','등록한 모든 업무를 한 곳에서 검색하고 관리합니다.'],stats:['MONTHLY OVERVIEW','업무 통계','월별 업무량과 진행 상태를 확인합니다.'],changes:['CHANGE HISTORY','수정 사항 내역','등록·수정·삭제된 개별 항목과 작업 내역을 확인합니다.'],access:['ACCESS CONTROL','편집 권한 부여','직책별 허용 메뉴와 중대 자료 범위를 설정합니다.'],staff:['LOGISTICS STAFF & ACCESS','군수계 명단·권한 관리','근무 차수별 명단과 계정별 편집 권한을 한 화면에서 관리합니다.'],surveys:['FORM SURVEYS','Google Forms 조사','군수계 업무별 설문을 만들고 제출 현황과 개별 응답을 확인합니다.'],updates:['VERSION HISTORY','업데이트 내역','V1부터 주요 기능 변경과 추후 업데이트 기록을 확인합니다.'],settings:['PREFERENCES & BACKUP','설정 · 백업','분류를 관리하고 업무 기록을 안전하게 백업합니다.']};
function switchView(v){if(view==='developmentRequests'&&v!==view){if(devBusyV381)return false;if(devDirtyV381()&&!confirm('작성 중인 요청을 두고 이동할까요?'))return false;}if(view==='personalInterface'&&v!==view){if(personalInterfaceBusyV359)return false;if(personalInterfaceDirtyV359&&!confirm('저장하지 않은 순서 변경을 버리고 이동할까요?'))return false;personalInterfaceDirtyV359=false;}if(v==='access')v='staff';if(!viewNames[v])return false;if(v284Scoped&&!v284IsAllowed(v))return false;
if((view==='assetRequests'||view==='uniformRequests'||view==='dutyRequests')&&v!==view&&document.querySelector('[data-request-edited]')&&!confirm('검토 중인 요청 변경을 지우고 이동할까요?'))return false;if((dutyVerifyBusyV371||dutyMoveBusyV372)&&v!==view)return false;if(['dutyItems'].includes(view)&&v!==view){if(dutyItemsBusyV368)return false;if(dutyItemDraftV368.size){if(!confirm('저장하지 않은 수량 변경을 지우고 이동할까요?'))return false;dutyItemDraftV368.clear();}}trainSharedModeV289=["train","trainJournal","trainCalendar","trainPersonnel","trainTasks","trainStats","trainSupply","trainUniform","trainUniformRequests","trainMeal","trainEquipment","trainRooms","trainRoomAssets","trainAssetRequests","trainRoster","trainSaber","trainRepairs","trainSurveys"].includes(v);const previousViewV285=view;const previousScrollV285=window.scrollY||0;if(v!==previousViewV285)viewScrollV285[previousViewV285]=previousScrollV285;if(v==='dorm'&&view==='dorm'){dormResetFiltersV251_();dormRenderV234();return true;}if(view==='roomAsset'&&v!=='roomAsset'&&assetDirtyV244.size){if(!confirm('저장하지 않은 생활실 비품 수정이 있습니다. 다른 메뉴로 이동할까요?'))return false;assetDirtyV244.clear();assetCurrentRoomV244='';$('assetRoomEditorV244').classList.add('hidden');}if(view==='train'&&v!=='train'&&!trainConfirmUnsavedV227())return false;if(!wxConfirmLeave()||!confirmCloseModal()||!eqConfirmClose()||!rosterCloseConfirm()||(v!==view&&!rosterConfirmQuickAbandon())||(v!==view&&!supplyConfirmLeave()))return false;view=v;const t=viewNames[v];$('pageEyebrow').textContent=t[0];$('pageTitle').textContent=t[1];$('pageSub').textContent=t[2];$('newEntryBtn').classList.toggle('hidden',v==='trainPersonnel'||v==='trainTasks'||v==='trainStats'||v==='trainSupply'||v==='trainUniform'||v==='trainUniformRequests'||v==='trainMeal'||v==='trainEquipment'||v==='trainRooms'||v==='trainRoomAssets'||v==='trainAssetRequests'||v==='trainRoster'||v==='trainSaber'||v==='trainRepairs'||v==='trainSurveys'||v==='dutyRequests'||['dutyItems'].includes(v)||v==='dutyCadets'||v==='developmentRequests'||v==='personalInterface'||v==='uniformRequests'||v==='assetRequests'||v==='departures'||v==='dorm'||v==='laborCalc'||v==='laborRecords'||v==='roomAsset'||v==='equipment'||v==='roster'||v==='supply'||v==='saber'||v==='uniform'||v==='repairs'||v==='calendar'||v==='changes'||v==='train'||v==='trainJournal'||v==='trainCalendar'||v==='staff'||v==='access'||v==='updates'||v==='surveys'||v.startsWith('c_'));["trainPersonnel","trainTasks","trainStats","trainSupply","trainUniform","trainUniformRequests","trainMeal","trainEquipment","trainRooms","trainRoomAssets","trainAssetRequests","trainRoster","trainSaber","trainRepairs","trainSurveys",'dutyRequests','dutyRequests','dutyItems','dutyCadets','developmentRequests','personalInterface','uniformRequests','assetRequests','departures','today','all','stats','dorm','laborCalc','laborRecords','roomAsset','equipment','roster','supply','saber','uniform','repairs','calendar','train','trainJournal','trainCalendar','settings','changes','access','staff','updates','surveys'].forEach(x=>$(x+'View').classList.toggle('hidden',x!==v));$('customView').classList.toggle('hidden',!v.startsWith('c_'));qsa('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===v);if(b.dataset.view===v)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});if(v==='departures')departuresLoadV305();if(v==='today')renderToday();if(v==='trainJournal')trainJournalRenderV292();if(v==='trainCalendar')trainCalendarRenderV292();if(v==='all')renderAll();if(v==='stats')renderMonthly();if(v==='settings')renderSettings();if(v==='surveys')surveysEnterV299(true);if(v==='changes')changeHistoryRenderV283();if(v==='access')v284AccessLoad();if(v==='staff')staffAccessLoadV364();if(v==='updates')v285UpdateLoad();if(v==='surveys')surveysEnterV299();if(v==='dorm')dormOpenV234();if(v==='laborCalc')laborLoadV259();if(v==='laborRecords')laborRecordsLoadV264();if(v==='roomAsset')assetLoadV244();if(v==='assetRequests')assetRequestsLoadV336();if(v==='uniformRequests')uniformRequestsLoadV350();if(v==='personalInterface')personalInterfaceLoadV359();if(v==='developmentRequests')devLoadV381();if(v==='dutyCadets')dutyCadetsLoadV365();if(['dutyItems'].includes(v))dutyItemsLoadV368(v);if(v==='dutyRequests')dutyRequestsLoadV400();if(v==='equipment'&&!eqLoaded)loadEquipment();else if(v==='equipment')renderEquipment();if(v==='roster'&&!rosterLoaded)loadRoster();else if(v==='roster'){rosterRender();if(smartSubtabV253==='special')smartLoadV253();}if(v==='supply'&&!supplyLoaded) supplyLoadCatalog();else if(v==='supply')supplyRefreshCurrentV256();if(v==='saber')saberLoadV276();if(v==='uniform')uniformLoadV278();if(v==='repairs')loadRepairDashboard();if(v==='calendar'){if(ready&&!wxLoaded)wxLoadAll();else wxCalendarRender();}qsa('[data-training-quick]').forEach(b=>b.classList.toggle('btn-primary',b.dataset.trainingQuick===v));qsa('[data-train-nav]').forEach(b=>{const active=b.dataset.trainNav===(["train","trainJournal","trainCalendar","trainPersonnel","trainTasks","trainStats","trainSupply","trainUniform","trainUniformRequests","trainMeal","trainEquipment","trainRooms","trainRoomAssets","trainAssetRequests","trainRoster","trainSaber","trainRepairs","trainSurveys"].includes(v)?'train':'today');b.classList.toggle('btn-primary',active);b.setAttribute('aria-pressed',active?'true':'false')});if(v.startsWith('c_'))wxLoadPage(v);if(v!==previousViewV285)requestAnimationFrame(()=>window.scrollTo({top:viewScrollV285[v]??0,behavior:'instant'}));if(typeof navEnsureActiveV233==='function')navEnsureActiveV233(v);v294SyncModeMenu(v);return true}
function refresh(){renderToday();if(view==='trainJournal')trainJournalRenderV292();if(view==='trainCalendar')trainCalendarRenderV292();if(view==='all')renderAll();if(view==='stats')renderMonthly();if(view==='settings')renderSettings();if(view==='calendar')wxCalendarRender();refreshCats()}
function refreshCats(){const opts=['<option value="">모든 분류</option>',...[...new Set([...data.categories,...data.entries.map(e=>e.category)])].map(c=>`<option value="${escapeH(c)}">${escapeH(c)}</option>`)];const current=$('catFilter').value;$('catFilter').innerHTML=opts.join('');$('catFilter').value=opts.some(v=>v.includes(`value="${escapeH(current)}"`))?current:''}
function setupFormCat(current){
  const training=trainIsJournalModeV290();
  const currentValue=training?trainBaseCategoryV290(current):current;
  const cats=[...new Set([...data.categories.filter(x=>!training||!TRAIN_CATEGORY_RE_V290.test(x)),...(currentValue?[currentValue]:[])])];
  $('fCategory').innerHTML=cats.map(c=>`<option value="${escapeH(c)}">${escapeH(c)}</option>`).join('');
  $('fCategory').value=currentValue||cats[0];
}
function setupFormOwner(current=''){
  // 일반학기는 기존 작성자 명단 유지. 성무훈련 업무일지에서는 지정한 7개 직책만 표시.
  const training=trainIsJournalModeV290();
  const groups=training
    ? [`<optgroup label="성무기초군사훈련 작성자">${TRAIN_OWNERS_V290.map(name=>`<option value="${escapeH(name)}">${escapeH(name)}</option>`).join('')}</optgroup>`]
    : OWNER_GROUPS.map(group=>`<optgroup label="${escapeH(group.label)}">${group.items.map(name=>`<option value="${escapeH(name)}">${escapeH(name)}</option>`).join('')}</optgroup>`);
  // 기존 기록을 수정할 때 등록되어 있던 담당자를 지우지 않습니다.
  if(current && !(training?TRAIN_OWNER_VALUES_V290:OWNER_VALUES).has(current))
    groups.push(`<optgroup label="기존 기록 보존"><option value="${escapeH(current)}">기존 담당자: ${escapeH(current)}</option></optgroup>`);
  $('fOwner').innerHTML='<option value="">담당자를 선택하세요 (미지정 가능)</option>'+groups.join('');
  $('fOwner').value=current||'';
  const ownerLabelV290=document.querySelector('label[for="fOwner"]');
  if(ownerLabelV290)ownerLabelV290.textContent=training?'작성자 (선택)':'담당자 (선택)';
  const hint=$('fOwner').parentElement?.querySelector('.owner-help');
  if(hint)hint.textContent=training?'성무기초군사훈련 작성자 7개 직책 중 선택하세요.':'군수 담당 직책 또는 1~8중대의 담당 직책을 선택하세요.';
}
function updateFollowCount(){const n=$('fFollow').value.length;$('followCount').textContent=n.toLocaleString('ko-KR')+' / 10,000자';}
function formSnapshot(){
  return JSON.stringify(qsa('input[name],select[name],textarea[name]', $('entryForm')).map(el=>[el.name,el.value]));
}
function isModalOpen(){return !$('modalBackdrop').classList.contains('hidden')}
function isFormDirty(){return isModalOpen()&&!modalReadOnly&&formSnapshot()!==initialFormSnapshot}
function updateFormHint(){
  const hint=$('formHint');if(!hint)return;
  const dirty=isFormDirty();hint.classList.toggle('unsaved',dirty);
  hint.textContent=dirty?'⚠ 저장되지 않은 작성 내용이 있습니다. 다른 화면으로 이동하면 입력 내용이 사라집니다.':'저장 후에도 언제든 수정할 수 있습니다.';
}
function confirmCloseModal(){
  if(!isModalOpen())return true;
  if(modalSaving){toast('업무를 저장하고 있습니다. 완료될 때까지 기다려 주세요.');return false;}
  if(isFormDirty()&&!confirm('⚠ 작성 중인 업무일지가 아직 저장되지 않았습니다.\n\n저장하지 않고 이동하면 입력한 업무명, 담당자, 업무 내용, 추후 조치 정보가 사라집니다.\n\n저장하지 않고 나가시겠습니까?'))return false;
  closeModal(true);
  return true;
}
function showModal(id,readonly=false){if(!ready)return;if(!confirmCloseModal())return;if(!id&&!mustEdit('journal'))return;const e=id?data.entries.find(x=>x.id===id):null;if(id&&!e)return;
  const ro=!canEditJournal||readonly;$('entryForm').reset();$('entryId').value=e?e.id:'';$('modalTitle').textContent=ro?'업무 상세 조회':e?'업무 수정':'업무 등록';
  $('submitBtn').hidden=ro;$('submitBtn').textContent=e?'변경사항 저장':'업무 저장';
  $('modalTitle').textContent=(trainIsJournalModeV290()?'[기훈] ':'')+$('modalTitle').textContent;
  $('fTitle').value=e?.title||'';$('fDate').value=e?.date||(trainIsJournalModeV290()?trainJournalDateV292:(view==='today'?selectedDay:localISO()));$('fTime').value=e?.time||'';setupFormCat(e?.category||'');
  $('fWorkType').value=e?.workType||'daily';$('fStatus').value=e?.status||'미착수';$('fPriority').value=e?.priority||'보통';$('fDue').value=e?.due||'';$('fDueTime').value=e?.dueTime||'';$('deleteJournalEntry').hidden=ro||!e;setupFormOwner(e?.owner||'');$('fDetail').value=e?.detail||'';$('fFollow').value=e?.follow||'';updateFollowCount();
  qsa('input,select,textarea',$('entryForm')).forEach(el=>{if(el.id!=='entryId')el.disabled=ro;});
  modalReadOnly=ro;modalSaving=false;initialFormSnapshot=formSnapshot();
  $('modalBackdrop').classList.remove('hidden');document.body.style.overflow='hidden';updateFormHint();
  if(!ro)setTimeout(()=>$('fTitle').focus(),50)
}
// 시간은 HH:mm 문자열로만 저장하며 Google Sheets 데이터 구조는 변경하지 않습니다.
function normalizeTime24(field='fTime'){
  const el=$(field); let value=el.value.trim();
  if(!value)return;
  if(/^\d{3,4}$/.test(value)){
    value=value.padStart(4,'0');
    el.value=value.slice(0,2)+':'+value.slice(2);
  }else if(/^\d{1,2}:\d{1,2}$/.test(value)){
    const [hour,minute]=value.split(':');
    el.value=hour.padStart(2,'0')+':'+minute.padStart(2,'0');
  }
}
function closeModal(force=false){
  if(force!==true)return confirmCloseModal();
  $('modalBackdrop').classList.add('hidden');document.body.style.overflow='';initialFormSnapshot='';return true;
}
async function onSave(e){e.preventDefault();if(!mustEdit('journal'))return;normalizeTime24();normalizeTime24('fDueTime');const f=$('entryForm');if(!f.reportValidity())return;
  const id=$('entryId').value,old=id?data.entries.find(x=>x.id===id):null;
  const isTrainingNewV290=trainIsJournalModeV290();
  const selectedCategoryV290=$('fCategory').value;
  // 훈련 모드에서 작성한 업무는 일반학기와 공유되는 시트에 저장하되, 분류로 구분합니다.
  const savedCategoryV290=isTrainingNewV290?trainCategoryV290(selectedCategoryV290):selectedCategoryV290;
  const item={workType:$('fWorkType').value,id:old?.id||'',title:$('fTitle').value.trim(),date:$('fDate').value,time:$('fTime').value,category:savedCategoryV290,status:$('fStatus').value,priority:$('fPriority').value,due:$('fDue').value,dueTime:$('fDueTime').value,owner:$('fOwner').value.trim(),detail:$('fDetail').value.trim(),follow:$('fFollow').value.trim(),updatedAt:old?.updatedAt||''};
  if(item.dueTime&&!item.due){alert('마감시간을 입력하려면 마감일을 선택하세요.');return;}if(!item.title){$('fTitle').focus();return;}const button=$('submitBtn');modalSaving=true;button.disabled=true;button.textContent='저장 중...';
  try{const saved=await enqueue(()=>server('saveEntry',item));if(old)data.entries[data.entries.findIndex(x=>x.id===id)]=saved;else data.entries.push(saved);
    closeModal(true);refresh();toast(old?'Google Sheets 업무 수정 완료':'Google Sheets 업무 등록 완료');
  }catch(err){alert('업무 저장 실패: '+err.message+'\n작성한 내용은 저장되지 않았습니다.');}finally{modalSaving=false;button.disabled=false;button.textContent=id?'변경사항 저장':'업무 저장';updateFormHint();}}
async function delEntry(id){if(!mustEdit('journal'))return;const e=data.entries.find(e=>e.id===id);if(!e||!confirm(`“${e.title}” 업무를 삭제할까요?\nGoogle Sheets에서도 삭제됩니다.`))return;
  try{await enqueue(()=>server('removeEntry',id,e.updatedAt));data.entries=data.entries.filter(e=>e.id!==id);if($('entryId').value===id)closeModal(true);refresh();toast('Google Sheets에서 삭제했습니다.');}
  catch(err){alert('삭제 실패: '+err.message);}}
function csvCell(v){let s=String(v??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
function download(dataBlob,name){const url=URL.createObjectURL(dataBlob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200)}
function backup(){download(new Blob([JSON.stringify({...data,exportedAt:new Date().toISOString()},null,2)],{type:'application/json;charset=utf-8'}),'군수계_업무일지_백업_'+localISO()+'.json');toast('전체 백업 파일을 다운로드했습니다.')}
function csvExport(){const fields=['date','time','category','title','status','priority','due','owner','detail','follow','createdAt','updatedAt'],header=['업무일','시간','분류','업무명','상태','중요도','마감일','담당자','업무 내용','추후 조치','등록 시각','수정 시각'];const rows=[header.map(csvCell).join(','),...data.entries.map(e=>fields.map(k=>csvCell(e[k])).join(','))];download(new Blob(['\ufeff',rows.join('\r\n')],{type:'text/csv;charset=utf-8'}),'군수계_업무목록_'+localISO()+'.csv');toast('CSV 파일을 다운로드했습니다.')}
async function importBackup(file){if(!file||!mustEdit())return;try{
 if(file.size>12*1024*1024)throw Error('파일이 너무 큽니다. (최대 12MB)');const parsed=JSON.parse(await file.text()),restored=normalizeData(parsed);
 if(!confirm(`업무 ${restored.entries.length}건을 클라우드에 복원할까요?\n현재 Google Sheets의 모든 업무와 메모, 분류가 교체됩니다.\n계속하시겠습니까?`))return;
 if(!confirm('최종 확인: 현재 Google Sheets를 백업했으며 기존 기록을 교체해도 됩니까?'))return;
 await enqueue(()=>server('restoreBackup',restored));await loadCloud();switchView('today');toast('Google Sheets 백업 복원 완료');
 }catch(err){alert('백업 복원에 실패했습니다.\n'+err.message)}finally{$('importFile').value=''}}
function printDaily(){const entries=data.entries.filter(e=>journalVisibleOn(e,selectedDay)).sort((a,b)=>(a.time||'').localeCompare(b.time||''));const cells=entries.length?entries.map((e,i)=>`<tr><td>${i+1}</td><td>${escapeH(e.time||'-')}</td><td>${escapeH(e.category)}</td><td><b>[${e.workType==='long'?'장기업무':'당일업무'}] ${escapeH(e.title)}</b>${e.detail?'<div style="margin-top:8px">'+escapeH(e.detail)+'</div>':''}${e.follow?'<div style="margin-top:8px">추후 조치: '+escapeH(e.follow)+'</div>':''}</td><td>${escapeH(e.status)}</td><td>${escapeH(e.due||'-')}${e.dueTime?' '+escapeH(e.dueTime):''}</td></tr>`).join(''):'<tr><td colspan="6" style="text-align:center">등록된 업무가 없습니다.</td></tr>';$('printArea').innerHTML=`<h1>군수계 업무일지</h1><div class="print-meta"><span>현재 근무 차수: ${escapeH(v288ActiveTerm||'미설정')}</span><span>업무일: ${escapeH(prettyDate(selectedDay))}</span><span>업무 건수: ${entries.length}건 / 인쇄일: ${escapeH(prettyDate(localISO(),false))}</span></div><table><colgroup><col style="width:6%"><col style="width:11%"><col style="width:12%"><col style="width:47%"><col style="width:11%"><col style="width:13%"></colgroup><thead><tr><th>번호</th><th>시간</th><th>분류</th><th>업무 내용</th><th>상태</th><th>마감일</th></tr></thead><tbody>${cells}</tbody></table><h3>인수인계 · 특이사항</h3><div class="print-memo">${escapeH(data.notes[selectedDay]||'특이사항 없음')}</div>`;window.print()}
async function addSamples(){if(!mustEdit()||!confirm('일반적인 예시 업무 3건을 Google Sheets에 추가할까요?'))return;
  const samples=[{title:'주간 소모품 신청 내역 확인',category:'보급',status:'진행 중',priority:'보통',detail:'취합된 신청 내역과 누락 항목 확인',follow:'확인되지 않은 항목 재점검'},{title:'공용 물품 점검표 정리',category:'행정',status:'완료',priority:'보통',detail:'점검표 업데이트 및 기록 정리',follow:''},{title:'차기 근무자 인수인계 확인',category:'행정',status:'미착수',priority:'높음',detail:'업무 진행 사항과 후속 조치 항목 정리',follow:'남은 업무 목록 전달'}];
  try{for(let i=0;i<samples.length;i++){const e=samples[i];const saved=await enqueue(()=>server('saveEntry',{...e,date:localISO(),time:['09:00','11:00','15:00'][i]}));data.entries.push(saved);}refresh();switchView('today');toast('Google Sheets에 예시 업무 3건을 추가했습니다.');}
  catch(err){alert('예시 저장 중 오류: '+err.message+'\n이미 저장된 업무가 있을 수 있으므로 확인하세요.');}}
function changeDay(delta){flushNote();selectedDay=shiftDate(selectedDay,delta);renderToday()}
/* v2.33: 계층형 사이드바 · 그룹/항목 드래그 이동 및 표시 이름 편집 */
const NAV_GROUP_DEFAULT_V233=[{id:'departures',title:'퇴교자(휴학자/위탁) 일괄 관리',items:['departures']},
 {id:'journal',title:'일지',items:['today','all','stats','calendar']},
 {id:'supply',title:'보급',items:['supply']},
 {id:'uniform',title:'피복',items:['uniform','uniformRequests']},
 {id:'meal',title:'급식',items:[]},
 {id:'labor',title:'사역 / 식수 관리',items:['laborCalc','laborRecords']},
 {id:'facility',title:'시설',items:['equipment','dorm','roomAsset','assetRequests']},
 {id:'devices',title:'총기/군수품/장비',items:['roster','dutyCadets','saber','dutyItems','dutyRequests','repairs']},
 {id:'admin',title:'행정',items:['surveys']},
 {id:'personalInfo',title:'나의 군수 정보 관리',items:['personalInterface']},
 {id:'other',title:'기타',items:['settings','changes','staff','updates']}
];
const NAV_BUILTIN_V233=['dutyRequests','developmentRequests','dutyItems','dutyCadets','personalInterface','uniformRequests','assetRequests','departures','surveys','updates','staff','today','all','stats','calendar','equipment','dorm','roomAsset','roster','supply','repairs','settings','laborCalc','laborRecords','saber','uniform','changes'];
let navSavedOrderV220=[],navEditModeV220=false,navDirtyV220=false,navSavingV220=false;
let navButtonsV233={},navTreeV233=null,navSavedTreeV233=null,navExpandedV233=new Set(NAV_GROUP_DEFAULT_V233.map(g=>g.id)); // v2.69: 옆 메뉴의 모든 상위 항목 최초 펼침
let navDragV233=null;
function navDeepCopyV233(value){return JSON.parse(JSON.stringify(value));}
function navAllowedV221(){return [...NAV_BUILTIN_V233,...wxPages.map(p=>p.id)];}
function navDefaultV233(){const t={schemaVersion:2,groups:navDeepCopyV233(NAV_GROUP_DEFAULT_V233),labels:{}};
 wxPages.forEach(p=>t.groups.find(g=>g.id==='other').items.push(p.id));return t;}
function navNormalizeV233(input){return navModelV301_(input,NAV_GROUP_DEFAULT_V233,navAllowedV221());}

/* v2.70 · 하위 메뉴의 종류별 선명한 벡터 이미지(SVG) */
const NAV_ICONS_V270={
 today:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M7 18h3M14 14h3"/>',
 all:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
 stats:'<path d="M4 20V11M10 20V5M16 20v-8M22 20v-14M2 20h21"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M14 14h3"/>',
 uniform:'<path d="M5 3h14v18H5zM9 7h6M9 11h6M9 15h6"/>',
 saber:'<path d="M13 2l-2 10-6 6-2 4 4-2 6-6 9-2zM7 16l3 3M3 21l5-5"/>',
 supply:'<path d="M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10"/>',
 laborCalc:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2 20v-2a6 6 0 0 1 12 0v2M13 14a6 6 0 0 1 9 5v1"/>',
 laborRecords:'<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 3h6v3H9zM9 11h6M9 15h6"/>',
 equipment:'<rect x="3" y="2" width="18" height="20" rx="2"/><circle cx="12" cy="14" r="5"/><circle cx="7" cy="6.5" r=".7"/><path d="M11 6h7"/>',
 dorm:'<path d="M3 10l9-7 9 7v11H3zM9 21v-8h6v8"/>',
 roomAsset:'<path d="M2 13h20v7H2zM4 13V7h16v6M5 20v2M19 20v2M6 10h12"/>',
 roster:'<rect x="4" y="4" width="16" height="17" rx="2"/><circle cx="12" cy="10" r="2.3"/><path d="M8 17a4 4 0 0 1 8 0"/>',
 repairs:'<path d="M14.5 5.5a5 5 0 0 0-6 6L3 17l4 4 5.5-5.5a5 5 0 0 0 6-6L16 12l-4-4z"/>',
 surveys:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 settings:'<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
 custom:'<path d="M6 2h9l4 4v16H6zM15 2v5h4M9 12h7M9 16h7"/>'
};
function navSvgV270(id){
 const node=document.createElementNS('http://www.w3.org/2000/svg','svg');
 node.setAttribute('viewBox','0 0 24 24');node.setAttribute('width','15');node.setAttribute('height','15');
 node.setAttribute('fill','none');node.setAttribute('stroke','currentColor');
 node.setAttribute('stroke-width','1.8');node.setAttribute('stroke-linecap','round');node.setAttribute('stroke-linejoin','round');
 node.setAttribute('aria-hidden','true');node.setAttribute('class','nav-child-icon-v270');
 node.innerHTML=NAV_ICONS_V270[id]||NAV_ICONS_V270.custom;
 return node;
}

function navItemDefaultTitleV233(id){const custom=wxPages.find(p=>p.id===id);return custom?custom.title:(viewNames[id]?.[1]||id);}
function navTreeSignatureV233(tree){return JSON.stringify(tree);}
function navUpdateDirtyV220(){navDirtyV220=navTreeSignatureV233(navTreeV233)!==navTreeSignatureV233(navSavedTreeV233);$('navSaveButton').textContent=navDirtyV220?'변경사항 저장 ●':'변경사항 저장';}
function navEnsureActiveV233(id){if(!navTreeV233)return;const parent=navTreeV233.groups.find(g=>g.items.includes(id));if(parent){navExpandedV233.add(parent.id);navRenderV233();}}
function navGroupButtonV233(group){
 const b=document.createElement('button');b.type='button';b.className='tree-group-toggle';b.setAttribute('aria-expanded',navExpandedV233.has(group.id)?'true':'false');
 b.textContent=(navExpandedV233.has(group.id)?'▾ ':'▸ ')+group.title;
 b.addEventListener('click',()=>{if(navExpandedV233.has(group.id))navExpandedV233.delete(group.id);else navExpandedV233.add(group.id);navRenderV233();});return b;
}
let wxNavigationReadyV314=false;
function navRenderV233(){
 if(!navTreeV233)return;
 const nav=$('sidebarMenu'),frag=document.createDocumentFragment();
 navTreeV233.groups.forEach(group=>{
  if(!navEditModeV220&&(navTreeV233.hiddenGroups||[]).includes(group.id))return;
  const el=document.createElement('section');el.className='tree-group';el.dataset.group=group.id;
  if(navEditModeV220)el.classList.add('tree-edit');
  const head=document.createElement('div');head.className='tree-group-head';
  if(navEditModeV220){const grip=document.createElement('span');grip.className='tree-grip';grip.textContent='⠿';grip.title='상위 메뉴 드래그';head.appendChild(grip);head.draggable=true;}
  head.appendChild(navGroupButtonV233(group));
  if(navEditModeV220){
   const del=document.createElement('button');del.type='button';del.className='tree-delete-v266';del.dataset.hideGroup=group.id;del.textContent='×';del.title='상위 메뉴 삭제';head.appendChild(del);
  }
  if(navEditModeV220){const rename=document.createElement('button');rename.className='tree-rename';rename.type='button';rename.title='상위 메뉴 이름 변경';rename.textContent='✎';rename.dataset.renameGroup=group.id;head.appendChild(rename);}
  el.appendChild(head);
  const list=document.createElement('div');list.className='tree-items';list.dataset.group=group.id;
  if(navExpandedV233.has(group.id)||navEditModeV220){
   group.items.forEach(id=>{
    if(!navEditModeV220&&(navTreeV233.hiddenItems||[]).includes(id))return;if(['dutyItems','dutyRequests'].includes(id)&&(!canEdit||v284Scoped))return;if(id==='dutyCadets'&&(!canEdit||v284Scoped))return;if(id==='access'&&!canManageUsersV281)return;if(id==='surveys'&&!canManageUsersV281)return;if(id==='staff'&&!v284CanViewStaff)return;if(v284Scoped&&!v284IsAllowed(id)&&id!=='updates')return;
    const btn=navButtonsV233[id];if(!btn)return;
    const row=document.createElement('div');row.className='tree-nav-item nav-sort-row';row.dataset.navId=id;row.dataset.parent=group.id;row.draggable=navEditModeV220;
    if(navEditModeV220){const handle=document.createElement('span');handle.className='tree-grip';handle.textContent='⠿';handle.title='다른 위치 또는 다른 상위 메뉴로 드래그';row.appendChild(handle);}
    const title=navTreeV233.labels[id]||navItemDefaultTitleV233(id);
    let label=btn.querySelector('.tree-display-title');
    if(!label){btn.replaceChildren();btn.appendChild(navSvgV270(id));label=document.createElement('span');label.className='tree-display-title';btn.appendChild(label);}
    if(!btn.querySelector('.nav-child-icon-v270'))btn.insertBefore(navSvgV270(id),label);
    label.textContent=title;
    btn.classList.toggle('active',view===id);
    row.appendChild(btn);
    if(navEditModeV220){const rename=document.createElement('button');rename.className='tree-rename';rename.type='button';rename.dataset.renameItem=id;rename.textContent='✎';rename.title='하위 메뉴 이름 변경';row.appendChild(rename);const del=document.createElement('button');del.type='button';del.className='tree-delete-v266';del.dataset.hideItem=id;del.textContent='×';del.title='하위 메뉴 삭제';row.appendChild(del);if((navTreeV233.hiddenItems||[]).includes(id))row.classList.add('tree-item-hidden-v266');}
    list.appendChild(row);
   });
   if(!group.items.length){const empty=document.createElement('div');empty.className='tree-empty';empty.textContent=navEditModeV220?'여기로 항목을 끌어오세요':'등록된 하위 메뉴 없음';list.appendChild(empty);}
  }
  if((navTreeV233.hiddenGroups||[]).includes(group.id))el.classList.add('tree-item-hidden-v266');
  el.appendChild(list);if(!v284Scoped||list.querySelector('.tree-nav-item'))frag.appendChild(el);
 });
 nav.replaceChildren(frag);v284AddUtilityNav();if(ready&&wxNavigationReadyV314&&!navEditModeV220&&!navDirtyV220)window.LOGBOOK_NAVIGATION?.commit();const activeItemsV301=new Set(navTreeV233.groups.flatMap(g=>g.items));qsa('.mobile-nav [data-view]').forEach(button=>button.classList.toggle('nav-removed-v301',!activeItemsV301.has(button.dataset.view)));
}
function navEditToggleV220(edit){if(!canEdit)return;
 navEditModeV220=!!edit;$('navEditButton').disabled=!!edit;$('navEditButton').textContent='☷ 메뉴 편집';$('navEditActions').classList.toggle('hidden',!edit);
 if(edit)navTreeV233.groups.forEach(g=>navExpandedV233.add(g.id));
 navRenderV233();}
function navConfirmDiscardV220(){if(!navEditModeV220)return true;
 if(navDirtyV220&&!confirm('저장하지 않은 메뉴 변경사항을 취소할까요?'))return false;
 navTreeV233=navDeepCopyV233(navSavedTreeV233);navEditToggleV220(false);navUpdateDirtyV220();return true;}
async function navSaveV220(){if(!canEdit||!ready||navSavingV220)return;
 navUpdateDirtyV220();if(!navDirtyV220){navEditToggleV220(false);return toast('변경된 메뉴가 없습니다.');}
 navSavingV220=true;$('navSaveButton').disabled=true;
 try{
  const saved=await server('saveNavTreeV233',navTreeV233);
  navTreeV233=navNormalizeV233(saved);navSavedTreeV233=navDeepCopyV233(navTreeV233);
  navEditToggleV220(false);navUpdateDirtyV220();window.LOGBOOK_NAVIGATION?.commit();toast('메뉴 이름·배치·삭제가 저장되었습니다.');
 }catch(e){alert('메뉴 저장 실패: '+e.message);}
 finally{navSavingV220=false;$('navSaveButton').disabled=false;}
}
function navWrapButtonV220(btn){const id=btn.dataset.view;if(!id)return;navButtonsV233[id]=btn;navTreeV233=navNormalizeV233(navTreeV233||navDefaultV233());navRenderV233();}
function navAfterCloudV220(result){if(navEditModeV220&&navDirtyV220)return;
 navTreeV233=navNormalizeV233(result.navTree);navSavedTreeV233=navDeepCopyV233(navTreeV233);navUpdateDirtyV220();navRenderV233();
 $('navOrderControls').classList.toggle('hidden',!canManageUsersV281);}
function navDnDMoveV233(info,target,event){
 if(info.kind==='group'){
  const targetGroup=target.closest('.tree-group');if(!targetGroup||targetGroup.dataset.group===info.id)return;
  const old=navTreeV233.groups.findIndex(g=>g.id===info.id);const [section]=navTreeV233.groups.splice(old,1);
  const ix=navTreeV233.groups.findIndex(g=>g.id===targetGroup.dataset.group);
  const r=targetGroup.getBoundingClientRect();navTreeV233.groups.splice(ix+(event.clientY>r.top+r.height/2?1:0),0,section);
 }else{
  const targetItem=target.closest('.tree-nav-item'),targetGroup=target.closest('.tree-group');if(!targetGroup)return;
  const toId=targetGroup.dataset.group;const to=navTreeV233.groups.find(g=>g.id===toId);if(!to)return;
  if(targetItem&&targetItem.dataset.navId===info.id)return;
  navTreeV233.groups.forEach(g=>{g.items=g.items.filter(id=>id!==info.id);});
  let ix=to.items.length;
  if(targetItem){ix=to.items.indexOf(targetItem.dataset.navId);const r=targetItem.getBoundingClientRect();if(event.clientY>r.top+r.height/2)ix++;}
  to.items.splice(Math.max(ix,0),0,info.id);navExpandedV233.add(toId);
 }
 navRenderV233();navUpdateDirtyV220();
}
function navInitV220(){const dutyRequestButtonV400=document.createElement('button');dutyRequestButtonV400.type='button';dutyRequestButtonV400.className='nav-btn';dutyRequestButtonV400.dataset.view='dutyRequests';dutyRequestButtonV400.textContent='근무생도 물품 수정 요청';$('sidebarMenu').appendChild(dutyRequestButtonV400);const devButton=document.createElement('button');devButton.type='button';devButton.className='nav-btn';devButton.dataset.view='developmentRequests';devButton.textContent='개발 요청 관리';$('sidebarMenu').appendChild(devButton);for(const [id,title] of [['dutyItems','흉장·블럭·명패']]){const b=document.createElement('button');b.type='button';b.className='nav-btn';b.dataset.view=id;b.textContent=title;$('sidebarMenu').appendChild(b);}const dutyButton=document.createElement('button');dutyButton.type='button';dutyButton.className='nav-btn';dutyButton.dataset.view='dutyCadets';dutyButton.textContent='근무생도 명단';$('sidebarMenu').appendChild(dutyButton);const personalButton=document.createElement('button');personalButton.type='button';personalButton.className='nav-btn';personalButton.dataset.view='personalInterface';personalButton.textContent='인터페이스 관리';$('sidebarMenu').appendChild(personalButton);const uniformRequestButton=document.createElement('button');uniformRequestButton.type='button';uniformRequestButton.className='nav-btn';uniformRequestButton.dataset.view='uniformRequests';uniformRequestButton.textContent='피복 사이즈 수정 요청';$('sidebarMenu').appendChild(uniformRequestButton);const requestButton=document.createElement('button');requestButton.type='button';requestButton.className='nav-btn';requestButton.dataset.view='assetRequests';requestButton.textContent='생활실 비품 관리 수정 요청';$('sidebarMenu').appendChild(requestButton);
 const nav=$('sidebarMenu');Array.from(nav.querySelectorAll(':scope > .nav-btn')).forEach(b=>{navButtonsV233[b.dataset.view]=b;});
 navTreeV233=navDefaultV233();navSavedTreeV233=navDeepCopyV233(navTreeV233);navRenderV233();navUpdateDirtyV220();
 // 상위 메뉴·하위 메뉴는 HTML Drag & Drop 사용. 드롭 위치에 따라 부모·순서가 변경된다.
 nav.addEventListener('dragstart',ev=>{
  if(!navEditModeV220)return ev.preventDefault();
  const row=ev.target.closest('.tree-nav-item');const head=ev.target.closest('.tree-group-head');
  navDragV233=row?{kind:'item',id:row.dataset.navId}:head?{kind:'group',id:head.parentElement.dataset.group}:null;
  if(!navDragV233)return ev.preventDefault();
  ev.dataTransfer.effectAllowed='move';ev.dataTransfer.setData('text/plain',navDragV233.kind+':'+navDragV233.id);
 });
 nav.addEventListener('dragover',ev=>{if(!navEditModeV220||!navDragV233)return;
  const t=ev.target.closest('.tree-nav-item,.tree-group-head,.tree-items,.tree-group');if(!t)return;
  ev.preventDefault();ev.dataTransfer.dropEffect='move';nav.querySelectorAll('.tree-drop-target').forEach(n=>n.classList.remove('tree-drop-target'));t.classList.add('tree-drop-target');
 });
 nav.addEventListener('drop',ev=>{if(!navEditModeV220||!navDragV233)return;ev.preventDefault();navDnDMoveV233(navDragV233,ev.target,ev);navDragV233=null;});
 nav.addEventListener('dragend',()=>{navDragV233=null;nav.querySelectorAll('.tree-drop-target').forEach(n=>n.classList.remove('tree-drop-target'));});
 nav.addEventListener('click',ev=>{
  if(!navEditModeV220)return;
  const hiddenGroup=ev.target.closest('[data-hide-group]'),hiddenItem=ev.target.closest('[data-hide-item]');
  if(!hiddenGroup&&!hiddenItem)return;
  ev.preventDefault();ev.stopPropagation();
  const isGroup=!!hiddenGroup,key=(hiddenGroup||hiddenItem).dataset[isGroup?'hideGroup':'hideItem'];
  if(!confirm('이 메뉴를 구성에서 삭제할까요? 상위 메뉴는 포함된 하위 메뉴도 함께 제거됩니다. 저장 후 적용됩니다.'))return;
  if(isGroup){const group=navTreeV233.groups.find(g=>g.id===key);(group?.items||[]).forEach(id=>delete navTreeV233.labels[id]);navTreeV233.groups=navTreeV233.groups.filter(g=>g.id!==key);}
  else{navTreeV233.groups.forEach(g=>{g.items=g.items.filter(id=>id!==key);});delete navTreeV233.labels[key];}
  navTreeV233.schemaVersion=2;
  navRenderV233();navUpdateDirtyV220();
 });
 nav.addEventListener('click',ev=>{
  const grp=ev.target.closest('[data-rename-group]'),item=ev.target.closest('[data-rename-item]');
  if(!navEditModeV220||(!grp&&!item))return;
  ev.preventDefault();ev.stopPropagation();
  if(grp){const g=navTreeV233.groups.find(x=>x.id===grp.dataset.renameGroup);const name=prompt('상위 메뉴 이름을 입력하세요.',g.title);if(name===null)return;if(!name.trim())return alert('이름은 비울 수 없습니다.');g.title=name.trim().slice(0,25);}
  else{const id=item.dataset.renameItem;const name=prompt('메뉴에 표시할 이름을 입력하세요. (원본 시트 이름은 바뀌지 않습니다)',navTreeV233.labels[id]||navItemDefaultTitleV233(id));if(name===null)return;if(!name.trim())return alert('이름은 비울 수 없습니다.');navTreeV233.labels[id]=name.trim().slice(0,50);}
  navRenderV233();navUpdateDirtyV220();
 });
 nav.addEventListener('click',ev=>{const btn=ev.target.closest('.tree-nav-item [data-view]');if(!btn)return;
  if(navEditModeV220){ev.preventDefault();return;}
  if(switchView(btn.dataset.view)!==false)flushNote();
 });
 $('navEditButton').addEventListener('click',()=>navEditToggleV220(true));$('navSaveButton').addEventListener('click',navSaveV220);
 $('navCancelButton').addEventListener('click',navConfirmDiscardV220);
 $('navRestoreButtonV266').addEventListener('click',navOpenCatalogV301);
 $('navResetButton').addEventListener('click',()=>{if(!navEditModeV220)return;if(!confirm('상위·하위 메뉴를 기본 배치로 되돌릴까요? (저장해야 확정됩니다)'))return;navTreeV233=navDefaultV233();navRenderV233();navUpdateDirtyV220();});
}
function init(){
  document.title='군수계 업무일지';$('todayLabel').textContent=prettyDate(localISO());$('selectedDate').value=selectedDay;$('statMonth').value=localISO().slice(0,7);eqInit();rosterInit();settingsInitV258();initEditorUIV281();v284Init();supplyInit();saberInitV276();uniformInitV278();repairInit();navInitV220();v294SyncModeMenu(view);wxInit();dormInitV234();assetInitV244();surveysInitV299();
  document.body.dataset.readonly='true';updateSaveIndicator();refreshCats();renderToday();
  qsa('.mobile-nav [data-view]').forEach(b=>b.addEventListener('click',()=>{if(switchView(b.dataset.view)!==false)flushNote()}));
  $('reloadCloud').addEventListener('click',()=>{if(!navConfirmDiscardV220()||!rosterConfirmQuickAbandon()||!supplyConfirmLeave())return;flushNote();loadCloud();});$('diagnoseCloudV272').addEventListener('click',inspectConnectionV272);$('newEntryBtn').addEventListener('click',()=>showModal());
  $('prevDate').addEventListener('click',()=>changeDay(-1));$('nextDate').addEventListener('click',()=>changeDay(1));
  $('selectedDate').addEventListener('change',e=>{if(e.target.value){flushNote();selectedDay=e.target.value;renderToday()}});
  $('dailyMemo').addEventListener('input',e=>{if(!mustEdit('journal'))return;
    const day=selectedDay,value=e.target.value;data.notes[day]=value;$('memoCount').textContent=value.length+'자';
    pendingNote={day,value};clearTimeout(noteTimer);noteTimer=setTimeout(flushNote,950);
  });
  $('printBtn').addEventListener('click',()=>{flushNote();printDaily()});
  ['search','statusFilter','catFilter','sortFilter'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',renderAll));
  $('resetFilter').addEventListener('click',()=>{$('search').value='';$('statusFilter').value='';$('catFilter').value='';$('sortFilter').value='recent';renderAll()});
  $('statMonth').addEventListener('change',renderMonthly);$('entryForm').addEventListener('submit',onSave);
  $('entryForm').addEventListener('input',updateFormHint);$('entryForm').addEventListener('change',updateFormHint);$('fFollow').addEventListener('input',updateFollowCount);
  $('fTime').addEventListener('input',()=>{
    const el=$('fTime'),value=el.value.trim();
    if(/^\d{4}$/.test(value)){el.value=value.slice(0,2)+':'+value.slice(2);updateFormHint();}
  });
  $('fTime').addEventListener('blur',()=>{normalizeTime24();updateFormHint();});
  ['closeModal','cancelModal'].forEach(id=>$(id).addEventListener('click',()=>closeModal()));
  $('modalBackdrop').addEventListener('click',e=>{if(e.target===$('modalBackdrop'))closeModal()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&rosterModalOpen()){rosterClose();return;}if(e.key==='Escape'&&eqOpen()){eqClose();return;}if(e.key==='Escape'&&!$('modalBackdrop').classList.contains('hidden'))closeModal();
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&$('modalBackdrop').classList.contains('hidden')){e.preventDefault();switchView('all');$('search').focus()}});
  document.addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn)return;
    const action=btn.dataset.action;if(action==='add')showModal();if(action==='edit')showModal(btn.dataset.id);if(action==='view')showModal(btn.dataset.id,true);if(action==='delete')delEntry(btn.dataset.id)});
  $('exportJson').addEventListener('click',backup);$('exportCsv').addEventListener('click',csvExport);
  $('importJson').addEventListener('click',()=>{if(mustEdit())$('importFile').click()});$('importFile').addEventListener('change',e=>importBackup(e.target.files[0]));
  $('saveCategories').addEventListener('click',async()=>{if(!mustEdit())return;
    const cats=[...new Set($('categoryEditor').value.split(',').map(x=>x.trim()).filter(Boolean))];
    if(!cats.length||cats.length>60||cats.some(x=>x.length>60)){alert('분류는 1~60개, 각 60자까지 입력할 수 있습니다.');return;}
    try{await enqueue(()=>server('saveCategories',cats));data.categories=cats;refresh();toast('구글에 분류 저장 완료');}
    catch(err){alert('분류 저장 실패: '+err.message);}});
  $('addSamples').addEventListener('click',addSamples);
  $('clearData').addEventListener('click',async()=>{if(!mustEdit())return;
    if(!confirm('Google Sheets의 모든 업무와 날짜별 메모, 분류를 초기화할까요? 반드시 먼저 JSON 백업을 받으세요.'))return;
    if(!confirm('최종 확인: Google Sheets의 기록을 모두 초기화합니다. 계속하시겠습니까?'))return;
    try{await enqueue(()=>server('clearLogbook'));await loadCloud();switchView('today');toast('모든 업무 기록을 초기화했습니다.');}
    catch(err){alert('초기화 실패: '+err.message);}});
  window.addEventListener('beforeunload',e=>{if(isFormDirty()||modalSaving||eqDirty()||eqSaving||rosterIsDirty()||rosterHasQuickChanges()||rosterSaving||rosterQuickSaving.size||supplyDirty()||navDirtyV220||navSavingV220||wxCalDirty()||wxBulkDirtyV229()||wxCustomDirty()||wxCalSaving||wxBulkSavingV229||wxRowSaving||pendingNote||syncPending||assetDirtyV244.size||assetSavingV244){e.preventDefault();e.returnValue='';}});
  loadCloud();
}

/* v2.6 공용비품 현황 모듈: Google Sheets에 저장, 서버에서 관리 권한 확인 */
let eqLoaded=false,eqInitialized=false,eqItems=[],eqHistory=[],eqUsageV260=null,eqSnapshot='',eqSaving=false,eqReadOnly=false;
function eqOpen(){return !$('eqBackdrop').classList.contains('hidden');}
function eqFormSnapshot(){return JSON.stringify(qsa('input[name],textarea[name]', $('eqForm')).map(el=>[el.name,el.value]));}
function eqDirty(){return eqOpen()&&!eqReadOnly&&eqFormSnapshot()!==eqSnapshot;}
function eqConfirmClose(){
  if(!eqOpen())return true;
  if(eqSaving){toast('비품 현황을 저장 중입니다. 완료 후 이동하세요.');return false;}
  if(eqDirty()&&!confirm('⚠ 공용비품 현황이 저장되지 않았습니다.\n\n다른 화면으로 이동하면 입력 중인 변경사항이 사라집니다.\n\n저장하지 않고 나가시겠습니까?'))return false;
  eqClose(true);return true;
}
function eqClose(force=false){
  if(force!==true)return eqConfirmClose();
  $('eqBackdrop').classList.add('hidden');eqSnapshot='';document.body.style.overflow='';return true;
}
function eqFormatNum(v){return Number(v||0).toLocaleString('ko-KR');}
function eqRatio(pop,ok){if(pop===undefined||pop===null||pop==='')return '—';const n=Number(ok);return n>0?(Number(pop)/n).toFixed(2).replace(/\.00$/,''):'—';}
function eqSum(items){return items.reduce((a,e)=>{for(const key of ['washerOk','washerBad','dryerOk','dryerBad'])a[key]+=Number(e[key]||0);return a;},{washerOk:0,washerBad:0,dryerOk:0,dryerBad:0});}
function eqFilterRows(){
  const b=$('eqBuildingFilter').value,u=$('eqUnitFilter').value,s=$('eqSearch').value.trim().toLowerCase();
  return eqItems.filter(e=>(!b||e.building===b)&&(!u||e.unit===u)&&(!s||[e.location,e.memo,e.building,e.unit].some(v=>String(v).toLowerCase().includes(s))));
}
function eqFillOptions(){
  for(const [id,key,first] of [['eqBuildingFilter','building','전체 건물 / 구역'],['eqUnitFilter','unit','전체 중대 / 구분']]){
    const el=$(id),value=el.value;
    const values=[...new Set(eqItems.map(e=>e[key]))].filter(Boolean).sort((a,b)=>a.localeCompare(b,'ko-KR',{numeric:true}));
    el.innerHTML='<option value="">'+escapeH(first)+'</option>'+values.map(v=>`<option value="${escapeH(v)}">${escapeH(key==='unit'&&/^\d+$/.test(v)?v+'중대':v)}</option>`).join('');el.value=values.includes(value)?value:'';
  }
}
function eqRenderUsageV260(){
 if(!eqUsageV260){
  $('eqUsageStatsV260').innerHTML='<div class="labor-kpi"><span>이용 인원 계산</span><b>불러오는 중…</b></div>';
  $('eqUsageMetaV260').textContent='설비 목록은 먼저 표시했습니다. 최신 생활실 입실 인원과 구역별 비율을 계산 중입니다.';
  $('eqZoneStatsV270').innerHTML='<p class="help">생활실 현황 조회 중…</p>';
  return;
 }
 const e=eqUsageV260||{},pop=Number(e.livePopulation)||0,official=829;
 const fmt=n=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:2});
 const w=Number(e.washerOk)||0,d=Number(e.dryerOk)||0;
 const ratio=(num,den)=>den>0?fmt(num/den)+'명':'—';
 const cards=[['공식 편성 인원',fmt(official)+'명'],['생활실현황 입실 인원',e.error?'확인 필요':fmt(pop)+'명'],
 ['동선별 배정 완료',e.error?'확인 필요':fmt(e.mappedPopulation||0)+'명'],['정상 세탁기',fmt(w)+'대'],['정상 건조기',fmt(d)+'대'],
 ['세탁기 1대당 (전체)',e.error?'—':ratio(pop,w)],['건조기 1대당 (전체)',e.error?'—':ratio(pop,d)]];
 $('eqUsageStatsV260').innerHTML=cards.map(([k,v])=>'<div class="labor-kpi"><span>'+escapeH(k)+'</span><b>'+escapeH(v)+'</b></div>').join('');
 const difference=official-pop;
 const warning=e.error?'시트 연동 실패 · '+e.error:(difference?('공식 편성 인원과 현재 입실 인원 차이 '+(difference>0?'+':'')+difference+'명. '):'공식 편성 인원과 현재 입실 인원 일치. ');
 $('eqUsageMetaV260').textContent=warning+'호실별 고정 매핑으로 1명당 이용 설비를 한 번만 계산합니다. (女)는 해당 관 여생도 전용입니다. '+
 '동선 미지정 '+(e.unmatched||0)+'명 · 중복 호실 '+(e.duplicateRooms||0)+'건. 호실별 인원은 생활실현황 G열 기준으로 계산하며, PDF는 실행 중 읽지 않습니다.';
 const groups=e.groups||[];
 if(e.error){$('eqZoneStatsV270').innerHTML='<p class="help">연결 상태를 확인해야 구역별 실시간 인원을 계산할 수 있습니다.</p>';return;}
 $('eqZoneStatsV270').innerHTML='<h3 class="panel-title" style="font-size:13px;margin:8px 0">실제 동선별 세탁기·건조기 1대당 이용 인원</h3>'+
 `<table class="eq-table" style="min-width:790px"><thead><tr><th>설비 설치 위치</th><th>이용 구분</th><th>배정 인원</th><th>세탁 정상</th><th>건조 정상</th><th>세탁기 1대당</th><th>건조기 1대당</th></tr></thead><tbody>`+
 groups.map(g=>`<tr title="${escapeH(g.basis||'')}"><td style="text-align:left"><b>${escapeH(g.label)}</b><div style="font-size:11px;color:#8a98a7;margin-top:4px">${escapeH(g.basis||'')}</div></td><td>${g.femaleOnly?'여생도 전용':'일반'}</td><td>${fmt(g.population)}명</td><td>${fmt(g.washerOk)}대</td><td>${fmt(g.dryerOk)}대</td><td>${ratio(g.population,g.washerOk)}</td><td>${ratio(g.population,g.dryerOk)}</td></tr>`).join('')+`</tbody></table>`+
 ((e.unmatchedExamples||[]).length?'<p class="help" style="margin-top:8px">※ 미매칭 예시: '+e.unmatchedExamples.map(x=>escapeH([x.building,x.floor,x.room,x.reason].join(' / '))).join(' · ')+'</p>':'');
}
function eqLinkedV270(id){const e=eqUsageV260||{};return e.error?null:((e.byItem||{})[id]||null);}
function eqLinkedRatioV270(id,key){const v=eqLinkedV270(id);if(!v)return '—';const n=Number(v[key]||0);return n>0?eqRatio(v.population,n):'—';}
function renderEquipment(){
  $('eqInit').classList.toggle('hidden',eqInitialized);$('eqActive').classList.toggle('hidden',!eqInitialized);
  if(!eqInitialized){$('eqSetupBtn').hidden=!canEdit;return;}
  eqFillOptions();eqRenderUsageV260();const rows=eqFilterRows(),s=eqSum(rows);
  const stats=[['세탁기 정상',s.washerOk,'대'],['세탁기 고장',s.washerBad,'대'],['건조기 정상',s.dryerOk,'대'],['건조기 고장',s.dryerBad,'대']];
  $('eqStats').innerHTML=stats.map(([name,n,unit],i)=>`<div class="eq-summary-item"><small>${name}</small><strong ${i%2?'style="color:#d25d5d"':''}>${eqFormatNum(n)}</strong><em>${unit}</em></div>`).join('');
  $('eqCount').textContent=`조회 ${rows.length}개 위치 / 전체 ${eqItems.length}개 위치 · 입력값 변경 시 즉시 합계 반영`;
  $('eqTableBody').innerHTML=rows.length?rows.map(e=>`<tr><td>${escapeH(e.building)}</td><td>${escapeH(/^\d+$/.test(e.unit)?e.unit+'중대':e.unit)}</td><td class="eq-location" title="${escapeH(e.location)}">${escapeH(e.location)}</td><td>${eqFormatNum(e.washerOk)}</td><td class="${Number(e.washerBad)?'eq-warning':'eq-none'}">${eqFormatNum(e.washerBad)}</td><td>${eqFormatNum(e.dryerOk)}</td><td class="${Number(e.dryerBad)?'eq-warning':'eq-none'}">${eqFormatNum(e.dryerBad)}</td><td title="${escapeH(eqLinkedV270(e.id)?.label||'')}">${eqLinkedV270(e.id)?eqFormatNum(eqLinkedV270(e.id).population)+'명 (공유)':'—'}</td><td>${eqLinkedRatioV270(e.id,'washerOk')}</td><td>${eqLinkedRatioV270(e.id,'dryerOk')}</td><td>${escapeH(e.checkedOn)}</td><td><button class="small-link" data-eq-action="edit" data-id="${escapeH(e.id)}">${canEdit?'수정':'조회'}</button>${canEdit?` <button class="text-action delete" data-eq-action="delete" data-id="${escapeH(e.id)}">삭제</button>`:''}</td></tr>`).join(''):'<tr><td colspan="12">검색 조건에 맞는 비품이 없습니다.</td></tr>';
  const groups=[...new Set(eqItems.map(e=>e.building))];
  const groupsSorted=['정예관','비전관','성기훈',...groups].filter((v,i,a)=>groups.includes(v)&&a.indexOf(v)===i);
  $('eqBuildingTotals').innerHTML=`<table class="eq-table" style="min-width:650px"><thead><tr><th>건물 / 구역</th><th>위치 수</th><th>세탁기 정상</th><th>세탁기 고장</th><th>건조기 정상</th><th>건조기 고장</th></tr></thead><tbody>`+groupsSorted.map(b=>{const arr=eqItems.filter(x=>x.building===b),z=eqSum(arr);return `<tr><td>${escapeH(b)}</td><td>${arr.length}</td><td>${z.washerOk}</td><td class="eq-warning">${z.washerBad}</td><td>${z.dryerOk}</td><td class="eq-warning">${z.dryerBad}</td></tr>`;}).join('')+`</tbody></table>`;
  $('eqHistory').innerHTML=eqHistory.length?eqHistory.map(h=>`<div class="eq-history-row"><span>${escapeH(h.at.replace('T',' ').slice(0,19))}</span><div><b>${escapeH(h.action)}</b> · ${escapeH(h.building)} / ${escapeH(h.unit)} / ${escapeH(h.location)}<div style="font-size:11px;color:#92a0b4">${escapeH(h.user)}</div></div></div>`).join(''):'<p style="color:#9aa8b7;font-size:12px">아직 변경 이력이 없습니다.</p>';
}
/** v2.82 · 목록은 먼저 표시하고, 생활실 인원·세탁장 계산은 별도로 갱신합니다. */
let equipmentRequestV282=0;
async function loadEquipment(){
 if(!ready)return;
 const ticket=++equipmentRequestV282;
 $('eqInit').classList.add('hidden');$('eqActive').classList.add('hidden');
 try{
  const r=await server('getEquipmentCoreV282');
  if(ticket!==equipmentRequestV282)return;
  eqLoaded=true;eqInitialized=!!r.initialized;eqItems=r.items||[];eqHistory=r.history||[];eqUsageV260=null;
  renderEquipment();
  if(!eqInitialized)return;
  // 느린 생활실 파일을 기다리지 않고 우선 목록에서 조회·수정을 할 수 있습니다.
  server('getEquipmentUsageV282').then(usage=>{
   if(ticket!==equipmentRequestV282)return;
   eqUsageV260=usage;renderEquipment();
  }).catch(err=>{
   if(ticket!==equipmentRequestV282)return;
   eqUsageV260={error:'이용 인원 계산 실패: '+err.message};renderEquipment();
  });
 }catch(err){if(ticket!==equipmentRequestV282)return;eqLoaded=false;alert('공용비품 현황 불러오기 실패: '+err.message);}
}
function eqShowModal(id){
  if(!eqInitialized)return;if(!eqConfirmClose())return;if(!id&&!mustEdit())return;
  const e=id?eqItems.find(x=>x.id===id):null;if(id&&!e)return;
  eqReadOnly=!canEdit;
  $('eqForm').reset();$('eqId').value=e?.id||'';$('eqModalTitle').textContent=eqReadOnly?'공용비품 상세 조회':e?'공용비품 현황 수정':'새 설치 위치 등록';
  for(const [key,el] of Object.entries({building:'eqBuilding',unit:'eqUnit',location:'eqLocation',washerOk:'eqWasherOk',washerBad:'eqWasherBad',dryerOk:'eqDryerOk',dryerBad:'eqDryerBad',population:'eqPopulation',checkedOn:'eqChecked',memo:'eqMemo'})){
    $(el).value=e?(e[key]??''):(['washerOk','washerBad','dryerOk','dryerBad'].includes(key)?'0':key==='checkedOn'?localISO():'');
  }
  qsa('input,textarea',$('eqForm')).forEach(el=>{if(el.id!=='eqId')el.disabled=eqReadOnly;});$('eqSave').hidden=eqReadOnly;
  eqSaving=false;eqSnapshot=eqFormSnapshot();$('eqBackdrop').classList.remove('hidden');document.body.style.overflow='hidden';
}
async function eqSubmit(ev){
  ev.preventDefault();if(!mustEdit()||eqSaving)return;
  const f=$('eqForm');if(!f.reportValidity())return;
  const old=eqItems.find(x=>x.id===$('eqId').value);
  const item={id:old?.id||'',updatedAt:old?.updatedAt||'',building:$('eqBuilding').value.trim(),unit:$('eqUnit').value.trim(),location:$('eqLocation').value.trim(),washerOk:$('eqWasherOk').value,washerBad:$('eqWasherBad').value,dryerOk:$('eqDryerOk').value,dryerBad:$('eqDryerBad').value,population:$('eqPopulation').value,checkedOn:$('eqChecked').value,memo:$('eqMemo').value.trim()};
  eqSaving=true;$('eqSave').disabled=true;$('eqSave').textContent='Google Sheets 저장 중...';
  try{const saved=await enqueue(()=>server('saveEquipment',item));eqClose(true);if(old){const i=eqItems.findIndex(x=>x.id===old.id);eqItems[i]=saved;}else eqItems.push(saved);await loadEquipment();toast(old?'공용비품 수정 완료':'공용비품 위치 등록 완료');}
  catch(err){alert('공용비품 저장 실패: '+err.message+'\n입력한 내용은 아직 화면에 남아 있습니다.');}
  finally{eqSaving=false;$('eqSave').disabled=false;$('eqSave').textContent='현황 저장';}
}
async function eqDelete(id){
  if(!mustEdit())return;const item=eqItems.find(x=>x.id===id);
  if(!item||!confirm(`${item.building} / ${item.unit} / ${item.location} 위치를 삭제할까요?\n대수 합계에서 제외되지만 변경이력은 남습니다.`))return;
  try{await enqueue(()=>server('removeEquipment',id,item.updatedAt));await loadEquipment();toast('위치 삭제 완료');}
  catch(err){alert('위치 삭제 실패: '+err.message);}
}
function eqCsvExport(){
 const fields=['building','unit','location','washerOk','washerBad','dryerOk','dryerBad','population','checkedOn','memo','updatedAt'];
 const names=['건물/구역','중대/구분','위치','세탁기 정상','세탁기 고장','건조기 정상','건조기 고장','보고서 당시 사용 인원','점검일','특이사항','수정시각',
 '연계 공동 이용 구역','현재 등록 인원','세탁기 1대당 인원','건조기 1대당 인원','공식 편성 인원(전체)'];
 const rows=[names.map(csvCell).join(',')];
 eqFilterRows().forEach(x=>{
  const a=eqLinkedV270(x.id),z=a?[a.label,a.population,eqLinkedRatioV270(x.id,'washerOk'),eqLinkedRatioV270(x.id,'dryerOk'),'829']:['연동 불가','','','','829'];
  rows.push([...fields.map(k=>x[k]),...z].map(csvCell).join(','));
 });
 download(new Blob(['\ufeff',rows.join('\r\n')],{type:'text/csv;charset=utf-8'}),'공용비품_세탁기_건조기_'+localISO()+'.csv');toast('공용비품 CSV 다운로드 완료');
}
function eqInit(){
  ['eqBuildingFilter','eqUnitFilter'].forEach(id=>$(id).addEventListener('change',renderEquipment));$('eqSearch').addEventListener('input',renderEquipment);
  $('eqReload').addEventListener('click',loadEquipment);$('eqNew').addEventListener('click',()=>eqShowModal());$('eqCsv').addEventListener('click',eqCsvExport);
  $('eqForm').addEventListener('submit',eqSubmit);$('eqClose').addEventListener('click',()=>eqClose());$('eqCancel').addEventListener('click',()=>eqClose());
  $('eqBackdrop').addEventListener('click',e=>{if(e.target===$('eqBackdrop'))eqClose();});
  $('eqActive').addEventListener('click',e=>{const btn=e.target.closest('[data-eq-action]');if(!btn)return;btn.dataset.eqAction==='edit'?eqShowModal(btn.dataset.id):eqDelete(btn.dataset.id);});
  $('eqSetupBtn').addEventListener('click',async()=>{
    if(!mustEdit()||!confirm('2026.7.9. 보고서의 공용비품 24개 위치 현황을 최초 등록할까요?\n이미 존재하는 업무일지는 변경하지 않습니다.'))return;
    $('eqSetupBtn').disabled=true;
    try{await enqueue(()=>server('setupEquipmentModule'));await loadEquipment();toast('최초 공용비품 현황 등록 완료');}
    catch(err){alert('최초 등록 실패: '+err.message);await loadEquipment();}
    finally{$('eqSetupBtn').disabled=false;}
  });
}

/* v2.7 명단 관리 프런트엔드 */
let rosterLoaded=false,rosterItems=[],rosterHistory=[],rosterSortMode='cohort',rosterSaving=false,rosterSnapshot='',rosterCurrent=null,rosterReadOnly=false,rosterSchemaReady=false;
const rosterQuickDrafts=new Map();
const rosterQuickSaving=new Set();
function rosterModalOpen(){return !$('rosterBackdrop').classList.contains('hidden')}
function rosterIsDirty(){if(!rosterModalOpen()||rosterReadOnly)return false;return JSON.stringify(rosterFormValue())!==rosterSnapshot;}
function rosterHasQuickChanges(){return rosterQuickDrafts.size>0;}
function rosterConfirmQuickAbandon(){
  if(rosterSaving||rosterQuickSaving.size){toast('저장 중입니다. 저장이 완료되면 이동할 수 있습니다.');return false;}
  if(!rosterHasQuickChanges())return true;
  if(!confirm('⚠ 총기상태·비고 수정사항이 저장되지 않았습니다.\n다른 화면으로 이동하면 수정 내용이 사라집니다. 저장하지 않고 이동할까요?'))return false;
  rosterQuickDrafts.clear();return true;
}
function rosterCloseConfirm(){if(!rosterModalOpen())return true;return rosterClose()}
function rosterClose(force=false){
  if(rosterSaving&&!force)return false;
  if(!force&&rosterIsDirty()&&!confirm('⚠ 명단이 저장되지 않았습니다.\n\n다른 화면으로 이동하면 입력한 정보가 사라질 수 있습니다. 저장하지 않고 나가시겠습니까?'))return false;
  $('rosterBackdrop').classList.add('hidden');rosterSnapshot='';rosterCurrent=null;return true;
}
function rosterFormValue(){return {id:$('rosterId').value,cohort:$('rosterFCohort').value.trim(),company:$('rosterFCompany').value,flight:$('rosterFFlight').value.trim(),name:$('rosterFName').value.trim(),cadetNumber:$('rosterFCadetNumber').value.trim(),firearmNumber:$('rosterFFirearmNumber').value.trim(),firearmStatus:$('rosterFStatus').value,memo:$('rosterFMemo').value.trim()};}
function rosterShow(id,forceReadOnly=false){
  const r=id?rosterItems.find(x=>x.id===id):null;
  if(id&&!r){alert('해당 명단을 찾을 수 없습니다. 명단을 새로고침하세요.');return;}
  if(rosterModalOpen()&&!rosterClose())return;
  if(!rosterConfirmQuickAbandon())return;rosterRender();
  rosterCurrent=r||null;rosterReadOnly=forceReadOnly||!canEdit;
  $('rosterForm').reset();$('rosterId').value=r?.id||'';
  ['cohort','company','flight','name','cadetNumber','firearmNumber','firearmStatus','memo'].forEach(k=>{
    const el={cohort:'rosterFCohort',company:'rosterFCompany',flight:'rosterFFlight',name:'rosterFName',cadetNumber:'rosterFCadetNumber',firearmNumber:'rosterFFirearmNumber',firearmStatus:'rosterFStatus',memo:'rosterFMemo'}[k];
    if(el)$(el).value=r?.[k]||'';
  });
  if(!r){$('rosterFCohort').value=$('rosterCohort').value||$('rosterDefaultCohort').value.trim();$('rosterFCompany').value=$('rosterCompany').value||'';}
  // 원본 중대가 목록에 없으면 기타 선택 및 원본 값은 수정 전까지 그대로 유지하지 않습니다. 이 경우 수정 시 알려줍니다.
  if(r&&r.company&&!['','1','2','3','4','5','6','7','8','기타'].includes(r.company)){
    const select=$('rosterFCompany');const opt=document.createElement('option');opt.value=r.company;opt.textContent=r.company;opt.dataset.temp='1';select.append(opt);select.value=r.company;
  }
  $('rosterForm').querySelectorAll('input,select,textarea').forEach(el=>{if(el.type!=='hidden')el.disabled=rosterReadOnly;});
  $('rosterSubmit').classList.toggle('hidden',rosterReadOnly);
  $('rosterModalTitle').textContent=rosterReadOnly?'명단 확인':r?'명단 수정':'명단 등록';
  $('rosterModalHint').textContent=rosterReadOnly?'조회 전용 화면입니다.':'저장하면 Google Sheets에 반영됩니다.';
  rosterSnapshot=JSON.stringify(rosterFormValue());$('rosterBackdrop').classList.remove('hidden');
  if(!rosterReadOnly)$('rosterFName').focus();
}
// 전체 명단을 숫자 오름차순으로 정렬합니다. '75기', '75' 및 '1중대', '1' 표기를 모두 지원합니다.
function rosterOrderValue(value){
  const text=String(value??'').trim(),match=text.match(/\d+/);
  return {text,hasNumber:!!match,number:match?Number(match[0]):0};
}
function rosterNumberCompare(a,b){
  const x=rosterOrderValue(a),y=rosterOrderValue(b);
  if(x.hasNumber!==y.hasNumber)return x.hasNumber?-1:1;
  if(x.hasNumber&&y.hasNumber)return x.number-y.number;
  return x.text.localeCompare(y.text,'ko',{numeric:true,sensitivity:'base'});
}
function rosterCmp(a,b){
  const byCompany=rosterNumberCompare(a.company,b.company),byCohort=rosterNumberCompare(a.cohort,b.cohort);
  return (rosterSortMode==='company'?byCompany||byCohort:byCohort||byCompany)
    ||rosterNumberCompare(a.flight,b.flight)
    ||String(a.name||'').localeCompare(String(b.name||''),'ko',{numeric:true})
    ||String(a.id||'').localeCompare(String(b.id||''));
}
function isRepairV216(status){return status==='수리 필요(보고)'||status==='수리 필요(미보고)'||status==='수리 필요'||status==='교체 필요';}
function repairBadgeV216(status){return status==='교체 필요'?'교체 필요':status==='수리 필요(보고)'?'보고':'미보고';}
function rosterFiltered(){
  const search=$('rosterSearch').value.trim().toLowerCase(),cohort=$('rosterCohort').value,company=$('rosterCompany').value;
  return rosterItems.filter(x=>(!cohort||x.cohort===cohort)&&(!company||x.company===company)&&(!$('rosterRepairOnly').checked||isRepairV216(x.firearmStatus))&&(!search||[x.name,x.cohort,x.company,x.flight,x.cadetNumber,x.firearmNumber,x.firearmStatus,x.memo].some(v=>String(v||'').toLowerCase().includes(search)))).sort(rosterCmp);
}
/** 실제 저장값(예: 2, 2중대, 2중대중대)은 고치지 않고 화면에서만 일관되게 표시합니다. */
function companyLabelV257(value){
 const s=String(value??'').trim(),compact=s.replace(/\s+/g,'');
 const m=compact.match(/^([1-8])(?:중대)*$/);
 return m?m[1]+'중대':s;
}
function rosterGroupLabel(cohort,company){
  const cohortText=String(cohort||'').trim(),companyText=String(company||'').trim();
  const formattedCohort=/^\d+$/.test(cohortText)?cohortText+'기':cohortText||'기수 미분류';
  const formattedCompany=companyLabelV257(companyText)||'중대 미분류';
  return rosterSortMode==='company'?formattedCompany+' · '+formattedCohort:formattedCohort+' · '+formattedCompany;
}
function rosterGroupKey(r){
  const c=rosterOrderValue(r.cohort),u=rosterOrderValue(r.company);
  const cn=c.hasNumber?'#'+c.number:c.text.toLowerCase(),un=u.hasNumber?'#'+u.number:u.text.toLowerCase();
  return rosterSortMode==='company'?un+'|'+cn:cn+'|'+un;
}
function rosterFilters(){
  const oldCohort=$('rosterCohort').value,oldCompany=$('rosterCompany').value,oldGrad=$('rosterGraduateCohort').value,oldNormal=$('rosterNormalizeCohort').value;
  const cohorts=[...new Set(rosterItems.map(x=>x.cohort).filter(Boolean))].sort((a,b)=>b.localeCompare(a,'ko',{numeric:true}));
  const companies=[...new Set(rosterItems.map(x=>x.company).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko',{numeric:true}));
  $('rosterCohort').innerHTML='<option value="">전체 기수</option>'+cohorts.map(x=>`<option value="${escapeH(x)}">${escapeH(x)}</option>`).join('');
  $('rosterCompany').innerHTML='<option value="">전체 중대</option>'+companies.map(x=>`<option value="${escapeH(x)}">${escapeH(companyLabelV257(x))}</option>`).join('');
  $('rosterGraduateCohort').innerHTML='<option value="">졸업 처리할 기수 선택</option>'+cohorts.map(x=>`<option value="${escapeH(x)}">${escapeH(x)} (${rosterItems.filter(y=>y.cohort===x).length}명)</option>`).join('');
  $('rosterNormalizeCohort').innerHTML='<option value="">정상 처리할 기수 선택</option>'+cohorts.map(x=>`<option value="${escapeH(x)}">${escapeH(x)} (${rosterItems.filter(y=>y.cohort===x).length}명)</option>`).join('');
  $('rosterCohortList').innerHTML=cohorts.map(x=>`<option value="${escapeH(x)}"></option>`).join('');
  if(cohorts.includes(oldCohort))$('rosterCohort').value=oldCohort;
  if(companies.includes(oldCompany))$('rosterCompany').value=oldCompany;
  if(cohorts.includes(oldGrad))$('rosterGraduateCohort').value=oldGrad;
  if(cohorts.includes(oldNormal))$('rosterNormalizeCohort').value=oldNormal;
}
function rosterRender(){
  if(!rosterLoaded)return;
  rosterFilters();
  const results=rosterFiltered();
  const cohorts=new Set(rosterItems.map(x=>x.cohort).filter(Boolean));
  const counts={total:rosterItems.length,classes:cohorts.size,companies:new Set(rosterItems.map(x=>x.company).filter(Boolean)).size,shown:results.length};
  $('rosterMetrics').innerHTML=[['전체 인원',counts.total+'명'],['수리 필요(보고)',rosterItems.filter(x=>x.firearmStatus==='수리 필요(보고)').length+'명'],['수리 필요(미보고)',rosterItems.filter(x=>x.firearmStatus==='수리 필요(미보고)').length+'명'],['조회 결과',counts.shown+'명']].map(x=>`<div class="roster-metric"><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join('');
  const companyFirst=rosterSortMode==='company';
  for(const [id,active] of [['rosterSortCompany',companyFirst],['rosterSortCohort',!companyFirst]]){
    $(id).classList.toggle('roster-sort-active',active);
    $(id).setAttribute('aria-pressed',String(active));
  }
  $('rosterCount').textContent=`${results.length.toLocaleString()}명 전체 표시 / 등록 ${rosterItems.length.toLocaleString()}명 · ${companyFirst?'중대 → 기수 순':'기수 → 중대 순'}`;
  const groupCounts=new Map();
  for(const r of results){const key=rosterGroupKey(r);groupCounts.set(key,(groupCounts.get(key)||0)+1);}
  let previousKey=null;
  $('rosterRows').innerHTML=results.length?results.map(r=>{
    const key=rosterGroupKey(r);
    let groupHeading='';
    if(key!==previousKey){
      groupHeading=`<tr class="roster-group-row"><td colspan="8"><span>${escapeH(rosterGroupLabel(r.cohort,r.company))}</span><small>${groupCounts.get(key)}명</small></td></tr>`;
      previousKey=key;
    }
    const draft=rosterQuickDrafts.get(r.id);
    const v=draft||r;
    const editable=canEdit&&rosterSchemaReady;
    const repair=isRepairV216(v.firearmStatus);
    const selected=v.firearmStatus||'';
    const statusOptions=[['','상태 선택'],['정상','정상'],['수리 필요(보고)','수리 필요(보고)'],['수리 필요(미보고)','수리 필요(미보고)']].map(([value,label])=>`<option value="${escapeH(value)}" ${selected===value?'selected':''}>${label}</option>`).join('');
    const statusSelect=`<select class="roster-status-select ${repair?'is-repair':''}" data-roster-field="firearmStatus" data-id="${escapeH(r.id)}" aria-label="${escapeH(r.name)} 총기상태" ${editable?'':'disabled'}>${statusOptions}</select>`;
    const note=`<textarea class="roster-inline-memo" data-roster-field="memo" data-id="${escapeH(r.id)}" maxlength="1500" rows="1" aria-label="${escapeH(r.name)} 총기상태 비고" placeholder="상태 상세 입력" title="${escapeH(v.memo||'')}" ${editable?'':'disabled'}>${escapeH(v.memo||'')}</textarea>`;
    const save=editable?`<button class="small-link roster-save-quick" data-roster-action="savequick" data-id="${escapeH(r.id)}" ${draft?'':'hidden'}>저장</button>`:'';
    const nameButton=`<button class="roster-person-open" type="button" data-roster-action="edit" data-id="${escapeH(r.id)}" title="생도 상세정보 열기">${escapeH(r.name)}</button>${repair?`<span class="roster-repair-flag">${repairBadgeV216(v.firearmStatus)}</span>`:''}`;
    const compactActions=editable?`<span class="roster-move-compact"><select data-roster-move="${escapeH(r.id)}" aria-label="${escapeH(r.name)} 이동 상태"><option value="">상태 선택</option><option value="위탁">위탁</option><option value="휴학">휴학</option><option value="퇴교">퇴교</option><option value="퇴학">퇴학</option></select><button type="button" data-roster-action="move" data-id="${escapeH(r.id)}">수정</button></span>`:'조회 전용';
    return groupHeading+`<tr class="${repair?'roster-repair-row':''}" data-id="${escapeH(r.id)}" data-dirty="${!!draft}"><td>${escapeH(r.cohort)}</td><td>${escapeH(companyLabelV257(r.company))}</td><td>${nameButton}</td><td>${escapeH(r.cadetNumber||'-')}</td><td>${escapeH(r.firearmNumber||'-')}</td><td>${statusSelect}</td><td>${note}</td><td>${save} ${compactActions}</td></tr>`;
  }).join(''):'<tr><td colspan="8" style="text-align:center;color:#8a9ab0;padding:38px">해당 조건의 명단이 없습니다.</td></tr>';
  $('rosterPageInfo').textContent=`${results.length.toLocaleString()}명 전체를 표시 중 · ${groupCounts.size}개 그룹 · 현재 ${companyFirst?'중대별':'기수별'} 정렬`;
  $('rosterHistory').innerHTML=rosterHistory.length?rosterHistory.map(h=>`<div style="padding:8px 0;border-bottom:1px solid #edf1f5"><b>${escapeH(h.action)}</b> · ${escapeH(h.cohort||'-')} · ${escapeH(h.count)}명 <span style="color:#99a6b9">${escapeH(h.at.slice(0,16))}</span></div>`).join(''):'아직 변경 이력이 없습니다.';
}
async function loadRoster(){
  try{
    const r=await server('getRosterData');rosterLoaded=true;rosterItems=r.items||[];rosterHistory=r.history||[];rosterSchemaReady=!!r.schemaReady;
    $('rosterInit').classList.toggle('hidden',!!r.initialized);$('rosterActive').classList.toggle('hidden',!r.initialized);
    if(r.initialized){$('rosterOpenSheet').href=r.sheetUrl||'#';$('rosterMigration').classList.toggle('hidden',rosterSchemaReady);rosterRender();}
  }catch(err){rosterLoaded=false;alert('명단 불러오기 실패: '+err.message);}
}
async function rosterSubmit(e){e.preventDefault();if(!mustEdit()||rosterSaving)return;if(!rosterSchemaReady){alert('먼저 총기상태 열 업데이트를 완료하세요.');return;}
  const entry=rosterFormValue();if(!entry.cohort||!entry.company||!entry.name){alert('기수·중대·이름을 모두 입력하세요.');return;}
  if(rosterCurrent)entry.updatedAt=rosterCurrent.updatedAt;
  rosterSaving=true;$('rosterSubmit').disabled=true;
  try{await enqueue(()=>server('saveRosterMember',entry));rosterClose(true);await loadRoster();toast('명단이 저장됐습니다.');}
  catch(err){alert('명단 저장 실패: '+err.message+'\n입력값은 화면에 남아 있습니다.');}
  finally{rosterSaving=false;$('rosterSubmit').disabled=false;}
}
async function rosterDelete(id){if(!mustEdit())return;const v=rosterItems.find(x=>x.id===id);if(!v)return;
  if(!confirm(`${v.cohort} ${v.name} 생도의 명단을 삭제할까요?\n개별 삭제는 졸업 기수 보관과 달리 보관되지 않습니다.`))return;
  try{await enqueue(()=>server('removeRosterMember',v.id,v.updatedAt));await loadRoster();toast('명단 삭제 완료');}catch(err){alert('삭제 실패: '+err.message);}
}
async function rosterBatch(method,args,msg){if(!mustEdit())return;if(!rosterSchemaReady){alert('먼저 총기상태 열 업데이트를 완료하세요.');return;}
  if(!confirm(msg))return;
  try{const r=await enqueue(()=>server(method,...args));await loadRoster();toast(`등록 ${r.added}명 · 중복 제외 ${r.skipped}명`);alert(`명단 가져오기 완료\n신규 등록: ${r.added}명\n중복 건너뜀: ${r.skipped}명\n현재 전체: ${r.total}명`);}
  catch(err){alert('일괄 등록 실패: '+err.message);}
}
async function rosterGraduate(){if(!mustEdit())return;
  const cohort=$('rosterGraduateCohort').value;if(!cohort){alert('졸업 처리할 기수를 선택하세요.');return;}
  const count=rosterItems.filter(x=>x.cohort===cohort).length;
  const typed=prompt(`${cohort} ${count}명을 활동 명단에서 일괄 제거하고 별도의 보관 탭으로 이동합니다.\n\n계속하려면 기수명을 정확히 입력하세요.`, '');
  if(typed!==cohort){if(typed!==null)alert('기수가 일치하지 않아 취소했습니다.');return;}
  if(!confirm(`최종 확인: ${cohort} ${count}명 전체를 졸업 처리합니다. 계속하시겠습니까?`))return;
  try{const r=await enqueue(()=>server('graduateRosterCohort',cohort,count));await loadRoster();toast(`${cohort} ${r.removed}명 졸업 처리 완료`);alert(`${cohort} ${r.removed}명의 자료를 '졸업기수보관' 탭으로 옮겼습니다.\n활동 명단에서 제외했으며, 업무일지와 공용비품 현황은 유지됩니다.`);}
  catch(err){alert('졸업 처리 실패: '+err.message);}
}
async function rosterNormalizeCohort(){
  if(!mustEdit()||rosterSaving)return;
  if(!rosterSchemaReady){alert('먼저 총기상태 열 업데이트를 완료하세요.');return;}
  if(!rosterConfirmQuickAbandon())return;
  const cohort=$('rosterNormalizeCohort').value;
  if(!cohort){alert('정상 처리할 기수를 먼저 선택하세요.');return;}
  const members=rosterItems.filter(x=>x.cohort===cohort);
  if(!members.length){alert('해당 기수 명단이 없습니다.');return;}
  const repairs=members.filter(x=>isRepairV216(x.firearmStatus)).length;
  const unset=members.filter(x=>!x.firearmStatus).length;
  const message=`${cohort} 전체 ${members.length}명의 총기상태를 '정상'으로 변경합니다.\n\n현재 수리 필요(보고 완료·미보고 합계) ${repairs}명 · 미설정 ${unset}명\n※ 교번·총기번호·비고는 유지됩니다.\n※ 실제 점검을 마친 경우에만 실행하세요.\n\n계속하려면 기수명을 정확히 입력하세요.`;
  const typed=prompt(message,'');
  if(typed!==cohort){if(typed!==null)alert('기수가 일치하지 않아 취소했습니다.');return;}
  if(!confirm(`${cohort} ${members.length}명 전체의 총기상태를 정상으로 변경할까요? 수리 필요(보고 완료·미보고 합계) ${repairs}명도 정상으로 바뀝니다.`))return;
  const statusCounts={};
  for(const m of members){const status=m.firearmStatus||'미설정';statusCounts[status]=(statusCounts[status]||0)+1;}
  const token=['정상','수리 필요(보고)','수리 필요(미보고)','미설정'].map(k=>k+':'+(statusCounts[k]||0)).join('|');
  rosterSaving=true;$('rosterNormalize').disabled=true;
  try{
    const result=await enqueue(()=>server('normalizeRosterCohort',cohort,members.length,repairs,token));
    await loadRoster();toast(`${cohort} ${result.changed}명 총기상태 정상 변경`);
    alert(`${cohort} 전체 ${result.total}명 확인 완료\n정상으로 변경한 인원: ${result.changed}명\n기존 교번·총기번호·비고는 그대로 유지했습니다.`);
  }catch(err){alert('선택 기수 전체 정상 처리 실패: '+err.message);}
  finally{rosterSaving=false;$('rosterNormalize').disabled=false;}
}
function rosterCsv(){
  const rows=[['기수','중대','이름','교번','총기번호','총기상태','비고'],...rosterFiltered().map(x=>[x.cohort,x.company,x.name,x.cadetNumber,x.firearmNumber,x.firearmStatus||'',x.memo])];
  const q=v=>'"'+String(v||'').replace(/"/g,'""')+'"';
  download(new Blob(['\ufeff'+rows.map(row=>row.map(q).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'생도명단_총기번호_'+localISO()+'.csv');
}
async function rosterQuickSave(id){
  if(!canEdit||!rosterSchemaReady||rosterQuickSaving.has(id))return;
  const current=rosterItems.find(r=>r.id===id),draft=rosterQuickDrafts.get(id);
  if(!current||!draft)return;
  const snapshot={firearmStatus:draft.firearmStatus||'',memo:draft.memo||''};
  const row=[...$('rosterRows').querySelectorAll('tr[data-id]')].find(el=>el.dataset.id===id);
  const button=row?.querySelector('[data-roster-action="savequick"]');
  rosterQuickSaving.add(id);
  if(button){button.hidden=false;button.disabled=true;button.textContent='저장 중';}
  try{
    const saved=await enqueue(()=>server('saveRosterMember',{...current,...snapshot}));
    Object.assign(current,saved);
    const latest=rosterQuickDrafts.get(id);
    if(latest&&latest.firearmStatus===snapshot.firearmStatus&&latest.memo===snapshot.memo){
      rosterQuickDrafts.delete(id);
      if(row){row.dataset.dirty='false';if(button)button.hidden=true;}
    }
    if(row){
      const s=row.querySelector('[data-roster-field="firearmStatus"]');
      const note=row.querySelector('[data-roster-field="memo"]');
      const v=rosterQuickDrafts.get(id)||current;
      const repair=isRepairV216(v.firearmStatus);
      row.classList.toggle('roster-repair-row',repair);
      if(s)s.classList.toggle('is-repair',repair);
      const nameCell=row.children[2],flag=nameCell?.querySelector('.roster-repair-flag');
      if(repair&&!flag)nameCell?.insertAdjacentHTML('beforeend',`<span class="roster-repair-flag">${repairBadgeV216(v.firearmStatus)}</span>`);
      if(repair&&flag)flag.textContent=repairBadgeV216(v.firearmStatus);
      if(!repair&&flag)flag.remove();
      if(note)note.title=v.memo||'';
    }
    toast('총기상태·비고 저장 완료');
  }catch(err){alert('변경사항 저장 실패: '+err.message+'\n입력한 내용은 그대로 남겨뒀습니다. 저장 버튼으로 다시 시도하세요.');}
  finally{
    rosterQuickSaving.delete(id);
    if(button){button.disabled=false;button.textContent='저장';button.hidden=!rosterQuickDrafts.has(id);}
    const latest=rosterQuickDrafts.get(id);
    if(latest&&(latest.firearmStatus!==snapshot.firearmStatus||latest.memo!==snapshot.memo))rosterQuickSave(id);
  }
}


/* v2.55 스마트당직 8중대별 연결 / 관리명단 이동·복구 / 별도 총기번호 */
let smartReportV253=null,smartSubtabV253='regular',smartLoadingV253=false,smartSourceLoadedV255=false;
// Live refresh while special tab is visible. URLs stay saved in ScriptProperties across deployments.
setInterval(()=>{if(view==='roster'&&smartSubtabV253==='special'&&!smartLoadingV253&&document.visibilityState==='visible')smartLoadV253();},300000);
function smartSwitchV253(target){
 smartSubtabV253=target;const special=target==='special';
 $('rosterRegularPane').classList.toggle('hidden',special);
 $('rosterSpecialPane').classList.toggle('hidden',!special);
 $('rosterTabRegular').classList.toggle('active',!special);$('rosterTabSpecial').classList.toggle('active',special);
 $('rosterTabRegular').setAttribute('aria-selected',String(!special));$('rosterTabSpecial').setAttribute('aria-selected',String(special));
 if(special)smartLoadV253();
}
async function smartLoadV253(){
 if(smartLoadingV253)return;smartLoadingV253=true;$('smartSourceHint').textContent='스마트당직 기준명단과 이동 관리 명단을 확인하고 있습니다...';
 try{smartReportV253=await server('getSmartDutyExceptionV253');smartRenderV253();}
 catch(err){$('smartSourceHint').textContent='대조 실패: '+err.message;$('smartAbsentRows').innerHTML='<tr><td colspan="7">'+escapeH(err.message)+'</td></tr>';}
 finally{smartLoadingV253=false;}
}
function smartRenderV253(){
 const p=smartReportV253;if(!p)return;
 // 연결 URL 입력은 기타 → 설정에서만 관리. 명단 새로고침은 설정 입력값을 덮어쓰지 않습니다.
 const savedCount=Array.from({length:8},(_,idx)=>p.savedSources?.[idx+1]||'').filter(Boolean).length;
 $('smartConnectionStateV257').textContent=savedCount===8
   ? '연결 유지 중 · 8개 중대 주소 저장됨 · '+(p.readError?'실시간 조회 오류: '+p.readError:'최신 조회 '+(p.comparedAt||'').slice(0,16).replace('T',' '))
   : savedCount?'연결 주소 '+savedCount+'/8개 저장됨 · 나머지 중대 주소를 입력해 주세요.':'아직 연결된 주소가 없습니다. 최초 한 번 저장하면 이후 자동으로 불러옵니다.';
 $('smartSourceHint').textContent=p.readError?'명단 연결 확인 필요: '+p.readError:
  p.ready?'비교 기준: '+p.source+' · '+p.referenceCount+'명 · 대조 '+(p.comparedAt||'').slice(0,16).replace('T',' '):'기준명단 미연결. 8개 중대 링크를 저장하거나 이전 스냅샷을 사용할 수 있습니다.';
 const a=p.absent||[],arch=p.archived||[],guns=p.guns||[],assigned=a.filter(x=>x.status).length;
 $('smartComparisonSummary').innerHTML=[['스마트당직 명단',p.referenceCount||0],['총기명단 미확인',a.length],['이동 관리 중',arch.length],['별도 총기기록',guns.length]].map(([k,v])=>'<span>'+escapeH(k)+' <b>'+v+'명</b></span>').join('');
 $('smartAbsentCSV').disabled=!p.ready;
 const q=$('smartAbsentFilter').value.trim().toLowerCase();
 const rows=a.filter(x=>!q||[x.cohort,x.company,x.name,x.cadetNumber].some(v=>String(v||'').toLowerCase().includes(q)));
 $('smartAbsentRows').innerHTML=p.ready?(rows.length?rows.map(x=>{
   const options=[['','상태 선택'],['위탁','위탁'],['휴학','휴학'],['퇴교','퇴교'],['퇴학','퇴학']].map(([value,label])=>'<option value="'+value+'" '+(x.status===value?'selected':'')+'>'+label+'</option>').join('');
   return '<tr data-smart-id="'+escapeH(x.id)+'"><td>'+escapeH(x.cohort)+'</td><td>'+escapeH(companyLabelV257(x.company))+'</td><td>'+escapeH(x.name)+'</td><td>'+escapeH(x.cadetNumber||'-')+'</td><td>'+escapeH(x.firearmNumber||'-')+'</td><td><select class="roster-special-select" aria-label="'+escapeH(x.name)+' 관리 상태" '+(!canEdit?'disabled':'')+'>'+options+'</select></td><td class="smart-action-cell"><input class="roster-special-note" maxlength="400" value="'+escapeH(x.note||'')+'" aria-label="관리 비고" '+(!canEdit?'disabled':'')+'><button type="button" class="btn roster-special-save" '+(!canEdit?'disabled':'')+'>명단에서 이동</button></td></tr>';
 }).join(''):'<tr><td colspan="7" style="text-align:center;padding:25px">현재 기준에서 새로 미확인된 후보가 없습니다.</td></tr>'):'<tr><td colspan="7">스마트당직 연결 후 미확인 인원이 표시됩니다. 기존 명단에서는 직접 상태 이동이 가능합니다.</td></tr>';
 $('smartArchivedRows').innerHTML=arch.length?arch.map(x=>'<tr data-arch-id="'+escapeH(x.id)+'"><td>'+escapeH(x.cohort)+'</td><td>'+escapeH(companyLabelV257(x.company))+'</td><td>'+escapeH(x.name)+'</td><td><select class="roster-special-select" '+(!canEdit?'disabled':'')+'>'+['위탁','휴학','퇴교','퇴학'].map(st=>'<option '+(x.status===st?'selected':'')+'>'+st+'</option>').join('')+'</select></td><td><input class="roster-special-note smart-archived-note" value="'+escapeH(x.note||'')+'" maxlength="400" '+(!canEdit?'disabled':'')+'></td><td><button class="btn smart-change-status" '+(!canEdit?'disabled':'')+'>상태 변경</button> <button class="btn smart-restore" '+(!canEdit?'disabled':'')+'>복구하기</button></td></tr>').join(''):'<tr><td colspan="6">이동 관리 중인 인원이 없습니다.</td></tr>';
 $('smartGunRows').innerHTML=guns.length?guns.map(x=>'<tr data-gun-record="'+escapeH(x.recordId)+'"><td>'+escapeH(x.cohort)+'</td><td>'+escapeH(companyLabelV257(x.company))+'</td><td>'+escapeH(x.status==='퇴교'?'—':x.name)+'</td><td>'+escapeH(x.status)+'</td><td>'+escapeH(x.number||'(삭제됨)')+'</td><td>'+(x.number?'<button class="btn smart-clear-gun" '+(!canEdit?'disabled':'')+'>번호 삭제</button>':'삭제일: '+escapeH(x.deletedAt||'-'))+'</td></tr>').join(''):'<tr><td colspan="6">총기번호 별도 기록이 없습니다.</td></tr>';
 const mismatch=p.unitMismatch||[],returned=p.foundTagged||[];
 $('smartAdditionalChecks').innerHTML=(mismatch.length?'<div class="roster-special-warning"><b>동명이인·기수·중대 불일치 확인 '+mismatch.length+'명</b><p>자동 위탁·휴학·퇴교로 분류하지 않았습니다.</p>'+mismatch.slice(0,20).map(x=>'<div>'+escapeH(x.cohort+' '+companyLabelV257(x.company)+' '+x.name+' → '+x.reference)+'</div>').join('')+'</div>':'')+
 (returned.length?'<div class="roster-special-warning">이전 버전에서 상태만 지정한 인원 '+returned.length+'명: 기존 명단에서 직접 상태 이동을 해야 활동 명단에서 제외됩니다.</div>':'');
 const master=p.masterHints||{rows:[],warning:''};
 $('smartMasterRows').innerHTML=escapeH(master.warning||'')+' '+(master.rows||[]).map(r=>'<div><b>'+escapeH(r.status)+' · '+r.row+'행</b><div class="roster-special-ref-raw">'+escapeH(r.preview.map(x=>x.cell+': '+x.value).join(' / '))+'</div></div>').join('');
}
async function smartMoveV255(id,status,note){
 if(!mustEdit())return;if(!status)return alert('위탁·휴학·퇴교 중에서 선택해줘.');
 const person=rosterItems.find(x=>x.id===id);if(!person)return alert('원래 명단을 새로고침하고 다시 시도하세요.');
 if(!rosterConfirmQuickAbandon())return;
 const disposition=await supplyDispositionsV276(id,status);if(!disposition)return;
 if(!confirm(person.cohort+' '+companyLabelV257(person.company)+' '+person.name+' 생도를 '+status+'(으)로 이동할까요?\n물품 처리 확인 내역은 기록되며 총기번호는 별도 보관됩니다.'))return;
 try{const moved=await enqueue(()=>server('moveRosterToSpecialV255',id,status,note,person.updatedAt,disposition));if(moved.dispositionWarning)alert('상태 이동은 완료했지만 물품 처리 확인 이력 저장에 실패했습니다. 관리자 점검 필요: '+moved.dispositionWarning);await loadRoster();await smartLoadV253();toast(status+' 상태로 이동 완료');}
 catch(e){alert('이동 실패: '+e.message);}
}
async function smartSaveV253(id,status,note){return smartMoveV255(id,status,note);}
async function smartRestoreV255(id){
 if(!mustEdit())return;const p=smartReportV253?.archived?.find(x=>x.id===id);if(!p)return;
 if(!confirm(p.cohort+' '+companyLabelV257(p.company)+' '+p.name+' 생도를 활동 명단 원래 위치로 복구할까요?\n복구 시 기존 교번·총기번호도 함께 돌아옵니다.'))return;
 try{await enqueue(()=>server('restoreSpecialRosterV255',id));await loadRoster();await smartLoadV253();toast('활동 명단에 복구 완료');}catch(e){alert('복구 실패: '+e.message);}
}
async function smartClearActiveGunV255(id){
 if(!mustEdit())return;const p=rosterItems.find(x=>x.id===id);if(!p)return;
 if(!p.firearmNumber)return alert('삭제할 총기번호가 없습니다.');
 if(!confirm(p.cohort+' '+companyLabelV257(p.company)+' '+p.name+'의 총기번호만 삭제할까요?\n생도 명단은 유지되며 변경이력이 남습니다.'))return;
 try{await enqueue(()=>server('clearActiveGunNumberV255',id,p.updatedAt));await loadRoster();toast('총기번호 삭제 완료');}catch(e){alert('총기번호 삭제 실패: '+e.message);}
}
/* v2.58 · 기타 > 설정에서 스마트당직 연결 공통 관리 */
let settingsLoadingV258=false,settingsDirtyV258=false;
async function settingsLoadV258(force=false){
 if(view!=='settings'||settingsLoadingV258)return;
 if(settingsDirtyV258&&!force)return;
 settingsLoadingV258=true;const status=$('smartSettingsStateV258');
 status.textContent='스마트당직 연결 설정 조회 중…';
 try{
  const cfg=await server('getSmartDutySettingsV258');
  // 사용자가 서버 요청 중 입력했다면 덮어쓰지 않습니다.
  if(!settingsDirtyV258||force){
   for(let u=1;u<=8;u++)$('smartUnit'+u).value=cfg.savedSources?.[u]||'';
   $('smartSpecialRefUrl').value=cfg.savedMaster||'';
   settingsDirtyV258=false;
  }
  const count=Object.values(cfg.savedSources||{}).filter(Boolean).length;
  status.textContent=count===8?'연결 유지 중 · 8개 중대 링크 저장됨'+(cfg.savedMaster?' · 위탁/휴학 참고 시트 연결됨':' · 참고 시트 미설정'):
    count?'중대 링크 '+count+'/8개 저장됨 · 나머지 중대 주소를 확인해 주세요.':'연결된 스마트당직 주소가 없습니다.';
  $('smartSourcesSave').disabled=!cfg.canEdit;
  if(!cfg.canEdit)status.textContent+=' · 현재 계정은 조회 전용입니다.';
 }catch(e){status.textContent='연결 설정 조회 실패: '+e.message;}
 finally{settingsLoadingV258=false;}
}
function settingsInitV258(){
 for(let u=1;u<=8;u++)$('smartUnit'+u).addEventListener('input',()=>{settingsDirtyV258=true;});
 $('smartSpecialRefUrl').addEventListener('input',()=>{settingsDirtyV258=true;});
 $('smartSettingsReloadV258').addEventListener('click',()=>{
  if(settingsDirtyV258&&!confirm('입력 중인 변경사항을 취소하고 저장된 연결 주소를 다시 불러올까요?'))return;
  settingsDirtyV258=false;settingsLoadV258(true);
 });
 $('smartSourcesSave').addEventListener('click',async()=>{
  if(!mustEdit())return;
  const links=Object.fromEntries(Array.from({length:8},(_,i)=>[i+1,$('smartUnit'+(i+1)).value.trim()]));
  const master=$('smartSpecialRefUrl').value.trim();
  if(Object.values(links).some(x=>!x))return alert('1~8중대 URL을 모두 입력하세요. 빈칸은 저장할 수 없습니다.');
  const btn=$('smartSourcesSave'),notice=$('smartSettingsStateV258');btn.disabled=true;
  notice.textContent='1~8중대의 시트 읽기 권한 및 명단 검증 중…';
  try{
   const r=await enqueue(()=>server('saveSmartDutySourcesV255',links,master));
   settingsDirtyV258=false;smartSourceLoadedV255=false;smartReportV253=null;
   notice.textContent='연결 저장 성공 · 8개 중대 '+r.count+'명 조회 · 다음 방문부터 자동 연결됩니다.';
   toast('스마트당직 연결 설정 저장 완료');
   // 연결을 바꿔도 활동 명단 데이터 자체를 삭제하거나 옮기지 않습니다.
  }catch(e){notice.textContent='연결 변경 실패 · 기존 설정 유지: '+e.message;alert('스마트당직 연결 저장 실패: '+e.message);}
  finally{btn.disabled=false;}
 });
}
function smartInitV253(){
 $('rosterTabRegular').addEventListener('click',()=>smartSwitchV253('regular'));
 $('rosterTabSpecial').addEventListener('click',()=>smartSwitchV253('special'));
 $('smartRefresh').addEventListener('click',smartLoadV253);
 $('smartAbsentFilter').addEventListener('input',smartRenderV253);
 $('smartGoSettingsV258').addEventListener('click',()=>{
  if(switchView('settings')!==false)$('smartSettingsPanelV258').scrollIntoView({behavior:'smooth',block:'start'});
 }); $('smartImportSnapshot').addEventListener('click',async()=>{if(!mustEdit())return;const v=$('smartSnapshotPaste').value;if(!v.trim())return alert('붙여넣을 기준명단이 없습니다.');
  if(!confirm('이전 스냅샷으로 대조할까요? 중대별 실시간 링크가 이미 있으면 우선 적용되어 스냅샷은 사용되지 않습니다.'))return;
  try{const r=await enqueue(()=>server('importSmartDutySnapshotV253',v));toast('기준명단 '+r.count+'명 저장');await smartLoadV253();}catch(e){alert('기준명단 가져오기 실패: '+e.message);}
 });
 $('smartAbsentRows').addEventListener('click',e=>{const btn=e.target.closest('.roster-special-save');if(!btn)return;const tr=btn.closest('tr[data-smart-id]');smartMoveV255(tr.dataset.smartId,tr.querySelector('select').value,tr.querySelector('input').value);});
 $('smartArchivedRows').addEventListener('click',async e=>{
  const btn=e.target.closest('button');if(!btn)return;const tr=btn.closest('tr[data-arch-id]'),id=tr.dataset.archId;
  if(btn.classList.contains('smart-restore'))return smartRestoreV255(id);
  if(btn.classList.contains('smart-change-status')){
   if(!mustEdit())return;const status=tr.querySelector('select').value,note=tr.querySelector('input').value;
   if(!confirm('상태를 '+status+'(으)로 변경할까요?'))return;
   try{await enqueue(()=>server('changeSpecialStatusV255',id,status,note));await smartLoadV253();toast('관리 상태 변경 완료');}
   catch(err){alert('상태 변경 실패: '+err.message);}
  }
 });
 $('smartGunRows').addEventListener('click',async e=>{
  const btn=e.target.closest('.smart-clear-gun');if(!btn||!mustEdit())return;
  const id=btn.closest('tr').dataset.gunRecord;
  if(!confirm('이 총기번호 값을 별도 기록에서 삭제할까요?\n삭제 시각과 수행 계정만 남습니다.'))return;
  try{await enqueue(()=>server('clearSpecialGunNumberV255',id));await smartLoadV253();toast('별도 총기번호 삭제 완료');}
  catch(err){alert('총기번호 삭제 실패: '+err.message);}
 });
 $('smartAbsentCSV').addEventListener('click',()=>{const p=smartReportV253;if(!p?.ready)return;const values=[['기수','중대','이름','교번','총기번호','관리상태','비고'],...(p.absent||[]).map(x=>[x.cohort,x.company,x.name,x.cadetNumber,x.firearmNumber,x.status,x.note])];const csv='\ufeff'+values.map(r=>r.map(v=>'"'+String(v||'').replace(/"/g,'""')+'"').join(',')).join('\r\n');download(new Blob([csv],{type:'text/csv;charset=utf-8'}),'스마트당직_총기명단_미확인_'+localISO()+'.csv');});
}

function rosterInit(){
  smartInitV253();
  $('rosterMigrate').addEventListener('click',async()=>{
    if(!mustEdit()||!confirm('기존 생도명단과 졸업기수보관 시트에 총기상태 열을 추가합니다. 이름·교번·총기번호·비고를 유지합니다. 진행할까요?'))return;
    try{await enqueue(()=>server('setupRosterModule'));await loadRoster();toast('총기상태 열 업데이트 완료');}
    catch(err){alert('명단 열 확장 실패: '+err.message);}
  });
  $('rosterSetup').addEventListener('click',async()=>{
    if(!mustEdit()||!confirm('기존 업무기록과 공용비품은 유지하고, 명단 관련 3개 탭을 추가할까요?'))return;
    try{await enqueue(()=>server('setupRosterModule'));await loadRoster();toast('명단 관리 준비 완료');}
    catch(err){alert('명단 초기화 실패: '+err.message);}
  });
  ['rosterSearch','rosterCohort','rosterCompany','rosterRepairOnly'].forEach(id=>$(id).addEventListener(id==='rosterSearch'?'input':'change',rosterRender));
  $('rosterSortCompany').addEventListener('click',()=>{rosterSortMode='company';rosterRender();});
  $('rosterSortCohort').addEventListener('click',()=>{rosterSortMode='cohort';rosterRender();});
  $('rosterAdd').addEventListener('click',()=>{if(mustEdit())rosterShow();});
  $('rosterReload').addEventListener('click',()=>{if(rosterConfirmQuickAbandon())loadRoster();});$('rosterCsv').addEventListener('click',rosterCsv);
  function trackRosterInline(el){
    if(!el||!canEdit||!rosterSchemaReady)return;
    const original=rosterItems.find(r=>r.id===el.dataset.id),tr=el.closest('tr');
    if(!original||!tr)return;
    const values={firearmStatus:tr.querySelector('[data-roster-field="firearmStatus"]').value,memo:tr.querySelector('[data-roster-field="memo"]').value};
    const dirty=['firearmStatus','memo'].some(k=>values[k]!==String(original[k]||''));
    if(dirty)rosterQuickDrafts.set(original.id,values);else rosterQuickDrafts.delete(original.id);
    tr.dataset.dirty=String(dirty);
    const select=tr.querySelector('.roster-status-select');if(select)select.classList.toggle('is-repair',isRepairV216(values.firearmStatus));
    tr.classList.toggle('roster-repair-row',isRepairV216(values.firearmStatus));
    const btn=tr.querySelector('[data-roster-action="savequick"]');if(btn&&!rosterQuickSaving.has(original.id))btn.hidden=!dirty;
  }
  $('rosterRows').addEventListener('input',e=>trackRosterInline(e.target.closest('[data-roster-field]')));
  $('rosterRows').addEventListener('change',e=>{
    const el=e.target.closest('[data-roster-field="firearmStatus"]');
    if(!el)return;trackRosterInline(el);rosterQuickSave(el.dataset.id);
  });
  $('rosterRows').addEventListener('focusout',e=>{
    const el=e.target.closest('[data-roster-field="memo"]');
    if(!el)return;trackRosterInline(el);rosterQuickSave(el.dataset.id);
  });
  $('rosterActive').addEventListener('click',e=>{
    const btn=e.target.closest('[data-roster-action]');if(!btn)return;
    if(btn.dataset.rosterAction==='move'){const select=[...$('rosterRows').querySelectorAll('[data-roster-move]')].find(x=>x.dataset.rosterMove===btn.dataset.id);smartMoveV255(btn.dataset.id,select?.value||'','');}
    if(btn.dataset.rosterAction==='savequick')rosterQuickSave(btn.dataset.id);
    if(btn.dataset.rosterAction==='edit')rosterShow(btn.dataset.id);
  });
  $('rosterForm').addEventListener('submit',rosterSubmit);
  ['rosterClose','rosterCancel'].forEach(id=>$(id).addEventListener('click',()=>rosterClose()));
  $('rosterBackdrop').addEventListener('click',e=>{if(e.target===$('rosterBackdrop'))rosterClose();});
  $('rosterImportSheet').addEventListener('click',()=>{
    const url=$('rosterSource').value.trim();if(!url){alert('기존 명단 시트의 URL을 입력하세요.');return;}
    rosterBatch('importRosterFromSheet',[url,$('rosterDefaultCohort').value.trim()],'원본 명단 시트를 읽어 군수계 명단에 추가할까요? 기존 이름은 중복 건너뜁니다.');
  });
  $('rosterImportPaste').addEventListener('click',()=>{
    const paste=$('rosterPaste').value.trim();if(!paste){alert('복사한 명단을 먼저 붙여넣으세요.');return;}
    rosterBatch('importRosterPaste',[paste,$('rosterDefaultCohort').value.trim()],'붙여넣은 명단을 Google Sheets에 등록할까요?');
  });
  $('rosterGraduate').addEventListener('click',rosterGraduate);
  $('rosterNormalize').addEventListener('click',rosterNormalizeCohort);
}

/* v2.17 — 군수품: 고정 사이즈/수량, 표 내 수정 + 필터 범위 일괄 입력 */
let supplyCatalog=[],supplyLoaded=false,supplyItem=null,supplySelected='',supplyMode='cohort';
const supplyDrafts=new Map(),supplySaving=new Set();
let supplyPageLoading=false,supplyBulkSaving=false;
function supplyDirty(){return supplyDrafts.size>0||supplySaving.size>0||supplyBulkSaving;}
function supplyConfirmLeave(){
  if(supplySaving.size||supplyBulkSaving){toast('군수품 기록이 저장 중입니다. 저장 후 이동하세요.');return false;}
  if(!supplyDrafts.size)return true;
  if(!confirm('⚠ 군수품 관리에서 아직 저장되지 않은 변경사항이 있습니다.\n다른 화면으로 이동하면 입력한 내용이 사라집니다. 저장하지 않고 이동할까요?'))return false;
  supplyDrafts.clear();return true;
}
function supplyNumeric(v){const m=String(v||'').match(/\d+/);return m?Number(m[0]):99999;}
function supplyOrdered(rows){return [...rows].sort((a,b)=>supplyMode==='company'?
  supplyNumeric(a.company)-supplyNumeric(b.company)||supplyNumeric(a.cohort)-supplyNumeric(b.cohort)||a.name.localeCompare(b.name,'ko'):
  supplyNumeric(a.cohort)-supplyNumeric(b.cohort)||supplyNumeric(a.company)-supplyNumeric(b.company)||a.name.localeCompare(b.name,'ko'));
}
function supplyStatusHTML(s){return [['','상태 선택'],['정상','정상'],['수리 필요(보고)','수리 필요(보고)'],['수리 필요(미보고)','수리 필요(미보고)']].map(([v,label])=>`<option value="${escapeH(v)}" ${s===v?'selected':''}>${label}</option>`).join('');}
function supplyFilters(){
  const rows=supplyItem?.rows||[],prevC=$('supplyCohort').value,prevU=$('supplyCompany').value;
  const cohorts=[...new Set(rows.map(x=>x.cohort).filter(Boolean))].sort((a,b)=>supplyNumeric(a)-supplyNumeric(b));
  const units=[...new Set(rows.map(x=>x.company).filter(Boolean))].sort((a,b)=>supplyNumeric(a)-supplyNumeric(b));
  $('supplyCohort').innerHTML='<option value="">전체 기수</option>'+cohorts.map(x=>`<option value="${escapeH(x)}">${escapeH(x)}</option>`).join('');
  $('supplyCompany').innerHTML='<option value="">전체 중대</option>'+units.map(x=>`<option value="${escapeH(x)}">${escapeH(companyLabelV257(x))}</option>`).join('');
  if(cohorts.includes(prevC))$('supplyCohort').value=prevC;
  if(units.includes(prevU))$('supplyCompany').value=prevU;
  $('supplyBatchCohort').innerHTML=$('supplyCohort').innerHTML;
  $('supplyBatchCompany').innerHTML=$('supplyCompany').innerHTML;
  $('supplyBatchCohort').value=$('supplyCohort').value;
  $('supplyBatchCompany').value=$('supplyCompany').value;
  const old=$('supplyNormalCohort').value;
  $('supplyNormalCohort').innerHTML='<option value="">일괄 정상 처리 기수</option>'+cohorts.map(x=>`<option value="${escapeH(x)}">${escapeH(x)} (${rows.filter(p=>p.cohort===x).length}명)</option>`).join('');
  if(cohorts.includes(old))$('supplyNormalCohort').value=old;
}
function supplyFiltered(){
  if(!supplyItem)return [];
  const text=$('supplySearch').value.trim().toLowerCase(),cohort=$('supplyCohort').value,company=$('supplyCompany').value,bad=$('supplyRepairOnly').checked;
  return supplyOrdered(supplyItem.rows.filter(x=>{
    const v=supplyDrafts.get(x.id)||x;
    return (!cohort||x.cohort===cohort)&&(!company||x.company===company)&&(!bad||isRepairV216(v.status))&&
    (!text||[x.cohort,x.company,x.name,x.cadetNumber,v.status,v.detail,...Object.values(v.extra||{})].some(y=>String(y||'').toLowerCase().includes(text)));
  }));
}
function supplyMetricsOnly(){
  const rows=supplyItem?.rows||[],statuses=rows.map(x=>supplyDrafts.get(x.id)?.status??x.status);
  $('supplyMetrics').innerHTML=[['관리 인원',rows.length+'명'],['정상',statuses.filter(x=>x==='정상').length+'명'],['보고 완료',statuses.filter(x=>x==='수리 필요(보고)').length+'명'],['미보고',statuses.filter(x=>x==='수리 필요(미보고)').length+'명'],['수량 입력',rows.filter(x=>String((supplyDrafts.get(x.id)||x).extra?.['수량']||'').trim()!=='').length+'명']].map(([a,b])=>`<div class="roster-metric"><small>${escapeH(a)}</small><strong>${escapeH(b)}</strong></div>`).join('');
}
function supplyRender(){
  if(!supplyItem){$('supplyActive').classList.add('hidden');return;}
  $('supplyActive').classList.remove('hidden');$('supplySelectedName').textContent=supplyItem.name;
  $('supplySheetLink').href=supplyItem.sheetUrl;

  $('supplyFieldHint').textContent=`선택 품목: ${supplyItem.name} · 사이즈와 수량은 기본 관리 열입니다. 기존 추가 열은 삭제하지 않고 보존합니다.`;
  supplyFilters();supplyMetricsOnly();
  const companyFirst=supplyMode==='company';
  $('supplySortCompany').classList.toggle('roster-sort-active',companyFirst);
  $('supplySortCohort').classList.toggle('roster-sort-active',!companyFirst);
  $('supplyFieldInfo').textContent='기수 · 중대 · 이름 · 교번 · 상태 · 사이즈 · 수량 · 세부내용';
  const rows=supplyFiltered();
  const labels=['기수','중대','이름','교번','상태','사이즈','수량','세부내용','관리','위탁·휴학·퇴교'];
  $('supplyColumns').innerHTML=labels.map(x=>`<th>${escapeH(x)}</th>`).join('');
  const counts=new Map();rows.forEach(r=>{const k=companyFirst?r.company+'|'+r.cohort:r.cohort+'|'+r.company;counts.set(k,(counts.get(k)||0)+1);});
  let lastKey='';
  $('supplyRows').innerHTML=rows.length?rows.map(p=>{
    const k=companyFirst?p.company+'|'+p.cohort:p.cohort+'|'+p.company;
    const heading=k!==lastKey?`<tr class="roster-group-row"><td colspan="${labels.length}"><span>${companyFirst?escapeH(companyLabelV257(p.company))+' · '+escapeH(p.cohort):escapeH(p.cohort)+' · '+escapeH(companyLabelV257(p.company))}</span><small>${counts.get(k)}명</small></td></tr>`:'';lastKey=k;
    const v=supplyDrafts.get(p.id)||p,disabled=canEdit?'':'disabled',bad=isRepairV216(v.status);
    const cell=(field,value,size=20)=>`<input class="supply-input" type="text" data-supply-field="${escapeH(field)}" data-id="${escapeH(p.id)}" maxlength="${size}" value="${escapeH(value||'')}" ${disabled} aria-label="${escapeH(p.name)} ${escapeH(field)}">`;
    const details=`<textarea class="supply-note" data-supply-field="detail" data-id="${escapeH(p.id)}" maxlength="3000" rows="1" placeholder="상태 세부내용" ${disabled}>${escapeH(v.detail||'')}</textarea>`;
    return heading+`<tr data-supply-id="${escapeH(p.id)}" class="${bad?'supply-bad':''}" data-dirty="${supplyDrafts.has(p.id)}"><td>${escapeH(p.cohort)}</td><td>${escapeH(p.company)}</td><td class="supply-name">${escapeH(p.name)}${bad?`<span class="roster-repair-flag">${repairBadgeV216(v.status)}</span>`:''}</td><td>${escapeH(p.cadetNumber||'-')}</td><td><select class="supply-select ${bad?'is-repair':''}" data-supply-field="status" data-id="${escapeH(p.id)}" ${disabled}>${supplyStatusHTML(v.status||'')}</select></td><td>${cell('extra:사이즈',v.extra?.['사이즈']||'',100)}</td><td>${cell('extra:수량',v.extra?.['수량']||'',30)}</td><td>${details}</td><td>${canEdit?`<button class="small-link supply-save-btn" data-supply-save="${escapeH(p.id)}" ${supplyDrafts.has(p.id)?'':'hidden'}>저장</button>`:'조회 전용'}</td><td>${canEdit?`<select class="field supply-special-move-state-v256" data-special-state-for="${escapeH(p.id)}" aria-label="${escapeH(p.name)} 관리상태"><option value="">상태 선택</option><option>위탁</option><option>휴학</option><option>퇴교</option><option>퇴학</option></select><button type="button" class="small-link" data-supply-special-move="${escapeH(p.id)}">이동</button>`:'조회 전용'}</td></tr>`;
  }).join(''):`<tr><td colspan="${labels.length}" style="padding:30px;text-align:center;color:#8899ad">해당 조건의 명단이 없습니다.</td></tr>`;
  $('supplyCount').textContent=`${rows.length.toLocaleString()}명 표시 · 총 ${supplyItem.rows.length.toLocaleString()}명 · ${companyFirst?'중대별':'기수별'} 정렬`;
  supplyBatchScopeText(rows);
}
function supplyCatalogUI(){
  $('supplySetup').classList.toggle('hidden',supplyLoaded);
  $('supplyControls').classList.toggle('hidden',!supplyLoaded);
  if(!supplyLoaded)return;
  $('supplyItem').innerHTML='<option value="">품목 선택</option>'+supplyCatalog.map(x=>`<option value="${escapeH(x.id)}">${escapeH(x.name)}</option>`).join('');
  $('supplyItem').value=supplyCatalog.some(x=>x.id===supplySelected)?supplySelected:'';
  $('supplyEmpty').classList.toggle('hidden',!!supplySelected);
  $('supplyEmpty').textContent=supplyCatalog.length?'군수품 품목을 선택하면 해당 시트의 전체 생도 목록이 표시됩니다.':'아직 등록한 군수품 품목이 없습니다. 상단의 「+ 품목 추가」를 누르면 새 시트와 인원 명단이 생성됩니다.';
  $('supplyAddItem').disabled=!canEdit;

  const existing=supplyCatalog.find(x=>x.id===supplySelected);
  $('supplyFieldHint').textContent=existing?`선택 품목: ${existing.name} · 사이즈/수량 입력과 일괄 적용 기능을 사용하세요.`:'품목을 추가하거나 목록에서 선택하세요. 새 품목에는 사이즈와 수량 열이 기본 생성됩니다.';
}
async function supplyLoadCatalog(selectId){
  if(supplyPageLoading)return;supplyPageLoading=true;
  try{
    const r=await server('getSupplyCatalog');supplyLoaded=!!r.initialized;supplyCatalog=r.items||[];
    const previousSpecial=$('supplySpecialItemV256').value;
    $('supplySpecialItemV256').innerHTML='<option value="">전체 품목 공통</option>'+supplyCatalog.map(p=>'<option value="'+escapeH(p.id)+'">'+escapeH(p.name)+'</option>').join('');
    if(supplyCatalog.some(p=>p.id===previousSpecial))$('supplySpecialItemV256').value=previousSpecial;
    if(!r.rosterReady){$('supplySetup').classList.remove('hidden');$('supplySetupInfo').textContent='먼저 「명단(총기번호) 관리」에서 명단을 초기화해야 합니다.';}
    supplySelected=selectId||supplySelected||supplyCatalog[0]?.id||'';
    supplyCatalogUI();
    if(supplyLoaded&&supplySelected)await supplyLoadItem(supplySelected,true);
    else $('supplyActive').classList.add('hidden');
  }catch(e){alert('군수품 목록을 불러오지 못했습니다: '+e.message);}
  finally{supplyPageLoading=false;}
}
async function supplyLoadItem(id,force=false){
  if(!force&&!supplyConfirmLeave())return false;
  supplySelected=id||'';supplyDrafts.clear();supplyItem=null;
  if(!id){supplyCatalogUI();$('supplyActive').classList.add('hidden');return true;}
  $('supplyItem').value=id;
  try{const result=await server('getSupplyItemData',id);
    supplyItem=result;
    if(canEdit&&(!result.fields.includes('사이즈')||!result.fields.includes('수량'))){
      await enqueue(()=>server('ensureSupplySizeQtyColumns',id));
      supplyItem=await server('getSupplyItemData',id);
    }
    supplyCatalogUI();supplyRender();return true;
  }catch(e){alert('품목 명단 조회 실패: '+e.message);return false;}
}
function supplySnapshot(tr,record){
  const result={id:record.id,updatedAt:record.updatedAt,status:'',detail:'',extra:{...(record.extra||{})}};
  tr.querySelectorAll('[data-supply-field]').forEach(el=>{
    if(el.dataset.supplyField.startsWith('extra:'))result.extra[el.dataset.supplyField.slice(6)]=el.value;
    else result[el.dataset.supplyField]=el.value;
  });return result;
}
function supplyTrack(el){
  if(!canEdit||!supplyItem||!el)return;
  const row=el.closest('tr[data-supply-id]'),rec=supplyItem.rows.find(x=>x.id===row?.dataset.supplyId);
  if(!row||!rec)return;
  const v=supplySnapshot(row,rec),keys=['status','detail'];
  const dirty=keys.some(k=>String(v[k]||'')!==String(rec[k]||''))||supplyItem.fields.some(f=>String(v.extra[f]||'')!==String(rec.extra?.[f]||''));
  if(dirty)supplyDrafts.set(rec.id,v);else supplyDrafts.delete(rec.id);
  row.dataset.dirty=String(dirty);row.classList.toggle('supply-bad',isRepairV216(v.status));
  row.querySelector('.supply-select')?.classList.toggle('is-repair',isRepairV216(v.status));
  const btn=row.querySelector('.supply-save-btn');if(btn&&!supplySaving.has(rec.id))btn.hidden=!dirty;
  supplyMetricsOnly();
}
async function supplySave(id){
  if(!canEdit||!supplyItem||supplySaving.has(id))return;
  const draft=supplyDrafts.get(id),rec=supplyItem.rows.find(x=>x.id===id);if(!draft||!rec)return;
  const itemId=supplyItem.id,copy=JSON.parse(JSON.stringify(draft));
  supplySaving.add(id);const row=[...$('supplyRows').querySelectorAll('tr[data-supply-id]')].find(x=>x.dataset.supplyId===id);
  const btn=row?.querySelector('.supply-save-btn');if(btn){btn.hidden=false;btn.disabled=true;btn.textContent='저장 중';}
  try{
    const saved=await enqueue(()=>server('saveSupplyRow',itemId,copy));
    const index=supplyItem?.id===itemId?supplyItem.rows.findIndex(x=>x.id===id):-1;
    if(index>=0)supplyItem.rows[index]=saved;
    const latest=supplyDrafts.get(id);
    if(latest&&JSON.stringify({...latest,updatedAt:''})===JSON.stringify({...copy,updatedAt:''}))supplyDrafts.delete(id);
    else if(latest)latest.updatedAt=saved.updatedAt;
    if(row){row.dataset.dirty=String(supplyDrafts.has(id));row.classList.toggle('supply-bad',isRepairV216(supplyDrafts.get(id)?.status||saved.status));}
    supplyMetricsOnly();toast('군수품 기록 저장 완료');
  }catch(e){alert('군수품 저장 실패: '+e.message+'\n입력 내용은 현재 화면에 남아 있습니다.');}
  finally{
    supplySaving.delete(id);
    const b=row?.querySelector('.supply-save-btn');if(b){b.disabled=false;b.textContent='저장';b.hidden=!supplyDrafts.has(id);}
    if(supplyDrafts.has(id)&&supplyDrafts.get(id).updatedAt!==copy.updatedAt)supplySave(id);
  }
}
function supplyCsv(){if(!supplyItem)return;
  const fields=['기수','중대','이름','교번','상태','사이즈','수량','세부내용'];
  const rows=[fields,...supplyFiltered().map(r=>{const v=supplyDrafts.get(r.id)||r;return [r.cohort,r.company,r.name,r.cadetNumber,v.status,v.extra?.['사이즈']||'',v.extra?.['수량']||'',v.detail];})];
  download(new Blob(['\ufeff',rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'군수품_'+supplyItem.name+'_'+localISO()+'.csv');
}
async function supplyMakeItem(){
  if(!mustEdit()||!supplyConfirmLeave())return;
  const name=prompt('새 군수품 품목명 입력\n(품목당 Google Sheets 시트 하나 생성됩니다.)','');if(name===null)return;
  if(!name.trim())return alert('품목명을 입력하세요.');
  if(!confirm('「'+name.trim()+'」 품목 시트를 생성하고, 현재 명단의 기수·중대·이름·교번만 복사할까요?\n총기번호와 총기상태는 복사하지 않습니다.'))return;
  try{const r=await enqueue(()=>server('createSupplyItem',name.trim()));await supplyLoadCatalog(r.id);toast('품목 시트가 생성됐습니다. '+r.people+'명 연동');}
  catch(e){alert('군수품 항목 추가 실패: '+e.message);}
}
async function supplySync(){
  if(!mustEdit()||!supplyItem||!supplyConfirmLeave())return;
  if(!confirm('현재 총기 명단의 인원정보만 동기화할까요?\n기존 품목별 상태·세부내용·사용자 추가 항목은 유지합니다.\n졸업한 인원의 기존 기록은 시트에 보관됩니다.'))return;
  try{const r=await enqueue(()=>server('syncSupplyRoster',supplyItem.id));await supplyLoadItem(supplyItem.id,true);alert('명단 연동 완료\n신규 인원: '+r.added+'명\n수정된 인원정보: '+r.updated+'명\n현재 재학: '+r.active+'명');}
  catch(e){alert('명단 연동 실패: '+e.message);}
}
async function supplyNormalize(){
  if(!mustEdit()||!supplyItem||!supplyConfirmLeave())return;
  const cohort=$('supplyNormalCohort').value;if(!cohort)return alert('정상 처리할 기수를 선택하세요.');
  // 개별 행 저장 후에도 일괄 실행이 가능하도록 최신 상태/토큰을 서버에서 다시 확인합니다.
  try{const newest=await server('getSupplyItemData',supplyItem.id);supplyItem=newest;}
  catch(e){alert('최신 상태를 불러올 수 없습니다: '+e.message);return;}
  const people=supplyItem.rows.filter(r=>r.cohort===cohort),bad=people.filter(r=>isRepairV216(r.status)).length;
  if(!people.length)return;
  const reply=prompt(`「${supplyItem.name}」 · ${cohort} ${people.length}명의 상태를 전부 '정상'으로 변경합니다.\n수리 필요 ${bad}명 포함, 세부내용과 추가 항목은 유지됩니다.\n확인하려면 ${cohort} 를 똑같이 입력하세요.`,'');
  if(reply!==cohort){if(reply!==null)alert('기수명 확인이 일치하지 않아 취소했습니다.');return;}
  if(!confirm('최종 확인: 선택한 기수의 이 품목 상태만 모두 정상으로 변경할까요?'))return;
  try{const r=await enqueue(()=>server('normalizeSupplyCohort',supplyItem.id,cohort,people.length,bad,supplyItem.token));
    await supplyLoadItem(supplyItem.id,true);alert(`${cohort} / ${supplyItem.name}\n상태 변경 ${r.changed}명 · 전체 ${r.total}명`);
  }catch(e){alert('일괄 정상 처리 실패: '+e.message);}
}
function supplyBatchScopeText(rows){
  const selected=$('supplyCohort').value||$('supplyCompany').value;
  $('supplyBatchCohort').value=$('supplyCohort').value;
  $('supplyBatchCompany').value=$('supplyCompany').value;
  $('supplyBatchScope').classList.toggle('is-warning',!selected||!rows.length);
  $('supplyBatchScope').textContent=!canEdit?'조회 전용 계정에서는 일괄 수정할 수 없습니다.':
    !selected?'기수 또는 중대를 먼저 선택하세요. 아래 적용 버튼을 눌러도 선택 안내가 나옵니다.':
    `적용 대상: ${rows.length.toLocaleString()}명 · ${$('supplyCohort').value||'전체 기수'} / ${$('supplyCompany').value||'전체 중대'}${!rows.length?' — 조건에 맞는 인원이 없습니다.':''}`;
  // 선택 전에도 눌러서 이유를 알 수 있게 합니다. 읽기 전용/실제 저장 중일 때만 비활성화합니다.
  $('supplyBatchSame').disabled=$('supplyBatchPasteSave').disabled=!canEdit||supplyBulkSaving;
}
function supplyBatchTargets(){
  if(!mustEdit()||!supplyItem)return null;
  if(supplyDirty()){alert('먼저 개별 행의 저장이 완료되었는지 확인하고 일괄 입력을 다시 시도하세요.');return null;}
  if(!$('supplyCohort').value&&!$('supplyCompany').value){
    alert('일괄 입력 영역의 「대상 기수」 또는 「대상 중대」를 먼저 선택하세요. 전체 인원의 의도치 않은 변경을 막기 위한 절차입니다.');
    $('supplyBatchCohort').focus();return null;
  }
  const rows=supplyFiltered();if(!rows.length){alert('필터에 맞는 생도가 없습니다.');return null;}
  return rows;
}
function supplyValidSize(size){return typeof size==='string'&&size.length<=100&&!/[\r\n]/.test(size);}
function supplyValidQty(qty){return qty===''||/^\d+(?:\.\d{1,2})?$/.test(qty);}
async function supplyCommitBatch(rows,changes,summary){
  if(!changes.length)return alert('저장할 값이 없습니다.');
  const sample=changes.slice(0,5).map(x=>{const p=rows.find(r=>r.id===x.id);return `${p?.name||x.id} (${p?.cadetNumber||'교번 없음'}): ${Object.prototype.hasOwnProperty.call(x,'size')?'사이즈 '+x.size+' ':''}${Object.prototype.hasOwnProperty.call(x,'quantity')?'수량 '+x.quantity:''}`;}).join('\n');
  if(!confirm(`품목: ${supplyItem.name}\n대상: ${changes.length}명\n${summary}\n\n미리보기:\n${sample}${changes.length>5?'\n...':''}\n\n이 인원들의 사이즈/수량을 Google Sheets에 저장할까요?`))return;
  const itemId=supplyItem.id,button=$('supplyBatchSame');supplyBulkSaving=true;button.disabled=true;$('supplyBatchPasteSave').disabled=true;
  try{
    const out=await enqueue(()=>server('bulkSaveSupplySizeQty',itemId,changes));
    await supplyLoadItem(itemId,true);
    alert(`${supplyItem?.name||'선택 품목'}: ${out.changed}명 일괄 저장 완료`);
  }catch(e){alert('일괄 저장 실패: '+e.message+'\n입력값은 그대로 남아 있습니다.');}
  finally{supplyBulkSaving=false;supplyBatchScopeText(supplyFiltered());}
}
async function supplyBatchSame(){
  const rows=supplyBatchTargets();if(!rows)return;
  const size=$('supplyBatchSize').value.trim(),quantity=$('supplyBatchQty').value.trim();
  if(!size&&!quantity)return alert('사이즈 또는 수량을 입력하세요.');
  if(!supplyValidSize(size)||!supplyValidQty(quantity))return alert('사이즈는 100자 이내, 수량은 0 이상의 숫자(소수 둘째 자리까지)로 입력하세요.');
  const changes=rows.map(r=>({id:r.id,updatedAt:r.updatedAt,...(size?{size}:{}),...(quantity?{quantity}:{})}));
  await supplyCommitBatch(rows,changes,`같은 값 적용: ${size?'사이즈 '+size+' ':''}${quantity?'수량 '+quantity:''}`);
}
function supplyPasteLines(raw,mode){
  let lines=raw.replace(/\r\n?/g,'\n').split('\n').filter(x=>x.trim()!=='').map(x=>x.split('\t').map(v=>v.trim()));
  const header=lines[0]||[];
  if(header[0]&&/^(교번|사이즈|수량)$/.test(header[0])&&(
    (mode==='both'&&header[0]==='사이즈'&&header[1]==='수량')||
    (mode==='size'&&header[0]==='사이즈')||
    (mode==='quantity'&&header[0]==='수량')||
    (mode==='id_both'&&header[0]==='교번'&&header[1]==='사이즈'&&header[2]==='수량')
  ))lines=lines.slice(1);
  if(lines.length>2000)throw Error('한 번에 최대 2,000행까지 붙여넣을 수 있습니다.');
  const columns=mode==='both'?2:mode==='id_both'?3:1;
  for(const [i,row] of lines.entries())if(row.length!==columns)throw Error(`${i+1}번째 붙여넣기 행: ${columns}개 열이 필요하지만 ${row.length}개 열입니다.`);
  return lines;
}
async function supplyBatchPasteSave(){
  const rows=supplyBatchTargets();if(!rows)return;
  const mode=$('supplyPasteFormat').value;
  let pasted;try{pasted=supplyPasteLines($('supplyBatchPaste').value,mode);}catch(e){return alert(e.message);}
  if(!pasted.length)return alert('시트에서 복사한 내용을 붙여넣으세요.');
  let matched=[];
  if(mode==='id_both'){
    const lookup=new Map(),duplicated=new Set();
    for(const r of rows){const key=String(r.cadetNumber||'').trim();if(!key)continue;if(lookup.has(key))duplicated.add(key);else lookup.set(key,r);}
    if(duplicated.size)return alert('표시된 명단에 중복 교번이 있어 매칭할 수 없습니다: '+[...duplicated].join(', '));
    const seen=new Set();
    for(const [number,size,quantity] of pasted){
      if(!number||!lookup.has(number))return alert('현재 필터에 없는 교번입니다: '+number);
      if(seen.has(number))return alert('붙여넣기 데이터에 중복 교번이 있습니다: '+number);
      seen.add(number);matched.push({r:lookup.get(number),size,quantity});
    }
  }else{
    if(pasted.length!==rows.length)return alert(`현재 명단 ${rows.length}명, 붙여넣기 ${pasted.length}행입니다.\n인원 누락·순서 오류를 막기 위해 행 수가 정확히 일치해야 합니다.`);
    matched=pasted.map((v,i)=>({r:rows[i],size:mode==='size'?v[0]:mode==='both'?v[0]:undefined,quantity:mode==='quantity'?v[0]:mode==='both'?v[1]:undefined}));
  }
  const changes=[];
  for(const {r,size,quantity} of matched){
    if(size!==undefined&&!supplyValidSize(size))return alert(`${r.name}의 사이즈 값이 너무 길거나 유효하지 않습니다.`);
    if(quantity!==undefined&&!supplyValidQty(quantity))return alert(`${r.name}의 수량은 0 이상의 숫자(소수 둘째 자리까지)만 입력할 수 있습니다.`);
    changes.push({id:r.id,updatedAt:r.updatedAt,...(size!==undefined?{size}:{}),...(quantity!==undefined?{quantity}:{})});
  }
  await supplyCommitBatch(rows,changes,mode==='id_both'?'교번을 기준으로 매칭해서 저장합니다.':'현재 화면 명단 순서대로 저장합니다. 정렬과 필터를 확인하세요.');
}
/* v2.56 · 군수품·총기 공통 상태관리. 상태 이동·복구는 기존 v2.55 서버 API 이용. */
let supplyPaneV256='regular',supplySpecialV256=null;
function supplySwitchPaneV256(mode){
 if(mode!=='regular'&&mode!=='special')return;
 if(mode==='special'&&!supplyConfirmLeave())return;
 supplyPaneV256=mode;
 $('supplyRegularPaneV256').classList.toggle('hidden',mode!=='regular');
 $('supplySpecialPaneV256').classList.toggle('hidden',mode!=='special');
 $('supplyTabRegularV256').classList.toggle('btn-primary',mode==='regular');
 $('supplyTabSpecialV256').classList.toggle('btn-primary',mode==='special');
 if(mode==='special')supplyLoadSpecialV256();else if(supplyLoaded)supplyRender();else supplyLoadCatalog();
}
function supplyRefreshCurrentV256(){
 if(supplyPaneV256==='special')supplyLoadSpecialV256();
 else if(supplyLoaded)supplyLoadCatalog(supplySelected);
 else supplyLoadCatalog();
}
function supplySpecialWarningV256(result){
 const list=result?.supplySync?.warnings||[];
 if(list.length)alert('총기 명단 이동/복구는 처리됐지만 일부 군수품 시트 상태 갱신이 실패했습니다.\n'+list.join('\n')+'\n해당 품목의 인원 명단 동기화를 다시 실행하세요.');
}
async function supplyLoadSpecialV256(){
 const itemId=$('supplySpecialItemV256').value||'';
 $('supplySpecialRowsV256').innerHTML='<tr><td colspan="7">보관 명단을 읽는 중…</td></tr>';
 try{
   const report=await server('getSupplySpecialDashboardV256',itemId);
   if(supplyPaneV256!=='special')return;
   supplySpecialV256=report;supplyRenderSpecialV256();
 }catch(e){$('supplySpecialRowsV256').innerHTML='<tr><td colspan="7">'+escapeH('불러오기 실패: '+e.message)+'</td></tr>';}
}
function supplyRenderSpecialV256(){
 const report=supplySpecialV256;if(!report)return;
 const query=$('supplySpecialSearchV256').value.trim().toLowerCase(),status=$('supplySpecialStatusV256').value;
 const list=(report.archived||[]).filter(p=>(!status||p.status===status)&&(!query||[p.cohort,p.company,p.name].join(' ').toLowerCase().includes(query)));
 const metrics=[['전체 보관',report.total||0],...['위탁','휴학','퇴교','퇴학'].map(st=>[st,report.byStatus?.[st]||0])];
 $('supplySpecialMetricsV256').innerHTML=metrics.map(([label,n])=>'<div class="roster-metric"><small>'+escapeH(label)+'</small><strong>'+n+'명</strong></div>').join('');
 $('supplySpecialBadgeV256').textContent=report.total?'('+report.total+'명)':'';
 $('supplySpecialHintV256').textContent=(report.item?'품목: '+report.item.name+' · ':'전체 품목 공통 명단 · ')+list.length+'명 표시. 군수품의 기존 행은 삭제하지 않습니다.';
 const statusOptions=p=>['위탁','휴학','퇴교','퇴학'].map(st=>'<option value="'+st+'" '+(p.status===st?'selected':'')+'>'+st+'</option>').join('');
 $('supplySpecialRowsV256').innerHTML=list.length?list.map(p=>{
   const details=!report.item?'품목을 선택하면 지급기록 표시':!p.supplyStored?'해당 품목의 저장 기록 없음':
     ['품목 상태: '+(p.supplyStatus||'-'),...Object.entries(p.supplyExtra||{}).filter(([k,v])=>String(v||'').trim()).map(([k,v])=>k+': '+v),p.supplyDetail?'비고: '+p.supplyDetail:''].filter(Boolean).join(' / ');
   return '<tr data-supply-special-id="'+escapeH(p.id)+'"><td>'+escapeH(p.cohort)+'</td><td>'+escapeH(companyLabelV257(p.company))+'</td><td>'+escapeH(p.name)+'</td><td><select class="field supply-special-status-v256" '+(!canEdit?'disabled':'')+'>'+statusOptions(p)+'</select></td><td><input class="field supply-special-note-v256" maxlength="400" value="'+escapeH(p.note||'')+'" '+(!canEdit?'disabled':'')+'></td><td>'+escapeH(details)+'</td><td>'+(canEdit?'<button type="button" class="btn supply-special-update-v256">상태 변경</button> <button type="button" class="btn supply-special-restore-v256">복구하기</button>':'조회 전용')+'</td></tr>';
 }).join(''):'<tr><td colspan="7">조건에 맞는 위탁·휴학·퇴교 인원이 없습니다.</td></tr>';
}
async function supplyMoveSpecialV256(id){
 if(!mustEdit()||!supplyItem||!supplyConfirmLeave())return;
 const p=supplyItem.rows.find(x=>x.id===id);if(!p)return alert('품목 명단을 다시 불러와 주세요.');
 const box=[...$('supplyRows').querySelectorAll('select[data-special-state-for]')].find(x=>x.dataset.specialStateFor===id);
 const status=box?.value||'';if(!status)return alert('먼저 위탁·휴학·퇴교 중 하나를 선택하세요.');
 const note=prompt(p.cohort+' '+companyLabelV257(p.company)+' '+p.name+'의 '+status+' 처리 비고 (선택)', '');if(note===null)return;
 const disposition=await supplyDispositionsV276(p.id,status);if(!disposition)return;
 if(!confirm('이 생도를 '+status+' 관리 대상으로 이동할까요?\n처리 결과 확인 후 활동 명단에서 제외하며 원본 지급내역은 보존됩니다.'))return;
 try{const r=await enqueue(()=>server('moveRosterToSpecialV255',p.id,status,note,p.rosterUpdatedAt,disposition));if(r.dispositionWarning)alert('이동은 완료했지만 처리 확인 이력 저장 실패: '+r.dispositionWarning);
   supplySpecialWarningV256(r);rosterLoaded=false;await supplyLoadCatalog(supplySelected);supplySpecialV256=null;toast('총기·군수품 통합 관리 상태로 이동 완료');
 }catch(e){alert('관리 상태 이동 실패: '+e.message);}
}
async function supplySpecialActionV256(id,op){
 if(!mustEdit())return;const p=supplySpecialV256?.archived?.find(x=>x.id===id);if(!p)return;
 const row=[...$('supplySpecialRowsV256').querySelectorAll('tr[data-supply-special-id]')].find(x=>x.dataset.supplySpecialId===id);
 if(op==='restore'){
  if(!confirm(p.cohort+' '+companyLabelV257(p.company)+' '+p.name+' 생도를 활동 명단으로 복구할까요?\n총기관리와 군수품관리 양쪽에 함께 표시됩니다.'))return;
  try{const r=await enqueue(()=>server('restoreSpecialRosterV255',id));supplySpecialWarningV256(r);rosterLoaded=false;await supplyLoadSpecialV256();toast('총기·군수품 활동 명단 복구 완료');}
  catch(e){alert('복구 실패: '+e.message);}return;
 }
 const status=row?.querySelector('.supply-special-status-v256')?.value||'',note=row?.querySelector('.supply-special-note-v256')?.value||'';
 if(!['위탁','휴학','퇴교','퇴학'].includes(status))return alert('관리 상태를 선택하세요.');
 try{const r=await enqueue(()=>server('changeSpecialStatusV255',id,status,note));supplySpecialWarningV256(r);rosterLoaded=false;await supplyLoadSpecialV256();toast('총기·군수품 관리 상태 갱신');}
 catch(e){alert('상태 변경 실패: '+e.message);}
}
function supplyInit(){
  $('supplyTabRegularV256').addEventListener('click',()=>supplySwitchPaneV256('regular'));
  $('supplyTabSpecialV256').addEventListener('click',()=>supplySwitchPaneV256('special'));
  $('supplySpecialReloadV256').addEventListener('click',supplyLoadSpecialV256);
  $('supplySpecialSearchV256').addEventListener('input',supplyRenderSpecialV256);
  $('supplySpecialStatusV256').addEventListener('change',supplyRenderSpecialV256);
  $('supplySpecialItemV256').addEventListener('change',supplyLoadSpecialV256);
  $('supplySpecialRowsV256').addEventListener('click',e=>{const tr=e.target.closest('tr[data-supply-special-id]');if(!tr)return;
    if(e.target.closest('.supply-special-update-v256'))supplySpecialActionV256(tr.dataset.supplySpecialId,'update');
    if(e.target.closest('.supply-special-restore-v256'))supplySpecialActionV256(tr.dataset.supplySpecialId,'restore');});
  $('supplySetupButton').addEventListener('click',async()=>{
    if(!mustEdit())return;
    try{await enqueue(()=>server('setupSupplyModule'));await supplyLoadCatalog();toast('군수품 관리 시트 준비 완료');}
    catch(e){alert('군수품 관리 초기설정 실패: '+e.message);}
  });
  $('supplyAddItem').addEventListener('click',supplyMakeItem);
  $('supplySync').addEventListener('click',supplySync);
  $('supplyNormalize').addEventListener('click',supplyNormalize);
  $('supplyBatchSame').addEventListener('click',supplyBatchSame);
  $('supplyBatchPasteSave').addEventListener('click',supplyBatchPasteSave);
  // 일괄 입력 패널에서 바로 대상 기수/중대를 변경하도록 연결합니다.
  ['supplyBatchCohort','supplyBatchCompany'].forEach(id=>$(id).addEventListener('change',()=>{
    const previousC=$('supplyCohort').value,previousU=$('supplyCompany').value;
    if(!supplyConfirmLeave()){
      $('supplyBatchCohort').value=previousC;$('supplyBatchCompany').value=previousU;return;
    }
    $('supplyCohort').value=$('supplyBatchCohort').value;
    $('supplyCompany').value=$('supplyBatchCompany').value;
    // 새 범위를 지정할 때 이전 검색/수리 필터가 몰래 인원을 제외하지 않도록 초기화합니다.
    $('supplySearch').value='';$('supplyRepairOnly').checked=false;
    supplyRender();
  }));
  $('supplyItem').addEventListener('change',async e=>{const old=supplySelected;if(!await supplyLoadItem(e.target.value))e.target.value=old;});
  $('supplyReload').addEventListener('click',async()=>{if(!supplyConfirmLeave())return;await supplyLoadCatalog(supplySelected);});
  $('supplyCsv').addEventListener('click',supplyCsv);
  $('supplySortCompany').addEventListener('click',()=>{if(!supplyConfirmLeave())return;supplyMode='company';supplyRender();});
  $('supplySortCohort').addEventListener('click',()=>{if(!supplyConfirmLeave())return;supplyMode='cohort';supplyRender();});
  ['supplySearch','supplyCohort','supplyCompany','supplyRepairOnly'].forEach(x=>$(x).addEventListener(x==='supplySearch'?'input':'change',()=>{if(supplyConfirmLeave())supplyRender();}));
  $('supplyRows').addEventListener('input',e=>supplyTrack(e.target.closest('[data-supply-field]')));
  $('supplyRows').addEventListener('change',e=>{const x=e.target.closest('[data-supply-field="status"]');if(x){supplyTrack(x);supplySave(x.dataset.id);}});
  $('supplyRows').addEventListener('focusout',e=>{const x=e.target.closest('[data-supply-field]');if(x&&x.dataset.supplyField!=='status'){supplyTrack(x);supplySave(x.dataset.id);}});
  $('supplyRows').addEventListener('click',e=>{const x=e.target.closest('[data-supply-save]');if(x)supplySave(x.dataset.supplySave);
    const m=e.target.closest('[data-supply-special-move]');if(m)supplyMoveSpecialV256(m.dataset.supplySpecialMove);});
}


/* v2.19 — 읽기 전용 통합 수리 필요 목록 (각 원본 시트에서 재조회) */
let repairLoaded=false,repairLoading=false,repairItems=[],repairWarnings=[],repairReadAt='';
function repairFiltered(){
  const term=$('repairSearch').value.trim().toLowerCase(),type=$('repairType').value,status=$('repairStatus').value;
  const order={'수리 필요(미보고)':0,'고장(보고 여부 미관리)':1,'수리 필요(보고)':2};
  return repairItems.filter(r=>(!type||r.type===type)&&(!status||r.status===status)&&(!term||[r.category,r.itemName,r.name,r.cadetNumber,r.cohort,r.company,r.location,r.note,r.status].some(v=>String(v||'').toLowerCase().includes(term))))
    .sort((a,b)=>(order[a.status]??9)-(order[b.status]??9)||String(a.category).localeCompare(String(b.category),'ko')||String(a.cohort).localeCompare(String(b.cohort),'ko',{numeric:true})||String(a.company).localeCompare(String(b.company),'ko',{numeric:true})||String(a.name).localeCompare(String(b.name),'ko'));
}
function renderRepairDashboard(){
  const all=repairItems,rows=repairFiltered(),unknown=all.filter(r=>r.type==='equipment'),number=n=>n.toLocaleString('ko-KR');
  const metrics=[
    ['수리 필요 기록',number(all.length),'총기·군수품: 인원×품목 / 공용비품: 위치×종류',''],
    ['수리 필요(미보고)',number(all.filter(r=>r.status==='수리 필요(미보고)').length),'총기·군수품 기록 수','attention'],
    ['수리 필요(보고)',number(all.filter(r=>r.status==='수리 필요(보고)').length),'총기·군수품 기록 수',''],
    ['공용비품 고장 대수',number(unknown.reduce((sum,r)=>sum+(Number(r.count)||0),0))+'대','보고 여부는 별도로 관리되지 않음','info']
  ];
  const groups=new Map();
  all.forEach(r=>{const key=r.category+' / '+r.itemName;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);});
  $('repairSummaryRows').innerHTML=[...groups.values()].map(list=>{const r=list[0],count=s=>list.filter(x=>x.status===s).length;return '<tr><td>'+escapeH(r.category)+'</td><td>'+escapeH(r.itemName)+'</td><td>'+list.length+'</td><td>'+count('수리 필요(보고)')+'</td><td>'+count('수리 필요(미보고)')+'</td><td>'+count('교체 필요')+'</td><td>'+list.filter(x=>!['수리 필요(보고)','수리 필요(미보고)','교체 필요'].includes(x.status)).length+'</td></tr>';}).join('')||'<tr><td colspan="7">수리 · 교체 필요 기록이 없습니다. 조회 오류가 있으면 아래 안내를 확인하세요.</td></tr>';
  rows.sort((a,b)=>(a.category+' / '+a.itemName).localeCompare(b.category+' / '+b.itemName,'ko'));
  $('repairStats').innerHTML=metrics.map(x=>`<div class="repair-stat ${x[3]}"><small>${x[0]}</small><strong>${x[1]}</strong><em>${x[2]}</em></div>`).join('');
  $('repairCount').textContent=`전체 ${all.length.toLocaleString()}건 중 ${rows.length.toLocaleString()}건 표시 · 고장 공용비품은 위치×장비종류 단위`;
  $('repairReadAt').textContent=repairReadAt?'조회: '+String(repairReadAt).replace('T',' ').slice(0,19)+' UTC':'';
  $('repairWarnings').classList.toggle('hidden',!repairWarnings.length);
  $('repairWarnings').textContent=repairWarnings.length?'일부 자료를 읽지 못했습니다. 누락 가능 항목: '+repairWarnings.join(' / '):'';
  $('repairRows').innerHTML=rows.length?rows.map((r,index)=>{
    const attention=r.status==='수리 필요(미보고)',unknown=r.type==='equipment'||r.type==='roomAsset';
    const badge=attention?'unreported':unknown?'unknown':'';
    const unit=r.cohort?[r.cohort,r.company?companyLabelV257(r.company):''].filter(Boolean).join(' · '):r.company||'—';
    const location=unknown?r.location:r.name+(r.cadetNumber?' / '+r.cadetNumber:'');
    return ((index===0||rows[index-1].category!==r.category||rows[index-1].itemName!==r.itemName)?'<tr><th colspan="8" style="text-align:left;background:#eef4ff">'+escapeH(r.category+' · '+r.itemName)+'</th></tr>':'')+`<tr class="${attention?'repair-unreported':unknown?'repair-unknown':''}"><td>${escapeH(r.category)}</td><td><strong>${escapeH(r.itemName)}</strong></td><td>${escapeH(location)}</td><td>${escapeH(unit)}</td><td><span class="repair-pill ${badge}">${escapeH(r.status)}</span></td><td>${unknown?Number(r.count||0).toLocaleString('ko-KR')+'대':'—'}</td><td class="repair-description">${escapeH(r.note||'—')}</td><td><button class="small-link" type="button" data-repair-open="${escapeH(r.type)}" data-repair-item="${escapeH(r.itemId||'')}" data-repair-key="${escapeH(r.cadetNumber||r.name||r.location||'')}" data-repair-place="${escapeH(r.location||'')}">원본 보기 →</button></td></tr>`;
  }).join(''):'<tr><td colspan="8" class="repair-empty">해당 조건에서 수리 필요 기록이 없습니다.</td></tr>';
}
async function loadRepairDashboard(){
  if(!ready||repairLoading)return;
  repairLoading=true;$('repairRefresh').disabled=true;
  $('repairCount').textContent='총기·군수품·공용비품 시트에서 최신 자료를 불러오는 중입니다...';
  try{const result=await server('getRepairDashboardV219');repairItems=result.items||[];repairWarnings=result.warnings||[];repairReadAt=result.readAt||'';repairLoaded=true;renderRepairDashboard();}
  catch(e){repairLoaded=false;repairItems=[];repairWarnings=['현황 조회 실패: '+e.message];repairReadAt='';renderRepairDashboard();}
  finally{repairLoading=false;$('repairRefresh').disabled=false;}
}
function repairOpenOriginal(btn){
  const type=btn.dataset.repairOpen,key=btn.dataset.repairKey,item=btn.dataset.repairItem,place=btn.dataset.repairPlace;
  if(type==='gun'){
    if(switchView('roster')===false)return;
    $('rosterCohort').value='';$('rosterCompany').value='';$('rosterRepairOnly').checked=false;
    $('rosterSearch').value=key;if(rosterLoaded)rosterRender();
  }else if(type==='equipment'){
    if(switchView('equipment')===false)return;
    $('eqBuildingFilter').value='';$('eqUnitFilter').value='';$('eqSearch').value=(place||key).split(' / ').slice(-1)[0];
    if(eqLoaded)renderEquipment();
  }else if(type==='saber'||type==='roomAsset'){switchView(type);
  }else if(type==='supply'){
    // 미리 선택해 두면 메뉴 최초 로딩 시에도 올바른 품목이 열립니다.
    supplySelected=item;
    if(switchView('supply')===false)return;
    $('supplySearch').value=key;$('supplyRepairOnly').checked=false;
    $('supplyCohort').value='';$('supplyCompany').value='';
    if(supplyLoaded&&supplyItem?.id!==item)supplyLoadItem(item,true);
    else if(supplyItem?.id===item)supplyRender();
  }
}
function repairExportCsv(){
  if(!repairLoaded){toast('현황을 먼저 불러오세요.');return;}
  const rows=[['구분','품목','이름','교번','기수','중대','위치','상태','고장대수','세부내용'],
    ...repairFiltered().map(r=>[r.category,r.itemName,r.name,r.cadetNumber,r.cohort,r.company,r.location,r.status,r.type==='equipment'?r.count:'',r.note])];
  download(new Blob(['\ufeff',rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'수리필요_통합목록_'+localISO()+'.csv');
}
function repairInit(){
  $('repairRefresh').addEventListener('click',loadRepairDashboard);
  $('repairCsv').addEventListener('click',repairExportCsv);
  $('repairSearch').addEventListener('input',renderRepairDashboard);
  ['repairType','repairStatus'].forEach(id=>$(id).addEventListener('change',renderRepairDashboard));
  $('repairRows').addEventListener('click',event=>{const b=event.target.closest('[data-repair-open]');if(b)repairOpenOriginal(b);});
}

/* v2.21 · 캘린더 + 자유 메뉴 */
let wxPages=[],wxEvents=[],wxActive=null,wxPageData=null,wxPageDirty=false,wxCalendarMonth=localISO().slice(0,7),wxSelectedDay=localISO(),wxCalInitial='',wxCalSaving=false,wxRowSaving=false,wxLoaded=false,wxLoadError='';
function wxDayEntries(day){return data.entries.filter(e=>e.due===day);}
function wxCalSnapshot(){return JSON.stringify(['wxEventId','wxEventDate','wxEventKind','wxEventTitle','wxEventNote'].map(id=>$(id).value));}
function wxCalDirty(){return $('wxEventForm')&&!$('wxEventForm').classList.contains('hidden')&&wxCalSnapshot()!==wxCalInitial;}
function wxCustomDirty(){return !!wxPageDirty;}
function wxConfirmLeave(){
  if(wxCalSaving||wxRowSaving||wxBulkSavingV229){toast('저장 중입니다. 완료 후 이동해 주세요.');return false;}
  if((view==='calendar'&&(wxCalDirty()||wxBulkDirtyV229()))||(view.startsWith('c_')&&wxCustomDirty())){if(!confirm('⚠ 입력한 내용이 아직 저장되지 않았습니다.\n화면을 이동하면 변경사항이 사라집니다.\n저장하지 않고 이동할까요?'))return false;wxPageDirty=false;$('wxEventForm').classList.add('hidden');wxCalInitial='';wxBulkResetV229(true);}
  return true;
}
function wxCalendarOpen(ev=null,day=wxSelectedDay){
  if(wxCalDirty()&&!confirm('저장하지 않은 내용을 버리고 다른 일정을 열까요?'))return;
  $('wxEventForm').classList.remove('hidden');$('wxEventId').value=ev?.id||'';$('wxEventDate').value=ev?.date||day;
  $('wxEventKind').value=ev?.kind||'특이사항';$('wxEventTitle').value=ev?.title||'';$('wxEventNote').value=ev?.note||'';
  $('wxEventSave').disabled=!canEditCalendar;$('wxEventForm').querySelectorAll('input,select,textarea').forEach(el=>el.disabled=!canEditCalendar);
  $('wxEventDelete').classList.toggle('hidden',!canEditCalendar||!ev);
  wxCalInitial=wxCalSnapshot();$('wxEventTitle').focus();
}
function wxCalendarClose(){if(wxCalDirty()&&!confirm('저장하지 않은 일정 내용을 버릴까요?'))return; $('wxEventForm').classList.add('hidden');wxCalInitial='';}
function wxJournalEntries(day){return data.entries.filter(e=>journalVisibleOn(e,day)).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));}
function wxJournalCategories(day){
  const group=new Map();
  wxJournalEntries(day).forEach(e=>{const cat=e.category||'기타';group.set(cat,(group.get(cat)||0)+1);});
  return [...group.entries()];
}
/* v2.31: 월/주 전환과 표시 필터 (데이터 삭제 없이 화면만 바뀜) */
let wxRangeV231='month';
const wxShowV231=(key)=>!document.getElementById('wxLayer'+key+'V231') || $('wxLayer'+key+'V231').checked;
function wxWeekStartV231(day){const d=dateFromISO(day);d.setDate(d.getDate()-d.getDay());return localISO(d);}
function wxShiftRangeV231(step){
 if(wxCalDirty()&&!confirm('저장하지 않은 내용을 버리고 날짜를 이동할까요?'))return;
 $('wxEventForm').classList.add('hidden');
 if(wxRangeV231==='week')wxSelectedDay=shiftDate(wxSelectedDay,step*7);
 else{wxCalendarMonth=shiftMonth(wxCalendarMonth,step);wxSelectedDay=wxCalendarMonth+'-01';}
 wxCalendarMonth=wxSelectedDay.slice(0,7);wxCalendarRender();
}
function wxCalendarRender(){
 const parts=wxCalendarMonth.split('-').map(Number),year=parts[0],month=parts[1],start=new Date(year,month-1,1).getDay(),total=new Date(year,month,0).getDate();
 $('wxMonthLabel').textContent=year+'년 '+month+'월';
 const weekStart=wxWeekStartV231(wxSelectedDay),weekEnd=shiftDate(weekStart,6);
 const inRange=d=>wxRangeV231==='week'?d>=weekStart&&d<=weekEnd:!!d&&d.startsWith(wxCalendarMonth);
 const journalMonth=data.entries.filter(e=>e.workType==='long'?e.date<=(wxRangeV231==='week'?weekEnd:wxCalendarMonth+'-31')&&(e.status!=='완료'||(e.completedOn||e.date)>=(wxRangeV231==='week'?weekStart:wxCalendarMonth+'-01')):inRange(e.date)),dueMonth=data.entries.filter(e=>inRange(e.due)),eventMonth=wxEvents.filter(e=>inRange(e.date));
 $('wxMonthLabel').textContent=wxRangeV231==='week'?weekStart+' ~ '+weekEnd:year+'년 '+month+'월';
 $('wxViewMonthV231').classList.toggle('active',wxRangeV231==='month');$('wxViewWeekV231').classList.toggle('active',wxRangeV231==='week');$('wxCalendarGrid').classList.toggle('wx-week-layout',wxRangeV231==='week');
 const connection=$('wxCalendarStatus');if(connection){connection.classList.toggle('error',!!wxLoadError);connection.textContent=wxLoadError?'별도 일정 연결 오류: '+wxLoadError+' · 업무일지 기록은 확인할 수 있습니다.':!ready?'Google Sheets 연결 후 업무일지가 표시됩니다.':!wxLoaded?'업무일지 '+journalMonth.length+'건 표시 중 · 별도 일정 불러오는 중...':`${wxCalendarMonth} · 업무 ${journalMonth.length}건 · 마감 예정 ${dueMonth.length}건 · 학사일정 ${eventMonth.filter(e=>e.kind==='학사일정').length}건 · 다른 일정 ${eventMonth.filter(e=>e.kind!=='학사일정').length}건`;}
 const byDay=new Map(),dueDay=new Map(),eventsByDay=new Map();
 const push=(map,d,e)=>{if(!map.has(d))map.set(d,[]);map.get(d).push(e);};journalMonth.forEach(e=>push(byDay,e.date,e));dueMonth.forEach(e=>push(dueDay,e.due,e));eventMonth.forEach(e=>push(eventsByDay,e.date,e));
 const gridStart=wxRangeV231==='week'?weekStart:calendarShift(wxCalendarMonth+'-01',-start);
 const count=wxRangeV231==='week'?7:Math.ceil((start+total)/7)*7;
 const dayDetails={};
 for(let i=0;i<count;i++){
  const day=calendarShift(gridStart,i),deadlines=dueDay.get(day)||[],evs=eventsByDay.get(day)||[];
  const academic=evs.filter(e=>e.kind==='학사일정').length,other=evs.length-academic;
  dayDetails[day]=(wxShowV231('Due')?deadlines.slice(0,2).map(v293DuePill).join(''):'')+(wxShowV231('Academic')&&academic?'<span class="wx-cal-pill academic">학사 '+academic+'</span>':'')+(wxShowV231('Other')&&other?'<span class="wx-cal-pill note">특이 '+other+'</span>':'');
 }
 $('wxCalendarGrid').innerHTML=calendarHTML(wxShowV231('Journal')?data.entries:[],{start:gridStart,count,today:localISO(),selected:wxSelectedDay,month:wxCalendarMonth,details:dayDetails});$('wxSelectedTitle').textContent=prettyDate(wxSelectedDay);$('wxOpenDailyLog').disabled=!ready;
 const journal=wxShowV231('Journal')?wxJournalEntries(wxSelectedDay):[],tasks=wxShowV231('Due')?wxDayEntries(wxSelectedDay):[],dayEvents=wxEvents.filter(e=>e.date===wxSelectedDay&&(e.kind==='학사일정'?wxShowV231('Academic'):wxShowV231('Other'))).sort((a,b)=>a.kind.localeCompare(b.kind));
 const memo=wxShowV231('Journal')?(data.notes[wxSelectedDay]||''):'',sections=[];
 if(journal.length){sections.push(`<div class="wx-log-group-title">일자별 업무일지 · ${journal.length}건</div>`);journal.forEach(e=>sections.push(`<div class="wx-log-entry"><div class="wx-log-entry-head"><span class="wx-log-category">${v293StatusDot(e)} ${escapeH(e.category||'기타')}</span><span class="wx-log-meta">${escapeH(e.time||'시간 미입력')} · ${escapeH(e.owner||'담당자 미지정')}</span></div><div class="wx-log-title">${escapeH(e.title)}</div>${e.detail?`<div class="wx-log-detail">${escapeH(truncate(e.detail,280))}</div>`:''}${e.follow?`<div class="wx-log-follow"><b>추후 조치</b> ${escapeH(truncate(e.follow,200))}</div>`:''}<button type="button" class="btn btn-soft" data-wx-entry="${escapeH(e.id)}">업무 상세 ${canEditJournal?'· 수정':''} ↗</button></div>`));}
 if(memo)sections.push(`<div class="wx-log-group-title">일지 인수인계 메모</div><div class="wx-log-daynote">${escapeH(truncate(memo,350))}</div>`);
 if(tasks.length){sections.push(`<div class="wx-log-group-title">이날 마감되는 업무 · ${tasks.length}건</div>`);tasks.forEach(e=>sections.push(`<div class="wx-event-card"><span class="v293-due-label">${v293StatusDot(e)} ${escapeH(v293DueText(e))}</span><b>${escapeH(e.category||'기타')} · ${escapeH(e.title)}</b><small>${escapeH(e.owner||'담당자 미지정')}</small><button type="button" class="btn btn-soft" data-wx-task="${escapeH(e.id)}">업무 상세 보기</button></div>`));}
 if(dayEvents.length){sections.push(`<div class="wx-log-group-title">별도 일정·특이사항 · ${dayEvents.length}건</div>`);dayEvents.forEach(e=>sections.push(`<div class="wx-event-card"><span class="wx-event-type">${escapeH(e.kind)}</span><b>${escapeH(e.title)}</b><small>${escapeH(truncate(e.note,300))}</small><button type="button" class="btn btn-soft" data-wx-event="${escapeH(e.id)}">${canEditCalendar?'수정':'보기'}</button></div>`));}
 $('wxCalendarDetails').innerHTML=sections.length?sections.join(''):'<div class="empty"><strong>이 날짜에는 등록된 기록이 없습니다.</strong><p>업무일지에서 작성하거나 이 화면에서 특이사항·일정을 추가할 수 있습니다.</p></div>';
 $('wxCalendarAdd').classList.toggle('hidden',!canEditCalendar);$('wxBulkToggle').classList.toggle('hidden',!canEditCalendar);
 v293OngoingRender($('wxOngoingPanelV293'),data.entries);
}
function wxOpenJournalDay(){
  if(!ready)return toast('업무일지를 불러오는 중입니다.');
  if(switchView('today')===false)return;
  flushNote();
  selectedDay=wxSelectedDay;
  renderToday();
}

async function wxSaveEvent(e){
  e.preventDefault();if(!mustEdit('calendar')||wxCalSaving)return;
  const id=$('wxEventId').value,old=wxEvents.find(x=>x.id===id);wxCalSaving=true;$('wxEventSave').disabled=true;
  try{
    const item=await enqueue(()=>server('saveCalendarEventV221',{id,date:$('wxEventDate').value,kind:$('wxEventKind').value,title:$('wxEventTitle').value,note:$('wxEventNote').value,updatedAt:old?.updatedAt||''}));
    wxEvents=wxEvents.filter(x=>x.id!==item.id).concat(item);wxSelectedDay=item.date;wxCalendarMonth=item.date.slice(0,7);
    wxCalInitial=wxCalSnapshot();$('wxEventForm').classList.add('hidden');wxCalendarRender();toast('일정을 저장했습니다.');
  }catch(err){alert('일정 저장 실패: '+err.message);}finally{wxCalSaving=false;$('wxEventSave').disabled=false;}
}
async function wxDeleteEvent(){
  if(!mustEdit('calendar')||wxCalSaving)return;const id=$('wxEventId').value,old=wxEvents.find(x=>x.id===id);
  if(!old||!confirm('이 일정을 삭제할까요?'))return;
  wxCalSaving=true;
  try{await enqueue(()=>server('deleteCalendarEventV221',id,old.updatedAt));wxEvents=wxEvents.filter(x=>x.id!==id);$('wxEventForm').classList.add('hidden');wxCalInitial='';wxCalendarRender();toast('일정을 삭제했습니다.');}
  catch(err){alert('삭제 실패: '+err.message);}finally{wxCalSaving=false;}
}
function wxMakeNavRow(page){
  const viewId=page.id;if(document.querySelector('#sidebarMenu [data-nav-id="'+viewId+'"]'))return;
  const btn=document.createElement('button');btn.type='button';btn.className='nav-btn';btn.dataset.view=viewId;
  const ico=document.createElement('span');ico.textContent=page.type==='메모'?'▤':'▦';ico.className='wx-nav-icon';btn.appendChild(ico);
  const name=document.createElement('span');name.className='wx-nav-name';name.textContent=page.title;btn.appendChild(name);
  $('sidebarMenu').appendChild(btn);navWrapButtonV220(btn);
  // PC 메뉴의 클릭은 계층형 사이드바 위임 이벤트에서 처리합니다.
  const mob=document.createElement('button');mob.dataset.view=viewId;mob.textContent=page.title;document.querySelector('.mobile-nav').appendChild(mob);
  mob.addEventListener('click',()=>{if(switchView(viewId)!==false)flushNote();});
  viewNames[viewId]=['CUSTOM WORKSPACE',page.title,page.type==='메모'?'독립된 메모 시트에 기록을 남깁니다.':'독립된 구글 시트로 관리하는 사용자 표입니다.'];
}
let wxLoadPromiseV314=null;
async function wxLoadAll(){if(wxLoadPromiseV314)return wxLoadPromiseV314;wxLoadPromiseV314=wxLoadAllInnerV314();try{return await wxLoadPromiseV314;}finally{wxLoadPromiseV314=null;}}
async function wxLoadAllInnerV314(){
 wxNavigationReadyV314=false;
  if(!ready)return;
  try{
    const response=await server('getWorkspaceExtraV221');wxPages=response.pages||[];wxEvents=response.events||[];wxLoaded=true;wxLoadError='';
    document.querySelectorAll('#sidebarMenu .tree-nav-item[data-nav-id^="c_"]').forEach(x=>x.remove());
    Object.keys(navButtonsV233).filter(x=>x.startsWith('c_')).forEach(x=>delete navButtonsV233[x]);
    document.querySelectorAll('.mobile-nav [data-view^="c_"]').forEach(x=>x.remove());
    Object.keys(viewNames).filter(x=>x.startsWith('c_')).forEach(x=>delete viewNames[x]);
    wxPages.forEach(wxMakeNavRow);
    $('wxAddMenu').classList.toggle('hidden',!canEdit);
    if(!navEditModeV220||!navDirtyV220){navTreeV233=navNormalizeV233(response.navTree);navSavedTreeV233=navDeepCopyV233(navTreeV233);navUpdateDirtyV220();wxNavigationReadyV314=true;navRenderV233();}
    if(view==='calendar')wxCalendarRender();
    if(view.startsWith('c_'))await wxLoadPage(view);
  }catch(e){window.LOGBOOK_NAVIGATION?.commit(false);wxLoaded=false;wxLoadError=String(e.message||e);if(view==='calendar')wxCalendarRender();toast('캘린더 조회 실패: '+e.message);}
}
function wxNewMenuDialog(){if(!mustEdit())return;$('wxMenuBackdrop').classList.remove('hidden');$('wxMenuForm').reset();$('wxMenuColumnsWrap').classList.remove('hidden');$('wxMenuName').focus();}
async function wxNewMenuSave(e){
  e.preventDefault();if(!mustEdit())return;
  const name=$('wxMenuName').value.trim(),type=$('wxMenuType').value,columns=$('wxMenuColumns').value.split(',').map(x=>x.trim()).filter(Boolean);
  if(!name)return alert('메뉴 이름을 입력하세요.');
  $('wxMenuSubmit').disabled=true;
  try{
    const page=await enqueue(()=>server('createWorkspacePageV221',{title:name,type,columns}));
    $('wxMenuBackdrop').classList.add('hidden');await wxLoadAll();await navAttachCreatedV301(page.id);switchView(page.id);toast('새 관리 메뉴와 Google Sheets 탭을 만들었습니다.');
  }catch(e){alert('메뉴 생성 실패: '+e.message);}finally{$('wxMenuSubmit').disabled=false;}
}
function wxRowEditValue(el){wxPageDirty=true;el.closest('tr')?.classList.add('wx-row-dirty');}
async function wxLoadPage(id){
  if(!ready)return;if(!wxPages.some(p=>p.id===id))return;
  wxActive=id;wxPageDirty=false;$('wxPageTable').innerHTML='<p class="panel-sub">Google Sheets에서 표를 불러오는 중...</p>';
  try{wxPageData=await server('getWorkspacePageV221',id);wxRenderPage();}
  catch(e){$('wxPageTable').textContent='표를 불러오지 못했습니다: '+e.message;}
}
function wxRenderPage(){
  const p=wxPageData;if(!p)return;
  $('wxPageLabel').textContent=p.title+' · '+(p.type==='메모'?'메모':'사용자 관리표')+' · '+p.rows.length+'건';
  $('wxPageLink').href=p.url;
  $('wxAddRow').classList.toggle('hidden',!canEdit);$('wxAddColumn').classList.toggle('hidden',!canEdit||p.type==='메모');$('wxArchivePage').classList.toggle('hidden',!canEdit);
  const th=p.columns.map(c=>`<th>${escapeH(c)}</th>`).join('');
  const rows=p.rows.map(row=>wxRenderRow(row)).join('');
  $('wxPageTable').innerHTML=`<div class="wx-scroll"><table class="wx-table"><thead><tr><th style="min-width:48px">#</th>${th}${canEdit?'<th>관리</th>':''}</tr></thead><tbody id="wxTableRows">${rows||`<tr><td colspan="${p.columns.length+2}" class="wx-empty-row">아직 등록된 내용이 없습니다. + 행 추가로 기록을 시작하세요.</td></tr>`}</tbody></table></div>`;
}
function wxRenderRow(row){
  const idx=wxPageData.rows.findIndex(r=>r.id===row.id)+1;
  return `<tr data-wx-row="${escapeH(row.id)}" data-wx-version="${escapeH(row.updatedAt)}"><td>${idx||'+'}</td>${wxPageData.columns.map((c,i)=>`<td><input class="wx-cell" ${canEdit?'':'readonly'} value="${escapeH(row.values[i]||'')}" maxlength="2000" aria-label="${escapeH(c)}"></td>`).join('')}${canEdit?`<td><div class="wx-row-actions"><button type="button" class="btn btn-primary" data-wx-save="${escapeH(row.id)}">저장</button><button type="button" class="btn btn-danger" data-wx-delete="${escapeH(row.id)}">삭제</button></div></td>`:''}</tr>`;
}
function wxRowValues(row){return [...row.querySelectorAll('.wx-cell')].map(el=>el.value);}
async function wxSaveRow(rowId){
  if(!mustEdit()||wxRowSaving)return;
  const row=document.querySelector('#wxTableRows tr[data-wx-row="'+rowId+'"]');if(!row)return;
  const old=wxPageData.rows.find(x=>x.id===rowId),values=wxRowValues(row);
  wxRowSaving=true;row.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{
    const result=await enqueue(()=>server('saveWorkspaceRowV221',wxActive,{id:rowId.startsWith('tmp_')?'':rowId,updatedAt:old?.updatedAt||'',values}));
    const i=wxPageData.rows.findIndex(x=>x.id===rowId);if(i>=0)wxPageData.rows[i]=result;else wxPageData.rows.push(result);
    row.classList.remove('wx-row-dirty');row.dataset.wxRow=result.id;row.dataset.wxVersion=result.updatedAt;row.querySelectorAll('[data-wx-save],[data-wx-delete]').forEach(btn=>{if(btn.dataset.wxSave!==undefined)btn.dataset.wxSave=result.id;if(btn.dataset.wxDelete!==undefined)btn.dataset.wxDelete=result.id;});wxPageDirty=!!document.querySelector('#wxPageTable .wx-row-dirty');$('wxPageLabel').textContent=wxPageData.title+' · '+(wxPageData.type==='메모'?'메모':'사용자 관리표')+' · '+wxPageData.rows.length+'건';toast('표에 저장했습니다.');
  }catch(e){alert('행 저장 실패: '+e.message);}finally{wxRowSaving=false;row.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
async function wxDeleteRow(rowId){
  if(!mustEdit()||wxRowSaving)return;
  if(rowId.startsWith('tmp_')){wxPageData.rows=wxPageData.rows.filter(x=>x.id!==rowId);wxPageDirty=false;wxRenderPage();return;}
  const old=wxPageData.rows.find(r=>r.id===rowId);if(!old||!confirm('이 행을 삭제할까요?'))return;
  if(document.querySelectorAll('#wxPageTable .wx-row-dirty').length>0&&!confirm('저장되지 않은 다른 행이 있습니다. 삭제 후 새로 그리는 과정에서 작성 내용이 사라질 수 있습니다. 계속할까요?'))return;
  try{await enqueue(()=>server('deleteWorkspaceRowV221',wxActive,rowId,old.updatedAt));wxPageData.rows=wxPageData.rows.filter(r=>r.id!==rowId);wxPageDirty=false;wxRenderPage();toast('행을 삭제했습니다.');}
  catch(e){alert('행 삭제 실패: '+e.message);}
}
function wxAddNewRow(){
  if(!mustEdit())return;
  if(wxPageDirty)return alert('저장하지 않은 행을 먼저 저장하거나 삭제해 주세요.');
  const id='tmp_'+Date.now(),row={id,updatedAt:'',values:wxPageData.columns.map(()=> '')};wxPageData.rows.push(row);wxRenderPage();wxPageDirty=true;
  document.querySelector('#wxTableRows tr[data-wx-row="'+id+'"] .wx-cell')?.focus();
}
async function wxAddNewColumn(){
  if(!mustEdit()||!wxPageData||wxPageData.type==='메모')return;
  if(wxPageDirty)return alert('입력 중인 행을 저장한 뒤 열을 추가해 주세요.');
  const name=prompt('새 열 이름을 입력하세요. 예: 수량, 처리일, 비고');if(!name)return;
  try{wxPageData=await enqueue(()=>server('addWorkspaceColumnV221',wxActive,name));wxRenderPage();toast('구글 시트에 열을 추가했습니다.');}
  catch(e){alert('열 추가 실패: '+e.message);}
}
async function wxArchivePage(){
  if(!mustEdit()||!wxPageData||wxPageDirty)return;
  if(!confirm('「'+wxPageData.title+'」 메뉴를 보관할까요?\n왼쪽 목록에서 숨겨지지만 Google Sheets 원본 탭은 삭제하지 않습니다.'))return;
  try{await enqueue(()=>server('archiveWorkspacePageV221',wxActive));switchView('today');await wxLoadAll();toast('메뉴를 보관했습니다. 시트 원본은 유지됩니다.');}
  catch(e){alert('보관 실패: '+e.message);}
}


/* v2.30 — 주간/월간 계획표 이미지 OCR → 기존 일괄 입력 양식 변환. 자동 확정 저장하지 않음. */
let wxPhotoReadingV230=false,wxPhotoObjectV230='';
function wxPhotoStatusV230(message,problem){
 const el=$('wxPhotoStatusV230');el.textContent=message;el.style.color=problem?'#a63a35':'#42678b';
}
function wxPhotoClearV230(){
 $('wxPhotoRawV230').value='';$('wxPhotoFileV230').value='';
 $('wxPhotoThumbV230').classList.add('hidden');$('wxPhotoThumbV230').removeAttribute('src');
 if(wxPhotoObjectV230){URL.revokeObjectURL(wxPhotoObjectV230);wxPhotoObjectV230='';}
 wxPhotoStatusV230('사진 파일을 선택하세요. 이미 인식한 원문은 지워집니다.');
}
async function wxPhotoEncodeV230(file){
 const image=await new Promise((resolve,reject)=>{
   const img=new Image();const url=URL.createObjectURL(file);
   img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
   img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('이미지를 읽을 수 없습니다. JPG 또는 PNG 파일을 선택하세요.'));};
   img.src=url;
 });
 const ratio=Math.min(1,2400/Math.max(image.naturalWidth,image.naturalHeight));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
 const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
 const raw=canvas.toDataURL('image/jpeg',0.87).split(',')[1];
 if(raw.length>7e6)throw new Error('사진 용량이 큽니다. 사진을 잘라서 다시 선택해 주세요.');
 return raw;
}
async function wxPhotoReadV230(){
 if(wxPhotoReadingV230)return;if(!mustEdit('calendar'))return;
 const file=$('wxPhotoFileV230').files[0];if(!file)return alert('주간 또는 월간 계획표 사진을 선택해 주세요.');
 if(!/^image\/(jpeg|png|webp)$/.test(file.type))return alert('JPG, PNG 또는 WebP 사진만 지원합니다.');
 if(file.size>15*1024*1024)return alert('사진 용량은 15MB 이하로 제한됩니다.');
 wxPhotoReadingV230=true;$('wxPhotoReadV230').disabled=true;
 try{
  wxPhotoStatusV230('사진 크기를 조정한 뒤 구글 문자 인식을 실행하는 중입니다...');
  const b64=await wxPhotoEncodeV230(file);
  const result=await enqueue(()=>server('recognizeSchedulePhotoV230', {base64:b64,mimeType:'image/jpeg'}));
  $('wxPhotoRawV230').value=String(result.text||'');
  wxPhotoStatusV230('문자 인식 완료 · '+(result.lineCount||0)+'줄. 주간·월간 표의 날짜와 행사 배치가 맞는지 원본 사진과 비교해 주세요. 틀린 줄은 원문에서 수정할 수 있습니다.');
 }catch(err){wxPhotoStatusV230('문자 인식 실패: '+err.message+'\n외부 요청 권한이 없다면 appsscript.json의 oauthScopes에 script.external_request를 추가한 후 편집기에서 authorizeSchedulePhotoV2301을 실행해 주세요. 기존 시트 복사·붙여넣기 입력은 계속 사용할 수 있습니다.',true);}
 finally{wxPhotoReadingV230=false;$('wxPhotoReadV230').disabled=false;}
}
function wxPhotoDateV230(str,base){
 const s=String(str||'').trim(),yr=Number(base.slice(0,4)),mo=Number(base.slice(5,7));
 let hit=s.match(/(?:^|\s)(20\d{2})\s*(?:[./\-]|년\s*)(\d{1,2})\s*(?:[./\-]|월\s*)(\d{1,2})\s*(?:일)?(?:\.|\b|\s|\()/);
 let y,m,d,len;
 if(hit){y=+hit[1];m=+hit[2];d=+hit[3];len=hit[0].length;}
 else{
   hit=s.match(/^(\d{1,2})\s*(?:[.\/\-]|월\s*)(\d{1,2})\s*(?:일|\.)?(?=\s|\(|$|[^\d])/);
   if(hit){y=yr;m=+hit[1];d=+hit[2];len=hit[0].length;}
   else{
     hit=s.match(/^(\d{1,2})(\s*일|\s*\([월화수목금토일]\)|\s*[월화수목금토일]요일)(?=\s|$|[.:])/);
     if(!hit)return null;
     y=yr;m=mo;d=+hit[1];len=hit[0].length;
   }
 }
 const date=y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
 const chk=new Date(Date.UTC(y,m-1,d));if(chk.toISOString().slice(0,10)!==date)return null;
 return {date,remaining:s.slice(len).replace(/^\s*[-:|·]\s*/,'').trim()};
}
/* v2.31 — 주·월·연간 OCR 검토 후보. 불분명한 날짜는 자동으로 확정하지 않음. */
let wxPhotoDraftV231=[];
function wxWeekDateV231(day){
 const start=$('wxPhotoWeekStartV231').value;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start))return '';
 const names={일:0,월:1,화:2,수:3,목:4,금:5,토:6};
 return shiftDate(wxWeekStartV231(start),names[day]);
}
/* v2.32: OCR 구조 요소, 연락처, 당직 명단을 걸러내고 필요한 일정만 기본 선택 */
function wxPhotoClassifyV232(value,scope){
 const raw=String(value||'').trim();
 const normalized=raw.replace(/\s+/g,' ');
 if(/(?:01[016789][-\s]?\d{3,4}[-\s]?\d{4})|(?:\d{2,3}-\d{3,4}-\d{4})/.test(raw))return {omit:true,why:'전화번호 포함'};
 if(/^(?:일자|구분|날짜|시간|성무전대|일과|당직|근무자|비고|운영요원|훈육요원|당직사령|당직총사령|지휘사령|지도생도|당직총사령|상담관|교시|당직사령관|훈육장교)\s*$/.test(normalized))return {omit:true,why:'표 머리글'};
 if(/(?:당직총사령|당직총지휘|전대당직사령|당직부사관|당직장교|생도당직사령|훈육요원|당직사령)\s*\d[\/\-]\d/.test(raw))return {omit:true,why:'근무자 배정표'};
 if(/^(?:\d+[~.-]?\d*\s*학년|\d+중대|\d+편대|훈육요원|생도동|본동|서동|동동|연락처|담당자|성명|직책|비고|표제|계획표|당직|기지 셔틀버스)\s*[:\-]?[\s\S]{0,14}$/.test(normalized))return {omit:true,why:'관리용 표기'};
 if(/^(?:\d{1,2}[\/\.\-])?\d{1,2}\s*(?:일|\([월화수목금토일]\))?\s*$/.test(normalized))return {omit:true,why:'날짜만 있음'};
 if(/^(?:\d{1,2}[:：]\d{2}|\d{3,4})(?:\s*[~-]\s*\d{1,2}[:：]?\d{2})?\s*$/.test(normalized))return {omit:true,why:'시간만 있음'};
 const isDuty=/(?:당직|근무교대|근무편성|점호|귀영|사령|순찰)/.test(raw);
 const isCore=/(?:교육|훈련|시험|평가|수업|강의|특강|워크숍|세미나|설명회|강연|경진|체육|시합|대회|행사|입학|졸업|비행|실습|사격|간담회|회의|학사|봉사|휴가|외출|외박|복귀|중간고사|기말고사|검사|예방|의식|성무제|국군의\s*날|연성|국제|학술|축제|면담|촉진|군자사|면회|견학|합동|전투휴무|휴무|휴업|공휴일|기념일|개천절|한글날|기본과제|전대체육대회|보충수업|발표|촬영)/.test(raw);
 if(scope==='all')return {omit:false,allowed:true,why:'전체 후보'};
 if(isDuty && scope==='core')return {omit:false,allowed:false,why:'당직·근무 후보 (기본 제외)'};
 if(isDuty && scope==='coreDuty')return {omit:false,allowed:true,why:'당직 관련'};
 return {omit:false,allowed:isCore,why:isCore?'주요 일정':'기타 내용 (기본 제외)'};
}
function wxPhotoParseV231(){
 const mode=$('wxPhotoKindV230').value,base=$('wxPhotoBaseMonthV230').value||localISO().slice(0,7);
 const scope=$('wxPhotoScopeV232')?.value||'core';
 const rawLines=$('wxPhotoRawV230').value.replace(/\r/g,'').split('\n');
 const rows=[];let active='',carryKind='전학년',unresolved=0,ignored=0,unselected=0;
 for(let i=0;i<rawLines.length;i++){
  let line=rawLines[i].trim();if(!line)continue;
  if(/^(?:사관생도|교육계획표|요일|구분|비고|일정표|계획표|주간|월간|연간|시간|학년|전생도|일\s+Sun|월\s+Mon|화\s+Tue|\d{1,2}월\s*\d*주차\s*주간계획표)$/i.test(line)){ignored++;continue;}
  if(/^[1-4]\s*학년\s*$/.test(line)){carryKind=line.replace(/\s/g,'');continue;}
  let date='',title=line,uncertain=false;
  const explicit=wxPhotoDateV230(line,base);
  if(explicit){date=explicit.date;title=explicit.remaining;active=date;}
  else{
   const week=line.match(/^\s*([월화수목금토일])(?:요일|\s*[.:：|\-])\s*(.*)$/);
   if(mode==='week'&&week){date=wxWeekDateV231(week[1]);title=week[2];active=date;}
   else if(/^\d{1,2}\s*(?:일|\([월화수목금토일]\))\s*$/.test(line)){
    const only=wxPhotoDateV230(line.replace(/\s+/g,'')+' ',base);if(only){date=only.date;active=date;title='';}
   }
   else if(mode==='week' && active){date=active;uncertain=true;}
  }
  title=title.replace(/^\s*[-·•*]\s*/,'').replace(/\s+/g,' ').trim();
  if(!title || title.length<2){ignored++;continue;}
  const classified=wxPhotoClassifyV232(title,scope);
  if(classified.omit||(!classified.allowed&&scope!=='all')){ignored++;continue;}
  if(!date){unresolved++;uncertain=true;}
  const use=!!date&&!uncertain&&classified.allowed;
  if(!use)unselected++;
  rows.push({date,title:title.slice(0,140),note:carryKind!=='전학년'?'대상: '+carryKind:'',use,uncertain:uncertain||!classified.allowed,reason:!date?'날짜 확인 필요':uncertain?'날짜 위치 불확실':classified.why,line:i+1});
  if(rows.length>=200)break;
 }
 return {rows,unresolved,ignored,unselected};
}
function wxPhotoToBulkV230(){
 const parsed=wxPhotoParseV231();wxPhotoDraftV231=parsed.rows;
 if(!parsed.rows.length){wxPhotoStatusV230('추출된 일정 후보가 없습니다. OCR 원문에 날짜와 일정명을 직접 적고 다시 검토해 주세요.',true);return;}
 wxPhotoShowV231();
 wxPhotoStatusV230('추출 후보 '+parsed.rows.length+'건 · 기본 미선택 '+parsed.unselected+'건 · 표/연락처 제외 '+parsed.ignored+'줄 · 날짜 미확인 '+parsed.unresolved+'건. 정확한 날짜·제목을 원본과 비교해 주세요.',parsed.unresolved>0);
 $('wxPhotoReviewV231').scrollIntoView({behavior:'smooth',block:'center'});
}
function wxPhotoShowV231(){
 const el=$('wxPhotoReviewV231');el.classList.remove('hidden');
 const head='<div class="wx-photo-review-hint">주요 일정만 표시합니다. 다른 종류를 포함하려면 위의 가져올 일정 범위를 변경하고 다시 검토해 주세요. 날짜가 불확실한 행은 직접 확인한 후 체크하세요. 전화번호·근무자 배정표는 등록하지 않습니다.</div>';
 const rows=wxPhotoDraftV231.map((x,i)=>`<tr class="${x.uncertain?'wx-unresolved':''}"><td><input type="checkbox" data-wx-pick="${i}" ${x.use?'checked':''} aria-label="${i+1}행 가져오기"></td><td><input type="date" data-wx-date="${i}" value="${escapeH(x.date)}"></td><td><input type="text" data-wx-title="${i}" maxlength="140" value="${escapeH(x.title)}"></td><td><input type="text" data-wx-note="${i}" maxlength="5000" value="${escapeH(x.note)}"></td><td><small>${escapeH(x.reason||'')}</small></td></tr>`).join('');
 el.innerHTML=head+'<div class="wx-photo-list"><table><thead><tr><th>포함</th><th>날짜</th><th>일정명</th><th>세부내용·대상</th><th>선별 근거</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="wx-photo-controls"><button type="button" class="btn btn-primary" id="wxPhotoApplyV231">체크한 일정 → 아래 일괄 입력표로 보내기</button><button type="button" class="btn" id="wxPhotoUncheckV231">전체 체크 해제</button></div>';
 $('wxPhotoApplyV231').addEventListener('click',wxPhotoApplyV231);
 $('wxPhotoUncheckV231').addEventListener('click',()=>el.querySelectorAll('[data-wx-pick]').forEach(e=>e.checked=false));
}
function wxPhotoApplyV231(){
 const el=$('wxPhotoReviewV231'),items=[],issues=[];
 wxPhotoDraftV231.forEach((_,i)=>{
  if(!el.querySelector('[data-wx-pick="'+i+'"]').checked)return;
  const d=el.querySelector('[data-wx-date="'+i+'"]').value,t=el.querySelector('[data-wx-title="'+i+'"]').value.trim(),n=el.querySelector('[data-wx-note="'+i+'"]').value.trim();
  if(!wxBulkDateV229(d)||!t){issues.push((i+1)+'행의 날짜·제목을 확인해 주세요.');return;}
  items.push([d,t,n]);
 });
 if(issues.length)return alert(issues.slice(0,6).join('\n'));
 if(!items.length)return alert('등록할 일정을 체크해 주세요.');
 if($('wxBulkPaste').value.trim()&&!confirm('기존 일괄 입력 표를 추출한 일정으로 교체할까요?'))return;
 $('wxBulkPaste').value=items.map(x=>x.join('\t')).join('\n');wxBulkPreviewV229();
 wxPhotoStatusV230(items.length+'건을 일괄 입력표로 옮겼습니다. 아래 미리보기에서 한 번 더 확인 후 구글 시트에 저장해 주세요.');
 $('wxBulkPaste').scrollIntoView({behavior:'smooth',block:'center'});
}
/* v2.32 — 목록형, 시트형 모두 변환; 시작 연도 및 연도 경계 확인 */
function wxAnnualConvertV231(){
 const lines=$('wxAnnualRawV231').value.replace(/\r/g,'').split('\n');
 let currentYear=Number($('wxAnnualYearV231').value),lastMonth=0;
 const out=[],issues=[],seen=new Set();let filtered=0;
 if(!Number.isInteger(currentYear)||currentYear<2000||currentYear>2100)return alert('목록 시작 연도를 입력해 주세요.');
 const parseOne=(part,i)=>{
  const m=String(part).trim().match(/^(?:(20\d{2})\s*(?:[\/.\-]|년\s*))?(\d{1,2})\s*(?:[\/.\-]|월\s*)(\d{1,2})(?:일)?\s*(?:\([월화수목금토일]\))?\s*\.?$/);
  if(!m){issues.push(i+'행 날짜 형식을 확인하세요: '+part);return null;}
  const explicit=!!m[1],month=+m[2],day=+m[3];
  const year=explicit?+m[1]:(lastMonth&&month<lastMonth-6?currentYear+1:currentYear);
  const stamp=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  if(!wxBulkDateV229(stamp)){issues.push(i+'행 잘못된 날짜: '+part);return null;}
  currentYear=year;lastMonth=month;return stamp;
 };
 lines.forEach((raw,i)=>{
  const line=raw.trim().replace(/^[-•*–—]\s*/,'').trim();if(!line)return;
  if(/^(?:날짜|일자|시작일|일정명|학사일정|구분|연간\s*일정|\[.+\])(?:\s|$)/.test(line))return;
  let dates='',title='',note='연간 학사일정 요약',parts=[];
  const cells=line.split('\t').map(v=>v.trim());
  if(cells.length>=2){
    if(cells.length>=3 && /^\d{4}[-/.]/.test(cells[1])){parts=[cells[0],cells[1]];title=cells[2];note=cells.slice(3).join(' ')||note;}
    else {parts=[cells[0]];title=cells[1];note=cells.slice(2).join(' ')||note;}
  }else{
    const colon=line.match(/^(.+?)\s*[:：]\s*(.+)$/);
    if(colon){dates=colon[1];title=colon[2];}
    else{
      const noColon=line.match(/^((?:(?:20\d{2})\s*[\/.\-년]\s*)?\d{1,2}\s*[\/.\-월]\s*\d{1,2}(?:일)?\s*(?:\([월화수목금토일]\))?)(?:\s+)(.+)$/);
      if(noColon){dates=noColon[1];title=noColon[2];}
    }
    if(!title){issues.push((i+1)+'행: 날짜와 일정명을 구분할 수 없습니다. '+line.slice(0,70));return;}
    parts=dates.split(/\s*[~∼～〜–—]\s*|\s+[-]\s+/).map(x=>x.trim());
  }
  if(!title||parts.length<1||parts.length>2){issues.push((i+1)+'행: 일정명 또는 기간이 올바르지 않습니다.');return;}
  const cl=wxPhotoClassifyV232(title,'core');
  if(cl.omit||(!cl.allowed&&/(?:당직|담당|연락처)/.test(title))){filtered++;return;}
  const start=parseOne(parts[0],i+1),end=parts.length===2?parseOne(parts[1],i+1):start;
  if(!start||!end)return;
  if(end<start){issues.push((i+1)+'행: 종료일이 시작일보다 빠릅니다.');return;}
  const key=start+'|'+end+'|'+title;
  if(seen.has(key))return;seen.add(key);
  out.push([start,...(parts.length>1?[end]:[]),title,note].join('\t'));
 });
 const result=$('wxAnnualResultV231');
 result.textContent='변환 가능 '+out.length+'건 · 확인 필요 '+issues.length+'건 · 근무자/연락처 제외 '+filtered+'건'+(issues.length?'\n확인 필요한 줄:\n'+issues.slice(0,15).join('\n'):'');
 if(!out.length)return;
 if($('wxBulkPaste').value.trim()&&!confirm('기존 일괄 입력표를 연간 일정으로 교체할까요?'))return;
 $('wxBulkPaste').value=out.join('\n');wxBulkPreviewV229();$('wxBulkPaste').scrollIntoView({behavior:'smooth',block:'center'});
}
function wxPhotoToAnnualV232(){
 const text=$('wxPhotoRawV230').value.trim();
 if(!text)return alert('먼저 연간 계획표 사진을 문자 인식하거나 내용을 입력하세요.');
 if($('wxAnnualRawV231').value.trim()&&!confirm('연간 목록 입력칸의 기존 내용을 덮어쓸까요?'))return;
 $('wxAnnualRawV231').value=text;
 const base=$('wxPhotoBaseMonthV230').value;
 if(base)$('wxAnnualYearV231').value=base.slice(0,4);
 $('wxAnnualPastePanelV231').scrollIntoView({behavior:'smooth',block:'center'});
 wxPhotoStatusV230('연간 목록 입력칸으로 옮겼습니다. 날짜/제목을 원문과 비교한 뒤 연간 변환 버튼을 눌러 주세요.');
}
function wxPhotoInitV230(){
 $('wxPhotoBaseMonthV230').value=localISO().slice(0,7);
 $('wxPhotoReadV230').addEventListener('click',wxPhotoReadV230);
 $('wxPhotoToBulkV230').addEventListener('click',wxPhotoToBulkV230);
 $('wxPhotoFileV230').addEventListener('change',()=>{
  const file=$('wxPhotoFileV230').files[0];if(wxPhotoObjectV230){URL.revokeObjectURL(wxPhotoObjectV230);wxPhotoObjectV230='';}
  if(!file){$('wxPhotoThumbV230').classList.add('hidden');return;}
  wxPhotoObjectV230=URL.createObjectURL(file);$('wxPhotoThumbV230').src=wxPhotoObjectV230;$('wxPhotoThumbV230').classList.remove('hidden');
  wxPhotoStatusV230('선택한 사진: '+file.name+' · OCR 버튼을 눌러줘.');
 });
}

/* v2.29 · 학사일정 복사/붙여넣기 일괄 등록 */
let wxBulkPendingV229=[],wxBulkSavingV229=false;
function wxBulkDirtyV229(){return !!($('wxBulkPaste')&&$('wxBulkPaste').value.trim());}
function wxBulkResetV229(close=false){
  wxBulkPendingV229=[];$('wxBulkPaste').value='';$('wxBulkPreview').innerHTML='';$('wxBulkPreview').classList.add('hidden');
  $('wxBulkSaveBtn').disabled=true;$('wxBulkProgress').textContent='';
  if(close){$('wxBulkPanel').classList.add('hidden');$('wxBulkToggle').setAttribute('aria-expanded','false');}
}
function wxBulkToggleV229(){
  if(wxBulkSavingV229)return;
  if(!$('wxBulkPanel').classList.contains('hidden')){
    if(wxBulkDirtyV229()&&!confirm('저장하지 않은 일괄 입력 내용을 지우고 닫을까요?'))return;
    wxBulkResetV229(true);return;
  }
  if(!mustEdit('calendar'))return;
  $('wxBulkPanel').classList.remove('hidden');$('wxBulkToggle').setAttribute('aria-expanded','true');$('wxBulkPaste').focus();
}
function wxBulkDateV229(value){
  const s=String(value||'').trim().replace(/^['"]|['"]$/g,'').replace(/\s*\([^)]*\)\s*$/,'').replace(/\s*[월화수목금토일]요일?\s*$/,'').trim();
  const m=s.match(/^(\d{4})\s*[.\/\-]\s*(\d{1,2})\s*[.\/\-]\s*(\d{1,2})\.?$/);
  if(!m)return '';
  const y=Number(m[1]),mon=Number(m[2]),d=Number(m[3]),stamp=y+'-'+String(mon).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  const check=new Date(Date.UTC(y,mon-1,d));return check.toISOString().slice(0,10)===stamp?stamp:'';
}
function wxBulkParsedV229(){
  const lines=$('wxBulkPaste').value.replace(/\r/g,'').split('\n');const items=[],errors=[],seen=new Set();let omittedHeader=0,duplicates=0;
  const existing=new Set(wxEvents.filter(e=>e.kind==='학사일정').map(e=>e.date+'\u0000'+e.title.trim()));
  for(let index=0;index<lines.length;index++){
    const raw=lines[index];if(!raw.trim())continue;
    const columns=raw.split('\t').map(x=>x.trim());
    const first=columns[0].replace(/\s/g,'');
    if(['날짜','일자','시작일','일정일'].includes(first)){omittedHeader++;continue;}
    if(columns.length<2||columns.length>4){errors.push((index+1)+'행: 2~4열(날짜, [종료일], 일정명, 세부내용) 형식으로 붙여넣으세요.');continue;}
    const start=wxBulkDateV229(columns[0]);if(!start){errors.push((index+1)+'행: 날짜 형식이 올바르지 않습니다.');continue;}
    let end=start,title='',note='';
    const maybeEnd=columns.length>=3?wxBulkDateV229(columns[1]):'';
    if(columns.length===4&&!maybeEnd){errors.push((index+1)+'행: 4열 형식의 두 번째 열은 올바른 종료일이어야 합니다.');continue;}
    if(maybeEnd){end=maybeEnd;title=columns[2]||'';note=columns.slice(3).join(' ');}
    else{title=columns[1]||'';note=columns.slice(2).join(' ');}
    if(!title||title.length>140||note.length>5000){errors.push((index+1)+'행: 일정명은 1~140자, 세부내용은 5000자 이하로 입력하세요.');continue;}
    if(end<start){errors.push((index+1)+'행: 종료일이 시작일보다 빠릅니다.');continue;}
    const from=new Date(start+'T00:00:00Z').getTime(),to=new Date(end+'T00:00:00Z').getTime();
    const days=Math.round((to-from)/86400000)+1;
    if(days>62){errors.push((index+1)+'행: 기간은 최대 62일까지 입력할 수 있습니다.');continue;}
    for(let j=0;j<days;j++){
      const date=new Date(from+j*86400000).toISOString().slice(0,10),key=date+'\u0000'+title;
      if(seen.has(key)||existing.has(key)){duplicates++;continue;}seen.add(key);
      items.push({date,kind:'학사일정',title,note});
    }
    if(items.length>500){errors.push('한 번에 등록할 수 있는 일정은 최대 500건입니다. 여러 번 나누어 입력해 주세요.');break;}
  }
  return {items,errors,duplicates,omittedHeader};
}
function wxBulkPreviewV229(){
  const result=wxBulkParsedV229();wxBulkPendingV229=result.errors.length?[]:result.items;
  const preview=$('wxBulkPreview');preview.classList.remove('hidden');
  let s='<div class="wx-bulk-summary">신규 예정 <b>'+result.items.length+'건</b> · 중복 제외 '+result.duplicates+'건 · 제목 행 제외 '+result.omittedHeader+'행. '+(result.errors.length?'형식 오류를 수정해야 저장할 수 있습니다.':'확인 후 저장을 누르면 구글 시트에 등록됩니다.')+'</div>';
  if(result.errors.length)s+='<div class="wx-bulk-err">'+escapeH(result.errors.slice(0,12).join('\n'))+'</div>';
  if(result.items.length){s+='<table><thead><tr><th>날짜</th><th>일정명</th><th>세부내용</th></tr></thead><tbody>';
    result.items.slice(0,30).forEach(item=>{s+='<tr><td>'+escapeH(item.date)+'</td><td>'+escapeH(item.title)+'</td><td>'+escapeH(truncate(item.note,110))+'</td></tr>';});
    s+='</tbody></table>';if(result.items.length>30)s+='<div class="wx-bulk-summary">처음 30건 표시 · 나머지 '+(result.items.length-30)+'건도 저장 대상입니다.</div>';
  }
  preview.innerHTML=s;
  $('wxBulkSaveBtn').disabled=!wxBulkPendingV229.length||!canEditCalendar||wxBulkSavingV229;
  $('wxBulkProgress').textContent=result.errors.length?'오류 '+result.errors.length+'건':'저장할 일정 '+wxBulkPendingV229.length+'건';
}
async function wxBulkSaveV229(){
  if(!mustEdit('calendar')||wxBulkSavingV229||!wxBulkPendingV229.length)return;
  const latest=wxBulkParsedV229();if(latest.errors.length||JSON.stringify(latest.items)!==JSON.stringify(wxBulkPendingV229)){alert('붙여넣은 내용이 달라졌습니다. 미리보기를 다시 확인해 주세요.');return;}
  if(!confirm('학사일정 '+wxBulkPendingV229.length+'건을 Google Sheets에 일괄 저장할까요?\n기존 일정은 삭제하거나 덮어쓰지 않습니다.'))return;
  wxBulkSavingV229=true;$('wxBulkSaveBtn').disabled=true;$('wxBulkPreviewBtn').disabled=true;$('wxBulkProgress').textContent='구글 시트에 저장 중...';
  try{
    const answer=await enqueue(()=>server('bulkSaveAcademicCalendarV229',wxBulkPendingV229));
    wxEvents=wxEvents.concat(answer.events||[]);wxLoaded=true;wxLoadError='';
    const first=(answer.events||[])[0];if(first){wxCalendarMonth=first.date.slice(0,7);wxSelectedDay=first.date;}
    wxBulkResetV229(true);wxCalendarRender();toast('학사일정 '+answer.added+'건 등록 완료'+(answer.skipped?' · 중복 '+answer.skipped+'건 제외':''));
  }catch(err){alert('학사일정 일괄 저장 실패: '+err.message);$('wxBulkProgress').textContent='저장 실패 · 내용 유지됨. 다시 확인해 주세요.';}
  finally{wxBulkSavingV229=false;$('wxBulkPreviewBtn').disabled=false;}
}

function wxInit(){
  wxPhotoInitV230();
  $('wxAnnualConvertV231').addEventListener('click',wxAnnualConvertV231);
  $('wxPhotoToAnnualV232').addEventListener('click',wxPhotoToAnnualV232);
  $('wxBulkToggle').addEventListener('click',wxBulkToggleV229);
  $('wxBulkClose').addEventListener('click',wxBulkToggleV229);
  $('wxBulkPreviewBtn').addEventListener('click',wxBulkPreviewV229);
  $('wxBulkSaveBtn').addEventListener('click',wxBulkSaveV229);
  $('wxBulkClear').addEventListener('click',()=>{if(wxBulkDirtyV229()&&!confirm('입력한 내용을 모두 지울까요?'))return;wxBulkResetV229();});
  $('wxBulkPaste').addEventListener('input',()=>{wxBulkPendingV229=[];$('wxBulkSaveBtn').disabled=true;$('wxBulkPreview').classList.add('hidden');$('wxBulkProgress').textContent='내용이 변경되었습니다. 미리보기를 다시 확인하세요.';});
  $('wxPrevMonth').addEventListener('click',()=>wxShiftRangeV231(-1));
  $('wxNextMonth').addEventListener('click',()=>wxShiftRangeV231(1));
  $('wxViewMonthV231').addEventListener('click',()=>{wxRangeV231='month';wxCalendarMonth=wxSelectedDay.slice(0,7);wxCalendarRender();});
  $('wxViewWeekV231').addEventListener('click',()=>{wxRangeV231='week';wxCalendarRender();});
  ['Journal','Academic','Due','Other'].forEach(x=>$('wxLayer'+x+'V231').addEventListener('change',wxCalendarRender));
  $('wxThisMonth').addEventListener('click',()=>{if(wxCalDirty()&&!confirm('저장하지 않은 내용을 버리고 이동할까요?'))return;$('wxEventForm').classList.add('hidden');wxSelectedDay=localISO();wxCalendarMonth=wxSelectedDay.slice(0,7);wxCalendarRender();});
  $('wxCalendarGrid').addEventListener('click',e=>{const entry=e.target.closest('[data-calendar-entry]');if(entry){showModal(entry.dataset.calendarEntry);return;}const b=e.target.closest('[data-wx-day]');if(!b)return;if(wxCalDirty()&&!confirm('저장하지 않은 내용을 버리고 날짜를 변경할까요?'))return;$('wxEventForm').classList.add('hidden');wxSelectedDay=b.dataset.wxDay;wxCalendarRender();});
  $('wxCalendarDetails').addEventListener('click',e=>{const b=e.target.closest('[data-wx-event],[data-wx-task],[data-wx-entry]');if(!b)return;if(b.dataset.wxEntry){showModal(b.dataset.wxEntry,!canEditJournal);return;}if(b.dataset.wxTask){showModal(b.dataset.wxTask,!canEditJournal);return;}wxCalendarOpen(wxEvents.find(x=>x.id===b.dataset.wxEvent));});
  $('wxOpenDailyLog').addEventListener('click',wxOpenJournalDay);
  $('wxCalendarAdd').addEventListener('click',()=>wxCalendarOpen());$('wxEventForm').addEventListener('submit',wxSaveEvent);
  $('wxEventCancel').addEventListener('click',wxCalendarClose);$('wxEventDelete').addEventListener('click',wxDeleteEvent);
  $('wxAddMenu').addEventListener('click',wxNewMenuDialog);$('wxMenuClose').addEventListener('click',()=>{$('wxMenuBackdrop').classList.add('hidden');});
  $('wxMenuBackdrop').addEventListener('click',e=>{if(e.target===$('wxMenuBackdrop'))$('wxMenuBackdrop').classList.add('hidden');});
  $('wxMenuType').addEventListener('change',()=>{$('wxMenuColumnsWrap').classList.toggle('hidden',$('wxMenuType').value==='메모');});
  $('wxMenuForm').addEventListener('submit',wxNewMenuSave);
  $('wxAddRow').addEventListener('click',wxAddNewRow);$('wxAddColumn').addEventListener('click',wxAddNewColumn);$('wxArchivePage').addEventListener('click',wxArchivePage);
  $('wxPageTable').addEventListener('input',e=>{if(e.target.classList.contains('wx-cell'))wxRowEditValue(e.target);});
  $('wxPageTable').addEventListener('click',e=>{const b=e.target.closest('[data-wx-save],[data-wx-delete]');if(!b)return;if(b.dataset.wxSave)wxSaveRow(b.dataset.wxSave);else if(b.dataset.wxDelete)wxDeleteRow(b.dataset.wxDelete);});
}
function shiftMonth(s,n){const [y,m]=s.split('-').map(Number),d=new Date(y,m-1+n,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}


// v2.27 성무훈련 데이터: 일반학기 data.entries와 분리 유지
const trainStateV227={loaded:false,loading:false,tab:'roster',settings:{},entries:[],roster:[],gear:[],audit:[],urls:{},journalDirty:'',cadetDirty:''};
function trainEscapeV227(v){return escapeH(String(v??''));}
function trainInfoV227(msg,error=false){const el=$('trAlert');el.textContent=msg;el.classList.toggle('tr-error',error);}
function trainCanChangeV227(){return canEdit&&trainStateV227.settings.status!=='인계완료';}
function trainCanJournalV227(){return canEditJournal&&trainStateV227.settings.status!=='인계완료';}
async function trainEnterV227(){if(!ready)return;await trainFoundationLoadV289();if(trainV291WorkspaceOpen)await trainReloadV227();}
async function trainReloadV227(){if(trainStateV227.loading)return;trainStateV227.loading=true;trainInfoV227('훈련 전용 스프레드시트를 불러오는 중...');
 try{const result=await server('trainDataV227');Object.assign(trainStateV227,result,{loaded:true});if(result.initialized){try{trainV291Extra=await server('trainGetReserveV291');}catch(ex){trainV291Extra={reserve:[],uniform:[],uniformItems:[],error:ex.message};}}trainRenderV227();}
 catch(e){trainInfoV227('훈련 자료 조회 실패: '+e.message,true);}finally{trainStateV227.loading=false;}}
function trainRenderV227(){const t=trainStateV227;
 const link=$('trBookLink');link.href=t.sheetUrl||'#';link.classList.toggle('hidden',!t.initialized||!t.sheetUrl);$('trSetup').classList.toggle('hidden',t.initialized||!canEdit);$('trWorkspace').classList.toggle('hidden',!t.initialized);
 if(!t.initialized){trainInfoV227(canEdit?'훈련 전용 시트가 아직 없습니다. 최초 설정을 실행하세요.':'훈련 시트가 설치되지 않았습니다. 군수계 관리자에게 문의하세요.');return;}
 const state=t.settings;trainInfoV227('훈련 기수: '+(state.cohort||'미지정')+' | 훈련 종료일: '+(state.endDate||'미지정')+' | 상태: '+(state.status||'준비')+' | 명단 '+t.roster.length+'명 / 훈련 군수품 기록 '+t.gear.length+'건');
 if(!trainStateV227.journalDirty&&!trainStateV227.cadetDirty){$('trCohort').value=state.cohort||'';$('trEndDate').value=state.endDate||'';}
 $('trJournalSheet').href=t.urls?.['성무훈련업무기록']||'#';$('trRosterSheet').href=t.urls?.['예비생도명단']||'#';$('trGearSheet').href=t.urls?.['성무훈련군수품']||'#';
 $('trJournalNew').classList.toggle('hidden',!trainCanJournalV227());
 ['trAddCadet','trBulkRosterSave','trGearBulkSave','trSaveConfig','trEnableAuto','trHandoffNow'].forEach(id=>$(id).classList.toggle('hidden',!canEdit));
 document.querySelectorAll('[data-train-tab]').forEach(b=>{const on=b.dataset.trainTab===t.tab;b.classList.toggle('btn-primary',on);b.classList.toggle('btn-soft',!on);});
 for(const key of ['journal','roster','gear','uniform','reserve','handoff'])$('tr'+key[0].toUpperCase()+key.slice(1)+'Panel').classList.toggle('hidden',t.tab!==key);
 if(!$('trJournalDate').value)$('trJournalDate').value=localISO();
 trainRenderJournalV227();trainRenderRosterV227();trainRenderGearV227();trainRenderReserveV291();trainRenderUniformV291();
 $('trTransferAudit').innerHTML=t.audit.length?t.audit.map(a=>'<div class="train-card"><b>'+trainEscapeV227(a.result)+'</b> · '+trainEscapeV227(a.at)+'<div>'+trainEscapeV227(a.note)+'</div></div>').join(''):'<p class="train-help">아직 인계 이력이 없습니다.</p>';
}
function trainSwitchTabV227(next){if(!trainConfirmUnsavedV227())return;trainStateV227.tab=next;trainRenderV227();}
function trainConfirmUnsavedV227(){
 if(!$('trJournalForm').classList.contains('hidden')&&trainStateV227.journalDirty&&trainStateV227.journalDirty!==trainJournalSnapshotV227())return confirm('저장하지 않은 훈련 업무일지가 있습니다. 내용을 버리고 이동할까요?');
 if(!$('trCadetForm').classList.contains('hidden')&&trainStateV227.cadetDirty&&trainStateV227.cadetDirty!==trainCadetSnapshotV227())return confirm('저장하지 않은 예비생도 정보가 있습니다. 내용을 버리고 이동할까요?');
 return true;
}
function trainJournalSnapshotV227(){return JSON.stringify(['trTitle','trDate','trTime','trCategory','trStatus','trPriority','trDue','trOwner','trDetail','trFollow'].map(k=>$(k).value));}
function trainCadetSnapshotV227(){return JSON.stringify(['trCadetCohort','trCadetCompany','trCadetName','trCadetNumber','trFirearmNumber','trFirearmState','trCadetMemo'].map(k=>$(k).value));}
function trainCloseEditorV227(which){if(!trainConfirmUnsavedV227())return;if(which==='journal'){$('trJournalForm').classList.add('hidden');trainStateV227.journalDirty='';}else{$('trCadetForm').classList.add('hidden');trainStateV227.cadetDirty='';}}
function trainRenderJournalV227(){const t=trainStateV227,day=$('trJournalDate').value||localISO(),rows=t.entries.filter(x=>x.date===day).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
 $('trJournalSub').textContent=day+' · 훈련 업무 '+rows.length+'건 (일반학기 업무일지와 분리)';
 $('trJournalRows').innerHTML=rows.length?rows.map(e=>`<div class="train-card"><span class="train-meta">${trainEscapeV227(e.time||'')} · ${trainEscapeV227(e.category)} · ${trainEscapeV227(e.status)}</span><div class="train-title">${trainEscapeV227(e.title)}</div><div>${trainEscapeV227(e.detail)}</div>${e.follow?`<div><b>추후 조치:</b> ${trainEscapeV227(e.follow)}</div>`:''}<div class="train-row-actions"><button class="btn btn-soft" data-train-entry="${trainEscapeV227(e.id)}" type="button">${trainCanJournalV227()?'수정':'상세'}</button>${trainCanJournalV227()?`<button class="btn btn-soft" data-train-delete="${trainEscapeV227(e.id)}" type="button">삭제</button>`:''}</div></div>`).join(''):'<div class="train-card">이 날짜에 작성한 훈련 업무가 없습니다.</div>';
}
function trainJournalEditV227(id){if(!trainConfirmUnsavedV227())return;const e=id?trainStateV227.entries.find(x=>x.id===id):null;
 $('trJournalForm').classList.remove('hidden');$('trJournalFormTitle').textContent=e?'훈련 업무 상세 / 수정':'새 훈련 업무 등록';$('trEntryId').value=e?.id||'';
 const values={trTitle:e?.title||'',trDate:e?.date||$('trJournalDate').value||localISO(),trTime:e?.time||'',trStatus:e?.status||'미착수',trPriority:e?.priority||'보통',trDue:e?.due||'',trOwner:e?.owner||'',trDetail:e?.detail||'',trFollow:e?.follow||''};
 for(const [k,v] of Object.entries(values))$(k).value=v;
 const cats=[...new Set([...(data.categories||[]),e?.category].filter(Boolean))];$('trCategory').innerHTML=cats.map(c=>'<option>'+trainEscapeV227(c)+'</option>').join('');$('trCategory').value=e?.category||cats[0]||'기타';
 $('trJournalSave').classList.toggle('hidden',!trainCanJournalV227());$('trJournalForm').querySelectorAll('input,select,textarea').forEach(el=>el.disabled=!trainCanJournalV227()&&el.id!=='trEntryId');
 trainStateV227.journalDirty=trainJournalSnapshotV227();$('trJournalForm').scrollIntoView({behavior:'smooth'});
}
async function trainJournalSubmitV227(event){event.preventDefault();if(!trainCanJournalV227())return;const id=$('trEntryId').value,old=trainStateV227.entries.find(x=>x.id===id);
 const t=$('trTime').value.trim();if(t&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)){alert('시간은 00:00 ~ 23:59 형식으로 입력하세요.');return;}
 const entry={id,date:$('trDate').value,title:$('trTitle').value,time:t,category:$('trCategory').value,status:$('trStatus').value,priority:$('trPriority').value,due:$('trDue').value,owner:$('trOwner').value,detail:$('trDetail').value,follow:$('trFollow').value,updatedAt:old?.updatedAt||''};
 try{const saved=await enqueue(()=>server('trainJournalSaveV227',entry));trainStateV227.entries=trainStateV227.entries.filter(x=>x.id!==saved.id).concat(saved);$('trJournalDate').value=saved.date;trainStateV227.journalDirty='';$('trJournalForm').classList.add('hidden');trainRenderJournalV227();toast('훈련 업무일지 저장 완료');}
 catch(e){alert('훈련 업무 저장 실패: '+e.message);}}
async function trainJournalDeleteV227(id){if(!trainCanJournalV227())return;const e=trainStateV227.entries.find(x=>x.id===id);if(!e||!confirm('선택한 훈련 업무를 삭제할까요?'))return;
 try{await enqueue(()=>server('trainJournalDeleteV227',id,e.updatedAt));trainStateV227.entries=trainStateV227.entries.filter(x=>x.id!==id);trainRenderJournalV227();toast('삭제했습니다.');}catch(err){alert(err.message);}}
function trainRenderRosterV227(){const search=$('trRosterSearch').value.toLowerCase().trim(),rows=trainStateV227.roster.filter(p=>!search||[p.cohort,p.company,p.name,p.cadetNumber,p.firearmNumber].some(s=>String(s||'').toLowerCase().includes(search))).sort((a,b)=>String(a.cohort).localeCompare(String(b.cohort),'ko',{numeric:true})||Number(a.company)-Number(b.company)||a.name.localeCompare(b.name,'ko'));
 $('trRosterRows').innerHTML=rows.length?rows.map(p=>`<tr class="${p.firearmStatus!=='정상'?'train-repair':''}"><td>${trainEscapeV227(p.cohort)}</td><td>${trainEscapeV227(p.company)}</td><td><b>${trainEscapeV227(p.name)}</b></td><td>${trainEscapeV227(p.cadetNumber)}</td><td>${trainEscapeV227(p.firearmNumber)}</td><td>${trainEscapeV227(p.firearmStatus)}</td><td>${trainEscapeV227(p.memo)}</td><td>${p.transferred==='완료'?'완료':'대기'}</td><td><button class="btn" data-train-cadet="${trainEscapeV227(p.id)}" type="button">${canEdit?'수정':'상세'}</button>${trainCanChangeV227()?` <button class="btn btn-soft" data-train-exit="${trainEscapeV227(p.id)}" type="button">퇴소·예비보관</button>`:''}</td></tr>`).join(''):'<tr><td colspan="9">예비생도 명단이 없습니다. 신규 인원을 등록하거나 시트에서 일괄 붙여넣기 하세요.</td></tr>';
}
function trainCadetEditV227(id){if(!trainConfirmUnsavedV227())return;const p=id?trainStateV227.roster.find(x=>x.id===id):null;
 $('trCadetForm').classList.remove('hidden');$('trCadetTitle').textContent=p?'예비생도 정보 수정':'예비생도 등록';$('trCadetId').value=p?.id||'';
 const v={trCadetCohort:p?.cohort||trainStateV227.settings.cohort||'',trCadetCompany:p?.company||'',trCadetName:p?.name||'',trCadetNumber:p?.cadetNumber||'',trFirearmNumber:p?.firearmNumber||'',trFirearmState:p?.firearmStatus||'정상',trCadetMemo:p?.memo||''};for(const [k,x] of Object.entries(v))$(k).value=x;
 $('trCadetForm').querySelectorAll('input,select,textarea').forEach(el=>el.disabled=!trainCanChangeV227()&&el.id!=='trCadetId'&&el.id!=='trCadetCohort');$('trCadetForm').querySelector('button[type="submit"]').classList.toggle('hidden',!trainCanChangeV227());trainStateV227.cadetDirty=trainCadetSnapshotV227();$('trCadetForm').scrollIntoView({behavior:'smooth'});
}
async function trainSaveCadetV227(e){e.preventDefault();if(!trainCanChangeV227())return;const id=$('trCadetId').value,old=trainStateV227.roster.find(p=>p.id===id);
 const v={id,updatedAt:old?.updatedAt||'',cohort:$('trCadetCohort').value,company:$('trCadetCompany').value,name:$('trCadetName').value,cadetNumber:$('trCadetNumber').value,firearmNumber:$('trFirearmNumber').value,firearmStatus:$('trFirearmState').value,memo:$('trCadetMemo').value};
 try{const saved=await enqueue(()=>server('trainSaveCadetV227',v));trainStateV227.roster=trainStateV227.roster.filter(x=>x.id!==saved.id).concat(saved);trainStateV227.cadetDirty='';$('trCadetForm').classList.add('hidden');trainRenderRosterV227();trainRenderGearV227();if(!id){trainSwitchTabV227('reserve');await trainV291ReloadExtra();}toast('예비생도 정보 저장');}
 catch(err){alert('명단 저장 실패: '+err.message);}}
async function trainBulkRosterV227(){if(!trainCanChangeV227())return;if(!confirm('붙여넣은 예비생도 명단을 등록할까요? 기존 교번은 건너뜁니다.'))return;
 try{const result=await enqueue(()=>server('trainBulkCadetsV227',$('trBulkRoster').value));await trainReloadV227();toast('추가 '+result.added+'명 / 중복 '+result.skipped+'명');$('trBulkRoster').value='';}catch(e){alert('명단 일괄 등록 실패: '+e.message);}}
function trainRenderGearV227(){const t=trainStateV227;const names=[...new Set(t.gear.map(g=>g.itemName))].sort((a,b)=>a.localeCompare(b,'ko'));$('trGearNames').innerHTML=names.map(n=>'<option value="'+trainEscapeV227(n)+'"></option>').join('');
 const name=$('trGearName').value.trim();const gearByPerson=new Map(t.gear.filter(g=>g.itemName===name).map(g=>[g.personId,g]));
 $('trGearRows').innerHTML=!name?'<tr><td colspan="9">품목명을 입력하거나 기존 품목을 선택해 주세요.</td></tr>':t.roster.length?t.roster.slice().sort((a,b)=>String(a.cohort).localeCompare(String(b.cohort),'ko',{numeric:true})||Number(a.company)-Number(b.company)||a.name.localeCompare(b.name,'ko')).map(p=>{
  const g=gearByPerson.get(p.id);const status=g?.status||'정상';return `<tr data-train-gear="${trainEscapeV227(p.id)}"><td>${trainEscapeV227(p.cohort)}</td><td>${trainEscapeV227(p.company)}</td><td>${trainEscapeV227(p.name)}</td><td>${trainEscapeV227(p.cadetNumber)}</td><td><input data-gfield="size" value="${trainEscapeV227(g?.size||'')}" ${trainCanChangeV227()?'':'disabled'}></td><td><input data-gfield="quantity" value="${trainEscapeV227(g?.quantity||'')}" inputmode="numeric" ${trainCanChangeV227()?'':'disabled'}></td><td><select data-gfield="status" ${trainCanChangeV227()?'':'disabled'}>${['정상','수리 필요(보고)','수리 필요(미보고)','교체 필요'].map(s=>'<option '+(s===status?'selected':'')+'>'+s+'</option>').join('')}</select></td><td><input class="train-long" data-gfield="detail" value="${trainEscapeV227(g?.detail||'')}" ${trainCanChangeV227()?'':'disabled'}></td><td>${trainCanChangeV227()?'<button class="btn btn-soft" type="button" data-train-savegear="'+trainEscapeV227(p.id)+'">저장</button>':'조회'}</td></tr>`;
 }).join(''):'<tr><td colspan="9">명단을 먼저 등록하세요.</td></tr>';
}
async function trainSaveGearRowV227(personId){if(!trainCanChangeV227())return;const name=$('trGearName').value.trim();const tr=Array.from(document.querySelectorAll('#trGearRows tr')).find(r=>r.dataset.trainGear===personId);if(!tr||!name)return;
 const obj={personId,itemName:name};tr.querySelectorAll('[data-gfield]').forEach(i=>obj[i.dataset.gfield]=i.value);const old=trainStateV227.gear.find(x=>x.personId===personId&&x.itemName===name);obj.updatedAt=old?.updatedAt||'';
 try{const saved=await enqueue(()=>server('trainSaveGearV227',obj));trainStateV227.gear=trainStateV227.gear.filter(x=>x.id!==saved.id).concat(saved);trainRenderGearV227();toast('사이즈·수량 저장 완료');}catch(e){alert('저장 실패: '+e.message);}}
async function trainBulkGearSaveV227(){if(!trainCanChangeV227())return;const name=$('trGearName').value.trim();if(!name)return alert('먼저 품목명을 입력하세요.');if(!confirm('품목 '+name+'의 기수·중대·이름별 사이즈·수량을 일괄 반영할까요? (기존 교번 형식도 지원)'))return;
 try{const result=await enqueue(()=>server('trainBulkGearV227',name,$('trGearPaste').value));await trainReloadV227();$('trGearPaste').value='';toast('등록 '+result.added+' / 수정 '+result.updated+' / 제외 '+result.skipped);}
 catch(e){alert('사이즈 일괄 입력 실패: '+e.message);}}
async function trainSetupClickV227(){if(!canEdit)return;try{await enqueue(()=>server('trainSetupV227'));trainStateV227.loaded=false;await trainReloadV227();toast('별도 훈련 스프레드시트를 준비했습니다.');}catch(e){alert(e.message);}}
async function trainConfigSaveV227(){if(!canEdit)return;try{const result=await enqueue(()=>server('trainSetConfigV227',{cohort:$('trCohort').value,endDate:$('trEndDate').value}));trainStateV227.loaded=false;await trainReloadV227();toast('훈련 기수와 종료일 저장 완료');}catch(e){alert('설정 실패: '+e.message);}}
async function trainPreviewV227(){try{const p=await server('trainPreviewHandoffV227');$('trTransferPreview').innerHTML='<b>'+trainEscapeV227(p.cohort||'미지정')+'</b> · 대상 '+p.total+'명 / 신규 '+p.newCount+'명 / 기존 명단 매칭 '+p.matchedCount+'명 / 품목 '+p.items.length+'종 / 피복 '+(p.uniformCount||0)+'건 · '+(p.ready?'인계 가능':'확인 사항 '+p.problems.length+'건')+(p.problems.length?'<div>'+p.problems.map(e=>'• '+trainEscapeV227(e)).join('<br>')+'</div>':'');$('trTransferPreview').classList.toggle('tr-error',!p.ready);return p;}
 catch(e){$('trTransferPreview').textContent=e.message;$('trTransferPreview').classList.add('tr-error');return null;}}
async function trainEnableAutoV227(){if(!canEdit)return;try{const r=await enqueue(()=>server('trainEnableScheduleV227'));alert(r);}catch(e){alert('자동 인계 예약 실패: '+e.message);}}
async function trainTransferNowV227(){if(!canEdit)return;const p=await trainPreviewV227();if(!p?.ready)return alert('인계 전 확인 사항을 해결해 주세요.');
 if(prompt('인계를 실행하면 이 기수의 일반학기 명단이 갱신됩니다. 실행하려면 기수를 입력하세요.')!==p.cohort)return;
 try{const result=await enqueue(()=>server('trainHandoffNowV227'));alert('생도대 인계 완료! 신규 '+result.added+'명 / 기존 명단 보완 '+result.filled+'명 / 군수품 '+result.gearUpdated+'건 / 피복사이즈 '+result.uniformUpdated+'건');await trainReloadV227();}
 catch(e){alert('인계가 완료되지 않았습니다. 자료를 확인하세요: '+e.message);}}
function trainInitV227(){
 document.querySelectorAll('[data-train-nav]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.trainNav==='train'?'trainJournal':'today')));
 document.querySelectorAll('[data-train-tab]').forEach(b=>b.addEventListener('click',()=>trainSwitchTabV227(b.dataset.trainTab)));
 $('trSetupBtn').addEventListener('click',trainSetupClickV227);$('trJournalDate').addEventListener('change',trainRenderJournalV227);
 $('trJournalNew').addEventListener('click',()=>trainJournalEditV227(''));$('trJournalCancel').addEventListener('click',()=>trainCloseEditorV227('journal'));
 $('trJournalForm').addEventListener('submit',trainJournalSubmitV227);
 $('trJournalRows').addEventListener('click',e=>{const b=e.target.closest('[data-train-entry],[data-train-delete]');if(!b)return;if(b.dataset.trainEntry)trainJournalEditV227(b.dataset.trainEntry);else trainJournalDeleteV227(b.dataset.trainDelete);});
 $('trRosterSearch').addEventListener('input',trainRenderRosterV227);$('trAddCadet').addEventListener('click',()=>trainCadetEditV227(''));$('trCadetCancel').addEventListener('click',()=>trainCloseEditorV227('cadet'));
 $('trCadetForm').addEventListener('submit',trainSaveCadetV227);$('trRosterRows').addEventListener('click',e=>{const b=e.target.closest('[data-train-cadet],[data-train-exit]');if(!b)return;if(b.dataset.trainCadet)trainCadetEditV227(b.dataset.trainCadet);else trainV291Exit(b.dataset.trainExit);});
 $('trBulkRosterSave').addEventListener('click',trainBulkRosterV227);$('trGearRefresh').addEventListener('click',trainRenderGearV227);
 $('trGearRows').addEventListener('click',e=>{const b=e.target.closest('[data-train-savegear]');if(b)trainSaveGearRowV227(b.dataset.trainSavegear);});
 $('trGearBulkSave').addEventListener('click',trainBulkGearSaveV227);$('trSaveConfig').addEventListener('click',trainConfigSaveV227);
 $('trPreviewTransfer').addEventListener('click',trainPreviewV227);$('trEnableAuto').addEventListener('click',trainEnableAutoV227);$('trHandoffNow').addEventListener('click',trainTransferNowV227);
}

/* v2.35 · PDF 편성안 일괄 등록과 관·층·인원 제한 */
const DORM_REPORT_TSV_V235="관\t층\t복도\t호실\t정원\t입실인원\t여생도인원\t비고\t소속·용도\t근무생도방\n정예 본관\t1층\t동쪽\t117-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t118-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t119-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t120-동\t2\t1\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t동기회\tN\n정예 본관\t1층\t동쪽\t121-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t122-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t123-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t124-동\t2\t2\t0\t원본 배치 PDF 기준 / 이름 판독 주의 / 편성안 2쪽\t동기회\tN\n정예 본관\t1층\t동쪽\t125-2\t2\t1\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t2중대\tN\n정예 본관\t1층\t동쪽\t126-동\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t동기회\tN\n정예 본관\t1층\t동쪽\t127-동\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t동기회\tN\n정예 본관\t1층\t동쪽\t128-동\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t동기회\tN\n정예 본관\t1층\t동쪽\t129-동\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t동기회\tN\n정예 본관\t1층\t동쪽\t130-동\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t동기회\tN\n정예 본관\t1층\t동쪽\t131\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t일반\tN\n정예 본관\t1층\t동쪽\t132\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t일반\tN\n정예 본관\t1층\t동쪽\t155-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t156-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t157-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t158-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t159-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t160-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t161-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t162-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t163-1\t2\t1\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t164-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t165-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t166-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t167-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t168-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t169-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t170-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t171-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t172-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t173-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t동쪽\t174-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 2쪽\t1중대\tN\n정예 본관\t1층\t서쪽\t101\t2\t0\t0\tPDF 공실 명시 / 편성안 4쪽\t일반\tN\n정예 본관\t1층\t서쪽\t102\t2\t0\t0\tPDF 공실 명시 / 편성안 4쪽\t일반\tN\n정예 본관\t1층\t서쪽\t103\t2\t0\t0\tPDF 공실 명시 / 편성안 4쪽\t일반\tN\n정예 본관\t1층\t서쪽\t106\t2\t0\t0\tPDF 공실 명시 / 편성안 4쪽\t일반\tN\n정예 본관\t1층\t서쪽\t108\t2\t0\t0\tPDF 공실 명시 / 편성안 4쪽\t일반\tN\n정예 본관\t1층\t서쪽\t109\t2\t0\t0\tPDF 공실 명시 / 편성안 4쪽\t일반\tN\n정예 본관\t1층\t서쪽\t110\t2\t0\t0\tPDF 공실 명시 / 편성안 4쪽\t일반\tN\n정예 본관\t1층\t서쪽\t111\t2\t0\t0\tPDF 공실 명시 / 편성안 4쪽\t일반\tN\n정예 본관\t1층\t서쪽\t112\t2\t0\t0\tPDF 공실 명시 / 편성안 4쪽\t일반\tN\n정예 본관\t1층\t서쪽\t113\t2\t0\t0\tPDF 공실 명시 / 편성안 4쪽\t일반\tN\n정예 본관\t1층\t서쪽\t114\t2\t0\t0\tPDF 공실 명시 / 편성안 4쪽\t일반\tN\n정예 본관\t1층\t서쪽\t115\t2\t0\t0\tPDF 공실 명시 / 편성안 4쪽\t일반\tN\n정예 본관\t1층\t서쪽\t116\t2\t0\t0\tPDF 공실 명시 / 편성안 4쪽\t일반\tN\n정예 본관\t1층\t서쪽\t133-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t1층\t서쪽\t134-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t1층\t서쪽\t135-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t1층\t서쪽\t136-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t1층\t서쪽\t137-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t1층\t서쪽\t138-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t1층\t서쪽\t139-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t1층\t서쪽\t140-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t1층\t서쪽\t141-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t1층\t서쪽\t142-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t1층\t서쪽\t143-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t1층\t서쪽\t144-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t1층\t서쪽\t145-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t1층\t서쪽\t146-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t1층\t서쪽\t147-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t1층\t서쪽\t148-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t1층\t서쪽\t149-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t1층\t서쪽\t150-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t1층\t서쪽\t151-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t1층\t서쪽\t152-5\t2\t1\t0\t원본 배치 PDF 기준 / 편성안 4쪽\t5중대\tN\n정예 본관\t2층\t동생명복도\t201-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t동생명복도\t202-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t동생명복도\t203-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t동생명복도\t204-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t동생명복도\t205-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t동생명복도\t206-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t동생명복도\t207-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t동생명복도\t208-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t동생명복도\t209-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t동생명복도\t210-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t동생명복도\t211-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 5쪽\t여생도방\tN\n정예 본관\t2층\t동생명복도\t212-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 5쪽\t여생도방\tN\n정예 본관\t2층\t동생명복도\t213-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 5쪽\t여생도방\tN\n정예 본관\t2층\t동생명복도\t214-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 5쪽\t여생도방\tN\n정예 본관\t2층\t동생명복도\t215-여\t2\t1\t1\t원본 배치 PDF 기준 / 편성안 5쪽\t여생도방\tN\n정예 본관\t2층\t동생명복도\t216-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 5쪽\t여생도방\tN\n정예 본관\t2층\t여생도복도\t217-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 3쪽\t여생도방\tN\n정예 본관\t2층\t여생도복도\t218-여\t2\t2\t2\t원본 배치 PDF 기준 / 이름 판독 주의 / 편성안 3쪽 / 여생도 표기 재확인 권장\t여생도방\tN\n정예 본관\t2층\t여생도복도\t219-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 3쪽\t여생도방\tN\n정예 본관\t2층\t여생도복도\t220-동\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t동기회\tN\n정예 본관\t2층\t여생도복도\t221-동\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t동기회\tN\n정예 본관\t2층\t여생도복도\t222-동\t2\t1\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t동기회\tN\n정예 본관\t2층\t여생도복도\t223-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 3쪽\t여생도방\tN\n정예 본관\t2층\t여생도복도\t224-동\t2\t1\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t동기회\tN\n정예 본관\t2층\t여생도복도\t225-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t1중대\tN\n정예 본관\t2층\t여생도복도\t226-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 3쪽\t여생도방\tN\n정예 본관\t2층\t여생도복도\t227-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 3쪽\t여생도방\tN\n정예 본관\t2층\t여생도복도\t228-여\t2\t2\t2\t원본 배치 PDF 기준 / 이름 판독 주의 / 편성안 3쪽 / 여생도 표기 재확인 권장\t여생도방\tN\n정예 본관\t2층\t여생도복도\t229-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 3쪽\t여생도방\tN\n정예 본관\t2층\t여생도복도\t230-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 3쪽\t여생도방\tN\n정예 본관\t2층\t여생도복도\t231-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 3쪽\t여생도방\tN\n정예 본관\t2층\t여생도복도\t232-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 3쪽\t여생도방\tN\n정예 본관\t2층\t여생도복도\t233-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 3쪽\t여생도방\tN\n정예 본관\t2층\t여생도복도\t234-여\t2\t1\t1\t원본 배치 PDF 기준 / 편성안 3쪽\t여생도방\tN\n정예 본관\t2층\t여생도복도\t236\t2\t0\t0\tPDF 공실 명시 / 편성안 3쪽\t일반\tN\n정예 본관\t2층\t전대복도\t237-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t전대복도\t238-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t전대복도\t239-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t전대복도\t240-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t전대복도\t241-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t전대복도\t242-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t전대복도\t243-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t전대복도\t244-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t전대복도\t245\t2\t0\t0\tPDF 공실 명시 / 편성안 5쪽\t일반\tN\n정예 본관\t2층\t전대복도\t246-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t전대복도\t247-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t전대복도\t248-5\t2\t1\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t전대복도\t249-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t전대복도\t250-5\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t전대복도\t251-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t전대복도\t252-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t전대복도\t253-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t전대복도\t254-5\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t5중대\tN\n정예 본관\t2층\t전대복도\t255\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t일반\tY\n정예 본관\t2층\t전대복도\t256\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t일반\tY\n정예 본관\t2층\t전대복도\t257\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t일반\tY\n정예 본관\t2층\t전대복도\t258\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 5쪽\t일반\tY\n정예 본관\t2층\t전대복도\t259\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t일반\tY\n정예 본관\t2층\t전대복도\t260\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t일반\tY\n정예 본관\t2층\t전대복도\t261\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t일반\tY\n정예 본관\t2층\t전대복도\t262\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t일반\tY\n정예 본관\t2층\t전대복도\t263\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t일반\tY\n정예 본관\t2층\t전대복도\t265\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 3쪽\t일반\tY\n정예 본관\t2층\t전대복도\t266\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 3쪽\t일반\tY\n정예 본관\t2층\t전대복도\t267\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 3쪽\t일반\tY\n정예 본관\t2층\t전대복도\t268\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 3쪽\t일반\tY\n정예 본관\t2층\t전대복도\t269-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t1중대\tN\n정예 본관\t2층\t전대복도\t270-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t1중대\tN\n정예 본관\t2층\t전대복도\t271-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t1중대\tN\n정예 본관\t2층\t전대복도\t272-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t1중대\tN\n정예 본관\t2층\t전대복도\t273-1\t2\t2\t0\t원본 배치 PDF 기준 / 이름 판독 주의 / 편성안 3쪽\t1중대\tN\n정예 본관\t2층\t전대복도\t274-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t1중대\tN\n정예 본관\t2층\t전대복도\t275-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t1중대\tN\n정예 본관\t2층\t전대복도\t276-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t1중대\tN\n정예 본관\t2층\t전대복도\t277-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t1중대\tN\n정예 본관\t2층\t전대복도\t278-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t1중대\tN\n정예 본관\t2층\t전대복도\t279-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t1중대\tN\n정예 본관\t2층\t전대복도\t280-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t1중대\tN\n정예 본관\t2층\t전대복도\t281-1\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 3쪽\t1중대\tN\n정예 본관\t2층\t전대복도\t282-1\t2\t2\t1\t원본 배치 PDF 기준 / 편성안 3쪽\t1중대\tN\n정예 동관\t1층\t2·3중대복도\t102-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t103-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t104-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t105-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t106-2\t2\t1\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t107-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t108-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t109-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t111-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t112-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t113-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t114-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t115-2\t2\t1\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t116-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t117-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t118-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t119-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t120-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t121-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t122-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t123-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t124-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t125-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t126-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t127-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t128-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t129-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t130-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t131-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t132-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t133-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t134-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t135-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t136-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t137-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t138-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t139-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t141-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t142-2\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t2중대\tN\n정예 동관\t1층\t2·3중대복도\t143-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t3중대\tN\n정예 동관\t1층\t2·3중대복도\t144-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t3중대\tN\n정예 동관\t1층\t2·3중대복도\t145-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t3중대\tN\n정예 동관\t1층\t2·3중대복도\t146-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t3중대\tN\n정예 동관\t1층\t2·3중대복도\t147-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t3중대\tN\n정예 동관\t1층\t2·3중대복도\t148-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t3중대\tN\n정예 동관\t1층\t2·3중대복도\t149-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t3중대\tN\n정예 동관\t1층\t2·3중대복도\t150-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 6쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t222-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t223-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t224-3\t2\t1\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t225-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t226-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t227-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t228-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t229-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t230-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t231-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t232-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t233-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t234-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t235-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t236-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t237-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t238-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t239-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t240-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t241-3\t2\t1\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t242-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t243-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t244-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t245-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t246-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t247-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t248-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t3중대복도\t249-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 7쪽\t3중대\tN\n정예 동관\t2층\t여생도복도\t202-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽\t여생도방\tN\n정예 동관\t2층\t여생도복도\t203-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽\t여생도방\tN\n정예 동관\t2층\t여생도복도\t204-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽\t여생도방\tN\n정예 동관\t2층\t여생도복도\t205-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽\t여생도방\tN\n정예 동관\t2층\t여생도복도\t206-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽\t여생도방\tN\n정예 동관\t2층\t여생도복도\t207-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽\t여생도방\tN\n정예 동관\t2층\t여생도복도\t208-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽\t여생도방\tN\n정예 동관\t2층\t여생도복도\t209-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽\t여생도방\tN\n정예 동관\t2층\t여생도복도\t210-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽\t여생도방\tN\n정예 동관\t2층\t여생도복도\t211-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽\t여생도방\tN\n정예 동관\t2층\t여생도복도\t212-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽\t여생도방\tN\n정예 동관\t2층\t여생도복도\t213-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽\t여생도방\tN\n정예 동관\t2층\t여생도복도\t214-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽\t여생도방\tN\n정예 동관\t2층\t여생도복도\t215-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽\t여생도방\tN\n정예 동관\t2층\t여생도복도\t216-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽\t여생도방\tN\n정예 동관\t2층\t여생도복도\t217-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽\t여생도방\tN\n정예 동관\t2층\t여생도복도\t218-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽\t여생도방\tN\n정예 동관\t2층\t여생도복도\t219-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽\t여생도방\tN\n정예 동관\t2층\t여생도복도\t220-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽 / 여생도 표기 재확인 권장\t여생도방\tN\n정예 동관\t2층\t여생도복도\t221-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 7쪽\t여생도방\tN\n정예 동관\t3층\t3·4중대복도\t302-4\t2\t1\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t303-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t304-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t305-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t306-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t307-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t308-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t309-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t310-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t311-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t312-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t313-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t314-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t315-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t316-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t317-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t318-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t319-4\t2\t1\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t320-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t321-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t322-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t323-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t324-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t325-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t326-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t327-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t328-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t329-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t330-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t331-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t332-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t333-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t334-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t335-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t336-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t337-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t338-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t339-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t340-3\t2\t1\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t3중대\tN\n정예 동관\t3층\t3·4중대복도\t341-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t342-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t343-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t3중대\tN\n정예 동관\t3층\t3·4중대복도\t344-4\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t4중대\tN\n정예 동관\t3층\t3·4중대복도\t345-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t3중대\tN\n정예 동관\t3층\t3·4중대복도\t346-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t3중대\tN\n정예 동관\t3층\t3·4중대복도\t347-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t3중대\tN\n정예 동관\t3층\t3·4중대복도\t348-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t3중대\tN\n정예 동관\t3층\t3·4중대복도\t349-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t3중대\tN\n정예 동관\t3층\t3·4중대복도\t350-3\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 8쪽\t3중대\tN\n정예 서관\t1층\t6·7중대복도\t102-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t103-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t104-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t105-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t106-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t107-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t108-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t109-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t110-6\t2\t2\t1\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t111-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t112-6\t2\t2\t1\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t113-6\t2\t1\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t114-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t115-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t116-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t117-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t118-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t119-6\t2\t2\t0\t원본 배치 PDF 기준 / 이름 판독 주의 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t120-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t121-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t122-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t123-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t124-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t125-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t126-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t127-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t128-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t129-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t130-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t131-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t132-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t133-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t134-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t135-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t136-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t137-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t138-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t139-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t140-6\t2\t2\t1\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t141-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t142-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t143-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t144-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t145-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t7중대\tN\n정예 서관\t1층\t6·7중대복도\t146-6\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t6중대\tN\n정예 서관\t1층\t6·7중대복도\t147-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t7중대\tN\n정예 서관\t1층\t6·7중대복도\t148-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t7중대\tN\n정예 서관\t1층\t6·7중대복도\t149-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t7중대\tN\n정예 서관\t1층\t6·7중대복도\t150-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 9쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t222-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t223-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t224-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t225-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t226-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t227-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t228-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t229-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t230-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t231-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t232-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t233-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t234-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t235-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t236-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t237-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t238-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t239-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t240-7\t2\t1\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t241-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t242-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t243-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t244-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t245-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t246-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t247-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t248-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t7중대복도\t249-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t여생도복도\t202-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t여생도복도\t203-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 10쪽\t7중대\tN\n정예 서관\t2층\t여생도복도\t204-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 10쪽\t여생도방\tN\n정예 서관\t2층\t여생도복도\t205-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 10쪽\t여생도방\tN\n정예 서관\t2층\t여생도복도\t206-여\t2\t1\t1\t원본 배치 PDF 기준 / 편성안 10쪽\t여생도방\tN\n정예 서관\t2층\t여생도복도\t207-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 10쪽 / 여생도 표기 재확인 권장\t여생도방\tN\n정예 서관\t2층\t여생도복도\t208-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 10쪽\t여생도방\tN\n정예 서관\t2층\t여생도복도\t209-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 10쪽\t여생도방\tN\n정예 서관\t2층\t여생도복도\t210-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 10쪽\t여생도방\tN\n정예 서관\t2층\t여생도복도\t211-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 10쪽 / 여생도 표기 재확인 권장\t여생도방\tN\n정예 서관\t2층\t여생도복도\t212-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 10쪽 / 여생도 표기 재확인 권장\t여생도방\tN\n정예 서관\t2층\t여생도복도\t213-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 10쪽\t여생도방\tN\n정예 서관\t2층\t여생도복도\t214-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 10쪽\t여생도방\tN\n정예 서관\t2층\t여생도복도\t215-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 10쪽 / 여생도 표기 재확인 권장\t여생도방\tN\n정예 서관\t2층\t여생도복도\t216-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 10쪽\t여생도방\tN\n정예 서관\t2층\t여생도복도\t217-여\t2\t1\t1\t원본 배치 PDF 기준 / 편성안 10쪽\t여생도방\tN\n정예 서관\t2층\t여생도복도\t218-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 10쪽 / 여생도 표기 재확인 권장\t여생도방\tN\n정예 서관\t2층\t여생도복도\t219-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 10쪽\t여생도방\tN\n정예 서관\t2층\t여생도복도\t220-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 10쪽 / 여생도 표기 재확인 권장\t여생도방\tN\n정예 서관\t2층\t여생도복도\t221-여\t2\t2\t2\t원본 배치 PDF 기준 / 편성안 10쪽\t여생도방\tN\n정예 서관\t3층\t7·8중대복도\t302-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t303-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t304-8\t2\t1\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t305-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t306-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t307-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t308-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t309-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t310-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t311-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t312-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t313-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t314-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t315-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t316-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t317-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t318-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t319-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t320-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t321-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t322-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t323-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t324-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t325-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t326-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t327-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t328-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t329-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t330-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t331-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t332-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t333-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t334-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t335-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t336-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t337-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t338-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t339-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t340-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t341-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t342-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t343-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t344-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t345-8\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t8중대\tN\n정예 서관\t3층\t7·8중대복도\t346-7\t2\t1\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t7중대\tN\n정예 서관\t3층\t7·8중대복도\t347-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t7중대\tN\n정예 서관\t3층\t7·8중대복도\t348-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t7중대\tN\n정예 서관\t3층\t7·8중대복도\t349-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t7중대\tN\n정예 서관\t3층\t7·8중대복도\t350-7\t2\t2\t0\t원본 배치 PDF 기준 / 편성안 11쪽\t7중대\tN\n";
/* v2.34 · 생활실 등록, 자리별 체크, 공실 포함 통계 */
let dormRoomsV234=[],dormLoadedV234=false,dormBusyV234=new Set();
// 수정 중에도 선택창이 잠기지 않도록 방별 저장을 차례로 처리합니다.
const dormPendingV237=new Map();
let dormBaselineMetaV237=null,dormBulkBusyV237=false,dormSourceMetaV240=null,dormRefreshV240=false;
const dormOpenBuildingsV239=new Set(['정예 본관','정예 동관','정예 서관','별관']);
function dormCopyV237(obj){return JSON.parse(JSON.stringify(obj));}
function dormBaselineLabelV237(){
 const el=$('dormBaselineInfo');if(!el)return;
 const b=dormBaselineMetaV237;
 el.textContent=b&&b.exists?'저장 '+(b.savedAt||'-')+' · '+b.count+'호실 · 전체 '+b.people+'명 (여생도 '+b.female+'명)':'저장된 기본값 없음 · 현재 인원을 확인한 뒤 기본값을 설정해 주세요.';
 const restore=$('dormBaselineRestore');if(restore)restore.disabled=!canEdit||!b||!b.exists||dormBulkBusyV237;
 const save=$('dormBaselineSave');if(save)save.disabled=!canEdit||dormBulkBusyV237;
}
/** v2.39.1 · 생활실 목록에는 거주 호실·공실만 표시. 과거 시트 원본은 삭제하지 않습니다. */
function dormIsLivingRoomV2391(r){
 const item=[r.room||'',r.purpose||''].join(' ');
 const nonResidential=/(?:훈육관실|훈육관실|방송반|편집반|화장실|세탁장|세탁실|건조장|건조실|샤워장|샤워실|회의실|휴게실|창고|무기고|전대본부|중대장실|대대장실|당직실|당직사령실|상담실|통신실|자료폐기실|보관실|현관|복도|계단)/;
 if(nonResidential.test(item))return false;
 const note=String(r.note||'').trim();
 if(/^(?:비주거|비거주|시설용|공용시설)\s*(?:[(:／/]|$)/.test(note))return false;
 return true;
}
function dormStatsV234(r){const occ=(r.slots||[]).filter(s=>s.occupied).length,fem=r.femaleRoom?occ:0,outside=Math.max(0,Math.min(occ,Number(r.externalOutsideCount===undefined||r.externalOutsideCount===null?r.outsideCount:r.externalOutsideCount)||0));return {occ,fem,outside,remaining:r.verified?occ-outside:0,empty:r.verified&&occ===0,free:r.verified?Number(r.capacity)-occ:0,unknown:!r.verified};}
function dormFilteredV234(){const b=$('dormBuilding').value,f=$('dormFloor').value,c=$('dormCorridor').value,flag=$('dormVacancy').value,org=$('dormOrgFilterV240').value,s=$('dormSearch').value.trim().toLowerCase();return dormRoomsV234.filter(r=>dormIsLivingRoomV2391(r)).filter(r=>{
 const st=dormStatsV234(r);return (!b||r.building===b)&&(!f||r.floor===f)&&(!c||r.corridor===c)&&(!org||(/^[1-8]중대$/.test(org)?!!(r.companyCounts&&r.companyCounts[org]?.total):r.group===org))&&(!s||[r.building,r.floor,r.corridor,r.room,r.purpose,r.note,...(canEdit&&Array.isArray(r.members)?r.members.map(m=>m.name+' '+m.cohort+' '+m.company):[])].join(' ').toLowerCase().includes(s))&&(!flag||flag==='empty'&&st.empty||flag==='partial'&&r.verified&&st.occ===1||flag==='unknown'&&st.unknown);
 }).sort((a,b)=>a.building.localeCompare(b.building,'ko')||a.floor.localeCompare(b.floor,'ko', {numeric:true})||a.corridor.localeCompare(b.corridor,'ko')||a.room.localeCompare(b.room,'ko',{numeric:true}));}
function dormResetFiltersV251_(){
 ['dormBuilding','dormFloor','dormCorridor','dormVacancy','dormOrgFilterV240','dormSearch'].forEach(id=>$(id).value='');
}
function dormToggleScopeV251_(fields){
 const active=Object.keys(fields).every(id=>$(id).value===fields[id]);
 if(active)dormResetFiltersV251_();
 else{dormResetFiltersV251_();Object.entries(fields).forEach(([id,v])=>$(id).value=v);}
 dormRenderV234();
}
function dormSetFiltersV234(){
 const buildings=['정예 본관','정예 동관','정예 서관','별관'];
 const floors=['1층','2층','3층'];
 [['dormBuilding',buildings,'전체 관'],['dormFloor',floors,'전체 층']].forEach(([id,values,label])=>{
  const s=$(id),old=s.value;s.innerHTML='<option value="">'+label+'</option>'+values.map(v=>'<option value="'+v+'">'+v+'</option>').join('');s.value=values.includes(old)?old:'';
 });
 const s=$('dormCorridor'),old=s.value,b=$('dormBuilding').value,f=$('dormFloor').value;
 const vals=[...new Set(dormRoomsV234.filter(r=>dormIsLivingRoomV2391(r)&&(!b||r.building===b)&&(!f||r.floor===f)).map(r=>r.corridor))].sort((a,b)=>a.localeCompare(b,'ko'));
 s.innerHTML='<option value="">전체 복도</option>'+vals.map(v=>'<option value="'+escapeH(v)+'">'+escapeH(v)+'</option>').join('');s.value=vals.includes(old)?old:'';
}
let dormOutingsV249=[];
function dormOutingFilteredV249(){
  if(!canEdit)return [];
  const eligible=new Set(dormFilteredV234().map(r=>r.id));
  const query=String($('dormOutingSearchV249').value||'').trim().toLowerCase();
  return dormOutingsV249.filter(p=>eligible.has(p.roomId)&&(!query||
   [p.name,p.cohort,p.company,p.building,p.floor,p.corridor,p.room,p.group,p.status].join(' ').toLowerCase().includes(query)));
}
function dormOutingRenderV249(){
 const rows=$('dormOutingRowsV249'),list=dormOutingFilteredV249();
 const eligible=new Set(dormFilteredV234().map(r=>r.id));
 const visible=dormOutingsV249.filter(p=>eligible.has(p.roomId));
 $('dormOutingCountV249').textContent=visible.length+'명';
 $('dormOutingCsvV249').disabled=!list.length;
 $('dormOutingInfoV249').textContent=!canEdit?'개인별 외출 정보는 관리자 계정에서만 표시됩니다.':
  (dormSourceMetaV240&&!dormSourceMetaV240.ok?'연동 오류: '+(dormSourceMetaV240.error||'원본을 확인하세요.'):
  '조건에 맞는 외출 인원 '+visible.length+'명 · 검색 결과 '+list.length+'명 · 스마트당직 상태·생활실 명단 대조');
 rows.innerHTML=!list.length?'<tr><td colspan="9">'+(!canEdit?'관리자 권한으로 로그인해야 개인별 상세정보를 확인할 수 있습니다.':(dormSourceMetaV240&&!dormSourceMetaV240.ok?'스마트당직 연결과 상태 열을 확인해 주세요.':'조건에 맞는 외출 인원이 없습니다.'))+'</td></tr>':
  list.map(p=>'<tr><td>'+escapeH(p.cohort)+'기</td><td>'+escapeH(companyLabelV257(p.company))+'</td><td><b>'+escapeH(p.name)+'</b></td><td>'+escapeH(p.building)+'</td><td>'+escapeH(p.floor)+'</td><td>'+escapeH(p.corridor)+'</td><td><strong>'+escapeH(p.room)+'</strong></td><td>'+escapeH(p.group)+'</td><td>'+escapeH(p.status)+'</td></tr>').join('');
}
function dormOutingCsvV249(){
 const list=dormOutingFilteredV249();if(!list.length)return;
 const lines=[['기수','중대','이름','관','층','복도','호실','조직구분','외출 항목'],...list.map(p=>[p.cohort,p.company,p.name,p.building,p.floor,p.corridor,p.room,p.group,p.status])];
 download(new Blob(['\ufeff'+lines.map(a=>a.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'외출인원_상세_'+localISO()+'.csv');
}
function dormRenderV234(){
 dormSetFiltersV234();
 const list=dormFilteredV234(),verified=list.filter(r=>r.verified);
 const occ=verified.reduce((n,r)=>n+dormStatsV234(r).occ,0);
 const female=verified.reduce((n,r)=>n+dormStatsV234(r).fem,0);
 const outside=verified.reduce((n,r)=>n+dormStatsV234(r).outside,0);
 const remaining=occ-outside;
 const empty=verified.filter(r=>dormStatsV234(r).empty).length;
 const allRooms=dormRoomsV234.filter(dormIsLivingRoomV2391);
 const groups=['1중대','2중대','3중대','4중대','5중대','6중대','7중대','8중대','전(대)대','동생명','여생도','미분류'];
 $('dormRoleGridV240').innerHTML=groups.map(g=>{
  const company=/^[1-8]중대$/.test(g);
  const a=allRooms.filter(r=>r.verified&&(company?!!r.companyCounts?.[g]?.total:r.group===g));
  const n=a.reduce((s,r)=>s+(company?(r.companyCounts?.[g]?.total||0):dormStatsV234(r).occ),0);
  const f=a.reduce((s,r)=>s+(company?(r.companyCounts?.[g]?.female||0):dormStatsV234(r).fem),0);
  const main=a.reduce((s,r)=>s+(r.companyCounts?.[g]?.mainMoved||0),0);
  const applicable=/^[234678]중대$/.test(g);
  const breakdown=company?'<span class="dorm-role-breakdown">여생도 <b>'+f+'</b> / 본관 이동 <i>'+(applicable?main:'—')+'</i></span>':'';
  return '<button type="button" class="dorm-role-item" data-dorm-role="'+escapeH(g)+'" title="다시 누르면 전체 보기"><small>'+escapeH(g)+'</small><strong>'+n+'명</strong>'+(company?breakdown:'<span class="dorm-role-breakdown">여생도 '+f+'명</span>')+'</button>';
 }).join('');
 const m=dormSourceMetaV240;
 $('dormLiveStatusV240').textContent=m?(m.ok?'연동 정상 · 생도전대 22~31행 · 원본 '+m.sourceKeys+'명 / 호실 연결 '+m.matched+'명 / 미연결 '+m.notAssigned+'명 / 명단 검토 '+m.review+'건': '연동 실패 · '+(m.error||'원본 확인 필요')):'연동 확인 중';
 if(m&&document.activeElement!==$('dormSourceTabV240')&&document.activeElement!==$('dormSourceColV240')){
   $('dormSourceTabV240').placeholder='시트명: '+(m.tab||'생도전대');$('dormSourceColV240').placeholder='비고열: '+(m.column||'비고');
 }
 $('dormStats').innerHTML=[['표시 호실',list.length],['배정 인원',occ],['외출 인원',outside],['현재 남은 인원',remaining],['여생도 배정',female],['공실',empty],['미확인',list.length-verified.length]].map(([label,val])=>'<div class="dorm-kpi"><small>'+label+'</small><b>'+val+'</b></div>').join('');
 const buildings=['정예 본관','정예 동관','정예 서관','별관'];
 const selected=$('dormBuilding').value;
 $('dormBuildingCards').innerHTML=buildings.map(b=>{const a=dormRoomsV234.filter(r=>r.building===b&&dormIsLivingRoomV2391(r)),u=a.filter(r=>r.verified),count=u.reduce((n,r)=>n+dormStatsV234(r).occ,0),out=u.reduce((n,r)=>n+dormStatsV234(r).outside,0),e=u.filter(r=>dormStatsV234(r).empty).length;return '<button type="button" data-dorm-building-card="'+escapeH(b)+'" class="dorm-building-card '+(selected===b?'selected':'')+'"><strong>'+escapeH(b)+'</strong><span>'+a.length+'호실 · 현재 '+(count-out)+'명</span><small>배정 '+count+'명 / 외출 '+out+'명 / 공실 '+e+'호</small></button>';}).join('');
 const agg=new Map();list.forEach(r=>{const key=[r.building,r.floor,r.corridor].join('\u001f'),v=agg.get(key)||{building:r.building,floor:r.floor,corridor:r.corridor,rooms:0,verified:0,occ:0,female:0,outside:0,remaining:0,empty:0,free:0};v.rooms++;const s=dormStatsV234(r);v.verified+=r.verified?1:0;v.occ+=s.occ;v.female+=s.fem;v.outside+=s.outside;v.remaining+=s.remaining;v.empty+=s.empty?1:0;v.free+=s.free;agg.set(key,v);});
 $('dormSummaryText').textContent='선택 범위 · '+list.length+'호실 / 배정 '+occ+'명 / 외출 '+outside+'명 / 현재 '+remaining+'명 / 공실 '+empty+'호';
 $('dormGroupRows').innerHTML=agg.size?[...agg.values()].map(g=>'<tr role="button" tabindex="0" title="한 번 누르면 상세, 다시 누르면 전체 보기" data-dorm-summary-building="'+escapeH(g.building)+'" data-dorm-summary-floor="'+escapeH(g.floor)+'" data-dorm-summary-corridor="'+escapeH(g.corridor)+'"><td>'+escapeH(g.building)+'</td><td>'+escapeH(g.floor)+'</td><td>'+escapeH(g.corridor)+'</td><td>'+g.rooms+'</td><td>'+g.verified+' / '+g.rooms+'</td><td><b>'+g.occ+'</b>명</td><td>'+g.female+'명</td><td class="dorm-out">'+g.outside+'명</td><td class="dorm-stay">'+g.remaining+'명</td><td>'+g.empty+'호</td><td>'+g.free+'자리</td></tr>').join(''):'<tr><td colspan="11">등록된 호실이 없습니다. 관·층·복도·호실을 먼저 등록해 주세요.</td></tr>';
 const byBuilding=new Map();list.forEach(r=>{if(!byBuilding.has(r.building))byBuilding.set(r.building,[]);byBuilding.get(r.building).push(r);});
 const canChange=canEdit&&!dormBulkBusyV237;
 const roomHeaders='<th>층 / 복도</th><th>호실</th><th>전체 배정명단</th><th>소속·용도</th><th>조직구분</th><th>배정 인원</th><th>여생도</th><th>여생도 인원</th><th>외출 인원</th><th>현재 남은 인원</th><th>상태</th><th>저장</th>';
 const rowHTML=r=>{
  const s=dormStatsV234(r),status=!r.verified?'미확인':s.empty?'공실':s.occ===1?'독방':s.free>0?'입실 중':'만실';
  const cls=!r.verified?'unverified':s.empty?'empty':s.free>0?'partial':'';
  const disabled=canChange?'':'disabled';
  const countSel='<select class="field dorm-count" aria-label="'+escapeH(r.room)+' 배정 인원" data-dorm-count '+disabled+'>'+Array.from({length:(r.building==='별관'?4:2)+1},(_,k)=>'<option value="'+k+'" '+(s.occ===k?'selected':'')+'>'+k+'명</option>').join('')+'</select>';
  const outSel='<select class="field dorm-count" aria-label="'+escapeH(r.room)+' 외출 인원" data-dorm-outside '+(r.verified&&canChange&&!(dormSourceMetaV240&&dormSourceMetaV240.ok&&r.externalOutsideCount!==undefined)?'':'disabled')+'>'+Array.from({length:s.occ+1},(_,k)=>'<option value="'+k+'" '+(s.outside===k?'selected':'')+'>'+k+'명</option>').join('')+'</select>';
  const femaleRoomCheck='<label class="dorm-female-room"><input type="checkbox" data-dorm-female-room '+(r.femaleRoom?'checked':'')+' '+disabled+'> 여생도</label>';
  const groupSel='<select class="field dorm-org-select" aria-label="'+escapeH(r.room)+' 조직구분" data-dorm-orgselect '+disabled+'>'+['1중대','2중대','3중대','4중대','5중대','6중대','7중대','8중대','전(대)대','동생명','여생도','미분류'].map(g=>'<option '+(r.group===g?'selected':'')+'>'+escapeH(g)+'</option>').join('')+'</select>';
  const outDetail=canEdit&&dormOutingsV249.some(p=>p.roomId===r.id)?'<button class="btn btn-soft" type="button" data-dorm-outing-room="'+escapeH(r.room)+'" style="padding:4px 6px;margin-top:4px;font-size:11px">이름 보기</button>':'';
  const matched=new Set(dormOutingsV249.filter(p=>p.roomId===r.id).map(p=>[p.cohort,p.company,p.name].join('|')));
  const members=Array.isArray(r.members)?r.members:[];
  const membersHTML=!canEdit?'<span class="dorm-roster-muted">권한 필요</span>':!members.length?'<span class="dorm-roster-muted">명단 미등록</span>':
    '<div class="dorm-member-list">'+members.map(p=>'<span class="dorm-member '+(matched.has([p.cohort,p.company,p.name].join('|'))?'dorm-member-out':'')+'" title="'+(p.verified?'배정 확인':'배정 확인 필요')+'">'+'<small>'+escapeH(p.cohort||'?')+'기 · '+escapeH(p.company||'?')+'중대 · </small>'+escapeH(p.name)+(matched.has([p.cohort,p.company,p.name].join('|'))?' <b>외출</b>':'')+(!p.verified?' <i>확인필요</i>':'')+'</span>').join('')+'</div>';
  return '<tr data-dorm-id="'+escapeH(r.id)+'"><td>'+escapeH(r.floor)+' / '+escapeH(r.corridor)+'</td><td class="dorm-room-label">'+escapeH(r.room)+'</td><td>'+membersHTML+(canChange?'<button type="button" class="btn" data-dorm-members-edit>배정 편집</button>':'')+'</td><td>'+escapeH(r.purpose||'일반')+'</td><td>'+groupSel+'</td><td>'+countSel+'</td><td>'+femaleRoomCheck+'</td><td class="dorm-female-count">'+s.fem+'명</td><td>'+outSel+outDetail+'</td><td class="dorm-stay">'+(r.verified?s.remaining+'명':'미확인')+'</td><td><span class="dorm-status '+cls+'">'+status+'</span>'+(!r.verified&&canEdit?'<button type="button" class="btn btn-soft" data-dorm-empty style="font-size:11px;padding:5px;margin:4px">공실 확정</button>':'')+'</td><td><small data-dorm-save-state>'+(dormPendingV237.has(r.id)?'저장 중…':'저장됨')+'</small>'+ (canEdit?'<div><button class="btn" type="button" data-dorm-delete>삭제</button></div>':'')+'</td></tr>';
 };
 $('dormRoomRows').innerHTML=byBuilding.size?buildings.filter(b=>byBuilding.has(b)).map(b=>{
  const rooms=byBuilding.get(b),a=rooms.filter(r=>r.verified),occupied=a.reduce((n,r)=>n+dormStatsV234(r).occ,0),outed=a.reduce((n,r)=>n+dormStatsV234(r).outside,0);
  const floors=['1층','2층','3층'];
  const rows=floors.map(f=>{const part=rooms.filter(r=>r.floor===f);return part.length?'<tr><td colspan="12" class="dorm-floor-heading">'+f+' · '+part.length+'호실</td></tr>'+part.map(rowHTML).join(''):'';}).join('');
  return '<details class="dorm-building-section" data-dorm-group="'+escapeH(b)+'" '+(dormOpenBuildingsV239.has(b)?'open':'')+'><summary>'+escapeH(b)+'<small>'+rooms.length+'호실 · 배정 '+occupied+'명 · 외출 '+outed+'명 · 현재 '+(occupied-outed)+'명</small></summary><div class="eq-scroll"><table class="dorm-table"><thead><tr>'+roomHeaders+'</tr></thead><tbody>'+rows+'</tbody></table></div></details>';
 }).join(''):'<p class="panel-sub">조건에 해당하는 호실이 없습니다.</p>';
 qsa('.dorm-edit-only').forEach(x=>x.classList.toggle('hidden',!canEdit));
 dormBaselineLabelV237();
 dormOutingRenderV249();
}
async function dormReloadV234(){if(!ready)return;try{const result=await server('getDormV234');dormLoadedV234=true;dormRoomsV234=result.rooms||[];dormBaselineMetaV237=result.baseline||null;dormSourceMetaV240=result.source||null;dormOutingsV249=canEdit&&Array.isArray(result.source?.outings)?result.source.outings:[];$('dormSheetLink').href=result.sheetUrl||'#';$('dormSheetLink').classList.toggle('hidden',!result.sheetUrl);const namesLink=$('dormNamesSheetV243');namesLink.href=result.rosterSheetUrl||'#';namesLink.classList.toggle('hidden',!result.rosterSheetUrl);$('dormRosterCountV243').textContent='배정명단 '+(result.rosterCount||0)+'건 · '+(result.unified?'생활실현황 P열 이후에서 관리':'기존 배정명단 시트 · 통합 전');dormRenderV234();}catch(e){alert('생활실 현황 조회 실패: '+e.message);}}
function dormOpenV234(){if(!dormLoadedV234)dormReloadV234();else dormRenderV234();}
function dormRoomPayloadV234(id){return dormRoomsV234.find(r=>r.id===id);}
async function dormCommitV234(id,mutator){
 if(!canEdit||dormBulkBusyV237)return;
 const r=dormRoomPayloadV234(id);if(!r)return;
 const prior=dormCopyV237(r);
 mutator(r);r.verified=true;
 // 필터가 활성화되어 있으면 0명 설정 직후 목록에서 사라지는 문제가 발생하므로 해제합니다.
 if($('dormVacancy').value)$('dormVacancy').value='';
 let q=dormPendingV237.get(id);
 if(q){q.dirty=true;dormRenderV234();return;}
 q={confirmed:prior,dirty:false};dormPendingV237.set(id,q);dormRenderV234();
 try{
  while(true){
   q.dirty=false;
   const request=dormCopyV237(r);
   const saved=await server('saveDormV234',request);
   q.confirmed=dormCopyV237(saved);
   // 사용자에게 보이는 최신 인원수는 유지하고, 저장 버전만 갱신합니다.
   r.updatedAt=saved.updatedAt;
   if(!q.dirty){const live=r.externalOutsideCount;Object.assign(r,saved);if(live!==undefined)r.externalOutsideCount=live;break;}
  }
 }catch(err){
  Object.assign(r,q.confirmed);
  alert('생활실 변경 저장 실패: '+err.message+'\n저장된 마지막 값으로 되돌렸습니다.');
 }finally{dormPendingV237.delete(id);dormRenderV234();}
}
async function dormSaveBaselineV237(){
 if(!mustEdit()||dormBulkBusyV237)return;
 if(dormPendingV237.size)return alert('생활실 변경 저장이 완료된 뒤 기본값을 설정해 주세요.');
 if(!dormRoomsV234.length)return alert('먼저 생활실을 등록해 주세요.');
 const replaced=dormBaselineMetaV237&&dormBaselineMetaV237.exists;
 if(!confirm('현재 전체 '+dormRoomsV234.length+'호실의 배정인원·외출인원·여생도방·확인 여부를 '+(replaced?'기존 기본값을 덮어쓰고 다시':'기본값으로')+' 저장할까요?\n\n관·층·호실 등은 기본값 복원으로 변경되지 않습니다.'))return;
 dormBulkBusyV237=true;dormRenderV234();
 try{dormBaselineMetaV237=await server('saveDormBaselineV237');toast('생활실 기본값이 저장되었습니다.');}
 catch(e){alert('기본값 저장 실패: '+e.message);}finally{dormBulkBusyV237=false;dormRenderV234();}
}
async function dormRestoreBaselineV237(){
 if(!mustEdit()||dormBulkBusyV237)return;
 if(dormPendingV237.size)return alert('생활실 변경 저장이 완료된 뒤 복원해 주세요.');
 dormBulkBusyV237=true;dormRenderV234();
 try{
  const p=await server('previewDormBaselineV237');
  if(!p.exists)return alert('먼저 기본값 설정하기를 실행해 주세요.');
  if(!confirm('기본값 저장 시각: '+p.savedAt+'\n\n기본값이 있는 호실: '+p.total+'호\n현재 호실과 일치: '+p.matched+'호\n변경 예정: '+p.changed+'호\n현재 없는 호실: '+p.missing+'호\n\n변경 예정 호실을 기본값의 배정 인원·외출 인원·여생도방·확인 여부로 복원할까요?\n현재 값은 별도의 복원전 백업 시트에 남습니다.\n새로 등록한 호실은 삭제하지 않습니다.'))return;
  if(p.changed===0){toast('변경할 호실이 없습니다.');return;}
  const res=await server('restoreDormBaselineV237',p.savedAt);
  await dormReloadV234();
  toast('기본값 복원 완료: '+res.changed+'호실');
 }catch(e){alert('기본값 복원 실패: '+e.message);}
 finally{dormBulkBusyV237=false;dormRenderV234();}
}
function dormOpenCreateV234(){if(!mustEdit())return;$('dormEditBox').classList.remove('hidden');$('dormPasteBox').classList.add('hidden');['dormFBuilding','dormFFloor','dormFCorridor','dormFRoom'].forEach(id=>$(id).value='');$('dormFOrg').value='미분류';$('dormFFemaleRoom').checked=false;$('dormFBuilding').focus();}
async function dormCreateV234(){if(!mustEdit())return;const capacity=$('dormFBuilding').value==='별관'?4:2;const payload={building:$('dormFBuilding').value,floor:$('dormFFloor').value,corridor:$('dormFCorridor').value,room:$('dormFRoom').value,capacity,group:$('dormFOrg').value,femaleRoom:$('dormFFemaleRoom').checked||$('dormFOrg').value==='여생도',note:'',outsideCount:0,verified:false,slots:Array.from({length:capacity},()=>({occupied:false,female:false}))};
 try{const saved=await server('saveDormV234',payload);dormRoomsV234.push(saved);$('dormEditBox').classList.add('hidden');dormRenderV234();toast('생활실 등록 완료 (입실 미확인)');}catch(e){alert(e.message);}}
async function dormPasteSaveV234(){if(!mustEdit())return;const val=$('dormPaste').value;if(!val.trim())return alert('호실 목록을 붙여넣어 주세요.');if(!confirm('호실 목록을 추가할까요? 기존 등록 호실은 유지하고 중복 호실은 건너뜁니다.'))return;
 try{const res=await server('importDormV234',val);$('dormPasteBox').classList.add('hidden');$('dormPaste').value='';await dormReloadV234();toast('신규 '+res.added+'호 / 중복 '+res.skipped+'호');}catch(e){alert('일괄 등록 실패: '+e.message);}}
function dormCsvV234(){const rows=[['관','층','복도','호실','소속·용도','조직구분','배정인원','여생도방','여생도','외출인원','현재남은인원','상태'],...dormFilteredV234().map(r=>{const s=dormStatsV234(r);return [r.building,r.floor,r.corridor,r.room,r.purpose||'미분류',r.group||'',s.occ,r.femaleRoom?'Y':'N',s.fem,s.outside,r.verified?s.remaining:'미확인',!r.verified?'미확인':s.empty?'공실':s.occ===1?'독방':s.free?'입실 중':'만실'];})];download(new Blob(['\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'생활실_외출잔류현황_'+localISO()+'.csv');}

async function dormRosterImportV240(){if(!mustEdit()||dormBulkBusyV237)return;
 if(dormPendingV237.size)return alert('생활실 변경 저장이 완료된 뒤 명단을 등록해 주세요.');
 if(!confirm('원본 생활실 편성안 439호실과 배정자 이름 후보 818건을 Google Sheets에 등록할까요?\n기존 생활실 설정과 수동으로 수정한 배정명단은 보호됩니다.\n미확인 이름 33건은 검토 상태로 등록하고 앱 화면에는 이름을 표시하지 않습니다.'))return;
 const btn=$('dormRosterImportV240');btn.disabled=true;btn.textContent='호실·명단 등록 중…';
 try{
  const r=await server('initializeDormRoomsAndRosterV243');
  await dormReloadV234();
  alert('생활실 + 배정명단 등록 완료!\n신규 호실 '+r.roomsAdded+'호 / 기존 호실 '+r.roomsExisting+'호\n신규 배정명단 '+r.namesAdded+'건 / 수정 '+r.namesUpdated+'건 / 유지 '+r.namesUnchanged+'건 / 수동정정 보존 '+r.namesManual+'건\n검증 '+r.namesVerified+'건 / 확인 필요 '+r.namesReviewed+'건 / 호실 미연결 '+r.missingRooms+'개\n\n생활실현황 시트 P열 이후의 이름과 기수·중대를 확인해 주세요. 원본 편성 총원 829명과 읽힌 후보 818건의 차이 11명은 별도 검토가 필요합니다.');
 }catch(e){alert('호실·명단 일괄 등록 실패: '+e.message);}
 finally{btn.disabled=false;btn.textContent='PDF 호실 + 배정자 명단 한번에 등록';}
}
async function dormUnifySheetsV248(){
 if(!mustEdit()||dormBulkBusyV237)return;
 if(dormPendingV237.size)return alert('생활실 변경 저장이 끝난 뒤 통합해 주세요.');
 if(!confirm('수정한 「생활실_배정명단」을 다시 대조하여 「생활실현황」에 반영하고 호실별 배정 인원을 갱신할까요?\n기존 통합 여부와 관계없이 새로 입력한 인원을 확인합니다.\n통합 시트 P:AQ에 직접 입력한 명단의 인원도 다시 집계합니다.\n기존 정보는 백업하고, 충돌·정원 초과는 검토 목록에 기록합니다.'))return;
 const btn=$('dormUnifySheetsV248');btn.disabled=true;btn.textContent='명단·인원 동기화 중…';
 try{
  const r=await server('unifyDormSheetsV248');await dormReloadV234();
  alert('명단·인원 갱신 완료\n전체 호실: '+r.rooms+'개\n현재 통합 배정자: '+r.roster+'명\n새로 통합: '+r.imported+'명 / 정정: '+r.updated+'건\n인원수 변경: '+r.occupancyChanged+'호실 / 반영한 호실: '+r.roomsChanged+'개\n확인 필요: '+r.issues+'건 (미연결 '+r.unmatched+' / 정원초과 '+r.overflow+' / 충돌 '+r.conflicts+')\n\n변경 전 자료는 「생활실_동기화백업」 탭에 남겼습니다.');
 }catch(e){alert('생활실 시트 통합 실패: '+e.message);}
 finally{btn.disabled=false;btn.textContent='배정명단 통합 · 인원 갱신';}
}
async function dormSourceSaveV240(){if(!mustEdit())return;
 const tab=$('dormSourceTabV240').value.trim()||dormSourceMetaV240&&dormSourceMetaV240.tab||'생도전대';
 const col=$('dormSourceColV240').value.trim()||dormSourceMetaV240&&dormSourceMetaV240.column||'비고';
 try{await server('saveDormSourceV240',tab,col);await dormReloadV234();toast('생도전대 연동 위치를 설정했습니다.');}
 catch(e){alert('연동 설정 실패: '+e.message);}
}

/** v2.73 · 앱 초기 연결을 방해하지 않도록 PDF.js를 요청 시에만 로드합니다. */
let pdfJsPromiseV273=null;
function loadPdfJsV273(){
 if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
 if(pdfJsPromiseV273)return pdfJsPromiseV273;
 pdfJsPromiseV273=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.async=true;
  script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  let done=false;
  const timer=setTimeout(()=>finish(new Error('8초 이내에 PDF 라이브러리를 불러오지 못했습니다. 외부 CDN 접속을 확인하세요.')),8000);
  function finish(error){if(done)return;done=true;clearTimeout(timer);script.onload=null;script.onerror=null;if(error){script.remove();pdfJsPromiseV273=null;reject(error);}else if(window.pdfjsLib)resolve(window.pdfjsLib);else{pdfJsPromiseV273=null;reject(new Error('PDF 모듈이 초기화되지 않았습니다.'));}}
  script.onload=()=>finish(null);script.onerror=()=>finish(new Error('PDF 해석 서버 접속 실패. 인터넷/보안망 차단을 확인하세요.'));
  document.head.appendChild(script);
 });
 return pdfJsPromiseV273;
}

/* v2.47 - 차기 편성안 PDF 텍스트 좌표 판독·사전 확인; 원본 시트 자동 덮어쓰기 금지 */
let dormHandoffDraftV247=[];
function dormHandoffSafeV247(value){return escapeH(String(value??''));}
async function dormHandoffParseV247(){
 const file=$('dormHandoffFileV247').files[0],status=$('dormHandoffProgressV247');
 if(!file||!(/\.pdf$/i.test(file.name)||file.type==='application/pdf'))return alert('생활실 편성안 PDF를 선택해 주세요.');
 if(file.size>15*1024*1024)return alert('PDF는 15MB 이하만 지원합니다.');
 status.textContent='PDF 분석 라이브러리를 준비하는 중...';
 try{await loadPdfJsV273();}
 catch(error){status.textContent='PDF 라이브러리 준비 실패: '+String(error.message||error);return;}
 status.textContent='PDF 텍스트와 호실 위치를 분석하는 중...';$('dormHandoffReviewV247').classList.add('hidden');
 try{
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const bytes=new Uint8Array(await file.arrayBuffer()),pdf=await pdfjsLib.getDocument({data:bytes}).promise;
  const drafts=[],seen=new Set();let allTokens=0;
  for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
   const page=await pdf.getPage(pageNo),vp=page.getViewport({scale:1}),text=await page.getTextContent();
   const tokens=[];
   for(const t of text.items){if(!t.str?.trim())continue;const str=t.str.trim();let x=t.transform[4],y=vp.height-t.transform[5];
    if(!Number.isFinite(x)||!Number.isFinite(y))continue;
    // PDF 글꼴은 한 항목에 여러 호실 번호를 포함할 수 있으므로 화면상 x위치를 나누어 추정.
    const ss=[...str.matchAll(/(?:^|\s)(\d{3}(?:-(?:[1-8]|동|생|명|여))?)(?=\s|$)/g)];
    if(ss.length>=2){let pos=0;ss.forEach(m=>{const offset=str.indexOf(m[1],pos);pos=offset+m[1].length;tokens.push({x:x+(t.width||0)*(offset/str.length),y,str:m[1]});});}
    else tokens.push({x,y,str});
   }
   allTokens+=tokens.length;
   const raw=tokens.map(t=>t.str).join(' '),building=raw.includes('정예본관')||raw.includes('정예 본관')?'정예 본관':raw.includes('정예동관')||raw.includes('정예 동관')?'정예 동관':raw.includes('정예서관')||raw.includes('정예 서관')?'정예 서관':raw.includes('별관')?'별관':'';
   const f=(raw.match(/(?:정예본관|정예동관|정예서관|정예 본관|정예 동관|정예 서관|별관)[^\d]{0,12}([123])층/)||[])[1];
   if(!building||!f)continue;
   const head=tokens.filter(t=>/^\d{3}(?:-(?:[1-8]|동|생|명|여))?$/.test(t.str)&&t.y>25&&t.y<vp.height-12);
   // 같은 페이지에 동일 호실 번호가 있을 때 하나의 실제 호실로만 판독.
   for(const rt of head){
    const room=rt.str,key=[building,f,room].join('|');if(seen.has(key))continue;
    seen.add(key);
    const peer=head.filter(t=>Math.abs(t.y-rt.y)<12&&t!==rt).map(t=>Math.abs(t.x-rt.x)).filter(n=>n>5).sort((a,b)=>a-b)[0]||40;
    const dx=Math.min(36,Math.max(15,peer*0.46)),nextY=head.filter(t=>t.y>rt.y+18).map(t=>t.y).sort((a,b)=>a-b)[0]||vp.height-15;
    const bottom=Math.min(nextY-8,rt.y+115);
    const region=tokens.filter(t=>t!==rt&&Math.abs(t.x-rt.x)<dx&&t.y>rt.y+12&&t.y<bottom);
    let names=[];
    for(const t of region){const chunks=t.str.split(/[\s()（）,，/]+/).filter(Boolean);
      for(const s of chunks){if(/^([가-힣]{2,4}[A-C]?|[A-Za-z]{2,18})$/.test(s)&&!/(?:공실|세탁|건조|화장|샤워|중대|임원|명예|위원|참모|보좌|체육|복도|본부|동기|회장|총무|문화|교육|발전|남녀|관실|기수|훈육|휴게|창고|기관|앨범|방송|편집|현관|소장|경위)/.test(s))names.push(s);}
    }
    names=[...new Set(names)].slice(0,4);
    const vacant=region.some(t=>/공실/.test(t.str));
    const num=vacant?0:Math.min(building==='별관'?4:2,names.length);
    // 원문 배치도를 미확인 상태로 보관, 조직·인원은 검토 미리보기에서 최종 선택해야 함.
    const suffix=room.match(/-([1-8]|동|생|명|여)$/),female=!!suffix&&suffix[1]==='여';
    let org=suffix&&/^[1-8]$/.test(suffix[1])?suffix[1]+'중대':suffix&&/^(동|생|명)$/.test(suffix[1])?'동생명':female?'여생도':/전대복도/.test(raw)?'전(대)대':'미분류';
    const corridor=building==='정예 본관'&&f==='1'?(room.startsWith('1')&&Number(room.slice(0,3))<155?'서쪽':'동쪽'):female?'여생도복도':org==='동생명'?'동생명복도':org==='전(대)대'?'전대복도':'일반복도';
    drafts.push({building,floor:f+'층',corridor,room,group:org,femaleRoom:female,occupied:num,names,note:vacant?'PDF 공실 표기':'',page:pageNo,uncertain:(!vacant&&names.length===0)||(names.length>(building==='별관'?4:2)),include:vacant||names.length>0});
   }
  }
  if(!allTokens||!drafts.length)throw Error('호실과 이름을 함께 추출하지 못했습니다. 이 PDF는 스캔 이미지이거나 기존 배치도와 형식이 다를 수 있습니다.');
  dormHandoffDraftV247=drafts;dormHandoffRenderV247();status.textContent='분석 완료: '+drafts.length+'호실 후보. 표의 관·복도·이름·인원을 반드시 확인한 뒤 등록하세요.';
 }catch(e){status.textContent='PDF 판독 실패: '+(e.message||e);}
}
function dormHandoffRenderV247(){
 const old=new Set(dormRoomsV234.map(r=>[r.building,r.floor,r.room].join('|')));
 const candidates=dormHandoffDraftV247;
 $('dormHandoffReviewV247').classList.toggle('hidden',!candidates.length);
 $('dormHandoffSummaryV247').textContent='추출 '+candidates.length+'호 / 신규 후보 '+candidates.filter(r=>!old.has([r.building,r.floor,r.room].join('|'))).length+'호 / 기존 호실 '+candidates.filter(r=>old.has([r.building,r.floor,r.room].join('|'))).length+'호 / 이름은 수동 확인 후 저장. PDF 페이지의 색상 정보로 기수는 확정하지 않습니다.';
 const orgs=['미분류','1중대','2중대','3중대','4중대','5중대','6중대','7중대','8중대','전(대)대','동생명','여생도'];
 $('dormHandoffRowsV247').innerHTML=candidates.map((r,i)=>{
  const exists=old.has([r.building,r.floor,r.room].join('|'));
  return '<tr data-handoff-index="'+i+'"><td><input type="checkbox" data-handoff-include '+(r.include&&!r.uncertain?'checked':'')+'></td>'+ 
   '<td>'+dormHandoffSafeV247(r.building)+'</td><td>'+dormHandoffSafeV247(r.floor)+'</td>'+ 
   '<td><input class="field" data-handoff-corridor value="'+dormHandoffSafeV247(r.corridor)+'" style="width:115px"></td><td><strong>'+dormHandoffSafeV247(r.room)+'</strong></td>'+ 
   '<td><select class="field" data-handoff-group>'+orgs.map(g=>'<option '+(g===r.group?'selected':'')+'>'+g+'</option>').join('')+'</select></td>'+ 
   '<td><input type="checkbox" data-handoff-female '+(r.femaleRoom?'checked':'')+'></td>'+ 
   '<td><select class="field" data-handoff-count>'+Array.from({length:(r.building==='별관'?5:3)},(_,n)=>'<option value="'+n+'" '+(n===r.occupied?'selected':'')+'>'+n+'명</option>').join('')+'</select></td>'+ 
   '<td><input class="field" data-handoff-names value="'+dormHandoffSafeV247(r.names.join(', '))+'" placeholder="이름 쉼표 구분 · 수정 가능" style="width:180px" maxlength="120"></td>'+ 
   '<td><small>'+(exists?'기존 호실':'신규')+(r.uncertain?' · 판독 주의':'')+'</small></td></tr>';
 }).join('');
}
async function dormHandoffApplyV247(){
 if(!mustEdit())return;
 const rows=Array.from($('dormHandoffRowsV247').querySelectorAll('[data-handoff-index]'));
 const batch=rows.filter(row=>row.querySelector('[data-handoff-include]').checked).map(row=>{
  const r=dormHandoffDraftV247[Number(row.dataset.handoffIndex)];return {building:r.building,floor:r.floor,corridor:row.querySelector('[data-handoff-corridor]').value.trim(),room:r.room,
  group:row.querySelector('[data-handoff-group]').value,femaleRoom:row.querySelector('[data-handoff-female]').checked,
  occupied:Number(row.querySelector('[data-handoff-count]').value),names:row.querySelector('[data-handoff-names]').value.split(/[,，]/).map(v=>v.trim()).filter(Boolean),page:r.page};
 });
 if(!batch.length)return alert('등록할 호실에 체크해 주세요.');
 const mode=$('dormHandoffModeV247').value;
 if(!confirm('PDF 추출 결과 '+batch.length+'호실을 '+(mode==='replace'?'기존 배정/명단을 백업하고 교체':'신규 호실만 등록')+'할까요?\n\n미확인 이름과 잘못된 호실 배치는 사전에 정정해 주세요.\n비품·업무일지 기록은 변경되지 않습니다.'))return;
 const b=$('dormHandoffApplyV247');b.disabled=true;
 try{const result=await enqueue(()=>server('applyDormPdfHandoffV247',batch,mode));
  await dormReloadV234();$('dormHandoffProgressV247').textContent='등록 완료: 신규 '+result.added+'호 / 갱신 '+result.updated+'호 / 기존 유지 '+result.skipped+'호 / 이름 '+result.names+'건 · 불분명한 기수/중대는 시트 확인 필요.';
  alert('인수인계 자료 등록 완료\n신규 '+result.added+'호 · 변경 '+result.updated+'호 · 건너뜀 '+result.skipped+'호\n이름 '+result.names+'건 (기수·중대 미확인 가능).\n생활실현황 시트 P열 이후에서 반드시 확인하세요.');
 }catch(e){alert('PDF 인수인계 등록 실패: '+e.message);}finally{b.disabled=false;}
}

function dormInitV234(){
 $('dormHandoffToggleV247').addEventListener('click',()=>{$('dormHandoffPanelV247').classList.toggle('hidden');});
 $('dormHandoffParseV247').addEventListener('click',dormHandoffParseV247);
 $('dormHandoffApplyV247').addEventListener('click',dormHandoffApplyV247);
 $('dormRosterImportV240').addEventListener('click',dormRosterImportV240);$('dormUnifySheetsV248').addEventListener('click',dormUnifySheetsV248);$('dormSourceSaveV240').addEventListener('click',dormSourceSaveV240);
 $('dormOutingSearchV249').addEventListener('input',dormOutingRenderV249);
 $('dormOutingCsvV249').addEventListener('click',dormOutingCsvV249);
 window.setInterval(()=>{if(ready&&view==='dorm'&&dormPendingV237.size===0&&!dormBulkBusyV237&&!dormRefreshV240){dormRefreshV240=true;dormReloadV234().finally(()=>{dormRefreshV240=false;});}},90000);
 $('dormRoomRows').addEventListener('click',ev=>{
   const btn=ev.target.closest('[data-dorm-outing-room]');if(!btn)return;
   $('dormOutingSearchV249').value=btn.dataset.dormOutingRoom;
   dormOutingRenderV249();$('dormOutingPanelV249').scrollIntoView({behavior:'smooth',block:'start'});
 });
 $('dormRoomRows').addEventListener('toggle',ev=>{const d=ev.target.closest('[data-dorm-group]');if(!d)return;d.open?dormOpenBuildingsV239.add(d.dataset.dormGroup):dormOpenBuildingsV239.delete(d.dataset.dormGroup);},true);
 $('dormRoleGridV240').addEventListener('click',ev=>{const b=ev.target.closest('[data-dorm-role]');if(!b)return;dormToggleScopeV251_({'dormOrgFilterV240':b.dataset.dormRole});});
 $('dormBuildingCards').addEventListener('click',ev=>{const button=ev.target.closest('[data-dorm-building-card]');if(!button)return;dormToggleScopeV251_({'dormBuilding':button.dataset.dormBuildingCard});});
 const dormSummaryToggleV251_=row=>dormToggleScopeV251_({dormBuilding:row.dataset.dormSummaryBuilding,dormFloor:row.dataset.dormSummaryFloor,dormCorridor:row.dataset.dormSummaryCorridor});
 $('dormGroupRows').addEventListener('click',ev=>{const row=ev.target.closest('[data-dorm-summary-building]');if(row)dormSummaryToggleV251_(row);});
 $('dormGroupRows').addEventListener('keydown',ev=>{const row=ev.target.closest('[data-dorm-summary-building]');if(row&&(ev.key==='Enter'||ev.key===' ')){ev.preventDefault();dormSummaryToggleV251_(row);}});
 $('dormReload').addEventListener('click',dormReloadV234);
 $('dormBaselineSave').addEventListener('click',dormSaveBaselineV237);
 $('dormBaselineRestore').addEventListener('click',dormRestoreBaselineV237);
 $('dormClassifyV238').addEventListener('click',async()=>{if(!mustEdit())return;if(!confirm('기존 조직구분(중대·동기회·생발위·명예위·기타)을 1~8중대 / 전(대)대 / 동생명 / 미분류로 정리할까요? 입실 인원·공실·외출·기본값은 변경하지 않습니다.'))return;try{const r=await server('applyDormClassificationV238');await dormReloadV234();alert('새 조직 분류 적용: '+r.total+'호 / 수정 '+r.updated+'호 / 여생도방 '+r.female+'호. 미분류 호실은 직접 선택해 주세요.');}catch(e){alert('분류 실패: '+e.message);}});
 ['dormBuilding','dormFloor','dormCorridor','dormVacancy','dormOrgFilterV240','dormSearch'].forEach(id=>$(id).addEventListener(id==='dormSearch'?'input':'change',dormRenderV234));
 $('dormNew').addEventListener('click',dormOpenCreateV234);$('dormCreateSave').addEventListener('click',dormCreateV234);$('dormCreateCancel').addEventListener('click',()=>$('dormEditBox').classList.add('hidden'));
 $('dormOpenPaste').addEventListener('click',()=>{if(!mustEdit())return;$('dormPasteBox').classList.toggle('hidden');$('dormEditBox').classList.add('hidden');});$('dormPasteSave').addEventListener('click',dormPasteSaveV234);$('dormPasteCancel').addEventListener('click',()=>$('dormPasteBox').classList.add('hidden'));$('dormExport').addEventListener('click',dormCsvV234);
 $('dormFOrg').addEventListener('change',()=>{if($('dormFOrg').value==='여생도')$('dormFFemaleRoom').checked=true;});
 $('dormFRoom').addEventListener('input',()=>{const x=$('dormFOrg');if(x.value!=='미분류')return;const a=$('dormFRoom').value.trim().match(/-([1-8]|동|생|명)$/);if(a)x.value=/^[1-8]$/.test(a[1])?a[1]+'중대':'동생명';});
 $('dormImportPdfV235').addEventListener('click',()=>{if(!mustEdit())return;
  $('dormEditBox').classList.add('hidden');$('dormPasteBox').classList.remove('hidden');$('dormPaste').value=DORM_REPORT_TSV_V235;
  alert('75-3차 생활실 편성안 PDF의 명확한 배정·공실 '+(DORM_REPORT_TSV_V235.trim().split('\n').length-1)+'호실을 준비했습니다.\n\n원본 PDF 편성 829명과 판독 인원을 꼭 대조해 주세요. 이름이 세로로 적힌 일부 방은 판독 인원에 오차가 있을 수 있습니다. 조직은 1~8중대 / 전(대)대 / 동생명 기준으로 분류하고, 여생도 여부는 체크로 관리합니다.\n기존에 등록된 호실은 덮어쓰지 않고 건너뜁니다.');
  $('dormPasteBox').scrollIntoView({behavior:'smooth',block:'start'});
 });
 $('dormRoomRows').addEventListener('change',ev=>{
  const count=ev.target.closest('[data-dorm-count]'),outside=ev.target.closest('[data-dorm-outside]');
  const femaleRoom=ev.target.closest('[data-dorm-female-room]'),group=ev.target.closest('[data-dorm-orgselect]');
  if(!count&&!outside&&!femaleRoom&&!group)return;
  const row=ev.target.closest('[data-dorm-id]');if(!row)return;
  const id=row.dataset.dormId;
  if(count){
   const v=Number(count.value);if($('dormVacancy').value)$('dormVacancy').value='';
   dormCommitV234(id,r=>{r.slots.forEach((s,j)=>{s.occupied=j<v;s.female=s.occupied&&!!r.femaleRoom;});r.outsideCount=Math.min(Number(r.outsideCount)||0,v);});
  }else if(outside){
   const v=Number(outside.value);dormCommitV234(id,r=>{r.outsideCount=v;});
  }else if(femaleRoom){
   const checked=femaleRoom.checked;dormCommitV234(id,r=>{r.femaleRoom=checked;r.slots.forEach(s=>{s.female=s.occupied&&checked;});});
  }else if(group){dormCommitV234(id,r=>{r.group=group.value;r.purpose=group.value;if(group.value==='여생도'){r.femaleRoom=true;r.slots.forEach(s=>{s.female=s.occupied;});}});}
 });
 $('dormRoomRows').addEventListener('click',ev=>{const row=ev.target.closest('[data-dorm-id]');if(!row)return;const id=row.dataset.dormId;
  if(ev.target.closest('[data-dorm-empty]')){if(!confirm('입실 인원이 0명임을 확인했나요? 해당 호실을 공실로 확정합니다.'))return;dormCommitV234(id,r=>{r.slots.forEach(s=>{s.occupied=false;s.female=false;});r.outsideCount=0;});}
  else if(ev.target.closest('[data-dorm-delete]')){const room=dormRoomPayloadV234(id);if(!room)return;if(!confirm(room.building+' '+room.room+' 호실을 삭제할까요? 현재 입실자가 있으면 삭제되지 않습니다.'))return;server('deleteDormV234',id,room.updatedAt).then(()=>{dormRoomsV234=dormRoomsV234.filter(x=>x.id!==id);dormRenderV234();}).catch(e=>alert(e.message));}
 });
}

/* v2.44: 생활실 비품 12종 + 사용자 정의 종류, 호실별 실제 재고/상태. */
let assetDataV244=null,assetCurrentRoomV244='',assetDirtyV244=new Set(),assetSavingV244=false,assetOpenGroupsV245=null,assetResetGroupsV245=false;
function assetRecMapV244(){return new Map((assetDataV244?.records||[]).map(r=>[r.roomId+'|'+r.itemId,r]));}
// 한 호실은 정확히 한 그룹에만 포함되어 이중 집계되지 않음.
function assetOrgForRoomV245(r){
 if(String(r.group||'')==='여생도')return '여생도';
 if(r.femaleRoom||/-(여)$/.test(String(r.room)))return '여생도복도';
 if(r.staffRoom)return '전(대)대';
 const g=String(r.group||'').trim();
 if(/^[1-8]중대$/.test(g))return g;
 if(['동생명','동기회','생발위','명예위'].includes(g)||/-(동|생|명)$/.test(String(r.room)))return '동생명';
 if(['전(대)대','전대','대대','전대본부'].includes(g))return '전(대)대';
 const m=String(r.room||'').match(/-([1-8])$/);
 if(m)return m[1]+'중대';
 if(r.corridor==='전대복도'&&!g)return '전(대)대';
 return '미분류';
}
function assetOrgRankV245(v){let i=['1중대','2중대','3중대','4중대','5중대','6중대','7중대','8중대','전(대)대','동생명','여생도','여생도복도','미분류'].indexOf(v);return i<0?100:i;}
function assetBuildingRankV245(v){let i=['정예 본관','정예 동관','정예 서관','별관'].indexOf(v);return i<0?100:i;}
function assetRoomsFilteredV244(){
 if(!assetDataV244)return [];
 const b=$('assetBuildingV244').value,f=$('assetFloorV244').value,c=$('assetCorridorV244').value,o=$('assetOrgV245').value,q=$('assetSearchV244').value.trim().toLowerCase();
 return assetDataV244.rooms.filter(r=>(!b||r.building===b)&&(!f||r.floor===f)&&(!c||r.corridor===c)&&(!o||assetOrgForRoomV245(r)===o)&&(!q||[r.building,r.floor,r.corridor,r.room,r.group,assetOrgForRoomV245(r)].join(' ').toLowerCase().includes(q))).sort((a,b)=>['정예 본관','정예 동관','정예 서관','별관'].indexOf(a.building)-['정예 본관','정예 동관','정예 서관','별관'].indexOf(b.building)||a.floor.localeCompare(b.floor,'ko')||a.corridor.localeCompare(b.corridor,'ko')||a.room.localeCompare(b.room,'ko',{numeric:true}));
}
function assetSetCorridorsV244(){
 if(!assetDataV244)return;
 const b=$('assetBuildingV244').value,f=$('assetFloorV244').value,sel=$('assetCorridorV244'),old=sel.value;
 const all=[...new Set(assetDataV244.rooms.filter(r=>(!b||r.building===b)&&(!f||r.floor===f)).map(r=>r.corridor))].sort((a,b)=>a.localeCompare(b,'ko'));
 sel.innerHTML='<option value="">전체 복도</option>'+all.map(x=>'<option>'+escapeH(x)+'</option>').join('');
 sel.value=all.includes(old)?old:'';
}
const ASSET_STATUSES_V246=['정상','수리 필요(보고)','수리 필요(미보고)','교체 필요'];
function assetStatusForEditV246(rec){
 if(!rec||!rec.confirmed)return '';
 if(ASSET_STATUSES_V246.includes(rec.status))return rec.status;
 return rec.repair>0?'수리 필요(미보고)':'정상';
}
function assetStateV244(rec){
 if(!rec)return {label:'미입력',cls:'unknown',unknown:0};
 const un=Math.max(0,rec.quantity-rec.normal-rec.repair);
 if(un)return {label:un+'개 미점검',cls:'unknown',unknown:un};
 if(rec.status==='수리 필요(보고)')return {label:rec.status,cls:'repair',unknown:0};
 if(rec.status==='수리 필요(미보고)')return {label:rec.status,cls:'repair',unknown:0};
 if(rec.status==='교체 필요')return {label:rec.status,cls:'repair',unknown:0};
 if(rec.status==='정상')return {label:rec.status,cls:'good',unknown:0};
 if(rec.quantity===0)return {label:'없음',cls:'zero',unknown:0};
 if(rec.repair&&rec.normal)return {label:'일부 요수리(기존 기록)',cls:'mixed',unknown:0};
 if(rec.repair)return {label:'수리 필요(미보고)',cls:'repair',unknown:0};
 return {label:'정상',cls:'good',unknown:0};
}
function assetStatusTagV244(s){return '<span class="asset-pill asset-'+s.cls+'">'+escapeH(s.label)+'</span>';}
function assetRenderV244(){
 if(!assetDataV244||!assetDataV244.initialized)return;
 const rooms=assetRoomsFilteredV244(),items=assetDataV244.items,records=assetRecMapV244(),roomSet=new Set(rooms.map(r=>r.id));
 const activeItemIds=new Set(items.map(x=>x.id));const scoped=assetDataV244.records.filter(r=>roomSet.has(r.roomId)&&activeItemIds.has(r.itemId)),total=scoped.reduce((n,r)=>n+r.quantity,0),good=scoped.reduce((n,r)=>n+r.normal,0),repair=scoped.reduce((n,r)=>n+r.repair,0),unknown=total-good-repair;
 const completed=rooms.filter(r=>items.length&&items.every(x=>{const rec=records.get(r.id+'|'+x.id);return rec&&rec.confirmed;})).length;
 $('assetSummaryV244').innerHTML=[['생활실',rooms.length+'호'],['점검 완료 호실',completed+'호'],['기록 수량',total+'개'],['정상 수량',good+'개'],['요수리',repair+'개'],['미점검 수량',unknown+'개']].map(([name,val])=>'<div class="asset-metric"><small>'+name+'</small><strong>'+val+'</strong></div>').join('');
 assetOverviewRenderV327();
 $('assetRoomCountV244').textContent=rooms.length+'개 호실';assetPlanRenderV332();
 const bulkNote=$('assetBulkScopeV245');if(bulkNote)bulkNote.textContent='현재 조회 범위 '+rooms.length+'호 · 일괄처리 시 선택한 품목·자리에 상태를 적용합니다. 세부사항 미입력 시 기존 내용은 보존합니다.';
 // 렌더링 중 기존 편집 DOM이 제거되지 않게 먼저 안전한 위치로 옮김.
 const park=$('assetEditorParkingV245'),editor=$('assetRoomEditorV244');if(park&&editor&&editor.parentElement!==park&&editor.parentElement?.id!=='assetDialogV356')park.appendChild(editor);
 if(assetResetGroupsV245){assetOpenGroupsV245=null;assetResetGroupsV245=false;}else assetRememberOpenGroupsV245();
 const mode=$('assetGroupModeV245').value;
 const mainLabel=mode==='org-building'?r=>assetOrgForRoomV245(r):r=>r.building;
 const subLabel=mode==='org-building'?r=>r.building:r=>assetOrgForRoomV245(r);
 const aRank=mode==='org-building'?assetOrgRankV245:assetBuildingRankV245;
 const bRank=mode==='org-building'?assetBuildingRankV245:assetOrgRankV245;
 const buckets=new Map();
 rooms.forEach(r=>{const main=mainLabel(r),sub=subLabel(r);if(!buckets.has(main))buckets.set(main,new Map());const second=buckets.get(main);if(!second.has(sub))second.set(sub,[]);second.get(sub).push(r);});
 const mainNames=[...buckets.keys()].sort((x,y)=>aRank(x)-aRank(y)||x.localeCompare(y,'ko'));
 $('assetRoomRowsV244').innerHTML=rooms.length?mainNames.map((main,idx)=>{
  const inside=buckets.get(main),subNames=[...inside.keys()].sort((x,y)=>bRank(x)-bRank(y)||x.localeCompare(y,'ko'));
  const count=subNames.reduce((n,k)=>n+inside.get(k).length,0),mainKey='main:'+mode+':'+main;
  const mainOpen=assetOpenGroupsV245?.has(mainKey)||false;
  return '<details class="asset-group" data-asset-group-key="'+escapeH(mainKey)+'" '+(mainOpen?'open':'')+'><summary><span>'+escapeH(main)+'</span><span class="asset-group-note">'+count+'호 · '+subNames.length+'개 구분</span></summary><div class="asset-group-body">'+subNames.map((sub,j)=>{
   const list=inside.get(sub),subKey='sub:'+mode+':'+main+':'+sub;
   const subOpen=assetOpenGroupsV245?.has(subKey)||false;
   return '<details class="asset-group" data-asset-group-key="'+escapeH(subKey)+'" '+(subOpen?'open':'')+'><summary><span>'+escapeH(sub)+'</span><span class="asset-group-note">'+list.length+'호</span></summary><div class="asset-group-body eq-scroll"><table class="asset-table"><thead><tr><th>층</th><th>복도</th><th>호실</th><th>점검완료</th><th>기록 수량</th><th>요수리</th><th>관리</th></tr></thead><tbody>'+list.map(r=>{
     const a=items.map(x=>records.get(r.id+'|'+x.id)).filter(Boolean),verified=a.filter(x=>x.confirmed).length,bad=a.reduce((n,x)=>n+x.repair,0),qty=a.reduce((n,x)=>n+x.quantity,0);
     return '<tr data-asset-room-row="'+escapeH(r.id)+'" class="'+(r.id===assetCurrentRoomV244?'asset-row-open':'')+'"><td>'+escapeH(r.floor)+'</td><td>'+escapeH(r.corridor)+'</td><td><b>'+escapeH(r.room)+'</b></td><td>'+verified+' / '+items.length+'종</td><td>'+qty+'개</td><td class="asset-bad-text">'+bad+'개</td><td><button class="btn btn-soft" type="button" data-asset-room="'+escapeH(r.id)+'" aria-expanded="'+(r.id===assetCurrentRoomV244?'true':'false')+'">'+(r.id===assetCurrentRoomV244?'접기':'점검 / 수정')+'</button></td></tr><tr data-asset-inline-for="'+escapeH(r.id)+'" class="asset-inline-detail hidden"><td colspan="7"><div data-asset-inline-slot="'+escapeH(r.id)+'"></div></td></tr>';
   }).join('')+'</tbody></table></div></details>';
  }).join('')+'</div></details>';
 }).join(''):'<p class="asset-tip">선택한 조건에 해당하는 생활실이 없습니다. 필터를 조정하거나 생활실 인원 현황에서 호실을 등록해 주세요.</p>';
 // 저장 후 같은 호실을 다시 표시. 비표시 조건에 걸리면 편집기를 안전하게 접음.
 if(assetCurrentRoomV244&&rooms.some(r=>r.id===assetCurrentRoomV244))assetMountEditorV245(assetCurrentRoomV244);
 else if(assetCurrentRoomV244&&!assetDirtyV244.size){assetCurrentRoomV244='';editor.classList.add('hidden');}
 $('assetSheetV244').href=assetDataV244.recordsUrl||'#';$('assetKindsV244').href=assetDataV244.catalogUrl||'#';
 qsa('.asset-owner').forEach(el=>el.classList.toggle('hidden',!canEdit));
 if(assetCurrentRoomV244&&!rooms.some(x=>x.id===assetCurrentRoomV244)){
  // 필터를 바꿔도 입력 폼은 함부로 삭제하지 않음.
 }
}
function assetRememberOpenGroupsV245(){
 const container=$('assetRoomRowsV244');
 const details=qsa('[data-asset-group-key]',container);
 if(!details.length)return;
 assetOpenGroupsV245=new Set(details.filter(x=>x.open).map(x=>x.dataset.assetGroupKey));
}
function assetMountEditorV245(id){
 const dialog=assetDialogV356();dialog.appendChild($('assetRoomEditorV244'));$('assetRoomEditorV244').classList.remove('hidden');
 if(!dialog.open)dialog.showModal();return true;
}
function assetCloseRoomV245(){
 if(assetSavingV244)return toast('저장 중입니다. 잠시 기다려 주세요.');
 if(assetDirtyV244.size&&!confirm('저장하지 않은 비품 수정을 버리고 닫을까요?'))return;
 assetDirtyV244.clear();assetCurrentRoomV244='';
 const dialog=$('assetDialogV356');if(dialog?.open)dialog.close();
 $('assetRoomEditorV244').classList.add('hidden');$('assetEditorParkingV245').appendChild($('assetRoomEditorV244'));
 qsa('[data-asset-inline-for]',$('assetRoomRowsV244')).forEach(x=>x.classList.add('hidden'));
 qsa('[data-asset-room-row]',$('assetRoomRowsV244')).forEach(x=>x.classList.remove('asset-row-open'));
 qsa('[data-asset-room]',$('assetRoomRowsV244')).forEach(b=>{b.textContent='점검 / 수정';b.setAttribute('aria-expanded','false');});
}
function assetEditorSnapshotV244(row){
 return JSON.stringify(qsa('[data-asset-position]',row).map(card=>({position:card.dataset.assetPosition,status:card.querySelector('[data-seat-status]').value,details:card.querySelector('[data-seat-details]').value,unavailable:card.querySelector('[data-seat-unavailable]').checked})));
}
function assetRoomTitleV244(room){return [room.building,room.floor,room.corridor,room.room+'호'].join(' · ');}
function assetOpenRoomV244(id){
 if(assetSavingV244&&id!==assetCurrentRoomV244)return;
 if(assetDirtyV244.size&&id!==assetCurrentRoomV244&&!confirm('저장하지 않은 변경을 버리고 다른 호실을 열까요?'))return;
 const room=assetDataV244?.rooms.find(x=>x.id===id);if(!room)return;
 assetCurrentRoomV244=id;assetDirtyV244.clear();$('assetRoomTitleV244').textContent=assetRoomTitleV244(room);
 const recs=assetRecMapV244(),readonly=canEdit?'':'disabled';
 $('assetEditRowsV244').innerHTML=assetDataV244.items.map(item=>{
  const r=recs.get(id+'|'+item.id),positions=item.positions||['common'];
  const legacy=r&&!r.slots?'<details class="asset-legacy-note"><summary>기존 합산 기록 보기</summary><p>'+escapeH(r.status||'미점검')+' · 정상 '+r.normal+' / 요수리 '+r.repair+'개\n'+escapeH(r.details||'')+'\n자리별 상태는 확인 후 선택해 주세요.</p></details>':'';
  const cards=positions.map(position=>{
   const s=r?.slots?.find(x=>x.position===position)||{status:'',details:'',unavailable:false};
   const label=escapeH(item.name+' '+(position==='common'?'공용':position+'번'));
   return '<div class="asset-seat-card" data-asset-position="'+position+'"><strong>'+ (position==='common'?'공용':position+'번')+'</strong><select class="field" aria-label="'+label+' 상태" data-seat-status '+readonly+'><option value="">미점검</option>'+ASSET_STATUSES_V246.map(status=>'<option value="'+escapeH(status)+'" '+(s.status===status?'selected':'')+'>'+escapeH(status)+'</option>').join('')+'</select><textarea class="field" aria-label="'+label+' 세부사항" data-seat-details maxlength="500" rows="1" placeholder="세부사항" '+readonly+'>'+escapeH(s.details)+'</textarea><label class="asset-unavailable"><input type="checkbox" aria-label="'+label+' 사용불가" data-seat-unavailable '+(s.unavailable?'checked':'')+' '+readonly+'>사용불가</label></div>';
  }).join('');
  return '<tr data-asset-item="'+escapeH(item.id)+'"><td><strong>'+escapeH(item.name)+'</strong></td><td>'+legacy+'<div class="asset-seat-grid">'+cards+'</div></td><td><button type="button" class="btn btn-soft asset-owner" data-asset-save="'+escapeH(item.id)+'" '+readonly+'>저장</button></td></tr>';
 }).join('');
 qsa('[data-asset-item]',$('assetEditRowsV244')).forEach(row=>row.dataset.assetInitial=assetEditorSnapshotV244(row));
 $('assetEditHelpV244').textContent='각 자리 또는 공용품목의 상태·세부사항·사용불가를 입력한 뒤 저장하세요. 미선택 자리는 미점검으로 남습니다.';
 assetMountEditorV245(id);
}
function assetRowFromFormV244(row){
 const slots=JSON.parse(assetEditorSnapshotV244(row));
 for(const s of slots){if(s.status&&!ASSET_STATUSES_V246.includes(s.status))throw Error('비품 상태를 확인하세요.');if(s.details.length>500)throw Error('세부사항은 자리별 500자 이내로 입력하세요.');}
 const prev=assetRecMapV244().get(assetCurrentRoomV244+'|'+row.dataset.assetItem);
 return {itemId:row.dataset.assetItem,slots,expectedUpdatedAt:prev?.updatedAt||''};
}
function assetRefreshEditStateV244(row,event){
 const changed=assetEditorSnapshotV244(row)!==row.dataset.assetInitial;
 row.classList.toggle('asset-edited',changed);
 if(changed)assetDirtyV244.add(row.dataset.assetItem);else assetDirtyV244.delete(row.dataset.assetItem);
 $('assetEditHelpV244').textContent=assetDirtyV244.size?assetDirtyV244.size+'종 수정 중 · 저장 전에는 시트에 반영되지 않습니다.':'변경사항 없음';
}
async function assetSaveChangesV244(itemId){
 if(assetSavingV244||!mustEdit())return;
 const rows=qsa('[data-asset-item]',$('assetEditRowsV244')).filter(row=>assetDirtyV244.has(row.dataset.assetItem));
 if(!rows.length){toast('변경한 품목이 없습니다.');return;}
 let changes;
 try{changes=rows.map(assetRowFromFormV244);}catch(e){return alert(e.message);}
 assetSavingV244=true;$('assetSaveRoomV244').disabled=true;$('assetEditHelpV244').textContent='Google Sheets에 저장 중...';
 try{
  await enqueue(()=>server('saveDormInventoryRoomV244',assetCurrentRoomV244,changes));
  const fresh=await server('getDormInventoryV244');assetDataV244=fresh;
  assetDirtyV244.clear();assetRenderV244();assetOpenRoomV244(assetCurrentRoomV244);
  toast(changes.length+'종 비품 수량·상태·세부사항 저장 완료');
 }catch(e){alert('비품 저장 실패: '+e.message+'\n저장 전에 다른 사용자에게 수정되었다면 새로고침 후 다시 시도해 주세요.');}
 finally{assetSavingV244=false;$('assetSaveRoomV244').disabled=false;}
}
async function assetLoadV244(){
 const status=$('assetStatusV244');
 const show=message=>{status.textContent=message;status.classList.remove('hidden');};
 if(!ready){show('Google Sheets 연결을 기다리고 있습니다. 잠시 후 다시 열거나 상단의 새로고침을 눌러 주세요.');return;}
 show('등록된 생활실과 비품 목록을 불러오는 중입니다...');
 $('assetRoomCountV244').textContent='자료 불러오는 중...';
 try{
  assetDataV244=await server('getDormInventoryV244');$('assetResetV313').classList.toggle('hidden',!canManageUsersV281);
  if(!assetDataV244||!Array.isArray(assetDataV244.rooms)||!Array.isArray(assetDataV244.items))throw Error('서버에서 비품 자료를 가져오지 못했습니다. Code.gs를 같은 ZIP의 파일로 교체했는지 확인해 주세요.');
  $('assetSetupV244').classList.toggle('hidden',assetDataV244.initialized||!canEdit);
  $('assetActiveV244').classList.toggle('hidden',!assetDataV244.initialized);
  if(!assetDataV244.initialized){
   show(canEdit?'최초 설정이 필요합니다. 아래 「기본 비품 12종 등록 · 사용 시작」 버튼을 눌러 주세요. 기존 생활실 데이터는 삭제되지 않습니다.':'비품 관리 최초 설정 전입니다. 군수계 관리 계정에서 「기본 비품 12종 등록」을 먼저 실행해야 합니다.');
   $('assetRoomCountV244').textContent='비품 관리 최초 설정 필요';return;
  }
  assetSetCorridorsV244();
  const kindSelect=$('assetBulkKindV246'),selected=kindSelect.value;
  kindSelect.innerHTML='<option value="ALL">전체 품목 (등록된 '+assetDataV244.items.length+'종)</option>'+assetDataV244.items.map(x=>'<option value="'+escapeH(x.id)+'">'+escapeH(x.name)+'</option>').join('');
  kindSelect.value=assetDataV244.items.some(x=>x.id===selected)||selected==='ALL'?selected:'ALL';
  assetRenderV244();
  if(!assetDataV244.rooms.length){show('비품 품목은 준비됐지만 생활실 목록이 비어 있습니다. 「시설 → 생활실 인원 현황」에서 호실을 먼저 등록해 주세요.');}
  else{show('연결 완료 · '+assetDataV244.rooms.length+'개 호실 · '+assetDataV244.items.length+'종 비품을 조회할 수 있습니다.');}
  if(assetCurrentRoomV244&&!assetDirtyV244.size&&assetDataV244.rooms.some(r=>r.id===assetCurrentRoomV244))assetOpenRoomV244(assetCurrentRoomV244);
 }catch(e){
  const message=String(e?.message||e);
  const hint=/not found|Script function|not a function|찾을 수 없|존재하지 않/i.test(message)?'Index.html만 교체했을 수 있습니다. ZIP의 Code.gs.txt도 전체 교체하고 저장한 뒤 /dev를 새로고침하세요. ':'';
  show('생활실 비품 연결 실패: '+hint+message);
  $('assetRoomCountV244').textContent='불러오기 실패';
  $('assetSetupV244').classList.add('hidden');$('assetActiveV244').classList.add('hidden');
 }
}
async function assetApplyBulkV313(){
 if(assetSavingV244||!mustEdit()||!assetDataV244?.initialized)return;
 if(assetDirtyV244.size)return alert('수정 중인 호실을 먼저 저장하거나 닫아 주세요.');
 const rooms=assetRoomsFilteredV244(),itemId=$('assetBulkKindV246').value||'ALL';
 const options={itemId,status:$('assetBulkStatusV246').value,position:$('assetBulkPositionV313').value,unavailable:$('assetBulkUnavailableV313').value,details:$('assetBulkDetailV246').value.trim(),includeMissing:$('assetBulkFillMissingV246').checked};
 if(!rooms.length)return alert('조회 범위에 호실이 없습니다.');
 if(!ASSET_STATUSES_V246.includes(options.status)||options.details.length>500)return alert('상태와 세부사항을 확인하세요.');
 const targets=itemId==='ALL'?assetDataV244.items:assetDataV244.items.filter(x=>x.id===itemId);
 const recs=assetRecMapV244(),snapshot=[];let slots=0;
 rooms.forEach(room=>targets.forEach(item=>{const positions=item.positions||['common'];if(options.position!=='all'&&!positions.includes(options.position))return;
  const key=room.id+'|'+item.id,rec=recs.get(key);if(rec)snapshot.push([key,rec.updatedAt||'']);if(rec||options.includeMissing)slots+=options.position==='all'?positions.length:1;
 }));
 if(!slots)return alert('선택 범위와 자리에 해당하는 비품이 없습니다.');
 const place=$('assetBulkPositionV313').selectedOptions[0].textContent,unavailable=$('assetBulkUnavailableV313').selectedOptions[0].textContent;
 if(!confirm('현재 조회 범위 '+rooms.length+'호 · '+slots+'개 자리/공용 비품에 적용합니다.\n품목: '+(itemId==='ALL'?'전체 품목':targets[0].name)+'\n자리: '+place+'\n상태: '+options.status+'\n사용불가: '+unavailable+'\n세부사항: '+(options.details?'입력한 내용으로 변경':'기존 내용 유지')+'\n\n선택하지 않은 자리와 조회 범위 밖의 호실은 유지됩니다. 적용할까요?'))return;
 assetSavingV244=true;['assetBulkApplyV246','assetBulkNormalV246'].forEach(id=>$(id).disabled=true);
 try{const result=await enqueue(()=>server('bulkSetDormInventoryScopeV246',rooms.map(x=>x.id),options,snapshot));await assetLoadV244();toast('일괄 입력 완료 · 수정 '+result.updated+'건 / 신규 '+result.created+'건');}
 catch(e){alert('일괄 입력 실패: '+e.message);}
 finally{assetSavingV244=false;['assetBulkApplyV246','assetBulkNormalV246'].forEach(id=>$(id).disabled=false);}
}
async function assetResetRecordsV313(){
 if(assetSavingV244||!canManageUsersV281)return;
 if(assetDirtyV244.size)return alert('입력 중인 변경사항을 저장하거나 닫은 뒤 실행하세요.');
 const button=$('assetResetV313');button.disabled=true;
 try{
  const preview=await server('getDormInventoryResetV313');
  if(!preview.records)return toast('초기화할 점검 기록이 없습니다.');
  if(!confirm('생활실 비품 점검 기록 '+preview.records+'건을 모두 초기화할까요?\n상태·세부사항·사용불가 체크가 삭제됩니다.\n품목 목록과 생활실 목록은 유지하고 원본 점검 기록은 백업 시트로 보관합니다.'))return;
  assetSavingV244=true;
  const result=await enqueue(()=>server('clearDormInventoryRecordsV313',preview.token));
  assetCurrentRoomV244='';assetDirtyV244.clear();await assetLoadV244();
  alert('점검 기록 '+result.removed+'건 초기화 완료\n백업: '+(result.backup||'해당 없음'));
 }catch(e){alert('초기화 실패: '+e.message);}
 finally{assetSavingV244=false;button.disabled=false;}
}

function assetFilterChangeV245(e,resetCorridor){
 const field=e.currentTarget;
 if(assetDirtyV244.size){
  if(!confirm('점검 중인 호실에 저장하지 않은 수정이 있습니다. 변경을 버리고 조회 조건을 바꿀까요?')){
   field.value=field.dataset.assetLastValue||'';return;
  }
  assetDirtyV244.clear();assetCurrentRoomV244='';
 }
 field.dataset.assetLastValue=field.value;
 if(resetCorridor){assetSetCorridorsV244();$('assetCorridorV244').dataset.assetLastValue=$('assetCorridorV244').value;}
 assetResetGroupsV245=true;assetRenderV244();
}
function assetInitV244(){
 $('assetPlanV332').addEventListener('click',e=>{const b=e.target.closest('[data-asset-plan-room]');if(b)assetPlanJumpV332(b.dataset.assetPlanRoom,b.dataset.assetPlanItem||'',b.dataset.assetPlanPosition||'');});
 $('assetOverviewModeV327').addEventListener('change',()=>assetOverviewChooseV328($('assetOverviewModeV327').value));
 qsa('[data-asset-overview-mode]').forEach(input=>input.addEventListener('change',()=>assetOverviewChooseV328(input.value)));
 $('assetKindRowsV244').addEventListener('click',e=>{const button=e.target.closest('[data-asset-overview-toggle]');if(!button)return;const detail=$('assetOverviewDetailV327_'+button.dataset.assetOverviewToggle);detail.hidden=!detail.hidden;button.setAttribute('aria-expanded',String(!detail.hidden));});
 $('assetResetV313').addEventListener('click',assetResetRecordsV313);
 ['assetBuildingV244','assetFloorV244','assetCorridorV244','assetOrgV245','assetGroupModeV245','assetSearchV244'].forEach(id=>{
  const field=$(id);field.dataset.assetLastValue=field.value;
  field.addEventListener(id==='assetSearchV244'?'input':'change',e=>assetFilterChangeV245(e,id==='assetBuildingV244'||id==='assetFloorV244'));
 });
 $('assetReloadV244').addEventListener('click',()=>{if(assetDirtyV244.size&&!confirm('저장하지 않은 수정을 버리고 새로고침할까요?'))return;assetDirtyV244.clear();assetLoadV244();});
 $('assetSetupBtnV244').addEventListener('click',async()=>{
  if(!mustEdit())return;
  try{await enqueue(()=>server('setupDormInventoryV244'));await assetLoadV244();toast('생활실 비품 12종 설정 완료');}catch(e){alert(e.message);}
 });
 $('assetKindRowsV244').addEventListener('click',async(e)=>{
  const b=e.target.closest('[data-asset-hide]');if(!b||!mustEdit())return;
  const item=assetDataV244?.items?.find(t=>t.id===b.dataset.assetHide);if(!item)return;
  const used=assetDataV244.records.filter(x=>x.itemId===item.id).length;
  if(!confirm('「'+item.name+'」 품목을 목록에서 숨길까요?\n점검 기록 '+used+'건은 삭제되지 않으며 「삭제 품목 복구」에서 되돌릴 수 있습니다.'))return;
  try{await enqueue(()=>server('setDormInventoryItemActiveV247',item.id,false));await assetLoadV244();toast('품목 숨김 완료');}catch(err){alert('품목 삭제 실패: '+err.message);}
 });
 $('assetRestoreKindV247').addEventListener('click',async()=>{
  if(!mustEdit())return;
  try{const list=await server('getInactiveDormInventoryItemsV247');
   if(!list.length)return alert('삭제된 품목이 없습니다.');
   const choice=prompt('복구할 번호를 입력하세요.\n'+list.map((x,i)=>(i+1)+'. '+x.name).join('\n'),'1');
   if(choice===null)return;const idx=Number(choice)-1;if(!Number.isInteger(idx)||idx<0||idx>=list.length)return alert('번호를 확인하세요.');
   if(!confirm('「'+list[idx].name+'」을(를) 다시 품목 목록에 표시할까요? 이전 점검 기록도 다시 조회됩니다.'))return;
   await enqueue(()=>server('setDormInventoryItemActiveV247',list[idx].id,true));await assetLoadV244();toast('품목 복구 완료');
  }catch(err){alert('품목 복구 실패: '+err.message);}
 });
 $('assetAddKindV244').addEventListener('click',async()=>{
  if(!mustEdit())return;
  const name=prompt('추가할 비품 종류 이름');if(name===null)return;
  if(!name.trim())return alert('비품명을 입력하세요.');
  const qtyStr=prompt('참고 수량 (0~100, 실제 수량 아님)','1');if(qtyStr===null)return;
  const qty=Number(qtyStr);if(!Number.isInteger(qty)||qty<0||qty>100)return alert('참고 수량은 0~100 정수로 입력하세요.');
  if(assetDirtyV244.size&&!confirm('저장하지 않은 수정이 있습니다. 버리고 종류를 추가할까요?'))return;
  try{await enqueue(()=>server('addDormInventoryItemV244',name,qty,'개'));assetDirtyV244.clear();await assetLoadV244();toast('새 비품 종류 추가 완료');}catch(e){alert('품목 추가 실패: '+e.message);}
 });
 $('assetRoomRowsV244').addEventListener('click',e=>{const b=e.target.closest('[data-asset-room]');if(!b)return;if(assetCurrentRoomV244===b.dataset.assetRoom){assetCloseRoomV245();return;}assetOpenRoomV244(b.dataset.assetRoom);});
 ['input','change'].forEach(eventName=>$('assetEditRowsV244').addEventListener(eventName,e=>{const r=e.target.closest('[data-asset-item]');if(r)assetRefreshEditStateV244(r,e);}));
 $('assetEditRowsV244').addEventListener('click',e=>{const b=e.target.closest('[data-asset-save]');if(!b)return;const row=b.closest('[data-asset-item]');if(row&&assetDirtyV244.has(row.dataset.assetItem))assetSaveChangesV244();else toast('변경한 수량이 없습니다.');});
 $('assetSaveRoomV244').addEventListener('click',()=>assetSaveChangesV244());
 $('assetCloseRoomV244').addEventListener('click',assetCloseRoomV245);
 async function applyInventoryBulkV246(){await assetApplyBulkV313();}
 $('assetBulkApplyV246').addEventListener('click',applyInventoryBulkV246);
 $('assetBulkNormalV246').addEventListener('click',()=>{
  $('assetBulkPositionV313').value='all';$('assetBulkUnavailableV313').value='keep';$('assetBulkKindV246').value='ALL';$('assetBulkStatusV246').value='정상';$('assetBulkQtyV246').value='2';$('assetBulkDetailV246').value='';
  applyInventoryBulkV246();
 });
 $('assetCsvV244').addEventListener('click',()=>{
  if(!assetDataV244)return;
  const rows=assetRoomsFilteredV244();
  const body=[['관','층','복도','호실','품목','실제수량','정상수량','요수리수량','미점검수량','상태','세부사항']];
  const recordMap=assetRecMapV244();
  rows.forEach(room=>assetDataV244.items.forEach(kind=>{
   const rec=recordMap.get(room.id+'|'+kind.id);
   body.push([room.building,room.floor,room.corridor,room.room,kind.name,rec?rec.quantity:'',rec?rec.normal:'',rec?rec.repair:'',rec?rec.quantity-rec.normal-rec.repair:'',assetStateV244(rec).label,rec?.details||'']);
  }));
  download(new Blob(['\ufeff'+body.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'생활실_비품현황_'+localISO()+'.csv');
 });
}

trainInitV227();

// v2.89: 훈련 전용 파일에는 미래 메뉴의 데이터만, 업무일지는 기존 업무기록을 공용으로 사용합니다.
let trainFoundationLoadingV289=false;
async function trainFoundationLoadV289(){
 if(trainFoundationLoadingV289)return;
 const area=$('trainFoundationStatusV289');if(!area)return;
 trainFoundationLoadingV289=true;
 area.textContent='훈련 파일 상태 확인 중…';
 try{
  const s=await server('getTrainFoundationV289');
  area.textContent=s.created?'훈련 전용 파일이 준비되어 있습니다. 업무일지 기록은 일반학기와 공용입니다.':'훈련 전용 파일은 아직 생성되지 않았습니다. 업무일지는 지금부터 일반학기와 함께 사용할 수 있습니다.';
  $('trainFoundationCreateV289').classList.toggle('hidden',s.created||!s.canCreate);
  const link=$('trainFoundationLinkV289');link.classList.toggle('hidden',!s.url);if(s.url)link.href=s.url;
 }catch(e){area.textContent='훈련 파일 조회 실패: '+e.message+' · 업무일지 공유 기능에는 영향을 주지 않습니다.';}
 finally{trainFoundationLoadingV289=false;}
}
function trainFoundationOpenJournalV289(){switchView('trainJournal');}
async function trainFoundationSetupV289(){
 if(!canManageUsersV281)return alert('훈련 전용 파일 생성은 최고 관리자 전용입니다.');
 const btn=$('trainFoundationCreateV289');btn.disabled=true;
 try{
  const result=await enqueue(()=>server('setupTrainFoundationV289'));
  toast(result.already?'이미 준비된 훈련 파일을 확인했습니다.':'훈련용 스프레드시트 파일을 만들었습니다.');
  await trainFoundationLoadV289();
 }catch(e){alert('훈련 전용 파일 생성 실패: '+e.message+'\nGoogle 계정 권한을 확인해 주세요.');}
 finally{btn.disabled=false;}
}
$('trainFoundationOpenJournalV289').addEventListener('click',trainFoundationOpenJournalV289);
$('trainFoundationCreateV289').addEventListener('click',trainFoundationSetupV289);
$('trainFoundationRefreshV289').addEventListener('click',trainFoundationLoadV289);



// v2.59 · 사역 계산. 읽기 전용 조회, 독방 수동 배정만 선택 시 관리자 설정에 저장.
let laborResultV259=null,laborLoadingV259=false;
function laborFmtV259(n){if(n===null||n===undefined||!Number.isFinite(Number(n)))return '—';return Number(n).toLocaleString('ko-KR',{maximumFractionDigits:3});}
function laborCompanyLabelV261(v){return String(v||'').replace(/(?:중대)+$/,'')+'중대';}
// 총원(B8)은 호실 미배정 인원도 포함하므로 분배 방식은 중대별로만 고정합니다.
let laborFlexibleDimV262='company';
function laborSyncDimensionV262_(){
 const mode=$('laborModeV259').value,sel=$('laborDimV259');
 const locked=true;$('laborByBuildingV357').checked=mode!=='total';
 $('laborByBuildingV357').disabled=mode==='total';if(mode==='total')$('laborByBuildingV357').checked=false;
 if(locked){
  if(!sel.disabled)laborFlexibleDimV262=sel.value;
  sel.value=mode==='total'?'company':'building';
 }else if(sel.disabled){
  sel.value=laborFlexibleDimV262;
 }
 sel.disabled=locked;
 sel.title=$('laborByBuildingV357').checked?'관별 지급 기준 적용 중':locked?'총인원은 생활실 미배정자를 포함하여 중대별로만 분배합니다.':'';
 laborSelectionSummaryV263();
 laborBuildingVisibilityV357();$('laborDimLockV262').textContent=$('laborByBuildingV357').checked?'관을 펼쳐 지급 기준·분배 단위를 선택하세요.':locked?
  '총인원: 방 미배정자 포함 · 분배 방식 중대별 고정 · 각 중대 B8(학년 선택 시 B4:B7) 사용':
  '현재·전체 인원: 중대별 / 관별 / 층별 중 선택 가능 · 최신 생활실 배정 위치 반영';
}
function laborSelectionSummaryV263(){
 const ratio=laborBuildingInputV357()?Object.entries(laborBuildingInputV357()).map(([b,d])=>b+' '+d+'인 1개').join(' · '):$('laborDivisorV259').selectedOptions[0]?.textContent||'2인 1개';
 const grade=$('laborGradeV261').selectedOptions[0]?.textContent||'전학년';
 const mode=$('laborModeV259').selectedOptions[0]?.textContent?.split(' (')[0]||'전체 인원';
 const dim=$('laborDimV259').selectedOptions[0]?.textContent?.split(' (')[0]||'중대별';
 $('laborSelectionSummaryV263').textContent=[ratio,grade,mode,dim].join(' / ');
}
function laborShortV259(k){const p=(laborResultV259?.pairs?.singles||[]).find(x=>x.key===k);return p?[p.cohort,laborCompanyLabelV261(p.company),p.name,p.building,p.room].join(' · '):k;}
function laborShowV259(result){
 laborBuildingRenderV357(result);
 laborResultV259=result;$('laborDraftOpenV264').disabled=!canEdit;
 const groups=result.groups||[];const denom=laborPairDivisorV357(result);
 if(result.dimensionLocked){$('laborDimV259').value='company';$('laborDimV259').disabled=true;}
 $('laborLivingSourceLinkV262').href=result.livingSourceUrl||$('laborLivingSourceLinkV262').href;
 $('laborNoticeV259').textContent=result.notice+'  |  스마트당직: '+result.source+' · '+result.smartRoster+'명 · B8 합계 '+(result.hasB8?result.officialTotal+'명':'미연결')+' · 생활실 배정명단에서 스마트당직 미대조 '+result.residenceUnmatched+'명 · 사역 대상 중 호실 미확인 '+(result.unlocatedSmart||0)+'명';
 const total=groups.reduce((a,g)=>a+Number(g.count||0),0);
 const pairs=result.pairs||{singles:[],pairs:[],unpaired:[]};
 const singles=pairs.singles||[];
 $('laborPairControlsV263').classList.toggle('is-ratio-one',denom===1);
 $('laborAutoAssignV269').disabled=!canEdit||denom===1||laborPairSavingV264;
 $('laborPairSummaryV259').textContent=denom===1?
  '실제 독방 '+singles.length+'명 · 1인 1개 기준은 짝 배정 없이 각자 계산합니다.':
  '실제 독방 '+singles.length+'명 · 계산 대상 '+(pairs.activeCount||0)+'명 · 같은 관 내 가상 2인실 '+(pairs.pairs||[]).length+'개 · 미지정 '+(pairs.unpaired||[]).length+'명 · 생활실 명단 불일치 '+(pairs.roomCountWarnings||0)+'곳';
 $('laborPairPickStatusV264').textContent=denom===1?'1인 1개: 짝 지정이 필요하지 않습니다.':'';
 laborPairPopupV268=null;
 const people=new Map(singles.map(p=>[p.key,p]));
 const displayName=k=>{const p=people.get(k);return p?escapeH(String(p.cohort||'').normalize('NFKC').replace(/기$/,'')+'기 · '+laborCompanyLabelV261(p.company)+' · '+p.name):escapeH(k);};
 const groupsByBuilding=new Map();
 const placeRow=(building,rec)=>{if(!groupsByBuilding.has(building))groupsByBuilding.set(building,[]);groupsByBuilding.get(building).push(rec);};
 (pairs.pairs||[]).forEach(pair=>{
   const a=people.get(pair.a),b=people.get(pair.b);
   if(a&&b)placeRow(a.building,{a:pair.a,b:pair.b,source:pair.source});
 });
 (pairs.unpaired||[]).forEach(k=>{const p=people.get(k);if(p)placeRow(p.building,{a:k,b:'',source:'미지정'});});
 const button=(key,side,editable,blank)=>editable?
   '<button class="labor-member-choice-v268 '+(blank?'is-blank':'')+'" type="button" data-pair-edit="'+side+'" aria-expanded="false">'+(blank?'미지정 ＋':displayName(key)+' <span class="labor-chevron-v268">⌄</span>')+'</button>':
   '<span class="labor-member-fixed-v268">'+(blank?'미지정':displayName(key))+'</span>';
 const section=[...groupsByBuilding.entries()].sort((x,y)=>x[0].localeCompare(y[0],'ko')).map(([building,rows])=>{
  const nPairs=rows.filter(r=>r.b).length;
  return '<section class="labor-building-v268"><h3 class="labor-building-title-v268">'+escapeH(building)+' <small>배정 '+nPairs+'실 · 미지정 '+(rows.length-nPairs)+'명</small></h3>'+
  '<div class="labor-pair-table-scroll-v268"><table class="labor-pair-table-v268"><thead><tr><th>생도 A</th><th>생도 B</th><th>가상 생활실</th></tr></thead><tbody>'+
  rows.map(row=>'<tr data-pair-row-a="'+escapeH(row.a)+'" data-pair-row-b="'+escapeH(row.b)+'" data-pair-row-building="'+escapeH(building)+'">'+
   '<td class="labor-pair-cell-v268">'+button(row.a,'a',canEdit&&denom!==1,false)+'</td>'+
   '<td class="labor-pair-cell-v268">'+button(row.b,'b',canEdit&&denom!==1,!row.b)+'</td>'+
   '<td><span class="labor-unit-badge-v268 '+(row.b?'is-paired':'is-open')+'">'+(row.b?'1실 (2명)':'미지정 (1명)')+'</span>'+(row.b&&row.source==='직접 지정'?'<small class="labor-pair-source-v268">직접 지정</small>':'')+'</td></tr>').join('')+
  '</tbody></table></div></section>';
 }).join('');
 $('laborPairListV259').innerHTML=denom===1?'<p class="help">1인 1개에서는 모든 실제 독방을 개별 단위로 계산하므로 짝을 편집하지 않습니다.</p>':
  (section||'<p class="help">지금 계산에 포함된 독방 생도가 없습니다.</p>')+
  '<p class="labor-pair-instructions-v266">이름 또는 미지정을 누르면 해당 생도의 짝 선택창이 열리고, <b>해당 관에 거주하는 생도만</b> 선택됩니다. 기존 짝에서 빠진 생도는 미지정 행이 생기고, 새 짝을 만든 생도의 기존 미지정 행은 없어집니다. 같은 관이면 다른 층·중대도 선택할 수 있습니다.</p>';
 if(denom!==1&&result.mode==='total')$('laborPairPickStatusV264').textContent+=' 총인원(B8) 방식은 공식 중대별 인원으로 계산하므로 가상 생활실 조정은 수량 분배에 적용하지 않습니다.';
 laborSummaryV324(result);
 // v2.97 · independent roster drill-down for room unconfirmed, smart mismatch and solo-unpaired.
 laborRenderReviewV297(result);
 $('laborTableV259').innerHTML=groups.map(g=>'<tr><td><strong>'+escapeH(g.label)+'</strong>'+(result.buildingDivisors?'<small class="labor-virtual-count-v268">'+g.divisor+'인 1개</small>':'')+(g.key==='호실 미확인'?' <button type="button" class="labor-review-inline-v297" data-review-open="missingRoom">명단</button>':'')+'</td><td>'+laborFmtV259(g.count)+'명'+(g.allocationCount!==undefined&&g.allocationCount!==g.count?'<small class="labor-virtual-count-v268">짝 반영 '+laborFmtV259(g.allocationCount)+'명분</small>':'')+'</td><td class="labor-quantity-v324"><b>'+laborFmtV259(g.quota)+'</b><span>개</span></td><td class="labor-how-v324">'+escapeH(laborExplanationV324(g,g.divisor||denom))+'</td></tr>').join('')||'<tr><td colspan="4">대상 없음</td></tr>';
 const virtualTransfers=groups.reduce((s,g)=>s+Math.max(0,Number(g.count)-Number(g.allocationCount??g.count)),0);
 if(virtualTransfers)$('laborNoticeV259').textContent+=' · 다른 중대·층 또는 관 내 조직구분 사이에 짝을 지정한 경우 가상 생활실의 대표 생도 소속으로 '+virtualTransfers+'명분이 이동하여 계산됩니다.';

laborCardsDistributePairsV375(result);
}
const LABOR_REVIEW_V297=[
 ['missingRoom','호실 미확인'],
 ['unmatchedResident','스마트당직 미대조'],
 ['invalidRoom','생활실 배정 오류'],
 ['noPartner','독방 짝 미지정']
];
let laborReviewSelectedV297='';
function laborRenderReviewV297(result){
 const el=$('laborReviewV297');if(!el)return;
 const counts=result.diagnosticCounts||{},items=result.personDetails;
 const total=LABOR_REVIEW_V297.reduce((n,x)=>n+Number(counts[x[0]]||0),0);
 el.classList.remove('hidden');
 $('laborReviewCountV297').textContent=total+'건';
 $('laborReviewButtonsV297').innerHTML=LABOR_REVIEW_V297.map(([key,label])=>
  '<button type="button" class="labor-review-tab-v297'+(laborReviewSelectedV297===key?' is-selected':'')+'" data-review-group="'+key+'">'+escapeH(label)+' <b>'+Number(counts[key]||0)+'명</b></button>').join('');
 const note=result.mode==='total'?'※ 총인원(B8)은 개인별 호실 정보가 없는 공식 합계이므로 분배 표의 호실 미확인 수와 개인 명단 수가 다를 수 있습니다. 명단 검토는 현재/전체 인원 기준으로 확인하세요.':'';
 $('laborReviewNoteV297').textContent=note+(items?'':' 이 명단은 사역 편집 권한이 있는 계정에서만 표시됩니다.');
 if(laborReviewSelectedV297)laborShowReviewListV297(laborReviewSelectedV297);
 else $('laborReviewListV297').innerHTML='<p class="labor-review-empty-v297">확인할 항목을 선택해 주세요.</p>';
}
function laborShowReviewListV297(key){
 const result=laborResultV259||{},data=result.personDetails;
 const match=LABOR_REVIEW_V297.find(v=>v[0]===key);if(!match)return;
 laborReviewSelectedV297=key;
 $('laborReviewButtonsV297').querySelectorAll('[data-review-group]').forEach(b=>b.classList.toggle('is-selected',b.dataset.reviewGroup===key));
 const box=$('laborReviewListV297');if(!data){box.innerHTML='<p class="labor-review-empty-v297">이 명단을 조회할 편집 권한이 없습니다.</p>';return;}
 const list=Array.isArray(data[key])?data[key]:[];
 if(!list.length){box.innerHTML='<p class="labor-review-empty-v297">'+escapeH(match[1])+' 해당 인원이 없습니다.</p>';return;}
 box.innerHTML='<div class="labor-review-list-head-v297"><b>'+escapeH(match[1])+' · '+list.length+'명</b><span>기수 / 중대 / 이름 / 호실 / 확인 사유</span></div>'+list.map(p=>
  '<div class="labor-review-person-v297"><strong>'+escapeH(String(p.cohort||'—').normalize('NFKC').replace(/기$/,'')+'기 · '+laborCompanyLabelV261(p.company)+' · '+(p.name||'이름 없음'))+'</strong>'+
  '<small>호실 '+escapeH(p.room||'확인 필요')+' · '+escapeH(p.reason||'대조 필요')+'</small></div>').join('');
}
$('laborReviewButtonsV297').addEventListener('click',e=>{
 const b=e.target.closest('[data-review-group]');if(!b)return;
 laborShowReviewListV297(b.dataset.reviewGroup);
});
$('laborTableV259').addEventListener('click',e=>{
 const b=e.target.closest('[data-review-open]');if(!b)return;
 $('laborReviewV297').open=true;
 laborShowReviewListV297(b.dataset.reviewOpen);
});
async function laborLoadV259(){
 if(!ready||laborLoadingV259)return;
 laborSyncDimensionV262_();
 laborLoadingV259=true;laborBuildingBusyV357(true);$('laborRefreshV259').disabled=true;$('laborDraftOpenV264').disabled=true;$('laborAutoAssignV269').disabled=true;laborSelectionSummaryV263();$('laborNoticeV259').textContent='생활실 배정명단·스마트당직 인원 상태·B4:B8·호실 위치 대조 중…';
 try{const r=await server('getLaborCalcV259',$('laborModeV259').value,$('laborDimV259').value,Number($('laborDivisorV259').value),$('laborGradeV261').value,laborBuildingInputV357(),laborBuildingDimensionsInputV361());laborShowV259(r);}
 catch(e){laborResultV259=null;$('laborReviewV297').classList.add('hidden');$('laborNoticeV259').textContent='계산 실패: '+e.message+' · 기타 → 설정의 1~8중대 연결 및 생활실 배정명단을 확인하세요.';}
 finally{laborLoadingV259=false;laborBuildingBusyV357(false);$('laborRefreshV259').disabled=false;$('laborAutoAssignV269').disabled=!canEdit||!laborResultV259||laborPairDivisorV357(laborResultV259)===1||laborPairSavingV264;}
}
$('laborByBuildingV357').addEventListener('change',()=>{laborBuildingVisibilityV357();laborLoadV259();});
 qsa('[name="laborDistributionV358"]').forEach(radio=>radio.addEventListener('change',()=>{$('laborByBuildingV357').checked=radio.value==='building';laborBuildingVisibilityV357();laborLoadV259();}));
 $('laborBuildingRatesV357').addEventListener('change',e=>{if(e.target.matches('[data-labor-building],[data-labor-dimension]'))laborLoadV259();});
 $('laborRefreshV259').addEventListener('click',laborLoadV259);
['laborDivisorV259','laborGradeV261','laborDimV259'].forEach(id=>$(id).addEventListener('change',laborLoadV259));
$('laborModeV259').addEventListener('change',()=>{laborSyncDimensionV262_();laborLoadV259();});
laborSyncDimensionV262_();
let laborPairSavingV264=false;
// v2.69 · '자동배정 설정'은 별도 저장 없이 클릭 한 번으로 수동 지정 전체를 해제하고 재산출합니다.
async function laborAutoAssignV269(){
 if(!canEdit||laborPairSavingV264||laborLoadingV259||laborPairDivisorV357(laborResultV259)===1)return;
 laborPairCloseV268();
 laborPairSavingV264=true;
 const btn=$('laborAutoAssignV269');btn.disabled=true;
 btn.textContent='자동배정 적용 중…';
 $('laborPairPickStatusV264').textContent='직접 지정한 짝과 미지정 고정 기록을 해제하고 자동배정 중입니다…';
 try{
  await server('resetLaborSoloPairsAutoV269');
  await laborLoadV259();
  toast('모든 수동 짝 지정을 해제하고 현재 기준으로 자동배정했습니다. 분배 수량도 다시 산출되었습니다.');
 }catch(e){await laborLoadV259();alert('자동배정 설정 실패: '+e.message);}
 finally{
  laborPairSavingV264=false;btn.textContent='전체 자동배정 ↻';
  btn.disabled=!canEdit||!laborResultV259||laborPairDivisorV357(laborResultV259)===1;
 }
}
$('laborAutoAssignV269').addEventListener('click',laborAutoAssignV269);
function laborPairOptionsV264(){return {mode:$('laborModeV259').value,dimension:$('laborDimV259').value,divisor:Number($('laborDivisorV259').value),grade:$('laborGradeV261').value,buildingDivisors:laborBuildingInputV357(),buildingDimensions:laborBuildingDimensionsInputV361()};}
async function laborPairChangeV264(a,b,action){
 if(!canEdit||laborPairSavingV264)return;
 laborPairCloseV268();laborPairSavingV264=true;$('laborPairPickStatusV264').textContent='짝 변경을 저장하고 있습니다…';
 $('laborPairListV259').querySelectorAll('button').forEach(x=>x.disabled=true);
 try{await server('saveLaborSoloPairV259',a,b,action,laborPairOptionsV264());await laborLoadV259();toast(action==='unpair'?'두 생도를 미지정으로 변경했습니다.':'짝을 변경했습니다. 기존 짝은 미지정에 추가되고 새 짝은 한 방으로 계산됩니다.');}
 catch(e){await laborLoadV259();alert('짝 변경 실패: '+e.message);}finally{laborPairSavingV264=false;}
}
// v2.68 · inline pair swap based on pre-computed automatic matches.
let laborPairPopupV268=null;
function laborPairCloseV268(){
 const root=$('laborCalcView');
 if(root)root.querySelectorAll('.labor-inline-picker-v268').forEach(x=>x.remove());
 if(root)root.querySelectorAll('[data-pair-edit]').forEach(x=>x.setAttribute('aria-expanded','false'));
 laborPairPopupV268=null;
}
function laborPairOpenV268(button){
 if(laborPairSavingV264||!canEdit)return;
 const row=button.closest('[data-pair-row-a]'),side=button.dataset.pairEdit;
 if(!row||!['a','b'].includes(side))return;
 const a=row.dataset.pairRowA,b=row.dataset.pairRowB,building=row.dataset.pairRowBuilding;

 if(laborPairPopupV268?.button===button){laborPairCloseV268();return;}
 laborPairCloseV268();
 const fixed=(!b||side==='a')?a:b,selected=!b?'':(side==='a'?b:a);
 const source=(laborResultV259?.pairs?.singles||[]).filter(p=>p.active!==false&&p.reason==='계산 대상'&&p.building===building&&p.key!==fixed);
 const names=source.sort((x,y)=>String(x.cohort).localeCompare(String(y.cohort),'ko',{numeric:true})||x.name.localeCompare(y.name,'ko'));
 const choices=names.map(p=>'<label class="labor-inline-option-v268" data-choice-search="'+escapeH((p.cohort+' '+p.company+' '+p.name).toLocaleLowerCase('ko'))+'"><input type="checkbox" data-pair-choose="'+escapeH(p.key)+'" '+(selected===p.key?'checked':'')+'><span>'+escapeH(p.cohort+'기 · '+laborCompanyLabelV261(p.company)+' · '+p.name)+'</span></label>').join('');
 const panel=document.createElement('div');panel.className='labor-inline-picker-v268';
 panel.innerHTML='<p class="labor-inline-hint-v268">'+escapeH(building)+' 내 생도 선택 · 다른 관은 선택 불가</p><input class="labor-inline-search-v268" type="search" aria-label="'+escapeH(building)+' 명단 검색" placeholder="이름 / 기수 / 중대 검색"><div class="labor-inline-scroll-v268">'+(choices||'<p class="help">선택할 생도가 없습니다.</p>')+'</div>'+
 (b?'<button class="labor-inline-unassign-v268" type="button" data-pair-set-unassigned>이 자리를 미지정으로 변경</button>':'')+'</div>';
 panel.querySelectorAll('.labor-inline-option-v268').forEach(label=>{const name=label.querySelector('span'),check=label.querySelector('input');if(name&&check)label.replaceChildren(name,check);});button.closest('.labor-pair-cell-v268').appendChild(panel);
 button.setAttribute('aria-expanded','true');
 laborPairPopupV268={button,panel,fixed,selected,a,b,side,building};
 panel.querySelector('input[type="search"]').focus();
}
$('laborCalcView').addEventListener('input',e=>{
 if(!e.target.matches('.labor-inline-search-v268'))return;
 const q=e.target.value.trim().toLocaleLowerCase('ko');
 const panel=e.target.closest('.labor-inline-picker-v268');
 panel.querySelectorAll('[data-choice-search]').forEach(x=>x.hidden=!!q&&!x.dataset.choiceSearch.includes(q));
});
$('laborCalcView').addEventListener('change',ev=>{
 const cb=ev.target.closest('input[data-pair-choose]');if(!cb||!laborPairPopupV268||laborPairSavingV264)return;
 const state=laborPairPopupV268,key=cb.dataset.pairChoose;
 if(!cb.checked){cb.checked=true;return;} // one choice; selecting another checkbox replaces the member
 if(key===state.selected){laborPairCloseV268();return;}
 const fixed=state.fixed;
 const people=new Map((laborResultV259?.pairs?.singles||[]).map(p=>[p.key,p]));
 if(!people.has(key)||people.get(key).building!==state.building||key===fixed){alert('같은 관의 다른 생도만 선택할 수 있습니다.');laborPairCloseV268();return;}
 laborPairCloseV268();laborPairChangeV264(fixed,key,'pair');
});
$('laborCalcView').addEventListener('click',e=>{
 const unassign=e.target.closest('[data-pair-set-unassigned]');
 if(unassign&&laborPairPopupV268){const p=laborPairPopupV268;laborPairCloseV268();laborPairChangeV264(p.a,p.b,'unpair');return;}
 const edit=e.target.closest('[data-pair-edit]');if(edit){laborPairOpenV268(edit);return;}
});
document.addEventListener('click',e=>{
 if(laborPairPopupV268&&!e.target.closest('.labor-pair-cell-v268'))laborPairCloseV268();
});


// v2.65 · 사역 계산 → 임시 저장 → 사역 내역별 상세 작성 → 확정 시 일지/캘린더 연동.
let laborRecordsV264=[],laborRecordSavingV264=false,laborDraftRequestV265='';
async function laborRecordOpenV264(){
 if(!laborResultV259||!mustEdit()||laborRecordSavingV264)return;
 if(!laborDraftRequestV265)laborDraftRequestV265='labor-'+(window.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2));
 laborRecordSavingV264=true;$('laborDraftOpenV264').disabled=true;
 $('laborRecordMessageV264').textContent='계산 결과를 사역 내역으로 임시 저장 중…';
 try{
  const r=await server('saveLaborDraftV265',{id:laborDraftRequestV265,mode:laborResultV259.mode,dimension:laborResultV259.dimension,divisor:laborResultV259.divisor,buildingDivisors:laborResultV259.buildingDivisors,buildingDimensions:laborResultV259.buildingDimensions,grade:laborResultV259.grade,date:localISO()});
  $('laborRecordMessageV264').textContent='사역 내역에 임시 저장했습니다. 품목과 세부 수량은 사역 내역에서 나중에 작성하세요.';
  laborDraftRequestV265='';toast('사역 계산 임시 저장 완료 · 사역 내역으로 이동합니다.');
  switchView('laborRecords');await laborRecordsLoadV264();
  if(r?.record?.id)laborRecordsDetailV264(r.record.id);
 }catch(e){$('laborRecordMessageV264').textContent='임시 저장 실패: '+e.message;alert('임시 저장 실패: '+e.message);}
 finally{laborRecordSavingV264=false;$('laborDraftOpenV264').disabled=!laborResultV259;}
}
async function laborRecordsLoadV264(){
 if(!ready)return;
 $('laborRecordsStatusV264').textContent='사역 내역을 불러오는 중…';
 try{laborRecordsV264=await server('getLaborRecordsV265');laborRecordsRenderV264();}
 catch(e){$('laborRecordsStatusV264').textContent='사역 내역 조회 실패: '+e.message;}
}
function laborRecordsRenderV264(){
 const drafts=laborRecordsV264.filter(x=>x.status==='임시 저장').length;
 $('laborRecordsStatusV264').textContent='전체 '+laborRecordsV264.length+'건 · 임시 저장 '+drafts+'건 · 작성 완료 '+(laborRecordsV264.length-drafts)+'건';
 $('laborRecordsTableV264').innerHTML=laborRecordsV264.map(r=>'<tr><td>'+escapeH(r.date)+'</td><td>'+escapeH(r.item||'품목 미작성')+'</td><td>'+escapeH(r.summary)+'</td><td>'+laborFmtV259(r.calculated)+'개</td><td>'+(r.actual===null?'미작성':laborFmtV259(r.actual)+' '+escapeH(r.unit))+'</td><td><span class="labor-status-v265 '+(r.status==='임시 저장'?'is-draft':'is-complete')+'">'+escapeH(r.status)+'</span><button type="button" class="btn btn-soft" data-labor-record="'+escapeH(r.id)+'">'+(r.status==='임시 저장'?'작성하기':'상세·수정')+'</button>'+(r.status==='임시 저장'&&canEdit?'<button type="button" class="btn labor-delete-draft-v266" data-labor-draft-delete="'+escapeH(r.id)+'">삭제</button>':'')+'</td></tr>').join('')||'<tr><td colspan="6">임시 저장한 사역 내역이 없습니다. 사역 계산에서 임시 저장을 눌러주세요.</td></tr>';
}
function laborRecordTotalV265(){
 const form=$('laborEditFormV265');if(!form)return;
 const cells=[...form.querySelectorAll('[data-labor-quantity]')],completed=cells.filter(x=>x.value.trim()!=='');
 const sum=completed.reduce((n,x)=>n+Number(x.value||0),0);
 $('laborEditTotalV265').value=completed.length?laborFmtV259(sum)+' '+($('laborEditUnitV265').value||'개'):'미작성';
 $('laborEditProgressV265').textContent='분배 구역 '+cells.length+'곳 중 '+completed.length+'곳 수량 작성 · 모든 구역 입력 후 작성 완료 가능 (0개도 입력)';
}
function laborRecordsDetailV264(id){
 const r=laborRecordsV264.find(x=>x.id===id);if(!r)return;
 const detail=$('laborRecordDetailV264');detail.classList.remove('hidden');const groups=r.snapshot?.groups||[],map=new Map((r.allocations||[]).map(a=>[String(a.key),a]));
 const rows=groups.map((g,i)=>{
  const a=map.get(String(g.key||g.label))||{};
  return '<tr><td>'+escapeH(g.label)+'</td><td>'+laborFmtV259(g.count)+'명</td><td>'+laborFmtV259(g.quota)+'개</td><td><input type="number" class="field labor-grid-input-v265" min="0" max="1000000" step="any" data-labor-quantity="'+i+'" data-group-key="'+escapeH(g.key||g.label)+'" value="'+(a.actual===''||a.actual===undefined?'':escapeH(String(a.actual)))+'" '+(!canEdit?'disabled':'')+' placeholder="수량" aria-label="'+escapeH(g.label)+' 실제 수량"></td><td><textarea class="field labor-grid-note-v265" data-labor-note="'+i+'" maxlength="500" rows="2" '+(!canEdit?'disabled':'')+' placeholder="지급 방법·특이사항">'+escapeH(a.note||'')+'</textarea></td></tr>';
 }).join('');
 const readonly=!canEdit?'disabled':'';
 detail.innerHTML='<div class="labor-detail-header-v265"><div><h3>사역 내역 상세 작성</h3><p>'+escapeH(r.summary)+' · 계산 기준 '+laborFmtV259(r.snapshot.total)+'명</p></div><span class="labor-status-v265 '+(r.status==='임시 저장'?'is-draft':'is-complete')+'">'+escapeH(r.status)+'</span></div>'+
 '<form id="laborEditFormV265"><div class="labor-record-fields">'+
 '<label>사역일자<input id="laborEditDateV265" class="field" type="date" value="'+escapeH(r.date)+'" '+readonly+' required></label>'+
 '<label>품목 이름<input id="laborEditItemV265" class="field" maxlength="120" placeholder="예: 생수, 청소용품" value="'+escapeH(r.item||'')+'" '+readonly+'></label>'+
 '<label>수량 단위<input id="laborEditUnitV265" class="field" maxlength="20" value="'+escapeH(r.unit||'개')+'" '+readonly+' placeholder="개, 박스 등"></label>'+
 '<label>계산된 필요 수량<input class="field" readonly value="'+laborFmtV259(r.calculated)+'개"></label></div>'+
 '<h4 class="labor-record-group-heading-v265">분배 대상별 실제 수량 및 세부 사항</h4><p class="help">중대별 분배면 중대마다, 관별·층별 분배면 각 관·층마다 수량을 각각 입력할 수 있습니다.</p>'+
 '<div class="labor-table-wrap labor-group-editor-v265"><table><thead><tr><th>분배 대상</th><th>대상 인원</th><th>계산 수량</th><th>실제 분배 수량</th><th>구역별 세부 사항</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
 '<div class="labor-record-fields"><label>실제 분배 합계 (자동)<input id="laborEditTotalV265" class="field" readonly placeholder="미작성"></label><label class="labor-record-full">전체 세부 사항·인수인계<textarea id="laborEditDetailsV265" class="field" rows="5" maxlength="4500" '+readonly+' placeholder="품목 규격, 지급 담당자, 예외 처리, 후속 작업 등">'+escapeH(r.details||'')+'</textarea></label></div>'+
 '<p class="help" id="laborEditProgressV265" role="status"></p>'+
 (canEdit?'<div class="labor-record-actions"><button type="button" class="btn btn-soft" data-labor-record-save="draft">'+(r.status==='임시 저장'?'임시 저장':'변경사항 저장')+'</button><button type="button" class="btn btn-primary" data-labor-record-save="complete">'+(r.status==='임시 저장'?'작성 완료 · 일지/캘린더 기록':'완료 내역 수정 · 일지/캘린더 갱신')+'</button></div>':'')+
 '<p class="help" id="laborEditMessageV265" role="status"></p></form>';
 const form=$('laborEditFormV265');form.addEventListener('submit',e=>e.preventDefault());
 form.querySelectorAll('[data-labor-quantity]').forEach(x=>x.addEventListener('input',laborRecordTotalV265));
 $('laborEditUnitV265').addEventListener('input',laborRecordTotalV265);
 form.querySelectorAll('[data-labor-record-save]').forEach(b=>b.addEventListener('click',()=>laborRecordSaveV265(id,b.dataset.laborRecordSave==='complete')));
 laborRecordTotalV265();detail.scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function laborRecordSaveV265(id,complete){
 if(!mustEdit()||laborRecordSavingV264)return;const r=laborRecordsV264.find(x=>x.id===id);if(!r)return;
 const form=$('laborEditFormV265'),q=[...form.querySelectorAll('[data-labor-quantity]')],notes=[...form.querySelectorAll('[data-labor-note]')];
 const allocations=q.map((x,i)=>({key:x.dataset.groupKey,actual:x.value.trim(),note:notes[i].value}));
 if(complete&&(!$('laborEditItemV265').value.trim()||allocations.some(x=>x.actual===''))){alert('작성 완료하려면 품목명과 분배 대상별 실제 수량을 모두 입력해 주세요. 지급량이 없다면 0을 입력하세요.');return;}
 laborRecordSavingV264=true;form.querySelectorAll('[data-labor-record-save]').forEach(b=>b.disabled=true);
 $('laborEditMessageV265').textContent=complete?'사역 내역과 업무일지·캘린더에 반영 중…':'사역 내역을 임시 저장 중…';
 try{
  const out=await server('saveLaborRecordProgressV265',{id:r.id,updatedAt:r.updatedAt,complete,date:$('laborEditDateV265').value,item:$('laborEditItemV265').value,unit:$('laborEditUnitV265').value,details:$('laborEditDetailsV265').value,allocations});
  if(out.journal){data.entries=data.entries.filter(x=>x.id!==out.journal.id).concat(out.journal);refresh();}
  if(out.calendar){wxEvents=wxEvents.filter(x=>x.id!==out.calendar.id).concat(out.calendar);wxCalendarRender();}
  await laborRecordsLoadV264();laborRecordsDetailV264(id);
  toast(complete?'작성 완료 · 업무일지와 캘린더에 기록했어요.':'사역 내역에 임시 저장했어요.');
 }catch(e){const box=$('laborEditMessageV265');if(box)box.textContent='저장 실패: '+e.message;alert('저장 실패: '+e.message);}
 finally{laborRecordSavingV264=false;const box=$('laborEditFormV265');if(box)box.querySelectorAll('[data-labor-record-save]').forEach(b=>b.disabled=false);}
}
$('laborDraftOpenV264').addEventListener('click',laborRecordOpenV264);
$('laborRecordsReloadV264').addEventListener('click',laborRecordsLoadV264);
async function laborDeleteDraftV266(id){
 if(!mustEdit()||laborRecordSavingV264)return;
 const r=laborRecordsV264.find(x=>x.id===id);
 if(!r||r.status!=='임시 저장'){alert('임시 저장 상태인 내역만 삭제할 수 있습니다.');return;}
 if(!confirm('이 사역 임시저장 기록을 삭제할까요?\n작성 완료된 사역과 기존 업무일지·캘린더 기록은 삭제되지 않습니다.'))return;
 laborRecordSavingV264=true;
 try{
  await server('deleteLaborRecordDraftV266',r.id,r.updatedAt);
  const detail=$('laborRecordDetailV264');if(detail&&!detail.classList.contains('hidden'))detail.classList.add('hidden');
  await laborRecordsLoadV264();toast('임시 사역 내역을 삭제했습니다.');
 }catch(e){alert('임시 사역 삭제 실패: '+e.message);await laborRecordsLoadV264();}
 finally{laborRecordSavingV264=false;}
}
$('laborRecordsTableV264').addEventListener('click',ev=>{const del=ev.target.closest('[data-labor-draft-delete]');if(del)return laborDeleteDraftV266(del.dataset.laborDraftDelete);const b=ev.target.closest('[data-labor-record]');if(b)laborRecordsDetailV264(b.dataset.laborRecord);});


/** v2.76 · 군수품 지급처리 확인 창 (위탁·휴학·퇴교 이동 전 필수) */
let supplyDispositionResolveV276=null;
async function supplyDispositionsV276(id,status){
 let data;try{data=await server('getSupplyProcessingV276',id);}catch(err){alert('군수품 원본 확인 실패: '+err.message+'\n안전을 위해 명단 이동을 중단했습니다.');return null;}
 if(!data.items.length){
  return confirm(data.cohort+' '+data.name+'의 군수품 시트에 기록된 지급 내역이 없습니다.\n물품 미지급 및 별도 미처리 지급품이 없음을 확인했나요?')?{}:null;
 }
 if(supplyDispositionResolveV276)return null;
 $('supplyDispositionTitleV276').textContent=data.name+' · '+status+' 전 군수품 처리';
 $('supplyDispositionInfoV276').textContent='지급 기록이 있는 '+data.items.length+'개 품목을 확인해 주세요. 선택 내용은 이력 시트에 기록됩니다. 미처리 품목이 있으면 취소 후 처리하세요.';
 $('supplyDispositionItemsV276').innerHTML=data.items.map(item=>{
  const details=[item.status,item.detail,...Object.entries(item.extra||{}).map(([k,v])=>k+': '+v)].filter(Boolean).join(' · ');
  return '<div class="supply-disposition-line-v276" data-v276-item="'+escapeH(item.id)+'"><strong>'+escapeH(item.name)+'</strong><small>'+escapeH(details||'지급 기록 있음')+'</small><select class="field" aria-label="'+escapeH(item.name)+' 처리결과"><option value="">처리 여부 선택 (필수)</option><option value="반납 완료">반납 완료</option><option value="인계 완료">인계 완료</option><option value="미지급 확인">미지급 확인</option></select><input class="field" maxlength="400" aria-label="'+escapeH(item.name)+' 처리 비고" placeholder="처리 비고·인계 대상 (선택)"></div>';
 }).join('');
 $('supplyDispositionBackdropV276').classList.remove('hidden');
 return await new Promise(resolve=>{supplyDispositionResolveV276=resolve;});
}
function supplyDispositionCloseV276(value){
 $('supplyDispositionBackdropV276').classList.add('hidden');
 const f=supplyDispositionResolveV276;supplyDispositionResolveV276=null;if(f)f(value);
}
function supplyDispositionInitV276(){
 $('supplyDispositionCancelV276').addEventListener('click',()=>supplyDispositionCloseV276(null));
 $('supplyDispositionApplyV276').addEventListener('click',()=>{
  const answers={};let incomplete='';
  $('supplyDispositionItemsV276').querySelectorAll('[data-v276-item]').forEach(row=>{
   const sel=row.querySelector('select'),itemName=row.querySelector('strong').textContent;
   if(!sel.value){incomplete=itemName;return;}
   answers[row.dataset.v276Item]={action:sel.value,note:row.querySelector('input').value.trim()};
  });
  if(incomplete)return alert('군수품 「'+incomplete+'」의 처리 결과를 선택하세요.');
  supplyDispositionCloseV276(answers);
 });
}
/** v2.76 · 직책별 예도 상태. 화면만 변경하는 것이 아니라 구글 시트에 각 행을 저장합니다. */
let saberDataV276=null,saberBusyV276=false;
async function saberLoadV276(){
 if(saberBusyV276)return; saberBusyV276=true;
 try{
  if(canEdit&&!v284Scoped&&!dutyCadetsMetaV365)await dutyCadetsLoadV365();let r=await server('getSaberV276');
  // 기존 예도현황을 사용하는 관리자는 누락된 신규 직책을 데이터 손실 없이 행 추가합니다.
  if(r.initialized&&r.canEdit&&r.missingCount>0){
   try{await enqueue(()=>server('setupSaberV276'));r=await server('getSaberV276');}
   catch(syncError){console.warn('신규 예도 직책 등록 실패:',syncError);}
  }
  saberDataV276=r;
  $('saberAppendMissingV277').classList.toggle('hidden',!r.initialized||!r.canEdit||!r.missingCount);
  $('saberSetupV276').classList.toggle('hidden',r.initialized||!r.canEdit);
  $('saberActiveV276').classList.toggle('hidden',!r.initialized);
  $('saberOpenSheetV276').href=r.sheetUrl||'#';
  if(r.initialized){
   saberRenderV276();
   if(r.missingCount>0)$('saberInfoV276').textContent+=' · 아직 원본 시트에 추가되지 않은 직책 '+r.missingCount+'개: 관리자 계정에서 신규 직책 추가를 눌러 주세요.';
  }else $('saberInfoV276').textContent='관리자 계정에서 최초 설정을 실행해 주세요.';
 }catch(e){$('saberActiveV276').classList.remove('hidden');$('saberRowsV276').innerHTML='<tr><td colspan="4">'+escapeH('예도현황 조회 실패: '+e.message)+'</td></tr>';}
 finally{saberBusyV276=false;}
}
function saberStatsV277(){
 const data=saberDataV276;if(!data)return;
 const all=data.items;
 const summary=[
  ['전체',all.length,''],
  ['정상',all.filter(x=>x.status==='정상').length,'ok'],
  ['수리 필요',all.filter(x=>x.status==='수리 필요').length,'repair'],
  ['교체 필요',all.filter(x=>x.status==='교체 필요').length,'replace'],
  ['미선택',all.filter(x=>!x.status).length,'unknown']
 ];
 $('saberStatsV276').innerHTML=summary.map(([label,count,kind])=>'<div class="saber-stat-v277 '+kind+'"><small>'+label+'</small><strong>'+count+'</strong></div>').join('');
}
function saberRenderV276(){
 const data=saberDataV276;if(!data)return;
 const current=$('saberUnitV276').value;
 const units=[...new Set(data.items.map(x=>x.unit))];
 $('saberUnitV276').innerHTML='<option value="">전체 조직</option>'+units.map(x=>'<option value="'+escapeH(x)+'">'+escapeH(x)+'</option>').join('');
 if(units.includes(current))$('saberUnitV276').value=current;
 const all=data.items,unit=$('saberUnitV276').value,statusFilter=$('saberStatusV277').value,term=$('saberSearchV276').value.trim().toLowerCase();
 const list=all.filter(x=>(!unit||x.unit===unit)&&(!statusFilter||(statusFilter==='미확인'?!x.status:x.status===statusFilter))&&(!term||[x.unit,x.role,x.detail].join(' ').toLowerCase().includes(term)));
 saberStatsV277();
 const writable=canEdit&&data.canEdit;
 $('saberRowsV276').innerHTML=list.map(p=>{
  const state=p.status==='수리 필요'?'saber-repair-v276':p.status==='교체 필요'?'saber-replace-v277':'';
  return '<tr data-saber-key="'+escapeH(p.id)+'" class="'+state+'"><td>'+escapeH(p.unit)+'</td><td class="saber-role-v277">'+escapeH(p.role)+((p.linkedCadets||[]).length?'<small style="display:block">'+escapeH((p.linkedCadets.length>1?'중복 확인 · ':'')+p.linkedCadets.map(x=>[x.cohort?x.cohort+'기':'',x.company?x.company+'중대':'',x.name].filter(Boolean).join(' ')).join(', '))+'</small>':'')+'</td><td><select class="saber-entry-v276 saber-status-v277" data-saber-field="status" '+(writable?'':'disabled')+'><option value="" '+(!p.status?'selected':'')+'>상태 선택</option><option value="정상" '+(p.status==='정상'?'selected':'')+'>정상</option><option value="수리 필요(보고)" '+(p.status==='수리 필요(보고)'?'selected':'')+'>수리 필요(보고)</option><option value="수리 필요(미보고)" '+(p.status==='수리 필요(미보고)'?'selected':'')+'>수리 필요(미보고)</option><option value="교체 필요" '+(p.status==='교체 필요'?'selected':'')+'>교체 필요</option></select></td><td class="saber-detail-cell-v277"><textarea class="saber-entry-v276 saber-detail-v276" data-saber-field="detail" maxlength="1500" placeholder="점검 내용·조치사항" '+(writable?'':'disabled')+'>'+escapeH(p.detail)+'</textarea><small class="saber-save-state-v277" role="status" aria-live="polite">'+(writable?'변경 시 자동 저장':'조회 전용')+'</small></td></tr>';
 }).join('')||'<tr><td colspan="4">검색 결과가 없습니다.</td></tr>';
 $('saberInfoV276').textContent=list.length+'개 직책 표시 · 상태 변경과 세부사항 입력은 자동 저장됩니다.';
 $('saberSyncTitlesV277').classList.toggle('hidden',!data.titleSyncNeeded||!writable);
}
const saberTimersV277=new Map(),saberSavingV277=new Set(),saberNeedSaveV277=new Set();
function saberMarkStatusV277(row,status,detail){
 row.classList.toggle('saber-repair-v276',status==='수리 필요');
 row.classList.toggle('saber-replace-v277',status==='교체 필요');
 row.querySelector('.saber-save-state-v277').textContent=detail;
}
function saberQueueV277(row,delay){
 const id=row.dataset.saberKey;if(!id)return;
 if(saberTimersV277.has(id))clearTimeout(saberTimersV277.get(id));
 row.classList.add('saber-dirty-v276');
 saberMarkStatusV277(row,row.querySelector('[data-saber-field="status"]').value,'수정 중…');
 saberTimersV277.set(id,setTimeout(()=>{saberTimersV277.delete(id);saberSaveV276(id);},delay));
}
async function saberSaveV276(id){
 if(!canEdit||!saberDataV276?.canEdit)return;
 const item=saberDataV276.items.find(x=>x.id===id);if(!item)return;
 const row=[...$('saberRowsV276').querySelectorAll('[data-saber-key]')].find(x=>x.dataset.saberKey===id);
 if(!row)return;
 if(saberSavingV277.has(id)){saberNeedSaveV277.add(id);return;}
 const input={};row.querySelectorAll('[data-saber-field]').forEach(el=>input[el.dataset.saberField]=el.value);
 if(input.status===item.status&&input.detail===item.detail){row.classList.remove('saber-dirty-v276');saberMarkStatusV277(row,input.status,'저장됨');return;}
 saberSavingV277.add(id);saberMarkStatusV277(row,input.status,'저장 중…');
 try{
  const updated=await enqueue(()=>server('saveSaberV276',id,input,item.updatedAt));
  Object.assign(item,updated);
  const now={};row.querySelectorAll('[data-saber-field]').forEach(el=>now[el.dataset.saberField]=el.value);
  if(now.status===input.status&&now.detail===input.detail){row.classList.remove('saber-dirty-v276');saberMarkStatusV277(row,now.status,'✓ 저장됨');}
  else{saberNeedSaveV277.add(id);saberMarkStatusV277(row,now.status,'추가 변경 저장 대기…');}
  saberStatsV277();
 }catch(e){
  row.classList.add('saber-dirty-v276');
  saberMarkStatusV277(row,input.status,'저장 실패 · 수정 후 재시도');
  alert('예도 저장 실패: '+e.message+'\n이 행을 다시 수정하거나 새로고침 후 확인하세요.');
 }finally{
  saberSavingV277.delete(id);
  if(saberNeedSaveV277.has(id)){
   saberNeedSaveV277.delete(id);
   const latest=[...$('saberRowsV276').querySelectorAll('[data-saber-key]')].find(x=>x.dataset.saberKey===id);
   if(latest)saberQueueV277(latest,50);
  }
 }
}
function saberInitV276(){
 supplyDispositionInitV276();
 $('saberSetupButtonV276').addEventListener('click',async()=>{
  if(!mustEdit()||saberBusyV276)return;
  try{await enqueue(()=>server('setupSaberV276'));await saberLoadV276();toast('예도 관리 시트 생성 완료');}
  catch(e){alert('예도 초기화 실패: '+e.message);}
 });
 $('saberReloadV276').addEventListener('click',saberLoadV276);
 $('saberAppendMissingV277').addEventListener('click',async()=>{
  if(!mustEdit()||saberBusyV276)return;
  try{const result=await enqueue(()=>server('setupSaberV276'));await saberLoadV276();toast('신규 예도 직책 '+result.added+'개를 원본 시트에 추가했습니다.');}
  catch(e){alert('예도 직책 추가 실패: '+e.message);}
 });
 $('saberSyncTitlesV277').addEventListener('click',async()=>{
  if(!mustEdit())return;
  try{const result=await enqueue(()=>server('syncSaberTitlesV277'));await saberLoadV276();toast('원본 시트 직책명 '+result.updated+'건 업데이트 완료');}
  catch(e){alert('직책명 동기화 실패: '+e.message);}
 });
 ['saberUnitV276','saberStatusV277'].forEach(id=>$(id).addEventListener('change',saberRenderV276));
 $('saberSearchV276').addEventListener('input',saberRenderV276);
 $('saberRowsV276').addEventListener('input',e=>{
  const row=e.target.closest('[data-saber-key]');if(!row)return;
  if(e.target.dataset.saberField==='detail')saberQueueV277(row,1200);
 });
 $('saberRowsV276').addEventListener('change',e=>{
  const row=e.target.closest('[data-saber-key]');if(row)saberQueueV277(row,100);
 });
 $('saberRowsV276').addEventListener('focusout',e=>{
  if(e.target.dataset.saberField==='detail'){
   const row=e.target.closest('[data-saber-key]');if(row)saberQueueV277(row,100);
  }
 });
}


/* v2.78 · 피복 사이즈표 화면 */
let uniformStateV278={items:[],fields:[],loaded:false,loading:false,cohort:'전체',company:'전체',item:'동체련복',query:'',compare:null,quantitySort:'cohort'};
function uniformInitV278(){
 $('uniformCohortTabsV278').addEventListener('click',e=>{const b=e.target.closest('[data-uniform-cohort]');if(!b)return;uniformStateV278.cohort=b.dataset.uniformCohort;uniformStateV278.company='전체';uniformRenderV278();});
 $('uniformCompanyTabsV278').addEventListener('click',e=>{const b=e.target.closest('[data-uniform-company]');if(!b)return;uniformStateV278.company=b.dataset.uniformCompany;uniformRenderV278();});
 $('uniformSearchV278').addEventListener('input',e=>{uniformStateV278.query=e.target.value.trim();uniformRenderV278();});
 $('uniformItemFilterV278').addEventListener('change',e=>{uniformStateV278.item=e.target.value;uniformRenderV278();});
 $('uniformQtySortCohortV280').addEventListener('click',()=>{uniformStateV278.quantitySort='cohort';uniformRenderV278();});
 $('uniformQtySortCompanyV280').addEventListener('click',()=>{uniformStateV278.quantitySort='company';uniformRenderV278();});
 $('uniformReloadV278').addEventListener('click',()=>uniformLoadV278(true));
 $('uniformCompareV278').addEventListener('click',uniformCompareV278);
 $('uniformImportV278').addEventListener('click',uniformImportV278);
 $('uniformDeleteCohortV278').addEventListener('click',uniformDeleteCohortV278);
 $('uniformPendingV278').addEventListener('click',e=>{const b=e.target.closest('[data-uniform-del]');if(b)uniformDeletePersonV278(b.dataset.uniformDel);});
 $('uniformRowsV278').addEventListener('change',uniformCellChangeV278);
 $('uniformRowsV278').addEventListener('click',e=>{const b=e.target.closest('[data-uniform-del]');if(b)uniformDeletePersonV278(b.dataset.uniformDel);});
}
async function uniformLoadV278(force=false){if(!ready)return;if(uniformStateV278.loading)return;if(uniformStateV278.loaded&&!force){uniformRenderV278();return;}
 uniformStateV278.loading=true;$('uniformLoadLabelV278').textContent='피복 사이즈표 불러오는 중…';
 try{const r=await server('getUniformV278');uniformStateV278.items=r.items||[];uniformStateV278.fields=r.fields||[];uniformStateV278.loaded=true;uniformStateV278.compare=null;
  $('uniformLoadLabelV278').textContent='등록 '+r.items.length+'명 · '+(r.initialized?'시트 연동됨':'최초 일괄등록 대기');uniformRenderV278();
  // 스마트당직 비교는 독립 호출로 실행하여 로딩 지연이 표 전체를 잠그지 않도록 합니다.
  if(r.items.length)uniformCompareV278(true);
 }catch(e){$('uniformLoadLabelV278').textContent='피복 조회 오류: '+e.message;}
 finally{uniformStateV278.loading=false;}
}
function uniformItemsFilteredV278(){const s=uniformStateV278,q=s.query.toLowerCase();return s.items.filter(x=>(s.cohort==='전체'||x.cohort===s.cohort)&&(s.company==='전체'||x.company===s.company)&&(!q||[x.cohort,x.company,x.name,...Object.values(x.sizes||{})].some(v=>String(v||'').toLowerCase().includes(q)))).sort((a,b)=>rosterNumberCompare(a.cohort,b.cohort)||rosterNumberCompare(a.company,b.company)||String(a.name).localeCompare(String(b.name),'ko',{numeric:true}));}
function uniformTabHtmlV278(items,selected,key){return items.map(x=>`<button type="button" class="uniform-tab-v278 ${selected===x?'active':''}" data-uniform-${key}="${escapeH(x)}">${escapeH(x==='전체'?'전체':key==='cohort'?x:x+'중대')}</button>`).join('');}
function uniformRenderV278(){const st=uniformStateV278;
 const cohorts=['전체',...new Set(['75기','76기','77기','78기',...st.items.map(x=>x.cohort)])];
 $('uniformCohortTabsV278').innerHTML=uniformTabHtmlV278(cohorts,st.cohort,'cohort');
 if(v284Company)st.company=v284Company;$('uniformCompanyTabsV278').innerHTML=uniformTabHtmlV278(v284Company?[v284Company]:['전체',...'12345678'.split('')],st.company,'company');
 const select=$('uniformItemFilterV278'),old=st.item;select.innerHTML=st.fields.map(x=>`<option value="${escapeH(x)}">${escapeH(x)}</option>`).join('');if(!st.fields.includes(old))st.item=st.fields[0]||'동체련복';select.value=st.item;
 const people=uniformItemsFilteredV278(),pending=st.compare&&st.compare.verified?st.compare.pending:[],mismatch=st.compare&&st.compare.verified?st.compare.mismatch:[];
 const byCohort=new Map();st.items.forEach(p=>{const z=byCohort.get(p.cohort)||0;byCohort.set(p.cohort,z+1);});
 $('uniformStatsV278').innerHTML=`<div class="uniform-stat-v278"><small>전체 등록 인원</small><strong>${st.items.length}</strong><span>기수별 최초 등록</span></div>`+[...byCohort.entries()].sort().map(([c,n])=>`<div class="uniform-stat-v278"><small>${escapeH(c)} 등록</small><strong>${n}</strong><span>전체 8개 중대 합계</span></div>`).join('')+`<div class="uniform-stat-v278"><small>스마트당직 확인 필요</small><strong>${st.compare?.verified?pending.length+mismatch.length:'–'}</strong><span>미등록 + 소속 불일치</span></div>`;
 $('uniformSelectionV278').textContent=`${st.cohort} / ${st.company==='전체'?'전체 중대':st.company+'중대'} · ${people.length}명 표시`;
 const edit=canEdit?'':'disabled';const cols=['기수','중대','이름',...st.fields];
 // 위쪽 행: 3개 인적사항은 좌측 고정, 오른쪽에는 품목별 사이즈 구역을 명확하게 표시.
 $('uniformGroupHeaderV279').innerHTML=`<th rowspan="2" class="uniform-fixed-col-v278 uniform-fixed-0 uniform-meta-head-v279" scope="col">기수</th><th rowspan="2" class="uniform-fixed-col-v278 uniform-fixed-1 uniform-meta-head-v279" scope="col">중대</th><th rowspan="2" class="uniform-fixed-col-v278 uniform-fixed-2 uniform-meta-head-v279" scope="col">이름</th><th class="uniform-size-band-v279" colspan="${Math.max(1,st.fields.length)}" scope="colgroup">피복 품목별 사이즈 <span>${st.fields.length}개 품목</span></th><th rowspan="2" class="uniform-manage-head-v279" scope="col">관리</th>`;
 $('uniformHeaderV278').innerHTML=st.fields.length?st.fields.map(x=>`<th class="uniform-item-head-v279" scope="col" title="${escapeH(x)}">${escapeH(x)}</th>`).join(''):'<th class="uniform-item-head-v279">품목 등록 대기</th>';
 const renderPerson=(x,i)=>{const prev=people[i-1];const first=!prev||prev.cohort!==x.cohort||prev.company!==x.company;
  return `<tr class="${first?'uniform-first-group-v279':''}"><td class="uniform-fixed-col-v278 uniform-fixed-0"><span class="uniform-cohort-chip-v279">${escapeH(x.cohort)}</span></td><td class="uniform-fixed-col-v278 uniform-fixed-1">${escapeH(x.company)}중대</td><td class="uniform-fixed-col-v278 uniform-fixed-2"><b>${escapeH(x.name)}</b></td>${st.fields.map(k=>{const val=x.sizes&&x.sizes[k]||'';return `<td class="uniform-size-cell-v279 ${val?'uniform-filled-cell-v279':''}"><input ${edit} class="uniform-size-input-v278" data-uniform-id="${escapeH(x.id)}" data-uniform-item="${escapeH(k)}" value="${escapeH(val)}" maxlength="32" placeholder="—" aria-label="${escapeH(x.name+' '+k+' 사이즈')}" title="수정 후 다른 칸을 누르면 자동 저장"/></td>`;}).join('')}<td class="uniform-manage-cell-v279"><button type="button" class="btn btn-danger uniform-row-delete-v278" ${edit} data-uniform-del="${escapeH(x.id)}">삭제</button></td></tr>`;};
 $('uniformRowsV278').innerHTML=people.length?people.map(renderPerson).join(''):`<tr><td colspan="${Math.max(1,cols.length+1)}" class="repair-empty">등록 인원이 없거나 선택 조건에 해당하는 생도가 없습니다.</td></tr>`;
 uniformRenderQuantityV280(people);
 $('uniformManageV278').classList.toggle('hidden',!canEdit);
 uniformRenderCompareV278();
}
/** v2.80 · 품목별 기수/중대 우선 정렬 및 독립 전체합계(기존 시트 구조 변경 없음). */
function uniformRenderQuantityV280(people){
 const st=uniformStateV278,companyFirst=st.quantitySort==='company',item=st.item;
 for(const [id,active] of [['uniformQtySortCohortV280',!companyFirst],['uniformQtySortCompanyV280',companyFirst]]){
  const button=$(id);button.classList.toggle('roster-sort-active',active);button.setAttribute('aria-pressed',String(active));
 }
 const sizes=[...new Set(people.map(p=>String(p.sizes&&p.sizes[item]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko',{numeric:true}));
 const valid=people.filter(p=>String(p.sizes&&p.sizes[item]||'').trim());
 const missing=people.length-valid.length;
 $('uniformQuantityMetaV280').textContent=`${companyFirst?'중대 → 기수 순':'기수 → 중대 순'} · ${st.cohort==='전체'?'전체 기수':st.cohort} / ${st.company==='전체'?'전체 중대':st.company+'중대'} · ${item} · 사이즈 입력 ${valid.length}명 / 미입력 ${missing}명`;
 const tbody=$('uniformQuantityV278'),grand=$('uniformQuantityTotalV280');
 if(!people.length){tbody.innerHTML='<p class="uniform-qty-empty-v280">현재 기수·중대·검색 조건에 해당하는 생도가 없습니다.</p>';grand.innerHTML='';return;}
 // Primary key controls the visible group order, secondary key controls the subgroup order.
 const groupMap=new Map(),overall=new Map();
 for(const person of people){
  const main=String(companyFirst?person.company:person.cohort||'미분류'),sub=String(companyFirst?person.cohort:person.company||'미분류');
  if(!groupMap.has(main))groupMap.set(main,new Map());
  const submap=groupMap.get(main);if(!submap.has(sub))submap.set(sub,{counts:new Map(),total:0,missing:0});
  const o=submap.get(sub),size=String(person.sizes&&person.sizes[item]||'').trim();
  if(size){o.counts.set(size,(o.counts.get(size)||0)+1);overall.set(size,(overall.get(size)||0)+1);o.total++;}else o.missing++;
 }
 const mainNames=[...groupMap.keys()].sort(rosterNumberCompare),number=v=>Number(v||0);
 const displayMain=m=>companyFirst?(m==='미분류'?m:companyLabelV257(m)):(/^[0-9]+$/.test(m)?m+'기':m);
 const displaySub=m=>companyFirst?(/^[0-9]+$/.test(m)?m+'기':m):(m==='미분류'?m:companyLabelV257(m));
 const renderSizeCells=(counts)=>sizes.map(size=>`<td class="uniform-qty-number-v280">${counts.get(size)||'–'}</td>`).join('');
 const colcount=sizes.length+4;
 let html='';
 for(const primary of mainNames){
  const subs=groupMap.get(primary),subNames=[...subs.keys()].sort(rosterNumberCompare),primaryCounts=new Map();
  let primaryTotal=0,primaryMissing=0;
  html+=`<tr class="uniform-qty-group-v280"><td colspan="${colcount}">${escapeH(displayMain(primary))} <small>${companyFirst?'중대별':'기수별'} 묶음</small></td></tr>`;
  for(const secondary of subNames){
   const row=subs.get(secondary);primaryTotal+=row.total;primaryMissing+=row.missing;
   row.counts.forEach((n,size)=>primaryCounts.set(size,(primaryCounts.get(size)||0)+n));
   html+=`<tr><td class="uniform-qty-first-v280">${escapeH(displayMain(primary))}</td><td>${escapeH(displaySub(secondary))}</td>${renderSizeCells(row.counts)}<td class="uniform-qty-count-v280">${row.total}</td><td class="uniform-qty-missing-v280">${row.missing||'–'}</td></tr>`;
  }
  html+=`<tr class="uniform-qty-subtotal-v280"><td colspan="2">${escapeH(displayMain(primary))} 소계</td>${renderSizeCells(primaryCounts)}<td class="uniform-qty-count-v280">${primaryTotal}</td><td>${primaryMissing||'–'}</td></tr>`;
 }
 tbody.innerHTML=`<table class="uniform-summary-v278 uniform-qty-table-v280"><thead><tr><th>${companyFirst?'중대':'기수'}</th><th>${companyFirst?'기수':'중대'}</th>${sizes.map(sz=>`<th>${escapeH(sz)}</th>`).join('')}<th class="uniform-qty-count-v280">합계</th><th>미입력</th></tr></thead><tbody>${html}</tbody></table>`;
 // Separate bottom total section: sums counts (not the numerical size values).
 grand.innerHTML=`<div class="uniform-grand-heading-v280"><div><strong>전체 합계</strong><small>${escapeH(item)} · 현재 화면의 ${people.length}명 기준</small></div><div class="uniform-grand-keyfig-v280"><strong>${valid.length.toLocaleString()}<span>개</span></strong><small>사이즈별 수량 합계</small></div><div class="uniform-grand-missing-v280"><strong>${missing.toLocaleString()}명</strong><small>사이즈 미입력</small></div></div><div class="uniform-grand-size-list-v280">${sizes.length?sizes.map(sz=>`<span><b>${escapeH(sz)}</b><strong>${number(overall.get(sz)).toLocaleString()}개</strong></span>`).join(''):'<span class="uniform-grand-none-v280">입력된 사이즈가 없습니다.</span>'}</div>`;
}
function uniformRenderCompareV278(){const res=uniformStateV278.compare,area=$('uniformCompareStatusV278'),box=$('uniformPendingV278');
 if(!res){area.textContent='스마트당직을 아직 대조하지 않았습니다.';box.innerHTML='';return;}
 if(!res.verified){area.textContent='대조 불가: '+res.note+' · 연결되기 전에는 삭제 예정으로 분류하지 않습니다.';box.innerHTML='';return;}
 area.textContent=`${res.source} 대조 완료 · 일치 ${res.matched}명 / 미등재 ${res.pending.length}명 / 소속 확인 ${res.mismatch.length}명`;
 const edit=canEdit?'':'disabled';const pending=res.pending.map(r=>`<tr><td>${escapeH(r.cohort)}</td><td>${escapeH(r.company)}중대</td><td>${escapeH(r.name)}</td><td><span class="uniform-pending-pill-v278">삭제 처리 예정</span></td><td><button type="button" class="btn btn-danger" ${edit} data-uniform-del="${escapeH(r.id)}">확인 후 삭제</button></td></tr>`).join('');
 const mismatched=res.mismatch.map(r=>`<tr><td>${escapeH(r.cohort)}</td><td>${escapeH(r.company)}중대</td><td>${escapeH(r.name)}</td><td>소속 확인 필요 (${escapeH(r.found)})</td><td>보류</td></tr>`).join('');
 box.innerHTML=`<table class="uniform-summary-v278"><thead><tr><th>기수</th><th>중대</th><th>이름</th><th>대조 결과</th><th>관리</th></tr></thead><tbody>${pending+mismatched||'<tr><td colspan="5">대조 결과 확인이 필요한 인원이 없습니다.</td></tr>'}</tbody></table>`;
}
async function uniformCompareV278(background=false){if(!ready||!uniformStateV278.items.length)return;const el=$('uniformCompareStatusV278');el.textContent='스마트당직 1~8중대 기준 명단 확인 중…';
 try{uniformStateV278.compare=await server('compareUniformSmartV278');uniformRenderCompareV278();if(!background)toast('스마트당직 대조를 완료했습니다.');}catch(e){uniformStateV278.compare={verified:false,note:e.message};uniformRenderCompareV278();}
}
async function uniformCellChangeV278(e){const cell=e.target.closest('[data-uniform-id][data-uniform-item]');if(!cell||!canEdit)return;const id=cell.dataset.uniformId,item=cell.dataset.uniformItem,r=uniformStateV278.items.find(x=>x.id===id);if(!r)return;const prev=r.sizes[item]||'',val=cell.value.trim();if(prev===val)return;
 cell.disabled=true;try{const saved=await enqueue(()=>server('saveUniformSizeV278',id,item,val,r.updatedAt));if(saved.size)r.sizes[item]=saved.size;else delete r.sizes[item];r.updatedAt=saved.updatedAt;cell.classList.add('uniform-saved-v278');const scroll=$('.uniform-scroll-v278'),pos={x:scroll.scrollLeft,y:scroll.scrollTop};uniformRenderV278();scroll.scrollLeft=pos.x;scroll.scrollTop=pos.y;toast(item+' 사이즈를 저장했습니다.');}catch(err){cell.value=prev;alert('사이즈 저장 실패: '+err.message);}finally{cell.disabled=false;}}
async function uniformDeletePersonV278(id){if(!mustEdit())return;const r=uniformStateV278.items.find(x=>x.id===id);if(!r)return;
 if(!confirm(`${r.cohort} ${r.company}중대 ${r.name}의 피복 사이즈표 기록만 삭제할까요?\n스마트당직·총기번호·군수품 기록은 삭제되지 않습니다.\n삭제 기록은 변경 이력에 남습니다.`))return;
 const phrase=prompt('실제 삭제하려면 「삭제확인」을 입력해 주세요.');if(phrase!=='삭제확인')return;
 try{await enqueue(()=>server('deleteUniformPersonV278',id,r.updatedAt,phrase));uniformStateV278.items=uniformStateV278.items.filter(x=>x.id!==id);if(uniformStateV278.compare)uniformStateV278.compare=null;uniformRenderV278();toast('피복 사이즈표 행이 삭제됐습니다.');}catch(e){alert('삭제 실패: '+e.message);}}
async function uniformDeleteCohortV278(){if(!mustEdit())return;const c=uniformStateV278.cohort;if(c==='전체')return alert('삭제할 기수를 상위 탭에서 먼저 선택해 주세요.');const n=uniformStateV278.items.filter(x=>x.cohort===c).length;if(!n)return alert('선택 기수에 등록된 행이 없습니다.');
 if(!confirm(`${c}의 피복 사이즈 ${n}명 전체를 삭제할까요?\n이 작업은 해당 기수의 모든 사이즈표 기록을 삭제합니다.`))return;
 const phrase=prompt(`다시 확인합니다. ${c} ${n}명 전체 삭제를 실행하려면 「기수전체삭제」를 정확히 입력하세요.`);if(phrase!=='기수전체삭제')return;
 try{const result=await enqueue(()=>server('deleteUniformCohortV278',c,n,phrase));toast(result.deleted+'명 삭제 완료');await uniformLoadV278(true);}catch(e){alert('기수 삭제 실패: '+e.message);}}
async function uniformImportV278(){if(!mustEdit())return;const c=uniformStateV278.cohort;if(c==='전체')return alert('먼저 76기·77기·78기 중 최초 등록할 기수를 선택해 주세요.');if(uniformStateV278.items.some(x=>x.cohort===c))return alert('이미 등록된 기수입니다. 최초 일괄등록은 중복을 차단합니다.');
 const bundled=['76기','77기','78기'].includes(c);let paste='';if(!bundled){paste=prompt(c+' 최초 등록용 TSV 데이터를 붙여넣어 주세요. 첫 줄에는 중대, 이름, 품목명이 필요합니다.')||'';if(!paste)return;}
 if(!confirm(`${c} ${bundled?'첨부된 사이즈표 원본':'붙여넣은 데이터'}을 Google Sheets에 최초 일괄등록할까요?\n기존 다른 기수 명단은 유지됩니다.`))return;
 const b=$('uniformImportV278');b.disabled=true;try{const r=await enqueue(()=>server('importUniformCohortV278',c,paste));await uniformLoadV278(true);toast(r.cohort+' '+r.added+'명 등록 완료');}catch(e){alert('일괄등록 실패: '+e.message);}finally{b.disabled=false;}}



/** v2.84 · 사용자별 허용 메뉴와 중대 담당자 범위 */
let v284Scoped=false,v284Views=[],v284Company='',v284CanViewStaff=false,v284AccessUsers=[],v284StaffItems=[],v284StaffEdit=null,v284Busy=false;
const V284_FIELDS=[
 ['today','일자별 업무일지'],['all','전체 업무 관리'],['stats','업무 통계'],['calendar','캘린더'],
 ['roster','명단·총기번호'],['supply','군수품'],['uniform','피복 사이즈'],['equipment','공용비품'],
 ['saber','예도'],['dorm','생활실 현황'],['roomAsset','생활실 비품'],['repairs','수리 목록'],
 ['laborCalc','사역 계산'],['laborRecords','사역 내역'],['train','성무훈련'],['changes','수정 내역'],['staff','군수계 명단']
];
const V284_COMPANY_FIELDS=new Set(['roster','supply','uniform']);
function v284IsAllowed(id){
 if(!v284Scoped||id==='updates')return true;if(["train","trainJournal","trainCalendar","trainPersonnel","trainTasks","trainStats","trainSupply","trainUniform","trainUniformRequests","trainMeal","trainEquipment","trainRooms","trainRoomAssets","trainAssetRequests","trainRoster","trainSaber","trainRepairs","trainSurveys"].includes(id))id='train';
 if(id==='train')return v284Views.includes('today')||v284Views.includes('all');
 if(id==='today'&&v284Views.includes('all'))return true;
 return v284Views.includes(id);
}
let v284ChangePanelParent=null,v284ChangePanelNext=null;
function v284PositionChanges(){
 const panel=$('changeRightV283');if(!panel)return;
 if(!v284ChangePanelParent){
  v284ChangePanelParent=panel.parentNode;v284ChangePanelNext=panel.nextSibling;
  panel.addEventListener('click',e=>{
   if(!panel.classList.contains('v284-floating-change'))return;
   const close=e.target.closest('[data-change-dismiss-page]');if(close){e.preventDefault();changeDismissPageV286(close.dataset.changeDismissPage);return;}
   const open=e.target.closest('[data-change-open-page]');if(open){e.preventDefault();const rec=changeStateV283.unread.find(x=>x.page===open.dataset.changeOpenPage);if(rec)changeOpenV283(rec.id,true);}
  });
 }
 // v2.85: 일반 관리자·중대 담당자 모두 어떤 메뉴에서든 우측 하단 팝업으로 표시
 const dock=$('notificationDockV309');if(dock&&panel.parentNode!==dock)dock.appendChild(panel);
 panel.classList.add('v284-floating-change','v285-fixed-popup');
 const restore=$('changePopupRestoreV285');
 if(restore&&restore.parentNode!==document.body)document.body.appendChild(restore);
 changeRightRenderV283();
}
function v284AddUtilityNav(){}
function v284JobsSelect(id){$(id).innerHTML=OWNER_GROUPS.map(g=>'<optgroup label="'+escapeH(g.label)+'">'+g.items.map(j=>'<option value="'+escapeH(j)+'">'+escapeH(j)+'</option>').join('')+'</optgroup>').join('');}
function v284CheckboxRender(){
 const company=/^([1-8])중대 (?:3편대장생도|군수보좌관생도)$/.exec($('v284AccessJob').value);
 $('v284AccessHint').textContent=company?company[1]+'중대 담당자:  '+company[1]+'중대의 명단·군수품·피복 자료만 앱 화면에 표시합니다. 원본 Google Sheets 직접 공유는 별도 보안 문제가 있습니다.':'전체 담당자: 선택한 업무 메뉴만 앱에서 사용할 수 있습니다.';
 $('v284AccessCheckboxes').innerHTML=V284_FIELDS.map(([key,label])=>{
  const disabled=!!company&&!V284_COMPANY_FIELDS.has(key);
  return '<label class="'+(disabled?'is-disabled':'')+'"><input type="checkbox" data-access-view="'+escapeH(key)+'" '+(disabled?'disabled':'')+'><span>'+escapeH(label)+'</span></label>';
 }).join('');
}
async function v284AccessLoad(){
 if(!canManageUsersV281)return;const label=$('v284AccessStatus');label.textContent='권한 목록 불러오는 중…';
 try{const r=await server('accessListV284');v284AccessUsers=r.users||[];
 $('v284AccessUsers').innerHTML=v284AccessUsers.length?v284AccessUsers.map(x=>'<div class="v284-user"><div><strong>'+escapeH(x.email)+'</strong><small>'+escapeH(x.job)+' · '+escapeH(x.company?x.company+'중대 제한':'허용 메뉴 제한')+' · '+escapeH((x.views||[]).map(id=>V284_FIELDS.find(y=>y[0]===id)?.[1]||id).join(', '))+'</small></div><button class="btn" type="button" data-staff-access-edit="'+escapeH(x.email)+'">변경</button><button class="btn btn-danger" type="button" data-v284-revoke="'+escapeH(x.email)+'">회수</button></div>').join(''):'<p class="help">아직 등록된 계정이 없습니다.</p>';
 label.textContent='범위 편집자 '+v284AccessUsers.length+'명 · 기존 전체 편집자 '+(r.legacyFull||[]).length+'명';
 }catch(e){label.textContent='권한 조회 실패: '+e.message;}
}
async function v284AccessSave(){
 if(v284Busy)return;
 const job=$('v284AccessJob').value,email=$('v284AccessEmail').value.trim().toLowerCase(),views=qsa('[data-access-view]:checked',$('v284AccessCheckboxes')).map(x=>x.dataset.accessView);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return alert('이메일 주소를 입력해 주세요.');
 if(!views.length)return alert('허용할 업무 메뉴를 선택해 주세요.');
 if(!confirm(email+'에게 '+job+' · '+views.length+'개 메뉴의 편집 권한을 부여하거나 변경할까요?'))return;
 v284Busy=true;$('v284AccessGrant').disabled=true;
 try{const r=await server('accessGrantV284',{email,job,views});await Promise.all([v284AccessLoad(),loadFullEditorsV281()]);
  if(r.warnings?.length)alert('등록 완료. 주의: '+r.warnings.join('\n'));
 }catch(e){alert('권한 부여 실패: '+e.message);}finally{v284Busy=false;$('v284AccessGrant').disabled=false;}
}
async function v284AccessRevoke(email){if(!confirm(email+'의 범위 편집 권한을 회수할까요?'))return;
 try{const r=await server('accessRevokeV284',email);await Promise.all([v284AccessLoad(),loadFullEditorsV281()]);if(r.warnings?.length)alert(r.warnings.join('\n'));}
 catch(e){alert('권한 회수 실패: '+e.message);}
}
function v284StaffReset(){v284StaffEdit=null;$('v284StaffJob').value=OWNER_GROUPS[0].items[0];['Name','Phone'].forEach(x=>$('v284Staff'+x).value='');$('v284AccessEmail').value='';$('v284AccessJob').value=$('v284StaffJob').value;v284CheckboxRender();$('v284StaffSave').textContent='명단 저장';}
async function v284StaffLoad(chosenTerm){
 const label=$('v284StaffStatus');label.textContent='군수계 명단 불러오는 중…';
 try{
  const requested=typeof chosenTerm==='string'?chosenTerm:v288ViewingTerm;
  const result=await server('staffListV284',requested||'');
  v288ShowActiveTerm(result.term||'');v288ViewingTerm=result.viewTerm||result.term||'';
  $('v285StaffTerm').value=result.term||'';
  const terms=result.terms||[];
  $('v288StaffHistoryTerms').innerHTML=terms.length?terms.map(term=>'<option value="'+escapeH(term)+'">'+escapeH(term)+(term===result.term?' (현재)':' (이전)')+'</option>').join(''):'<option value="">등록된 차수 없음</option>';
  $('v288StaffHistoryTerms').value=v288ViewingTerm;
  $('v288NewTermMode').disabled=!result.canManageTerms;$('v285StaffTerm').disabled=!result.canManageTerms;$('v285StaffTermApply').disabled=!result.canManageTerms;
  $('v285StaffTermStatus').textContent=result.term?'현재 근무 차수: '+result.term+' · 차수별 명단 별도 보관':'현재 근무 차수를 입력하고 시작해 주세요.';
  $('v288ArchiveHint').textContent=result.archived?'이전 차수 보관 명단입니다. 삭제·수정 없이 조회합니다.':'현재 차수 명단을 관리합니다.';
  v284StaffItems=result.items||[];
  $('v284StaffForm').classList.toggle('hidden',!result.canEdit);
  $('v284StaffRows').innerHTML=v284StaffItems.length?v284StaffItems.map((x,i)=>'<tr><td>'+escapeH(x.job)+'</td><td>'+escapeH(x.name)+'</td><td>'+escapeH(x.phone||'—')+'</td><td>'+escapeH(x.email||'—')+'</td><td>'+escapeH(x.term)+'</td><td>'+(result.canEdit?'<button class="btn" type="button" data-staff-access="'+i+'">권한 관리</button> <button class="btn" type="button" data-v284-staff-edit="'+i+'">수정</button> <button class="btn btn-danger" type="button" data-v284-staff-delete="'+i+'">삭제</button>':'보관 기록')+'</td></tr>').join(''):'<tr><td colspan="6">선택한 차수의 근무자 명단이 없습니다.</td></tr>';
  label.textContent=v288ViewingTerm+' · 명단 '+v284StaffItems.length+'명'+(result.archived?' (보관됨)':'');
 }catch(e){label.textContent='명단 조회 실패: '+e.message;}
}
async function v284StaffSave(){const x={job:$('v284StaffJob').value,name:$('v284StaffName').value.trim(),phone:$('v284StaffPhone').value.trim(),email:$('v284AccessEmail').value.trim(),term:$('v285StaffTerm').value.trim()};
 if(v284StaffEdit){x.row=v284StaffEdit.row;x.expected=v284StaffEdit.updatedAt;}
 if(!x.name)return alert('이름을 입력해 주세요.');
 try{await server('staffSaveV284',x);v284StaffReset();await v284StaffLoad();toast('군수계 명단을 저장했습니다.');}catch(e){alert('명단 저장 실패: '+e.message);}
}

async function v285StaffTermApply(){
 const term=$('v285StaffTerm').value.trim().replace(/\s+/g,'');
 if(!/^[0-9]{2,3}-[0-9]{1,3}차$/.test(term))return alert('근무 차수는 75-3차, 75-4차처럼 입력해 주세요.');
 const mode=$('v288NewTermMode').value;
 if(!confirm('현재 근무 차수를 '+term+'로 설정할까요?\n새 차수라면 '+(mode==='copy'?'이전 근무자 명단을 새 차수로 복사':'빈 명단으로 시작')+'합니다.\n기존 차수의 명단은 삭제하거나 덮어쓰지 않습니다.'))return;
 const btn=$('v285StaffTermApply');btn.disabled=true;
 try{
  const r=await server('staffSetCommonTermV285',term,mode);
  v288ViewingTerm=term;v284StaffReset();await v284StaffLoad(term);
  toast(r.existing?'기존 '+term+' 차수로 전환했어요.':term+' 차수를 시작했습니다. '+r.copied+'명 복사 완료');
 }catch(e){alert('근무 차수 설정 실패: '+e.message);}finally{btn.disabled=false;}
}
let v397UpdateArchive=[],v397UpdateServer=null,v397UpdateRequest=0,v397UpdateError='';
function v397UpdateRender(){
 const latest=window.LOGBOOK_UPDATES?.getLatest(),rows=[...(latest?[latest]:[]),...v397UpdateArchive,...(v397UpdateServer?.additions||[]).slice().reverse(),...(v397UpdateServer?.history||[])],seen=new Set(),entries=[];
 for(const row of rows){const version=String(row.version||'').replace(/^v/i,'').trim();if(!version||seen.has(version))continue;seen.add(version);entries.push({...row,version,detail:Array.isArray(row.notes)?row.notes.join('\n'):String(row.detail||'')});}
 entries.sort((a,b)=>b.version.localeCompare(a.version,undefined,{numeric:true}));
 $('v285UpdateRows').innerHTML=entries.map(x=>'<div class="v285-release"><span class="v285-release-version">'+escapeH(x.version)+'</span><div><strong>'+escapeH(x.title)+'</strong><p>'+escapeH(x.detail)+'</p>'+(x.at?'<small>등록 '+escapeH(x.at.slice(0,16).replace('T',' '))+'</small>':'')+'</div></div>').join('');
 $('v285UpdateStatus').textContent=entries.length?'주요 업데이트 '+entries.length+'건 · 최신 버전 '+entries[0].version+(v397UpdateError?' · '+v397UpdateError:''):'업데이트 내역 불러오는 중…'+(v397UpdateError?' · '+v397UpdateError:'');
}
async function v285UpdateLoad(){
 const request=++v397UpdateRequest;v397UpdateError='';v397UpdateRender();
 const latestRead=Promise.resolve(window.LOGBOOK_UPDATES?.refresh()).then(()=>{if(request===v397UpdateRequest)v397UpdateRender();});
 const staticRead=(async()=>{try{
  const response=await fetch('./releases.json?t='+Date.now(),{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('배포 기록 조회 실패');const rows=await response.json();
  if(!Array.isArray(rows)||rows.length>1000||rows.some(row=>!row||typeof row.version!=='string'||typeof row.title!=='string'||!Array.isArray(row.notes)||row.notes.some(note=>typeof note!=='string')))throw Error('배포 기록 형식 오류');
  if(request===v397UpdateRequest){v397UpdateArchive=rows;v397UpdateRender();}
 }catch(e){if(request===v397UpdateRequest){v397UpdateError='배포 기록 재조회 필요';v397UpdateRender();}}})();
 const serverRead=(async()=>{try{const result=await server('getUpdateHistoryV285');if(request!==v397UpdateRequest)return;v397UpdateServer=result;$('v285UpdateForm').classList.toggle('hidden',!result.canEdit);v397UpdateRender();}
 catch(e){if(request===v397UpdateRequest){v397UpdateError='과거 서버 기록 조회 실패';v397UpdateRender();}}})();
 await Promise.allSettled([latestRead,staticRead,serverRead]);
}
window.LOGBOOK_UPDATES?.subscribe(()=>{if(view==='updates')v397UpdateRender();});

async function v285UpdateSave(){
 const p={version:$('v285UpdateVersion').value.trim(),title:$('v285UpdateTitle').value.trim(),detail:$('v285UpdateDetail').value.trim()};
 if(!p.version||!p.title||!p.detail)return alert('버전·제목·변경 내용을 입력해 주세요.');
 const btn=$('v285UpdateSave');btn.disabled=true;
 try{await server('addUpdateHistoryV285',p);$('v285UpdateTitle').value='';$('v285UpdateDetail').value='';await v285UpdateLoad();toast('버전 변경 내역을 추가했습니다.');}
 catch(e){alert('업데이트 내역 저장 실패: '+e.message);}finally{btn.disabled=false;}
}
function v284Init(){
 $('staffPermissionsV364').appendChild($('accessManageV281'));
 $('v284StaffPhone').closest('.v284-grid').appendChild($('v284AccessEmail').closest('label'));
 const rightsPanel=$('v284AccessJob').closest('.panel'),staffForm=$('v284StaffForm');staffForm.insertBefore(rightsPanel,staffForm.querySelector('.setting-actions'));$('v284AccessJob').closest('label').hidden=true;rightsPanel.querySelector('.panel-title').textContent='허용 메뉴 · 권한 부여';rightsPanel.prepend($('staffPermissionPersonV364'));
 const accounts=document.createElement('div');accounts.className='panel v284-panel';accounts.innerHTML='<h2 class="panel-title">등록된 계정 권한</h2>';accounts.append($('v284AccessStatus'),$('v284AccessUsers'));$('staffPermissionsV364').prepend(accounts);
 
 v284JobsSelect('v284AccessJob');v284JobsSelect('v284StaffJob');v284CheckboxRender();
 $('v284AccessJob').addEventListener('change',v284CheckboxRender);
 $('v284AccessGrant').addEventListener('click',v284AccessSave);
 $('v284AccessRefresh').addEventListener('click',v284AccessLoad);
 $('v284AccessUsers').addEventListener('click',e=>{const btn=e.target.closest('[data-v284-revoke]');if(btn)v284AccessRevoke(btn.dataset.v284Revoke);});
 $('v284StaffRefresh').addEventListener('click',v284StaffLoad);
 $('v285StaffTermApply').addEventListener('click',v285StaffTermApply);
 $('v288StaffHistoryTerms').addEventListener('change',e=>{v284StaffReset();v284StaffLoad(e.target.value);});
 $('v285UpdateRefresh').addEventListener('click',v285UpdateLoad);
 $('v285UpdateSave').addEventListener('click',v285UpdateSave);
 $('v284StaffSave').addEventListener('click',v284StaffSave);
 $('v284StaffCancel').addEventListener('click',v284StaffReset);
 $('v284StaffRows').addEventListener('click',e=>{
  const edit=e.target.closest('[data-v284-staff-edit]'),del=e.target.closest('[data-v284-staff-delete]');
  const id=edit?Number(edit.dataset.v284StaffEdit):del?Number(del.dataset.v284StaffDelete):-1;
  const x=v284StaffItems[id];if(!x)return;
  if(edit){v284StaffEdit=x;$('v284StaffJob').value=x.job;$('v284StaffName').value=x.name;$('v284StaffPhone').value=x.phone;$('v284AccessEmail').value=x.email||'';staffAccessPopulateV366();
    $('v284StaffSave').textContent='명단 수정 저장';toast('위 입력란에서 명단을 수정할 수 있습니다.');
  }else if(del&&confirm(x.job+' · '+x.name+' 명단을 삭제할까요?')){
    server('staffDeleteV284',x.row,x.updatedAt).then(()=>v284StaffLoad()).catch(err=>alert('삭제 실패: '+err.message));
  }
 });
}
/** v2.83 · 신규 저장/수정 1건 = 알림 1칸. 닫기는 개인별로 서버에 기록. */
const CHANGE_WRITE_NAMES_V283=new Set(['saveEntry','removeEntry','saveNote','saveCategories','restoreBackup','clearLogbook','saveEquipment','removeEquipment','saveRosterMember','removeRosterMember','importRosterPaste','importRosterFromSheet','normalizeRosterCohort','createSupplyItem','saveSupplyRow','normalizeSupplyCohort','createWorkspacePageV221','saveWorkspaceRowV221','deleteWorkspaceRowV221','archiveWorkspacePageV221','saveCalendarEventV221','deleteCalendarEventV221','saveLaborRecordV264','saveLaborDraftV265','saveLaborRecordProgressV265','deleteLaborRecordDraftV266','saveLaborSoloPairV259','saveNavTreeV233','saveDormV234','importDormV234','deleteDormV234','saveDormBaselineV237','restoreDormBaselineV237','saveDormInventoryRoomV244','addDormInventoryItemV244','normalizeDormInventoryScopeV245','setDormInventoryItemActiveV247','saveSmartDutyStatusV253','moveRosterToSpecialV255','changeSpecialStatusV255','restoreSpecialRosterV255','clearSpecialGunNumberV255','clearActiveGunNumberV255','saveSaberV276','importUniformCohortV278','saveUniformSizeV278','deleteUniformPersonV278','deleteUniformCohortV278']);
let changeStateV283={items:[],unread:[],busy:false,panelHidden:false,refreshHandle:null};
function changePrettyAtV283(s){const x=String(s||'');return x.length>=16?x.slice(0,16).replace('T',' '):x;}
/** v2.86 · 수정사항 팝업 및 이력 필터는 하위메뉴(page)별로 묶습니다. */
function changePageLabelV286(page){
 const id=String(page||'').trim();return viewNames[id]?.[1]||'기타';
}
function changeHistoryRenderV283(){
 const list=$('changeHistoryRowsV283'),sel=$('changeGroupV283');if(!list||!sel)return;
 const pages=[...new Set(changeStateV283.items.map(x=>x.page).filter(Boolean))];const prev=sel.value;
 sel.innerHTML='<option value="">전체 하위메뉴</option>'+pages.map(x=>'<option value="'+escapeH(x)+'">'+escapeH(changePageLabelV286(x))+'</option>').join('');sel.value=pages.includes(prev)?prev:'';
 const shown=changeStateV283.items.filter(x=>!sel.value||x.page===sel.value),unread=new Set(changeStateV283.unread.map(x=>x.id));
 $('changeHistoryCountV283').textContent=shown.length+'건 · 최근 기록 기준';
 list.innerHTML=shown.length?shown.map(r=>`<div class="change-history-row-v283 ${unread.has(r.id)?'is-unread':''}"><button type="button" class="change-history-main-v283" data-change-open="${escapeH(r.id)}"><strong>${escapeH(changePageLabelV286(r.page))} · ${escapeH(r.action)} · ${escapeH(r.title)}</strong><small>${escapeH(r.group)} · ${escapeH(r.detail)}<span>　${escapeH(changePrettyAtV283(r.at))} · ${escapeH(r.by)}</span></small></button>${unread.has(r.id)?`<button class="change-x-v283" type="button" data-change-dismiss="${escapeH(r.id)}" title="내 알림에서 숨기기">×</button>`:''}</div>`).join(''):'<p class="change-empty-v283">아직 기록된 수정사항이 없습니다.</p>';
}
function changeRightRenderV283(){
 const target=$('changeItemsV283');if(!target)return;
 $('changeRightV283').classList.toggle('hidden',changeStateV283.panelHidden);
 // 다른 상위메뉴라도 같은 하위메뉴에서 수정된 내역은 팝업 1칸으로 표시합니다.
 const byPage=new Map();changeStateV283.unread.forEach(r=>{const key=r.page||'settings';if(!byPage.has(key))byPage.set(key,[]);byPage.get(key).push(r);});
 const pages=[...byPage.entries()];$('changeCountV283').textContent=pages.length+'건의 수정사항';
 const restore=$('changePopupRestoreV285');if(restore){
  restore.classList.toggle('hidden',!changeStateV283.panelHidden);
  restore.setAttribute('aria-label','수정사항 알림 팝업 다시 열기 ('+pages.length+'건)');
  const badge=$('changePopupRestoreCountV285');if(badge)badge.textContent=pages.length;
 }
 target.innerHTML=pages.length?pages.map(([page,items])=>`<div class="change-item-v283"><button type="button" class="change-go-v283" data-change-open-page="${escapeH(page)}" title="${escapeH(changePageLabelV286(page))} 화면으로 이동"><strong>${escapeH(changePageLabelV286(page))}에 수정사항이 있습니다.</strong></button><button class="change-x-v283" type="button" data-change-dismiss-page="${escapeH(page)}" title="${escapeH(changePageLabelV286(page))} 알림만 닫기">×</button></div>`).join(''):'<div class="change-empty-v283">확인할 수정사항이 없습니다.</div>';
 if(view==='changes')changeHistoryRenderV283();
}
async function changeHistoryLoadV283(){
 if(!ready||changeStateV283.busy)return;changeStateV283.busy=true;
 try{const r=await server('getChangesV283',350);changeStateV283.items=r.items||[];changeStateV283.unread=(r.unread||[]).filter(x=>!changeReadV309.has(x.id));changeRightRenderV283();}
 catch(e){const el=$('changeCountV283');if(el)el.textContent='수정사항 조회 실패';console.warn('수정사항 조회:',e.message);}
 finally{changeStateV283.busy=false;}
}
function changeOpenV283(id,wholePage=false){
 const r=changeStateV283.items.find(x=>x.id===id);if(!r)return false;
 const page=viewNames[r.page]?r.page:'changes';
 const ids=changeStateV283.unread.filter(x=>wholePage?x.page===r.page:x.id===id).map(x=>x.id);
 if(switchView(page)===false)return false;
 changeReadPageV309(r.page,ids);
 const searchMap={roster:'rosterSearch',saber:'saberSearchV276',supply:'supplySearch',uniform:'uniformSearchV278',dorm:'dormSearch'};
 if(page==='all'){const el=$('search');el.value=r.title;renderAll();return true;}
 const el=$(searchMap[page]);if(el){el.value=r.title;el.dispatchEvent(new Event('input',{bubbles:true}));}
 return true;
}
async function changeDismissV283(id){
 const target=changeStateV283.unread.find(x=>x.id===id);if(!target)return;
 try{await server('dismissChangeV283',id);changeStateV283.unread=changeStateV283.unread.filter(x=>x.id!==id);changeRightRenderV283();}
 catch(e){toast('알림 닫기 실패: '+e.message);}
}
async function changeDismissPageV286(page){
 try{await server('dismissChangePageV286',page);changeStateV283.unread=changeStateV283.unread.filter(x=>x.page!==page);changeRightRenderV283();}
 catch(e){toast('하위메뉴 알림 닫기 실패: '+e.message);}
}
function changeUiInitV283(){
 const root=$('todayView'),history=$('changesView');
 [root,history].forEach(parent=>parent.addEventListener('click',e=>{
  const closePage=e.target.closest('[data-change-dismiss-page]');if(closePage){e.preventDefault();changeDismissPageV286(closePage.dataset.changeDismissPage);return;}
  const openPage=e.target.closest('[data-change-open-page]');if(openPage){e.preventDefault();const rec=changeStateV283.unread.find(x=>x.page===openPage.dataset.changeOpenPage);if(rec)changeOpenV283(rec.id,true);return;}
  const dismiss=e.target.closest('[data-change-dismiss]');if(dismiss){e.preventDefault();changeDismissV283(dismiss.dataset.changeDismiss);return;}
  const open=e.target.closest('[data-change-open]');if(open){e.preventDefault();changeOpenV283(open.dataset.changeOpen);return;}
  if(e.target.closest('[data-change-show-all]'))switchView('changes');
 }));
 $('changeHistoryLinkV283').addEventListener('click',()=>switchView('changes'));
 $('changePanelHideV283').addEventListener('click',()=>{changeStateV283.panelHidden=true;changeRightRenderV283();});
 $('changePopupRestoreV285').addEventListener('click',()=>{changeStateV283.panelHidden=false;changeRightRenderV283();});
 $('changeRefreshV283').addEventListener('click',changeHistoryLoadV283);
 $('changeHistoryRefreshV283').addEventListener('click',changeHistoryLoadV283);
 $('changeGroupV283').addEventListener('change',changeHistoryRenderV283);
 if(!changeStateV283.refreshHandle)changeStateV283.refreshHandle=setInterval(()=>{if(ready&&document.visibilityState==='visible')changeHistoryLoadV283();},60000);
}

changeUiInitV283();
/* v2.99 · 행정 > Google Forms 조사: 설문 생성, 응답 자동 집계, 개별 조회 */
let surveysTemplatesCacheV299=[],surveysListCacheV299=[],surveysCurrentV299='',surveysLoadingV299=false;
function surveysMessageV299(msg,isError=false){const node=$('surveysStatusV299');if(node){node.textContent=msg||'';node.style.color=isError?'#bf3d3d':'';}}
async function surveysInitCatalogV299(){
  if(!canManageUsersV281){surveysMessageV299('Google Forms 조사 생성·결과 열람은 최고 관리자만 가능합니다.',true);return;}
  if(!surveysTemplatesCacheV299.length){
    surveysTemplatesCacheV299=await server('surveysTemplatesV299');
    $('surveysCategoryV299').innerHTML=surveysTemplatesCacheV299.map(x=>`<option value="${escapeH(x.id)}">${escapeH(x.label)}</option>`).join('');
    surveysChooseV299();
  }
}
function surveysChooseV299(){
  const t=surveysTemplatesCacheV299.find(x=>x.id===$('surveysCategoryV299').value);if(!t)return;
  $('surveysTitleV299').value='군수계 · '+t.label+' 조사';
  $('surveysTemplateV299').innerHTML='<b>기본 질문</b><div>기수 · 중대 · 이름 (필수)</div>'+t.fields.map(f=>`<div>${escapeH(f.title)} ${f.required?'(필수)':''}${f.options&&f.options.length?' · '+escapeH(f.options.join(' / ')):''}</div>`).join('');
}
async function surveysEnterV299(silent=false){
  if(surveysLoadingV299||!canManageUsersV281)return;
  surveysLoadingV299=true;if(!silent)surveysMessageV299('설문 목록을 불러오는 중...');
  try{
    await surveysInitCatalogV299();
    const response=await server('surveysStatusV299');surveysListCacheV299=response.forms||[];
    const book=$('surveysBookV299');
    book.href=response.bookUrl||'#';book.classList.toggle('hidden',!response.bookUrl);
    $('surveysCountV299').textContent=surveysListCacheV299.length+'개 설문';
    $('surveysFormsV299').innerHTML=surveysListCacheV299.length?surveysListCacheV299.map(s=>`<article class="v299-form-card"><div class="v299-card-title"><b>${escapeH(s.title)}</b><span class="v299-count">${s.count}명 응답</span></div><small>${escapeH(s.category)} · ${escapeH(s.createdAt)}</small><div class="v299-actions"><a class="btn" href="${escapeH(s.publishedUrl)}" target="_blank" rel="noopener noreferrer">응답 링크</a><a class="btn" href="${escapeH(s.editUrl)}" target="_blank" rel="noopener noreferrer">Google Form 편집</a><button class="btn btn-primary" type="button" data-v299-results="${escapeH(s.id)}">결과 보기</button></div></article>`).join(''):'<div class="v299-empty">아직 만든 설문이 없습니다. 위에서 조사 항목을 선택해 새 Google Form을 생성하세요.</div>';
    if(!silent)surveysMessageV299('최신 설문 목록을 불러왔습니다. 실제 응답은 제출 시 자동 저장돼요.');
    if(surveysCurrentV299 && surveysListCacheV299.some(x=>x.id===surveysCurrentV299))await surveysShowResultsV299(surveysCurrentV299,true);
  }catch(e){surveysMessageV299('조회 실패: '+e.message,true);}
  finally{surveysLoadingV299=false;}
}
async function surveysCreateClickV299(){
  if(!canManageUsersV281)return;
  const category=$('surveysCategoryV299').value,title=$('surveysTitleV299').value.trim();
  if(!title)return alert('조사 제목을 입력하세요.');
  if(!confirm('Google Forms 설문을 새로 만들고 응답 자동 집계를 활성화할까요?\n기존 명단·총기·군수품 등 운영자료는 자동 수정하지 않습니다.'))return;
  const btn=$('surveysCreateV299');btn.disabled=true;surveysMessageV299('Google Form과 조사 전용 응답 시트를 생성하고 자동 집계 트리거를 연결하고 있습니다...');
  try{
    const created=await server('surveysCreateV299',{category,title,description:$('surveysDescV299').value.trim(),extraQuestions:$('surveysExtraV299').value});
    $('surveysExtraV299').value='';surveysMessageV299('설문 생성 완료. 응답 링크로 조사를 배포할 수 있어요.');
    await surveysEnterV299(true);
    alert('설문 생성 완료!\n응답 링크: '+created.publishedUrl+'\n관리 화면에서 바로 열고 복사할 수 있습니다.');
  }catch(e){surveysMessageV299('설문 생성 실패: '+e.message,true);alert('설문 생성 실패: '+e.message);}
  finally{btn.disabled=false;}
}
async function surveysShowResultsV299(id,silent=false){
  surveysCurrentV299=id;if(!silent)$('surveysResultsV299').innerHTML='<div class="v299-empty">응답을 조회하는 중...</div>';
  try{
    const r=await server('surveysResponsesV299',id);
    if(surveysCurrentV299!==id)return;
    const result=$('surveysResultsV299');
    result.innerHTML=`<div class="v299-result-head"><b>${escapeH(r.title)}</b><span>${r.total}건 제출 · 최근 100건 표시</span></div>`+(r.items&&r.items.length?r.items.map(x=>`<details class="v299-answer"><summary><b>${escapeH(x.name||'이름 미입력')}</b> · ${escapeH(x.cohort)} ${escapeH(x.company)} · ${escapeH(x.submittedAt)}</summary><dl>${Object.entries(x.answers||{}).map(([k,v])=>`<dt>${escapeH(k)}</dt><dd>${escapeH(v)}</dd>`).join('')}</dl></details>`).join(''):'<div class="v299-empty">제출된 응답이 아직 없습니다.</div>');
  }catch(e){surveysMessageV299('응답 조회 실패: '+e.message,true);}
}
function surveysInitV299(){
  $('surveysCategoryV299').addEventListener('change',surveysChooseV299);
  $('surveysCreateV299').addEventListener('click',surveysCreateClickV299);
  $('surveysRefreshV299').addEventListener('click',()=>surveysEnterV299());
  $('surveysFormsV299').addEventListener('click',e=>{const x=e.target.closest('[data-v299-results]');if(x)surveysShowResultsV299(x.dataset.v299Results);});
  // 폼 제출 직후 데이터는 서버 트리거로 저장; 열려 있는 관리자 화면은 20초마다 새 응답 확인.
  setInterval(()=>{if(view==='surveys'&&ready&&canManageUsersV281)surveysEnterV299(true);},20000);
}

init();


// v2.91 · 성무기초군사훈련 명단/예비자산/피복 전용 UI. 공유 업무일지 동작은 변경하지 않음.
let trainV291WorkspaceOpen=false;
let trainV291Extra={reserve:[],uniform:[],uniformItems:[]};
async function trainV291Open(){
 try{
  const info=await server('getTrainFoundationV289');if(!info.created){alert('성무훈련 전용 파일을 먼저 만들어 주세요.');return;}
  trainV291WorkspaceOpen=true;$('v289LegacyTrainingUI').style.display='block';
  await trainReloadV227();
  if(trainStateV227.initialized){trainStateV227.tab='roster';trainRenderV227();}
 }catch(e){alert('훈련 관리 화면을 열 수 없습니다: '+e.message);}
}
function trainV291SelectPeople_(id,rows){
 const el=$(id),old=el.value;el.innerHTML='<option value="">대상 선택</option>'+rows.map(p=>`<option value="${trainEscapeV227(p.id)}">${trainEscapeV227(p.cohort+' '+p.company+'중대 '+p.name+' ('+(p.cadetNumber||'교번 없음')+')')}</option>`).join('');
 if(rows.some(x=>x.id===old))el.value=old;
}
function trainRenderUniformV291(){
 const a=trainV291Extra,people=trainStateV227.roster||[];if(!a.uniformItems?.length){$('trainV291UniformFields').innerHTML='<p class="train-help">성무훈련 명단·물품 초기 준비 후 표시됩니다.</p>';return;}
 trainV291SelectPeople_('trainV291UniformPerson',people);
 const id=$('trainV291UniformPerson').value;
 $('trainV291UniformFields').innerHTML=a.uniformItems.map(item=>{
  const row=(a.uniform||[]).find(u=>u.personId===id&&u.itemName===item);const safe=trainEscapeV227(item);
  return `<label>${safe}<input class="field" data-train-uniform="${safe}" maxlength="32" value="${trainEscapeV227(row?.size||'')}" placeholder="사이즈 입력" ${trainCanChangeV227()?'':'disabled'}></label>`;
 }).join('');
 $('trainV291UniformSave').disabled=!trainCanChangeV227()||!id;
 $('trainV291UniformInfo').textContent=id?'선택 인원의 피복 사이즈를 저장합니다. 빈 칸은 해당 품목을 삭제합니다.':'먼저 현재 명단에서 대상 인원을 선택하세요.';
}
async function trainV291SaveUniform(){const id=$('trainV291UniformPerson').value;if(!id)return alert('대상 인원을 선택하세요.');
 const sizes={};document.querySelectorAll('[data-train-uniform]').forEach(el=>sizes[el.dataset.trainUniform]=el.value.trim());
 try{await enqueue(()=>server('trainSaveUniformV291',id,sizes));trainV291Extra=await server('trainGetReserveV291');trainRenderUniformV291();toast('훈련 피복 사이즈표 저장 완료');}catch(e){alert('피복 저장 실패: '+e.message);}}
function trainRenderReserveV291(){
 const a=trainV291Extra,people=trainStateV227.roster||[];
 trainV291SelectPeople_('trainV291Recipient',people);
 const all=a.reserve||[],ready=all.filter(x=>!x.assignedPersonId),used=all.length-ready.length;
 $('trainV291ReserveStats').textContent=`예비 자산 전체 ${all.length}건 · 재배정 가능 ${ready.length}건 · 재배정 완료 ${used}건`;
 $('trainV291ReserveRows').innerHTML=all.length?all.map(r=>`<tr><td>${!r.assignedPersonId&&trainCanChangeV227()?`<input type="checkbox" data-train-reserve="${trainEscapeV227(r.id)}">`:'—'}</td><td>${trainEscapeV227(r.kind)}</td><td>${trainEscapeV227(r.itemName)}</td><td>${trainEscapeV227(r.value)}</td><td>${trainEscapeV227(r.quantity)}</td><td>${trainEscapeV227(r.fromName)}</td><td>${r.assignedPersonId?'재배정 완료':'재배정 가능'}</td></tr>`).join(''):'<tr><td colspan="7">회수·예비보관된 총기·군수품·피복 사이즈가 없습니다.</td></tr>';
 $('trainV291ReserveApply').disabled=!trainCanChangeV227()||!ready.length;
}
async function trainV291ReloadExtra(){try{trainV291Extra=await server('trainGetReserveV291');trainRenderUniformV291();trainRenderReserveV291();toast('예비 자산 현황을 새로고침했습니다.');}catch(e){alert('예비 현황 조회 실패: '+e.message);}}
async function trainV291Exit(id){const p=trainStateV227.roster.find(x=>x.id===id);if(!p)return;
 if(!confirm(`${p.name} 예비생도를 퇴소 처리할까요?\n\n훈련 현재 명단, 군수품, 피복 사이즈에서 삭제되고, 물품은 예비 현황으로 옮겨집니다.\n\n실제 총기·물품을 모두 회수했는지 먼저 확인해 주세요.`))return;
 if(prompt('실제 회수를 확인했다면 아래에 “회수확인”을 정확히 입력해 주세요.')!=='회수확인')return;
 try{const res=await enqueue(()=>server('trainExitCadetV291',p.id,p.updatedAt,true));await trainReloadV227();toast(p.name+' 퇴소 처리 · 예비 자산 '+res.assets+'건 보관');}
 catch(e){alert('퇴소 처리 실패: '+e.message);}}
async function trainV291Apply(){const personId=$('trainV291Recipient').value,ids=Array.from(document.querySelectorAll('[data-train-reserve]:checked')).map(x=>x.dataset.trainReserve);
 if(!personId)return alert('먼저 명단에서 재입소한 대상을 선택하세요.');if(!ids.length)return alert('총기번호·군수품·피복 사이즈 중 사용할 자산을 체크하세요.');
 const p=trainStateV227.roster.find(x=>x.id===personId);if(!confirm(p.name+' 생도에게 체크한 '+ids.length+'개 자산을 배정할까요?'))return;
 try{const r=await enqueue(()=>server('trainApplyReserveV291',personId,ids));await trainReloadV227();toast(r.name+' · 자산 '+r.assigned+'건 배정 완료');}
 catch(e){alert('재배정 실패: '+e.message+'\n중간에 오류가 나면 새로고침 후 현재 명단·예비 자산을 확인하세요.');}}
$('trainV291OpenWorkspace').addEventListener('click',trainV291Open);
$('trainV291UniformPerson').addEventListener('change',trainRenderUniformV291);
$('trainV291UniformReload').addEventListener('click',trainV291ReloadExtra);
$('trainV291UniformSave').addEventListener('click',trainV291SaveUniform);
$('trainV291ReserveRefresh').addEventListener('click',trainV291ReloadExtra);
$('trainV291ReserveApply').addEventListener('click',trainV291Apply);



/* v2.93 · 캘린더 공통 상태 색상, 마감일 표기, 진행 중 업무 목록 */
function v293StatusName(e){return String(e&&e.status||'미착수');}
function v293StatusColor(e){const s=v293StatusName(e);return s==='진행 중'?'progress':s==='보류'?'paused':s==='완료'?'complete':'waiting';}
function v293StatusDot(e){const s=v293StatusName(e);return `<span class="v293-state-dot v293-${v293StatusColor(e)}" title="${escapeH(s)}" aria-label="상태: ${escapeH(s)}"></span>`;}
function v293DueText(e){const today=localISO();return e.due===today?`${e.title}(마감)`:e.due<today&&e.status!=='완료'?`${e.title}(마감 경과)`:`마감일(${e.title})`;}
function v293DuePill(e){const late=e.due<localISO()&&e.status!=='완료';return `<span class="v293-due-pill ${late?'v293-overdue':'v293-'+v293StatusColor(e)}" title="${escapeH(e.due+' · '+e.title+' · '+v293StatusName(e))}">${v293StatusDot(e)}<span>${escapeH(v293DueText(e))}</span></span>`;}
function v293CategoryPills(records,max=2){
 const groups=new Map();for(const e of records){const k=(e.category||'기타')+'\t'+v293StatusColor(e);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(e);}
 const rows=[...groups.entries()];return rows.slice(0,max).map(([k,arr])=>{const first=arr[0],cat=first.category||'기타';return `<span class="v293-task-pill v293-${v293StatusColor(first)}" title="${escapeH(cat+' · '+v293StatusName(first)+' · '+arr.length+'건')}">${v293StatusDot(first)}<span>${escapeH(cat)}${arr.length>1?' '+arr.length:''}</span></span>`;}).join('')+(rows.length>max?`<small class="v293-more">업무 분류 +${rows.length-max}</small>`:'');
}
function v293OngoingRender(target,records){if(!target)return;
 const ongoing=records.filter(e=>e.status==='진행 중'&&journalVisibleOn(e,localISO())).sort((a,b)=>(a.due||'9999-99-99').localeCompare(b.due||'9999-99-99')||String(a.date).localeCompare(String(b.date)));
 const top=ongoing.slice(0,50);target.innerHTML=`<div class="v293-running-header"><b>진행 중인 업무</b><span class="v293-running-count">${ongoing.length}건</span></div><div class="v293-running-list">${top.length?top.map(e=>`<button class="v293-running-row" type="button" data-v293-open="${escapeH(e.id)}" aria-label="${escapeH(e.title)} 상세 보기"><span class="v293-state-dot v293-progress" aria-hidden="true"></span><span class="v293-running-main"><b>${escapeH(e.title)}</b><small>${escapeH(e.category||'기타')}${e.due?' · 마감 '+escapeH(e.due):''}</small></span><span aria-hidden="true">›</span></button>`).join(''):'<p class="v293-running-empty">진행 중인 업무가 없습니다.</p>'}${ongoing.length>50?`<p class="v293-running-empty">최근 마감 순서 50건 표시 · 전체 ${ongoing.length}건</p>`:''}</div>`;
}
function v293ClickOngoing(e){const item=e.target.closest('[data-v293-open]');if(item)showModal(item.dataset.v293Open);}

/* v2.92 · 공유 데이터, 분리된 성무훈련 업무일지/훈련 전용 캘린더 UI */
let trainJournalDateV292=localISO(),trainCalendarMonthV292=localISO().slice(0,7),trainCalendarSelectedV292=localISO();
const trainOnlyV292=e=>TRAIN_CATEGORY_RE_V290.test(String(e?.category||''));
const trainListV292=()=>data.entries.filter(trainOnlyV292);
function trainJournalRenderV292(){
 const items=trainListV292().filter(e=>journalVisibleOn(e,trainJournalDateV292)).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
 const day=$('trainJournalDayV292'), rows=$('trainJournalRowsV292'), count=$('trainJournalCountV292');if(!day||!rows||!count)return;
 day.value=trainJournalDateV292;count.textContent=prettyDate(trainJournalDateV292)+' · 기훈 업무 '+items.length+'건';
 rows.innerHTML=items.length?items.map(e=>`<article class="v292-task"><div class="v292-task-meta"><span class="v292-tag">${escapeH(e.category)}</span><span>${escapeH(e.time||'시간 미지정')} · ${escapeH(e.status||'미착수')}</span><span>${escapeH(e.owner||'작성자 미지정')}</span></div><b>${escapeH(e.title)}</b>${e.detail?`<p>${escapeH(e.detail)}</p>`:''}${e.follow?`<p>추후 조치: ${escapeH(e.follow)}</p>`:''}<div class="v292-actions"><button class="btn btn-soft" type="button" data-v292-edit="${escapeH(e.id)}">${canEditJournal?'상세 · 수정':'상세'}</button>${canEditJournal?`<button class="btn" type="button" data-v292-delete="${escapeH(e.id)}">삭제</button>`:''}</div></article>`).join(''):'<div class="v292-empty">이 날짜에 등록된 성무기초군사훈련 업무가 없습니다.</div>';
 $('trainJournalAddV292').classList.toggle('hidden',!canEditJournal);v298Render('training');
}
function trainCalendarRenderV292(){
 const ym=trainCalendarMonthV292,[year,month]=ym.split('-').map(Number),first=new Date(year,month-1,1).getDay(),days=new Date(year,month,0).getDate(),rows=trainListV292();
 const label=$('trainCalendarMonthLabelV292'),grid=$('trainCalendarGridV292'),detail=$('trainCalendarDetailsV292');if(!label||!grid||!detail)return;
 label.textContent=year+'년 '+month+'월';
 const grouped=new Map(),dueByDay=new Map();const push=(map,date,e)=>{if(!map.has(date))map.set(date,[]);map.get(date).push(e)};
 rows.forEach(e=>{if((e.date||'').startsWith(ym))push(grouped,e.date,e);if((e.due||'').startsWith(ym))push(dueByDay,e.due,e);});
 const gridStart=calendarShift(ym+'-01',-first),count=Math.ceil((first+days)/7)*7,dayDetails={};
 for(let i=0;i<count;i++){const day=calendarShift(gridStart,i);dayDetails[day]=(dueByDay.get(day)||[]).slice(0,2).map(v293DuePill).join('');}
 grid.innerHTML=calendarHTML(rows,{start:gridStart,count,today:localISO(),selected:trainCalendarSelectedV292,month:ym,training:true,details:dayDetails});
 const chosen=rows.filter(e=>journalVisibleOn(e,trainCalendarSelectedV292)).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
 const dueSelected=rows.filter(e=>e.due===trainCalendarSelectedV292);
 $('trainCalendarDateLabelV292').textContent=prettyDate(trainCalendarSelectedV292)+' · 훈련 업무 '+chosen.length+'건 · 마감 '+dueSelected.length+'건';
 let blocks=[];
 if(chosen.length)blocks=chosen.map(e=>`<div class="v292-task"><div class="v292-task-meta"><span class="v292-tag">${v293StatusDot(e)} ${escapeH(e.category)}</span><span>${escapeH(e.time||'시간 미지정')}</span></div><b>${escapeH(e.title)}</b>${e.detail?`<p>${escapeH(truncate(e.detail,400))}</p>`:''}<div class="v292-actions"><button type="button" class="btn btn-soft" data-v292-edit="${escapeH(e.id)}">업무 상세 ${canEditJournal?'· 수정':''}</button></div></div>`);
 if(dueSelected.length)blocks.push(`<div class="v293-calendar-subhead">이날 마감되는 훈련 업무</div>`,...dueSelected.map(e=>`<div class="v292-task"><div class="v292-task-meta"><span class="v293-due-label">${v293StatusDot(e)} ${escapeH(v293DueText(e))}</span></div><b>${escapeH(e.title)}</b><div class="v292-actions"><button class="btn btn-soft" type="button" data-v292-edit="${escapeH(e.id)}">업무 상세 보기</button></div></div>`));
 detail.innerHTML=blocks.length?blocks.join(''):'<div class="v292-empty">선택한 날짜에 훈련 업무가 없습니다.</div>';
 $('trainCalendarAddV292').classList.toggle('hidden',!canEditJournal);
 v293OngoingRender($('trainOngoingPanelV293'),rows);
}
function trainCalendarShiftV292(delta){const [year,month]=trainCalendarMonthV292.split('-').map(Number),target=new Date(year,month-1+delta,1);trainCalendarMonthV292=localISO(target).slice(0,7);trainCalendarSelectedV292=trainCalendarMonthV292+'-01';trainCalendarRenderV292();}
function trainJournalNewV292(fromCalendar=false){trainJournalDateV292=fromCalendar?trainCalendarSelectedV292:trainJournalDateV292;showModal('');}
function trainJournalOpenDateV292(){trainJournalDateV292=trainCalendarSelectedV292;switchView('trainJournal');}
function trainV292Init(){
 qsa('[data-training-quick]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.trainingQuick)));
 $('trainFoundationOpenCalendarV292').addEventListener('click',()=>switchView('trainCalendar'));
 $('trainJournalDayV292').addEventListener('change',e=>{if(e.target.value){trainJournalDateV292=e.target.value;trainJournalRenderV292();}});
 $('trainJournalPrevV292').addEventListener('click',()=>{trainJournalDateV292=shiftDate(trainJournalDateV292,-1);trainJournalRenderV292();});
 $('trainJournalNextV292').addEventListener('click',()=>{trainJournalDateV292=shiftDate(trainJournalDateV292,1);trainJournalRenderV292();});
 $('trainJournalAddV292').addEventListener('click',()=>trainJournalNewV292());
 $('trainJournalCalendarV292').addEventListener('click',()=>{trainCalendarSelectedV292=trainJournalDateV292;trainCalendarMonthV292=trainJournalDateV292.slice(0,7);switchView('trainCalendar');});
 $('trainCalendarPrevV292').addEventListener('click',()=>trainCalendarShiftV292(-1));
 $('trainCalendarNextV292').addEventListener('click',()=>trainCalendarShiftV292(1));
 $('trainCalendarTodayV292').addEventListener('click',()=>{trainCalendarSelectedV292=localISO();trainCalendarMonthV292=trainCalendarSelectedV292.slice(0,7);trainCalendarRenderV292();});
 $('trainCalendarGridV292').addEventListener('click',e=>{const b=e.target.closest('[data-v292-day]');if(b){trainCalendarSelectedV292=b.dataset.v292Day;trainCalendarRenderV292();}});
 $('trainCalendarJournalV292').addEventListener('click',trainJournalOpenDateV292);
 $('trainCalendarAddV292').addEventListener('click',()=>trainJournalNewV292(true));
 const delegate=(e)=>{const edit=e.target.closest('[data-v292-edit]'),del=e.target.closest('[data-v292-delete]');if(edit)showModal(edit.dataset.v292Edit);else if(del)delEntry(del.dataset.v292Delete);};
 $('trainJournalRowsV292').addEventListener('click',delegate);$('trainCalendarDetailsV292').addEventListener('click',delegate);
}
trainV292Init();$('wxOngoingPanelV293').addEventListener('click',v293ClickOngoing);$('trainOngoingPanelV293').addEventListener('click',v293ClickOngoing);let v293TodaySeen=localISO();setInterval(()=>{const d=localISO();if(d!==v293TodaySeen){v293TodaySeen=d;if(view==='calendar')wxCalendarRender();if(view==='trainCalendar')trainCalendarRenderV292();}},60000);


let departuresDataV305=null,departuresBusyV305=false;
const departureEscapeV305=escapeH;
function departuresOptionsV305(values,selected=''){return '<option value="">처리 선택</option>'+values.map(x=>'<option'+(x===selected?' selected':'')+'>'+escapeH(x)+'</option>').join('');}
function departuresRenderV305(){
 const d=departuresDataV305;if(!d)return;const q=$('departuresSearch').value.trim().toLowerCase();
 const rows=d.candidates||[];
 $('departuresStatus').textContent=d.ready?'기준: '+d.source+' · '+d.referenceCount+'명 대조 · 처리 대상 '+rows.length+'명':d.error||'스마트당직 연결을 확인하세요.';
 $('departuresCandidates').innerHTML=rows.map(c=>{
  const match=!q||[c.name,c.cohort,c.company+'중대'].join(' ').toLowerCase().includes(q);
  return '<article class="departure-person" data-departure-id="'+escapeH(c.id)+'" '+(!match?'hidden':'')+'><div class="departure-person-head"><label><input type="checkbox" class="departure-pick"> <b>'+escapeH(c.cohort+' '+c.company+'중대 '+c.name)+'</b></label><span>'+(!c.roster?'피복만 남은 인원':'활동 명단 등록 인원')+'</span></div><div class="departure-fields"><label>관리 상태<select class="departure-state">'+departuresOptionsV305(['퇴교','퇴학','휴학','위탁'],c.suggestedStatus||'퇴교')+'</select></label><label>총기 '+escapeH(c.roster?.firearmNumber||'(활동 번호 없음)')+'<select class="departure-gun">'+departuresOptionsV305(['별도 보관','반납 완료','인계 완료','미지급 확인'])+'</select></label><label>피복 '+c.uniforms.length+'건<select class="departure-uniform" '+(!c.uniforms.length?'disabled':'')+'>'+departuresOptionsV305(['보관','반납 완료','인계 완료','미지급 확인'])+'</select></label></div><div class="departure-supply">'+(c.supplies.length?c.supplies.map(item=>'<label data-departure-item="'+escapeH(item.id)+'"><b>'+escapeH(item.name)+'</b> <span>'+escapeH([item.status,item.detail,Object.entries(item.extra||{}).map(([k,v])=>k+': '+v).join(' / ')].filter(Boolean).join(' · '))+'</span><select>'+departuresOptionsV305(['반납 완료','인계 완료','미지급 확인'])+'</select></label>').join(''):'<p>지급 기록이 있는 군수품 없음</p>')+'</div>'+(c.uniforms.length?'<details><summary>피복 사이즈 원본 확인</summary>'+c.uniforms.map(u=>'<p>'+escapeH(Object.entries(u.sizes||{}).map(([k,v])=>k+': '+v).join(' / ')||'사이즈 미입력')+'</p>').join('')+'</details>':'')+'<label>비고<input class="field departure-note" maxlength="400" placeholder="상태 이동 사유, 반납·인계 관련 사항"></label></article>';
 }).join('')||'<p>처리할 미등재 인원이 없습니다.</p>';
 $('departuresReview').textContent=(d.review||[]).map(x=>x.cohort+' '+x.company+'중대 '+x.name+' · '+x.reason).join(' / ')||'추가 확인 대상 없음';
 $('departuresArchived').textContent=(d.archived||[]).map(x=>x.cohort+' '+x.company+'중대 '+x.name+' · '+x.status).join(' / ')||'이동 관리 인원 없음';
 $('departuresHistory').innerHTML=(d.history||[]).map(x=>'<p>'+escapeH(x.at.slice(0,16).replace('T',' ')+' · '+x.name+' · '+x.status+' · 총기 '+x.gun+' · 피복 '+x.uniform+' · '+x.result)+'</p>').join('')||'<p>처리 내역 없음</p>';
 for(const c of rows){if(c.priorStatus){const row=Array.from($('departuresCandidates').children).find(r=>r.dataset.departureId===c.id);if(row)row.querySelector('.departure-state').value=c.priorStatus;}}
}
async function departuresLoadV305(){
 if(departuresBusyV305)return;$('departuresStatus').textContent='스마트당직·총기·군수품·피복을 대조 중입니다…';
 try{departuresDataV305=await server('getDepartureDashboardV305');departuresRenderV305();}catch(e){departuresDataV305=null;$('departuresStatus').textContent='조회 실패: '+e.message;$('departuresCandidates').replaceChildren();}
}
async function departuresApplyV305(){
 if(departuresBusyV305||!departuresDataV305?.ready)return;
 const rows=Array.from($('departuresCandidates').querySelectorAll('[data-departure-id]')).filter(r=>r.querySelector('.departure-pick').checked);
 if(!rows.length)return alert('처리할 인원을 선택하세요.');
 const plans=[];
 for(const row of rows){
  const c=departuresDataV305.candidates.find(x=>x.id===row.dataset.departureId),dispositions={};
  for(const item of row.querySelectorAll('[data-departure-item]'))dispositions[item.dataset.departureItem]={action:item.querySelector('select').value,note:row.querySelector('.departure-note').value};
  const status=row.querySelector('.departure-state').value,gunAction=row.querySelector('.departure-gun').value,uniformAction=row.querySelector('.departure-uniform').value;
  if(!status||!gunAction||(c.uniforms.length&&!uniformAction)||Object.values(dispositions).some(x=>!x.action))return alert(c.name+'의 관리 상태와 총기·군수품·피복 처리 결과를 모두 확인하세요.');
  plans.push({id:c.id,token:c.token,status,gunAction,uniformAction,dispositions,note:row.querySelector('.departure-note').value});
 }
 if(!confirm('선택한 '+plans.length+'명의 총기·군수품·피복을 함께 처리할까요?\n반납·인계가 실제로 완료되었는지 확인하세요. 인원별 결과를 기록하며 중간 실패 시 완료된 인원은 유지됩니다.'))return;
 departuresBusyV305=true;$('departuresView').setAttribute('aria-busy','true');$('departuresView').querySelectorAll('button,input,select').forEach(x=>x.disabled=true);const results=[];
 try{for(let i=0;i<plans.length;i++){
  $('departuresResult').textContent=(i+1)+' / '+plans.length+'명 처리 중…';
  try{const r=await enqueue(()=>server('processDepartureV305',plans[i]));results.push((r.name||'대상')+' · '+(r.ok?'완료'+(r.warnings?.length?' / 확인 필요: '+r.warnings.join(' / '):''):(r.partial?'일부 처리됨: ':'중단: ')+r.error));if(!r.ok)break;}
  catch(e){results.push('처리 중단: '+e.message+' · 자동 재시도하지 않습니다. 새로고침 후 실제 처리 내역을 확인하세요.');break;}
 }}finally{departuresBusyV305=false;$('departuresView').removeAttribute('aria-busy');$('departuresView').querySelectorAll('button,input,select').forEach(x=>x.disabled=false);rosterLoaded=false;supplyLoaded=false;uniformStateV278.loaded=false;await departuresLoadV305();$('departuresResult').textContent=results.join('\n');}
}
$('departuresRefresh').addEventListener('click',departuresLoadV305);
$('departuresSearch').addEventListener('input',()=>{const q=$('departuresSearch').value.trim().toLowerCase();for(const row of $('departuresCandidates').children)row.hidden=!!q&&!row.textContent.toLowerCase().includes(q);});
$('departuresSelect').addEventListener('click',()=>{$('departuresCandidates').querySelectorAll('[data-departure-id]').forEach(r=>{if(!r.hidden)r.querySelector('.departure-pick').checked=true;});});
$('departuresClear').addEventListener('click',()=>{$('departuresCandidates').querySelectorAll('.departure-pick').forEach(x=>x.checked=false);});
$('departuresApply').addEventListener('click',departuresApplyV305);
$('departuresSetStatus').addEventListener('click',()=>{const status=$('departuresBulkStatus').value;if(!status)return toast('관리 상태를 선택하세요.');const picked=$('departuresCandidates').querySelectorAll('.departure-pick:checked');if(!picked.length)return toast('대상 인원을 선택하세요.');picked.forEach(p=>p.closest('[data-departure-id]').querySelector('.departure-state').value=status);toast('선택 '+picked.length+'명에 '+status+' 상태를 지정했습니다. 물품 처리 결과 확인 후 일괄 처리하세요.');});
$('departuresLegacy').addEventListener('click',()=>{switchView('roster');smartSwitchV253('special');});

$('fDueTime').addEventListener('blur',()=>{normalizeTime24('fDueTime');updateFormHint();});
$('deleteJournalEntry').addEventListener('click',async()=>{const button=$('deleteJournalEntry');if(modalSaving||button.disabled)return;button.disabled=true;try{await delEntry($('entryId').value);}finally{button.disabled=false;}});

document.addEventListener('click',event=>{if(navEditModeV220)return;const button=event.target.closest('[data-view]');if(button&&button.dataset.view===view&&button.closest('#sidebarMenu,.mobile-nav')){event.preventDefault();event.stopImmediatePropagation();}},true);
function navOpenCatalogV301(){
 if(!navEditModeV220)return;
 const active=new Set(navTreeV233.groups.flatMap(g=>g.items));
 $('navAddGroupV301').innerHTML='<option value="">상위 메뉴 선택</option>'+NAV_GROUP_DEFAULT_V233.filter(g=>!navTreeV233.groups.some(x=>x.id===g.id)).map(g=>'<option value="'+escapeH(g.id)+'">'+escapeH(g.title)+'</option>').join('');
 $('navAddParentV301').innerHTML=navTreeV233.groups.map(g=>'<option value="'+escapeH(g.id)+'">'+escapeH(g.title)+'</option>').join('');
 $('navAddItemV301').innerHTML='<option value="">하위 메뉴 선택</option>'+navAllowedV221().filter(id=>!active.has(id)).map(id=>'<option value="'+escapeH(id)+'">'+escapeH(navItemDefaultTitleV233(id))+'</option>').join('');
 $('navCatalogV301').showModal();
}
function navAddCatalogV301(groupMode){
 if(groupMode){const id=$('navAddGroupV301').value,def=NAV_GROUP_DEFAULT_V233.find(g=>g.id===id);if(!def)return;
  const active=new Set(navTreeV233.groups.flatMap(g=>g.items));navTreeV233.groups.push({id:def.id,title:def.title,items:def.items.filter(item=>!active.has(item))});navExpandedV233.add(id);
 }else{const group=navTreeV233.groups.find(g=>g.id===$('navAddParentV301').value),id=$('navAddItemV301').value;if(!group||!id)return;group.items.push(id);navExpandedV233.add(group.id);}
 navTreeV233=navNormalizeV233({...navTreeV233,schemaVersion:2});$('navCatalogV301').close();navRenderV233();navUpdateDirtyV220();
}
async function navAttachCreatedV301(id){
 if(navTreeV233.groups.some(g=>g.items.includes(id)))return;
 let group=navTreeV233.groups.find(g=>g.id==='other')||navTreeV233.groups[0];
 if(!group){group={id:'other',title:'기타',items:[]};navTreeV233.groups.push(group);}
 group.items.push(id);navTreeV233.schemaVersion=2;
 const saved=await server('saveNavTreeV233',navTreeV233);navTreeV233=navNormalizeV233(saved);navSavedTreeV233=navDeepCopyV233(navTreeV233);navRenderV233();navUpdateDirtyV220();
}
$('navAddGroupButtonV301').addEventListener('click',()=>navAddCatalogV301(true));
$('navAddItemButtonV301').addEventListener('click',()=>navAddCatalogV301(false));
$('navCatalogCloseV301').addEventListener('click',()=>$('navCatalogV301').close());

$('trainCalendarGridV292').addEventListener('click',event=>{const entry=event.target.closest('[data-calendar-entry]');if(entry)showModal(entry.dataset.calendarEntry);});
const calendarOverview=document.createElement('dialog');calendarOverview.className='calendar-overview-dialog';calendarOverview.setAttribute('aria-label','월간 캘린더 한눈에 보기');document.body.append(calendarOverview);
let calendarOverviewAnchor=null,calendarOverviewPanel=null,calendarOverviewButton=null;
function restoreCalendarOverview(){if(calendarOverviewAnchor){calendarOverviewAnchor.replaceWith(calendarOverviewPanel);calendarOverviewButton.textContent='한눈에 보기';calendarOverviewButton.setAttribute('aria-expanded','false');calendarOverviewAnchor=null;}}
function closeCalendarOverview(){calendarOverview.close();restoreCalendarOverview();}
calendarOverview.addEventListener('close',()=>{if(!calendarOverview.open)restoreCalendarOverview();});
calendarOverview.addEventListener('cancel',event=>{event.preventDefault();closeCalendarOverview();});
for(const id of ['v298GeneralCalendar','v298TrainingCalendar','wxCalendarGrid','trainCalendarGridV292']){
 const grid=$(id),panel=grid?.closest('.panel');if(!panel)continue;
 const button=document.createElement('button');button.type='button';button.className='btn calendar-overview-button';button.textContent='한눈에 보기';button.setAttribute('aria-expanded','false');
 (panel.querySelector('.v298-controls,.panel-head .right,.panel-head,.v292-actions')||panel).append(button);
 button.addEventListener('click',()=>{if(calendarOverview.open){closeCalendarOverview();return;}calendarOverviewAnchor=document.createComment('calendar');panel.before(calendarOverviewAnchor);calendarOverviewPanel=panel;calendarOverviewButton=button;calendarOverview.append(panel);button.textContent='원래 화면으로';button.setAttribute('aria-expanded','true');calendarOverview.showModal();});
 grid.addEventListener('click',event=>{if(calendarOverview.open&&event.target.closest('[data-calendar-entry]'))closeCalendarOverview();},true);
}

const changeReadV309=new Set();
async function changeReadPageV309(page,ids){
 const selected=ids.filter(id=>!changeReadV309.has(id));if(!selected.length)return;
 const before=changeStateV283.unread.filter(x=>selected.includes(x.id));
 selected.forEach(id=>changeReadV309.add(id));
 changeStateV283.unread=changeStateV283.unread.filter(x=>!changeReadV309.has(x.id));changeRightRenderV283();
 try{await server('dismissChangePageV286',page,selected);}
 catch(e){selected.forEach(id=>changeReadV309.delete(id));const present=new Set(changeStateV283.unread.map(x=>x.id));changeStateV283.unread.push(...before.filter(x=>!present.has(x.id)));changeRightRenderV283();toast('확인 상태를 저장하지 못했습니다. 다시 확인해 주세요. '+e.message);}
}

function dormMemberCohortsV343(members){
 const clean=v=>String(v||'').normalize('NFKC').trim().replace(/기$/,'');
 const rows=members.map(p=>({...p,cohort:clean(p.cohort)}));
 const known=[...new Set(rows.map(p=>p.cohort).filter(c=>/^\d{2,3}$/.test(c)))];
 if(known.length===1)rows.forEach(p=>{if(!p.cohort)p.cohort=known[0];});
 return rows;
}
function dormPdfPeopleV365(tokens,limit){
 const lines=[];
 for(const t of [...tokens].sort((a,b)=>a.y-b.y||a.x-b.x)){
  let line=lines.find(l=>Math.abs(l.y-t.y)<3);if(!line){line={y:t.y,items:[]};lines.push(line);}line.items.push(t);
 }
 const people=[],text=lines.map(line=>line.items.sort((a,b)=>a.x-b.x).map(t=>t.str).join(' ')).join('\n').normalize('NFKC');let depth=0,owner=null,duty='';
 const finish=review=>{if(owner){owner.isDuty=true;const label=duty.replace(/\s+/g,'').trim();owner.duty=[owner.duty,label].filter(Boolean).join(' · ');if(review)owner.dutyReview=true;}duty='';};
 for(const part of text.match(/[^()]+|[()]/g)||[]){
  if(part==='('){if(depth===0){owner=people[people.length-1]||null;duty='';}else duty+='(';depth++;continue;}
  if(part===')'){if(depth){depth--;if(!depth)finish(false);else duty+=')';}continue;}
  if(depth){duty+=part;continue;}
  for(const name of part.split(/\s+/))if(/^[가-힣]{2,4}[A-D]?$/.test(name)&&!/(공실|독방|근무|중대|훈육|위원|동기|회장|총무|생도|화장|계단|보좌|문화|교육|명예|편집|사무)/.test(name)&&!people.some(p=>p.name===name)&&people.length<limit)people.push({name,isDuty:false,duty:''});
 }
 if(depth)finish(true);return people;
}
function dormPdfNamesV343(tokens,limit){
 return dormPdfPeopleV365(tokens,limit).map(p=>p.name);
}
function dormPdfMembersV343(names,oldMembers,reference,company){
 return dormMemberCohortsV343(names.map(name=>{
  const local=oldMembers.filter(p=>p.name===name);
  if(local.length===1&&local[0].cohort)return {...local[0]};
  const matches=reference.filter(p=>p.name===name&&(!company||String(p.company).normalize('NFKC').replace(/중대$/,'')===company));
  const identities=new Map(matches.filter(p=>p.cohort).map(p=>[[p.cohort,p.company,p.name].join('|'),p]));
  if(identities.size===1)return {...identities.values().next().value};
  return {name,company:local[0]?.company||company,cohort:''};
 }));
}
let dormPlanV315=null,dormPlanPdfV315=null,dormPlanDraftV315=null,dormPlanSelectedV315=null,dormPlanBusyV315=false,dormPlanRenderTaskV315=null,dormPlanRenderSequenceV315=0;
const dormPlanKeyV315=r=>[r.building,r.floor,String(r.room||'').split('-')[0]].join('|');
let dormPlanZoomV316=1;
function dormPlanSizeV316(mode){
 if(mode==='page'||mode==='width')dormPlanZoomV316=1;
 else if(typeof mode==='number')dormPlanZoomV316=Math.max(.8,Math.min(1.8,dormPlanZoomV316*mode));
 const box=$('dormPlanCanvasV315').parentElement;box.style.width='100%';box.style.setProperty('--room-size',Math.round(112*dormPlanZoomV316)+'px');box.style.setProperty('--plan-font',Math.round(13*dormPlanZoomV316)+'px');
 $('dormPlanZoomV316').textContent=Math.round(dormPlanZoomV316*100)+'%';
}
function dormPlanStatusV315(message){$('dormPlanStatusV315').textContent=message;}
async function dormPlanLoadV315(){
 if(!canEdit)return;
 if(dormPlanBusyV315)return;dormPlanBusyV315=true;
 if(dormPlanDraftV315&&!confirm('검토 중인 PDF 변경사항을 버리고 다시 불러올까요?')){dormPlanBusyV315=false;return;}
 try{
  dormPlanStatusV315('편성안 도면과 최신 배정명단을 불러오는 중…');
  const result=await server('getDormPlanV315');
  dormPlanV315=result;dormPlanDraftV315=null;dormPlanComparisonV318(result.comparison);
  dormPlanAddUnplacedV320(result);

  dormPlanSetPagesV315();await dormPlanRenderV315();
  $('dormPlanPublishV315').hidden=true;
  dormPlanStatusV315('저장된 PDF 기준본: '+result.filename+' · 배치 순서는 고정하고, 호실 ID로 연결된 최신 명단을 표와 함께 표시합니다.');
 }catch(e){dormPlanStatusV315('도면 조회 실패: '+e.message);}finally{dormPlanBusyV315=false;}
}
function dormPlanAddUnplacedV320(plan){
 const known=new Set(plan.layout.map(dormPlanKeyV315));let page=Math.max(0,...plan.layout.map(r=>r.page));const groups=new Map();
 for(const room of plan.rooms){if(known.has(dormPlanKeyV315(room)))continue;const group=[room.building,room.floor].join('|');
  if(!groups.has(group))groups.set(group,++page);
  plan.layout.push({building:room.building,floor:room.floor,room:room.room,page:groups.get(group),x:plan.layout.filter(r=>r.page===groups.get(group)).length,y:0,unplaced:true});
 }
}
let dormSyncTimerV320=null,dormSyncNeededV320=false;
function dormSyncScheduleV320(){
 dormSyncNeededV320=true;clearTimeout(dormSyncTimerV320);
 dormSyncTimerV320=setTimeout(async()=>{
  if(view!=='dorm'||!ready)return;
  if(dormPendingV237.size||dormPlanBusyV315||dormPlacementBusyV344||dormBulkBusyV237||dormPlanDraftV315||$('dormPlanRoomDialogV315').open||$('dormAddDialogV344').open){dormSyncScheduleV320();return;}
  dormSyncNeededV320=false;await dormReloadV234();await dormPlanLoadV315();
 },350);
}
async function dormTableEditV320(id){
 if(!mustEdit())return;if(dormPendingV237.size)return toast('저장 중인 변경이 완료된 뒤 편집하세요.');
 if(dormPlanDraftV315)return toast('PDF 검토를 적용하거나 다시 불러온 뒤 표를 편집하세요.');
 await dormPlanLoadV315();if(!dormPlanV315)return;
 const row=dormRoomsV234.find(r=>r.id===id),room=row&&dormPlanV315.rooms.find(r=>dormPlanKeyV315(r)===dormPlanKeyV315(row));
 if(!room)return toast('호실을 다시 불러온 뒤 편집하세요.');
 dormPlanEditV315({building:room.building,floor:room.floor,room:room.room});
}
function dormPlanComparisonV318(result){
 const box=$('dormPlanComparisonV318');if(!box)return;
 if(!result||result.error){box.textContent='명단 대조 확인 필요: '+(result?.error||'대조 자료 없음');return;}
 box.innerHTML=[['방 배정 누락 · 휴학·위탁·국외·파견·퇴학·퇴교 제외 후 스마트 당직에만 있음',result.missingRoom],['퇴교 대상 · 스마트 당직에 없음',result.missingSmart]].map(([title,items])=>'<details><summary>'+title+' ('+items.length+'명)</summary>'+(items.length?'<ul>'+items.map(p=>'<li>'+escapeH([String(p.cohort||'').normalize('NFKC').replace(/기$/,'')+'기',String(p.company||'').normalize('NFKC').replace(/중대$/,'')+'중대',p.name,p.location||''].join(' · '))+'</li>').join('')+'</ul>':'<p>누락 인원 없음</p>')+'</details>').join('')+'<p class="panel-sub">스마트 당직 상태 및 연결된 참고 시트의 휴학·위탁·국외·파견·퇴학·퇴교 '+Number(result.excludedCount||0)+'명을 제외했습니다. 기수·중대·이름을 대조하며, 참고 시트의 동명이인은 누락 목록에 남겨 확인합니다.</p>';
}
function dormPlanPageLabelV334(page,fallback){return ({2:'정예본관 1층 동쪽',3:'정예본관 2층 동쪽',4:'정예본관 1층 서쪽',5:'정예본관 2층 서쪽',6:'정예동관 1층',7:'정예동관 2층',8:'정예동관 3층',9:'정예서관 1층',10:'정예서관 2층',11:'정예서관 3층'})[page]||fallback;}
function dormPlanCorridorV334(index){return index<2?'북쪽복도':index<4?'남쪽복도':'배치 '+(index+1);}
function dormPlanSetPagesV315(){
 const layout=dormPlanDraftV315?.layout||dormPlanV315?.layout||[],old=$('dormPlanPageV315').value;
 const pages=[...new Set(layout.map(x=>x.page))].sort((a,b)=>a-b);
 $('dormPlanPageV315').innerHTML=pages.map(n=>{const r=layout.find(x=>x.page===n);return '<option value="'+n+'">'+n+'쪽 · '+escapeH(dormPlanPageLabelV334(n,r.building+' '+r.floor))+'</option>';}).join('');
 if(pages.includes(Number(old)))$('dormPlanPageV315').value=old;
}
function dormPlanRoomV315(layout){
 const scoped=dormPlanV315.rooms.filter(r=>r.building===layout.building&&r.floor===layout.floor);
 const exact=scoped.find(r=>layout.roomId?String(r.id)===String(layout.roomId):r.room===layout.room);
 const physical=scoped.filter(r=>r.room.split('-')[0]===layout.room.split('-')[0]);
 return (dormPlanDraftV315?.changes||[]).find(r=>dormPlanKeyV315(r)===dormPlanKeyV315(layout))||exact||(physical.length===1?physical[0]:null)||{...layout,members:[],group:((layout.room.match(/-([1-8])$/)||[])[1]||'')+'중대',corridor:'PDF 도면',token:'new'};
}
async function dormPlanRenderV315(){
 if(!dormPlanV315)return;
 const n=Number($('dormPlanPageV315').value),live=$('dormPlanLiveV315').checked;
 const layout=(dormPlanDraftV315?.layout||dormPlanV315.layout).filter(r=>r.page===n);
 const bands=[];
 layout.map((r,index)=>({r,index})).sort((a,b)=>a.r.y-b.r.y||a.r.x-b.r.x).forEach(item=>{
  let band=bands.find(b=>Math.abs(b.y-item.r.y)<.035);
  if(!band){band={y:item.r.y,items:[]};bands.push(band);}band.items.push(item);
 });
 $('dormPlanHotspotsV315').innerHTML=bands.map((band,i)=>'<section class="dorm-plan-band"><h3>'+dormPlanCorridorV334(i)+'</h3><div class="dorm-plan-grid">'+band.items.sort((a,b)=>a.r.x-b.r.x).map(({r,index})=>{
  const room=dormPlanRoomV315(r),members=room.members||[],text=members.map(p=>[p.cohort,p.company,p.name].join('.')).join(' / ');
  return '<button type="button" class="dorm-plan-room" data-plan-room="'+index+'" aria-label="'+escapeH(room.room+' '+text)+'"><b>'+escapeH(room.room)+'</b>'+(live?(members.length?members.map(p=>'<span class="dorm-plan-person" data-cohort="'+escapeH(p.cohort)+'"><small>'+escapeH((p.cohort||'?')+'기 · '+(p.company||'?')+'중대')+'</small><span>'+escapeH(p.name||'미확인')+'</span></span>').join(''):'<span class="dorm-plan-empty">'+(room.verified?'공실':'배정 확인 필요')+'</span>'):'<span class="dorm-plan-empty">'+escapeH(room.group||'미분류')+'</span>')+'</button>';
 }).join('')+'</div><button type="button" class="btn" data-plan-add-near="'+band.items[band.items.length-1].index+'">+ 방 추가</button></section>').join('');
 $('dormPlanHotspotsV315').onclick=async e=>{if(dormPlacementSkipClickV344){dormPlacementSkipClickV344=false;return;}if(dormPlacementBusyV344)return;const add=e.target.closest('[data-plan-add-near]');if(add){const anchor=layout[Number(add.dataset.planAddNear)];await $('dormAddOpenV344').onclick();if(!$('dormAddDialogV344').open)return;$('dormAddBuildingV344').value=anchor.building;$('dormAddFloorV344').value=anchor.floor;const rows=dormPlacementTargetsV344();$('dormAddTargetV344').value=String(rows.findIndex(r=>dormPlanKeyV315(r)===dormPlanKeyV315(anchor)));$('dormAddAfterV344').value='true';return;}const b=e.target.closest('[data-plan-room]');if(b)dormPlanEditV315(layout[Number(b.dataset.planRoom)]);};
 dormPlacementWireV344(layout);dormPlanSizeV316();
}
function dormPlanMemberRowV315(p,index){return '<tr><td>'+(index+1)+'</td><td><input class="field" aria-label="중대" data-plan-company maxlength="1" inputmode="numeric" value="'+escapeH(p.company||'')+'"></td><td><input class="field" aria-label="기수" data-plan-cohort maxlength="3" inputmode="numeric" value="'+escapeH(p.cohort||'')+'"></td><td><input class="field" aria-label="이름" data-plan-name maxlength="60" value="'+escapeH(p.name||'')+'"></td><td><button type="button" class="btn" data-plan-remove>제외</button> <button type="button" class="btn" data-plan-single>독방</button></td></tr>';}
function dormPlanEditV315(layout){
 const room=dormPlanRoomV315(layout);dormPlanSelectedV315={...layout,...room};
 $('dormPlanRoomTitleV315').textContent=[layout.building,layout.floor,layout.room].join(' · ');
 $('dormPlanMembersV315').innerHTML=(room.members||[]).map(dormPlanMemberRowV315).join('');
 const parts=room.room.split('-');$('dormPlanNumberV316').value=parts[0];$('dormPlanSuffixV316').value=parts[1]||'';
 $('dormPlanGroupV315').value=['1중대','2중대','3중대','4중대','5중대','6중대','7중대','8중대','전(대)대','동생명','여생도','미분류'].includes(room.group)?room.group:'미분류';
 $('dormPlanFemaleV315').checked=!!room.femaleRoom;
 $('dormPlanRoomReviewV315').textContent='괄호: 근무 · 기수 1명 확인 시 빈 기수에 적용 · 1명 배정: 독방';
 $('dormPlanRoomDialogV315').showModal();
}
async function dormPlanSaveRoomV315(){
 const selected=dormPlanSelectedV315;if(!selected)return;
 const members=dormMemberCohortsV343(Array.from($('dormPlanMembersV315').querySelectorAll('tr')).map(row=>({company:row.querySelector('[data-plan-company]').value.trim(),cohort:row.querySelector('[data-plan-cohort]').value.trim(),name:row.querySelector('[data-plan-name]').value.trim(),female:$('dormPlanFemaleV315').checked})).filter(p=>p.name));
 if(members.some(p=>! /^[1-8]$/.test(p.company)||! /^\d{2,3}$/.test(p.cohort)||!p.name))return alert('배정자마다 중대·기수·이름을 입력하세요.');
 const number=$('dormPlanNumberV316').value.trim(),suffix=$('dormPlanSuffixV316').value;
 if(!/^\d{3}$/.test(number))return alert('호실 번호는 세 자리 숫자로 입력하세요.');
 const room=number+(suffix?'-'+suffix:''),previousRoom=selected.previousRoom||selected.room;
 const layoutList=dormPlanDraftV315?.layout||dormPlanV315.layout;
 if(layoutList.some(r=>r.building===selected.building&&r.floor===selected.floor&&r.room===room&&r.room!==selected.room))return alert('같은 관·층에 해당 호실이 이미 있습니다.');
 const change={...selected,room,previousRoom,group:/^[1-8]$/.test(suffix)?suffix+'중대':$('dormPlanGroupV315').value,femaleRoom:$('dormPlanFemaleV315').checked,members};
 if(dormPlanDraftV315){
  const index=dormPlanDraftV315.changes.findIndex(r=>dormPlanKeyV315(r)===dormPlanKeyV315(selected));
  const anchor=dormPlanDraftV315.layout.find(r=>dormPlanKeyV315(r)===dormPlanKeyV315(selected));if(anchor)anchor.room=room;
  change.reviewed=true;if(index<0)dormPlanDraftV315.changes.push(change);else dormPlanDraftV315.changes[index]=change;
  $('dormPlanRoomDialogV315').close();await dormPlanRenderV315();dormPlanStatusV315('PDF 후보 '+dormPlanDraftV315.layout.length+'호 · 검토 완료 '+dormPlanDraftV315.changes.filter(x=>x.reviewed).length+'호. 갱신 적용 시 검토한 배정만 저장합니다.');return;
 }
 $('dormPlanRoomSaveV315').disabled=true;
 try{await enqueue(()=>server('saveDormPlanV315',{version:dormPlanV315.version,changes:[change]}));$('dormPlanRoomDialogV315').close();await dormPlanRefreshLinksV315();await dormPlanLoadV315();toast('배정 저장 완료 · 생활실 인원과 연결된 파일에 반영했습니다.');}
 catch(e){alert('배정 저장 실패: '+e.message);}finally{$('dormPlanRoomSaveV315').disabled=false;}
}
async function dormPlanRefreshLinksV315(){
 dormLoadedV234=false;eqLoaded=false;repairLoaded=false;
 if(typeof assetDataV244!=='undefined')assetDataV244=null;
 await dormReloadV234();
 // 다른 화면은 다음 진입 시 최신 통합명단을 다시 조회합니다.
 if(typeof laborResultV259!=='undefined')laborResultV259=null;
}
async function dormPlanUploadV315(){
 const file=$('dormPlanFileV315').files[0];if(!file)return;
 if(file.size>7*1024*1024)return alert('PDF는 7MB 이하로 올려 주세요.');
 if(!dormPlanV315)await dormPlanLoadV315();if(!dormPlanV315)return;
 if(dormPlanDraftV315&&!confirm('검토 중인 PDF를 새 파일로 바꿀까요?'))return;
 try{
  dormPlanStatusV315('새 PDF의 도면과 호실 좌표를 분석하는 중…');await loadPdfJsV273();
  if(!dormPlanV315.base64){const original=await server('getDormPlanV315',true);if(original.version!==dormPlanV315.version)throw Error('도면이 변경되었습니다. 다시 불러오세요.');dormPlanV315.base64=original.base64;}
  const bytes=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('PDF 파일을 선택하세요.');
  let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));const base64=btoa(binary),samePdf=base64===dormPlanV315.base64;
  const pdf=await pdfjsLib.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;if(pdf.numPages>50)throw Error('PDF는 50쪽 이하만 지원합니다.');
  const layout=[],changes=[],seen=new Set();
  for(let n=1;n<=pdf.numPages;n++){
   const page=await pdf.getPage(n),vp=page.getViewport({scale:1}),text=await page.getTextContent(),op=await page.getOperatorList();
   const tokens=text.items.filter(t=>t.str?.trim()).map(t=>{const point=vp.convertToViewportPoint(t.transform[4],t.transform[5]);return {str:t.str.trim(),x:point[0],y:point[1],width:t.width,height:t.height};});
   for(const t of tokens)if(/^\d{3}-$/.test(t.str)){const next=tokens.find(n=>/^[1-8동생명여女]$/.test(n.str)&&Math.abs(n.y-t.y)<2&&Math.abs(n.x-t.x-t.width)<6);if(next){t.str+=next.str.replace('女','여');t.width=next.x+next.width-t.x;}}
   const title=tokens.filter(t=>t.y<50).map(t=>t.str).join('').replace(/\s/g,''),b=(title.match(/정예(본관|동관|서관)/)||[])[1]||(/별관/.test(title)?'별관':''),f=(title.match(/([123])층/)||[])[1];if(!b||!f)continue;
   const boxes=[];for(let i=0;i<op.fnArray.length;i++)if(op.fnArray[i]===pdfjsLib.OPS.constructPath){const a=op.argsArray[i][2];if(a?.length===4){const rect=vp.convertToViewportRectangle([a[0],a[2],a[1],a[3]]),x=Math.min(rect[0],rect[2]),y=Math.min(rect[1],rect[3]),w=Math.abs(rect[2]-rect[0]),h=Math.abs(rect[3]-rect[1]);if(w>20&&w<100&&h>8&&h<160)boxes.push({x,y,width:w,height:h});}}
   const anchors=tokens.flatMap(t=>[...t.str.matchAll(/(?:^|\s)(\d{3}(?:-[1-8동생명여])?)(?=\s|$)/g)].map(m=>({...t,str:m[1],x:t.x+t.width*(m.index+m[0].indexOf(m[1]))/t.str.length,width:t.width*m[1].length/t.str.length}))).filter(t=>t.y>45);
   for(const a of anchors){const r={building:b==='별관'?b:'정예 '+b,floor:f+'층',room:a.str,sourceRoom:a.str,page:n};
    if(samePdf){const known=dormPlanV315.layout.find(l=>l.building===r.building&&l.floor===r.floor&&l.page===n&&l.sourceRoom===a.str);if(known)r.room=known.room;}
    else if(/^\d{3}$/.test(r.room)){const matches=dormPlanV315.rooms.filter(old=>old.building===r.building&&old.floor===r.floor&&old.room.split('-')[0]===r.room);if(matches.length===1)r.room=matches[0].room;}
    let box=boxes.filter(b=>b.height>50&&a.x+a.width/2>b.x&&a.x+a.width/2<b.x+b.width&&a.y>b.y&&a.y<b.y+25).sort((a,b)=>a.width*a.height-b.width*b.height)[0];
    if(!box){const header=boxes.filter(b=>b.height<26&&a.x+a.width/2>b.x&&a.x+a.width/2<b.x+b.width&&a.y>b.y&&a.y<b.y+b.height+1).sort((a,b)=>a.width-b.width)[0];if(header){let bottom=header.y+header.height;for(let i=0;i<2;i++){const body=boxes.filter(b=>b.height>25&&Math.abs(b.x-header.x)<1&&Math.abs(b.width-header.width)<1&&Math.abs(b.y-bottom)<1).sort((a,b)=>b.height-a.height)[0];if(!body)break;bottom=body.y+body.height;}if(bottom>header.y+40&&bottom-header.y<160)box={...header,height:bottom-header.y};}}
    Object.assign(r,{x:Math.max(0,(box?box.x:a.x-3)/vp.width),y:Math.max(0,(box?box.y:a.y-a.height-2)/vp.height),width:(box?box.width:Math.max(30,a.width+6))/vp.width,height:(box?box.height:a.height+6)/vp.height,fullBox:!!box});
    const possible=dormPlanV315.rooms.filter(room=>room.building===r.building&&room.floor===r.floor&&room.room.split('-')[0]===r.room.split('-')[0]);
    const old=dormPlanV315.rooms.find(room=>dormPlanKeyV315(room)===dormPlanKeyV315(r))||(possible.length===1?possible[0]:null);
    if(old){r.room=old.room;r.roomId=old.id;}
    if(seen.has(dormPlanKeyV315(r)))continue;seen.add(dormPlanKeyV315(r));
    const region=box?tokens.filter(t=>t.x>=box.x&&t.x<box.x+box.width&&t.y>a.y+5&&t.y<box.y+box.height):[];
    const names=dormPdfNamesV343(region,r.building==='별관'?4:2);
    if(!old&&!names.length&&region.some(t=>/훈육관|중대장|화장실|샤워|세탁|건조|계단|휴게실|창고/.test(t.str)))continue;
    layout.push(r);
    const members=dormPdfMembersV343(names,old?.members||[],dormPlanV315.rooms.flatMap(room=>room.members||[]),(a.str.match(/-([1-8])$/)||[])[1]||'');
    const dutyPeople=dormPdfPeopleV365(region,r.building==='별관'?4:2);r.pdfMembers=members.map(p=>({...p,...Object.fromEntries(Object.entries(dutyPeople.find(d=>d.name===p.name)||{}).filter(([key])=>['duty','isDuty','dutyReview'].includes(key)))}));
    changes.push({...old,...r,members,group:old?.group||((a.str.match(/-([1-8])$/)||[])[1]||'')+'중대',corridor:old?.corridor||'PDF 도면',femaleRoom:old?.femaleRoom||/-여$/.test(a.str),token:old?.token||'new',reviewed:true});
   }
  }
  if(!layout.length)throw Error('호실 번호를 추출하지 못했습니다. 텍스트가 있는 편성안 PDF를 사용해 주세요.');
  dormPlanDraftV315={filename:file.name,base64,layout,changes};dormPlanPdfV315=pdf;
  dormPlanSetPagesV315();await dormPlanRenderV315();$('dormPlanPublishV315').hidden=false;
  dormPlanStatusV315('추출 '+layout.length+'호. PDF 배치와 명단을 기준본으로 저장합니다. 저장 후 표와 배치도에서 계속 수정할 수 있습니다.');
  await dormPlanPublishV315();
 }catch(e){dormPlanStatusV315('PDF 분석 실패: '+e.message);}
}
async function dormPlanPublishV315(){
 const draft=dormPlanDraftV315;if(!draft)return;
 const changes=draft.changes.filter(x=>x.reviewed);
 if(!confirm('PDF의 '+draft.layout.length+'호 배치와 배정명단을 새 기준본으로 저장할까요?\nPDF에 있는 호실의 기존 명단을 교체하고 원본을 백업합니다. 기수·중대가 확인되지 않은 이름도 확인 필요로 기록합니다. PDF에 없는 방은 유지합니다.'))return;
 $('dormPlanPublishV315').disabled=true;
 try{const result=await enqueue(()=>server('saveDormPlanV315',{version:dormPlanV315.version,pdfImport:true,pdf:{filename:draft.filename,base64:draft.base64,layout:draft.layout},changes}));dormPlanDraftV315=null;await dormPlanRefreshLinksV315();await dormPlanLoadV315();toast('PDF 기준본 저장 · '+result.rooms+'호 배정 반영 완료');}
 catch(e){alert('PDF 갱신 실패: '+e.message);}finally{$('dormPlanPublishV315').disabled=false;}
}
function dormPlanInitV315(){
 const originalServer=server;
 server=async function(method,...args){
  const result=await originalServer(method,...args);
  if(/^(save|delete|remove|import|apply|restore|unify|initialize|bulkSet|clear|set|add|move|change)/.test(method)){
   repairLoaded=false;
   if(/Dorm|LivingSource|SmartDuty/.test(method)){
    if(typeof assetDataV244!=='undefined')assetDataV244=null;
    if(typeof laborResultV259!=='undefined')laborResultV259=null;
    dormLoadedV234=false;if(method!=='saveDormPlanV315')dormSyncScheduleV320();
   }
   if(/Roster|SmartDuty|Departure/.test(method)){if(view!=='roster')rosterLoaded=false;if(view!=='supply')supplyLoaded=false;smartReportV253=null;departuresDataV305=null;}
   if(/Equipment/.test(method)&&view!=='equipment')eqLoaded=false;
  }
  return result;
 };
 $('dormRoomRows').addEventListener('click',e=>{
  if(!e.target.closest('[data-dorm-members-edit],[data-dorm-empty]'))return;
  e.stopImmediatePropagation();const row=e.target.closest('[data-dorm-id]');if(row)dormTableEditV320(row.dataset.dormId);
 },true);
 $('dormRoomRows').addEventListener('change',e=>{
  if(!e.target.closest('[data-dorm-count]'))return;e.stopImmediatePropagation();
  const row=e.target.closest('[data-dorm-id]');dormRenderV234();if(row)dormTableEditV320(row.dataset.dormId);
 },true);
 const originalOpen=dormOpenV234;
 dormOpenV234=function(){originalOpen();if(dormSyncNeededV320||!dormPlanV315)dormSyncScheduleV320();};
 $('dormPlanMinusV316').onclick=()=>dormPlanSizeV316(1/1.2);$('dormPlanPlusV316').onclick=()=>dormPlanSizeV316(1.2);
 $('dormPlanWidthV316').onclick=()=>dormPlanSizeV316('width');$('dormPlanFitV316').onclick=()=>dormPlanSizeV316('page');
 window.addEventListener('resize',()=>dormPlanSizeV316());
 $('dormPlanSuffixV316').onchange=()=>{const s=$('dormPlanSuffixV316').value;if(/^[1-8]$/.test(s))$('dormPlanGroupV315').value=s+'중대';};
 window.addEventListener('beforeunload',e=>{if(dormPlanDraftV315||$('dormPlanRoomDialogV315').open){e.preventDefault();e.returnValue='';}});
 $('dormPlanLoadV315').onclick=dormPlanLoadV315;$('dormPlanPageV315').onchange=()=>dormPlanRenderV315();$('dormPlanLiveV315').onchange=()=>dormPlanRenderV315();
 $('dormPlanFileV315').onchange=dormPlanUploadV315;$('dormPlanPublishV315').onclick=dormPlanPublishV315;
 $('dormPlanRoomSaveV315').onclick=dormPlanSaveRoomV315;$('dormPlanRoomCloseV315').onclick=()=>$('dormPlanRoomDialogV315').close();
 $('dormPlanAddMemberV315').onclick=()=>{const rows=$('dormPlanMembersV315').querySelectorAll('tr');if(rows.length>=(dormPlanSelectedV315?.building==='별관'?4:2))return toast('호실 정원에 도달했습니다.');$('dormPlanMembersV315').insertAdjacentHTML('beforeend',dormPlanMemberRowV315({},rows.length));};
 $('dormPlanMembersV315').onclick=e=>{if(e.target.closest('[data-plan-remove]'))e.target.closest('tr').remove();if(e.target.closest('[data-plan-single]')){const row=e.target.closest('tr');if(!$('dormPlanMembersV315').querySelectorAll('tr')[1]||confirm('선택한 배정자만 남기고 독방으로 설정할까요?'))Array.from($('dormPlanMembersV315').querySelectorAll('tr')).forEach(other=>{if(other!==row)other.remove();});}};
 $('dormPlanRoomDialogV315').addEventListener('cancel',e=>{if(!confirm('입력 중인 편집을 닫을까요?'))e.preventDefault();});
}

let dormPlacementBusyV344=false,dormPlacementSkipClickV344=false,dormPlacementRoomV346=null;
async function dormPlacementSaveV344(room,target,after,create=false){
 if(dormPlacementBusyV344||dormPlanDraftV315||dormPlanBusyV315)throw Error('불러오기·PDF 검토를 마친 뒤 이동하세요.');
 dormPlacementBusyV344=true;
 try{
  await enqueue(()=>server('saveDormPlanV315',{version:dormPlanV315.version,changes:create?[{...room,members:[],token:'new',group:'미분류',corridor:target?.corridor||'PDF 도면',staffRoom:false}]:[],placement:{room:{building:room.building,floor:room.floor,room:room.room},target:target?{building:target.building,floor:target.floor,room:target.room}:null,after,create}}));
  if(create){dormResetFiltersV251_();$('dormBuilding').value=room.building;$('dormFloor').value=room.floor;}
  await dormPlanRefreshLinksV315();await dormPlanLoadV315();
  const anchor=dormPlanV315.layout.find(r=>dormPlanKeyV315(r)===dormPlanKeyV315(room));if(anchor){$('dormPlanPageV315').value=String(anchor.page);await dormPlanRenderV315();const card=Array.from($('dormPlanHotspotsV315').querySelectorAll('[data-plan-room]')).find(b=>b.querySelector('b')?.textContent===room.room);card?.scrollIntoView({block:'nearest',inline:'center'});}
  toast(create?'공실 추가 완료 · 배치도·호실별 인원 관리 반영':'방 위치 저장 완료');
 }finally{dormPlacementBusyV344=false;}
}
function dormPlacementWireV344(layout){
 const root=$('dormPlanHotspotsV315');
 for(const button of root.querySelectorAll('[data-plan-room]')){
  const room=layout[Number(button.dataset.planRoom)];button.draggable=!dormPlanDraftV315;
  button.title='드래그하여 같은 관·층의 방 사이로 이동';
  button.ondragstart=e=>{if(dormPlanDraftV315||dormPlacementBusyV344){e.preventDefault();return;}e.dataTransfer.setData('text/plain',String(button.dataset.planRoom));e.dataTransfer.effectAllowed='move';};
  button.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='move';};
  button.ondrop=async e=>{e.preventDefault();const from=layout[Number(e.dataTransfer.getData('text/plain'))];if(!from||from===room)return;const rect=button.getBoundingClientRect();try{await dormPlacementSaveV344(from,room,e.clientX>rect.left+rect.width/2);}catch(error){toast(error.message);}};
  const handle=document.createElement('span');handle.className='dorm-drag-v344';handle.textContent='↔ 이동';handle.style.touchAction='none';button.append(handle);
  handle.onclick=e=>{e.preventDefault();e.stopPropagation();};
  handle.tabIndex=0;handle.setAttribute('role','button');handle.setAttribute('aria-label',room.room+'호 이동');handle.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();dormPlacementOpenMoveV346(room);}};
  let start=null;
  handle.ondragstart=e=>{e.preventDefault();e.stopPropagation();};
  handle.onpointerdown=e=>{if(dormPlanDraftV315||dormPlacementBusyV344)return;e.preventDefault();e.stopPropagation();start={x:e.clientX,y:e.clientY};handle.setPointerCapture(e.pointerId);button.classList.add('dorm-moving-v346');};
  handle.onpointermove=e=>{if(!start)return;e.preventDefault();root.querySelectorAll('.dorm-drop-before-v346,.dorm-drop-after-v346').forEach(b=>b.classList.remove('dorm-drop-before-v346','dorm-drop-after-v346'));const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-plan-room]');if(target&&target!==button){const rect=target.getBoundingClientRect();target.classList.add(e.clientX>rect.left+rect.width/2?'dorm-drop-after-v346':'dorm-drop-before-v346');}const scroll=$('dormPlanHotspotsV315').closest('.dorm-plan-scroll');if(scroll){const rect=scroll.getBoundingClientRect();if(e.clientX>rect.right-35)scroll.scrollLeft+=20;else if(e.clientX<rect.left+35)scroll.scrollLeft-=20;}};
  handle.onpointerup=async e=>{if(!start)return;const moved=Math.hypot(e.clientX-start.x,e.clientY-start.y)>8;start=null;if(!moved){await dormPlacementOpenMoveV346(room);return;}e.preventDefault();dormPlacementSkipClickV344=true;const targetButton=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-plan-room]');if(!targetButton)return;const target=layout[Number(targetButton.dataset.planRoom)];if(target===room)return;const rect=targetButton.getBoundingClientRect();try{await dormPlacementSaveV344(room,target,e.clientX>rect.left+rect.width/2);}catch(error){toast(error.message);}};
  const pointerUp=handle.onpointerup;handle.onpointerup=async e=>{button.classList.remove('dorm-moving-v346');root.querySelectorAll('.dorm-drop-before-v346,.dorm-drop-after-v346').forEach(b=>b.classList.remove('dorm-drop-before-v346','dorm-drop-after-v346'));await pointerUp(e);};
  handle.onpointercancel=()=>{start=null;button.classList.remove('dorm-moving-v346');root.querySelectorAll('.dorm-drop-before-v346,.dorm-drop-after-v346').forEach(b=>b.classList.remove('dorm-drop-before-v346','dorm-drop-after-v346'));};
 }
}
function dormPlacementTargetsV344(){
 const b=$('dormAddBuildingV344').value,f=$('dormAddFloorV344').value;
 const rows=(dormPlanV315?.layout||[]).filter(r=>r.building===b&&r.floor===f&&!r.unplaced);
 $('dormAddTargetV344').innerHTML='<option value="">맨 뒤에 추가</option>'+rows.map((r,i)=>'<option value="'+i+'">'+escapeH(r.room)+'호</option>').join('');
 return rows;
}
function dormPlacementInitV344(){
 const openAddReset=()=>{dormPlacementRoomV346=null;$('dormAddDialogV344').querySelector('h2').textContent='방 추가';$('dormAddDialogV344').querySelector('p').textContent='공실로 추가한 뒤 배정자를 입력할 수 있습니다.';$('dormAddSaveV344').textContent='공실 추가';$('dormAddNumberV344').readOnly=false;for(const id of ['dormAddBuildingV344','dormAddFloorV344'])$(id).disabled=false;};
 $('dormAddOpenV344').onclick=async()=>{if(!mustEdit())return;if(dormPlanDraftV315)return toast('PDF 검토를 마친 뒤 추가하세요.');if(!dormPlanV315)await dormPlanLoadV315();if(!dormPlanV315)return;const page=Number($('dormPlanPageV315').value),r=dormPlanV315.layout.find(r=>r.page===page);if(r){$('dormAddBuildingV344').value=r.building;$('dormAddFloorV344').value=r.floor;}$('dormAddNumberV344').value='';$('dormAddErrorV344').textContent='';dormPlacementTargetsV344();$('dormAddDialogV344').showModal();};
 const openAdd=$('dormAddOpenV344').onclick;$('dormAddOpenV344').onclick=async()=>{openAddReset();await openAdd();};
 for(const id of ['dormAddBuildingV344','dormAddFloorV344'])$(id).onchange=dormPlacementTargetsV344;
 $('dormAddCloseV344').onclick=()=>$('dormAddDialogV344').close();
 $('dormAddSaveV344').onclick=async()=>{
  const button=$('dormAddSaveV344');if(button.disabled)return;
  const room={building:$('dormAddBuildingV344').value,floor:$('dormAddFloorV344').value,room:$('dormAddNumberV344').value.normalize('NFKC').trim()};
  const rows=dormPlanV315.layout.filter(r=>r.building===room.building&&r.floor===room.floor&&!r.unplaced),target=$('dormAddTargetV344').value===''?null:rows[Number($('dormAddTargetV344').value)];
  if(dormPlacementRoomV346){if(!target||dormPlanKeyV315(target)===dormPlanKeyV315(room))return $('dormAddErrorV344').textContent='다른 기준 방을 선택하세요.';button.disabled=true;try{await dormPlacementSaveV344(dormPlacementRoomV346,target,$('dormAddAfterV344').value==='true');$('dormAddDialogV344').close();}catch(e){$('dormAddErrorV344').textContent=e.message;}finally{button.disabled=false;}return;}
  if(!/^\d{3}(?:-[1-8])?$/.test(room.room))return $('dormAddErrorV344').textContent='호실을 입력하세요. 예: 110, 110-2';
  if(dormPlanV315.rooms.some(r=>dormPlanKeyV315(r)===dormPlanKeyV315(room)))return $('dormAddErrorV344').textContent='이미 등록된 방입니다. 배치도에서 이동하세요.';
  button.disabled=true;try{await dormPlacementSaveV344(room,target,$('dormAddAfterV344').value==='true',true);$('dormAddDialogV344').close();}catch(e){$('dormAddErrorV344').textContent=e.message;}finally{button.disabled=false;}
 };
}
async function dormPlacementOpenMoveV346(room){
 await $('dormAddOpenV344').onclick();if(!$('dormAddDialogV344').open)return;dormPlacementRoomV346=room;
 $('dormAddDialogV344').querySelector('h2').textContent='방 이동';$('dormAddSaveV344').textContent='위치 저장';$('dormAddBuildingV344').value=room.building;$('dormAddFloorV344').value=room.floor;$('dormAddNumberV344').value=room.room;$('dormAddNumberV344').readOnly=true;for(const id of ['dormAddBuildingV344','dormAddFloorV344'])$(id).disabled=true;dormPlacementTargetsV344();$('dormAddDialogV344').querySelector('p').textContent='기준 방과 앞·뒤 위치를 선택하세요.';
}

dormPlacementInitV344();
dormPlanInitV315();

const laborExplanationV324=function distributionExplanation(group,divisor){
 const remainder=Number(group.remainder)||0;
 if(!remainder)return '—';
 const portion=Number((remainder/divisor).toFixed(3));
 const approximate=Math.abs(portion-remainder/divisor)>1e-9?'약 ':'';
 return remainder+'명 · '+approximate+portion+'개';
};
function laborSummaryV324(result){
 const groups=result.groups||[],people=groups.reduce((s,g)=>s+Number(g.count||0),0),quantity=groups.reduce((s,g)=>s+Number(g.quota||0),0),divisor=Number(result.divisor)||2;
 $('laborStatsV259').innerHTML=[['대상 인원',laborFmtV259(people)+'명'],['지급 기준',result.buildingDivisors?'관별 기준':divisor+'명당 1개'],['총수량',laborFmtV259(quantity)+'개']].map(([label,value])=>'<div class="labor-answer-v324"><span>'+label+'</span><strong>'+value+'</strong></div>').join('');
}

function laborBuildingInputV357(){if(!$('laborByBuildingV357').checked||$('laborModeV259').value==='total')return null;return Object.fromEntries(qsa('[data-labor-building]',$('laborBuildingRatesV357')).map(s=>[s.dataset.laborBuilding,Number(s.value)]));}
function laborBuildingDimensionsInputV361(){if(!laborBuildingInputV357())return null;return Object.fromEntries(qsa('[data-labor-dimension]',$('laborBuildingRatesV357')).map(s=>[s.dataset.laborDimension,s.value]));}
function laborPairDivisorV357(result){return result?.buildingDivisors?Math.max(1,...Object.values(result.buildingDivisors).map(Number)):Number(result?.divisor||$('laborDivisorV259').value)||2;}
function laborBuildingVisibilityV357(){const enabled=$('laborByBuildingV357').checked&&$('laborModeV259').value!=='total';$('laborBuildingRatesV357').classList.toggle('hidden',false);$('laborDivisorV259').closest('.labor-step').classList.toggle('hidden',enabled);$('laborDimV259').closest('.labor-step').classList.toggle('hidden',enabled);$('laborTableV259').closest('.labor-table-wrap').classList.toggle('hidden',enabled);qsa('[name="laborDistributionV358"]').forEach(r=>{r.checked=(r.value==='building')===enabled;r.disabled=laborLoadingV259||(r.value==='building'&&$('laborModeV259').value==='total');});$('laborRateHelpV357').textContent='1개당 인원';}
function laborBasisNumberV392(value,fallback){if(value===null||value===undefined||value==='')return fallback;const n=Number(value);return Number.isFinite(n)&&n>=0?n:fallback;}
function laborBasisRangesV392(basis){
 const source=basis?.statusRanges||basis?.gradeRanges||basis?.ranges||[];
 if(Array.isArray(source))return source.map((row,index)=>{if(typeof row!=='string')return {label:String(row?.label||row?.gradeLabel||((row?.grade||index+1)+'학년')),range:String(row?.range||row?.a1||row?.statusRange||'')};const match=row.trim().match(/^(\d+학년)\s+(.+)$/);return match?{label:match[1],range:match[2]}:{label:(index+1)+'학년',range:row};}).filter(row=>row.range);
 if(source&&typeof source==='object')return Object.entries(source).map(([grade,value])=>({label:/학년$/.test(grade)?grade:grade+'학년',range:String(value?.range||value?.a1||value||'')})).filter(row=>row.range);
 return [];
}
function laborCalculationBasisRenderV392(result){
 const box=$('laborCalculationBasisV392'),body=$('laborCalculationBasisBodyV392'),summary=$('laborCalculationBasisSummaryV392');if(!box||!body||!summary)return;
 const basis=result?.calculationBasis;if(!basis){box.hidden=true;body.innerHTML='';summary.textContent='';return;}
 const ranges=laborBasisRangesV392(basis),rules=[basis.rule,basis.selectionRule,basis.selectedRule,basis.modeRule,basis.matchRule,basis.roomRule].map(value=>String(value||'').trim()).filter((value,index,all)=>value&&all.indexOf(value)===index);
 const roomBased=basis.roomBased!==false,selected=laborBasisNumberV392(basis.selected??basis.selectedCount??basis.targetCount??basis.eligibleCount,null),linked=roomBased?laborBasisNumberV392(basis.livingLinked??basis.linkedCount??basis.roomLinkedCount??basis.locatedCount,result.residenceCount):null,unlocated=roomBased?laborBasisNumberV392(basis.unlocated??basis.unlocatedCount??basis.missingRoomCount,result.unlocatedSmart):null;
 const rangeHtml=ranges.length?'<div class="labor-basis-ranges-v392">'+ranges.map(row=>'<span><b>'+escapeH(row.label)+'</b> '+escapeH(row.range)+'</span>').join('')+'</div>':'';
 const ruleHtml=rules.length?'<div class="labor-basis-rules-v392">'+rules.map(rule=>'<p>'+escapeH(rule)+'</p>').join('')+'</div>':'';
 const targetText=selected===null?'대상 산출':laborFmtV259(selected)+'명',linkedText=linked===null?'생활실 연결':laborFmtV259(linked)+'명',missingText=unlocated===null?'별도 확인':laborFmtV259(unlocated)+'명';
 body.innerHTML=rangeHtml+ruleHtml+'<div class="labor-basis-flow-v392"><span><b>대상</b> '+escapeH(targetText)+'</span>'+(roomBased?'<i aria-hidden="true">→</i><span><b>생활실 연결</b> '+escapeH(linkedText)+'</span><i aria-hidden="true">→</i><span><b>호실 미확인</b> '+escapeH(missingText)+'</span>':'')+'</div>';
 summary.textContent=(ranges.length?ranges.map(row=>row.label+' '+row.range).join(' · '):'')+(selected===null?'':' · 대상 '+laborFmtV259(selected)+'명');box.hidden=false;
}
function laborAllocationLineV392(group,fallbackDivisor){
 const count=laborBasisNumberV392(group?.count,0),pairOut=laborBasisNumberV392(group?.pairOut,0),pairIn=laborBasisNumberV392(group?.pairIn,0),fallback=count-pairOut+pairIn;
 const allocation=laborBasisNumberV392(group?.allocationCount,Math.max(0,fallback)),divisor=Math.max(1,laborBasisNumberV392(group?.divisor,laborBasisNumberV392(fallbackDivisor,1))),quota=laborBasisNumberV392(group?.quota,allocation/divisor);
 const movement=pairOut||pairIn?' · 독방 짝 -'+laborFmtV259(pairOut)+'/+'+laborFmtV259(pairIn)+' → '+laborFmtV259(allocation)+'명분':'';
 return '생활실 배정 '+laborFmtV259(count)+'명'+movement+' · '+laborFmtV259(allocation)+'÷'+laborFmtV259(divisor)+'='+laborFmtV259(quota)+'개';
}
let laborMainSoloV374=null;
function laborCardsInitV374(){const view=$('laborCalcView'),root=$('laborBuildingRatesV357'),basis=$('laborCalculationBasisV392'),planner=view.querySelector('.labor-planner-panel');laborMainSoloV374=view.querySelector('.labor-solo-card');if(laborMainSoloV374)laborMainSoloV374.style.display='none';planner.after(root);if(basis)planner.after(basis);const summary=$('laborStatsV259'),title=document.createElement('h2');title.className='labor-summary-title-v374';title.textContent='총합';view.append(title,summary);view.querySelector('.labor-results-card .labor-section-head')?.remove();const auto=$('laborAutoAssignV269');$('laborRefreshV259').after(auto);auto.textContent='전체 자동배정 ↻';auto.title='모든 관의 수동 짝·미지정 기록을 초기화하고 자동 배정';if(laborMainSoloV374){laborMainSoloV374.querySelector('.panel-title').textContent='독방 사전 배정';laborMainSoloV374.querySelector('.panel-sub').textContent='이름 선택 → 짝 변경';}view.querySelector('.labor-planner-header .panel-sub').textContent='관별 지급 기준 · 층별 / 중대별 배분';}
function laborBuildingRenderV357(result){
 if(typeof laborCalculationBasisRenderV392==='function')laborCalculationBasisRenderV392(result);
 const allocationLine=g=>{if(typeof laborAllocationLineV392==='function')return laborAllocationLineV392(g,Number(g.divisor)||Number(result.divisor)||2);const count=Number(g.count)||0,pairOut=Number(g.pairOut)||0,pairIn=Number(g.pairIn)||0,allocation=Number.isFinite(Number(g.allocationCount))?Number(g.allocationCount):Math.max(0,count-pairOut+pairIn),divisor=Math.max(1,Number(g.divisor)||Number(result.divisor)||2),quota=Number.isFinite(Number(g.quota))?Number(g.quota):allocation/divisor;return '생활실 배정 '+laborFmtV259(count)+'명 · 독방 짝 -'+laborFmtV259(pairOut)+'/+'+laborFmtV259(pairIn)+' → '+laborFmtV259(allocation)+'명분 · '+laborFmtV259(allocation)+'÷'+laborFmtV259(divisor)+'='+laborFmtV259(quota)+'개';};
 const root=$('laborBuildingRatesV357'),previous=Object.fromEntries(qsa('[data-labor-building]',root).map(s=>[s.dataset.laborBuilding,s.value])),previousDims=Object.fromEntries(qsa('[data-labor-dimension]',root).map(s=>[s.dataset.laborDimension,s.value]));laborMainSoloV374?.remove();
 root.innerHTML=['본관','동관','서관'].map(short=>{const b=(result.buildings||[]).find(b=>String(b).replace(/\s/g,'').includes(short)),groups=(result.groups||[]).filter(g=>b&&(g.building===b||g.key===b)),count=groups.reduce((n,g)=>n+Number(g.count||0),0),quota=groups.reduce((n,g)=>n+Number(g.quota||0),0),divisor=Number(result.buildingDivisors?.[b]||previous[b]||$('laborDivisorV259').value)||2,dimension=result.buildingDimensions?.[b]||previousDims[b]||'floor';
 const controls=$('laborModeV259').value==='total'?'<p class="panel-sub">총인원 · 관별 배분 없음</p>':b?'<label>지급 기준<select class="field" data-labor-building="'+escapeH(b)+'" aria-label="'+short+' 지급 기준">'+[1,2,3,4,5,6].map(n=>'<option value="'+n+'" '+(n===divisor?'selected':'')+'>'+n+'인 1개</option>').join('')+'</select></label><label>배분<select class="field" data-labor-dimension="'+escapeH(b)+'" aria-label="'+short+' 배분">'+[['floor','층별'],['company','중대별']].map(([v,t])=>'<option value="'+v+'" '+(dimension===v?'selected':'')+'>'+t+'</option>').join('')+'</select></label>':'<p class="panel-sub">대상 없음</p>';
 const table='<div class="eq-scroll"><table class="eq-table"><thead><tr><th>구분</th><th>인원</th><th>수량</th><th>잔여분</th><th>계산 근거</th></tr></thead><tbody>'+groups.map(g=>'<tr><td>'+escapeH(g.label)+'</td><td>'+laborFmtV259(g.count)+'명'+(g.allocationCount!==undefined&&g.allocationCount!==g.count?'<small>짝 반영 '+laborFmtV259(g.allocationCount)+'명분</small>':'')+'</td><td>'+laborFmtV259(g.quota)+'개</td><td>'+escapeH(laborExplanationV324(g,divisor))+'</td><td class="labor-allocation-line-v392">'+escapeH(allocationLine(g))+'</td></tr>').join('')+'</tbody></table></div>';
 return '<section class="labor-card-v374" data-labor-section="'+escapeH(b||short)+'"><h2>'+short+'</h2><h3>사역 수량 계산</h3>'+controls+'<div class="labor-building-metrics"><div><dt>인원</dt><dd>'+($('laborModeV259').value==='total'?'—':laborFmtV259(count)+'명')+'</dd></div><div><dt>수량</dt><dd>'+($('laborModeV259').value==='total'?'—':laborFmtV259(quota)+'개')+'</dd></div></div>'+'<h3>독방 배정</h3><p class="labor-solo-count-v375" data-labor-solo-count="'+short+'"></p>'+(short==='본관'?'<div id="laborMainSoloHostV374"></div>':'')+'<div class="labor-local-solos-v375" data-labor-solo-host="'+short+'"></div>'+'<h3>분배 수량 · '+short+'</h3>'+table+'</section>';
 }).join('');if(laborMainSoloV374){$('laborMainSoloHostV374').append(laborMainSoloV374);laborMainSoloV374.style.display='';}laborBuildingVisibilityV357();
 const extra=(result.groups||[]).filter(g=>!['본관','동관','서관'].some(k=>String(g.building||g.key).replace(/\s/g,'').includes(k)));let note=$('laborExtraV374');if(!note){note=document.createElement('details');note.id='laborExtraV374';$('laborStatsV259').before(note);}note.hidden=!extra.length;note.innerHTML='<summary>기타·호실 확인 필요 · '+laborFmtV259(extra.reduce((s,g)=>s+Number(g.count||0),0))+'명 (총합 포함)</summary>'+extra.map(g=>'<p>'+escapeH(g.label)+' · '+laborFmtV259(g.count)+'명 · '+laborFmtV259(g.quota)+'개</p>').join('');
}

function laborCardsDistributePairsV375(result){const root=$('laborPairListV259'),singles=result.pairs?.singles||[];for(const short of ['본관','동관','서관']){const host=document.querySelector('[data-labor-solo-host="'+short+'"]'),label=document.querySelector('[data-labor-solo-count="'+short+'"]');if(!host)continue;const rows=singles.filter(p=>String(p.building||'').includes(short)),keys=new Set(rows.map(p=>p.key)),pairs=(result.pairs?.pairs||[]).filter(p=>keys.has(p.a)&&keys.has(p.b)),unpaired=(result.pairs?.unpaired||[]).filter(k=>keys.has(k)),b=(result.buildings||[]).find(b=>b.includes(short)),divisor=Number(result.buildingDivisors?.[b]||result.divisor||2);label.textContent='독방 '+rows.filter(p=>p.active!==false&&p.reason==='계산 대상').length+'명 · '+laborFmtV259(rows.filter(p=>p.active!==false&&p.reason==='계산 대상').length/divisor)+'개 · 배정 '+pairs.length+'쌍 · 미지정 '+unpaired.length+'명';const section=[...root.querySelectorAll('.labor-building-v268')].find(el=>String(el.querySelector('[data-pair-row-building]')?.dataset.pairRowBuilding||el.textContent).includes(short));if(section)host.replaceChildren(section);else host.innerHTML='<p class="help">'+(divisor===1?'1인 1개 · 각자 계산':'배정할 독방 없음')+'</p>';}}

function laborBuildingBusyV357(busy){['laborByBuildingV357','laborDivisorV259','laborGradeV261','laborModeV259'].forEach(id=>$(id).disabled=busy);qsa('[data-labor-building],[data-labor-dimension],[name="laborDistributionV358"]').forEach(s=>s.disabled=busy);if(!busy)laborSyncDimensionV262_();}

laborCardsInitV374();

function assetOverviewGroupsV327(rooms,items,records,mode){
 const itemIds=new Set(items.map(i=>i.id)),byRecord=new Map(records.filter(r=>itemIds.has(r.itemId)).map(r=>[r.roomId+'|'+r.itemId,r])),groups=new Map();
 const empty=()=>({quantity:0,normal:0,repair:0,unknown:0,unavailable:0});
 for(const room of rooms){
  const group=String(room.group||'').normalize('NFKC').replace(/\s+/g,''),company=group.match(/^([1-8])(?:중대)?$/)||((!group||group==='미분류')?String(room.room||'').match(/-([1-8])$/):null);
  const label=mode==='company'?(company?company[1]+'중대':group||'미분류'):room.building||'미분류';
  if(!groups.has(label))groups.set(label,{label,rooms:0,completed:0,...empty(),items:items.map(i=>({...empty(),id:i.id,name:i.name}))});
  const row=groups.get(label);row.rooms++;
  if(items.length&&items.every(i=>byRecord.get(room.id+'|'+i.id)?.confirmed))row.completed++;
  for(const item of row.items){const rec=byRecord.get(room.id+'|'+item.id);if(!rec)continue;
   const values={quantity:Number(rec.quantity)||0,normal:Number(rec.normal)||0,repair:Number(rec.repair)||0,unknown:Math.max(0,(Number(rec.quantity)||0)-(Number(rec.normal)||0)-(Number(rec.repair)||0)),unavailable:(rec.slots||[]).filter(s=>s.unavailable).length};
   for(const [key,value] of Object.entries(values)){row[key]+=value;item[key]+=value;}
  }
 }
 const building=['정예 본관','정예 동관','정예 서관','별관'];
 return [...groups.values()].sort((a,b)=>mode==='company'?a.label.localeCompare(b.label,'ko',{numeric:true}):(building.includes(a.label)?building.indexOf(a.label):100)-(building.includes(b.label)?building.indexOf(b.label):100)||a.label.localeCompare(b.label,'ko'));
}
function assetOverviewChooseV328(mode){
 mode=mode==='company'?'company':'building';$('assetOverviewModeV327').value=mode;
 qsa('[data-asset-overview-mode]').forEach(input=>input.checked=input.value===mode);
 assetOverviewRenderV327();
}
function assetOverviewRenderV327(){
 if(!assetDataV244)return;
 const mode=$('assetOverviewModeV327').value,rows=assetOverviewGroupsV327(assetRoomsFilteredV244(),assetDataV244.items,assetDataV244.records,mode);
 $('assetOverviewTitleV327').textContent=(mode==='company'?'중대별':'건물별')+' 비품 현황';
 $('assetOverviewGroupV327').textContent=mode==='company'?'중대':'건물';
 const counts=r=>'<td>'+r.quantity+'</td><td class="asset-good-text">'+r.normal+'</td><td class="asset-bad-text">'+r.repair+'</td><td>'+r.unknown+'</td><td>'+r.unavailable+'</td>';
 $('assetKindRowsV244').innerHTML=rows.map((r,i)=>'<tr><td><button type="button" class="btn btn-soft" data-asset-overview-toggle="'+i+'" aria-expanded="false" aria-controls="assetOverviewDetailV327_'+i+'">'+escapeH(r.label)+' · 품목 ▾</button></td><td>'+r.rooms+'</td>'+counts(r)+'<td>'+r.completed+' / '+r.rooms+'</td></tr><tr id="assetOverviewDetailV327_'+i+'" hidden><td colspan="8"><table class="asset-table"><thead><tr><th>품목</th><th>수량</th><th>정상</th><th>수리·교체</th><th>미점검</th><th>사용불가</th><th>관리</th></tr></thead><tbody>'+r.items.map(item=>'<tr><td>'+escapeH(item.name)+'</td>'+counts(item)+'<td>'+(canEdit?'<button type="button" class="btn btn-soft asset-owner" data-asset-hide="'+escapeH(item.id)+'">목록 삭제</button>':'—')+'</td></tr>').join('')+'</tbody></table></td></tr>').join('')||'<tr><td colspan="8">조회 결과 없음</td></tr>';
}

function assetRoomHealthV332(items,records){
 const issues=[];let unknown=0;
 for(const item of items){const rec=records.find(r=>r.itemId===item.id);if(!rec){unknown++;continue;}
  if(rec.slots){for(const slot of rec.slots){const status=String(slot.status||''),level=slot.unavailable||status==='교체 필요'?'red':/수리/.test(status)?'orange':null;if(level)issues.push({itemId:item.id,name:item.name,position:slot.position,level,label:slot.unavailable?'사용불가':status});if(!status)unknown++;}}
  else{const status=String(rec.status||''),level=status==='교체 필요'?'red':/수리/.test(status)||Number(rec.repair)>0?'orange':null;if(level)issues.push({itemId:item.id,name:item.name,position:'',level,label:status||'수리 필요'});if(!rec.confirmed)unknown++;}
 }
 const level=issues.some(i=>i.level==='red')?'red':issues.length?'orange':unknown||!items.length?'unknown':'blue';
 return {level,issues,unknown,label:level==='red'?'교체·사용불가':level==='orange'?'수리 필요':level==='unknown'?'미점검':'정상'};
}
function assetPlanBandsV332(rooms,layout){
 const groups=[],used=new Set(),key=r=>[r.building,r.floor,String(r.room||'').split('-')[0]].join('|');
 for(const anchor of [...(layout||[])].sort((a,b)=>a.page-b.page||a.y-b.y||a.x-b.x)){
  let matches=anchor.roomId?rooms.filter(r=>String(r.id)===String(anchor.roomId)&&r.building===anchor.building&&r.floor===anchor.floor):[];
  if(matches.length!==1)matches=rooms.filter(r=>key(r)===key(anchor));
  if(matches.length!==1||used.has(matches[0].id))continue;const room=matches[0];used.add(room.id);
  let group=groups.find(g=>g.building===room.building&&g.floor===room.floor&&g.page===anchor.page&&Math.abs(g.y-anchor.y)<.035);
  if(!group){group={building:room.building,floor:room.floor,page:anchor.page,y:anchor.y,rooms:[]};groups.push(group);}group.rooms.push({...room,planX:anchor.x});
 }
 for(const room of rooms.filter(r=>!used.has(r.id)).sort((a,b)=>String(a.room).localeCompare(String(b.room),'ko',{numeric:true}))){let group=groups.find(g=>g.unplaced&&g.building===room.building&&g.floor===room.floor&&g.corridor===(room.corridor||''));if(!group){group={building:room.building,floor:room.floor,corridor:room.corridor||'',unplaced:true,rooms:[]};groups.push(group);}group.rooms.push(room);}
 for(const group of groups)if(!group.unplaced)group.rooms.sort((a,b)=>a.planX-b.planX);
 return groups;
}
function assetDialogV356(){
 let dialog=$('assetDialogV356');if(dialog)return dialog;
 dialog=document.createElement('dialog');dialog.id='assetDialogV356';dialog.className='asset-dialog';dialog.setAttribute('aria-labelledby','assetRoomTitleV244');document.body.appendChild(dialog);
 dialog.addEventListener('cancel',e=>{e.preventDefault();assetCloseRoomV245();});
 return dialog;
}
function assetPlanRenderV332(){
 const root=$('assetPlanV332'),open=new Set(qsa('details[open][data-asset-plan-building]',root).map(d=>d.dataset.assetPlanBuilding)),rooms=assetRoomsFilteredV244(),bands=assetPlanBandsV332(rooms,assetDataV244.layout),buildings=[...new Set(bands.map(g=>g.building))];
 $('assetPlanWarningV332').textContent=assetDataV244.layoutWarning||'';
 const healthByRoom=new Map(rooms.map(room=>[room.id,assetRoomHealthV332(assetDataV244.items,assetDataV244.records.filter(r=>r.roomId===room.id))]));
 $('assetPlanTotalsV333').innerHTML=[['blue','정상'],['orange','수리'],['red','교체·사용불가'],['unknown','미점검']].map(([level,label])=>'<span class="asset-plan-'+level+'">'+label+' <b>'+[...healthByRoom.values()].filter(h=>h.level===level).length+'호</b></span>').join('');
 root.innerHTML=buildings.map(building=>'<details class="asset-group" data-asset-plan-building="'+escapeH(building)+'" '+(open.has(building)?'open':'')+'><summary>'+escapeH(building)+'</summary>'+bands.filter(g=>g.building===building).map(band=>'<section class="asset-plan-band"><h3>'+escapeH(band.unplaced?band.floor+' · '+(band.corridor||'추가 호실'):dormPlanPageLabelV334(band.page,band.building+' '+band.floor)+' · '+dormPlanCorridorV334(bands.filter(g=>!g.unplaced&&g.building===band.building&&g.floor===band.floor&&g.page===band.page).indexOf(band)))+'</h3><div class="asset-plan-scroll"><div class="asset-plan-row">'+band.rooms.map(room=>{
 const health=healthByRoom.get(room.id);
 return '<article class="asset-plan-card asset-plan-'+health.level+'"><button type="button" class="asset-plan-room" data-asset-plan-room="'+escapeH(room.id)+'" aria-label="'+escapeH(room.room+'호 · '+health.label)+'"><strong>'+escapeH(room.room)+'호</strong><span>'+health.label+'</span>'+(health.issues.length?'<small>불량 항목 '+health.issues.length+'</small>':'')+'</button><div class="asset-plan-issues" tabindex="0" aria-label="'+escapeH(room.room+'호 불량 항목')+'">'+(health.issues.length?health.issues.map(issue=>'<button type="button" class="asset-plan-issue asset-plan-'+issue.level+'" title="'+escapeH(issue.name+' · '+issue.label)+'" data-asset-plan-room="'+escapeH(room.id)+'" data-asset-plan-item="'+escapeH(issue.itemId)+'" data-asset-plan-position="'+escapeH(issue.position)+'"><span>'+escapeH(issue.name+(issue.position?' · '+(issue.position==='common'?'공용':issue.position+'번'):''))+'</span><small>'+escapeH(issue.label)+'</small></button>').join(''):'<span class="asset-plan-clear">'+(health.unknown?'점검 필요':'')+'</span>')+'</div><small class="asset-plan-pending">'+(health.unknown?'미점검 '+health.unknown:'점검 완료')+'</small></article>';
 }).join('')+'</div></div></section>').join('')+'</details>').join('')||'<p class="asset-tip">조회 결과 없음</p>';
}
function assetPlanJumpV332(roomId,itemId,position){
 if(assetCurrentRoomV244!==roomId)assetOpenRoomV244(roomId);
 if(assetCurrentRoomV244!==roomId)return;
 const editor=$('assetRoomEditorV244');let parent=editor.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}
 const row=qsa('[data-asset-item]',$('assetEditRowsV244')).find(r=>r.dataset.assetItem===itemId),seat=row&&qsa('[data-asset-position]',row).find(r=>r.dataset.assetPosition===position),target=seat||row||editor;
 qsa('.asset-plan-target').forEach(el=>el.classList.remove('asset-plan-target'));target.classList.add('asset-plan-target');target.scrollIntoView({behavior:'smooth',block:'center'});const control=target.querySelector('select:not(:disabled),textarea:not(:disabled)');if(control)control.focus({preventScroll:true});else{target.tabIndex=-1;target.focus({preventScroll:true});}
}

let assetRequestsV336=[],assetRequestBusyV336=false;
document.addEventListener('click',async e=>{
 const button=e.target.closest('[data-request-delete]');if(!button||assetRequestBusyV336)return;
 const card=button.closest('[data-request-id]'),r=assetRequestsV336.find(x=>x.id===card.dataset.requestId);if(!r)return;
 if(!confirm('이 요청 내역을 삭제할까요? 이미 반영한 비품 기록은 유지됩니다.'))return;
 assetRequestBusyV336=true;card.inert=true;
 try{await server('deleteDormInventoryRequestV349',r.id,r.status,r.resolvedAt||'');card.removeAttribute('data-request-edited');assetRequestBusyV336=false;await assetRequestsLoadV336();toast('요청 삭제 완료');}
 catch(error){$('assetRequestsStatusV336').textContent=error.message;}finally{assetRequestBusyV336=false;card.inert=false;}
});
function assetRequestsTextV336(slot){return slot?[slot.status||'미점검',slot.unavailable?'사용불가':'',slot.details||''].filter(Boolean).join(' · '):'미점검';}
async function assetRequestsLoadV336(){if(assetRequestBusyV336)return;$('assetRequestsStatusV336').textContent='불러오는 중…';try{const data=await server('getDormInventoryRequestsV336');assetRequestsV336=data.requests||[];assetRequestsRenderV336();$('assetRequestsStatusV336').textContent='대기 '+assetRequestsV336.filter(r=>r.status==='대기').length+'건';}catch(e){$('assetRequestsStatusV336').textContent=e.message;}}
function assetRequestsRenderV336(){
 const rows=assetRequestsV336.filter(r=>$('assetRequestsFilterV336').value==='전체'||r.status==='대기');
 $('assetRequestsListV336').innerHTML=rows.map(r=>'<article class="asset-request-card" data-request-id="'+escapeH(r.id)+'"><h3>'+escapeH([r.room.building,r.room.floor,r.room.room+'호',r.position?r.position+'번':'공용'].join(' · '))+'</h3><p class="panel-sub">'+escapeH([String(r.requester.cohort||'').normalize('NFKC').trim().replace(/(?:기)+$/,'')+'기',String(r.requester.company||'').normalize('NFKC').trim().replace(/(?:중대)+$/,'')+'중대',r.requester.name,r.createdAt,r.status].join(' · '))+'</p><div class="asset-request-scroll"><table class="asset-request-table"><thead><tr><th>품목 · 자리</th><th>현재 기록</th><th>요청 원문</th><th>반영할 내용</th></tr></thead><tbody>'+r.changes.map(c=>c.slots.map(s=>{
 const current=c.currentSlots.find(x=>x.position===s.position);const applied=r.appliedEdits?.find(x=>x.itemId===c.itemId)?.slots.find(x=>x.position===s.position),value=applied||s,disabled=r.status==='대기'?'':'disabled';
 return '<tr data-request-item="'+escapeH(c.itemId)+'" data-request-position="'+escapeH(s.position)+'"><th>'+escapeH(c.name)+'<small>'+(s.position==='common'?'공용':escapeH(s.position)+'번')+'</small></th><td>'+escapeH(assetRequestsTextV336(current))+'</td><td class="asset-request-original">'+escapeH(assetRequestsTextV336(s))+'</td><td><div class="asset-request-edit"><select class="field" data-request-status '+disabled+'><option value="">미점검</option>'+['정상','수리 필요(보고)','수리 필요(미보고)','교체 필요'].map(v=>'<option '+(v===value.status?'selected':'')+'>'+escapeH(v)+'</option>').join('')+'</select><textarea class="field" data-request-details maxlength="500" aria-label="'+escapeH(c.name)+' 세부사항" '+disabled+'>'+escapeH(value.details||'')+'</textarea><label><input type="checkbox" data-request-unavailable '+(value.unavailable?'checked':'')+' '+disabled+'>사용불가</label></div></td></tr>';
 }).join('')).join('')+'</tbody></table></div><textarea class="field asset-request-note" data-request-note maxlength="500" placeholder="처리 메모" '+(r.status==='대기'?'':'disabled')+'>'+escapeH(r.note||'')+'</textarea>'+(r.status==='대기'?'<div class="asset-request-actions"><button class="btn" type="button" data-request-action="confirm">확인 완료</button><button class="btn btn-primary" type="button" data-request-action="apply">수정 반영</button></div>':'<p class="panel-sub">'+escapeH([r.resolvedAt,r.resolvedBy].filter(Boolean).join(' · '))+'</p>')+'<div class="asset-request-actions"><button type="button" class="btn btn-danger" data-request-delete>요청 삭제</button></div></article>').join('')||'<p class="panel-sub">요청 없음</p>';
}
$('assetRequestsRefreshV336').addEventListener('click',()=>{if(document.querySelector('[data-request-edited]')&&!confirm('검토 중인 변경을 지우고 새로고침할까요?'))return;assetRequestsLoadV336();});
$('assetRequestsFilterV336').addEventListener('change',()=>{if(document.querySelector('[data-request-edited]')&&!confirm('검토 중인 변경을 지울까요?'))return;assetRequestsRenderV336();});
$('assetRequestsListV336').addEventListener('input',e=>{const card=e.target.closest('[data-request-id]');if(card)card.dataset.requestEdited='1';});
$('assetRequestsListV336').addEventListener('click',async e=>{const button=e.target.closest('[data-request-action]');if(!button||assetRequestBusyV336)return;const card=button.closest('[data-request-id]'),r=assetRequestsV336.find(x=>x.id===card.dataset.requestId),action=button.dataset.requestAction;if(!confirm(action==='apply'?'검토한 내용을 비품 현황에 반영할까요?':'비품 기록을 유지하고 확인 완료로 처리할까요?'))return;const edits=r.changes.map(c=>({itemId:c.itemId,slots:[...card.querySelectorAll('[data-request-item]')].filter(row=>row.dataset.requestItem===c.itemId).map(row=>({position:row.dataset.requestPosition,status:row.querySelector('[data-request-status]').value,details:row.querySelector('[data-request-details]').value,unavailable:row.querySelector('[data-request-unavailable]').checked}))}));assetRequestBusyV336=true;card.inert=true;try{await server('resolveDormInventoryRequestV336',r.id,action,edits,card.querySelector('[data-request-note]').value);card.removeAttribute('data-request-edited');assetRequestBusyV336=false;await assetRequestsLoadV336();toast(action==='apply'?'수정 반영 완료':'확인 완료');}catch(error){$('assetRequestsStatusV336').textContent=error.message;}finally{assetRequestBusyV336=false;card.inert=false;}});

window.addEventListener('beforeunload',e=>{if(document.querySelector('[data-request-edited]')){e.preventDefault();e.returnValue='';}});

let uniformRequestsV350=[],uniformRequestBusyV350=false;
async function uniformRequestsLoadV350(){if(uniformRequestBusyV350)return;const root=$('uniformRequestsListV350');root.textContent='불러오는 중…';try{const data=await server('getUniformRequestsV350');uniformRequestsV350=data.requests;uniformRequestsRenderV350();}catch(e){root.textContent=e.message;}}
function uniformRequestsRenderV350(){const rows=uniformRequestsV350.filter(r=>$('uniformRequestsFilterV351').value==='전체'||r.status==='대기');$('uniformRequestsListV350').innerHTML=rows.map(r=>'<article class="asset-request-card" data-uniform-request="'+escapeH(r.id)+'"><h3>'+escapeH([String(r.requester.cohort).normalize('NFKC').replace(/기$/,'')+'기',String(r.requester.company).normalize('NFKC').replace(/중대$/,'')+'중대',r.requester.name].join(' · '))+'</h3><p>'+escapeH(r.createdAt+' · '+r.status)+'</p><div class="asset-request-scroll"><table class="asset-request-table"><thead><tr><th>품목</th><th>현재</th><th>요청</th><th>반영할 사이즈</th></tr></thead><tbody>'+r.changes.map(c=>'<tr><th>'+escapeH(c.item)+'</th><td>'+escapeH(c.current||'미등록')+'</td><td>'+escapeH(c.size||'삭제')+'</td><td><input class="field" data-uniform-edit="'+escapeH(c.item)+'" maxlength="32" value="'+escapeH(r.appliedEdits?.find(x=>x.item===c.item)?.size??c.size)+'" '+(r.status==='대기'?'':'disabled')+'></td></tr>').join('')+'</tbody></table></div><input class="field" data-uniform-note placeholder="처리 메모" maxlength="500" value="'+escapeH(r.note||'')+'" '+(r.status==='대기'?'':'disabled')+'><div class="asset-request-actions">'+(r.status==='대기'?'<button class="btn" data-uniform-action="confirm">확인 완료</button><button class="btn btn-primary" data-uniform-action="apply">수정 반영</button>':'')+'<button class="btn btn-danger" data-uniform-action="delete">요청 삭제</button></div></article>').join('')||'<p>요청 없음</p>';}
function uniformRequestsInitV350(){
 const list=$('uniformRequestsListV350');
 $('uniformRequestsRefreshV351').onclick=()=>{if(document.querySelector('[data-request-edited]')&&!confirm('검토 중인 변경을 지울까요?'))return;uniformRequestsLoadV350();};
 $('uniformRequestsFilterV351').onchange=()=>{if(document.querySelector('[data-request-edited]')&&!confirm('검토 중인 변경을 지울까요?'))return;uniformRequestsRenderV350();};
 list.oninput=e=>{const card=e.target.closest('[data-uniform-request]');if(card)card.dataset.requestEdited='1';};
 list.onclick=async e=>{const b=e.target.closest('[data-uniform-action]');if(!b||uniformRequestBusyV350)return;const card=b.closest('[data-uniform-request]'),r=uniformRequestsV350.find(r=>r.id===card.dataset.uniformRequest),action=b.dataset.uniformAction;if(!confirm(action==='apply'?'검토한 사이즈를 반영할까요?':action==='delete'?'요청 내역을 삭제할까요? 반영한 사이즈는 유지됩니다.':'사이즈는 유지하고 확인 완료로 처리할까요?'))return;uniformRequestBusyV350=true;card.inert=true;try{const edits=[...card.querySelectorAll('[data-uniform-edit]')].map(i=>({item:i.dataset.uniformEdit,size:i.value}));await server('resolveUniformRequestV350',r.id,action,edits,card.querySelector('[data-uniform-note]').value,r.status);card.removeAttribute('data-request-edited');uniformRequestBusyV350=false;await uniformRequestsLoadV350();uniformStateV278.loaded=false;toast('피복 요청 처리 완료');}catch(e){$('uniformRequestsStatusV351').textContent=e.message;}finally{uniformRequestBusyV350=false;card.inert=false;}};
}
uniformRequestsInitV350();


function staffAccessLoadV364(){
 $('staffPermissionsV364').classList.toggle('hidden',!canManageUsersV281);v284StaffLoad();
 if(canManageUsersV281){v284AccessLoad();loadFullEditorsV281();}
}
function staffAccessPopulateV366(){
 $('v284AccessJob').value=$('v284StaffJob').value;v284CheckboxRender();const email=$('v284AccessEmail').value.trim().toLowerCase(),user=v284AccessUsers.find(p=>p.email===email&&p.job===$('v284StaffJob').value);
 qsa('[data-access-view]',$('v284AccessCheckboxes')).forEach(input=>input.checked=!input.disabled&&(user?.views||[]).includes(input.dataset.accessView));
}
async function staffAccessFocusV364(job,name,email,views){
 if(!canManageUsersV281||v284Busy)return;
 if(v288ViewingTerm!==v288ActiveTerm)await v284StaffLoad(v288ActiveTerm);
 const matches=v284StaffItems.filter(p=>email?p.email?.toLowerCase()===email:p.job===job&&p.name===name),person=matches.length===1?matches[0]:null;
 v284StaffReset();if(person){v284StaffEdit=person;$('v284StaffName').value=person.name;$('v284StaffPhone').value=person.phone||'';$('v284StaffSave').textContent='명단 수정 저장';}
 $('v284StaffJob').value=job;$('v284AccessEmail').value=email||person?.email||'';staffAccessPopulateV366();
 if(views)qsa('[data-access-view]',$('v284AccessCheckboxes')).forEach(input=>input.checked=!input.disabled&&views.includes(input.dataset.accessView));
 $('staffPermissionPersonV364').textContent=[job,name,email].filter(Boolean).join(' · ')+(email?' · 허용 메뉴 확인 후 저장':' · 이메일 입력 후 허용 메뉴를 선택하세요.');
 $('v284StaffForm').scrollIntoView({behavior:'smooth',block:'start'});$('v284AccessEmail').focus({preventScroll:true});
}
$('v284StaffJob').addEventListener('change',staffAccessPopulateV366);
$('v284StaffRows').addEventListener('click',event=>{const button=event.target.closest('[data-staff-access]');if(!button)return;const person=v284StaffItems[Number(button.dataset.staffAccess)];if(person)staffAccessFocusV364(person.job,person.name,person.email||'');});
$('v284AccessUsers').addEventListener('click',event=>{const button=event.target.closest('[data-staff-access-edit]');if(!button)return;const user=v284AccessUsers.find(p=>p.email===button.dataset.staffAccessEdit);if(user)staffAccessFocusV364(user.job,'',user.email,user.views);});

const PERSONAL_PREVIEW_HTML_V360="<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex,nofollow\"><meta name=\"referrer\" content=\"no-referrer\"><title>내 군수 정보</title><style>:root{font-family:system-ui,-apple-system,\"Segoe UI\",sans-serif;color:#18304c;background:#f4f7fb;font-synthesis:none}*{box-sizing:border-box}body{margin:0}header,main,footer,#status{max-width:1050px;margin:auto}header{height:86px;display:flex;align-items:center;justify-content:space-between;padding:0 24px}.brand{text-decoration:none;font-size:20px;font-weight:800;color:#18304c}.brand span{font-weight:500;font-size:13px;margin-left:10px;color:#687a91}.admin{font-size:12px;color:#687a91;text-decoration:none}.login{max-width:420px;background:white;margin:60px auto 30px;border:1px solid #dee5ef;border-radius:20px;padding:34px;box-shadow:0 12px 40px #16345208}.eyebrow{font-size:11px;letter-spacing:2px;font-weight:800;color:#3d71ba;margin:0 0 12px}h1{font-size:30px;letter-spacing:-1px;margin:0 0 8px}.sub{color:#687a91;font-size:14px;line-height:1.6;margin:0}.login form{display:grid;gap:10px;margin-top:28px}label{font-size:13px;font-weight:700;margin-top:8px}input,button{font:inherit;border-radius:9px;border:1px solid #cad6e6;padding:12px 14px}input{width:100%;background:#f9fbfe;min-height:46px}button{cursor:pointer;background:white;font-size:14px;font-weight:700;color:#244365}button:hover{border-color:#326fc0}button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #8db6ef;outline-offset:3px}button:disabled{opacity:.55;cursor:wait}#submit{background:#245fa8;border-color:#245fa8;color:white;margin-top:12px}.hint{font-size:12px;color:#78889b;line-height:1.7}.login .hint{margin:20px 0 0}#status{padding:0 24px;text-align:center;font-size:14px;color:#9d3c30;min-height:22px}main{padding:24px}.page-head{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:10px 0 28px}.actions{display:flex;gap:8px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.card{background:white;border:1px solid #dee5ef;border-radius:16px;padding:24px;min-width:0}.wide{grid-column:1/-1}h2{font-size:16px;margin:0 0 20px}.room{font-size:23px;font-weight:700;color:#245fa8;line-height:1.7;margin:0}dl{margin:0}dl>div{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid #eef2f6;font-size:14px}dt{color:#6b7e94}dd{margin:0;text-align:right;overflow-wrap:anywhere}.empty{font-size:14px;color:#78889b}.item{display:flex;justify-content:space-between;gap:20px;padding:14px 0;border-bottom:1px solid #eef2f6}.item:first-child{padding-top:0}.item strong{font-size:14px}.item p{font-size:13px;color:#687a91;margin:7px 0 0;line-height:1.7}.badge{font-size:12px;background:#eef4fc;color:#346094;border-radius:6px;padding:6px 9px;height:fit-content;white-space:nowrap}.warning{padding:14px;background:#fff7e9;border:1px solid #eedbb8;border-radius:10px;font-size:13px}footer{padding:30px 24px;text-align:center;color:#8290a2;font-size:12px}[hidden]{display:none!important}@media(max-width:600px){header{height:70px;padding:0 18px}.login{margin:30px 18px;padding:26px;max-width:none}main{padding:18px}.grid{grid-template-columns:1fr;gap:14px}.wide{grid-column:auto}.page-head{align-items:flex-start;flex-wrap:wrap}.card{padding:20px}.item{gap:12px}h1{font-size:27px}}\n:root{--touch:48px}select,textarea{font:inherit;color:inherit;border:1px solid #cad6e6;border-radius:9px;background:#f9fbfe;padding:12px;width:100%;font-size:16px;min-height:48px}textarea{resize:vertical}input{font-size:16px}button{min-height:48px;touch-action:manipulation}.asset-item{border-bottom:1px solid #e7edf5}.asset-item summary{min-height:60px;cursor:pointer;padding:14px 0;display:flex;align-items:center;justify-content:space-between;gap:12px}.asset-item summary:after{content:'＋';color:#687a91}.asset-item[open] summary:after{content:'−'}.asset-slot{display:grid;gap:12px;padding:16px;margin-bottom:12px;background:#f6f8fc;border-radius:12px}.asset-slot label{display:grid;gap:8px;margin:0}.asset-slot .unavailable{display:flex;align-items:center;min-height:44px}.unavailable input{width:22px;min-height:22px;height:22px;margin:0 10px 0 0}.save-bar{position:sticky;bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;background:#fff;border:1px solid #d9e3ef;border-radius:12px;box-shadow:0 3px 20px #16345218;font-size:13px}.save-bar button{background:#245fa8;color:#fff;border-color:#245fa8}.asset-item .hint{overflow-wrap:anywhere}.item>div{min-width:0}.item strong,.item p{overflow-wrap:anywhere}.badge{white-space:normal;flex-shrink:0;max-width:45%}@media(max-width:600px){header{height:60px}.login{margin:16px 14px;padding:24px 20px}main{padding:14px;padding-bottom:calc(20px + env(safe-area-inset-bottom))}.page-head{margin:8px 0 20px;gap:14px}.page-head>div:first-child{width:100%}.actions{width:100%}.actions button{flex:1}.card{padding:18px}.room{font-size:20px}.grid{gap:12px}h2{margin-bottom:14px}.save-bar{bottom:calc(10px + env(safe-area-inset-bottom))}.brand span{margin-left:6px}.item{gap:10px}.asset-slot{padding:14px}.login form{margin-top:20px}#status{padding:0 16px;font-size:13px}}\n.personal-table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:13px;margin-top:12px}.personal-table .item-col{width:22%}.personal-table .status-col{width:39%}.personal-table .detail-col{width:39%}.personal-table th,.personal-table td{text-align:left;vertical-align:top;padding:10px 7px;border-bottom:1px solid #e2e9f2;overflow-wrap:anywhere;line-height:1.5}.personal-table thead th{background:#edf3fa;color:#536980;font-size:12px;position:sticky;top:0;z-index:1}.personal-table tbody th{font-weight:700;background:#f8fafd}.personal-table .asset-slot{display:table-row;padding:0;margin:0;border-radius:0;background:transparent}.personal-table .asset-slot td>strong{display:block;font-size:11px;color:#6b7e94;margin-bottom:4px}.personal-table .asset-slot label{gap:0}.personal-table select{padding:7px 2px;font-size:13px;min-height:40px;height:40px;border-radius:6px}.personal-table textarea{font-size:16px;line-height:1.5;padding:7px;min-height:78px;border-radius:6px}.personal-table .unavailable{gap:4px;min-height:36px;font-size:11px;font-weight:500}.personal-table .unavailable input{width:17px;height:17px;min-height:17px;margin:0}.personal-table .legacy-note{display:block;font-size:10px;font-weight:400;color:#906b28;margin-top:8px}.sr-only{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(min-width:601px){.personal-table .item-col{width:22%}.personal-table .status-col{width:30%}.personal-table .detail-col{width:48%}.personal-table select{font-size:15px;padding:8px}.personal-table textarea{min-height:70px}}@media(max-width:360px){.personal-table th,.personal-table td{padding:9px 4px}.personal-table select{font-size:12px}}\n.personal-table .asset-slot td>strong{display:none}.personal-table th,.personal-table td{padding:4px 5px;vertical-align:middle}.personal-table .asset-slot td>label:not(.unavailable){display:inline-block;width:calc(100% - 22px);vertical-align:middle}.personal-table .asset-slot .unavailable{display:inline-flex;width:18px;min-height:30px;margin:0 0 0 3px;vertical-align:middle}.personal-table select{height:30px;min-height:30px;font-size:12px;padding:3px 0}.personal-table textarea{height:30px;min-height:30px;max-height:160px;resize:vertical;font-size:14px;padding:4px;line-height:20px}.personal-table textarea:focus{height:60px;min-height:60px;font-size:16px}.personal-table tbody th{font-size:12px}.personal-table thead th{padding:5px}.personal-table{margin-top:6px}.personal-requests{font-size:11px;margin:6px 0}.personal-requests summary{cursor:pointer}.personal-requests p{margin:4px 0}.personal-room-plan.asset-plan-card{display:flex;align-items:center;gap:6px;overflow-x:auto;padding:7px;margin:6px 0}.personal-room-plan>strong{font-size:11px;white-space:nowrap;flex-shrink:0}.personal-room-plan .asset-plan-issue{width:auto;flex-shrink:0;min-height:30px;padding:4px;font-size:11px}.personal-room-plan .asset-plan-pending{white-space:nowrap}.save-bar{padding:6px 8px;margin-top:6px;bottom:6px}.save-bar button{min-height:34px;padding:6px 10px;font-size:12px}.save-bar span{font-size:11px}@media(max-width:600px){header{height:44px;padding:0 12px}main{padding:10px}.page-head{flex-wrap:nowrap;gap:8px;margin:4px 0 10px}.page-head>div:first-child{width:auto;min-width:0}.page-head .eyebrow{display:none}.page-head h1{font-size:22px}.page-head .sub{font-size:11px}.actions{width:auto;flex-shrink:0;gap:4px}.actions button{min-height:34px;padding:6px 9px;font-size:11px}.card{padding:10px}.card h2{font-size:14px;margin-bottom:6px}.room{font-size:15px;line-height:1.5}.grid{gap:8px}.card .hint{font-size:10px;line-height:1.4;margin:4px 0}.card:has(#room) h2{display:none}.personal-table th,.personal-table td{padding:3px 4px}.personal-table select{font-size:12px}}\n#status:empty{display:none}#assets .personal-room-plan.asset-plan-card{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;overflow-x:auto;padding:6px;margin:6px 0;max-height:54px}#assets .personal-room-plan>strong{font-size:11px;white-space:nowrap;flex-shrink:0}#assets .personal-room-plan .asset-plan-issue{width:auto;flex-shrink:0;min-height:28px;padding:4px;font-size:11px}#assets .personal-room-plan .asset-plan-pending{white-space:nowrap;font-size:10px}.actions button{white-space:nowrap}\n.personal-table .asset-slot td{line-height:0;padding-top:2px;padding-bottom:2px}.personal-table .asset-slot td>label:not(.unavailable){line-height:1}.personal-table .asset-slot select{height:28px;min-height:28px;display:block}.personal-table .asset-slot textarea{display:block;height:28px;min-height:28px;line-height:18px}.personal-table .asset-slot textarea:focus{height:60px;min-height:60px;line-height:22px}.personal-table .asset-slot .unavailable{min-height:28px}.asset-common{display:block;font-size:9px;font-weight:400;color:#6b7e94;line-height:1.2}@media(max-width:600px){#assetActions{position:static}}\n.personal-table .personal-state-select{position:relative;height:28px;min-height:28px;border-radius:6px;border:1px solid #cad6e6;background:#f9fbfe}.personal-table .personal-state-select select{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}.personal-state-label{display:flex;align-items:center;justify-content:center;height:100%;font-size:11px;line-height:12px;white-space:pre-line;text-align:center;padding-right:9px}.personal-state-select:after{content:'⌄';position:absolute;right:3px;top:5px;font-size:10px;pointer-events:none}.personal-state-select:has(select:focus-visible){outline:2px solid #245fa8;outline-offset:2px}\nhtml,body{overscroll-behavior-y:none}.personal-check-legend{display:flex;align-items:center;justify-content:center;gap:6px;margin:0 0 8px;padding:7px 10px;border:1px solid #e4c6c9;border-radius:8px;background:#fff3f3;color:#9f3039;font-size:12px;line-height:1.3}.personal-check-legend>span{font-size:17px}.personal-check-legend strong{font-weight:800}\nhtml[data-personal-restoring] #login{display:none}\n.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.grid>.card{grid-column:1/-1}.grid>.card:has(#room),.grid>.card:has(#firearm){grid-column:span 1}.card:has(#room) h2{display:block}.card:has(#firearm) dl>div{flex-wrap:wrap;gap:4px;padding:6px 0}.card:has(#firearm) dd{text-align:left}.card:has(#uniform){grid-column:1/-1;padding:20px}.card:has(#uniform) h2{font-size:18px;margin-bottom:12px}.personal-uniform-table{font-size:14px}.personal-uniform-table tbody th{width:45%;text-align:left}.personal-uniform-table td,.personal-uniform-table th{padding:8px!important}.personal-uniform-table input{min-height:38px}.card:has(#uniform) dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 18px}@media(max-width:600px){.card:has(#uniform){padding:14px}.card:has(#uniform) h2{font-size:16px}.card:has(#room) h2,.card:has(#firearm) h2{font-size:13px}.card:has(#firearm) dl>div{font-size:12px}.card:has(#room) .room{font-size:14px}.card:has(#uniform) dl{grid-template-columns:1fr}}\n#assets .personal-table .item-col{width:26%}#assets .personal-table .status-col{width:32%}#assets .personal-table .detail-col{width:42%}.personal-check-header{display:block;font-size:10px;line-height:1.4;color:#9f3039;font-weight:700;white-space:nowrap}#assets .personal-table .asset-slot td>label:not(.unavailable){width:100%}#assets .personal-table tbody th .unavailable{display:inline-flex;vertical-align:middle;width:14px;min-height:14px;height:14px;margin:0 4px 0 0;padding:0}#assets .personal-table tbody th .unavailable input{width:14px;min-height:14px;height:14px;margin:0}#assets .personal-table tbody th{font-size:11px;line-height:1.4}\n\n.preview-drag{display:flex;align-items:center;gap:8px;margin:0 0 10px}.preview-drag strong{flex:1;font-size:12px}.preview-drag button{min-height:34px;padding:5px 9px;font-size:12px}.preview-grip{touch-action:none;cursor:grab}.preview-moving{opacity:.5;outline:3px solid #397acb}.preview-over{outline:3px solid #397acb}section.card{scroll-margin:20px}#assetActions{display:none}header a{pointer-events:none}</style></head><body>\n<header><a class=\"brand\" href=\"./\">군수계 <span>개인 조회</span></a><a class=\"admin\" href=\"../\">관리자 로그인 ↗</a></header>\n<section hidden id=\"login\" class=\"login\"><p class=\"eyebrow\">MY LOGISTICS</p><h1>내 군수 정보</h1><p class=\"sub\">이름과 총기번호로 확인하세요.</p><form id=\"loginForm\" autocomplete=\"off\"><label for=\"name\">이름</label><input id=\"name\" maxlength=\"60\" required placeholder=\"명단에 등록된 이름\" autocomplete=\"off\"><label for=\"number\">총기번호</label><input id=\"number\" type=\"password\" maxlength=\"60\" required autocomplete=\"off\" placeholder=\"총기번호 입력\"><button id=\"submit\" type=\"submit\">본인 정보 조회</button></form><p class=\"hint\">명단(총기번호) 관리 기준 · 인증 유지 15분</p></section>\n<p id=\"status\" role=\"status\" aria-live=\"polite\"></p>\n<main id=\"dashboard\"><div class=\"page-head\"><div><p class=\"eyebrow\">MY LOGISTICS</p><h1 id=\"personName\"></h1><p id=\"personMeta\" class=\"sub\"></p></div><div class=\"actions\"><button id=\"refresh\" type=\"button\">새로고침</button><button id=\"logout\" type=\"button\">종료</button></div></div><p id=\"warnings\" class=\"warning\" hidden></p>\n<div class=\"grid\"><section class=\"card wide\"><h2>생활실 위치</h2><p id=\"room\" class=\"room\"></p></section><section class=\"card wide\"><h2>생활실 비품</h2><p class=\"hint\">본인 자리·공용 · 변경은 관리자 확인 후 반영</p><form id=\"assetForm\"><div id=\"assets\"></div><div class=\"save-bar\" id=\"assetActions\" hidden><span id=\"assetStatus\" role=\"status\" aria-live=\"polite\"></span><button id=\"saveAssets\" type=\"submit\" disabled>수정 요청</button></div></form></section><section class=\"card\"><h2>총기</h2><dl id=\"firearm\"></dl></section><section class=\"card\"><h2>피복 사이즈</h2><div id=\"uniform\"></div></section><section class=\"card wide\"><h2>군수품</h2><div id=\"supplies\"></div></section></div><p id=\"updated\" class=\"hint\"></p></main>\n<footer>비품 외 정보 수정은 군수 담당자에게</footer><script>(()=>{\n const ids=['room','assets','firearm','uniform','supplies'],grid=document.querySelector('#dashboard>.grid'),cards=new Map(ids.map(id=>[id,document.getElementById(id).closest('section.card')]));let enabled=false,drag=null,original=null,pointer=null,scrollTimer=null;\n document.getElementById('personName').textContent='미리보기';document.getElementById('personMeta').textContent='예시 정보 · 실제 개인 정보 아님';document.getElementById('room').textContent='정예 본관 · 1층 · 132호 · 1번';document.getElementById('warnings').hidden=true;\n document.querySelectorAll('.page-head button').forEach(b=>b.disabled=true);\n function table(rows){return '<table class=\"personal-table\"><thead><tr><th>품목</th><th>상태</th><th>세부사항</th></tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map((v,i)=>'<'+(i?'td':'th')+'>'+v+'</'+(i?'td':'th')+'>').join('')+'</tr>').join('')+'</tbody></table>';}\n document.getElementById('assets').innerHTML=table([['책상','정상','1번 자리'],['침대','수리필요(보고완료)','서랍 수리 요청'],['냉장고','정상','공용']]);\n document.getElementById('firearm').innerHTML='<div><dt>총기번호</dt><dd>••••00</dd></div><div><dt>상태</dt><dd>정상</dd></div>';\n document.getElementById('uniform').innerHTML=table([['전투복','100',''],['근무복','100',''],['체육복','100',''],['외투','100',''],['전투화','270',''],['운동화','270',''],['모자','58','']]);document.getElementById('supplies').innerHTML=table([['공사티','정상','100 · 2개'],['체육복','정상','100 · 1개']]);\n document.getElementById('updated').textContent='예시 화면 · 카드 순서만 변경';\n document.querySelector('footer').textContent='비품·피복 변경은 관리자 확인 후 반영';\n function send(value){parent.postMessage({type:'personal-preview-v360',...value},'*');}\n function order(){return [...grid.children].map(card=>card.dataset.previewCard);}\n function setOrder(values){const seen=new Set();for(const id of values)for(const item of id==='room'||id==='firearm'?['room','firearm']:[id]){if(!seen.has(item)&&cards.has(item)){seen.add(item);grid.appendChild(cards.get(item));}}}\n function moveCard(id,target,after){const unit=id==='firearm'?'room':id,to=target==='firearm'?'room':target;if(unit===to)return;const units=order().filter(x=>x!=='firearm'&&x!==unit),index=units.indexOf(to);if(index<0)return;units.splice(index+(after?1:0),0,unit);setOrder(units);}\n function changed(){send({order:order()});}\n function cleanup(){clearInterval(scrollTimer);scrollTimer=null;for(const card of cards.values())card.classList.remove('preview-moving','preview-over');drag=null;pointer=null;original=null;send({scrollStop:true});}\n function cancel(){if(original)setOrder(original);cleanup();}\n for(const [id,card] of cards){\n  card.dataset.previewCard=id;const bar=document.createElement('div');bar.className='preview-drag';bar.innerHTML='<button type=\"button\" class=\"preview-grip\" aria-label=\"'+card.querySelector('h2').textContent+' 드래그\">⠿ 이동</button><strong></strong><button type=\"button\" data-preview-step=\"-1\" aria-label=\"위로\">↑</button><button type=\"button\" data-preview-step=\"1\" aria-label=\"아래로\">↓</button>';card.prepend(bar);\n  card.addEventListener('dragstart',e=>{if(!enabled||pointer!==null){e.preventDefault();return;}drag=id;original=order();e.dataTransfer.setData('text/plain',id);e.dataTransfer.effectAllowed='move';card.classList.add('preview-moving');});\n  card.addEventListener('dragover',e=>{if(!enabled||!drag||pointer!==null)return;e.preventDefault();e.dataTransfer.dropEffect='move';card.classList.add('preview-over');});\n  card.addEventListener('dragleave',()=>card.classList.remove('preview-over'));\n  card.addEventListener('drop',e=>{if(!enabled||!drag||pointer!==null)return;e.preventDefault();const r=card.getBoundingClientRect();moveCard(drag,id,e.clientY>=r.top+r.height/2);changed();cleanup();});\n  card.addEventListener('dragend',cancel);\n  bar.addEventListener('click',e=>{const b=e.target.closest('[data-preview-step]');if(!b||!enabled)return;const values=order().filter(x=>x!=='firearm'),unit=id==='firearm'?'room':id,i=values.indexOf(unit),j=i+Number(b.dataset.previewStep);if(j<0||j>=values.length)return;moveCard(unit,values[j],j>i);changed();});\n  const grip=bar.querySelector('.preview-grip');grip.draggable=false;\n  grip.addEventListener('pointerdown',e=>{if(!enabled||e.button!==0)return;e.preventDefault();drag=id;original=order();pointer=e.pointerId;document.body.setPointerCapture(pointer);card.classList.add('preview-moving');});\n }\n window.addEventListener('pointermove',e=>{if(pointer!==e.pointerId)return;e.preventDefault();const card=cards.get(drag),target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-preview-card]');if(target&&target!==card){const r=target.getBoundingClientRect();moveCard(drag,target.dataset.previewCard,e.clientY>=r.top+r.height/2);}send({pointerY:e.clientY});});\n window.addEventListener('pointerup',e=>{if(pointer!==e.pointerId)return;changed();cleanup();});\n window.addEventListener('pointercancel',()=>{if(pointer!==null)cancel();});document.body.addEventListener('lostpointercapture',()=>{if(pointer!==null)cancel();});\n window.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag)cancel();});\n window.addEventListener('message',e=>{if(e.source!==parent||e.data?.type!=='personal-preview-state-v360')return;cancel();const state=e.data;enabled=!!state.enabled;if(Array.isArray(state.order))setOrder(state.order);for(const card of cards.values()){card.draggable=enabled;card.querySelectorAll('.preview-drag button').forEach(b=>b.disabled=!enabled);}requestAnimationFrame(()=>send({height:document.documentElement.scrollHeight}));});\n new ResizeObserver(()=>send({height:document.documentElement.scrollHeight})).observe(document.body);send({ready:true});\n})();\n</script></body></html>\n";
const PERSONAL_INTERFACE_ITEMS_V359={room:'생활실 위치',assets:'생활실 비품',firearm:'총기',uniform:'피복 사이즈',supplies:'군수품'};
let personalInterfaceOrderV359=[],personalInterfaceOriginalV359='[]',personalInterfaceVersionV359='',personalInterfaceDirtyV359=false,personalInterfaceBusyV359=false;
function personalInterfaceRenderV359(){
 personalInterfacePreviewSyncV360();
 personalInterfaceDirtyV359=JSON.stringify(personalInterfaceOrderV359)!==personalInterfaceOriginalV359;
 $('personalInterfaceRowsV359').innerHTML=personalInterfaceOrderV359.map((id,i)=>'<li><strong>'+escapeH(PERSONAL_INTERFACE_ITEMS_V359[id])+'</strong><div class="asset-actions"><button class="btn" type="button" data-personal-move="'+i+'" data-direction="-1" aria-label="'+escapeH(PERSONAL_INTERFACE_ITEMS_V359[id])+' 위로" '+(!i||personalInterfaceBusyV359?'disabled':'')+'>↑</button><button class="btn" type="button" data-personal-move="'+i+'" data-direction="1" aria-label="'+escapeH(PERSONAL_INTERFACE_ITEMS_V359[id])+' 아래로" '+(i===personalInterfaceOrderV359.length-1||personalInterfaceBusyV359?'disabled':'')+'>↓</button></div></li>').join('');
 $('personalInterfaceSaveV359').disabled=personalInterfaceBusyV359||!personalInterfaceDirtyV359||!canManageUsersV281;
 ['personalInterfaceResetV359','personalInterfaceReloadV359'].forEach(id=>$(id).disabled=personalInterfaceBusyV359||!canManageUsersV281);
}
async function personalInterfaceLoadV359(){
 if(personalInterfaceBusyV359||personalInterfaceDirtyV359)return;
 if(!canManageUsersV281){personalInterfaceOrderV359=[];personalInterfaceOriginalV359='[]';$('personalInterfaceStatusV359').textContent='관리자만 설정할 수 있습니다.';personalInterfaceRenderV359();return;}
 personalInterfaceBusyV359=true;personalInterfaceRenderV359();$('personalInterfaceStatusV359').textContent='불러오는 중…';
 try{const value=await server('getPersonalInterfaceV359');personalInterfaceOrderV359=value.order;personalInterfaceVersionV359=value.version;personalInterfaceOriginalV359=JSON.stringify(value.order);$('personalInterfaceStatusV359').textContent='개인 조회앱 표시 순서';}
 catch(e){$('personalInterfaceStatusV359').textContent='조회 실패: '+e.message;}finally{personalInterfaceBusyV359=false;personalInterfaceRenderV359();}
}
$('personalInterfaceRowsV359').addEventListener('click',e=>{const b=e.target.closest('[data-personal-move]');if(!b||personalInterfaceBusyV359||!canManageUsersV281)return;const from=Number(b.dataset.personalMove),to=from+Number(b.dataset.direction);if(to<0||to>=personalInterfaceOrderV359.length)return;[personalInterfaceOrderV359[from],personalInterfaceOrderV359[to]]=[personalInterfaceOrderV359[to],personalInterfaceOrderV359[from]];personalInterfaceRenderV359();$('personalInterfaceStatusV359').textContent='저장 전 · 순서 변경 중';qsa('[data-personal-move]',$('personalInterfaceRowsV359')).find(el=>Number(el.dataset.personalMove)===to&&el.dataset.direction===b.dataset.direction)?.focus();});
$('personalInterfaceResetV359').addEventListener('click',()=>{if(personalInterfaceBusyV359||!canManageUsersV281)return;personalInterfaceOrderV359=Object.keys(PERSONAL_INTERFACE_ITEMS_V359);personalInterfaceRenderV359();$('personalInterfaceStatusV359').textContent='기본 순서 · 저장 후 반영';});
$('personalInterfaceReloadV359').addEventListener('click',()=>{if(personalInterfaceDirtyV359&&!confirm('저장하지 않은 순서 변경을 버리고 새로고침할까요?'))return;personalInterfaceDirtyV359=false;personalInterfaceLoadV359();});
$('personalInterfaceSaveV359').addEventListener('click',async()=>{
 if(personalInterfaceBusyV359||!personalInterfaceDirtyV359||!canManageUsersV281)return;personalInterfaceBusyV359=true;personalInterfaceRenderV359();$('personalInterfaceStatusV359').textContent='저장 중…';
 try{const value=await enqueue(()=>server('savePersonalInterfaceV359',personalInterfaceOrderV359,personalInterfaceVersionV359));personalInterfaceOrderV359=value.order;personalInterfaceVersionV359=value.version;personalInterfaceOriginalV359=JSON.stringify(value.order);$('personalInterfaceStatusV359').textContent='저장 완료 · 개인 조회 시 반영';}
 catch(e){$('personalInterfaceStatusV359').textContent='저장 실패: '+e.message;}finally{personalInterfaceBusyV359=false;personalInterfaceRenderV359();}
});
window.addEventListener('beforeunload',e=>{if(personalInterfaceDirtyV359){e.preventDefault();e.returnValue='';}});
let personalPreviewScrollV360=null,personalPreviewScrollYV360=0;
function personalInterfacePreviewSyncV360(){
 const frame=$('personalInterfacePreviewV360');if(!frame.dataset.initialized){frame.dataset.initialized='true';frame.srcdoc=PERSONAL_PREVIEW_HTML_V360;}
 frame.contentWindow?.postMessage({type:'personal-preview-state-v360',order:personalInterfaceOrderV359,enabled:canManageUsersV281&&!personalInterfaceBusyV359&&personalInterfaceOrderV359.length===5},'*');
}
window.addEventListener('message',e=>{
 const frame=$('personalInterfacePreviewV360'),value=e.data;if(e.source!==frame.contentWindow||value?.type!=='personal-preview-v360')return;
 if(value.ready)personalInterfacePreviewSyncV360();
 if(Number.isFinite(value.height))frame.style.height=Math.min(6000,Math.max(400,value.height))+'px';
 if(value.scrollStop){clearInterval(personalPreviewScrollV360);personalPreviewScrollV360=null;}
 if(Number.isFinite(value.pointerY)){
  personalPreviewScrollYV360=frame.getBoundingClientRect().top+value.pointerY;
  if(!personalPreviewScrollV360)personalPreviewScrollV360=setInterval(()=>{if(view!=='personalInterface'){clearInterval(personalPreviewScrollV360);personalPreviewScrollV360=null;return;}const y=personalPreviewScrollYV360;if(y<90)window.scrollBy(0,-18);else if(y>innerHeight-90)window.scrollBy(0,18);},30);
 }
 if(!Array.isArray(value.order)||personalInterfaceBusyV359||!canManageUsersV281)return;
 const known=Object.keys(PERSONAL_INTERFACE_ITEMS_V359);if(value.order.length!==known.length||new Set(value.order).size!==known.length||value.order.some(id=>!known.includes(id)))return;
 personalInterfaceOrderV359=value.order.slice();personalInterfaceRenderV359();$('personalInterfaceStatusV359').textContent=personalInterfaceDirtyV359?'저장 전 · 순서 변경 중':'개인 조회앱 표시 순서';
});


function dormPdfDutyRegionV365(tokens,boxes,sourceRoom){
 tokens=tokens.map(t=>({...t}));for(const t of tokens)if(/^\d{3}-$/.test(t.str)){const next=tokens.find(n=>/^[1-8동생명여女]$/.test(n.str)&&Math.abs(n.y-t.y)<2&&Math.abs(n.x-t.x-t.width)<6);if(next){t.str+=next.str.replace('女','여');t.width=next.x+next.width-t.x;}}
 const anchors=tokens.flatMap(t=>[...t.str.matchAll(/(?:^|\s)(\d{3}(?:-[1-8동생명여])?)(?=\s|$)/g)].map(m=>({...t,str:m[1],x:t.x+t.width*(m.index+m[0].indexOf(m[1]))/t.str.length,width:t.width*m[1].length/t.str.length}))).filter(t=>t.y>45);
 let matches=anchors.filter(a=>a.str===sourceRoom);if(!matches.length)matches=anchors.filter(a=>a.str.split('-')[0]===String(sourceRoom).split('-')[0]);if(matches.length!==1)return null;const a=matches[0];
 let box=boxes.filter(b=>b.height>50&&a.x+a.width/2>b.x&&a.x+a.width/2<b.x+b.width&&a.y>b.y&&a.y<b.y+25).sort((a,b)=>a.width*a.height-b.width*b.height)[0];
 if(!box){const header=boxes.filter(b=>b.height<26&&a.x+a.width/2>b.x&&a.x+a.width/2<b.x+b.width&&a.y>b.y&&a.y<b.y+b.height+1).sort((a,b)=>a.width-b.width)[0];if(header){let bottom=header.y+header.height;for(let i=0;i<2;i++){const body=boxes.filter(b=>b.height>25&&Math.abs(b.x-header.x)<1&&Math.abs(b.width-header.width)<1&&Math.abs(b.y-bottom)<1).sort((a,b)=>b.height-a.height)[0];if(!body)break;bottom=body.y+body.height;}if(bottom>header.y+40&&bottom-header.y<160)box={...header,height:bottom-header.y};}}
 return box?tokens.filter(t=>t.x>=box.x&&t.x<box.x+box.width&&t.y>a.y+5&&t.y<box.y+box.height):null;
}
function dutyCadetRowsV365(parsed,rooms){
 const norm=v=>String(v||'').normalize('NFKC').replace(/\s/g,'').replace(/(?:기|중대)$/,'');
 const all=rooms.flatMap(room=>(room.members||[]).map(person=>({person,room}))),rows=[],seen=new Set();
 for(const entry of parsed)for(const mark of entry.people.filter(p=>p.isDuty)){
  const source=entry.anchor,old=(source.pdfMembers||[]).find(p=>norm(p.name)===norm(mark.name));
  const suitable=all.filter(({person})=>norm(person.name)===norm(mark.name)&&(!old?.cohort||norm(person.cohort)===norm(old.cohort))&&(!old?.company||norm(person.company)===norm(old.company)));
  const local=suitable.filter(({room})=>source.roomId?room.id===source.roomId:room.building===source.building&&room.floor===source.floor&&room.room.split('-')[0]===source.room.split('-')[0]);
  const match=local.length===1?local[0]:suitable.length===1?suitable[0]:null,person=match?.person||old||{},room=match?.room||source;
  const key=[source.page,source.building,source.floor,source.sourceRoom||source.room,mark.name,mark.duty].join('|');if(seen.has(key))continue;seen.add(key);
  rows.push({sourceKey:key,cohort:norm(person.cohort),company:norm(person.company),name:match?.person.name||mark.name,duty:mark.duty||'직책 미표기',building:room.building,floor:room.floor,room:room.room,page:source.page,review:mark.dutyReview?'괄호 확인 필요':match?'현재 배정':'배정명단 확인 필요'});
 }
 return rows.sort((a,b)=>a.building.localeCompare(b.building,'ko')||a.floor.localeCompare(b.floor,'ko')||a.room.localeCompare(b.room,'ko',{numeric:true})||a.name.localeCompare(b.name,'ko'));
}
function dutyRoleChoicesV391(group,current){const roles=dutyFixedRolesV391(group);return {fixed:roles.length>0,roles:roles.length&&current&&!roles.includes(current)&&dutyFixedRoleValidV391({organization:group,duty:current})?[...roles,current]:roles};}
function dutyPersonCountV391(rows){const norm=v=>String(v||'').normalize('NFKC').replace(/\s/g,'');return new Set(rows.map(p=>[norm(p.cohort).replace(/(?:기)+$/,''),norm(p.company).replace(/(?:중대)+$/,''),norm(p.name)].join('|'))).size;}
function dutyAdditionalRowV391(row){const info=dutyRoleInfoV367(row),person=Object.fromEntries(['name','cohort','company','building','floor','room','gradeOverride'].filter(key=>row[key]!=null).map(key=>[key,row[key]]));return {...person,organization:info.organization,dutyCompanyOverride:info.organization==='중대'?String(info.company||''):row.dutyCompanyOverride||'',duty:'',familyOverride:'',saberRoleOverride:'auto'};}
function dutyCandidateRowsV391(rows){return rows.flatMap(row=>dutySplitAssignmentsV391(row.duty).map(duty=>({...row,duty})));}
function dutyRoleInfoV367(row){
 const text=String(row.duty||'').normalize('NFKC').replace(/\s/g,''),company=Number(row.dutyCompanyOverride||text.match(/([1-8])중대/)?.[1]||row.company)||0;
 const grade=Number(row.gradeOverride||text.match(/([1-4])학년/)?.[1]||({'75':4,'76':3,'77':2,'78':1})[String(row.cohort).replace(/기$/,'')])||0;
 const battalion=Number(row.battalionOverride||text.match(/([12])대대/)?.[1])||0;
 let organization=row.organization||(/동기/.test(text)?'동기회':/명예/.test(text)?'명예위':/생발|생활발전/.test(text)?'생발위':/전대/.test(text)?'전대':/대대/.test(text)&&battalion?battalion+'대대':/중대|편대|보좌|기수|교육|행정|보급|문화체육/.test(text)?'중대':'기타');
 let rank=90,series=['작전','인사','군수','체육','문화'].findIndex(s=>text.includes(s)),title=text;
 if(['전대','1대대','2대대'].includes(organization)){
  rank=/참모/.test(text)?(/보좌/.test(text)?10:1)+(series<0?8:series):/(전대장|대대장)/.test(text)?0:80;
 }else if(organization==='중대'){
  if(/중대장/.test(text))rank=0;
  else if(/편대장/.test(text))rank=1+(Number(text.match(/([1-4])편대장/)?.[1])||0)/10;
  else if(/보좌|교육|행정|보급|문화|체육/.test(text)){series=/문화|체육/.test(text)?3:/작전|교육/.test(text)?0:/인사|행정/.test(text)?1:/군수|보급/.test(text)?2:-1;rank=30+(series<0?8:series);if(/문화|체육/.test(text))title='문화체육보좌관';}
  else if(/기수/.test(text))rank=40;
  else rank=({4:10,3:20,2:50,1:60})[grade]||80;
 }else if(organization==='동기회')rank=/부회장/.test(text)?1:/회장/.test(text)?0:/총무/.test(text)?2:/친목활동부장/.test(text)?3:20;
 else if(organization==='명예위'||organization==='생발위')rank=/위원장/.test(text)&&!/부위원장/.test(text)?0:10;
 const orgOrder=({'전대':0,'1대대':1,'2대대':2,'중대':3,'동기회':4,'명예위':5,'생발위':6,'기타':9})[organization]??9;
 const ordinal=Number(text.match(/([12])(?:st|nd)/i)?.[1]||0);return {organization,company,grade,battalion,rank,title,sort:organization==='동기회'?[orgOrder,grade?5-grade:9,rank,battalion||9,company||9,ordinal]:[orgOrder,organization==='중대'?company:0,rank,grade?5-grade:9,battalion||9,company||9,ordinal]};
}
function dutySortV367(rows){return [...rows].sort((a,b)=>{const x=dutyRoleInfoV367(a).sort,y=dutyRoleInfoV367(b).sort;for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]-y[i];return String(a.name||'').localeCompare(String(b.name||''),'ko');});}
function dutyFamilyV367(row){
 if(row.familyOverride)return row.familyOverride;
 const info=dutyRoleInfoV367(row),text=String(row.duty||'').normalize('NFKC').replace(/\s/g,'');
 if(['동기회','명예위','생발위'].includes(info.organization))return info.organization;
 if(/전대장|대대장|중대장/.test(text)&&!/보좌/.test(text))return '장';
 if(/작전|교육|1편대장/.test(text))return '작전';if(/인사|행정|2편대장/.test(text))return '인사';if(/군수|보급|3편대장/.test(text))return '군수';if(/문화|체육|4편대장/.test(text))return '문화 및 체육';
 if(info.organization==='중대'&&/기수/.test(text))return '중대기수';
 if(info.organization==='중대'&&info.rank>=10)return '중대임원';return '기타';
}
function dutySaberRoleV367(row){
 if(row.saberRoleOverride==='none')return '';if(row.saberRoleOverride&&row.saberRoleOverride!=='auto')return row.saberRoleOverride;
 const info=dutyRoleInfoV367(row),text=String(row.duty||'').normalize('NFKC').replace(/\s/g,'');
 if(/보좌/.test(text))return '';
 if(['전대','1대대','2대대'].includes(info.organization)){
  if(/전대장|대대장/.test(text))return info.organization+'|대장생도';
  const series=['작전','인사','군수','체육','문화활동'].find(s=>text.includes(s)||(s==='문화활동'&&text.includes('문화')));return /참모/.test(text)&&series?info.organization+'|'+series+'참모생도':'';
 }
 if(info.organization==='중대'&&info.company){if(/중대장/.test(text))return info.company+'중대|중대장생도';const flight=text.match(/([1-4])편대장/);if(flight)return info.company+'중대|'+flight[1]+'편대장생도';}
 if(info.organization==='명예위'&&/위원장/.test(text))return '명예위원회|명예위원장생도';return '';
}
let dutyCadetsBusyV365=false,dutyCadetsDataV365=[],dutyCadetsMetaV365=null;
function dutyCadetsRenderV365(){return dutyCadetsRenderV367();}
async function dutyCadetsLoadV365(){if(dutyCadetsBusyV365)return;dutyCadetsBusyV365=true;$('dutyCadetsReloadV365').disabled=true;$('dutyCadetsStatusV365').textContent='명단 조회 중…';try{const meta=await server('getDutyCadetsV369');dutyCadetsMetaV365=meta;dutyCadetsDataV365=meta.records||[];dutyCadetsSetBuildingsV367();dutyCadetsRenderV365();}catch(e){$('dutyCadetsStatusV365').textContent='명단 조회 실패: '+e.message;}finally{dutyCadetsBusyV365=false;$('dutyCadetsReloadV365').disabled=false;}}
$('dutyCadetsReloadV365').addEventListener('click',dutyCadetsLoadV365);$('dutyCadetsSearchV365').addEventListener('input',dutyCadetsRenderV365);$('dutyCadetsBuildingV365').addEventListener('change',dutyCadetsRenderV365);
function dutyCadetsSetBuildingsV367(){const select=$('dutyCadetsBuildingV365'),old=select.value,buildings=[...new Set(dutyCadetsDataV365.map(p=>p.building).filter(Boolean))];select.innerHTML='<option value="">전체 관</option>'+buildings.map(b=>'<option value="'+escapeH(b)+'">'+escapeH(b)+'</option>').join('');select.value=buildings.includes(old)?old:'';}

const dutyFamiliesV367=['장','작전','인사','군수','문화 및 체육','동기회','명예위','생발위','중대임원','중대기수','기타'];
const dutyControlsV367=document.createElement('div');dutyControlsV367.className='asset-actions';dutyControlsV367.innerHTML='<select class="field" id="dutyModeV367" hidden aria-label="명단 보기"><option value="organization">근무별 · 전대·대대·중대</option></select><select class="field" id="dutyFamilyV367" aria-label="근무 계열"><option value="">전체 계열</option>'+dutyFamiliesV367.map(x=>'<option value="'+x+'">'+(({'명예위':'명예위원회','생발위':'생도생활발전위원회'})[x]||x)+'</option>').join('')+'</select>';$('dutyCadetsSearchV365').parentElement.before(dutyControlsV367);
$('dutyModeV367').addEventListener('change',dutyCadetsRenderV365);$('dutyFamilyV367').addEventListener('change',dutyCadetsRenderV365);
function dutyCadetsRenderV367(){
 const container=$('dutyCadetsRowsV365'),open=new Set([...container.querySelectorAll('details[open][data-duty-section]')].map(d=>d.dataset.dutySection)),query=$('dutyCadetsSearchV365').value.trim().toLowerCase(),building=$('dutyCadetsBuildingV365').value,family=$('dutyFamilyV367').value;
 const list=dutyOrderRowsV372(dutyCadetsDataV365.filter(p=>(!building||p.building===building)&&(!family||dutyFamilyV367(p)===family)&&(!query||Object.values(p).join(' ').toLowerCase().includes(query))));
 container.innerHTML=dutyAccordionV373(list,rows=>'<div class="eq-scroll"><table class="eq-table"><thead><tr><th>순서 / 기수</th><th>중대</th><th>이름</th><th>근무</th><th>생활실</th><th>확인</th><th>예도 연결</th><th>관리</th></tr></thead><tbody>'+rows.map(p=>{const i=dutyRoleInfoV367(p),role=dutySaberRoleV367(p);return '<tr data-duty-row="'+escapeH(p.id)+'"><td><button type="button" class="btn" data-duty-grip="'+escapeH(p.id)+'" draggable="true" style="touch-action:none" title="드래그 · Alt+위/아래" aria-label="'+escapeH(p.name)+' 순서 이동">↕</button>'+escapeH(p.cohort?p.cohort+'기':'확인 필요')+'</td><td>'+escapeH(p.company?p.company+'중대':'확인 필요')+'</td><td><strong>'+escapeH(p.name)+'</strong></td><td>'+escapeH(i.title)+'</td><td>'+escapeH([p.building,p.floor,p.room?p.room+'호':''].filter(Boolean).join(' '))+'</td><td>'+escapeH(p.splitReview||(p.edited?'수정됨':p.review))+'</td><td>'+escapeH(role?role.replace('|',' · '):'—')+'</td><td><button type="button" class="btn" data-duty-edit="'+escapeH(p.id)+'">수정</button><button type="button" class="btn" data-duty-add-role="'+escapeH(p.id)+'">근무 추가</button><button type="button" class="btn" data-duty-delete="'+escapeH(p.id)+'">삭제</button></td></tr>';}).join('')+'</tbody></table></div>',open);
 $('dutyCadetsStatusV365').textContent='전체 '+dutyCadetsDataV365.length+'건 · 인원 '+dutyPersonCountV391(dutyCadetsDataV365)+'명 · 표시 '+list.length+'건';
}
const dutyDialogV367=document.createElement('dialog');dutyDialogV367.style.cssText='width:min(520px,92vw);max-height:90dvh;overflow:auto';dutyDialogV367.innerHTML='<form id="dutyFormV367"><h2>근무생도 수정</h2>'+[['name','이름'],['cohort','기수'],['company','중대'],['duty','근무'],['building','건물'],['floor','층'],['room','호실']].map(([key,label])=>'<label style="display:block">'+label+'<input class="field" name="'+key+'" '+(['name','duty'].includes(key)?'required':'')+' maxlength="'+(key==='duty'?160:60)+'"></label>').join('')+[['organization','조직',['자동','전대','1대대','2대대','중대','동기회','명예위','생발위','기타']],['gradeOverride','학년',['자동','1','2','3','4']],['battalionOverride','대대',['자동','1','2']]].map(([key,label,opts])=>'<label style="display:block">'+label+'<select class="field" name="'+key+'">'+opts.map((v,i)=>'<option value="'+(i?v:'')+'">'+v+'</option>').join('')+'</select></label>').join('')+'<label style="display:block">예도 연결<select class="field" name="saberRoleOverride"></select></label><p role="status" id="dutyEditStatusV367"></p><div class="asset-actions"><button type="submit" class="btn">저장</button><button type="button" class="btn" id="dutyCloseV367">닫기</button></div></form>';document.body.append(dutyDialogV367);
let dutyEditRowV367=null,dutySavingV367=false;
function dutyOpenV369(p,additional=false){if(dutyMoveBusyV372||dutySavingV367)return;dutyEditRowV367=additional?null:p||null;const initial=additional?dutyAdditionalRowV391(p):p,form=$('dutyFormV367'),roles=dutyCadetsMetaV365?.saberRoles||[];form.reset();form.querySelector('h2').textContent=additional?'같은 인원 근무 추가':p?'근무생도 수정':'근무생도 추가';form.elements.saberRoleOverride.innerHTML='<option value="auto">자동 연결</option><option value="none">연결 안 함</option>'+roles.map(r=>'<option value="'+escapeH(r.id)+'">'+escapeH(r.id.replace('|',' · '))+'</option>').join('');for(const key of ['name','cohort','company','duty','organization','gradeOverride','battalionOverride','saberRoleOverride','building','floor','room'])form.elements[key].value=initial?.[key]||(key==='saberRoleOverride'?'auto':'');dutySetOrgFormV372(initial);$('dutyEditStatusV367').textContent='';dutyDialogV367.showModal();globalThis.LOGBOOK_DUTY_EDITOR.open(initial);}
$('dutyCadetsRowsV365').addEventListener('click',e=>{const b=e.target.closest('[data-duty-edit],[data-duty-add-role]');if(!b)return;const additional=b.dataset.dutyAddRole!==undefined,p=dutyCadetsDataV365.find(x=>x.id===(additional?b.dataset.dutyAddRole:b.dataset.dutyEdit));if(p)dutyOpenV369(p,additional);});
const dutyAddV369=document.createElement('button');dutyAddV369.type='button';dutyAddV369.className='btn';dutyAddV369.id='dutyAddV369';dutyAddV369.textContent='근무 등록';dutyAddV369.onclick=()=>dutyOpenV369(null);$('dutyCadetsReloadV365').before(dutyAddV369);
$('dutyCloseV367').onclick=()=>{if(!dutySavingV367)dutyDialogV367.close();};dutyDialogV367.addEventListener('cancel',e=>{if(dutySavingV367)e.preventDefault();});
$('dutyFormV367').addEventListener('submit',async e=>{e.preventDefault();if(dutySavingV367||!globalThis.LOGBOOK_DUTY_EDITOR.beforeSubmit(e.target))return;dutySavingV367=true;const form=e.target,patch=Object.fromEntries(new FormData(form));form.querySelector('[type=submit]').disabled=true;try{if(!globalThis.LOGBOOK_DUTY_EDITOR.locked())dutyApplyOrgFormV372(patch);globalThis.LOGBOOK_DUTY_EDITOR.patch(patch);await enqueue(()=>dutyEditRowV367?server('saveDormDutyCadetV367',dutyEditRowV367.id,patch,dutyEditRowV367.updatedAt):server('addDutyCadetV369',patch));await dutyCadetsLoadV365();dutyDialogV367.close();toast('근무명단 저장 완료');}catch(error){$('dutyEditStatusV367').textContent=error.message;}finally{dutySavingV367=false;form.querySelector('[type=submit]').disabled=false;}});

const dutyDeleteV369=document.createElement('button');dutyDeleteV369.type='button';dutyDeleteV369.className='btn';dutyDeleteV369.textContent='명단에서 삭제';dutyDeleteV369.onclick=async()=>{if(!dutyEditRowV367||dutySavingV367)return;if(!confirm(dutyEditRowV367.name+' 생도를 근무명단에서 삭제할까요?'))return;dutySavingV367=true;try{await enqueue(()=>server('deleteDutyCadetV369',dutyEditRowV367.id,dutyEditRowV367.updatedAt));dutyCadetsDataV365=dutyCadetsDataV365.filter(p=>p.id!==dutyEditRowV367.id);dutyCadetsSetBuildingsV367();dutyCadetsRenderV365();dutyDialogV367.close();}catch(e){$('dutyEditStatusV367').textContent=e.message;}finally{dutySavingV367=false;}};$('dutyCloseV367').before(dutyDeleteV369);dutyDialogV367.addEventListener('toggle',()=>{dutyDeleteV369.hidden=!dutyEditRowV367;});

function dutyPasteV371(text){
 const rows=[],errors=[];let organization='',unit='',term='';for(const [i,raw] of String(text||'').normalize('NFKC').split(/\r?\n/).entries()){const line=raw.trim();if(!line)continue;if(/^<.*>$/.test(line)){term=line.slice(1,-1);continue;}const header=line.match(/^\[(.+)\]$/);if(header){const label=header[1].replace(/\s/g,'');unit=label.replace(/본부$/,'');organization=({'동기회':'동기회','명예위원회':'명예위','명예위':'명예위','생도생활발전위원회':'생발위','생발위':'생발위'})[unit]|| (unit==='전대'?'전대':/^[12]대대$/.test(unit)?unit:/^[1-8]중대$/.test(unit)?'중대':'');if(!organization)errors.push((i+1)+'행: 조직 확인');continue;}if(/^기수[\s,\t]+중대/.test(line))continue;
 const cells=line.split(/\t|,/).map(v=>v.trim());let cohort,company,name,duty;
 const structured=line.match(/^(.+?)[:：]\s*(\d{2,3})\s*\.\s*([1-8])\s*\.\s*(.+?)\s*$/);
 if(structured){[,duty,cohort,company,name]=structured;if(!organization){errors.push((i+1)+'행: 본부 제목 확인');continue;}if(organization==='중대'&&unit!==company+'중대'){errors.push((i+1)+'행: 본부와 소속 중대 불일치');continue;}duty=duty.startsWith(unit)?duty:unit+' '+duty;}
 else if(cells.length>=4)[cohort,company,name,...duty]=cells,duty=duty.join(' · ');
 else{const m=line.match(/^(\d{2,3})\s*기?\s*[·|/]?\s*([1-8])\s*중대\s*[·|/]?\s*([가-힣]{2,5}[A-D]?)\s*[·|/]?\s+(.+)$/);if(m)[,cohort,company,name,duty]=m;}
 cohort=String(cohort||'').replace(/(?:기)+$/,'').trim();company=String(company||'').replace(/(?:중대)+$/,'').trim();if(!/^\d{2,3}$/.test(cohort)||! /^[1-8]$/.test(company)||!name||!duty){errors.push((i+1)+'행: 기수 / 중대 / 이름 / 근무 확인');continue;}rows.push({cohort,company,name,duty,...(structured?{organization}: {})});
 }return {rows,errors,term};
}
function dutyMatchV371(row,reference){
 const norm=v=>String(v||'').normalize('NFKC').replace(/\s/g,''),c=v=>norm(v).replace(/(?:기)+$/,''),u=v=>norm(v).replace(/(?:중대)+$/,''),name=norm(row.name),base=name.replace(/([가-힣])[A-D]$/,'$1');
 const scoped=reference.filter(p=>(!c(row.cohort)||c(row.cohort)===c(p.cohort))&&(!u(row.company)||u(row.company)===u(p.company))),exact=scoped.filter(p=>norm(p.name)===name);
 if(exact.length)return exact;const aliases=scoped.filter(p=>norm(p.name).replace(/([가-힣])[A-D]$/,'$1')===base&&(name===base||norm(p.name)===base));return aliases;
}
function dutyMergeV371(pdf,paste){const used=new Set(),rows=[];for(const p of paste){const matches=dutyMatchV371({...p,cohort:'',company:''},pdf).filter(r=>(!r.cohort||String(r.cohort).normalize('NFKC').replace(/(?:기)+$/,'')===p.cohort)&&(!r.company||String(r.company).normalize('NFKC').replace(/(?:중대)+$/,'')===p.company)),roleMatches=matches.filter(r=>dutyAssignmentKeyV391({...r,cohort:p.cohort,company:p.company,name:p.name})===dutyAssignmentKeyV391(p)),candidates=roleMatches.length?roleMatches:matches,found=candidates.length===1?candidates[0]:null;if(found)used.add(found);rows.push({...found,...p,pdf:!!found,pasted:true,pdfStatus:candidates.length>1?'PDF 중복':found?(roleMatches.length?'일치':'근무 다름'):'PDF 없음'});}for(const p of pdf)if(!used.has(p))rows.push({...p,pdf:true,pasted:false,pdfStatus:'붙여넣기 없음'});return rows;}
let dutyVerifyBusyV371=false,dutyPdfV371=null,dutyCandidatesV371=[],dutySmartV371=null;
function dutyVerifyFieldV391(p,i,k){const attrs='class="field" data-duty-verify-index="'+i+'" data-duty-verify-field="'+k+'" aria-label="'+escapeH(p.name+' '+k)+'" style="min-width:'+(k==='duty'?160:k==='name'?85:50)+'px" '+(dutyVerifyBusyV371?'disabled':'');if(k==='duty'){const choices=dutyRoleChoicesV391(dutyRoleInfoV367(p).organization,p.duty);if(choices.fixed)return '<select '+attrs+'><option value="">근무 선택</option>'+choices.roles.map(role=>'<option value="'+escapeH(role)+'" '+(role===p.duty?'selected':'')+'>'+escapeH(role)+'</option>').join('')+'</select>';}return '<input '+attrs+' value="'+escapeH(p[k]||'')+'">';}
const dutyVerifyPanelV371=document.createElement('details');dutyVerifyPanelV371.className='panel';dutyVerifyPanelV371.innerHTML='<summary><strong>명단 검증 · PDF / 붙여넣기 / 스마트당직</strong></summary><p class="panel-sub">1. 등록 PDF 읽기 → 2. 명단 붙여넣기 → 3. 스마트당직 대조 → 선택 추가</p><button type="button" class="btn" id="dutyPdfReadV371">1차 · 방 배정 PDF 읽기</button><p class="panel-sub">생활실 인원 현황에 등록된 PDF 기준</p><label for="dutyPasteV371">2차 · 근무 명단</label><textarea class="field" id="dutyPasteV371" rows="9" style="width:100%;box-sizing:border-box" placeholder="&lt;75-3차 지휘근무생도&gt;&#10;[전대본부]&#10;작전참모생도: 75.4.검증이름&#10;&#10;[1중대본부]&#10;교육보좌관생도: 76.1.검증이름"></textarea><div class="asset-actions"><button type="button" class="btn" id="dutyPasteCompareV371">2차 · 붙여넣기 대조</button><button type="button" class="btn" id="dutySmartCheckV371">3차 · 스마트당직 대조</button><button type="button" class="btn" id="dutyVerifiedAddV371">선택 인원 추가</button></div><p id="dutyVerifyStatusV371" role="status" aria-live="polite"></p><div class="eq-scroll"><table class="eq-table"><thead><tr><th>선택</th><th>기수</th><th>중대</th><th>이름</th><th>근무</th><th>PDF / 붙여넣기</th><th>스마트당직</th><th>등록</th></tr></thead><tbody id="dutyVerifyRowsV371"></tbody></table></div>';$('dutyCadetsView').prepend(dutyVerifyPanelV371);
function dutyVerifyRenderV371(){
 $('dutyPasteV371').disabled=dutyVerifyBusyV371;
 $('dutySmartCheckV371').disabled=dutyVerifyBusyV371||!dutyCandidatesV371.length;$('dutyVerifiedAddV371').disabled=dutyVerifyBusyV371||!dutySmartV371;$('dutyPdfReadV371').disabled=dutyVerifyBusyV371;$('dutyPasteCompareV371').disabled=dutyVerifyBusyV371||!dutyPdfV371;
 $('dutyVerifyRowsV371').innerHTML=dutyCandidatesV371.map((p,i)=>{const s=dutySmartV371?.rows[i],enabled=!dutyVerifyBusyV371&&p.pasted&&s?.status==='일치'&&!s.existing;return '<tr><td><input type="checkbox" data-duty-verify-select="'+i+'" '+(!enabled?'disabled':'')+' '+(enabled&&p.pdf?'checked':'')+' aria-label="'+escapeH(p.name)+' '+escapeH(p.duty)+' 추가 선택"></td>'+['cohort','company','name','duty'].map(k=>'<td>'+dutyVerifyFieldV391(p,i,k)+'</td>').join('')+'<td>'+escapeH(p.pdfStatus)+(p.pdf&&p.pasted?' · 2차 확인':'')+'</td><td>'+escapeH(s?.status||'대조 전')+'</td><td>'+(s?.existingId?'<button type="button" class="btn" data-duty-known="'+escapeH(s.existingId)+'" '+(dutyVerifyBusyV371?'disabled':'')+'>기등록 · 수정</button>':s?.existing?'기등록 중복 확인':'신규')+'</td></tr>';}).join('');
}
async function dutyReadPdfV371(){let pdf;const meta=await server('getDormDutyCadetsV365',false),parsed=[],skipped=[];
 if(!meta.layout?.length)throw Error('등록된 방 배정 PDF를 확인하세요.');
 if(meta.indexed)for(const anchor of meta.layout)parsed.push({anchor,people:anchor.pdfMembers});
 else{const source=await server('getDormDutyCadetsV365',true);if(source.version!==meta.version)throw Error('PDF가 변경되었습니다. 다시 읽으세요.');if(!source.base64)throw Error('등록된 PDF가 없습니다.');await loadPdfJsV273();try{pdf=await pdfjsLib.getDocument({data:Uint8Array.from(atob(source.base64),c=>c.charCodeAt(0)),isEvalSupported:false}).promise;if(pdf.numPages>50)throw Error('PDF는 50쪽 이하로 등록하세요.');
 for(const n of [...new Set(meta.layout.map(r=>r.page))]){const page=await pdf.getPage(n),vp=page.getViewport({scale:1}),text=await page.getTextContent(),op=await page.getOperatorList(),tokens=text.items.filter(t=>t.str?.trim()).map(t=>{const point=vp.convertToViewportPoint(t.transform[4],t.transform[5]);return {str:t.str.trim(),x:point[0],y:point[1],width:t.width,height:t.height};}),boxes=[];
 for(let i=0;i<op.fnArray.length;i++)if(op.fnArray[i]===pdfjsLib.OPS.constructPath){const a=op.argsArray[i][2];if(a?.length===4){const rect=vp.convertToViewportRectangle([a[0],a[2],a[1],a[3]]),w=Math.abs(rect[2]-rect[0]),h=Math.abs(rect[3]-rect[1]);if(w>20&&w<100&&h>8&&h<160)boxes.push({x:Math.min(rect[0],rect[2]),y:Math.min(rect[1],rect[3]),width:w,height:h});}}
 for(const anchor of meta.layout.filter(a=>a.page===n)){const region=dormPdfDutyRegionV365(tokens,boxes,anchor.sourceRoom||anchor.room);if(!region){skipped.push([anchor.building,anchor.floor,anchor.room+'호'].join(' '));continue;}parsed.push({anchor,people:dormPdfPeopleV365(region,anchor.building==='별관'?4:2)});}}
 }finally{if(pdf)await pdf.destroy().catch(()=>{});}}
 return {version:meta.version,filename:meta.filename,rows:dutyCadetRowsV365(parsed,meta.rooms),skipped};
}
$('dutyPdfReadV371').onclick=async()=>{if(dutyVerifyBusyV371)return;dutyVerifyBusyV371=true;dutyPdfV371=null;dutyCandidatesV371=[];dutySmartV371=null;dutyVerifyRenderV371();$('dutyVerifyStatusV371').textContent='PDF 판독 중…';try{dutyPdfV371=await dutyReadPdfV371();$('dutyVerifyStatusV371').textContent=dutyPdfV371.filename+' · '+dutyPdfV371.rows.length+'명'+(dutyPdfV371.skipped.length?' · 판독 확인: '+dutyPdfV371.skipped.join(', '):'');}catch(e){$('dutyVerifyStatusV371').textContent=e.message;}finally{dutyVerifyBusyV371=false;dutyVerifyRenderV371();}};
$('dutyPasteV371').addEventListener('input',()=>{dutyCandidatesV371=[];dutySmartV371=null;dutyVerifyRenderV371();});
$('dutyPasteCompareV371').onclick=()=>{if(dutyVerifyBusyV371||!dutyPdfV371)return;const parsed=dutyPasteV371($('dutyPasteV371').value);dutySmartV371=null;if(parsed.errors.length||!parsed.rows.length){dutyCandidatesV371=[];$('dutyVerifyStatusV371').textContent=parsed.errors.join(' / ')||'명단을 붙여넣으세요.';}else{const pasted=dutyCandidateRowsV391(parsed.rows);dutyCandidatesV371=dutyMergeV371(dutyCandidateRowsV391(dutyPdfV371.rows),pasted);$('dutyVerifyStatusV371').textContent=(parsed.term?parsed.term+' · ':'')+'붙여넣기 '+pasted.length+'건 · 인원 '+dutyPersonCountV391(pasted)+'명 · PDF 없음 '+dutyCandidatesV371.filter(p=>p.pasted&&!p.pdf).length+'건 · 붙여넣기 없음 '+dutyCandidatesV371.filter(p=>!p.pasted).length+'건 · 근무 다름 '+dutyCandidatesV371.filter(p=>p.pdfStatus==='근무 다름').length+'건';}dutyVerifyRenderV371();};
$('dutyVerifyRowsV371').addEventListener('change',e=>{const i=e.target.dataset.dutyVerifyIndex,k=e.target.dataset.dutyVerifyField;if(i==null||!k)return;dutyCandidatesV371[Number(i)][k]=e.target.value.trim();dutySmartV371=null;$('dutyVerifyStatusV371').textContent='수정됨 · 스마트당직을 다시 대조하세요.';dutyVerifyRenderV371();});
$('dutyVerifyRowsV371').addEventListener('click',e=>{const b=e.target.closest('[data-duty-known]');if(!b)return;const p=dutyCadetsDataV365.find(r=>r.id===b.dataset.dutyKnown);if(p)dutyOpenV369(p);});
$('dutySmartCheckV371').onclick=async()=>{if(dutyVerifyBusyV371||!dutyCandidatesV371.length)return;dutyCandidatesV371=dutyCandidateRowsV391(dutyCandidatesV371);dutyVerifyBusyV371=true;dutyVerifyRenderV371();$('dutyVerifyStatusV371').textContent='스마트당직 시트 대조 중…';try{dutySmartV371=await server('verifyDutyCadetsV371',dutyCandidatesV371);$('dutyVerifyStatusV371').textContent=dutySmartV371.source+' · 일치 '+dutySmartV371.rows.filter(r=>r.status==='일치').length+'건 · 확인 필요 '+dutySmartV371.rows.filter(r=>r.status!=='일치').length+'건 · 기등록 '+dutySmartV371.rows.filter(r=>r.existing).length+'건';}catch(e){dutySmartV371=null;$('dutyVerifyStatusV371').textContent='대조 실패: '+e.message;}finally{dutyVerifyBusyV371=false;dutyVerifyRenderV371();}};
$('dutyVerifiedAddV371').onclick=async()=>{if(dutyVerifyBusyV371||!dutySmartV371)return;const rows=[...$('dutyVerifyRowsV371').querySelectorAll('[data-duty-verify-select]:checked')].map(el=>dutyCandidatesV371[Number(el.dataset.dutyVerifySelect)]);if(!rows.length){$('dutyVerifyStatusV371').textContent='추가할 근무를 선택하세요.';return;}dutyVerifyBusyV371=true;dutyVerifyRenderV371();try{const result=await enqueue(()=>server('importVerifiedDutyCadetsV371',dutyPdfV371.version,rows));dutySmartV371=null;await dutyCadetsLoadV365();$('dutyVerifyStatusV371').textContent=result.added+'건 추가 완료 · 아래 명단에서 최종 수정할 수 있습니다.';}catch(e){$('dutyVerifyStatusV371').textContent='추가 실패: '+e.message;}finally{dutyVerifyBusyV371=false;dutyVerifyRenderV371();}};
dutyVerifyRenderV371();


function dutySplitAssignmentsV391(value){
 const duty=String(value||'').trim(),parts=duty.split(/\s*[,，·;\/\r\n]+\s*/).filter(Boolean);
 const complete=text=>/중대임원|여생도임원|보좌관|중대기수|편대장|중대장|전대장|대대장|참모|회장|총무|위원장|위원|친목활동부장/.test(text.normalize('NFKC').replace(/\s/g,''));
 return parts.length>1&&parts.every(complete)?parts:[duty];
}
function dutyFixedRolesV391(organization){
 const staff=['작전','인사','군수','체육','문화활동'];
 if(organization==='전대')return ['전대장',...staff.map(name=>'전대'+name+'참모'),...staff.map(name=>name+'참모보좌관')];
 if(/^[12]대대$/.test(organization))return [organization+'장',...staff.map(name=>organization+name+'참모')];
 return [];
}
function dutyAssignmentKeyV391(row){
 const norm=value=>String(value||'').normalize('NFKC').replace(/\s/g,''),info=dutyRoleInfoV367(row),unit=info.organization==='중대'?(info.company?info.company+'중대':'중대'):info.organization;
 let role=norm(row.duty).replace(/생도/g,'').replace(/(?:1st|2nd)$/i,'').replace(new RegExp('^'+unit),'').toLowerCase();if(['전대','1대대','2대대'].includes(info.organization))role=role.replace(info.organization==='전대'?/^전대장$/:/^대대장$/,'장').replace(/문화참모/,'문화활동참모');
 return JSON.stringify([norm(row.cohort).replace(/(?:기)+$/,''),norm(row.company).replace(/(?:중대)+$/,''),norm(row.name),unit,role]);
}
function dutyFixedRoleValidV391(row){
 const organization=dutyRoleInfoV367(row).organization,roles=dutyFixedRolesV391(organization);if(!roles.length)return true;
 const norm=value=>String(value||'').normalize('NFKC').replace(/\s|생도/g,'').replace(/(?:1st|2nd)$/i,'').replace(new RegExp('^'+organization),'').replace(organization==='전대'?/^전대장$/:/^대대장$/,'장').replace(/문화참모/,'문화활동참모');
 return roles.some(role=>norm(role)===norm(row.duty));
}

function dutyOrgKeyV372(p){const i=dutyRoleInfoV367(p);return i.organization==='중대'?(i.company?i.company+'중대':'중대 확인'):i.organization;}
function dutyOrderRowsV372(rows){const sorted=dutySortV367(rows);return sorted.sort((a,b)=>{const x=Number.isFinite(a.manualOrder)&&a.orderGroup===dutyOrgKeyV372(a),y=Number.isFinite(b.manualOrder)&&b.orderGroup===dutyOrgKeyV372(b);return x&&y?a.manualOrder-b.manualOrder:x?-1:y?1:0;});}
function dutyOrderSignatureV372(rows,group){return JSON.stringify(rows.filter(p=>dutyOrgKeyV372(p)===group).map(p=>[p.id,p.updatedAt||'']).sort((a,b)=>a[0].localeCompare(b[0])));}
function dutyHierarchyV373(rows){const groups=new Map([['전대',new Map([['전대',[]]])],['대대',new Map([['1대대',[]],['2대대',[]]])],['중대',new Map(Array.from({length:8},(_,i)=>[(i+1)+'중대',[]]))],['동기회',new Map([['동기회',[]]])],['명예위',new Map([['명예위',[]]])],['생발위',new Map([['생발위',[]]])]]);for(const p of rows){const leaf=dutyOrgKeyV372(p),major=leaf==='전대'?'전대':/^[12]대대$/.test(leaf)?'대대':/중대/.test(leaf)?'중대':leaf;if(!groups.has(major))groups.set(major,new Map());const children=groups.get(major);if(!children.has(leaf))children.set(leaf,[]);children.get(leaf).push(p);}const rank=['전대','대대','중대','동기회','명예위','생발위','기타'];return [...groups].sort(([a],[b])=>(rank.indexOf(a)<0?99:rank.indexOf(a))-(rank.indexOf(b)<0?99:rank.indexOf(b))).map(([key,children])=>({key,label:({'명예위':'명예위원회','생발위':'생도생활발전위원회'})[key]||(['전대','대대','중대'].includes(key)?key+' 근무':key),children:[...children].sort(([a],[b])=>a.localeCompare(b,'ko',{numeric:true})).map(([key,rows])=>({key,rows})),count:[...children.values()].reduce((n,rows)=>n+rows.length,0)}));}
function dutyAccordionV373(rows,renderTable,open){return dutyHierarchyV373(rows).map(g=>'<details data-duty-section="'+escapeH(g.key)+'" '+(open.has(g.key)?'open':'')+' style="margin:10px 0;border:1px solid #dce4ef;border-radius:10px;padding:10px"><summary style="cursor:pointer;font-weight:700">'+escapeH(g.label)+' · '+g.count+'명</summary>'+g.children.map(c=>g.children.length===1&&c.key===g.key?(c.rows.length?renderTable(c.rows):'<p class="panel-sub">등록된 인원이 없습니다.</p>'):'<details data-duty-section="'+escapeH(g.key+'/'+c.key)+'" '+(open.has(g.key+'/'+c.key)?'open':'')+' style="margin:8px 0"><summary style="cursor:pointer;font-weight:600">'+escapeH(c.key)+' · '+c.rows.length+'명</summary>'+renderTable(c.rows)+'</details>').join('')+'</details>').join('')||'<p>표시할 인원이 없습니다.</p>';}
const dutyOrgNamesV372=['전대','1대대','2대대','1중대','2중대','3중대','4중대','5중대','6중대','7중대','8중대','동기회','명예위','생발위','기타','중대 확인'];
const dutyOrgLabelV372=k=>({'명예위':'명예위원회','생발위':'생도생활발전위원회'})[k]||k;
const dutyAssignmentLabelV372=document.createElement('label');dutyAssignmentLabelV372.style.display='block';dutyAssignmentLabelV372.innerHTML='소속 근무<select class="field" id="dutyAssignmentV372" required><option value="">소속 선택</option>'+dutyOrgNamesV372.filter(k=>k!=='중대 확인').map(k=>'<option value="'+k+'">'+dutyOrgLabelV372(k)+(k==='전대'||/^[1-8](대대|중대)$/.test(k)?' 근무':'')+'</option>').join('')+'</select>';
const dutyFormV372=$('dutyFormV367');dutyFormV372.querySelector('h2').after(dutyAssignmentLabelV372);dutyFormV372.elements.organization.closest('label').hidden=true;dutyFormV372.elements.organization.closest('label').style.display='none';$('dutyModeV367').style.display='none';
const dutyFamilyLabelV372=document.createElement('label');dutyFamilyLabelV372.style.display='block';dutyFamilyLabelV372.innerHTML='근무 계열<select class="field" name="familyOverride"><option value="">자동 분류</option>'+dutyFamiliesV367.map(k=>'<option value="'+k+'">'+dutyOrgLabelV372(k)+'</option>').join('')+'</select>';dutyAssignmentLabelV372.after(dutyFamilyLabelV372);
const dutyFixedLabelV391=document.createElement('label');dutyFixedLabelV391.style.display='block';dutyFixedLabelV391.innerHTML='근무<select class="field" id="dutyFixedRoleV391"><option value="">근무 선택</option></select>';dutyFormV372.elements.duty.closest('label').after(dutyFixedLabelV391);
function dutySyncFixedRoleV391(){const input=dutyFormV372.elements.duty,choices=dutyRoleChoicesV391($('dutyAssignmentV372').value,input.value),select=$('dutyFixedRoleV391'),label=input.closest('label');label.hidden=choices.fixed;label.style.display=choices.fixed?'none':'block';input.required=!choices.fixed;dutyFixedLabelV391.hidden=!choices.fixed;dutyFixedLabelV391.style.display=choices.fixed?'block':'none';select.required=choices.fixed;if(choices.fixed){const previous=input.value;select.innerHTML='<option value="">근무 선택</option>'+choices.roles.map(role=>'<option value="'+escapeH(role)+'">'+escapeH(role)+'</option>').join('');select.value=choices.roles.includes(previous)?previous:'';input.value=select.value;}}
$('dutyAssignmentV372').addEventListener('change',dutySyncFixedRoleV391);$('dutyFixedRoleV391').addEventListener('change',()=>{dutyFormV372.elements.duty.value=$('dutyFixedRoleV391').value;});
function dutySetOrgFormV372(p){const group=p?dutyOrgKeyV372(p):'';$('dutyAssignmentV372').value=dutyOrgNamesV372.includes(group)&&group!=='중대 확인'?group:'';dutyFormV372.elements.familyOverride.value=p?.familyOverride||'';dutyDeleteV369.hidden=!dutyEditRowV367;dutyDeleteV369.style.display=dutyEditRowV367?'':'none';dutySyncFixedRoleV391();}
function dutyApplyOrgFormV372(patch){const group=$('dutyAssignmentV372').value;if(!group)throw Error('소속 근무를 선택하세요.');patch.organization=/^[1-8]중대$/.test(group)?'중대':group;patch.dutyCompanyOverride=/^[1-8]중대$/.test(group)?group[0]:'';if(dutyFixedRolesV391(group).length){const duty=$('dutyFixedRoleV391').value;if(!duty||!dutyFixedRoleValidV391({...patch,duty}))throw Error('근무를 선택하세요.');patch.duty=duty;}}
let dutyMoveBusyV372=false,dutyDragV372=null,dutyPointerV372=null;
async function dutyMoveV372(id,targetId,after){if(dutyMoveBusyV372||dutySavingV367||dutyVerifyBusyV371)return;if($('dutyModeV367').value==='family'){$('dutyCadetsStatusV365').textContent='전대·대대·중대 보기에서 순서를 변경하세요.';return;}const source=dutyCadetsDataV365.find(p=>p.id===id),target=dutyCadetsDataV365.find(p=>p.id===targetId);if(!source||!target||source.id===target.id)return;if(dutyOrgKeyV372(source)!==dutyOrgKeyV372(target)){$('dutyCadetsStatusV365').textContent='같은 소속 안에서 이동하세요. 소속 변경은 수정에서 선택하세요.';return;}dutyMoveBusyV372=true;try{const result=await enqueue(()=>server('moveDutyCadetV372',id,targetId,after,dutyOrderSignatureV372(dutyCadetsDataV365,dutyOrgKeyV372(source))));dutyCadetsDataV365=result.records;dutyCadetsRenderV365();toast('순서 저장 완료');}catch(e){$('dutyCadetsStatusV365').textContent='이동 실패: '+e.message;}finally{dutyMoveBusyV372=false;}}
const dutyRowsV372=$('dutyCadetsRowsV365');
dutyRowsV372.addEventListener('dragstart',e=>{const grip=e.target.closest('[data-duty-grip]');if(!grip||dutyMoveBusyV372){e.preventDefault();return;}dutyDragV372=grip.dataset.dutyGrip;e.dataTransfer.setData('text/plain',dutyDragV372);e.dataTransfer.effectAllowed='move';});
dutyRowsV372.addEventListener('dragover',e=>{if(dutyDragV372&&e.target.closest('[data-duty-row]')){e.preventDefault();e.dataTransfer.dropEffect='move';}});
dutyRowsV372.addEventListener('drop',e=>{const row=e.target.closest('[data-duty-row]'),id=dutyDragV372;dutyDragV372=null;if(!row||!id)return;e.preventDefault();dutyMoveV372(id,row.dataset.dutyRow,e.clientY>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2);});dutyRowsV372.addEventListener('dragend',()=>{dutyDragV372=null;});
dutyRowsV372.addEventListener('pointerdown',e=>{const grip=e.target.closest('[data-duty-grip]');if(!grip||e.pointerType==='mouse'||dutyMoveBusyV372)return;dutyPointerV372={id:grip.dataset.dutyGrip,pointerId:e.pointerId,y:e.clientY,moved:false};grip.setPointerCapture(e.pointerId);});
dutyRowsV372.addEventListener('pointermove',e=>{if(!dutyPointerV372||dutyPointerV372.pointerId!==e.pointerId)return;if(Math.abs(e.clientY-dutyPointerV372.y)>5)dutyPointerV372.moved=true;if(dutyPointerV372.moved){e.preventDefault();if(e.clientY<70)window.scrollBy(0,-12);else if(e.clientY>innerHeight-70)window.scrollBy(0,12);}});
dutyRowsV372.addEventListener('pointerup',e=>{const p=dutyPointerV372;dutyPointerV372=null;if(!p||!p.moved||p.pointerId!==e.pointerId)return;const row=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-duty-row]');if(row)dutyMoveV372(p.id,row.dataset.dutyRow,e.clientY>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2);});dutyRowsV372.addEventListener('pointercancel',()=>{dutyPointerV372=null;});
dutyRowsV372.addEventListener('keydown',e=>{const grip=e.target.closest('[data-duty-grip]');if(!grip||!e.altKey||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const rows=[...dutyRowsV372.querySelectorAll('[data-duty-row]')],index=rows.indexOf(grip.closest('[data-duty-row]')),target=rows[index+(e.key==='ArrowUp'?-1:1)];if(target)dutyMoveV372(grip.dataset.dutyGrip,target.dataset.dutyRow,e.key==='ArrowDown');});
dutyRowsV372.addEventListener('click',e=>{const b=e.target.closest('[data-duty-delete]');if(!b||dutyMoveBusyV372)return;const p=dutyCadetsDataV365.find(r=>r.id===b.dataset.dutyDelete);if(p){dutyOpenV369(p);dutyDeleteV369.click();}});
const dutyOrderHelpV372=document.createElement('p');dutyOrderHelpV372.className='panel-sub';dutyOrderHelpV372.textContent='근무 1개당 1행 · 같은 인원은 근무 추가 · ↕ 드래그로 소속 내 순서 변경';dutyControlsV367.after(dutyOrderHelpV372);


const dutyItemsV368=[{"id":"badge","view":"dutyItems","label":"흉장"},{"id":"block","view":"dutyItems","label":"블럭"},{"id":"door","view":"dutyItems","label":"방문 앞 명패"},{"id":"triangle","view":"dutyItems","label":"삼각명패"}];
function dutyItemRequirementsV368(row){
 const info=dutyRoleInfoV367(row),text=String(row.duty||'').normalize('NFKC').replace(/\s/g,''),society=['동기회','명예위','생발위'].includes(info.organization),aide=/보좌/.test(text),leader=/전대장|대대장|중대장|편대장/.test(text),staff=/참모/.test(text);
 const known=society||aide||leader||staff;
 return {badge:society?2:aide?0:leader||staff?2:0,block:society?0:aide||leader||staff?2:0,door:1,triangle:1,review:!known};
}
let dutyItemsDataV368=null,dutyItemsBusyV368=false,dutyItemsViewV368='dutyItems';const dutyItemDraftV368=new Map(),dutyItemSelectedV368=new Set();
function dutyItemsPanelV368(){return document.querySelector('[data-duty-items="'+dutyItemsViewV368+'"]');}
function dutyItemsKindsV368(){return dutyItemsV368.filter(i=>i.view===dutyItemsViewV368);}
function dutyItemsVisibleV368(){const panel=dutyItemsPanelV368(),company=panel.querySelector('[data-item-company]').value,query=panel.querySelector('[data-item-search]').value.trim().toLowerCase(),filter=panel.querySelector('[data-item-filter]').value,kinds=dutyItemsKindsV368();return dutyOrderRowsV372(dutyItemsDataV368?.rows||[]).filter(p=>{const req=dutyItemRequirementsV368(p),info=dutyRoleInfoV367(p);return (!company||String(info.company)===company)&&(!query||[p.name,p.duty,p.cohort,p.company].join(' ').toLowerCase().includes(query))&&(filter==='all'||kinds.some(k=>req[k.id]>0&&(filter!=='missing'||dutyItemQuantityV368(p.id,k.id)==null||dutyItemQuantityV368(p.id,k.id)<req[k.id])));});}
function dutyItemQuantityV368(id,item){const key=id+'|'+item;return dutyItemDraftV368.has(key)?dutyItemDraftV368.get(key).quantity:(dutyItemsDataV368?.items.find(x=>x.personId===id&&x.item===item)?.quantity??null);}
function dutyItemsRenderV368(){const panel=dutyItemsPanelV368(),kinds=dutyItemsKindsV368(),rows=dutyItemsVisibleV368();let text=[];for(const kind of kinds){let expected=0,total=0,unknown=0,short=0;for(const p of rows){const n=dutyItemRequirementsV368(p)[kind.id],qty=dutyItemQuantityV368(p.id,kind.id);expected+=n;total+=qty??0;if(n&&qty==null)unknown++;else short+=Math.max(0,n-(qty??0));}text.push(kind.label+' 기준 '+expected+'개 · 등록 '+total+'개 · 부족 '+short+'개 · 미등록 '+unknown+'명');}
 const container=panel.querySelector('[data-item-rows]'),open=new Set([...container.querySelectorAll('details[open][data-duty-section]')].map(d=>d.dataset.dutySection));
 panel.querySelector('[data-item-summary]').textContent='표시 '+rows.length+'명 · '+text.join(' / ');panel.querySelector('[data-item-all]').checked=!!rows.length&&rows.every(r=>dutyItemSelectedV368.has(r.id));
 container.innerHTML=dutyAccordionV373(rows,rows=>'<div class="eq-scroll"><table class="eq-table"><thead><tr><th>선택</th><th>인원</th><th>근무</th>'+kinds.map(k=>'<th>'+k.label+'<small style="display:block">기준 / 등록 / 부족</small></th>').join('')+'</tr></thead><tbody>'+(rows.map(p=>{const req=dutyItemRequirementsV368(p),info=dutyRoleInfoV367(p);return '<tr><td><input type="checkbox" data-item-select="'+escapeH(p.id)+'" aria-label="'+escapeH(p.name)+' 선택" '+(dutyItemSelectedV368.has(p.id)?'checked':'')+'></td><td><strong>'+escapeH(p.name)+'</strong><small style="display:block">'+escapeH([p.cohort?p.cohort+'기':'',info.company?info.company+'중대':''].filter(Boolean).join(' · '))+'</small></td><td>'+escapeH(info.title)+(req.review?'<small style="display:block">흉장·블럭 기준 확인</small>':'')+'</td>'+kinds.map(k=>{const n=req[k.id];if(n===0)return '<td aria-label="'+escapeH(k.label+' 대상 아님')+'"></td>';const qty=dutyItemQuantityV368(p.id,k.id),short=qty==null?'미등록':Math.max(0,n-qty)+'개';return '<td><div style="display:flex;gap:8px;align-items:center;white-space:nowrap"><span>'+n+'개</span><input type="number" class="field" min="0" max="1000" step="1" style="width:76px" data-item-person="'+escapeH(p.id)+'" data-item-quantity="'+k.id+'" aria-label="'+escapeH(p.name+' '+k.label+' 등록 수량')+'" placeholder="미등록" value="'+(qty??'')+'"><span>'+short+'</span></div></td>';}).join('')+'</tr>';}).join(''))+'</tbody></table></div>',open);
 panel.querySelector('[data-item-save]').disabled=dutyItemsBusyV368||!dutyItemDraftV368.size;
}
async function dutyItemsLoadV368(v){if(dutyItemsBusyV368)return;if(dutyItemDraftV368.size&&!confirm('저장하지 않은 수량 변경을 지우고 불러올까요?'))return;dutyItemsViewV368=v;dutyItemDraftV368.clear();dutyItemSelectedV368.clear();const panel=dutyItemsPanelV368();dutyItemsBusyV368=true;panel.querySelector('[data-item-status]').textContent='근무명단 연결 중…';panel.querySelectorAll('button').forEach(b=>b.disabled=true);try{try{dutyItemsDataV368=await server('getDutyItemsV368');}catch(error){if(!String(error.message).includes('먼저 불러'))throw error;await dutyCadetsLoadV365();dutyItemsDataV368=await server('getDutyItemsV368');}panel.querySelector('[data-item-kind]').innerHTML=dutyItemsKindsV368().map(k=>'<option value="'+k.id+'">'+k.label+'</option>').join('');panel.querySelector('[data-item-status]').textContent='수량 입력 → 변경 저장 · 일괄 적용은 선택 인원 기준';}catch(e){dutyItemsDataV368=null;panel.querySelector('[data-item-status]').textContent='조회 실패: '+e.message;}finally{dutyItemsBusyV368=false;panel.querySelectorAll('button').forEach(b=>b.disabled=false);dutyItemsRenderV368();}}
function dutyItemSetDraftV368(id,item,quantity){const key=id+'|'+item,original=dutyItemsDataV368?.items.find(r=>r.personId===id&&r.item===item)?.quantity??null;if(quantity===original)dutyItemDraftV368.delete(key);else dutyItemDraftV368.set(key,{personId:id,item,quantity});}
document.querySelectorAll('[data-duty-items]').forEach(panel=>{
 for(const attr of ['company','filter'])panel.querySelector('[data-item-'+attr+']').addEventListener('change',dutyItemsRenderV368);panel.querySelector('[data-item-search]').addEventListener('input',dutyItemsRenderV368);
 panel.querySelector('[data-item-reload]').onclick=()=>dutyItemsLoadV368(panel.dataset.dutyItems);
 panel.addEventListener('change',e=>{if(e.target.matches('[data-item-all]')){for(const p of dutyItemsVisibleV368())e.target.checked?dutyItemSelectedV368.add(p.id):dutyItemSelectedV368.delete(p.id);dutyItemsRenderV368();}else if(e.target.matches('[data-item-select]')){e.target.checked?dutyItemSelectedV368.add(e.target.dataset.itemSelect):dutyItemSelectedV368.delete(e.target.dataset.itemSelect);}else if(e.target.matches('[data-item-quantity]')){const input=e.target,n=Number(input.value);if(input.value===''||!Number.isInteger(n)||n<0||n>1000){input.setCustomValidity('0~1000 사이 정수를 입력하세요.');input.reportValidity();return;}input.setCustomValidity('');dutyItemSetDraftV368(input.dataset.itemPerson,input.dataset.itemQuantity,n);dutyItemsRenderV368();}});
 function bulk(standard){if(dutyItemsBusyV368)return;const rows=dutyItemsVisibleV368().filter(p=>dutyItemSelectedV368.has(p.id)),item=panel.querySelector('[data-item-kind]').value,input=panel.querySelector('[data-item-bulk-qty]'),qty=Number(input.value);if(!rows.length){panel.querySelector('[data-item-status]').textContent='인원을 선택하세요.';return;}if(!standard&&(input.value===''||!Number.isInteger(qty)||qty<0||qty>1000)){input.reportValidity();return;}const targets=rows.filter(p=>dutyItemRequirementsV368(p)[item]>0);for(const p of targets)dutyItemSetDraftV368(p.id,item,standard?dutyItemRequirementsV368(p)[item]:qty);panel.querySelector('[data-item-status]').textContent=targets.length?targets.length+'명 적용 · 변경 저장을 누르세요.':'선택 인원 중 해당 품목 대상자가 없습니다.';dutyItemsRenderV368();}
 panel.querySelector('[data-item-bulk]').onclick=()=>bulk(false);panel.querySelector('[data-item-standard]').onclick=()=>bulk(true);
 panel.querySelector('[data-item-save]').onclick=async()=>{if(dutyItemsBusyV368||!dutyItemDraftV368.size||!dutyItemsDataV368)return;const invalid=[...panel.querySelectorAll('[data-item-quantity]')].find(el=>!el.checkValidity());if(invalid){invalid.reportValidity();return;}const changes=[...dutyItemDraftV368.values()];dutyItemsBusyV368=true;panel.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);try{const result=await enqueue(()=>server('saveDutyItemsV368',dutyItemsDataV368.version,dutyItemsDataV368.revision,changes));for(const c of changes){const old=dutyItemsDataV368.items.find(x=>x.personId===c.personId&&x.item===c.item);if(old)Object.assign(old,c);else dutyItemsDataV368.items.push(c);}dutyItemsDataV368.revision=result.revision;dutyItemDraftV368.clear();panel.querySelector('[data-item-status]').textContent=changes.length+'건 저장 완료';}catch(e){panel.querySelector('[data-item-status]').textContent='저장 실패: '+e.message;}finally{dutyItemsBusyV368=false;panel.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);dutyItemsRenderV368();}};
});
window.addEventListener('beforeunload',e=>{if(dutyItemDraftV368.size){e.preventDefault();e.returnValue='';}});

const dutyItemLinksV368=document.createElement('div');dutyItemLinksV368.className='asset-actions';for(const [id,title] of [['dutyItems','흉장·블럭·명패']]){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=title;b.onclick=()=>switchView(id);dutyItemLinksV368.appendChild(b);}$('saberView').prepend(dutyItemLinksV368);


let devBusyV381=false,devRowsV381=[],devManageV381=false,devKeyV381='';
function devDirtyV381(){return !!($('devTitleV381').value||$('devBodyV381').value||document.querySelector('[data-dev-dirty]'));}
function devBusySetV381(value){devBusyV381=value;document.querySelectorAll('#developmentRequestsView button,#developmentRequestsView input,#developmentRequestsView textarea,#developmentRequestsView select').forEach(el=>el.disabled=value);}
function devRenderV381(){const rows=devRowsV381.filter(r=>$('devFilterV381').value==='전체'||r.status===$('devFilterV381').value);$('devCountV381').textContent=rows.length+'건';$('devListV381').innerHTML=rows.map(r=>'<article class="dev-card" data-dev-id="'+escapeH(r.id)+'"><div class="panel-head"><h3>'+escapeH(r.title)+'</h3><strong>'+escapeH(r.status)+'</strong></div><p class="dev-meta">'+escapeH(r.type+' · '+r.createdAt+' · '+r.author)+'</p><p>'+escapeH(r.body)+'</p>'+(devManageV381?'<div class="dev-review"><label>처리 상태<select class="field" data-dev-status>'+['접수','진행 중','완료','보류'].map(s=>'<option '+(s===r.status?'selected':'')+'>'+s+'</option>').join('')+'</select></label><label>적용 버전<input class="field" maxlength="50" data-dev-version value="'+escapeH(r.version)+'"></label><label>처리 결과<textarea class="field" maxlength="5000" rows="3" data-dev-result>'+escapeH(r.result)+'</textarea></label><button class="btn btn-primary" type="button" data-dev-save>처리 저장</button></div>':(r.result?'<p><strong>처리 결과</strong><br>'+escapeH(r.result)+'</p>':'')+(r.version?'<p>적용 버전 '+escapeH(r.version)+'</p>':''))+(r.by?'<p class="dev-meta">'+escapeH(r.updatedAt+' · '+r.by)+'</p>':'')+'</article>').join('')||'<p class="help">등록된 요청이 없습니다.</p>';}
async function devReadV381(){const data=await server('getDevelopmentRequestsV381');devRowsV381=data.requests;devManageV381=data.canManage;devRenderV381();}
async function devLoadV381(){if(devBusyV381||document.querySelector('[data-dev-dirty]'))return;devBusySetV381(true);$('devMessageV381').textContent='불러오는 중…';try{await devReadV381();$('devMessageV381').textContent='';}catch(e){$('devMessageV381').textContent='조회 실패: '+e.message;}finally{devBusySetV381(false);}}
$('devRefreshV381').addEventListener('click',()=>{if(document.querySelector('[data-dev-dirty]')&&!confirm('저장하지 않은 처리 내용을 버릴까요?'))return;document.querySelectorAll('[data-dev-dirty]').forEach(el=>el.removeAttribute('data-dev-dirty'));devLoadV381();});
$('devFilterV381').addEventListener('change',e=>{if(document.querySelector('[data-dev-dirty]')&&!confirm('저장하지 않은 처리 내용을 버릴까요?')){e.target.value=e.target.dataset.previous||'전체';return;}e.target.dataset.previous=e.target.value;devRenderV381();});
$('devFormV381').addEventListener('submit',async e=>{e.preventDefault();if(devBusyV381||!e.target.reportValidity())return;if(document.querySelector('[data-dev-dirty]')){$('devMessageV381').textContent='처리 내용을 먼저 저장하세요.';return;}devKeyV381=devKeyV381||crypto.randomUUID();const input={title:$('devTitleV381').value,type:$('devTypeV381').value,body:$('devBodyV381').value,key:devKeyV381};devBusySetV381(true);try{await server('createDevelopmentRequestV381',input);$('devFormV381').reset();devKeyV381='';await devReadV381();$('devMessageV381').textContent='요청 등록 완료';}catch(err){$('devMessageV381').textContent='등록 실패: '+err.message;}finally{devBusySetV381(false);}});
$('devListV381').addEventListener('input',e=>{e.target.closest('[data-dev-id]')?.setAttribute('data-dev-dirty','true');});
$('devFormV381').addEventListener('input',()=>{devKeyV381='';});
$('devListV381').addEventListener('change',e=>{e.target.closest('[data-dev-id]')?.setAttribute('data-dev-dirty','true');});
$('devListV381').addEventListener('click',async e=>{const button=e.target.closest('[data-dev-save]');if(!button||devBusyV381)return;const card=button.closest('[data-dev-id]'),row=devRowsV381.find(r=>r.id===card.dataset.devId),input={id:row.id,expectedUpdatedAt:row.updatedAt,status:card.querySelector('[data-dev-status]').value,version:card.querySelector('[data-dev-version]').value,result:card.querySelector('[data-dev-result]').value};if(input.status==='완료'&&!input.result.trim()){$('devMessageV381').textContent='처리 결과를 입력하세요.';return;}if([...document.querySelectorAll('[data-dev-dirty]')].some(el=>el!==card)){$('devMessageV381').textContent='다른 요청의 처리 내용을 먼저 저장하거나 새로고침하세요.';return;}devBusySetV381(true);try{await server('updateDevelopmentRequestV381',input);card.removeAttribute('data-dev-dirty');await devReadV381();$('devMessageV381').textContent='처리 저장 완료';}catch(err){$('devMessageV381').textContent='저장 실패: '+err.message;}finally{devBusySetV381(false);}});


let assetInspectionBusyV382=false,assetInspectionKeyV382='';
const assetInspectionStorageV388='assetInspectionPendingRequestV388';
function assetInspectionRequestKeyV388(){
 const valid=key=>typeof key==='string'&&/^\w[\w-]{15,79}$/.test(key);let key=assetInspectionKeyV382;
 if(!valid(key))try{key=sessionStorage.getItem(assetInspectionStorageV388);}catch(_){}
 if(!valid(key))try{key=globalThis.crypto?.randomUUID?.();}catch(_){}
 if(!valid(key))key='inspection-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*Number.MAX_SAFE_INTEGER).toString(36).padStart(11,'0')+'-'+Math.floor(Math.random()*Number.MAX_SAFE_INTEGER).toString(36).padStart(11,'0');
 assetInspectionKeyV382=key;try{sessionStorage.setItem(assetInspectionStorageV388,key);}catch(_){}return key;
}
function assetInspectionStatusV382(result){const host=$('assetInspectionStatusV382');host.replaceChildren();const link=document.createElement('a');link.href=result.url;link.target='_blank';link.rel='noopener';link.className='btn btn-primary';link.textContent='새 점검표 열기 ↗';host.append(link,document.createTextNode(' · 점검 '+result.stats.checked+'호실 · 불량 '+result.stats.bad+'개 · 미점검 '+result.stats.unknown+'개'));}
function assetInspectionCloseTabV389(tab){try{if(tab&&!tab.closed)tab.close();}catch(_){}}
function assetInspectionPrepareTabV389(){
 let tab;try{tab=window.open('about:blank','_blank');}catch(_){}if(!tab)return null;
 try{tab.opener=null;}catch(_){assetInspectionCloseTabV389(tab);return null;}
 try{tab.document.title='점검표 생성 중…';tab.document.body.textContent='점검표 생성 중… 완료되면 자동으로 열립니다.';}catch(_){}return tab;
}
function assetInspectionOpenTabV389(tab,url){try{if(tab&&!tab.closed){tab.location.replace(url);return true;}}catch(_){}assetInspectionCloseTabV389(tab);return false;}
$('assetInspectionCreateV382').addEventListener('click',async()=>{
 if(assetInspectionBusyV382||assetSavingV244)return;if(!canEdit||v284Scoped){toast('관리자만 새 점검표를 만들 수 있습니다.');return;}
 if(assetDirtyV244.size){toast('작성 중인 비품 내용을 먼저 저장하세요.');return;}
 assetInspectionBusyV382=true;let tab=null;
 try{$('assetInspectionCreateV382').disabled=true;$('assetInspectionStatusV382').textContent='전체 생활실 기록으로 별도 스프레드시트를 만드는 중…';tab=assetInspectionPrepareTabV389();const result=await server('createAssetInspectionV382',assetInspectionRequestKeyV388());if(typeof result?.url!=='string'||!/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]+(?:[/?#]|$)/.test(result.url))throw Error('생성된 점검표 주소를 확인하지 못했습니다.');assetInspectionStatusV382(result);assetInspectionKeyV382='';try{sessionStorage.removeItem(assetInspectionStorageV388);}catch(_){}if(!assetInspectionOpenTabV389(tab,result.url))try{toast('새 점검표 열기 버튼을 눌러주세요.');}catch(_){}}
 catch(e){assetInspectionCloseTabV389(tab);$('assetInspectionStatusV382').textContent='생성 실패: '+String(e?.message||e||'알 수 없는 오류')+' · 재시도하면 같은 생성 요청을 이어서 처리합니다.';}
 finally{assetInspectionBusyV382=false;$('assetInspectionCreateV382').disabled=false;}
});


window.logbookReloadState=()=>({busy:!!(dutyRequestBusyV400||assetInspectionBusyV382||devBusyV381||dutyMoveBusyV372||dutyVerifyBusyV371||dutyItemsBusyV368||dutySavingV367||dutyCadetsBusyV365||personalInterfaceBusyV359||modalSaving||eqSaving||rosterSaving||rosterQuickSaving.size||navSavingV220||wxCalSaving||wxBulkSavingV229||wxRowSaving||syncPending||assetSavingV244||departuresBusyV305||dormPlacementBusyV344||dormPendingV237.size||dormBulkBusyV237||laborPairSavingV264||uniformStateV278.saving),dirty:!!(devDirtyV381()||isFormDirty()||modalSaving||eqDirty()||eqSaving||rosterIsDirty()||rosterHasQuickChanges()||rosterSaving||rosterQuickSaving.size||supplyDirty()||navDirtyV220||navSavingV220||wxCalDirty()||wxBulkDirtyV229()||wxCustomDirty()||wxCalSaving||wxBulkSavingV229||wxRowSaving||pendingNote||syncPending||assetDirtyV244.size||assetSavingV244||dutyItemDraftV368.size||dutyDialogV367.open||settingsDirtyV258||personalInterfaceDirtyV359||dormPlanDraftV315||$('dormPlanRoomDialogV315')?.open||$('dormAddDialogV344')?.open||document.querySelector('[data-request-edited]'))});

window.LOGBOOK_OPEN_UPDATES=()=>navEditModeV220?null:switchView('updates');

function dutyPersonKeyV398(person){
 const norm=value=>String(value??'').normalize('NFKC').replace(/\s/g,'');
 return [norm(person.cohort).replace(/(?:기)+$/,''),norm(person.company).replace(/(?:중대)+$/,''),norm(person.name)].join('|');
}
function dutyPersonCandidatesV398(plan){
 if(!plan||plan.comparison?.error||!plan.comparison||!Array.isArray(plan.comparison.missingRoom)||!Array.isArray(plan.comparison.missingSmart))throw Error(plan?.comparison?.error||'스마트당직 대조 결과를 확인할 수 없습니다.');
 const missing=new Set(plan.comparison.missingSmart.map(dutyPersonKeyV398)),seen=new Set(),rows=[];
 const push=(person,room)=>{
  const cohort=String(person.cohort??'').normalize('NFKC').replace(/\s|기/g,''),company=String(person.company??'').normalize('NFKC').replace(/\s|중대/g,''),name=String(person.name??'').normalize('NFKC').trim();
  if(!/^\d{2,3}$/.test(cohort)||! /^[1-8]$/.test(company)||!name)return;
  const row={name,cohort,company,building:String(room?.building||''),floor:String(room?.floor||''),room:String(room?.room||''),gradeOverride:/^[1-4]$/.test(String(person.gradeOverride||person.grade||''))?String(person.gradeOverride||person.grade):String(({'75':4,'76':3,'77':2,'78':1})[cohort]||''),battalionOverride:Number(company)<=4?'1':'2',assigned:!!room};
  if(missing.has(dutyPersonKeyV398(row)))return;
  const key=JSON.stringify([dutyPersonKeyV398(row),row.building,row.floor,row.room]);if(seen.has(key))return;seen.add(key);rows.push({...row,key});
 };
 for(const room of plan.rooms||[])for(const person of room.members||[])push(person,room);
 for(const person of plan.comparison.missingRoom)push(person,null);
 return rows.sort((a,b)=>a.cohort.localeCompare(b.cohort,undefined,{numeric:true})||Number(a.company)-Number(b.company)||a.name.localeCompare(b.name,'ko')||a.room.localeCompare(b.room,undefined,{numeric:true}));
}
function dutyPersonSearchV398(value,people){
 const name=String(value||'').normalize('NFKC').replace(/\s/g,'');if(!name)return {rows:[],exact:false};
 const norm=value=>String(value||'').normalize('NFKC').replace(/\s/g,''),base=value=>value.replace(/([가-힣])[A-D]$/,'$1');
 const exact=people.filter(person=>norm(person.name)===name);if(exact.length)return {rows:exact,exact:true};
 const aliases=people.filter(person=>base(norm(person.name))===base(name)&&(name===base(name)||norm(person.name)===base(norm(person.name))));if(aliases.length)return {rows:aliases,exact:true};
 return {rows:people.filter(person=>norm(person.name).includes(name)),exact:false};
}
const dutyPersonFormV398=$('dutyFormV367'),dutyPersonFieldsV398=['cohort','company','building','floor','room','gradeOverride','battalionOverride'];
const dutyPersonPanelV398=document.createElement('section');dutyPersonPanelV398.className='duty-person-lookup';dutyPersonPanelV398.setAttribute('aria-label','스마트당직·방 배정 이름 조회');
dutyPersonPanelV398.innerHTML='<p class="help">이름을 입력하면 스마트당직과 방 배정을 대조해 인적사항을 채웁니다. 동명이인은 한 명을 선택하세요.</p><p id="dutyPersonStatusV398" role="status" aria-live="polite"></p><div id="dutyPersonChoicesV398"></div><button class="btn" id="dutyPersonRetryV398" type="button">명단 다시 조회</button>';
dutyPersonFormV398.elements.name.closest('label').after(dutyPersonPanelV398);
const dutyPersonRoleV398=document.createElement('p');dutyPersonRoleV398.className='help';dutyPersonFormV398.querySelector('h2').after(dutyPersonRoleV398);
let dutyPersonRowsV398=[],dutyPersonMatchesV398=[],dutyPersonSelectedV398=null,dutyPersonInitialV398=null,dutyPersonGenerationV398=0,dutyPersonLoadingV398=false,dutyPersonLoadedV398=false,dutyPersonChangedV398=false,dutyPersonTimerV398=null;
function dutyPersonLockedV398(){return !!dutyEditRowV367&&dutyOrgKeyV372(dutyEditRowV367)!=='기타';}
function dutyPersonEditabilityV398(automatic){for(const key of dutyPersonFieldsV398){const field=dutyPersonFormV398.elements[key];if(field.tagName==='SELECT')field.disabled=automatic;else field.readOnly=automatic;}}
function dutyPersonApplyV398(person){
 dutyPersonSelectedV398=person;dutyPersonFormV398.elements.name.value=person.name;
 for(const key of dutyPersonFieldsV398)dutyPersonFormV398.elements[key].value=person[key]||'';
 dutyPersonEditabilityV398(true);
 $('dutyPersonStatusV398').textContent=person.cohort+'기 '+person.company+'중대 '+person.name+' · '+(person.assigned?[person.building,person.floor,person.room+'호'].filter(Boolean).join(' '):'방 미배정')+(person.gradeOverride?' · '+person.gradeOverride+'학년':' · 학년 확인 필요')+' · '+person.battalionOverride+'대대';
 // A future cohort may not have a grade rule yet; keep that field available for confirmation.
 if(!person.gradeOverride)dutyPersonFormV398.elements.gradeOverride.disabled=false;
}
function dutyPersonChoicesV398(){
 $('dutyPersonChoicesV398').innerHTML=dutyPersonMatchesV398.map((person,index)=>'<label class="duty-person-choice"><input type="checkbox" data-duty-person="'+index+'" '+(person.key===dutyPersonSelectedV398?.key?'checked':'')+'><span><strong>'+escapeH(person.cohort+'기 '+person.company+'중대 '+person.name)+'</strong><small>'+escapeH(person.assigned?[person.building,person.floor,person.room+'호'].filter(Boolean).join(' '):'방 미배정')+'</small></span></label>').join('');
}
function dutyPersonSearchFormV398(){
 if(!dutyDialogV367.open||dutySavingV367)return;
 const name=dutyPersonFormV398.elements.name.value.trim();if(!name){dutyPersonSelectedV398=null;dutyPersonMatchesV398=[];dutyPersonChoicesV398();$('dutyPersonStatusV398').textContent='이름을 입력하세요.';return;}
 if(!dutyPersonLoadedV398){$('dutyPersonStatusV398').textContent=dutyPersonLoadingV398?'스마트당직·방 배정 조회 중…':'명단 다시 조회를 눌러 주세요.';return;}
 const found=dutyPersonSearchV398(name,dutyPersonRowsV398);dutyPersonMatchesV398=found.rows;dutyPersonSelectedV398=null;
 if(found.exact&&found.rows.length===1)dutyPersonApplyV398(found.rows[0]);
 else if(!dutyPersonChangedV398&&dutyPersonInitialV398){const same=found.rows.filter(person=>dutyPersonKeyV398(person)===dutyPersonKeyV398(dutyPersonInitialV398));if(same.length===1)dutyPersonApplyV398(same[0]);}
 if(!dutyPersonSelectedV398){dutyPersonEditabilityV398(!dutyPersonInitialV398||dutyPersonChangedV398);$('dutyPersonStatusV398').textContent=found.rows.length?(found.exact?'동명이인 '+found.rows.length+'명 · 기수·중대·이름을 확인해 한 명을 선택하세요.':'검색 결과 '+found.rows.length+'명 · 이름을 완성하거나 한 명을 선택하세요.'):'스마트당직·방 배정 대조 명단에 없는 이름입니다. 이름과 원본 명단을 확인하세요.';}
 dutyPersonChoicesV398();
}
async function dutyPersonLoadV398(){
 const generation=++dutyPersonGenerationV398;dutyPersonLoadingV398=true;dutyPersonLoadedV398=false;$('dutyPersonStatusV398').textContent='스마트당직·방 배정 조회 중…';$('dutyPersonRetryV398').disabled=true;
 try{const plan=await server('getDormPlanV315',false);if(generation!==dutyPersonGenerationV398||!dutyDialogV367.open)return;dutyPersonRowsV398=dutyPersonCandidatesV398(plan);dutyPersonLoadedV398=true;dutyPersonSearchFormV398();}
 catch(error){if(generation===dutyPersonGenerationV398&&dutyDialogV367.open)$('dutyPersonStatusV398').textContent='자동 입력 조회 실패: '+error.message+' · 명단 다시 조회를 눌러 주세요.';}
 finally{if(generation===dutyPersonGenerationV398){dutyPersonLoadingV398=false;$('dutyPersonRetryV398').disabled=false;}}
}
globalThis.LOGBOOK_DUTY_EDITOR={
 locked:dutyPersonLockedV398,
 open(initial){
  clearTimeout(dutyPersonTimerV398);dutyPersonGenerationV398++;dutyPersonInitialV398=initial?{...initial}:null;dutyPersonChangedV398=false;dutyPersonSelectedV398=null;dutyPersonRowsV398=[];dutyPersonMatchesV398=[];dutyPersonLoadedV398=false;dutyPersonChoicesV398();dutyPersonEditabilityV398(false);
  const locked=dutyPersonLockedV398(),input=dutyPersonFormV398.elements.duty;
  for(const control of [input,$('dutyFixedRoleV391'),$('dutyAssignmentV372'),dutyPersonFormV398.elements.familyOverride]){control.disabled=locked;if(locked){control.required=false;control.closest('label').hidden=true;control.closest('label').style.display='none';}}
  if(!locked){dutyAssignmentLabelV372.hidden=false;dutyAssignmentLabelV372.style.display='block';dutyFamilyLabelV372.hidden=false;dutyFamilyLabelV372.style.display='block';dutySyncFixedRoleV391();}
  dutyPersonRoleV398.hidden=!locked;dutyPersonRoleV398.textContent=locked?'근무: '+dutyOrgLabelV372(dutyOrgKeyV372(dutyEditRowV367))+' · '+dutyEditRowV367.duty:'';
  dutyPersonLoadV398();
 },
 beforeSubmit(){
  if(dutyPersonLoadingV398){$('dutyEditStatusV367').textContent='명단 조회를 마친 뒤 저장하세요.';return false;}
  const unchanged=!!dutyPersonInitialV398&&!dutyPersonChangedV398&&dutyPersonKeyV398({name:dutyPersonFormV398.elements.name.value,cohort:dutyPersonFormV398.elements.cohort.value,company:dutyPersonFormV398.elements.company.value})===dutyPersonKeyV398(dutyPersonInitialV398);
  if(!dutyPersonSelectedV398&&!unchanged){$('dutyEditStatusV367').textContent=dutyPersonMatchesV398.length?'조회된 인원 중 한 명을 체크하세요.':'이름 조회로 인원을 확인한 뒤 저장하세요.';return false;}
  if(dutyPersonSelectedV398&&dutyPersonSearchV398(dutyPersonFormV398.elements.name.value,[dutyPersonSelectedV398]).rows.length!==1){$('dutyEditStatusV367').textContent='변경한 이름을 다시 조회하세요.';return false;}
  return true;
 },
 patch(patch){
  if(dutyPersonLockedV398())for(const key of ['duty','organization','dutyCompanyOverride','familyOverride'])patch[key]=dutyEditRowV367[key]||'';
  if(dutyPersonSelectedV398)for(const key of ['name',...dutyPersonFieldsV398])patch[key]=key==='name'?dutyPersonSelectedV398.name:dutyPersonFormV398.elements[key].value;
 }
};
dutyPersonFormV398.elements.name.addEventListener('input',()=>{
 dutyPersonChangedV398=true;dutyPersonSelectedV398=null;dutyPersonMatchesV398=[];dutyPersonChoicesV398();dutyPersonEditabilityV398(true);for(const key of dutyPersonFieldsV398)dutyPersonFormV398.elements[key].value='';clearTimeout(dutyPersonTimerV398);dutyPersonTimerV398=setTimeout(dutyPersonSearchFormV398,250);
});
$('dutyPersonChoicesV398').addEventListener('change',event=>{const index=event.target.dataset.dutyPerson;if(index==null||dutySavingV367)return;const person=dutyPersonMatchesV398[Number(index)];if(!person)return;if(event.target.checked)dutyPersonApplyV398(person);else{dutyPersonSelectedV398=null;for(const key of dutyPersonFieldsV398)dutyPersonFormV398.elements[key].value='';$('dutyPersonStatusV398').textContent='인원을 한 명 선택하세요.';}dutyPersonChoicesV398();});
$('dutyPersonRetryV398').onclick=()=>{if(!dutySavingV367){dutyPersonSelectedV398=null;dutyPersonMatchesV398=[];dutyPersonChoicesV398();dutyPersonLoadV398();}};
dutyDialogV367.addEventListener('close',()=>{dutyPersonGenerationV398++;clearTimeout(dutyPersonTimerV398);});


let dutyRequestsV400=[],dutyRequestBusyV400=false;
const dutyRequestDisplayV400=value=>value===null?'배정 확인 필요':Object.hasOwn(value,'quantity')?(value.quantity===null?'미등록':value.quantity+'개'):[value.status||'미등록',value.detail].filter(Boolean).join(' · ');
function dutyRequestsRenderV400(){const rows=dutyRequestsV400.filter(row=>$('dutyRequestsFilterV400').value==='전체'||row.status==='대기');$('dutyRequestsListV400').innerHTML=rows.map(row=>'<article class="asset-request-card" data-duty-request="'+escapeH(row.id)+'"><h3>'+escapeH([row.requester.cohort+'기',row.requester.company+'중대',row.requester.name].join(' · '))+'</h3><p>'+escapeH(row.createdAt+' · '+row.status)+'</p><div class="asset-request-scroll"><table class="asset-request-table"><thead><tr><th>근무 · 품목</th><th>현재</th><th>요청</th><th>반영 내용</th></tr></thead><tbody>'+row.changes.map((change,index)=>'<tr><th>'+escapeH(change.label)+'</th><td>'+escapeH(dutyRequestDisplayV400(change.current))+'</td><td>'+escapeH(dutyRequestDisplayV400(change.value))+'</td><td>'+(change.kind==='quantity'?'<input class="field" type="number" min="0" max="1000" step="1" required data-duty-request-quantity="'+index+'" value="'+change.value.quantity+'" '+(row.status==='대기'?'':'disabled')+'>':'<select class="field" data-duty-request-status="'+index+'" '+(row.status==='대기'?'':'disabled')+'>'+['','정상','수리 필요(보고)','수리 필요(미보고)','교체 필요'].map(status=>'<option value="'+escapeH(status)+'" '+(status===change.value.status?'selected':'')+'>'+escapeH(status||'미등록')+'</option>').join('')+'</select><textarea class="field" data-duty-request-detail="'+index+'" maxlength="1500" '+(row.status==='대기'?'':'disabled')+'>'+escapeH(change.value.detail)+'</textarea>')+'</td></tr>').join('')+'</tbody></table></div><input class="field" data-duty-request-note maxlength="500" placeholder="처리 메모" value="'+escapeH(row.note||'')+'"><div class="asset-request-actions">'+(row.status==='대기'?'<button class="btn" data-duty-request-action="confirm">확인 완료</button><button class="btn btn-primary" data-duty-request-action="apply">수정 반영</button>':'')+'<button class="btn" data-duty-request-action="delete">요청 삭제</button></div></article>').join('')||'<p>요청 없음</p>';}
async function dutyRequestsLoadV400(){if(dutyRequestBusyV400)return;dutyRequestBusyV400=true;$('dutyRequestsStatusV400').textContent='조회 중…';try{const result=await server('getDutyRequestsV400');dutyRequestsV400=result.requests;dutyRequestsRenderV400();$('dutyRequestsStatusV400').textContent='대기 '+dutyRequestsV400.filter(row=>row.status==='대기').length+'건';}catch(error){$('dutyRequestsStatusV400').textContent=error.message;}finally{dutyRequestBusyV400=false;}}
$('dutyRequestsRefreshV400').onclick=()=>{if(document.querySelector('[data-request-edited]')&&!confirm('검토 중인 변경을 지울까요?'))return;dutyRequestsLoadV400();};
$('dutyRequestsFilterV400').onchange=()=>{if(document.querySelector('[data-request-edited]')&&!confirm('검토 중인 변경을 지울까요?'))return;dutyRequestsRenderV400();};
$('dutyRequestsListV400').oninput=event=>{const card=event.target.closest('[data-duty-request]');if(card)card.dataset.requestEdited='1';};
$('dutyRequestsListV400').onclick=async event=>{const button=event.target.closest('[data-duty-request-action]');if(!button||dutyRequestBusyV400)return;const card=button.closest('[data-duty-request]'),row=dutyRequestsV400.find(row=>row.id===card.dataset.dutyRequest),action=button.dataset.dutyRequestAction;if(!row)return;if([...card.querySelectorAll('input,textarea,select')].some(field=>!field.checkValidity())){card.querySelector(':invalid')?.reportValidity();return;}if(!confirm(action==='apply'?'검토한 내용을 물품 기록에 반영할까요?':action==='confirm'?'물품 기록은 유지하고 확인 완료로 처리할까요?':'요청을 삭제할까요? 반영된 물품 기록은 유지됩니다.'))return;dutyRequestBusyV400=true;card.inert=true;try{const edits=row.changes.map((change,index)=>({key:change.key,value:change.kind==='quantity'?{quantity:Number(card.querySelector('[data-duty-request-quantity="'+index+'"]').value)}:{status:card.querySelector('[data-duty-request-status="'+index+'"]').value,detail:card.querySelector('[data-duty-request-detail="'+index+'"]').value}}));await enqueue(()=>server('resolveDutyRequestV400',row.id,action,edits,card.querySelector('[data-duty-request-note]').value,row.status));card.removeAttribute('data-request-edited');dutyRequestBusyV400=false;await dutyRequestsLoadV400();toast('근무생도 물품 요청 처리 완료');}catch(error){$('dutyRequestsStatusV400').textContent=error.message;}finally{dutyRequestBusyV400=false;card.inert=false;}};

})();
