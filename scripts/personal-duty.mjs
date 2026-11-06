export function personalDutyHtmlV400(html){
 const start='<div class="grid">',end='</div><p id="updated"';
 if(!html.includes(start)||!html.includes(end))throw Error('개인 조회 화면 위치를 확인하세요.');
 return html.replace(start,'<div class="grid" id="personalRegularV400">')
 .replace(end,"<section id=\"personalDutyV400\" class=\"card wide\" hidden><h2>근무생도 물품</h2><div id=\"personalDutyCardsV400\"></div></section></div><p id=\"updated\"");
}
export function personalDutyPortalV400(js,client){
 const markers=['function render(data){',"function clear(message=''){",'})();'];for(const marker of markers)if(!js.includes(marker))throw Error('개인 조회 코드 위치를 확인하세요: '+marker);
 return js.replace('function render(data){','function render(data){personalDutyRenderV400(data);').replace("function clear(message=''){","function clear(message=''){personalDutyResetV400();").replace('})();',client+'\n})();');
}
export const personalDutyCSSV400='.personal-profile-tabs{display:flex;gap:8px;margin:0 0 14px}.personal-profile-tabs button[aria-selected="true"]{color:#fff;background:#245fa8;border-color:#245fa8}.personal-duty-table{border-collapse:collapse;width:100%;font-size:13px;table-layout:fixed}.personal-duty-table th,.personal-duty-table td{padding:10px 6px;text-align:left;border-bottom:1px solid #e2e9f2;overflow-wrap:anywhere}.personal-duty-table thead{background:#edf3fa}.personal-duty-table th:first-child{width:25%}#personalDutyCardsV400{gap:12px}#personalDutyCardsV400 form{display:grid;gap:8px;margin-top:14px}#personalDutyCardsV400 form label{display:grid;gap:6px}#personalDutyCardsV400 form button{background:#245fa8;color:white}.duty-quantity-options{border:0;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}.duty-quantity-options label{display:flex!important;align-items:center;gap:4px!important;font-size:12px;margin:0;white-space:nowrap}.duty-quantity-options input[type=checkbox]{width:17px;height:17px;min-height:17px;margin:0;padding:0}.duty-quantity-options input[type=number]{min-height:32px;padding:5px;max-width:90px}.personal-duty-table small{display:block}.personal-duty-table textarea{min-height:48px;font-size:14px;padding:5px}';
