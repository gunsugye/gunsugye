export function dutyRequestsNavSourceV400(source){return source.replace('const NAV_FIXED_V233=[',"const NAV_FIXED_V233=['dutyRequests',").replaceAll("'saber','dutyItems','repairs'","'saber','dutyItems','dutyRequests','repairs'");}
export function dutyRequestsJsV400(js,client){
 js=dutyRequestsNavSourceV400(js).replace('const NAV_BUILTIN_V233=[',"const NAV_BUILTIN_V233=['dutyRequests',").replace('const viewNames={',"const viewNames={dutyRequests:['DUTY ITEM REQUESTS','근무생도 물품 수정 요청','예도·흉장·블럭·명패·아크릴판 요청을 확인하고 반영합니다.'],")
 .replace('function navInitV220(){',"function navInitV220(){const dutyRequestButtonV400=document.createElement('button');dutyRequestButtonV400.type='button';dutyRequestButtonV400.className='nav-btn';dutyRequestButtonV400.dataset.view='dutyRequests';dutyRequestButtonV400.textContent='근무생도 물품 수정 요청';$('sidebarMenu').appendChild(dutyRequestButtonV400);")
 .replace("'dutyItems','dutyCadets'","'dutyRequests','dutyItems','dutyCadets'").replace("['dutyItems'].includes(v)||","v==='dutyRequests'||['dutyItems'].includes(v)||")
 .replace("'dutyItems','dutyCadets','developmentRequests'","'dutyRequests','dutyItems','dutyCadets','developmentRequests'")
 .replace("if(['dutyItems'].includes(v))dutyItemsLoadV368(v);","if(['dutyItems'].includes(v))dutyItemsLoadV368(v);if(v==='dutyRequests')dutyRequestsLoadV400();")
 .replace("view==='assetRequests'||view==='uniformRequests'","view==='assetRequests'||view==='uniformRequests'||view==='dutyRequests'")
 .replace("if(['dutyItems'].includes(id)&&","if(['dutyItems','dutyRequests'].includes(id)&&")
 .replace('busy:!!(assetInspectionBusyV382||','busy:!!(dutyRequestBusyV400||assetInspectionBusyV382||');
 const end=js.lastIndexOf('})();');return js.slice(0,end)+'\n'+client+'\n'+js.slice(end);
}
export function dutyRequestsHtmlV400(html){return html.replace('</main>','<section id="dutyRequestsView" class="hidden"><div class="panel"><div class="panel-head"><h2>근무생도 물품 수정 요청</h2><button id="dutyRequestsRefreshV400" class="btn" type="button">새로고침</button></div><p class="panel-sub">확인 완료: 기록 유지 · 수정 반영: 검토한 물품 수량·예도 상태 저장</p><label>처리상태 <select id="dutyRequestsFilterV400" class="field"><option value="대기">대기</option><option value="전체">전체</option></select></label><p id="dutyRequestsStatusV400" role="status"></p><div id="dutyRequestsListV400"></div></div></section></main>');}
