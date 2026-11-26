import {surveyServerV416,surveyClientV416} from './survey-periods.mjs';
import {supplyOverview,supplyOverviewPeople,supplyItemSpecialPeople} from './supply-overview.mjs';
import {supplyStatusDisplay} from './supply-status-display.mjs';
import {surveyHistoryClientV528,surveyHistoryHtmlV528} from './survey-history.mjs';
import {rosterGunAuditClientV417} from './roster-firearm-audit.mjs';
import {personGroupsClientV424} from './person-groups.mjs';
import {managedDeleteClientV426,managedDeleteServerV426} from './managed-delete.mjs';
import {firearmRequestSourceV413,firearmRequestClientV413,firearmRequestsHtmlV413} from './firearm-requests.mjs';
import * as rosterLinkageV412 from './roster-linkage.mjs';
import {linkageSourceV412,linkageClientV412} from './roster-linkage-integration.mjs';
import { firearmSourceV410, firearmClientV410 } from './firearms.mjs';
import {conditionTextV497,conditionServerV497} from './condition-states.mjs';
import {quantityColorsClientV502} from './quantity-colors.mjs';
import {supplyRequestsClientV506,supplyRequestsServerV506,supplyRequestsHtmlV506} from './supply-requests.mjs';
import {saberGroupsClientV498,saberGroupsHtmlV498} from './saber-groups.mjs';
import {supplyQuantityOrderClientV500,supplyQuantityOrderServerV500} from './supply-quantity-order.mjs';
import {armoryClientV493,armoryServerV493} from './armory.mjs';
import { referenceMenuV409, referenceBatchClientV409 } from './reference-batch.mjs';
import { supplySchemaClientV408, supplySchemaServerV408 } from './supply-schema.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { updateJournalJs, updateJournalHtml, journalCSS } from './journal.mjs';
import { normalizeNavigation, updateNavigationJs, updateNavigationHtml } from './navigation.mjs';
import { updateCalendarJs, calendarCSS } from './calendar.mjs';
import { updateDeparturesJs, updateDeparturesHtml, departuresCSS } from './departures.mjs';
import { requestPerformanceCode } from './performance.mjs';
import { releaseDetails } from './release.mjs';
import { updateHistoryJs } from './update-history.mjs';
import { finalizeRelease } from './finalize-release.mjs';
import { dutyPersonEditorJsV398 } from './duty-person-editor.mjs';
import { personalDutyCSSV400 } from './personal-duty.mjs';
import {buildPersonal} from './build-personal.mjs';
import {dutyRequestsJsV400,dutyRequestsHtmlV400,dutyRequestsNavSourceV400} from './duty-requests.mjs';
import {developmentNavSource,developmentRequestsJs,developmentRequestsHtml,developmentRequestsCSS} from './development-requests.mjs';
import {assetInspectionModelV382,assetInspectionHtmlV382,assetInspectionJsV382} from './asset-inspection.mjs';
import {assetInspectionLayoutV384} from './asset-inspection-layout.mjs';
import { updateNotificationsJs } from './notifications.mjs';
import { repairJs, repairHtml, repairServer } from './repairs.mjs';
import {roomAssetJs,roomAssetHtml,roomAssetServer,roomAssetCSS} from './room-assets.mjs';
import {correctDormSource,correctDormClient} from './dorm-corrections.mjs';
import {dormPlanHtml,dormPlanClient,dormPlanCSS} from './dorm-plan.mjs';
import {laborInterfaceJs,laborInterfaceCSS} from './labor-interface.mjs';
import {laborBuildingJs,laborBuildingHtml,laborBuildingCSS} from './labor-building.mjs';
import {laborCardsJsV374,laborCardsCSSV374,laborCardsNoWrapCSSV375,laborContainCSSV376,laborCheckboxCSSV377,laborRemoveGuideCSSV378} from './labor-cards.mjs';
import {dormOutingJs,dormOutingHtml} from './dorm-outing.mjs';
import {assetOverviewJs} from './asset-overview.mjs';
import {assetPlanJs,assetPlanHtml,assetPlanServer,assetPlanCSS,assetRoomHealth} from './asset-plan.mjs';
import {assetRequestsJs,assetRequestsHtml,assetRequestsServer,assetRequestsCSS} from './asset-requests.mjs';
import {uniformRequestNavSource,uniformRequestNavJs,uniformRequestNavHtml} from './uniform-request-navigation.mjs';
import {trainingShellJs,trainingShellHtml} from './training-shell.mjs';
import {trainingManagementHtmlV473,trainingManagementJsV473,trainingManagementCSSV473,trainingAccessServerV473} from './training-management.mjs';
import {personalInterfaceJs,personalInterfaceHtml,personalInterfaceNavSource,personalInterfaceCSS,personalInterfaceProfileCSSV401} from './personal-interface.mjs';
import {personalInterfacePreview} from './personal-interface-preview.mjs';
import {staffAccessHtml,staffAccessJs} from './staff-access.mjs';
import {dutyCadetsJs,dutyCadetsHtml} from './duty-cadets.mjs';
import {dutyRoleInfoV367,dutySortV367,dutyFamilyV367,dutySaberRoleV367} from './duty-roles.mjs';
import {dutySplitAssignmentsV391,dutyFixedRolesV391,dutyAssignmentKeyV391,dutyFixedRoleValidV391} from './duty-assignments.mjs';
import {dutyItemsJsV368,dutyItemsHtmlV368,dutyItemsNavSourceV368,dutyItemRequirementsV368,dutyItemsV368} from './duty-items.mjs';
import {dutyPasteV371,dutyMatchV371,dutyMergeV371} from './duty-verification.mjs';
import {dutyOrgKeyV372,dutyOrderRowsV372,dutyOrderSignatureV372} from './duty-order.mjs';
import {dutyHierarchyV373,dutyAccordionV373} from './duty-hierarchy.mjs';
import {personalSessionStore} from './personal-session.mjs';
import {dormMemberCohortsV343} from './dorm-members.mjs';
import {dormPlaceRoomV344} from './dorm-placement.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8').replace(/^\uFEFF/, '');
const write = (path, text) => { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), text, 'utf8'); };
let html = read('Index.html.txt');
const unpack = id => {
  const match = html.match(new RegExp(`<template id="${id}">([\\s\\S]*?)<\\/template>`));
  if (!match) throw new Error(`압축 원본을 찾을 수 없습니다: ${id}`);
  return gunzipSync(Buffer.from(match[1].replace(/\s/g, ''), 'base64')).toString('utf8');
};
let js = updateJournalJs(updateDeparturesJs(unpack('v275JsGzip'))
  .replace(/const maxWait=method==='getBootstrap'\?23000:method==='pingConnectionV273'\?12000:30000;/,
    'const maxWait=90000;')
  .replace("'서버 응답 시간 초과 ('+Math.round(maxWait/1000)+'초). 시트 권한·배포 버전·Google 서버 상태를 확인하세요.'",
    "'서버 응답 시간 초과 ('+Math.round(maxWait/1000)+'초). 자동 재시도하지 않습니다. 새로고침 후 저장 결과를 확인하세요.'"));
