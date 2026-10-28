export const departureTitle = '퇴교자(휴학자/위탁) 일괄 관리';
export function updateDeparturesHtml(html){
 html=html.replaceAll('<option>퇴교</option>','<option>퇴교</option><option>퇴학</option>').replaceAll('<option value="퇴교">퇴교</option>','<option value="퇴교">퇴교</option><option value="퇴학">퇴학</option>');
 return html.replace('<section id="supplyView"', `<section id="departuresView" class="hidden">
 <div class="panel"><div class="panel-head"><div><h2>총기 · 군수품 · 피복 일괄 처리</h2><p>스마트당직에서 확인되지 않는 인원입니다. 미등재 사유와 실제 반납·인계 여부를 확인한 뒤 처리하세요.</p></div><button class="btn" id="departuresRefresh" type="button">새로고침</button></div>
 <p id="departuresStatus" role="status">명단 확인 전입니다.</p>
 <div class="departure-toolbar"><input id="departuresSearch" class="field" placeholder="기수·중대·이름 검색" aria-label="일괄 관리 대상 검색"><button id="departuresSelect" class="btn" type="button">표시된 인원 선택</button><button id="departuresClear" class="btn" type="button">선택 해제</button><button id="departuresApply" class="btn btn-primary" type="button">선택 인원 일괄 처리</button></div>
 <div class="departure-toolbar"><label>선택 인원 관리 상태<select class="field" id="departuresBulkStatus"><option value="">상태 선택</option><option>퇴학</option><option>퇴교</option><option>휴학</option><option>위탁</option></select></label><button type="button" class="btn" id="departuresSetStatus">선택 인원에 상태 적용</button></div>
 <p>스마트당직에 퇴학·퇴교로 표기된 인원도 처리 후보에 포함합니다. 총기번호는 별도 기록으로 보관합니다. 군수품 지급 기록과 피복 원본도 보존하며 활동 명단에서 제외합니다. 피복 사이즈 기록은 물품 지급 여부를 뜻하지 않습니다.</p>
 <div id="departuresCandidates"></div><div id="departuresResult" role="status" aria-live="polite"></div>
 </div>
 <div class="panel"><h2>동명이인 · 소속 확인 필요</h2><div id="departuresReview"></div></div>
 <div class="panel"><div class="panel-head"><h2>기존 이동·총기번호 관리</h2><button id="departuresLegacy" type="button" class="btn">상태 변경 · 복구 · 총기번호 관리</button></div><div id="departuresArchived"></div><p>피복 원본은 ‘피복_상태이동보관’ 시트에 보존됩니다. 기존 복구 기능은 총기·군수품 활동 명단을 복구합니다.</p></div>
 <div class="panel"><h2>최근 일괄 처리 내역</h2><div id="departuresHistory"></div></div>
 </section><section id="supplyView"`)
 .replace('<nav id="sidebarMenu" aria-label="일반학기 메뉴">','<nav id="sidebarMenu" aria-label="일반학기 메뉴"><button class="nav-btn" data-view="departures">인원 일괄 관리</button>');
}
export function updateDeparturesJs(js){
 js=js.replaceAll('<option>퇴교</option>','<option>퇴교</option><option>퇴학</option>').replaceAll('<option value="퇴교">퇴교</option>','<option value="퇴교">퇴교</option><option value="퇴학">퇴학</option>').replaceAll("['퇴교','퇴교']","['퇴교','퇴교'],['퇴학','퇴학']").replaceAll("['위탁','휴학','퇴교']","['위탁','휴학','퇴교','퇴학']").replaceAll("['퇴교','휴학','위탁']","['퇴교','퇴학','휴학','위탁']");
 js=js.replace('const viewNames={',`const viewNames={departures:['PERSONNEL MANAGEMENT','${departureTitle}','스마트당직 미등재 인원의 총기·군수품·피복을 함께 확인하고 처리합니다.'],`)
 .replace('const NAV_GROUP_DEFAULT_V233=[',`const NAV_GROUP_DEFAULT_V233=[{id:'departures',title:'${departureTitle}',items:['departures']},`)
 .replace("const NAV_BUILTIN_V233=[", "const NAV_BUILTIN_V233=['departures',")
 .replace("['today','all','stats','dorm'", "['departures','today','all','stats','dorm'")
 .replace("v==='dorm'||v==='laborCalc'", "v==='departures'||v==='dorm'||v==='laborCalc'")
 .replace("if(v==='today')renderToday();", "if(v==='departures')departuresLoadV305();if(v==='today')renderToday();");
 const extra=`
let departuresDataV305=null,departuresBusyV305=false;
const departureEscapeV305=escapeH;
function departuresOptionsV305(values){return '<option value="">처리 선택</option>'+values.map(x=>'<option>'+escapeH(x)+'</option>').join('');}
function departuresRenderV305(){
 const d=departuresDataV305;if(!d)return;const q=$('departuresSearch').value.trim().toLowerCase();
 const rows=d.candidates||[];
 $('departuresStatus').textContent=d.ready?'기준: '+d.source+' · '+d.referenceCount+'명 대조 · 처리 대상 '+rows.length+'명':d.error||'스마트당직 연결을 확인하세요.';
 $('departuresCandidates').innerHTML=rows.map(c=>{
  const match=!q||[c.name,c.cohort,c.company+'중대'].join(' ').toLowerCase().includes(q);
  return '<article class="departure-person" data-departure-id="'+escapeH(c.id)+'" '+(!match?'hidden':'')+'><div class="departure-person-head"><label><input type="checkbox" class="departure-pick"> <b>'+escapeH(c.cohort+' '+c.company+'중대 '+c.name)+'</b></label><span>'+(!c.roster?'피복만 남은 인원':'활동 명단 등록 인원')+'</span></div><div class="departure-fields"><label>관리 상태<select class="departure-state">'+departuresOptionsV305(['퇴교','퇴학','휴학','위탁'])+'</select></label><label>총기 '+escapeH(c.roster?.firearmNumber||'(활동 번호 없음)')+'<select class="departure-gun">'+departuresOptionsV305(['별도 보관','반납 완료','인계 완료','미지급 확인'])+'</select></label><label>피복 '+c.uniforms.length+'건<select class="departure-uniform" '+(!c.uniforms.length?'disabled':'')+'>'+departuresOptionsV305(['보관','반납 완료','인계 완료','미지급 확인'])+'</select></label></div><div class="departure-supply">'+(c.supplies.length?c.supplies.map(item=>'<label data-departure-item="'+escapeH(item.id)+'"><b>'+escapeH(item.name)+'</b> <span>'+escapeH([item.status,item.detail,Object.entries(item.extra||{}).map(([k,v])=>k+': '+v).join(' / ')].filter(Boolean).join(' · '))+'</span><select>'+departuresOptionsV305(['반납 완료','인계 완료','미지급 확인'])+'</select></label>').join(''):'<p>지급 기록이 있는 군수품 없음</p>')+'</div>'+(c.uniforms.length?'<details><summary>피복 사이즈 원본 확인</summary>'+c.uniforms.map(u=>'<p>'+escapeH(Object.entries(u.sizes||{}).map(([k,v])=>k+': '+v).join(' / ')||'사이즈 미입력')+'</p>').join('')+'</details>':'')+'<label>비고<input class="field departure-note" maxlength="400" placeholder="상태 이동 사유, 반납·인계 관련 사항"></label></article>';
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
 if(!confirm('선택한 '+plans.length+'명의 총기·군수품·피복을 함께 처리할까요?\\n반납·인계가 실제로 완료되었는지 확인하세요. 인원별 결과를 기록하며 중간 실패 시 완료된 인원은 유지됩니다.'))return;
 departuresBusyV305=true;$('departuresView').setAttribute('aria-busy','true');$('departuresView').querySelectorAll('button,input,select').forEach(x=>x.disabled=true);const results=[];
 try{for(let i=0;i<plans.length;i++){
  $('departuresResult').textContent=(i+1)+' / '+plans.length+'명 처리 중…';
  try{const r=await enqueue(()=>server('processDepartureV305',plans[i]));results.push((r.name||'대상')+' · '+(r.ok?'완료'+(r.warnings?.length?' / 확인 필요: '+r.warnings.join(' / '):''):(r.partial?'일부 처리됨: ':'중단: ')+r.error));if(!r.ok)break;}
  catch(e){results.push('처리 중단: '+e.message+' · 자동 재시도하지 않습니다. 새로고침 후 실제 처리 내역을 확인하세요.');break;}
 }}finally{departuresBusyV305=false;$('departuresView').removeAttribute('aria-busy');$('departuresView').querySelectorAll('button,input,select').forEach(x=>x.disabled=false);rosterLoaded=false;supplyLoaded=false;uniformStateV278.loaded=false;await departuresLoadV305();$('departuresResult').textContent=results.join('\\n');}
}
$('departuresRefresh').addEventListener('click',departuresLoadV305);
$('departuresSearch').addEventListener('input',()=>{const q=$('departuresSearch').value.trim().toLowerCase();for(const row of $('departuresCandidates').children)row.hidden=!!q&&!row.textContent.toLowerCase().includes(q);});
$('departuresSelect').addEventListener('click',()=>{$('departuresCandidates').querySelectorAll('[data-departure-id]').forEach(r=>{if(!r.hidden)r.querySelector('.departure-pick').checked=true;});});
$('departuresClear').addEventListener('click',()=>{$('departuresCandidates').querySelectorAll('.departure-pick').forEach(x=>x.checked=false);});
$('departuresApply').addEventListener('click',departuresApplyV305);
$('departuresSetStatus').addEventListener('click',()=>{const status=$('departuresBulkStatus').value;if(!status)return toast('관리 상태를 선택하세요.');const picked=$('departuresCandidates').querySelectorAll('.departure-pick:checked');if(!picked.length)return toast('대상 인원을 선택하세요.');picked.forEach(p=>p.closest('[data-departure-id]').querySelector('.departure-state').value=status);toast('선택 '+picked.length+'명에 '+status+' 상태를 지정했습니다. 물품 처리 결과 확인 후 일괄 처리하세요.');});
$('departuresLegacy').addEventListener('click',()=>{switchView('roster');smartSwitchV253('special');});
`;
 const index=js.lastIndexOf('})();');return js.slice(0,index)+extra+js.slice(index);
}
export const departuresCSS=`
.departure-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:14px 0}.departure-toolbar input{max-width:280px}
.departure-person{padding:18px;border:1px solid #dbe5ef;border-radius:12px;margin:14px 0;background:#fff}.departure-person[hidden]{display:none}
.departure-person-head{display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px}.departure-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.departure-person label{display:block}.departure-person select,.departure-person .field{display:block;width:100%;min-height:40px;padding:8px;border:1px solid #ccd9e7;border-radius:8px;margin:5px 0 10px}.departure-pick{width:18px;height:18px;vertical-align:middle}
.departure-supply>label{padding:10px 0;border-bottom:1px solid #edf1f6}.departure-supply span{font-size:12px;color:#62758a}#departuresResult{white-space:pre-wrap;line-height:1.8;padding:12px 0}
@media(max-width:650px){.departure-fields{grid-template-columns:1fr}}
`;
