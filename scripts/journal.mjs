// 날짜별 화면·인쇄·캘린더가 같은 장기업무 표시 규칙을 사용합니다.
export function journalVisibleOn(entry, day) {
  if (entry.workType !== 'long') return entry.date === day;
  if (day < entry.date) return false;
  return entry.status !== '완료' || day <= (entry.completedOn || entry.date);
}
export function updateJournalJs(js) {
  js = `const journalVisibleOn = ${journalVisibleOn.toString()};\n` + js;
  js = js.replaceAll('e=>e.date===selectedDay', 'e=>journalVisibleOn(e,selectedDay)')
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
  return js;
}
export function updateJournalHtml(html) {
  return html.replace('<label for="fDate">업무일', '<label for="fDate">업무일 / 시작일')
    .replace('<div class="form-item"><label for="fDate">', '<div class="form-item full"><label for="fWorkType">업무유형</label><select id="fWorkType" name="workType"><option value="daily">당일업무</option><option value="long">장기업무</option></select><small>당일업무는 지정한 날만, 장기업무는 시작일부터 완료한 날까지 표시됩니다. 진행 내용은 같은 기록에서 이어서 수정하세요.</small></div><div class="form-item"><label for="fDate">');
}
