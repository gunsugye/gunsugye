export function staffAccessHtml(html){
 const access=html.match(/<section id="accessView"[^>]*>([\s\S]*?)<\/section>/);if(!access)throw Error('권한 관리 화면 위치 확인');
 html=html.replace(access[0],'<section id="accessView" class="hidden"></section>');
 return html.replace(/(<section id="staffView"[\s\S]*?)(<\/section>)/,(_all,body,end)=>body.replace('<th>전화번호</th><th>근무 차수</th>','<th>전화번호</th><th>이메일</th><th>근무 차수</th>')+'<div id="staffPermissionsV364" class="hidden"><p id="staffPermissionPersonV364" class="notice" role="status">권한을 관리할 직책과 Google 계정을 선택하세요.</p>'+access[1]+'</div>'+end);
}
export function staffAccessJs(js){
 js=js.replace("items:['settings','changes','access','staff','updates']","items:['settings','changes','staff','updates']")
 .replace("'surveys','updates','access','staff','today'","'surveys','updates','staff','today'")
 .replace("staff:['LOGISTICS STAFF','군수계 명단','직책·이름·전화번호·근무 차수를 관리합니다.']","staff:['LOGISTICS STAFF & ACCESS','군수계 명단·권한 관리','근무 차수별 명단과 계정별 편집 권한을 한 화면에서 관리합니다.']")
 .replace('function switchView(v){',"function switchView(v){if(v==='access')v='staff';")
 .replace("if(v==='staff')v284StaffLoad();","if(v==='staff')staffAccessLoadV364();")
 .replace('function v284Init(){',`function v284Init(){
 $('staffPermissionsV364').appendChild($('accessManageV281'));
 $('v284StaffPhone').closest('.v284-grid').appendChild($('v284AccessEmail').closest('label'));
 const rightsPanel=$('v284AccessJob').closest('.panel'),staffForm=$('v284StaffForm');staffForm.insertBefore(rightsPanel,staffForm.querySelector('.setting-actions'));$('v284AccessJob').closest('label').hidden=true;rightsPanel.querySelector('.panel-title').textContent='허용 메뉴 · 권한 부여';rightsPanel.prepend($('staffPermissionPersonV364'));
 const accounts=document.createElement('div');accounts.className='panel v284-panel';accounts.innerHTML='<h2 class="panel-title">등록된 계정 권한</h2>';accounts.append($('v284AccessStatus'),$('v284AccessUsers'));$('staffPermissionsV364').prepend(accounts);
 `)
 .replace("'<button class=\"btn\" type=\"button\" data-v284-staff-edit=\"'+i+'\">수정</button>","'<button class=\"btn\" type=\"button\" data-staff-access=\"'+i+'\">권한 관리</button> <button class=\"btn\" type=\"button\" data-v284-staff-edit=\"'+i+'\">수정</button>");
 js=js.replaceAll('await v284AccessLoad();','await Promise.all([v284AccessLoad(),loadFullEditorsV281()]);').replaceAll('await loadFullEditorsV281();','await Promise.all([loadFullEditorsV281(),v284AccessLoad()]);');
 js=js.replace("phone:$('v284StaffPhone').value.trim(),term:","phone:$('v284StaffPhone').value.trim(),email:$('v284AccessEmail').value.trim(),term:")
 .replace("const r=await server('accessGrantV284',{email,job,views});$('v284AccessEmail').value='';","const r=await server('accessGrantV284',{email,job,views});")
 .replace("['Name','Phone'].forEach(x=>$('v284Staff'+x).value='');","['Name','Phone'].forEach(x=>$('v284Staff'+x).value='');$('v284AccessEmail').value='';$('v284AccessJob').value=$('v284StaffJob').value;v284CheckboxRender();")
 .replace("$('v284StaffPhone').value=x.phone;","$('v284StaffPhone').value=x.phone;$('v284AccessEmail').value=x.email||'';staffAccessPopulateV366();")
 .replace("escapeH(x.phone||'—')+'</td><td>'+escapeH(x.term)","escapeH(x.phone||'—')+'</td><td>'+escapeH(x.email||'—')+'</td><td>'+escapeH(x.term)")
 .replace("<td colspan=\"5\">선택한 차수의 근무자 명단이 없습니다.","<td colspan=\"6\">선택한 차수의 근무자 명단이 없습니다.");
 // The account list markup includes the closing div immediately before its revoke button.
 js=js.replace("</small></div><button class=\"btn btn-danger\" type=\"button\" data-v284-revoke=\"'+escapeH(x.email)","</small></div><button class=\"btn\" type=\"button\" data-staff-access-edit=\"'+escapeH(x.email)+'\">변경</button><button class=\"btn btn-danger\" type=\"button\" data-v284-revoke=\"'+escapeH(x.email)");
 const end=js.lastIndexOf('})();');return js.slice(0,end)+`
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
`+js.slice(end);
}
