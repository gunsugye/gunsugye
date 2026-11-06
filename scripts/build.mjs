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
import { personalDutyPortalV400,personalDutyCSSV400 } from './personal-duty.mjs';
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
import {personalInterfaceJs,personalInterfaceHtml,personalInterfaceNavSource,personalInterfaceCSS} from './personal-interface.mjs';
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
js=personalInterfaceJs(js,'const PERSONAL_PREVIEW_HTML_V360='+JSON.stringify(personalInterfacePreview(read('scripts/personal-portal.html'),read('scripts/personal-portal.css'),read('scripts/personal-interface-preview.js.txt')))+';\n'+read('scripts/personal-interface-client.js.txt'));
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
const css = unpack('v275CssGzip') + calendarCSS + departuresCSS + journalCSS + roomAssetCSS + dormPlanCSS + laborInterfaceCSS + laborBuildingCSS + laborCardsCSSV374 + laborCardsNoWrapCSSV375 + laborContainCSSV376 + laborCheckboxCSSV377 + laborRemoveGuideCSSV378 + assetPlanCSS + assetRequestsCSS + personalInterfaceCSS + developmentRequestsCSS + read('scripts/duty-person-editor.css');
html=personalInterfaceHtml(html);
html=dutyRequestsHtmlV400(html);
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
let personalSource=read('scripts/personal-portal.js').replace('function fields(id,values){','function plainFields(id,values){').replace("if(result.uniform)fields('uniform',result.uniform.uniform);","if(result.uniform){uniformEditV350=result.uniform.uniformEdit||null;fields('uniform',result.uniform.uniform);}").replace('function clear(message=\'\'){',"function clear(message=''){uniformEditV350=null;uniformDirtyV350=false;").replaceAll('if(dirty&&','if((dirty||uniformDirtyV350)&&').replace('return;load().catch', 'return;uniformDirtyV350=false;uniformEditV350=null;load().catch').replace('})();',read('scripts/personal-uniform.js.txt')+'\n})();');
personalSource=personalSource.replace('function render(data){','function render(data){personalInterfaceOrderV359(data.interfaceOrder);').replace('})();',read('scripts/personal-interface-portal.js.txt')+'\n})();');
personalSource=personalDutyPortalV400(personalSource,read('scripts/personal-duty-portal.js.txt')).replaceAll('dirty||uniformDirtyV350','dirty||uniformDirtyV350||personalDutyDirtyV400');
const personalJs='const personalSessionStoreV338='+personalSessionStore.toString()+';\nconst personalAssetHealthV332='+assetRoomHealth.toString()+';\n'+personalSource,personalCss=read('scripts/personal-portal.css')+personalDutyCSSV400+assetPlanCSS+'\n.personal-uniform-table{width:100%;border-collapse:collapse;font-size:13px}.personal-uniform-table th,.personal-uniform-table td{padding:6px;border-bottom:1px solid #e2e8f0;text-align:left}.personal-uniform-table input{width:100%;box-sizing:border-box;padding:7px;min-width:0}.personal-uniform-table td{width:45%}',personalHtml=read('scripts/personal-portal.html').replace('<dl id="uniform"></dl>','<div id="uniform"></div>').replace('비품 외 정보 수정은 군수 담당자에게','비품·피복 변경은 관리자 확인 후 반영').replace('./portal.js','./portal.js?v='+fingerprint(personalJs)).replace('./portal.css','./portal.css?v='+fingerprint(personalCss));
write('docs/me/index.html',personalHtml);write('docs/me/portal.js',personalJs);write('docs/me/portal.css',personalCss);
const assets=[['assets/app.css', css], ...['assets/pages.css','assets/pages.js','assets/updates.js','assets/navigation-start.js','config.js'].map(path => [path,readFileSync(resolve(root,'docs',path),'utf8')])];
const release={...releaseDetails,id:fingerprint(JSON.stringify([releaseDetails,js,assets,personalHtml,personalJs,personalCss]))};
write('docs/release.json',JSON.stringify(release,null,2)+'\n');
html = html.replace(/<html\b/, `<html data-app-version="${fingerprint(js)}" data-release-id="${release.id}"`);
for (const [path, contents] of assets) {
  html = html.replaceAll(`"./${path}"`, `"./${path}?v=${fingerprint(contents)}"`);
}
write('docs/index.html', assetRequestsHtml(assetPlanHtml(dormPlanHtml(roomAssetHtml(repairHtml(updateDeparturesHtml(updateNavigationHtml(updateJournalHtml(html)))))))));
write('docs/index.html',uniformRequestNavHtml(read('docs/index.html')));
write('docs/index.html',trainingShellHtml(read('docs/index.html')));
write('docs/index.html',assetInspectionHtmlV382(read('docs/index.html')));
write('docs/assets/app.css', css);
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
legacy+='\n'+dormMemberCohortsV343.toString();
legacy+='\n'+dormPlaceRoomV344.toString();
const names = [...new Set([...legacy.matchAll(/^function\s+([A-Za-z]\w*)\s*\(/gm)].map(m => m[1]))];
const frontendStrings = new Set([...js.matchAll(/['"]([A-Za-z][A-Za-z0-9]*)['"]/g)].map(m => m[1]));
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
const prefix = `/** 자동 생성: node scripts/build.mjs. 원본 Code.gs.txt를 수정한 뒤 다시 생성하세요. */
function pagesCreateLegacy_(pagesActor_) {
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
return {
 personal: function(action,input){
  if(['login','get','details','supplies','uniform'].includes(action)){pagesReadRequestV307_={};}
  if(action==='login')return personalLoginV330_(input);
  if(action==='get')return personalDashboardV330_(false);
  if(action==='details')return personalDetailsV337_();
  if(action==='supplies'||action==='uniform')return personalDetailsV337_(action);
  if(action==='assets')return personalSaveAssetsV331_(input);
  if(action==='uniform-request')return personalUniformRequestV350_(input);
  if(action==='duty-request')return personalDutyRequestV400_(input);
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
    || (Array.isArray(viewers) && viewers.some(email => String(email).trim().toLowerCase() === cfg.email));
  if (!known) pagesForbidden_();
  if (!Object.prototype.hasOwnProperty.call(pagesMethods_, name)) throw Error('지원하지 않는 API입니다: ' + name);
  const policy = accessGuardV284_(name, args);
  return accessFilterV284_(name, pagesMethods_[name].apply(null, args), policy);
 },
 training: function() { return trainingScheduledHandoffV227(); },
 survey: function(event) { return surveysOnSubmitV299(event); }
};
}
`;
write('apps-script/Legacy.gs', prefix + `\nconst navModelV301_ = ${normalizeNavigation.toString()};\n` + legacy + suffix);
write('apps-script/methods.json', JSON.stringify(uniqueMethods, null, 2) + '\n');
console.log(`화면/CSS/JS 생성, Apps Script API ${uniqueMethods.length}개 연결 완료`);

finalizeRelease();
