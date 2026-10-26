export function calendarShift(day, amount) {
  const date = new Date(day + 'T00:00:00Z'); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10);
}
export function calendarEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
export function calendarSegments(entries, start, count, today) {
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
}
export function calendarHTML(entries, options) {
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
      const description = `${type} · ${entry.title} · ${entry.status} · 시작 ${entry.date}${entry.completedOn ? ' · 완료 ' + entry.completedOn : entry.due ? ' · 마감 ' + entry.due : entry.workType === 'long' ? ' · 종료 미정' : ''}`;
      return `<button type="button" class="calendar-range range-${state}${entry.workType === 'long' ? ' range-long' : ' range-daily'}${continuesBefore ? ' range-before' : ''}${continuesAfter ? ' range-after' : ''}" style="grid-column:${column + 1}/span ${span};grid-row:${lane + 1}" data-calendar-entry="${esc(entry.id)}" title="${esc(description)}" aria-label="${esc(description)}"><span aria-hidden="true">${continuesBefore ? '‹ ' : ''}</span><span class="range-title">${esc(entry.title)}</span><span class="range-status">${entry.status === '완료' ? '✓' : continuesAfter ? '›' : ''}</span></button>`;
    }).join('');
    return `<div class="calendar-range-week" style="--range-lanes:${week.lanes}">${days}<div class="calendar-range-layer">${bars}</div></div>`;
  }).join('');
}

export function updateCalendarJs(js) {
  const miniPattern = /const byDay=new Map\(\),dueByDay=new Map\(\);[\s\S]*?calendar\.innerHTML=cells\.join\(''\);/;
  if (!miniPattern.test(js)) throw Error('일지 월간 캘린더 패치 위치를 확인하세요.');
  js = js.replace(miniPattern, `const gridStart=calendarShift(month+'-01',-offset),count=Math.ceil((offset+days)/7)*7,dayDetails={};
 for(const entry of entries){if(entry.due&&entry.status!=='완료')dayDetails[entry.due]=(dayDetails[entry.due]||'')+'<span class="wx-cal-pill due">마감</span>';}
 calendar.innerHTML=calendarHTML(entries,{start:gridStart,count,today,selected,month,miniMode:mode,details:dayDetails});`);
  js = js.replace("function v298Click(e){", "function v298Click(e){const range=e.target.closest('[data-calendar-entry]');if(range){showModal(range.dataset.calendarEntry);return;}");
  js = js.replace("entries.filter(e=>e.status!=='완료'&&journalVisibleOn(e,today)).map", "entries.filter(e=>e.status!=='완료').map");
  const general = `const gridStart=wxRangeV231==='week'?weekStart:calendarShift(wxCalendarMonth+'-01',-start);
 const count=wxRangeV231==='week'?7:Math.ceil((start+total)/7)*7;
 const dayDetails={};
 for(let i=0;i<count;i++){
  const day=calendarShift(gridStart,i),deadlines=dueDay.get(day)||[],evs=eventsByDay.get(day)||[];
  const academic=evs.filter(e=>e.kind==='학사일정').length,other=evs.length-academic;
  dayDetails[day]=(wxShowV231('Due')?deadlines.slice(0,2).map(v293DuePill).join(''):'')+(wxShowV231('Academic')&&academic?'<span class="wx-cal-pill academic">학사 '+academic+'</span>':'')+(wxShowV231('Other')&&other?'<span class="wx-cal-pill note">특이 '+other+'</span>':'');
 }
 $('wxCalendarGrid').innerHTML=calendarHTML(wxShowV231('Journal')?data.entries:[],{start:gridStart,count,today:localISO(),selected:wxSelectedDay,month:wxCalendarMonth,details:dayDetails});`;
  const pattern = /const cells=\['일','월','화','수','목','금','토'\]\.map[\s\S]*?\$\('wxCalendarGrid'\)\.innerHTML=cells\.join\(''\);/;
  if (!pattern.test(js)) throw Error('일반 캘린더 패치 위치를 확인하세요.');
  js = js.replace(pattern, general);
  const training = `const gridStart=calendarShift(ym+'-01',-first),count=Math.ceil((first+days)/7)*7,dayDetails={};
 for(let i=0;i<count;i++){const day=calendarShift(gridStart,i);dayDetails[day]=(dueByDay.get(day)||[]).slice(0,2).map(v293DuePill).join('');}
 grid.innerHTML=calendarHTML(rows,{start:gridStart,count,today:localISO(),selected:trainCalendarSelectedV292,month:ym,training:true,details:dayDetails});`;
  const trainingPattern = /const html=\['일','월','화','수','목','금','토'\]\.map[\s\S]*?grid\.innerHTML=html\.join\(''\);/;
  if (!trainingPattern.test(js)) throw Error('훈련 캘린더 패치 위치를 확인하세요.');
  js = js.replace(trainingPattern, training);
  js = js.replace("const journalMonth=data.entries.filter(e=>inRange(e.date))", "const journalMonth=data.entries.filter(e=>e.workType==='long'?e.date<=(wxRangeV231==='week'?weekEnd:wxCalendarMonth+'-31')&&(e.status!=='완료'||(e.completedOn||e.date)>=(wxRangeV231==='week'?weekStart:wxCalendarMonth+'-01')):inRange(e.date))");
  js = js.replace("$('wxCalendarGrid').addEventListener('click',e=>{const b=", "$('wxCalendarGrid').addEventListener('click',e=>{const entry=e.target.closest('[data-calendar-entry]');if(entry){showModal(entry.dataset.calendarEntry);return;}const b=");
  // 훈련 캘린더도 동일한 업무 편집기를 엽니다.
  const index = js.lastIndexOf('})();');
  js = js.slice(0, index) + "\n$('trainCalendarGridV292').addEventListener('click',event=>{const entry=event.target.closest('[data-calendar-entry]');if(entry)showModal(entry.dataset.calendarEntry);});\n" + js.slice(index);
  return [calendarShift, calendarEscape, calendarSegments, calendarHTML].map(fn => `const ${fn.name} = ${fn.toString()};`).join('\n') + '\n' + js;
}

