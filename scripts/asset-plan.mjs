export function assetRoomHealth(items,records){
 const issues=[];let unknown=0;
 for(const item of items){const rec=records.find(r=>r.itemId===item.id);if(!rec){unknown++;continue;}
  if(rec.slots){for(const slot of rec.slots){const status=String(slot.status||''),level=slot.unavailable||status==='교체 필요'?'red':/수리/.test(status)?'orange':null;if(level)issues.push({itemId:item.id,name:item.name,position:slot.position,level,label:slot.unavailable?'사용불가':status});if(!status)unknown++;}}
  else{const status=String(rec.status||''),level=status==='교체 필요'?'red':/수리/.test(status)||Number(rec.repair)>0?'orange':null;if(level)issues.push({itemId:item.id,name:item.name,position:'',level,label:status||'수리 필요'});if(!rec.confirmed)unknown++;}
 }
 const level=issues.some(i=>i.level==='red')?'red':issues.length?'orange':unknown||!items.length?'unknown':'blue';
 return {level,issues,unknown,label:level==='red'?'교체·사용불가':level==='orange'?'수리 필요':level==='unknown'?'미점검':'정상'};
}
export function assetPlanBands(rooms,layout){
 const groups=[],used=new Set(),key=r=>[r.building,r.floor,String(r.room||'').split('-')[0]].join('|');
 for(const anchor of [...(layout||[])].sort((a,b)=>a.page-b.page||a.y-b.y||a.x-b.x)){
  let matches=anchor.roomId?rooms.filter(r=>String(r.id)===String(anchor.roomId)&&r.building===anchor.building&&r.floor===anchor.floor):[];
  if(matches.length!==1)matches=rooms.filter(r=>key(r)===key(anchor));
  if(matches.length!==1||used.has(matches[0].id))continue;const room=matches[0];used.add(room.id);
  let group=groups.find(g=>g.building===room.building&&g.floor===room.floor&&g.page===anchor.page&&Math.abs(g.y-anchor.y)<.035);
  if(!group){group={building:room.building,floor:room.floor,page:anchor.page,y:anchor.y,rooms:[]};groups.push(group);}group.rooms.push({...room,planX:anchor.x});
 }
 for(const room of rooms.filter(r=>!used.has(r.id)).sort((a,b)=>String(a.room).localeCompare(String(b.room),'ko',{numeric:true}))){let group=groups.find(g=>g.unplaced&&g.building===room.building&&g.floor===room.floor&&g.corridor===(room.corridor||''));if(!group){group={building:room.building,floor:room.floor,corridor:room.corridor||'',unplaced:true,rooms:[]};groups.push(group);}group.rooms.push(room);}
 for(const group of groups)if(!group.unplaced)group.rooms.sort((a,b)=>a.planX-b.planX);
 return groups;
}
function assetPlanLayoutV332_(rooms){try{const plan=dormPlanDataV315_();return {layout:dormPlanBindLayoutV321_(plan.layout||[],rooms).map(r=>({building:r.building,floor:r.floor,room:r.room,roomId:r.roomId,page:r.page,x:r.x,y:r.y}))};}catch(_){return {layout:[],layoutWarning:'저장 배치 조회 실패 · 호실 순서로 표시'};}}
export function assetPlanServer(source){const marker='return {initialized:!!catalog&&!!data,rooms:assetV244Rooms_(ss),';if(!source.includes(marker))throw Error('비품 배치도 서버 연결 위치 확인');return source.replace(marker,'const rooms=assetV244Rooms_(ss);return {...assetPlanLayoutV332_(rooms),initialized:!!catalog&&!!data,rooms,')+'\n'+assetPlanLayoutV332_.toString();}
export function assetPlanHtml(html){return html.replace('<div id="assetRoomRowsV244"></div>','<div class="asset-plan-legend"><span class="asset-plan-blue">정상</span><span class="asset-plan-orange">수리</span><span class="asset-plan-red">교체·사용불가</span><span class="asset-plan-unknown">미점검</span></div><p id="assetPlanWarningV332" class="panel-sub"></p><div id="assetPlanV332"></div><details class="asset-plan-table"><summary>호실 표 보기</summary><div id="assetRoomRowsV244"></div></details>').replace('관·중대·조직별 호실 점검 현황','생활실 비품 배치도').replace('관 또는 중대·조직을 펼쳐 호실의 <b>점검 / 수정</b>을 누르면 바로 아래에 비품 세부항목이 열립니다. 공실도 점검할 수 있습니다.','방 색상으로 상태 확인 · 문제 품목을 누르면 해당 자리로 이동');}
export function assetPlanJs(js){js=js.replace('function assetInitV244(){',`function assetInitV244(){
 $('assetPlanV332').addEventListener('click',e=>{const b=e.target.closest('[data-asset-plan-room]');if(b)assetPlanJumpV332(b.dataset.assetPlanRoom,b.dataset.assetPlanItem||'',b.dataset.assetPlanPosition||'');});`);
 js=js.replace("$('assetRoomCountV244').textContent=rooms.length+'개 호실';","$('assetRoomCountV244').textContent=rooms.length+'개 호실';assetPlanRenderV332();");
 const hook=js.lastIndexOf('})();');return js.slice(0,hook)+`
const assetRoomHealthV332=${assetRoomHealth.toString()};
const assetPlanBandsV332=${assetPlanBands.toString()};
function assetPlanRenderV332(){
 const root=$('assetPlanV332'),open=new Set(qsa('details[open][data-asset-plan-building]',root).map(d=>d.dataset.assetPlanBuilding)),rooms=assetRoomsFilteredV244(),bands=assetPlanBandsV332(rooms,assetDataV244.layout),buildings=[...new Set(bands.map(g=>g.building))];
 $('assetPlanWarningV332').textContent=assetDataV244.layoutWarning||'';
 root.innerHTML=buildings.map(building=>'<details class="asset-group" data-asset-plan-building="'+escapeH(building)+'" '+(open.has(building)?'open':'')+'><summary>'+escapeH(building)+'</summary>'+bands.filter(g=>g.building===building).map((band,i)=>'<section class="asset-plan-band"><h3>'+escapeH(band.floor)+(band.unplaced?' · '+escapeH(band.corridor||'추가 호실'):' · 배치 '+(i+1))+'</h3><div class="asset-plan-scroll"><div class="asset-plan-row">'+band.rooms.map(room=>{
 const health=assetRoomHealthV332(assetDataV244.items,assetDataV244.records.filter(r=>r.roomId===room.id));
 return '<article class="asset-plan-card asset-plan-'+health.level+'"><button type="button" class="asset-plan-room" data-asset-plan-room="'+escapeH(room.id)+'" aria-label="'+escapeH(room.room+'호 · '+health.label)+'"><strong>'+escapeH(room.room)+'호</strong><span>'+health.label+'</span></button><div class="asset-plan-issues">'+health.issues.map(issue=>'<button type="button" class="asset-plan-issue asset-plan-'+issue.level+'" data-asset-plan-room="'+escapeH(room.id)+'" data-asset-plan-item="'+escapeH(issue.itemId)+'" data-asset-plan-position="'+escapeH(issue.position)+'">'+escapeH(issue.name+(issue.position?' · '+(issue.position==='common'?'공용':issue.position+'번'):''))+'<small>'+escapeH(issue.label)+'</small></button>').join('')+(health.unknown?'<small class="asset-plan-pending">미점검 '+health.unknown+'</small>':'')+'</div></article>';
 }).join('')+'</div></div></section>').join('')+'</details>').join('')||'<p class="asset-tip">조회 결과 없음</p>';
}
function assetPlanJumpV332(roomId,itemId,position){
 if(assetCurrentRoomV244!==roomId)assetOpenRoomV244(roomId);
 if(assetCurrentRoomV244!==roomId)return;
 const editor=$('assetRoomEditorV244');let parent=editor.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}
 const row=qsa('[data-asset-item]',$('assetEditRowsV244')).find(r=>r.dataset.assetItem===itemId),seat=row&&qsa('[data-asset-position]',row).find(r=>r.dataset.assetPosition===position),target=seat||row||editor;
 qsa('.asset-plan-target').forEach(el=>el.classList.remove('asset-plan-target'));target.classList.add('asset-plan-target');target.scrollIntoView({behavior:'smooth',block:'center'});const control=target.querySelector('select:not(:disabled),textarea:not(:disabled)');if(control)control.focus({preventScroll:true});else{target.tabIndex=-1;target.focus({preventScroll:true});}
}
`+js.slice(hook);}
export const assetPlanCSS=`
.asset-plan-card.personal-room-plan{width:100%;padding:14px;display:grid;gap:8px;margin-bottom:14px}.personal-room-plan>strong{font-size:15px}.personal-room-plan .asset-plan-issue{text-align:left;width:100%;font-size:13px}
.asset-plan-legend{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.asset-plan-legend span{padding:5px 9px;border:1px solid;border-radius:6px;font-size:12px}.asset-plan-blue{--plan-color:#1e60ac;--plan-bg:#edf5ff;--plan-border:#81afe2}.asset-plan-orange{--plan-color:#a44b05;--plan-bg:#fff4e6;--plan-border:#efab62}.asset-plan-red{--plan-color:#b12e36;--plan-bg:#fff0f1;--plan-border:#e48c95}.asset-plan-unknown{--plan-color:#586b80;--plan-bg:#f2f5f8;--plan-border:#b5c1ce}.asset-plan-legend span,.asset-plan-card,.asset-plan-issue{color:var(--plan-color);background:var(--plan-bg);border-color:var(--plan-border)}.asset-plan-band{padding:10px 14px}.asset-plan-band h3{font-size:13px;margin:8px 0}.asset-plan-scroll{overflow-x:auto;padding:3px 3px 12px}.asset-plan-row{display:flex;flex-wrap:nowrap;gap:8px;align-items:stretch;width:max-content;min-width:100%}.asset-plan-card{flex:0 0 154px;width:154px;border:1px solid var(--plan-border);border-radius:10px;overflow:hidden}.asset-plan-room{display:grid;gap:6px;width:100%;padding:12px;border:0;border-bottom:1px solid var(--plan-border);background:transparent;color:inherit;cursor:pointer;min-height:70px}.asset-plan-room strong{font-size:16px}.asset-plan-room span{font-size:12px}.asset-plan-issues{display:grid;gap:5px;padding:8px}.asset-plan-issue{font:inherit;font-size:12px;text-align:left;border:1px solid var(--plan-border);border-radius:6px;padding:8px;cursor:pointer;overflow-wrap:anywhere;min-height:44px}.asset-plan-issue small{display:block;margin-top:4px}.asset-plan-pending{font-size:11px;color:#586b80}.asset-plan-target{outline:3px solid #296ed1;outline-offset:3px;scroll-margin:100px}.asset-plan-room:focus-visible,.asset-plan-issue:focus-visible{outline:3px solid #244f91;outline-offset:-3px}.asset-plan-table{margin-top:16px}.asset-plan-table>summary{cursor:pointer;padding:12px;font-weight:700}
`;