js = roomAssetJs(repairJs(updateNotificationsJs(updateCalendarJs(updateNavigationJs(js)))),read('scripts/room-assets-client.js.txt'));
js=dormPlanClient(correctDormClient(js),read('scripts/dorm-plan-client.js.txt')+'\n'+read('scripts/dorm-placement-client.js.txt')+'\ndormPlacementInitV344();');
js=laborInterfaceJs(js);
js=laborBuildingJs(js);
js=laborCardsJsV374(js,read('scripts/labor-cards-client.js.txt'));
html=laborBuildingHtml(html);
js=dormOutingJs(js);
html=dormOutingHtml(html);
js=assetOverviewJs(js);
js=assetPlanJs(js);
js=assetRequestsJs(js,read('scripts/asset-requests-client.js.txt'));
js=uniformRequestNavJs(js);
{const end=js.lastIndexOf('})();');js=js.slice(0,end)+'\n'+read('scripts/uniform-requests-client.js.txt')+'\n'+js.slice(end);}
js=trainingShellJs(js);
js=staffAccessJs(js);
html=staffAccessHtml(html);
js=personalInterfaceJs(js,'const PERSONAL_PREVIEW_HTML_V360='+JSON.stringify(personalInterfacePreview(read('scripts/personal-portal.html'),read('scripts/personal-portal.css')+personalDutyCSSV400,read('scripts/personal-interface-preview.js.txt')))+';\n'+read('scripts/personal-interface-client.js.txt'));
js=dutyCadetsJs(js,dutyRoleInfoV367.toString()+'\n'+dutySortV367.toString()+'\n'+dutyFamilyV367.toString()+'\n'+dutySaberRoleV367.toString()+'\n'+read('scripts/duty-cadets-client.js.txt')+'\n'+read('scripts/duty-roster-client.js.txt')+'\n'+dutyPasteV371.toString()+'\n'+dutyMatchV371.toString()+'\n'+dutyMergeV371.toString()+'\n'+read('scripts/duty-verification-client.js.txt'));
html=dutyCadetsHtml(html);
{const end=js.lastIndexOf('})();');js=js.slice(0,end)+'\n'+[dutySplitAssignmentsV391,dutyFixedRolesV391,dutyAssignmentKeyV391,dutyFixedRoleValidV391].map(fn=>fn.toString()).join('\n')+'\n'+js.slice(end);}
{const end=js.lastIndexOf('})();');js=js.slice(0,end)+'\n'+dutyOrgKeyV372.toString()+'\n'+dutyOrderRowsV372.toString()+'\n'+dutyOrderSignatureV372.toString()+'\n'+dutyHierarchyV373.toString()+'\n'+dutyAccordionV373.toString()+'\n'+read('scripts/duty-order-client.js.txt')+'\n'+js.slice(end);}
js=dutyItemsJsV368(js,'const dutyItemsV368='+JSON.stringify(dutyItemsV368)+';\n'+dutyItemRequirementsV368.toString()+'\n'+read('scripts/duty-items-client.js.txt'));
js=developmentRequestsJs(js,read('scripts/development-requests-client.js.txt'));
js=assetInspectionJsV382(js,read('scripts/asset-inspection-client.js.txt'));
html=developmentRequestsHtml(html);
html=dutyItemsHtmlV368(html);
js=js.replace('function navRenderV233(){','let wxNavigationReadyV314=false;\nfunction navRenderV233(){')
 .replace('nav.replaceChildren(frag);v284AddUtilityNav();','nav.replaceChildren(frag);v284AddUtilityNav();if(ready&&wxNavigationReadyV314&&!navEditModeV220&&!navDirtyV220)window.LOGBOOK_NAVIGATION?.commit();')
 .replace('async function wxLoadAll(){',`let wxLoadPromiseV314=null;
async function wxLoadAll(){if(wxLoadPromiseV314)return wxLoadPromiseV314;wxLoadPromiseV314=wxLoadAllInnerV314();try{return await wxLoadPromiseV314;}finally{wxLoadPromiseV314=null;}}
async function wxLoadAllInnerV314(){\n wxNavigationReadyV314=false;`)
 .replace("wxLoaded=false;wxLoadError='';if(view==='calendar')wxLoadAll();", "wxLoaded=false;wxLoadError='';wxLoadAll();")
 .replace('navTreeV233=navNormalizeV233(response.navTree);navSavedTreeV233=navDeepCopyV233(navTreeV233);navUpdateDirtyV220();navRenderV233();','navTreeV233=navNormalizeV233(response.navTree);navSavedTreeV233=navDeepCopyV233(navTreeV233);navUpdateDirtyV220();wxNavigationReadyV314=true;navRenderV233();')
 .replace("catch(e){wxLoaded=false;wxLoadError=String(e.message||e);", "catch(e){window.LOGBOOK_NAVIGATION?.commit(false);wxLoaded=false;wxLoadError=String(e.message||e);");