export const calendarCSS = `
.v298-grid{grid-template-columns:minmax(0,1fr)}
.v298-priority-panel{order:-1}
.v298-priority-list{grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
.calendar-range-week{grid-column:1/-1;position:relative;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:0}
.calendar-range-week .range-day{border-radius:0;min-height:calc(85px + var(--range-lanes)*30px);padding:8px 6px;border-color:#e3e9f0;background:#fff}
.calendar-range-week .range-day.selected{padding:7px 5px;background:#eff6ff;border:2px solid #4483dc}
.range-day.range-other-month{background:#f7f9fc}.range-other-month strong{opacity:.45}
.range-day-details{display:flex;flex-direction:column;gap:3px;margin-top:calc(var(--range-lanes)*30px + 8px);font-size:10px;min-width:0}
.calendar-range-layer{position:absolute;top:35px;left:0;right:0;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));grid-auto-rows:26px;row-gap:4px;pointer-events:none;z-index:2}
.calendar-range{pointer-events:auto;display:flex;align-items:center;gap:4px;min-width:0;margin:0 3px;padding:4px 8px;border:1px solid transparent;border-radius:6px;text-align:left;font:600 12px/1.3 system-ui,sans-serif;cursor:pointer;box-shadow:0 1px 2px #18324c12}
.calendar-range:hover{filter:brightness(.96);outline:2px solid #5d7fae;outline-offset:-1px}.calendar-range:focus-visible{outline:3px solid #244e91;outline-offset:1px}
.range-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}.range-status{flex:none;font-size:13px}
.range-running{background:#72d2c8;color:#103e3b}.range-pending{background:#a6c9f4;color:#163f70}.range-hold{background:#f2ca7b;color:#694a0b}.range-done{background:#a7d9b9;color:#224c31}
.range-daily{background:#edf3fa;color:#375577;border-color:#dae5f1}.range-daily.range-done{background:#e7f4eb;color:#315a3c}
.range-before{margin-left:0;border-top-left-radius:0;border-bottom-left-radius:0}.range-after{margin-right:0;border-top-right-radius:0;border-bottom-right-radius:0}
.nav-removed-v301{display:none!important}
.nav-catalog{width:min(460px,calc(100vw - 32px));box-sizing:border-box;border:1px solid #d9e3ef;border-radius:16px;padding:24px;color:#223950;box-shadow:0 20px 70px #12243a33}.nav-catalog::backdrop{background:#162b4466}
.nav-catalog label{display:block;margin:14px 0 6px;font-weight:700}.nav-catalog select{width:100%;min-height:44px;padding:8px;border:1px solid #c6d5e5;border-radius:8px}.nav-catalog button{min-height:40px;margin:12px 6px 0 0;padding:8px 14px;border:1px solid #c6d5e5;border-radius:8px;background:#edf4ff;color:#254d81;cursor:pointer}.nav-catalog p{font-size:13px;line-height:1.6;color:#60748c}
@media(max-width:650px){.calendar-range{font-size:11px;padding:4px;margin-inline:1px}.calendar-range-week .range-day{padding-inline:3px}.calendar-range-week .range-day.selected{padding-inline:2px}}
`;
