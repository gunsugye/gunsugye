export function staffAccessHtml(html){
 const access=html.match(/<section id="accessView"[^>]*>[\s\S]*?<\/section>/);if(!access)throw Error('권한 관리 화면 위치 확인');
 html=html.replace(access[0],access[0].replace(/<section id="accessView"[^>]*>/,'<section id="accessView" class="hidden" aria-hidden="true">'));
 return html.replace(/(<section id="staffView"[\s\S]*?)(<\/section>)/,(_all,body,end)=>body.replace('<th>전화번호</th><th>근무 차수</th>','<th>전화번호</th><th>이메일</th><th>근무 차수</th>').replace('<button class="btn btn-primary" id="v284StaffSave" type="button">명단 저장</button>','<button class="btn" id="staffDutyImportV441" type="button">근무생도 명단 불러오기</button><button class="btn btn-primary" id="v284StaffSave" type="button">명단 저장</button>')+end);
}

export function staffAccessJs(js){
 js=js.replace("items:['settings','changes','access','staff','updates']","items:['settings','changes','staff','updates']")
 .replace("'surveys','updates','access','staff','today'","'surveys','updates','staff','today'")
 .replace("staff:['LOGISTICS STAFF','군수계 명단','직책·이름·전화번호·근무 차수를 관리합니다.']","staff:['LOGISTICS STAFF','군수계 명단','직책과 이메일에 따라 권한이 자동 적용됩니다.']")
 .replace('function switchView(v){',"function switchView(v){if(v==='access')v='staff';")
 .replace("phone:$('v284StaffPhone').value.trim(),term:","phone:$('v284StaffPhone').value.trim(),email:$('v284AccessEmail').value.trim(),term:")
 .replace("['Name','Phone'].forEach(x=>$('v284Staff'+x).value='');","['Name','Phone'].forEach(x=>$('v284Staff'+x).value='');$('v284AccessEmail').value='';")
 .replace("$('v284StaffPhone').value=x.phone;","$('v284StaffPhone').value=x.phone;$('v284AccessEmail').value=x.email||'';")
 .replace("escapeH(x.phone||'—')+'</td><td>'+escapeH(x.term)","escapeH(x.phone||'—')+'</td><td>'+escapeH(x.email||'—')+'</td><td>'+escapeH(x.term)")
 .replace('<td colspan="5">선택한 차수의 근무자 명단이 없습니다.','<td colspan="6">선택한 차수의 근무자 명단이 없습니다.')
 .replace("function v284Init(){","function v284Init(){const emailLabel=$('v284AccessEmail')?.closest('label');if(emailLabel)$('v284StaffPhone').closest('.v284-grid').appendChild(emailLabel);");
 const end=js.lastIndexOf('})();');return js.slice(0,end)+`
$('staffDutyImportV441').addEventListener('click',async()=>{const button=$('staffDutyImportV441');button.disabled=true;$('v284StaffStatus').textContent='근무생도 명단과 전화번호부를 확인 중…';try{const result=await server('staffImportDutyCadetsV441');await v284StaffLoad();$('v284StaffStatus').textContent='근무생도 명단 반영 · 신규 '+result.created+'명 / 전화번호 갱신 '+result.updated+'명 / 전화번호 확인 필요 '+result.unmatched+'명';}catch(error){$('v284StaffStatus').textContent='근무생도 명단 반영 실패: '+error.message;}finally{button.disabled=false;}});
`+js.slice(end);
}
