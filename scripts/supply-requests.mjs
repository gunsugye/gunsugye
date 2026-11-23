import {insertAppClient} from './app-client.mjs';
export function supplyRequestsClientV506(source,client){
 source=source.replace("'세부사항','관리','위탁·휴학·퇴교'","'세부사항','관리'")
 .replace(/<td>\$\{canEdit\?`<select class="field supply-special-move-state-v256"[\s\S]*?:'조회 전용'\}<\/td>/,'')
 .replace('function supplySwitchPaneV256(mode){',"function supplySwitchPaneV256(mode){mode='regular';")
 .replace('function switchView(v){firearmsInitV410();',"function switchView(v){firearmsInitV410();if(view==='supplyRequests'&&v!==view){if(supplyRequestsBusyV506)return false;if($('supplyRequestsView').querySelector('[data-supply-review-edited]')&&!confirm('검토 중인 변경을 지우고 이동할까요?'))return false;}");
 source=source.replace('const NAV_BUILTIN_V233=[',"const NAV_BUILTIN_V233=['supplyRequests',")
 .replace("items:['supply'","items:['supplyRequests','supply'")
 .replace('const viewNames={',"const viewNames={supplyRequests:['SUPPLY REQUESTS & SURVEYS','군수품 수정 요청·전수조사','개인별 수정 요청과 전수조사 응답을 관리합니다.'],")
 .replace(".concat('firearms','firearmRequests').forEach",".concat('firearms','firearmRequests','supplyRequests').forEach")
 .replace("if(v==='firearmRequests')firearmRequestsLoadV413();","if(v==='supplyRequests')supplyRequestsLoadV506();if(v==='firearmRequests')firearmRequestsLoadV413();")
 .replace('window.logbookReloadState=()=>({busy:!!(','window.logbookReloadState=()=>({busy:!!(supplyRequestsBusyV506||');
 return insertAppClient(source,client);
}
export function supplyRequestsServerV506(source,server){
 source=source.replace('const NAV_FIXED_V233=[',"const NAV_FIXED_V233=['supplyRequests',")
 .replace("items:['supply'","items:['supplyRequests','supply'")
 .replace('function accessGuardV284_(name,args){',"function accessGuardV284_(name,args){if(['getSupplyRequestsV506','resolveSupplyRequestsV506','setSupplySurveyV506','getSupplyInboxV542','processSupplyInboxV542'].includes(name)){referenceAdminV409_();return accessPolicyV284_();}");
 source=source.replace(/ if\(section!=='uniform'\)try\{for\(const item of supplyRegistryItems_\(ss\)\)\{[^\n]+/,
 " if(section!=='uniform')try{const history=supplyRequestRowsV506_(ss,person.id);for(const item of supplyRegistryItems_(ss))try{result.supplies.push(personalSupplyDTOv506_(ss,person,item,history));}catch(error){warnings.push(item.name+' 조회 실패: '+error.message);}}catch(_){warnings.push('군수품 조회 실패');}");
 return source+'\n'+server;
}
export function personalSupplyPortalV506(source,client){
 const start=source.indexOf('function renderSuppliesV335('),end=source.indexOf('\nfunction ',start+10);if(start<0||end<0)throw Error('개인 군수품 렌더 위치 확인');
 source=source.slice(0,start)+client+'\n'+source.slice(end);
 source=source.replaceAll("'duty-request','firearm-request'","'duty-request','firearm-request','supply-request'")
 .replaceAll('dirty||uniformDirtyV350','personalSupplyDirtyV506||dirty||uniformDirtyV350')
 .replace("function clear(message=''){","function clear(message=''){personalSupplyResetV507();")
 .replace("path==='uniform-request'?'uniform'", "path==='supply-request'?'supplies':path==='uniform-request'?'uniform'")
 .replace('function personalSaveDoneV425(path){','function personalSaveDoneV425(path){if(path===\'supply-request\')return;');
 return source;
}
export const supplyRequestsHtmlV506=`<section id="supplyRequestsView" class="hidden"><div class="panel"><div class="panel-head"><h2>군수품 수정 요청·전수조사</h2><button class="btn" id="supplyRequestsReloadV506">새로고침</button></div><p id="supplyRequestsStatusV506" role="status"></p><div id="supplyRequestsMetricsV506" class="roster-metrics"></div><div id="supplyInboxV542" role="status">별도 접수 시트 확인 중…</div><details><summary>전수조사 설정</summary><p>개인 앱 입력은 별도 접수 시트에 먼저 저장하고 원본 기록에는 순차 반영합니다. 변경 없는 확인도 응답으로 기록합니다.</p><form id="supplySurveyFormV506" class="supply-actions"><label>조사 제목<input class="field" name="label" required maxlength="100" value="군수품 전수조사"></label><label>종료 일시<input class="field" name="endsAt" type="datetime-local" required></label><button class="btn btn-primary" type="submit">전수조사 시작</button><button class="btn" type="button" id="supplySurveyStopV506">조사 종료</button></form><p id="supplySurveyPolicyV506"></p></details></div><div class="panel"><h2>수정 요청</h2><div class="supply-actions"><select class="field" id="supplyRequestsFilterV506"><option>대기</option><option>전체</option></select><input class="field" id="supplyRequestsSearchV506" type="search" placeholder="이름·중대·품목 검색"></div><div class="supply-bulk-v522"><label><input type="checkbox" id="supplySelectAllV522"> 화면에 보이는 요청 전체 선택</label><span id="supplySelectedCountV522">0건 선택</span><button type="button" class="btn btn-primary" id="supplyBulkApplyV522">일괄 적용</button><button type="button" class="btn" id="supplyBulkDeleteV522">일괄 삭제</button></div><div id="supplyRequestsListV506"></div></div><div class="panel"><h2>전수조사 응답</h2><select class="field" id="supplySurveyCampaignV506" aria-label="조사 선택"></select><div class="roster-wrap"><table class="roster-table"><thead><tr><th>응답시각</th><th>기수</th><th>중대</th><th>이름</th><th>품목</th><th>응답</th><th>구분</th></tr></thead><tbody id="supplySurveyRowsV506"></tbody></table></div><details><summary>미응답 품목 확인</summary><div id="supplySurveyMissingV506"></div></details></div></section>`;
