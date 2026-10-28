export function assetOverviewGroups(rooms,items,records,mode){
 const itemIds=new Set(items.map(i=>i.id)),byRecord=new Map(records.filter(r=>itemIds.has(r.itemId)).map(r=>[r.roomId+'|'+r.itemId,r])),groups=new Map();
 const empty=()=>({quantity:0,normal:0,repair:0,unknown:0,unavailable:0});
 for(const room of rooms){
  const group=String(room.group||'').normalize('NFKC').replace(/\s+/g,''),company=group.match(/^([1-8])(?:중대)?$/)||((!group||group==='미분류')?String(room.room||'').match(/-([1-8])$/):null);
  const label=mode==='company'?(company?company[1]+'중대':group||'미분류'):room.building||'미분류';
  if(!groups.has(label))groups.set(label,{label,rooms:0,completed:0,...empty(),items:items.map(i=>({...empty(),id:i.id,name:i.name}))});
  const row=groups.get(label);row.rooms++;
  if(items.length&&items.every(i=>byRecord.get(room.id+'|'+i.id)?.confirmed))row.completed++;
  for(const item of row.items){const rec=byRecord.get(room.id+'|'+item.id);if(!rec)continue;
   const values={quantity:Number(rec.quantity)||0,normal:Number(rec.normal)||0,repair:Number(rec.repair)||0,unknown:Math.max(0,(Number(rec.quantity)||0)-(Number(rec.normal)||0)-(Number(rec.repair)||0)),unavailable:(rec.slots||[]).filter(s=>s.unavailable).length};
   for(const [key,value] of Object.entries(values)){row[key]+=value;item[key]+=value;}
  }
 }
 const building=['정예 본관','정예 동관','정예 서관','별관'];
 return [...groups.values()].sort((a,b)=>mode==='company'?a.label.localeCompare(b.label,'ko',{numeric:true}):(building.includes(a.label)?building.indexOf(a.label):100)-(building.includes(b.label)?building.indexOf(b.label):100)||a.label.localeCompare(b.label,'ko'));
}
export function assetOverviewJs(js){
 const start=js.indexOf(" $('assetKindRowsV244').innerHTML=items.length?items.map"),end=js.indexOf(" $('assetRoomCountV244')",start);
 if(start<0||end<0)throw Error('비품 집계 표 위치를 확인하세요.');
 js=js.slice(0,start)+' assetOverviewRenderV327();\n'+js.slice(end);
 js=js.replace('function assetInitV244(){',`function assetInitV244(){
 $('assetOverviewModeV327').addEventListener('change',assetOverviewRenderV327);
 $('assetKindRowsV244').addEventListener('click',e=>{const button=e.target.closest('[data-asset-overview-toggle]');if(!button)return;const detail=$('assetOverviewDetailV327_'+button.dataset.assetOverviewToggle);detail.hidden=!detail.hidden;button.setAttribute('aria-expanded',String(!detail.hidden));});`);
 const hook=js.lastIndexOf('})();');
 const extra=`
const assetOverviewGroupsV327=${assetOverviewGroups.toString()};
function assetOverviewRenderV327(){
 if(!assetDataV244)return;
 const mode=$('assetOverviewModeV327').value,rows=assetOverviewGroupsV327(assetRoomsFilteredV244(),assetDataV244.items,assetDataV244.records,mode);
 $('assetOverviewTitleV327').textContent=(mode==='company'?'중대별':'건물별')+' 비품 현황';
 $('assetOverviewGroupV327').textContent=mode==='company'?'중대':'건물';
 const counts=r=>'<td>'+r.quantity+'</td><td class="asset-good-text">'+r.normal+'</td><td class="asset-bad-text">'+r.repair+'</td><td>'+r.unknown+'</td><td>'+r.unavailable+'</td>';
 $('assetKindRowsV244').innerHTML=rows.map((r,i)=>'<tr><td><button type="button" class="btn btn-soft" data-asset-overview-toggle="'+i+'" aria-expanded="false" aria-controls="assetOverviewDetailV327_'+i+'">'+escapeH(r.label)+' · 품목 ▾</button></td><td>'+r.rooms+'</td>'+counts(r)+'<td>'+r.completed+' / '+r.rooms+'</td></tr><tr id="assetOverviewDetailV327_'+i+'" hidden><td colspan="8"><table class="asset-table"><thead><tr><th>품목</th><th>수량</th><th>정상</th><th>수리·교체</th><th>미점검</th><th>사용불가</th><th>관리</th></tr></thead><tbody>'+r.items.map(item=>'<tr><td>'+escapeH(item.name)+'</td>'+counts(item)+'<td>'+(canEdit?'<button type="button" class="btn btn-soft asset-owner" data-asset-hide="'+escapeH(item.id)+'">목록 삭제</button>':'—')+'</td></tr>').join('')+'</tbody></table></td></tr>').join('')||'<tr><td colspan="8">조회 결과 없음</td></tr>';
}
`;
 return js.slice(0,hook)+extra+js.slice(hook);
}
