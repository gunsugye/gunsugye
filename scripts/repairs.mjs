export function normalizeRepairText(text){
 return text.replaceAll('수리필요(보고 완료)','수리 필요(보고)').replaceAll('수리필요(미보고)','수리 필요(미보고)')
 .replaceAll("['정상','수리 필요(보고)','수리 필요(미보고)']","['정상','수리 필요(보고)','수리 필요(미보고)','교체 필요']")
 .replaceAll("['','정상','수리 필요(보고)','수리 필요(미보고)']","['','정상','수리 필요(보고)','수리 필요(미보고)','교체 필요']");
}
export function repairServer(source){
 source=normalizeRepairText(source);
 source=source.replace(/function canonicalRepairStateV216_\(value\)\{[\s\S]*?\n\}/,`function canonicalRepairStateV216_(value){
 const s=String(value==null?'':value).trim(),key=s.replace(/\\s+/g,'');
 if(['수리필요(보고)','수리필요(보고완료)'].includes(key))return '수리 필요(보고)';
 if(['수리필요','수리필요(미보고)'].includes(key))return '수리 필요(미보고)';
 if(key==='교체필요')return '교체 필요';
 return s;
}`);
 source=source.replace("return s==='수리 필요(보고)'||s==='수리 필요(미보고)';","return s==='수리 필요(보고)'||s==='수리 필요(미보고)'||s==='교체 필요';");
 source=source.replace("['','정상','수리 필요','교체 필요'].includes(status)","['',...REPAIR_STATES_V216].includes(status)")
 .replace("const status=text_(input?.status,20)","const status=canonicalRepairStateV216_(text_(input?.status,20))")
 .replace("if(r[7]&&ROOM_ASSET_STATUSES_V246.includes(r[7]))return r[7];","if(r[7]&&ROOM_ASSET_STATUSES_V246.includes(canonicalRepairStateV216_(r[7])))return canonicalRepairStateV216_(r[7]);")
 .replace("const status=String(raw.status||", "const status=canonicalRepairStateV216_(raw.status||")
 .replace("status=String(status||'');if(!ROOM_ASSET", "status=canonicalRepairStateV216_(status);if(!ROOM_ASSET")
 .replace("status:row[6]||''","status:canonicalRepairStateV216_(row[6])")
 .replace("if(!rosterSchemaReady_(roster))throw new Error('총기상태 열 업데이트 필요');","if(roster.getMaxColumns()<11)throw new Error('총기상태 열 업데이트 필요');");
 const point='  return {items,warnings,readAt:iso_(),canEdit:conf.canEdit};';
 const extra=`
  try{const sh=ss.getSheetByName(SABER_V276.TAB);if(sh&&sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,10).getDisplayValues().forEach(r=>{
   const status=canonicalRepairStateV216_(r[6]);if(isRepairStateV216_(status))items.push({type:'saber',category:'예도',itemName:'예도',itemId:'',name:r[4],company:r[2],location:r[3],status,note:r[7],count:1,sourceId:r[0],updatedAt:r[8]});
  });}catch(e){warnings.push('예도: '+e.message);}
  try{const data=ss.getSheetByName(ROOM_ASSET_V244.RECORDS);if(data){
   const catalog=new Map(assetV244Catalog_(ss.getSheetByName(ROOM_ASSET_V244.CATALOG)).map(x=>[x.id,x]));
   const rooms=new Map(assetV244Rooms_(ss).map(x=>[x.id,x]));
   assetV244Records_(data).forEach(r=>{if(!isRepairStateV216_(r.status)&&r.repair<=0&&!(r.slots||[]).some(s=>s.unavailable))return;
    const p=catalog.get(r.itemId),room=rooms.get(r.roomId);if(!p)return;
    const location=room?[room.building,room.floor,room.room].join(' / '):'호실 확인 필요';
    if(r.slots){r.slots.filter(s=>isRepairStateV216_(s.status)||s.unavailable).forEach(s=>items.push({type:'roomAsset',category:'생활실 비품',itemName:p.name,itemId:r.itemId,name:'',company:'',location:location+' / '+(s.position==='common'?'공용':s.position+'번'),status:s.unavailable&&!isRepairStateV216_(s.status)?'사용불가 · 상태 확인':s.status,note:(s.unavailable?'[사용불가] ':'')+(s.details||''),count:1,sourceId:r.roomId,updatedAt:r.updatedAt}));return;}
    items.push({type:'roomAsset',category:'생활실 비품',itemName:p.name,itemId:r.itemId,name:'',company:'',location,status:r.status==='정상'?'요수리 수량 · 상태 확인':r.status,note:r.details,count:r.repair,sourceId:r.roomId,updatedAt:r.updatedAt});
   });}}catch(e){warnings.push('생활실 비품: '+e.message);}
`;
 if(!source.includes(point))throw Error('수리 목록 반환 위치 확인 필요');
 return source.replace(point,extra+point);
}
export function repairHtml(html){
 html=normalizeRepairText(html);
 html=html.replaceAll('<option>수리 필요(미보고)</option>','<option>수리 필요(미보고)</option><option>교체 필요</option>')
 .replaceAll('정상 / 수리 필요(보고) / 수리 필요(미보고)</b>','정상 / 수리 필요(보고) / 수리 필요(미보고) / 교체 필요</b>');
 html=html.replaceAll('<option value="수리 필요(미보고)">수리 필요(미보고)</option>','<option value="수리 필요(미보고)">수리 필요(미보고)</option><option value="교체 필요">교체 필요</option>');
 return html.replace('<div id="repairStats"', '<section class="panel" style="overflow:auto"><h2>항목별 수리 · 교체 현황</h2><table class="repair-table"><thead><tr><th>구분</th><th>품목</th><th>기록 수</th><th>수리 필요(보고)</th><th>수리 필요(미보고)</th><th>교체 필요</th><th>보고 여부 미관리 · 확인 필요</th></tr></thead><tbody id="repairSummaryRows"></tbody></table></section><div id="repairStats"')
 .replace('<option value="equipment">','<option value="saber">예도</option><option value="roomAsset">생활실 비품</option><option value="equipment">')
 ;
}
export function repairJs(js){
 js=normalizeRepairText(js);
 js=js.replace('function server(method,...args){',`function repairResponseV310(value){
  if(Array.isArray(value))return value.map(repairResponseV310);
  if(value&&typeof value==='object'){for(const key of Object.keys(value)){
   if((key==='status'||key==='firearmStatus')&&typeof value[key]==='string'){
    const s=value[key].replace(/\\s+/g,'');
    if(['수리필요(보고완료)','수리필요(보고)'].includes(s))value[key]='수리 필요(보고)';
    else if(['수리필요','수리필요(미보고)'].includes(s))value[key]='수리 필요(미보고)';
    else if(s==='교체필요')value[key]='교체 필요';
   }else repairResponseV310(value[key]);
  }}return value;
 }
function server(method,...args){`).replace('else {resolve(value);','else {resolve(repairResponseV310(value));');
 js=js.replace("||status==='수리 필요';}","||status==='수리 필요'||status==='교체 필요';}")
 .replace("return status==='수리 필요(보고)'?'보고 완료':'미보고';","return status==='교체 필요'?'교체 필요':status==='수리 필요(보고)'?'보고':'미보고';");
 // 예도 선택기도 동일한 네 상태를 사용합니다.
 js=js.replace(/<option value="수리 필요" [\s\S]*?>수리 필요<\/option>/g,`<option value="수리 필요(보고)" '+(p.status==='수리 필요(보고)'?'selected':'')+'>수리 필요(보고)</option><option value="수리 필요(미보고)" '+(p.status==='수리 필요(미보고)'?'selected':'')+'>수리 필요(미보고)</option>`);
 const start="  $('repairStats').innerHTML=";
 const at=js.indexOf(start,js.indexOf('function renderRepairDashboard'));
 const summary=`  const groups=new Map();
  all.forEach(r=>{const key=r.category+' / '+r.itemName;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);});
  $('repairSummaryRows').innerHTML=[...groups.values()].map(list=>{const r=list[0],count=s=>list.filter(x=>x.status===s).length;return '<tr><td>'+escapeH(r.category)+'</td><td>'+escapeH(r.itemName)+'</td><td>'+list.length+'</td><td>'+count('수리 필요(보고)')+'</td><td>'+count('수리 필요(미보고)')+'</td><td>'+count('교체 필요')+'</td><td>'+list.filter(x=>!['수리 필요(보고)','수리 필요(미보고)','교체 필요'].includes(x.status)).length+'</td></tr>';}).join('')||'<tr><td colspan="7">수리 · 교체 필요 기록이 없습니다. 조회 오류가 있으면 아래 안내를 확인하세요.</td></tr>';
  rows.sort((a,b)=>(a.category+' / '+a.itemName).localeCompare(b.category+' / '+b.itemName,'ko'));
`;
 js=js.slice(0,at)+summary+js.slice(at);
 js=js.replace("unknown=r.type==='equipment';","unknown=r.type==='equipment'||r.type==='roomAsset';");
 js=js.replace("$('repairRows').innerHTML=rows.length?rows.map(r=>{","$('repairRows').innerHTML=rows.length?rows.map((r,index)=>{")
 .replace('return `<tr class="${attention?', 'return ((index===0||rows[index-1].category!==r.category||rows[index-1].itemName!==r.itemName)?\'<tr><th colspan="8" style="text-align:left;background:#eef4ff">\'+escapeH(r.category+\' · \'+r.itemName)+\'</th></tr>\':\'\')+`<tr class="${attention?');
 js=js.replace("  }else if(type==='supply'){","  }else if(type==='saber'||type==='roomAsset'){switchView(type);\n  }else if(type==='supply'){");
 return js;
}
