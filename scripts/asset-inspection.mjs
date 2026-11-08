export function assetInspectionModelV382(data,at){
 const norm=s=>String(s||'').normalize('NFKC').replace(/\s/g,''),state=(s,unavailable)=>unavailable?'사용불가':/교체/.test(s)?'교체필요':/수리/.test(s)?'수리필요':/정상|양호/.test(s)?'양호':s==='해당없음'?'해당없음':'미점검',rank=s=>({사용불가:5,교체필요:4,수리필요:3,미점검:2,미등록:2,양호:1,해당없음:0}[s]??2);
 const columns=[['신발장',['신발장']],['옷장',['옷장']],['침대',['침대','침대틀','침대서랍']],['책상',['책상']],['ABC서랍',['ABC서랍','3단서랍']],['서가',['서가']],['소파',['소파']],['냉장고',['냉장고']],['공기청정기',['공기청정기']],['거울',['거울']]];
 const companySort=(a,b)=>Number(String(a).match(/[1-8]/)?.[0]||99)-Number(String(b).match(/[1-8]/)?.[0]||99)||String(a).localeCompare(String(b),'ko');
 const companyName=value=>{const match=norm(value).match(/^([1-8])(?:중대)?$/);return match?match[1]+'중대':'';};
 const roomDisplay=value=>String(value||'').trim().replace(/-(?:[0-8]|[1-8]\s*중대|동|여)$/,'');
 const positionLabel=value=>/^[12]$/.test(String(value||''))?String(value)+'번':String(value||'')==='common'?'공용':String(value||'');
 const assignment=room=>{
  const hasRosterInfo=['assignedCount','assignedCompanies','companyCounts'].some(key=>Object.prototype.hasOwnProperty.call(room,key));
  const counts={};for(const [key,value] of Object.entries(room.companyCounts||{})){const company=companyName(key),count=Math.max(0,Number(value)||0);if(company&&count)counts[company]=(counts[company]||0)+count;}
  for(const value of room.assignedCompanies||[]){const company=companyName(value);if(company&&!Object.prototype.hasOwnProperty.call(counts,company))counts[company]=0;}
  const companies=Object.keys(counts).sort(companySort),knownCount=Object.values(counts).reduce((sum,count)=>sum+count,0);
  const assignedCount=hasRosterInfo?Math.max(0,Number(room.assignedCount)||knownCount):0,unknownCount=Math.max(0,assignedCount-knownCount);
  const occupiedSlots=Object.prototype.hasOwnProperty.call(room,'occupiedSlots')?Math.max(0,Number(room.occupiedSlots)||0):null;
  const capacity=Math.max(0,Number(room.capacity)||0),expected=String(room.group||''),duplicates=Math.max(0,Number(room.duplicateRosterEntries)||0),regular=/^[1-8]중대$/.test(expected),special=['전(대)대','동생명','여생도'].includes(expected),skipSpecialCheck=/^정예 (?:동관|서관)$/.test(String(room.building||''))&&(expected==='동생명'||expected==='전(대)대'||['동생명복도','전대복도'].includes(String(room.corridor||'')));
  const detail=[...companies.map(company=>company+' '+counts[company]+'명'),...(unknownCount?['중대 미확인 '+unknownCount+'명']:[])].join(' · ');
  const companyLabel=[...companies,...(unknownCount?['중대 미확인']:[])].join(' · ')||expected;
  let status='확인 전',note='배정명단 연결 전 자료';
  if(hasRosterInfo){
   if(duplicates){status='확인 필요';note='중복 명단 '+duplicates+'건 제외';}
   else if(skipSpecialCheck){status='확인 제외';note='동관·서관 동생명·전대복도 확인 제외';}
   else if(!assignedCount){status='배정 없음';note='현재 배정 인원 없음';}
   else if(occupiedSlots!==null&&occupiedSlots!==assignedCount){status='확인 필요';note='입실 체크 '+occupiedSlots+'명 · 배정명단 '+assignedCount+'명';}
   else if(regular&&companies.length===1&&companies[0]===expected&&!unknownCount){status='일치';note='설정 중대와 일치';}
   else if(regular){status='확인 필요';note='설정 '+expected+' · 실제 '+(detail||'중대 미확인');}
   else if(special){status='특수 배정';note='특수 배정 호실';}
   else {status='확인 필요';note='호실 구분 확인 필요';}
  }
  return {hasRosterInfo,counts,companies,knownCount,assignedCount,unknownCount,occupiedSlots,capacity,expected,duplicates,regular,special,skipSpecialCheck,detail,companyLabel,status,note};
 };
 const vacant=(data.rooms||[]).filter(r=>['미분류','공실','미분류공실'].includes(norm(r.group))),vacantIds=new Set(vacant.map(r=>String(r.id)));
 const index=new Map();for(const r of data.records||[]){if(vacantIds.has(String(r.roomId)))continue;const key=r.roomId+'|'+r.itemId;if(index.has(key))throw Error('동일 호실·품목의 중복 기록을 확인하세요.');index.set(key,r);}
 const raw=[['건물','층','호실','소속','품목','자리','기록 상태','사용불가','세부사항','수정시각','입력방식']],issues=[['건물','층','호실','소속','품목','자리','상태','세부사항','수정시각']],used=new Set(),rooms=[];
 for(const room of (data.rooms||[]).filter(r=>!vacantIds.has(String(r.id)))){
  const allocation=assignment(room),note=[];
  const items=(data.items||[]).filter(i=>i.active!==false).map(item=>{const key=room.id+'|'+item.id,r=index.get(key);if(r)used.add(key);let slots=[];
   if(r?.slots?.length)slots=r.slots.map((s,i)=>({status:state(s.status,s.unavailable),original:s.status||'',unavailable:!!s.unavailable,position:s.position||String(i+1),details:s.details||'',count:1}));
   else if(r){const quantity=Math.max(0,Number(r.quantity)||0),bad=Math.max(0,Number(r.repair)||0),good=Math.max(0,Number(r.normal)||0);if(quantity<bad+good)throw Error('정상·불량 수량이 전체 수량보다 큽니다: '+room.room+' '+item.name);
    if(!quantity&&r.confirmed)slots=[{status:'해당없음',original:r.status||'',position:'',count:0,details:r.details||''}];
    else for(let i=0;i<Math.max(quantity,1);i++)slots.push({status:i<bad?(rank(state(r.status))>2?state(r.status):'수리필요'):i<bad+good?'양호':r.confirmed?state(r.status):'미점검',original:r.status||'',position:'',details:i===0?r.details||'':'',count:1});
   }else slots=(item.positions?.length?item.positions:['']).map(position=>({position,status:'미점검',original:'',details:'',count:1}));
   for(const s of slots){
    const prefix=[room.building,room.floor,roomDisplay(room.room),allocation.companyLabel||'',item.name,positionLabel(s.position)];raw.push([...prefix,s.original||s.status,s.unavailable?'사용불가':'',s.details||'',r?.updatedAt||'',r?.slots?'자리별':r?'수량별':'미입력']);if(rank(s.status)>2)issues.push([...prefix,s.status,s.details||'',r?.updatedAt||'']);
    const originalDetails=String(s.details||'').trim(),keptDetails=originalDetails.split(/\r?\n/).filter(line=>!norm(line).includes('스탠드')).join('\n').trim();
    const details=keptDetails.replace(/^[12]\s*번\s*(?:(?:자리|좌석)(?=\s|[:：·-]|$)\s*[:：·-]?\s*|[:：·]\s*)/,'');
    if(!norm(item.name).includes('스탠드')&&!(norm(originalDetails).includes('스탠드')&&!keptDetails)&&(rank(s.status)>2||details))note.push(item.name+(/^[12]$/.test(String(s.position))?'('+s.position+'번)':'')+': '+(details||'세부내용 미입력'));
   }
   return {item,slots};});
  const all=items.flatMap(x=>x.slots),known=all.filter(s=>s.count&&s.status!=='미점검').length,normal=all.filter(s=>s.count&&s.status==='양호').length,bad=all.filter(s=>rank(s.status)>2).length,unknown=all.filter(s=>s.count&&s.status==='미점검').length;
  const cells=columns.map(([name,aliases])=>{const slots=items.filter(x=>aliases.map(norm).includes(norm(x.item.name))).flatMap(x=>x.slots);return slots.length?slots.reduce((a,s)=>rank(s.status)>rank(a)?s.status:a,'해당없음'):'미등록';});
  rooms.push({room,allocation,companyLabel:allocation.companyLabel,known,normal,bad,unknown,cells,note:[...new Set(note)].join('\n'),result:bad?'조치대상':unknown||!known?'미점검':'정상',issueLevel:bad?(all.some(s=>s.status==='교체필요'||s.status==='사용불가')?'replace':'repair'):'normal'});
 }
 const sum=(list,key)=>list.reduce((total,row)=>total+row[key],0),checked=rooms.filter(r=>r.known>0),stats={registered:rooms.length,checked:checked.length,known:sum(rooms,'known'),normal:sum(rooms,'normal'),bad:sum(rooms,'bad'),badRooms:rooms.filter(r=>r.bad>0).length,normalRooms:rooms.filter(r=>r.result==='정상').length,unknown:sum(rooms,'unknown'),vacantExcluded:vacant.length,assignedPeople:rooms.reduce((n,r)=>n+r.allocation.assignedCount,0),duplicateRosterEntries:rooms.reduce((n,r)=>n+r.allocation.duplicates,0),mixedCompanyRooms:rooms.filter(r=>r.allocation.companies.length>1).length,configMatched:rooms.filter(r=>r.allocation.status==='일치').length,configReview:rooms.filter(r=>r.allocation.status==='확인 필요').length,configExcluded:rooms.filter(r=>r.allocation.status==='확인 제외').length,unassignedRooms:rooms.filter(r=>r.allocation.status==='배정 없음').length};
 const rows=[['생활실 비품 상태 점검 및 관리 대시보드'],['정리일시: '+at+' · 저장된 기록 기준 · 점검일은 자리별 수정시각 참조'],['총 점검 호실','비품 정상(양호)율','조치 필요 총 비품','조치 대상 호실','정상 호실 수'],[stats.checked,stats.known?stats.normal/stats.known:0,stats.bad,stats.badRooms,stats.normalRooms],['등록 호실 '+stats.registered+'개실 · 미점검 비품 '+stats.unknown+'개 · 전체 등록 품목 기준'],['건물별 비품 점검 집계 현황'],['구분(건물)','배치 중대','점검 호실 수','조치 필요 비품','정상 호실 비율']];
 for(const building of [...new Set(rooms.map(r=>r.room.building))]){const group=rooms.filter(r=>r.room.building===building),count=group.filter(r=>r.known>0).length;rows.push([building,[...new Set(group.flatMap(r=>r.allocation.companies.length?r.allocation.companies:[r.room.group]).filter(Boolean))].sort(companySort).join(' · '),count,sum(group,'bad'),count?group.filter(r=>r.result==='정상').length/count:0]);}
 rows.push(['합계','전체',stats.checked,stats.bad,stats.checked?stats.normalRooms/stats.checked:0],[],['생활실별 비품 점검 현황표']);const header=rows.length,rowForRoom=(r,i)=>[i+1,roomDisplay(r.room.room),r.companyLabel||'',r.room.building,...r.cells,r.bad,r.result,r.note];rows.push(['NO','호실','소속 중대','소속 건물',...columns.map(c=>c[0]),'조치필요(건)','점검 결과','비고(수리·교체 세부내용)']);rooms.forEach((r,i)=>rows.push(rowForRoom(r,i)));
 const actionRooms=[rows[header].slice(),...rooms.filter(r=>r.bad>0).map(rowForRoom)];
 const orphan=[['호실ID','품목ID','기록(JSON)'],...[...index].filter(([key])=>!used.has(key)).map(([,r])=>[r.roomId,r.itemId,JSON.stringify(r)])];
 const criteria=[['구분','작성 기준'],['기준시각',at],['원본 보존','현재 업무일지의 생활실 비품 기록을 읽어 새 파일로 정리. 원본 시트에는 기록하지 않음.'],['양식','2026년 후반기 비품조사(양식) - 생활실 비품 점검표.pdf'],['건물·소속','현재 생활실현황의 건물과 배정명단의 실제 중대 사용. PDF 예시의 중대-건물 배치로 덮어쓰지 않음.'],['중대별 호실 배정','생성 시점의 생활실 배정명단으로 건물·중대별 호실 수와 인원을 계산. 혼합 호실은 참여 중대마다 표시하고 고유 합계에서는 한 번만 계산.'],['호실 구성 확인','일반 중대 호실은 설정 중대와 실제 배정 중대를 대조. 본관의 전(대)대·동생명·여생도는 특수 배정으로 구분. 동관·서관의 동생명·전대복도는 확인 대상에서 제외.'],['중복 제외','같은 기수·중대·이름은 겸직·중복 입력과 관계없이 한 번만 계산. 제외된 중복 '+stats.duplicateRosterEntries+'건.'],['공실 제외','소속이 공실·미분류인 호실을 공실로 간주. '+stats.vacantExcluded+'개실과 해당 기록을 모든 표·집계에서 제외.'],['침대','침대틀·침대서랍 기록을 통합 표시. 자리별 기록은 자리별원본 탭에 보존.'],['ABC서랍','3단서랍을 양식의 ABC서랍 열에 대응.'],['추가 품목','회전의자·선풍기 등 양식에 없는 품목도 집계·비고·불량상세·자리별원본에 포함. 스탠드 관련 내용은 비고에서 제외하며 실제 기록과 집계는 보존.'],['미점검','상태 미입력. 양호로 간주하지 않으며 양호율 분모에서 제외.'],['미등록','양식 열에 대응하는 비품이 원본 품목대장에 없음.'],['해당없음','수량 0·점검완료인 기존 수량 기록에만 적용.'],['대표 상태','사용불가 → 교체필요 → 수리필요 → 미점검 → 양호 순으로 표시. 세부 상태는 자리별원본 참조.'],['조치 필요(건)','자리별 불량 비품 수. 같은 품목 2개가 불량이면 2건. 추가 품목도 포함.'],['양호율','양호 비품 / 상태 입력 비품. 해당없음·미점검 제외.'],['정상 호실','등록된 전체 품목에 미점검·불량이 없는 호실. 미등록 양식 품목은 판정 제외.'],['기록 방식','현재 저장 시점의 정리본. 원본 변경이 자동 동기화되지는 않음.'],['미연결 기록',String(orphan.length-1)+'건. 원본검토 탭에 보존.']];
 const allocationMap=new Map(),buildingOrder=[...new Set(rooms.map(entry=>entry.room.building))];
 for(const entry of rooms){const companies=entry.allocation.companies.length?entry.allocation.companies:(entry.allocation.hasRosterInfo?['미배정']:/^[1-8]중대$/.test(entry.room.group)?[entry.room.group]:['미배정']);for(const company of companies){const key=entry.room.building+'|'+company;if(!allocationMap.has(key))allocationMap.set(key,{building:entry.room.building,company,rooms:new Map(),people:0,mixed:0});const row=allocationMap.get(key);row.rooms.set(String(entry.room.id),entry.room.floor+' '+roomDisplay(entry.room.room));row.people+=entry.allocation.counts[company]||0;if(entry.allocation.companies.length>1)row.mixed++;}}
 const allocationRows=[['건물','중대','배정 호실 수','배정 인원','혼합 호실 수','호실 목록','비고']];
 [...allocationMap.values()].sort((a,b)=>buildingOrder.indexOf(a.building)-buildingOrder.indexOf(b.building)||companySort(a.company,b.company)).forEach(row=>allocationRows.push([row.building,row.company,row.rooms.size,row.people,row.mixed,[...row.rooms.values()].join(' · '),row.mixed?'혼합 호실은 참여 중대에 각각 표시':'']));
 allocationRows.push(['전체(고유)','전체',rooms.length,stats.assignedPeople,stats.mixedCompanyRooms,'','호실·인원 중복 제거 합계']);
 const configurationRows=[['건물','층','복도','호실','설정 구분','실제 배정 중대','배정 인원','입실 체크','정원','구성 확인','확인 내용'],...rooms.map(entry=>[entry.room.building,entry.room.floor,entry.room.corridor||'',roomDisplay(entry.room.room),entry.room.group||'',entry.allocation.detail||'배정 없음',entry.allocation.assignedCount,entry.allocation.occupiedSlots===null?'':entry.allocation.occupiedSlots,entry.allocation.capacity||'',entry.allocation.status,entry.allocation.note])];
 return {stats,header,rooms,sheets:[{name:'생활실 비품 점검표',rows},{name:'불량상세',rows:issues},{name:'자리별원본',rows:raw},{name:'작성기준',rows:criteria},{name:'원본검토',rows:orphan},{name:'조치 필요 호실',header:0,width:17,rows:actionRooms},{name:'중대별 호실 배정',rows:allocationRows},{name:'호실 구성 확인',rows:configurationRows}]};
}
export function assetInspectionHtmlV382(html){return html.replace('<button class="btn" type="button" id="assetCsvV244">','<button class="btn" type="button" id="assetInspectionCreateV382">점검표 새 스프레드시트 만들기</button><button class="btn" type="button" id="assetCsvV244">').replace('<div id="assetSummaryV244"','<p id="assetInspectionStatusV382" role="status" aria-live="polite"></p><div id="assetSummaryV244"');}
export function assetInspectionJsV382(js,client){const end=js.lastIndexOf('})();');return js.slice(0,end)+'\n'+client+'\n'+js.slice(end);}