js=js.replace("navEditToggleV220(false);navUpdateDirtyV220();toast('메뉴", "navEditToggleV220(false);navUpdateDirtyV220();window.LOGBOOK_NAVIGATION?.commit();toast('메뉴");
js=dutyPersonEditorJsV398(js,read('scripts/duty-person-editor-client.js.txt'));
js=updateHistoryJs(js,read('scripts/update-history-client.js.txt'));
js=dutyRequestsJsV400(js,read('scripts/duty-requests-client.js.txt'));
const leaveGuard=js.match(/window\.addEventListener\('beforeunload',e=>\{if\((.*?)\)\{e\.preventDefault/);
if(!leaveGuard)throw Error('업데이트 적용 전 저장 상태 검사 위치를 확인하세요.');
const hook=js.lastIndexOf('})();');
js=js.slice(0,hook)+`\nwindow.LOGBOOK_OPEN_UPDATES=()=>navEditModeV220?null:switchView('updates');\n`+js.slice(hook);
js=js.slice(0,hook)+`\nwindow.logbookReloadState=()=>({busy:!!(dutyMoveBusyV372||dutyVerifyBusyV371||dutyItemsBusyV368||dutySavingV367||dutyCadetsBusyV365||personalInterfaceBusyV359||modalSaving||eqSaving||rosterSaving||rosterQuickSaving.size||navSavingV220||wxCalSaving||wxBulkSavingV229||wxRowSaving||syncPending||assetSavingV244||departuresBusyV305||dormPlacementBusyV344||dormPendingV237.size||dormBulkBusyV237||laborPairSavingV264||uniformStateV278.saving),dirty:!!(${leaveGuard[1]}||dutyItemDraftV368.size||dutyDialogV367.open||settingsDirtyV258||personalInterfaceDirtyV359||dormPlanDraftV315||$('dormPlanRoomDialogV315')?.open||$('dormAddDialogV344')?.open||document.querySelector('[data-request-edited]'))});\n`+js.slice(hook);
js=js.replace('busy:!!(dutyMoveBusyV372||','busy:!!(devBusyV381||dutyMoveBusyV372||').replace('dirty:!!(','dirty:!!(devDirtyV381()||');
js=js.replace('busy:!!(devBusyV381||','busy:!!(assetInspectionBusyV382||devBusyV381||');
js=supplySchemaClientV408(js,read('scripts/supply-schema-client.js.txt')+'\n'+read('scripts/supply-blueprints-client.js.txt')+'\n'+read('scripts/supply-attention.js.txt'));
js=referenceBatchClientV409(js,read('scripts/reference-batch-client.js.txt'));
js=firearmClientV410(js,read('scripts/firearms-client.js.txt')+'\n'+read('scripts/menu-settings-client.js.txt'));
js=linkageClientV412(js,read('scripts/roster-linkage-client.js.txt'));
js=firearmRequestClientV413(js,read('scripts/firearm-requests-client.js.txt'));
js=surveyClientV416(js,read('scripts/survey-periods-client.js.txt')+'\n'+read('scripts/survey-forms-client.js.txt'));
js=surveyHistoryClientV528(js,read('scripts/survey-history-client.js.txt'));
js=rosterGunAuditClientV417(js,read('scripts/roster-firearm-audit-client.js.txt'));
js=personGroupsClientV424(js,read('scripts/person-groups-client.js.txt'));
js=managedDeleteClientV426(js,read('scripts/managed-delete-client.js.txt'));
js=trainingManagementJsV473(js,read('scripts/training-management-client.js.txt'));
js=armoryClientV493(js,read('scripts/armory-client.js.txt'));
js=supplyQuantityOrderClientV500(js,read('scripts/supply-quantity-order-client.js.txt'));
js=js.replace('function supplyRender(){','function supplyRender(){queueMicrotask(supplyRenderAlertsV523);');
js=js.replace('function supplyCatalogUI(){','function supplyCatalogUI(){supplyRequestShortcutV524();');
js=js.replace("const r=await server('getSupplyCatalog');supplyLoaded=", "const r=await server('getSupplyCatalog',selectId||supplySelected,true);supplyLoaded=")
 .replace('if(supplyLoaded&&supplySelected)await supplyLoadItem(supplySelected,true);',`if(supplyLoaded&&supplySelected){
      if(r.selected?.id===supplySelected&&(!canEdit||(r.selected.schema?.preset?r.selected.schema.fields.every(f=>r.selected.fields.includes(f)):r.selected.fields.includes('사이즈')&&r.selected.fields.includes('수량')))){supplyItem=r.selected;supplyCatalogUI();supplyRender();}
      else await supplyLoadItem(supplySelected,true);
    }`);
js=supplyRequestsClientV506(js,read('scripts/supply-requests-client.js.txt'));
js=quantityColorsClientV502(js);
js=js.replace(/^init\(\);$/m,()=>read('scripts/condition-colors.js.txt')+'\ninit();');
js=conditionTextV497(js);
js=supplyStatusDisplay(js);
js=saberGroupsClientV498(js);
const supplySaveCallV530="const saved=await enqueue(()=>server('saveSupplyRow',itemId,copy));";
if(!js.includes(supplySaveCallV530))throw Error('군수품 저장 호출 위치를 찾지 못했습니다.');
js=js.replace('function supplyTrack(el){',`const supplySaveTimersV530=new Map();
function supplyScheduleSaveV530(id){clearTimeout(supplySaveTimersV530.get(id));supplySaveTimersV530.set(id,setTimeout(()=>{supplySaveTimersV530.delete(id);supplySave(id);},450));}
async function supplyWriteWithRetryV530(itemId,copy){try{return await server('saveSupplyRow',itemId,copy);}catch(error){if(!/서버 응답 시간 초과|서버 연결|연결 실패|응답을 확인|네트워크|network/i.test(String(error?.message||error)))throw error;return server('saveSupplyRow',itemId,copy);}}
function supplyTrack(el){`)
 .replace('async function supplySave(id){','async function supplySave(id){clearTimeout(supplySaveTimersV530.get(id));supplySaveTimersV530.delete(id);')
 .replace(supplySaveCallV530,"const saved=await enqueue(()=>supplyWriteWithRetryV530(itemId,copy));")
 .replace('supplyTrack(x);supplySave(x.dataset.id);','supplyTrack(x);supplyScheduleSaveV530(x.dataset.id);')
 .replace("if(x&&x.dataset.supplyField!=='status'){supplyTrack(x);supplySave(x.dataset.id);}","if(x&&x.dataset.supplyField!=='status'){supplyTrack(x);supplyScheduleSaveV530(x.dataset.id);}");
js=js.replace('function supplyRender(){queueMicrotask(supplyRenderAlertsV523);','function supplyRender(){queueMicrotask(supplyRenderAlertsV523);supplyReviewUpdateV531();')
 .replaceAll('supplyTrack(x);supplyScheduleSaveV530(x.dataset.id);','supplyTrack(x);supplyReviewUpdateV531();')
 .replace('  supplyMetricsOnly();\n}\nasync function supplySave','  supplyMetricsOnly();supplyReviewUpdateV531();\n}\nasync function supplySave')
 .replace("if(x)supplySave(x.dataset.supplySave);","if(x)supplyReviewOpenV531([x.dataset.supplySave]);")
 .replace("data-supply-save=\"${escapeH(p.id)}\" ${supplyDrafts.has(p.id)?'':'hidden'}>저장</button>","data-supply-save=\"${escapeH(p.id)}\" ${supplyDrafts.has(p.id)?'':'hidden'}>검토</button>");
js=js.replace('function supplyCatalogUI(){','function supplyCatalogUI(){queueMicrotask(supplyOverviewMountV558);');
js=js.replace(/^init\(\);$/m,()=>read('scripts/supply-review-client.js.txt')+'\nconst supplyOverviewV558='+supplyOverview.toString()+';\nconst supplyOverviewPeopleV558='+supplyOverviewPeople.toString()+';\nconst supplyItemSpecialPeopleV558='+supplyItemSpecialPeople.toString()+';\n'+read('scripts/supply-overview-client.js.txt')+'\ninit();');
const css = read('scripts/armory.css') + read('scripts/person-groups.css') + read('scripts/firearms.css') +  read('scripts/supply-schema.css') + unpack('v275CssGzip') + calendarCSS + departuresCSS + journalCSS + roomAssetCSS + dormPlanCSS + laborInterfaceCSS + laborBuildingCSS + laborCardsCSSV374 + laborCardsNoWrapCSSV375 + laborContainCSSV376 + laborCheckboxCSSV377 + laborRemoveGuideCSSV378 + assetPlanCSS + assetRequestsCSS + personalInterfaceCSS + personalInterfaceProfileCSSV401 + developmentRequestsCSS + trainingManagementCSSV473 + read('scripts/duty-person-editor.css') + read('scripts/ui-consistency.css') + read('scripts/condition-colors.css') + read('scripts/table-presentation.css');
html=personalInterfaceHtml(html).replace('예시 화면 · ⠿ 이동을 끌어 순서 변경 · 저장 후 반영','예시 화면 · 이동으로 순서 변경 · 접기로 기본 펼침 설정 · 저장 후 반영');
html=dutyRequestsHtmlV400(html);
html=surveyHistoryHtmlV528(html);
html=html.replace('상태는 선택 시 저장되고, 사이즈·수량·세부내용은 입력 후 다른 칸을 누르면 자동 저장됩니다. 행별 저장 버튼도 사용할 수 있습니다.','값을 수정한 뒤 수정 내역을 확인하고 저장하세요.');
// 원본 업무 화면은 유지하되 Apps Script 전용 압축 부트스트랩/진단 코드는 제거합니다.
html = html.replace(/<template id="v275(?:Css|Js)Gzip">[\s\S]*?<\/template>/g, '');
html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>군수계 업무일지</title>');
html=html.replace(/<html\b/,'<html data-navigation-pending');
html=html.replace('</head>','<style>html[data-navigation-pending] #sidebarMenu,html[data-navigation-pending] .mobile-nav{display:none!important}html:not([data-navigation-pending]) #navigationPreview{display:none}#navigationPreview .nav-item{font:inherit;color:inherit;text-align:left;width:100%;background:transparent;border:0;padding:9px 16px}#navigationPreview .navigation-loading{padding:16px;color:#a7b9ce;font-size:13px}</style></head>');
html = html.replaceAll('<h2>우선 처리할 업무</h2>', '<h2>마감 임박 · 우선 처리할 업무</h2>')
  .replace('v2.99 · Google Forms 조사', 'v'+releaseDetails.version+' · '+releaseDetails.title);
html = html.replace('</head>', '<link rel="stylesheet" href="./assets/app.css">\n<link rel="stylesheet" href="./assets/pages.css">\n<script src="./config.js"></script>\n<script src="https://accounts.google.com/gsi/client" async defer></script>\n</head>');
// 첫 렌더링 전에 로그인 덮개만 숨깁니다. 실제 접근 권한은 API에서 확인합니다.
html=html.replace('</head>',`<script>try{const s=JSON.parse(localStorage.getItem('logbook.session.v1')||'null');if(s&&typeof s.token==='string'&&s.token.startsWith('session.')&&s.expiresAt>Date.now())document.documentElement.setAttribute('data-session-restoring','true');}catch(_){}</script></head>`);
html = html.replace(/<body([^>]*)>/, `<body$1>
<section id="pagesLogin" class="pages-login" aria-labelledby="pagesLoginTitle">
 <div class="pages-login-card">
  <p class="pages-eyebrow">군수계 업무일지</p><h1 id="pagesLoginTitle">Google 계정으로 로그인</h1>
  <p>등록된 Google 계정으로 로그인하세요.<br>같은 브라우저에서 30일간 로그인이 유지됩니다.</p>
  <form id="pagesEmailForm" class="pages-email-form">
   <label for="pagesEmail">이메일 직접 입력 <span>(선택)</span></label>
   <input id="pagesEmail" type="email" autocomplete="username" inputmode="email" maxlength="254" placeholder="example@gmail.com" aria-describedby="pagesEmailHelp">
   <p id="pagesEmailHelp">이메일을 입력하면 해당 Google 계정으로 로그인하도록 안내합니다.</p>
   <button type="submit">입력한 이메일 적용</button>
  </form>
  <div id="pagesGoogleButton"></div>
  <p><a href="./me/">개인 군수 조회 →</a></p>
  <p id="pagesLoginStatus" role="status" aria-live="polite">연결 설정을 확인하고 있습니다.</p>
  <button id="pagesRetry" type="button" hidden>다시 시도</button>
 </div>
</section>
<div id="pagesSession" class="pages-session" hidden><span id="pagesAccount"></span><button id="pagesLogout" type="button">로그아웃</button></div>`);
// 로그인 상태는 본문 흐름 안의 상단 계정 줄에 둡니다.
const accountMarkup=html.match(/<div id="pagesSession"[\s\S]*?<\/div>/)?.[0];
if(!accountMarkup)throw Error('계정 표시 영역을 확인하세요.');
html=html.replace(accountMarkup,'').replace('</header>','</header>'+accountMarkup);
html = html.replace('</body>', `<button type="button" id="pagesUpdateLauncher" hidden>업데이트 안내</button>
<div id="notificationDockV309" class="notification-dock"><aside class="pages-update-notice" id="pagesUpdateNotice" role="region" aria-label="새 업데이트 안내" hidden>
 <div class="pages-update-head"><strong>업데이트</strong><button id="pagesUpdateClose" type="button" aria-label="업데이트 알림 닫기">×</button></div><p>새 업데이트 사항이 있습니다</p>
 <p id="pagesUpdateVersion"></p><ul id="pagesUpdateNotes"></ul><p id="pagesUpdateHelp" role="status" aria-live="polite"></p><button id="pagesUpdateApply" type="button">확인</button>
</aside></div><script src="./assets/updates.js"></script><script src="./assets/navigation-start.js"></script><script src="./assets/pages.js"></script>\n</body>`);
// 로그인 후 동적으로 읽는 app.js도 동일한 빌드의 파일을 사용합니다.
const fingerprint = value => createHash('sha256').update(value).digest('hex').slice(0, 16);
const {personalJs,personalCss,personalHtml}=buildPersonal();
const instructorJs=conditionTextV497(read('scripts/instructor-portal.js')),instructorCss=read('scripts/instructor-portal.css');
write('docs/assets/instructor.js',instructorJs);
write('docs/assets/instructor.css',instructorCss);
write('docs/instructor.html',conditionTextV497(read('scripts/instructor-portal.html')).replace('./assets/instructor.js','./assets/instructor.js?v='+fingerprint(instructorJs)).replace('./assets/instructor.css','./assets/instructor.css?v='+fingerprint(instructorCss)));
const assets=[['assets/app.css', css], ...['assets/pages.css','assets/pages.js','assets/updates.js','assets/navigation-start.js','config.js'].map(path => [path,readFileSync(resolve(root,'docs',path),'utf8')])];
const release={...releaseDetails,id:fingerprint(JSON.stringify([releaseDetails,js,assets,personalHtml,personalJs,personalCss]))};
write('docs/release.json',JSON.stringify(release,null,2)+'\n');
html = html.replace(/<html\b/, `<html data-app-version="${fingerprint(js)}" data-release-id="${release.id}"`);
for (const [path, contents] of assets) {
  html = html.replaceAll(`"./${path}"`, `"./${path}?v=${fingerprint(contents)}"`);
}
write('docs/index.html', assetRequestsHtml(assetPlanHtml(dormPlanHtml(roomAssetHtml(repairHtml(updateDeparturesHtml(updateNavigationHtml(updateJournalHtml(html)))))))));
html=html.replace(/<div class="setting-box"><h3>업무 분류 관리<\/h3>[\s\S]*?(?=<div class="setting-box"><h3>접근권한)/,'');
write('docs/index.html',read('docs/index.html').replace(/<div class="setting-box"><h3>업무 분류 관리<\/h3>[\s\S]*?(?=<div class="setting-box"><h3>접근권한)/,''));
write('docs/index.html',read('docs/index.html').replace('<nav id="sidebarMenu" aria-label="일반학기 메뉴">','<nav id="sidebarMenu" aria-label="일반학기 메뉴"><button class="nav-btn" data-view="firearms" type="button">총기·무기고 관리 현황</button>'));
write('docs/index.html',read('docs/index.html').replace('<nav id="sidebarMenu" aria-label="일반학기 메뉴">','<nav id="sidebarMenu" aria-label="일반학기 메뉴"><button class="nav-btn" data-view="firearmRequests" type="button">총기 수정 요청·전수조사</button>').replace('<section id="rosterView"',firearmRequestsHtmlV413+'<section id="rosterView"'));
write('docs/index.html',uniformRequestNavHtml(read('docs/index.html')));
write('docs/index.html',trainingShellHtml(read('docs/index.html')));
write('docs/index.html',trainingManagementHtmlV473(read('docs/index.html')));
write('docs/index.html',assetInspectionHtmlV382(read('docs/index.html')));
write('docs/index.html',saberGroupsHtmlV498(conditionTextV497(read('docs/index.html'))));
write('docs/index.html',read('docs/index.html').replace('<nav id="sidebarMenu" aria-label="일반학기 메뉴">','<nav id="sidebarMenu" aria-label="일반학기 메뉴"><button class="nav-btn" data-view="supplyRequests" type="button">군수품 수정 요청·전수조사</button>').replace('<section id="rosterView"',supplyRequestsHtmlV506+'<section id="rosterView"'));
write('docs/assets/app.css', css+read('scripts/supply-requests.css')+read('scripts/supply-overview.css'));
// 저장된 세션은 화면 로딩과 서버 검증을 함께 시작하며, 업무 자료는 검증 응답 후에만 사용합니다.
write('docs/assets/app.js', js);

const privatePlan=JSON.parse(read('.deploy/dorm-plan-source.json'));
let legacy = roomAssetServer(repairServer(correctDormSource(read('Code.gs.txt'),privatePlan.correction)+'\n'+read('scripts/departures-server.gs.txt')),read('scripts/room-assets-server.gs.txt'),read('scripts/room-assets-bulk.gs.txt'));
legacy=assetPlanServer(legacy);
legacy=assetRequestsServer(legacy)+'\n'+read('scripts/asset-requests-server.gs.txt');
legacy=uniformRequestNavSource(legacy);
legacy=personalInterfaceNavSource(legacy);
legacy=dutyRequestsNavSourceV400(legacy).replace('function accessGuardV284_(name,args){',"function accessGuardV284_(name,args){if(['getDutyRequestsV400','resolveDutyRequestV400'].includes(name)){dutyRosterAdminV367_();return accessPolicyV284_();}");
legacy=developmentNavSource(legacy).replace('function accessGuardV284_(name,args){',"function accessGuardV284_(name,args){if(['getDevelopmentRequestsV381','createDevelopmentRequestV381','updateDevelopmentRequestV381'].includes(name))return accessPolicyV284_();").replace('ret.allowedViews=policy.views.slice();',"ret.allowedViews=policy.views.concat('developmentRequests');");
legacy+='\n'+read('scripts/development-requests-server.gs.txt');
legacy+='\n'+assetInspectionModelV382.toString()+'\n'+assetInspectionLayoutV384.toString()+'\n'+read('scripts/asset-inspection-native-server.gs.txt');
legacy=dutyItemsNavSourceV368(legacy);
legacy+='\n'+read('scripts/smart-inactive.gs.txt')+'\nconst DORM_PLAN_DEFAULT_V315_='+JSON.stringify(privatePlan)+';\n'+read('scripts/dorm-plan-server.gs.txt')+'\n'+read('scripts/dorm-corrections-server.gs.txt');
legacy+='\n'+read('scripts/personal-server.gs.txt');
legacy+='\n'+dutyItemRequirementsV368.toString()+'\n'+read('scripts/personal-duty-server.gs.txt');
legacy+='\n'+read('scripts/duty-requests-server.gs.txt');
legacy+='\n'+read('scripts/personal-interface-server.gs.txt');
legacy+='\n'+read('scripts/duty-cadets-server.gs.txt');
legacy+='\n'+dutyRoleInfoV367.toString()+'\n'+dutySaberRoleV367.toString()+'\n'+read('scripts/duty-roster-server.gs.txt');
legacy+='\n'+read('scripts/duty-manual-server.gs.txt');
legacy+='\n'+[dutySplitAssignmentsV391,dutyFixedRolesV391,dutyAssignmentKeyV391,dutyFixedRoleValidV391].map(fn=>fn.toString()).join('\n');
legacy+='\n'+read('scripts/labor-duty-groups.gs.txt');
legacy+='\n'+dutySortV367.toString()+'\n'+dutyOrgKeyV372.toString()+'\n'+dutyOrderRowsV372.toString()+'\n'+dutyOrderSignatureV372.toString()+'\n'+read('scripts/duty-order-server.gs.txt');
legacy+='\n'+dutyMatchV371.toString()+'\n'+read('scripts/duty-verification-server.gs.txt');
legacy+='\n'+read('scripts/duty-items-server.gs.txt');
legacy+='\n'+read('scripts/uniform-requests-server.gs.txt');
legacy+='\n'+read('scripts/training-management-server.gs.txt');
legacy+='\n'+dormMemberCohortsV343.toString();
legacy+='\n'+dormPlaceRoomV344.toString();
legacy=supplySchemaServerV408(legacy,read('scripts/supply-schema-server.gs.txt')+'\n'+read('scripts/supply-blueprints-server.gs.txt'));
legacy=referenceMenuV409(legacy,true).replace('function accessGuardV284_(name,args){',"function accessGuardV284_(name,args){if(['getReferenceBatchV409','previewReferenceBatchV409','applyReferenceBatchV409'].includes(name)){referenceAdminV409_();return accessPolicyV284_();}");
legacy+='\n'+read('scripts/reference-batch-server.gs.txt');
legacy=firearmSourceV410(legacy,true).replace('value.groups.length>NAV_GROUPS_V233.length','value.groups.length>50').replace('NAV_GROUPS_V233.some(g=>g.id===id)',"(NAV_GROUPS_V233.some(g=>g.id===id)||/^g_[a-z0-9]{8,40}$/.test(id))");
legacy=linkageSourceV412(legacy).replace('function smartReferenceV253_(ss){','function smartReferenceV253_(ss){if(rosterLinkSmartContextV412_)return rosterLinkSmartContextV412_;').replace('function accessGuardV284_(name,args){',"function accessGuardV284_(name,args){if(name==='getRosterLinkagePulseV412')return accessPolicyV284_();if(['getRosterLinkageV412','syncRosterLinkageV412','enableRosterLinkageV412'].includes(name)){referenceAdminV409_();return accessPolicyV284_();}");
legacy+='\n'+Object.values(rosterLinkageV412).filter(v=>typeof v==='function').map(f=>f.toString()).join('\n')+'\n'+read('scripts/roster-linkage-server.gs.txt');
legacy=firearmRequestSourceV413(legacy,true).replace("if(action==='duty-request')return personalDutyRequestV400_(input);","if(action==='duty-request')return personalDutyRequestV400_(input);if(action==='firearm-request')return personalFirearmRequestV413_(input);").replace('function accessGuardV284_(name,args){',"function accessGuardV284_(name,args){if(['getFirearmRequestsV413','resolveFirearmRequestsV413','setFirearmSurveyV413'].includes(name)){referenceAdminV409_();return accessPolicyV284_();}");legacy+='\n'+read('scripts/firearm-requests-server.gs.txt');
legacy=surveyServerV416(legacy,read('scripts/survey-periods-server.gs.txt'));
legacy=managedDeleteServerV426(legacy,read('scripts/managed-delete-server.gs.txt'));
legacy=armoryServerV493(legacy,read('scripts/armory-server.gs.txt'));
legacy=supplyQuantityOrderServerV500(legacy,read('scripts/supply-quantity-order-server.gs.txt'));
legacy=supplyRequestsServerV506(legacy,read('scripts/supply-requests-server.gs.txt')+'\n'+read('scripts/supabase-person-supplies.gs.txt')+'\n'+read('scripts/supply-batch-server.gs.txt')+'\n'+read('scripts/supply-direct-batch-server.gs.txt'));
legacy+='\n'+read('scripts/supply-review-server.gs.txt');
legacy+='\n'+read('scripts/supply-survey-people.gs.txt');
legacy+='\n'+read('scripts/survey-deferred-server.gs.txt');
legacy+='\n'+read('scripts/supply-inbox-server.gs.txt');
legacy+='\n'+read('scripts/supply-forms-server.gs.txt');
legacy=legacy.replace('function setSupplySurveyV506(input){','function supplySurveySetBaseV550_(input){');
legacy+='\n'+read('scripts/supply-survey-lifecycle-server.gs.txt');
legacy+='\n'+read('scripts/supply-form-korean-server.gs.txt');
legacy=legacy.replace('function setSurveyPeriodV416(kind,input){','function surveyPeriodSetBaseV566_(kind,input){');
legacy+='\n'+read('scripts/survey-forms-server.gs.txt');
legacy+='\n'+read('scripts/supply-source-sync.gs.txt');
legacy=legacy.replace("if(['getSurveyPeriodsV416','setSurveyPeriodV416'].includes(name))","if(['getSurveyPeriodsV416','setSurveyPeriodV416','getSurveyFormV566','createSurveyFormV566'].includes(name))");
legacy=trainingAccessServerV473(legacy);
legacy=conditionServerV497(legacy);
const names = [...new Set([...legacy.matchAll(/^function\s+([A-Za-z]\w*)\s*\(/gm)].map(m => m[1]))];
const frontendStrings = new Set([...(js+'\n'+instructorJs).matchAll(/['"]([A-Za-z][A-Za-z0-9]*)['"]/g)].map(m => m[1]));
const methods = names.filter(name => !name.endsWith('_') && frontendStrings.has(name)
  && !['doGet', 'doPost', 'setupLogbook', 'setupLiveFrontendV222', 'disableLiveFrontendV222', 'liveFrontendInfoV222', 'trainingScheduledHandoffV227', 'surveysOnSubmitV299'].includes(name));
methods.push('readCompressedV282', 'pingConnectionV273');
const uniqueMethods = [...new Set(methods)].sort();
const missing = [...js.matchAll(/server\(\s*['"]([A-Za-z][A-Za-z0-9]*)['"]/g)].map(m => m[1]).filter(name => !uniqueMethods.includes(name));
if (missing.length) throw new Error(`연결되지 않은 화면 API: ${[...new Set(missing)].join(', ')}`);
legacy = legacy.replace(/Session\.get(?:Effective|Active)User\(\)\.getEmail\(\)/g, 'pagesEmail_()');
legacy = legacy.replace('const sh=ss.getSheets().find(x=>x.getSheetId()===item.sheetId);','const sh=pagesSupplySheetsV337_(ss).find(x=>x.getSheetId()===item.sheetId);');
legacy = legacy.replace(/PropertiesService\.getUserProperties\(\)/g, 'pagesUserProperties_()');
legacy = legacy.replace(/(['"])trainingScheduledHandoffV227\1/g, "'pagesTrainingScheduled_'");
legacy = legacy.replace(/(['"])surveysOnSubmitV299\1/g, "'pagesSurveySubmit_'");
legacy = legacy.replace('function lockAndRun_(fn){','function lockAndRun_(fn){\n  if(pagesStorage_.transactional)return fn();');
// Google owns raw Form response tabs and export formatting; application records use Supabase.
legacy = legacy.replace('function supplyFormsKoreanV553_(){\n const book=supplyInboxBookV542_(false);','function supplyFormsKoreanV553_(){\n const book=pagesNativeFormBook_(supplyInboxBookV542_(false));');
legacy = legacy.replace('function supplyFormResponseTabV552_(meta){\n const book=supplyInboxBookV542_(false);','function supplyFormResponseTabV552_(meta){\n const book=pagesNativeFormBook_(supplyInboxBookV542_(false));');
const prefix = `/** 자동 생성: node scripts/build.mjs. 원본 Code.gs.txt를 수정한 뒤 다시 생성하세요. */
function pagesCreateLegacy_(pagesActor_) {
const pagesStorage_ = pagesStorageContext_(pagesActor_);
const SpreadsheetApp = pagesStorage_.spreadsheet, PropertiesService = pagesStorage_.properties, DriveApp = pagesStorage_.drive, CacheService = pagesStorage_.cache;
function pagesEmail_() {
 if (!pagesActor_ || !pagesActor_.email) pagesForbidden_();
 return pagesActor_.email;
}
function pagesUserProperties_() {
 const props = PropertiesService.getScriptProperties();
 const hash = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pagesEmail_())).replace(/=+$/, '');
 const prefix = 'PAGES_USER_' + hash + '_';
 return { getProperty: key => props.getProperty(prefix + key), setProperty: (key, value) => props.setProperty(prefix + key, value) };
}
`;
const suffix = `
${requestPerformanceCode}
const pagesMethods_ = {${uniqueMethods.join(',')}};
return pagesStorage_.wrap({
 instructorTemporary: function(action,id,input){return trainV490Temporary_(action,id,input);},
 personal: function(action,input){
  if(['login','get','duty','details','supplies','uniform'].includes(action)){pagesReadRequestV307_={};}
  if(action==='login')return personalLoginV330_(input);
  if(action==='get')return personalDashboardV330_(false,false);
  if(action==='duty')return personalDutyDetailsV529_();
  if(action==='details')return personalDetailsV337_();
  if(action==='supplies'||action==='uniform')return personalDetailsV337_(action);
  if(action==='assets')return personalSaveAssetsV331_(input);
  if(action==='uniform-request')return personalUniformRequestV350_(input);
  if(action==='duty-request')return personalDutyRequestV400_(input);
  if(action==='firearm-request')return personalFirearmRequestV413_(input);
  if(action==='supply-request')return personalSupplyStageV542_(input);
  if(action==='logout'){personalSessionV330_();PropertiesService.getScriptProperties().deleteProperty('PAGES_PERSONAL_SESSION_'+pagesActor_.sessionId);return true;}
  pagesForbidden_();
 },
 call: function(name, args) {
  pagesReadRequestV307_=(pagesReadMethodsV307_.has(name)||(name==='readCompressedV282'&&pagesReadMethodsV307_.has(args[0])))?{}:false;
  const cfg = config_();
  let viewers;
  try { viewers = JSON.parse(PropertiesService.getScriptProperties().getProperty('PAGES_VIEWER_EMAILS') || '[]'); }
  catch (_) { throw Error('조회 계정 설정이 올바르지 않습니다.'); }
  const known = cfg.email === String(cfg.owner).trim().toLowerCase() || fullEditorsV281_().includes(cfg.email)
    || limitedEditorEmailsV226_().includes(cfg.email) || !!accessProfileV284_(cfg.email)
    || trainKnownUserV473_(cfg.email) || (Array.isArray(viewers) && viewers.some(email => String(email).trim().toLowerCase() === cfg.email));
  if (!known) pagesForbidden_();
  if (!Object.prototype.hasOwnProperty.call(pagesMethods_, name)) throw Error('지원하지 않는 API입니다: ' + name);
  const policy = accessGuardV284_(name, args);
  return accessFilterV284_(name, pagesMethods_[name].apply(null, args), policy);
 },
 rosterSyncScheduled: function(){if(PropertiesService.getScriptProperties().getProperty('ROSTER_LINK_AUTO_V412')==='yes')return syncRosterLinkageV412(false);},
 training: function() { return trainingScheduledHandoffV227(); },
 survey: function(event) { return surveysOnSubmitV299(event); },
 deferredSurvey: function() { const inbox=supplyInboxProcessV542_();surveyDeferredProcessV537_();return inbox; },
 supplyFormsPoll: function(){return supplyFormsPollV551_();},
 supplySourceSync: function(event,sheetId){return supplySourceSyncV570_(event,sheetId);},
 supplyFormsClose: function(){return supplyFormCloseDueV550_();}
 ,surveyFormsClose: function(){return surveyFormsCloseV566_();}
});
}
`;
legacy=legacy.replace('const NAV_FIXED_V233=[',"const NAV_FIXED_V233=['surveyRecords',").replace('const NAV_GROUPS_V233=[',"const NAV_GROUPS_V233=[{id:'requestReview',title:'수정요청(전수조사) 검토',items:['surveyRecords']},");
write('apps-script/Legacy.gs', read('scripts/supabase-sheet-compat.mjs').replace('export function createSheetStore','function pagesCreateSheetStore_')+'\n'+read('scripts/supabase-runtime.gs.txt').replace('createSheetStore(','pagesCreateSheetStore_(')+'\n'+prefix + `\nconst navModelV301_ = ${normalizeNavigation.toString()};\n` + legacy + suffix);
write('apps-script/methods.json', JSON.stringify(uniqueMethods, null, 2) + '\n');
console.log(`화면/CSS/JS 생성, Apps Script API ${uniqueMethods.length}개 연결 완료`);

finalizeRelease();
