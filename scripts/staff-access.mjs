export function staffAccessHtml(html){
 const access=html.match(/<section id="accessView"[^>]*>([\s\S]*?)<\/section>/);if(!access)throw Error('권한 관리 화면 위치 확인');
 html=html.replace(access[0],'<section id="accessView" class="hidden"></section>');
 return html.replace(/(<section id="staffView"[\s\S]*?)(<\/section>)/,(_all,body,end)=>body+'<div id="staffPermissionsV364" class="hidden"><p id="staffPermissionPersonV364" class="notice" role="status">권한을 관리할 직책과 Google 계정을 선택하세요.</p>'+access[1]+'</div>'+end);
}
export function staffAccessJs(js){
 js=js.replace("items:['settings','changes','access','staff','updates']","items:['settings','changes','staff','updates']")
 .replace("'surveys','updates','access','staff','today'","'surveys','updates','staff','today'")
 .replace("staff:['LOGISTICS STAFF','군수계 명단','직책·이름·전화번호·근무 차수를 관리합니다.']","staff:['LOGISTICS STAFF & ACCESS','군수계 명단·권한 관리','근무 차수별 명단과 계정별 편집 권한을 한 화면에서 관리합니다.']")
 .replace('function switchView(v){',"function switchView(v){if(v==='access')v='staff';")
 .replace("if(v==='staff')v284StaffLoad();","if(v==='staff')staffAccessLoadV364();")
 .replace('function v284Init(){',"function v284Init(){\n $('staffPermissionsV364').appendChild($('accessManageV281'));")
 .replace("'<button class=\"btn\" type=\"button\" data-v284-staff-edit=\"'+i+'\">수정</button>","'<button class=\"btn\" type=\"button\" data-staff-access=\"'+i+'\">권한 관리</button> <button class=\"btn\" type=\"button\" data-v284-staff-edit=\"'+i+'\">수정</button>");
 js=js.replaceAll('await v284AccessLoad();','await Promise.all([v284AccessLoad(),loadFullEditorsV281()]);').replaceAll('await loadFullEditorsV281();','await Promise.all([loadFullEditorsV281(),v284AccessLoad()]);');
 // The account list markup includes the closing div immediately before its revoke button.
 js=js.replace("</small></div><button class=\"btn btn-danger\" type=\"button\" data-v284-revoke=\"'+escapeH(x.email)","</small></div><button class=\"btn\" type=\"button\" data-staff-access-edit=\"'+escapeH(x.email)+'\">변경</button><button class=\"btn btn-danger\" type=\"button\" data-v284-revoke=\"'+escapeH(x.email)");
 const end=js.lastIndexOf('})();');return js.slice(0,end)+`
function staffAccessLoadV364(){
 $('staffPermissionsV364').classList.toggle('hidden',!canManageUsersV281);v284StaffLoad();
 if(canManageUsersV281){v284AccessLoad();loadFullEditorsV281();}
}
function staffAccessFocusV364(job,name,email,views){
 if(!canManageUsersV281||v284Busy)return;
 $('v284AccessJob').value=job;$('v284AccessEmail').value=email||'';v284CheckboxRender();
 qsa('[data-access-view]',$('v284AccessCheckboxes')).forEach(input=>input.checked=!input.disabled&&(views||[]).includes(input.dataset.accessView));
 $('staffPermissionPersonV364').textContent=[job,name,email].filter(Boolean).join(' · ')+(email?' · 허용 메뉴 확인 후 저장':' · 이메일 입력 후 허용 메뉴를 선택하세요.');
 $('staffPermissionsV364').scrollIntoView({behavior:'smooth',block:'start'});$('v284AccessEmail').focus({preventScroll:true});
}
$('v284StaffRows').addEventListener('click',event=>{const button=event.target.closest('[data-staff-access]');if(!button)return;const person=v284StaffItems[Number(button.dataset.staffAccess)];if(person)staffAccessFocusV364(person.job,person.name,'',[]);});
$('v284AccessUsers').addEventListener('click',event=>{const button=event.target.closest('[data-staff-access-edit]');if(!button)return;const user=v284AccessUsers.find(p=>p.email===button.dataset.staffAccessEdit);if(user)staffAccessFocusV364(user.job,'',user.email,user.views);});
`+js.slice(end);
}
