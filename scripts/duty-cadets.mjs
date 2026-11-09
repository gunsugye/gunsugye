import {dutyFixedRolesV391,dutyFixedRoleValidV391,dutySplitAssignmentsV391} from './duty-assignments.mjs';
import {dutyRoleInfoV367} from './duty-roles.mjs';
export function dormPdfDutyRegionV365(tokens,boxes,sourceRoom){
 tokens=tokens.map(t=>({...t}));for(const t of tokens)if(/^\d{3}-$/.test(t.str)){const next=tokens.find(n=>/^[1-8동생명여女]$/.test(n.str)&&Math.abs(n.y-t.y)<2&&Math.abs(n.x-t.x-t.width)<6);if(next){t.str+=next.str.replace('女','여');t.width=next.x+next.width-t.x;}}
 const anchors=tokens.flatMap(t=>[...t.str.matchAll(/(?:^|\s)(\d{3}(?:-[1-8동생명여])?)(?=\s|$)/g)].map(m=>({...t,str:m[1],x:t.x+t.width*(m.index+m[0].indexOf(m[1]))/t.str.length,width:t.width*m[1].length/t.str.length}))).filter(t=>t.y>45);
 let matches=anchors.filter(a=>a.str===sourceRoom);if(!matches.length)matches=anchors.filter(a=>a.str.split('-')[0]===String(sourceRoom).split('-')[0]);if(matches.length!==1)return null;const a=matches[0];
 let box=boxes.filter(b=>b.height>50&&a.x+a.width/2>b.x&&a.x+a.width/2<b.x+b.width&&a.y>b.y&&a.y<b.y+25).sort((a,b)=>a.width*a.height-b.width*b.height)[0];
 if(!box){const header=boxes.filter(b=>b.height<26&&a.x+a.width/2>b.x&&a.x+a.width/2<b.x+b.width&&a.y>b.y&&a.y<b.y+b.height+1).sort((a,b)=>a.width-b.width)[0];if(header){let bottom=header.y+header.height;for(let i=0;i<2;i++){const body=boxes.filter(b=>b.height>25&&Math.abs(b.x-header.x)<1&&Math.abs(b.width-header.width)<1&&Math.abs(b.y-bottom)<1).sort((a,b)=>b.height-a.height)[0];if(!body)break;bottom=body.y+body.height;}if(bottom>header.y+40&&bottom-header.y<160)box={...header,height:bottom-header.y};}}
 return box?tokens.filter(t=>t.x>=box.x&&t.x<box.x+box.width&&t.y>a.y+5&&t.y<box.y+box.height):null;
}
export function dutyCadetRowsV365(parsed,rooms){
 const norm=v=>String(v||'').normalize('NFKC').replace(/\s/g,'').replace(/(?:기|중대)$/,'');
 const all=rooms.flatMap(room=>(room.members||[]).map(person=>({person,room}))),rows=[],seen=new Set();
 for(const entry of parsed)for(const mark of entry.people.filter(p=>p.isDuty)){
  const source=entry.anchor,old=(source.pdfMembers||[]).find(p=>norm(p.name)===norm(mark.name));
  const suitable=all.filter(({person})=>norm(person.name)===norm(mark.name)&&(!old?.cohort||norm(person.cohort)===norm(old.cohort))&&(!old?.company||norm(person.company)===norm(old.company)));
  const local=suitable.filter(({room})=>source.roomId?room.id===source.roomId:room.building===source.building&&room.floor===source.floor&&room.room.split('-')[0]===source.room.split('-')[0]);
  const match=local.length===1?local[0]:suitable.length===1?suitable[0]:null,person=match?.person||old||{},room=match?.room||source;
  const key=[source.page,source.building,source.floor,source.sourceRoom||source.room,mark.name,mark.duty].join('|');if(seen.has(key))continue;seen.add(key);
  rows.push({sourceKey:key,cohort:norm(person.cohort),company:norm(person.company),name:match?.person.name||mark.name,duty:mark.duty||'직책 미표기',building:room.building,floor:room.floor,room:room.room,page:source.page,review:mark.dutyReview?'괄호 확인 필요':match?'현재 배정':'배정명단 확인 필요'});
 }
 return rows.sort((a,b)=>a.building.localeCompare(b.building,'ko')||a.floor.localeCompare(b.floor,'ko')||a.room.localeCompare(b.room,'ko',{numeric:true})||a.name.localeCompare(b.name,'ko'));
}
export function dutyRoleChoicesV391(group,current){const roles=dutyFixedRolesV391(group);return {fixed:roles.length>0,roles:roles.length&&current&&!roles.includes(current)&&dutyFixedRoleValidV391({organization:group,duty:current})?[...roles,current]:roles};}
export function dutyPersonCountV391(rows){const norm=v=>String(v||'').normalize('NFKC').replace(/\s/g,'');return new Set(rows.map(p=>[norm(p.cohort).replace(/(?:기)+$/,''),norm(p.company).replace(/(?:중대)+$/,''),norm(p.name)].join('|'))).size;}
export function dutyAdditionalRowV391(row){const info=dutyRoleInfoV367(row),person=Object.fromEntries(['name','cohort','company','building','floor','room','gradeOverride'].filter(key=>row[key]!=null).map(key=>[key,row[key]]));return {...person,organization:info.organization,dutyCompanyOverride:info.organization==='중대'?String(info.company||''):row.dutyCompanyOverride||'',duty:'',familyOverride:'',saberRoleOverride:'auto'};}
export function dutyCandidateRowsV391(rows){return rows.flatMap(row=>dutySplitAssignmentsV391(row.duty).map(duty=>({...row,duty})));}
export function dutyCadetsNavSource(source){source=source.replace("{id:'devices',title:'장비',items:['roster','saber','repairs']}","{id:'devices',title:'총기/군수품/장비',items:['roster','dutyCadets','saber','repairs']}");return source.match(/const NAV_FIXED_V233=\[([^\]]*)\]/)?.[1].includes("'dutyCadets'")?source:source.replace('const NAV_FIXED_V233=[',"const NAV_FIXED_V233=['dutyCadets',");}
export function dutyCadetsJs(js,client){
 js=dutyCadetsNavSource(js).replace('const NAV_BUILTIN_V233=[',"const NAV_BUILTIN_V233=['dutyCadets',").replace('const viewNames={',"const viewNames={dutyCadets:['DUTY CADET ROSTER','근무생도 명단','직접 등록한 근무생도 명단을 관리합니다.'],")
 .replace('function navInitV220(){',`function navInitV220(){const dutyButton=document.createElement('button');dutyButton.type='button';dutyButton.className='nav-btn';dutyButton.dataset.view='dutyCadets';dutyButton.textContent='근무생도 명단';$('sidebarMenu').appendChild(dutyButton);`)
 .replace("'personalInterface','uniformRequests','assetRequests','departures','today'","'dutyCadets','personalInterface','uniformRequests','assetRequests','departures','today'")
 .replace("v==='personalInterface'||v==='uniformRequests'","v==='dutyCadets'||v==='personalInterface'||v==='uniformRequests'")
 .replace("if(v==='personalInterface')personalInterfaceLoadV359();","if(v==='personalInterface')personalInterfaceLoadV359();if(v==='dutyCadets')dutyCadetsLoadV365();")
 .replace("if(id==='access'&&!canManageUsersV281)return;","if(id==='dutyCadets'&&(!canEdit||v284Scoped))return;if(id==='access'&&!canManageUsersV281)return;");
 js=js.replace("let r=await server('getSaberV276');", "if(canEdit&&!v284Scoped&&!dutyCadetsMetaV365)await dutyCadetsLoadV365();let r=await server('getSaberV276');")
 .replace("escapeH(p.role)+'</td><td><select", "escapeH(p.role)+((p.linkedCadets||[]).length?'<small style=\"display:block\">'+escapeH((p.linkedCadets.length>1?'중복 확인 · ':'')+p.linkedCadets.map(x=>[x.cohort?x.cohort+'기':'',x.company?x.company+'중대':'',x.name].filter(Boolean).join(' ')).join(', '))+'</small>':'')+'</td><td><select");
 js=js.replace('trainSharedModeV289=[',"if((dutyVerifyBusyV371||dutyMoveBusyV372)&&v!==view)return false;trainSharedModeV289=[");
 const end=js.lastIndexOf('})();');return js.slice(0,end)+'\n'+dormPdfDutyRegionV365.toString()+'\n'+dutyCadetRowsV365.toString()+'\n'+dutyRoleChoicesV391.toString()+'\n'+dutyPersonCountV391.toString()+'\n'+dutyAdditionalRowV391.toString()+'\n'+dutyCandidateRowsV391.toString()+'\n'+client+'\n'+js.slice(end);
}
export function dutyCadetsHtml(html){return html.replace('</main>',`<section id="dutyCadetsView" class="hidden"><div class="panel"><div class="panel-head"><div><h2 class="panel-title">근무생도 명단</h2><p class="panel-sub">PDF 1차 · 붙여넣기 2차 · 스마트당직 대조 · 최종 수정</p></div><div class="asset-actions"><button class="btn" type="button" id="dutyCadetsAddV365">인원 추가</button><button class="btn" type="button" id="dutyCadetsReloadV365">새로고침</button></div></div><div class="asset-actions"><select id="dutyCadetsBuildingV365" class="field" aria-label="근무생도 관"><option value="">전체 관</option></select><input id="dutyCadetsSearchV365" class="field" type="search" placeholder="이름 · 중대 · 근무 · 호실" aria-label="근무생도 검색"></div><p id="dutyCadetsStatusV365" class="panel-sub" role="status" aria-live="polite"></p><div id="dutyCadetsRowsV365"></div></div></section></main>`);}
