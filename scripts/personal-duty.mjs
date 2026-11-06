export function personalDutyHtmlV400(html){
 const start='<div class="grid">',end='</div><p id="updated"';
 if(!html.includes(start)||!html.includes(end))throw Error('개인 조회 화면 위치를 확인하세요.');
 return html.replace(start,'<div class="grid" id="personalRegularV400">')
 .replace(end,'</div><section id="personalDutyV400" hidden><p class="hint">본인에게 등록된 근무별 예도·흉장·블럭·명패입니다. 변경이 필요하면 아래에서 수정 요청하세요.</p><div class="grid" id="personalDutyCardsV400"></div></section><p id="updated"');
}
export function personalDutyPortalV400(js,client){
 const markers=['function render(data){',"function clear(message=''){",'})();'];for(const marker of markers)if(!js.includes(marker))throw Error('개인 조회 코드 위치를 확인하세요: '+marker);
 return js.replace('function render(data){','function render(data){personalDutyRenderV400(data);').replace("function clear(message=''){","function clear(message=''){personalDutyResetV400();").replace('})();',client+'\n})();');
}
export const personalDutyCSSV400='.personal-profile-tabs{display:flex;gap:8px;margin:0 0 14px}.personal-profile-tabs button[aria-selected="true"]{color:#fff;background:#245fa8;border-color:#245fa8}.personal-duty-table{border-collapse:collapse;width:100%;font-size:13px;table-layout:fixed}.personal-duty-table th,.personal-duty-table td{padding:10px 6px;text-align:left;border-bottom:1px solid #e2e9f2;overflow-wrap:anywhere}.personal-duty-table thead{background:#edf3fa}.personal-duty-table th:first-child{width:25%}#personalDutyCardsV400{gap:12px}#personalDutyCardsV400 form{display:grid;gap:8px;margin-top:14px}#personalDutyCardsV400 form label{display:grid;gap:6px}#personalDutyCardsV400 form button{background:#245fa8;color:white}';
