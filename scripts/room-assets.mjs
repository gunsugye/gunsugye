function replaceFunction(source,name,replacement){
 const pattern=new RegExp('function '+name+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}');
 if(!pattern.test(source))throw Error('비품 함수 위치 확인: '+name);
 return source.replace(pattern,()=>replacement);
}
export function roomAssetServer(source,server){
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
 source=source.replace('function bulkSetDormInventoryScopeV246(roomIds,itemId,status,quantity,details,includeMissing,expectedRecords){',`function bulkSetDormInventoryScopeV246(roomIds,itemId,status,quantity,details,includeMissing,expectedRecords){
 throw Error('자리별 상태를 보존하기 위해 호실 점검 화면에서 1번·2번 또는 공용품목을 수정해 주세요.');`);
 return source;
}
export function roomAssetHtml(html){
 return html.replace('<table class="asset-table asset-editor"><thead><tr><th>품목</th><th>전체</th><th>정상</th><th>요수리</th><th>상태</th><th>세부사항</th><th>저장</th></tr>', '<table class="asset-table asset-editor"><thead><tr><th>품목</th><th>자리별 · 공용 점검</th><th>저장</th></tr>')
 .replace('품목별 수량·상태·세부사항을 기록합니다. 2개 중 1개만 고장인 경우처럼 정상·요수리 수량을 각각 수정할 수 있습니다. 상태를 바꾸면 수량 전체에 해당 상태가 우선 적용됩니다.','1번·2번 자리를 각각 점검하고 냉장고·공기청정기는 공용으로 기록합니다. 사용불가는 상태와 별도로 체크합니다.')
 .replaceAll('기본 비품 13종','기본 비품 12종');
}
export function roomAssetJs(js,client){
 for(const name of ['assetEditorSnapshotV244','assetOpenRoomV244','assetRowFromFormV244','assetRefreshEditStateV244']){
  const pattern=new RegExp('function '+name+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}');
  const body=client.match(pattern);if(!body)throw Error('비품 클라이언트 함수 누락 '+name);
  js=replaceFunction(js,name,body[0]);
 }
 js=js.replace("if(rec.status==='정상')return", "if(rec.status==='교체 필요')return {label:rec.status,cls:'repair',unknown:0};\n if(rec.status==='정상')return")
 ;
 // 기존 일괄 수량 컨트롤은 자리별 기록을 덮어쓰지 않도록 감춥니다.
 js=js.replace('function assetInitV244(){',`function assetInitV244(){
 $('assetBulkApplyV246').closest('.asset-bulk-options')?.classList.add('asset-legacy-bulk-v311');`);
 return js.replaceAll('비품 13종','비품 12종');
}
export const roomAssetCSS=`
.asset-legacy-bulk-v311{display:none!important}.asset-seat-grid{display:grid;grid-template-columns:repeat(2,minmax(240px,1fr));gap:12px}.asset-seat-card{padding:12px;border:1px solid #d5deec;border-radius:8px;background:#fafcff}.asset-seat-card label{display:block;margin:8px 0}.asset-seat-card textarea,.asset-seat-card select{width:100%;box-sizing:border-box}.asset-seat-card .asset-unavailable{display:flex;align-items:center;gap:8px}.asset-legacy-note{color:#8a5a00;white-space:pre-wrap}.asset-editor{min-width:780px}
`;
