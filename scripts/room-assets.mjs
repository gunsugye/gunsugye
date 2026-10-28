function replaceFunction(source,name,replacement){
 const pattern=new RegExp('function '+name+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}');
 if(!pattern.test(source))throw Error('비품 함수 위치 확인: '+name);
 return source.replace(pattern,()=>replacement);
}
export function roomAssetServer(source,server,bulk){
 source=replaceFunction(source,'saveDormInventoryRoomV244',server.match(/function saveDormInventoryRoomV244\([\s\S]*$/)[0]);
 source=source.replace('function assetV244Catalog_(sh){','function assetV244CatalogRawV311_(sh){');
 source+=`\n${server.slice(0,server.indexOf('function saveDormInventoryRoomV244'))}
function assetV244Catalog_(sh){return assetV244CatalogRawV311_(sh).filter(x=>String(x.name).replace(/\\s/g,'')!=='선풍기').map(x=>({...x,positions:assetPositionsV311_(x.name)}));}
`;
 source=source.replace(" const head=sh.getRange(1,8,1,2).getDisplayValues()[0];",` if(sh.getMaxColumns()<10)sh.insertColumnsAfter(sh.getMaxColumns(),10-sh.getMaxColumns());
 const slotHead=sh.getRange(1,10).getDisplayValues()[0][0];
 if(slotHead&&slotHead!=='자리별점검JSON')throw Error('J열에 다른 자료가 있어 자리별 저장을 중단했습니다.');
 if(!slotHead)sh.getRange(1,10).setValue('자리별점검JSON');
 const head=sh.getRange(1,8,1,2).getDisplayValues()[0];`);
 source=replaceFunction(source,'assetV244Records_',`function assetV244Records_(sh){
 if(!sh||sh.getLastRow()<2)return [];
 return sh.getRange(2,1,sh.getLastRow()-1,Math.min(10,sh.getMaxColumns())).getDisplayValues().filter(r=>r[0]&&r[1]).map(r=>{
  const stored=assetSlotsReadV311_(r[9]);return {roomId:r[0],itemId:r[1],quantity:Number(r[2])||0,normal:Number(r[3])||0,repair:Number(r[4])||0,confirmed:r[5]==='Y',updatedAt:r[6]||'',status:assetV246LegacyStatus_(r),details:r[8]||'',slots:stored.slots,legacy:stored.legacy};
 });
}`);
 const bulkBody=bulk.match(/function bulkSetDormInventoryScopeV246\([^)]*\)\{[\s\S]*?\n\}/)[0];
 source=replaceFunction(source,'bulkSetDormInventoryScopeV246',bulkBody);
 source+='\n'+bulk.replace(bulkBody,'');
 return source;
}
export function roomAssetHtml(html){
 const marker=html.indexOf('<tbody id="assetKindRowsV244"'),start=html.lastIndexOf('<table',marker),end=html.indexOf('</table>',marker)+8;
 if(marker<0||start<0||end<8)throw Error('비품 현황 표 위치를 확인하세요.');
 html=html.slice(0,start)+'<table class="asset-table"><thead><tr><th id="assetOverviewGroupV327">건물</th><th>호실</th><th>수량</th><th>정상</th><th>수리·교체</th><th>미점검</th><th>사용불가</th><th>점검 완료</th></tr></thead><tbody id="assetKindRowsV244"></tbody></table>'+html.slice(end);
 html=html.replace('<h2 class="panel-title">품목별 비품 현황</h2>','<h2 class="panel-title" id="assetOverviewTitleV327">건물별 비품 현황</h2>')
 .replace('선택 범위에서 <b>시트에 등록된 수량만</b> 집계하며, 미점검 호실은 따로 표시합니다.','조회 범위 기준 · 기록 수량만 집계 · 중대는 호실 소속 기준')
 .replace(/<button\b[^>]*id="assetCsvV244"[^>]*>/,button=>'<div class="asset-view-toggle-v328" role="group" aria-label="비품 현황 보기"><label><input type="checkbox" data-asset-overview-mode value="building" checked>건물별</label><label><input type="checkbox" data-asset-overview-mode value="company">중대별</label><input type="hidden" id="assetOverviewModeV327" value="building"></div>'+button);
 if(!html.includes('id="assetOverviewModeV327"'))throw Error('비품 보기 선택 위치를 확인하세요.');
 return html.replace('<table class="asset-table asset-editor"><thead><tr><th>품목</th><th>전체</th><th>정상</th><th>요수리</th><th>상태</th><th>세부사항</th><th>저장</th></tr>', '<table class="asset-table asset-editor"><thead><tr><th>품목</th><th>자리별 · 공용 점검</th><th>저장</th></tr>')
 .replace('품목별 수량·상태·세부사항을 기록합니다. 2개 중 1개만 고장인 경우처럼 정상·요수리 수량을 각각 수정할 수 있습니다. 상태를 바꾸면 수량 전체에 해당 상태가 우선 적용됩니다.','1번·2번 자리를 각각 점검하고 냉장고·공기청정기는 공용으로 기록합니다. 사용불가는 상태와 별도로 체크합니다.')
 .replaceAll('기본 비품 13종','기본 비품 12종')
 .replace('<label>호실당 해당 품목 수량<input class="field" id="assetBulkQtyV246" type="number" min="0" max="999" step="1" value="2"></label>', '<label>대상 자리<select class="field" id="assetBulkPositionV313"><option value="all">모든 자리 · 공용 포함</option><option value="1">1번만</option><option value="2">2번만</option><option value="common">공용품목만</option></select></label><label>사용불가<select class="field" id="assetBulkUnavailableV313"><option value="keep">현재 체크 유지</option><option value="yes">사용불가 체크</option><option value="no">체크 해제</option></select></label><input type="hidden" id="assetBulkQtyV246" value="2">')
 .replace('전체 품목 정상 2개','전체 품목 정상 처리')
 .replace('id="assetRestoreKindV247">삭제 품목 복구</button>','id="assetRestoreKindV247">삭제 품목 복구</button><button type="button" class="btn hidden" id="assetResetV313">점검 기록 전체 초기화</button>');
}
export function roomAssetJs(js,client){
 for(const name of ['assetEditorSnapshotV244','assetOpenRoomV244','assetRowFromFormV244','assetRefreshEditStateV244']){
  const pattern=new RegExp('function '+name+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}');
  const body=client.match(pattern);if(!body)throw Error('비품 클라이언트 함수 누락 '+name);
  js=replaceFunction(js,name,body[0]);
 }
 js=js.replace("if(rec.status==='정상')return", "if(rec.status==='교체 필요')return {label:rec.status,cls:'repair',unknown:0};\n if(rec.status==='정상')return")
 ;
 const start=js.indexOf(' async function applyInventoryBulkV246(){');
 const end=js.indexOf(" $('assetBulkApplyV246').addEventListener",start);
 if(start<0||end<0)throw Error('일괄 입력 핸들러 위치를 확인하세요.');
 js=js.slice(0,start)+' async function applyInventoryBulkV246(){await assetApplyBulkV313();}\n'+js.slice(end);
 js=js.replace('function assetInitV244(){',`function assetInitV244(){
 $('assetResetV313').addEventListener('click',assetResetRecordsV313);`);
 js=js.replace('assetDataV244=await server(\'getDormInventoryV244\');',"assetDataV244=await server('getDormInventoryV244');$('assetResetV313').classList.toggle('hidden',!canManageUsersV281);")
 .replace('function assetFilterChangeV245(',client.slice(client.indexOf('async function assetApplyBulkV313'))+'\nfunction assetFilterChangeV245(')
 .replace("$('assetBulkKindV246').value='ALL';$('assetBulkStatusV246').value='정상';", "$('assetBulkPositionV313').value='all';$('assetBulkUnavailableV313').value='keep';$('assetBulkKindV246').value='ALL';$('assetBulkStatusV246').value='정상';")
 .replace('일괄처리 시 선택 품목에 지정한 수량·상태를 적용합니다 (기본 2개).','일괄처리 시 선택한 품목·자리에 상태를 적용합니다.');
 return js.replaceAll('비품 13종','비품 12종');
}
export const roomAssetCSS=`
#assetKindRowsV244 tr[hidden]{display:none}
.asset-view-toggle-v328{display:flex;gap:8px;flex-wrap:wrap}.asset-view-toggle-v328 label{display:flex;align-items:center;gap:6px;padding:9px 12px;border:1px solid #cbd8e8;border-radius:8px;cursor:pointer;min-height:24px}.asset-view-toggle-v328 label:has(input:checked){background:#edf4ff;border-color:#286cf5;color:#174f93;font-weight:700}.asset-view-toggle-v328 input{width:17px;height:17px;accent-color:#286cf5}
.asset-legacy-bulk-v311{display:none!important}
.asset-editor{min-width:680px;width:100%;table-layout:fixed}
.asset-editor th:first-child{width:86px}.asset-editor th:last-child{width:60px}
.asset-editor td{padding:7px 8px;vertical-align:middle}.asset-editor td:first-child strong{font-size:13px}
.asset-editor .btn{padding:6px 10px;min-height:32px;font-size:12px}
.asset-seat-grid{display:grid;grid-template-columns:1fr;gap:5px}
.asset-seat-card{display:grid;grid-template-columns:30px 150px minmax(110px,1fr) 78px;align-items:center;gap:7px;padding:0;border:0;background:transparent;min-width:0}
.asset-seat-card strong{font-size:12px;color:#50657c;white-space:nowrap}
.asset-seat-card .field{width:100%;box-sizing:border-box;min-width:0;min-height:32px;height:32px;margin:0;padding:5px 7px;font-size:12px;border-radius:5px}
.asset-seat-card textarea.field{resize:vertical;line-height:20px;max-height:160px;overflow:auto}
.asset-seat-card textarea.field:focus{min-height:58px}
.asset-seat-card .asset-unavailable{display:flex;align-items:center;gap:4px;margin:0;font-size:12px;white-space:nowrap;cursor:pointer}
.asset-seat-card input[type=checkbox]{width:15px;height:15px;margin:0;accent-color:#d45050}
.asset-seat-card:has(input:checked){background:#fff5f3;border-radius:4px}
.asset-legacy-note{color:#8a5a00;font-size:11px;margin:0 0 5px}.asset-legacy-note summary{cursor:pointer}.asset-legacy-note p{white-space:pre-wrap;margin:5px 0}
`;
