// 날짜별 화면·인쇄·캘린더가 같은 장기업무 표시 규칙을 사용합니다.
export function journalVisibleOn(entry, day) {
  if (entry.workType !== 'long') return entry.date === day;
  if (day < entry.date) return false;
  return entry.status !== '완료' || day <= (entry.completedOn || entry.date);
}
export function journalDuePassed(entry, day, time) {
  return !!entry.due && (entry.due < day || (entry.due === day && !!entry.dueTime && entry.dueTime < time));
}
export function updateJournalJs(js) {
  js = `const journalVisibleOn = ${journalVisibleOn.toString()};\nconst journalDuePassed = ${journalDuePassed.toString()};\nconst journalOverdue=e=>{const now=new Date(),pad=n=>String(n).padStart(2,'0');return journalDuePassed(e,[now.getFullYear(),pad(now.getMonth()+1),pad(now.getDate())].join('-'),pad(now.getHours())+':'+pad(now.getMinutes()));};\n` + js;
  js = js.replaceAll('e=>e.date===selectedDay', 'e=>journalVisibleOn(e,selectedDay)')
    .replace("date:String(e.date),time:", "date:String(e.date),workType:e.workType==='long'?'long':'daily',completedOn:/^\\d{4}-\\d{2}-\\d{2}$/.test(e.completedOn||'')?e.completedOn:'',time:")
    .replaceAll('e=>e.date===day', 'e=>journalVisibleOn(e,day)')
    .replaceAll('e=>e.date===trainJournalDateV292', 'e=>journalVisibleOn(e,trainJournalDateV292)')
    .replaceAll('e=>e.date===trainCalendarSelectedV292', 'e=>journalVisibleOn(e,trainCalendarSelectedV292)')
    .replace("entries.filter(e=>e.status!=='완료').map", "entries.filter(e=>e.status!=='완료'&&journalVisibleOn(e,today)).map")
    .replace("records.filter(e=>e.status==='진행 중')", "records.filter(e=>e.status==='진행 중'&&journalVisibleOn(e,localISO()))")
    .replace("const date=ym+'-'+String(num).padStart(2,'0'),records=grouped.get(date)||[]", "const date=ym+'-'+String(num).padStart(2,'0'),records=rows.filter(e=>journalVisibleOn(e,date))")
    .replace("$('fStatus').value=e?.status||'미착수';", "$('fWorkType').value=e?.workType||'daily';$('fStatus').value=e?.status||'미착수';")
    .replace("const item={id:old?.id||'',title:", "const item={workType:$('fWorkType').value,id:old?.id||'',title:")
    .replace('<span class="cat">${escapeH(e.category)}</span>', '<span class="cat">${escapeH(e.category)}</span><span class="pill">${e.workType===\'long\'?\'장기업무\':\'당일업무\'}</span>')
    .replace("${e.owner?`<span>담당:", "${e.workType==='long'?`<span>시작: ${escapeH(e.date)}${e.completedOn?' · 완료: '+escapeH(e.completedOn):''}</span>`:''}${e.owner?`<span>담당:")
    .replace('<b>${escapeH(e.title)}</b>', '<b>[${e.workType===\'long\'?\'장기업무\':\'당일업무\'}] ${escapeH(e.title)}</b>');
  js = js.replace("date:String(e.date),workType:", "date:String(e.date),dueTime:/^([01]\\d|2[0-3]):[0-5]\\d$/.test(e.dueTime||'')?e.dueTime:'',workType:")
    .replace('function normalizeTime24(){', "function normalizeTime24(field='fTime'){")
    .replace("const el=$('fTime'); let value=el.value.trim();", "const el=$(field); let value=el.value.trim();")
    .replace("normalizeTime24();const f=$('entryForm');", "normalizeTime24();normalizeTime24('fDueTime');const f=$('entryForm');")
    .replace("$('fDue').value=e?.due||'';", "$('fDue').value=e?.due||'';$('fDueTime').value=e?.dueTime||'';$('deleteJournalEntry').hidden=ro||!e;")
    .replace("due:$('fDue').value,", "due:$('fDue').value,dueTime:$('fDueTime').value,")
    .replace("if(!item.title){", "if(item.dueTime&&!item.due){alert('마감시간을 입력하려면 마감일을 선택하세요.');return;}if(!item.title){")
    .replace("refresh();toast('Google Sheets에서 삭제했습니다.');", "if($('entryId').value===id)closeModal(true);refresh();toast('Google Sheets에서 삭제했습니다.');")
    .replace("${escapeH(prettyDate(e.due,false))}</span>", "${escapeH(prettyDate(e.due,false))}${e.dueTime?' '+escapeH(e.dueTime):''}</span>")
    .replace("${escapeH(e.due||'-')}</td>", "${escapeH(e.due||'-')}${e.dueTime?' '+escapeH(e.dueTime):''}</td>")
    .replaceAll("e.due&&e.due<today", "journalOverdue(e)")
    .replaceAll("if(e.due<today)", "if(journalOverdue(e))")
    .replaceAll("e.due<today?", "journalOverdue(e)?")
    .replace("const dueToday=unfinished.filter(e=>e.due===today).length", "const dueToday=unfinished.filter(e=>e.due===today&&!journalOverdue(e)).length")
    .replace("${escapeH(label)}</small>", "${escapeH(label)}${e.dueTime?' · '+escapeH(e.dueTime):''}${e.time?' · 업무 '+escapeH(e.time):''}</small>")
    .replace("(a.e.due||'9999-99-99').localeCompare(b.e.due||'9999-99-99')", "((a.e.due||'9999-99-99')+'T'+(a.e.dueTime||'23:59')).localeCompare((b.e.due||'9999-99-99')+'T'+(b.e.dueTime||'23:59'))");
  const end = js.lastIndexOf('})();');
  js = js.slice(0,end) + `\n$('fDueTime').addEventListener('blur',()=>{normalizeTime24('fDueTime');updateFormHint();});\n$('deleteJournalEntry').addEventListener('click',async()=>{const button=$('deleteJournalEntry');if(modalSaving||button.disabled)return;button.disabled=true;try{await delEntry($('entryId').value);}finally{button.disabled=false;}});\n` + js.slice(end);
  return js;
}
export function updateJournalHtml(html) {
  let result = html.replace('<label for="fDate">업무일', '<label for="fDate">업무일')
    .replace('<div class="form-item"><label for="fDate">', '<div class="form-item full"><label for="fWorkType">업무유형</label><select id="fWorkType" name="workType"><option value="daily">당일업무</option><option value="long">장기업무</option></select><small>당일업무는 지정한 날만, 장기업무는 시작일부터 완료한 날까지 표시됩니다. 진행 내용은 같은 기록에서 이어서 수정하세요.</small></div><div class="form-item"><label for="fDate">')
    .replace('<label for="fTime">업무 시간 ', '<label for="fTime">업무 시작 시간 ')
    .replace('<input id="fDue" name="due" type="date"></div>', '<input id="fDue" name="due" type="date"></div><div class="form-item"><label for="fDueTime">마감 시간 (선택)</label><input id="fDueTime" name="dueTime" type="time" step="60"><small>비워두면 해당 마감일 하루 전체를 기준으로 표시합니다.</small></div>')
    .replace('<button class="btn" type="button" id="cancelModal">', '<button class="btn" type="button" id="deleteJournalEntry" hidden style="color:#b42318">업무 삭제</button><button class="btn" type="button" id="cancelModal">');
  const controls={};
  for(const id of ['fDate','fTime','fDue','fDueTime']){
    const pattern=new RegExp('<div class="form-item"><label for="'+id+'">[\\s\\S]*?<\\/div>');
    const found=result.match(pattern);if(!found)throw Error('업무 일시 입력 위치를 확인하세요: '+id);
    controls[id]=found[0];result=result.replace(pattern,id==='fDate'?'<!-- journal-datetime -->':'');
  }
  const timeField=(id,name,label,help)=>'<div class="form-item"><label for="'+id+'">'+label+' <span class="time24-badge">24시간제</span></label><input id="'+id+'" name="'+name+'" type="text" inputmode="numeric" maxlength="5" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" placeholder="HH:mm (예: 09:00)" title="00:00~23:59로 입력하세요" autocomplete="off" aria-describedby="'+id+'Help"><small id="'+id+'Help">'+help+'</small></div>';
  result=result.replace('<!-- journal-datetime -->','<div class="form-item full journal-datetime-grid">'+controls.fDate+timeField('fTime','time','업무시간','선택 · 예: 09:00, 13:30')+controls.fDue+timeField('fDueTime','dueTime','마감시간','선택 · 비워두면 마감일 하루 전체')+'</div>');
  return result;
}

export const journalCSS=`
.journal-datetime-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 18px;padding:16px;background:#f6f9fd;border:1px solid #e0e8f2;border-radius:12px}
.journal-datetime-grid .form-item{min-width:0}.journal-datetime-grid input{min-width:0;width:100%;box-sizing:border-box;min-height:44px}.journal-datetime-grid small{display:block;margin-top:5px;font-size:11px;color:#6b7e94}
@media(max-width:480px){.journal-datetime-grid{padding:10px;gap:12px 10px}.journal-datetime-grid input{font-size:14px;padding:8px}.journal-datetime-grid .time24-badge{font-size:9px}}
`;
