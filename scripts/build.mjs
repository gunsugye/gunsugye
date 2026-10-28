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
import { updateNotificationsJs } from './notifications.mjs';
import { repairJs, repairHtml, repairServer } from './repairs.mjs';
import {roomAssetJs,roomAssetHtml,roomAssetServer,roomAssetCSS} from './room-assets.mjs';
import {correctDormSource,correctDormClient} from './dorm-corrections.mjs';
import {dormPlanHtml,dormPlanClient,dormPlanCSS} from './dorm-plan.mjs';
import {laborInterfaceJs,laborInterfaceCSS} from './labor-interface.mjs';
import {assetOverviewJs} from './asset-overview.mjs';

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
js=dormPlanClient(correctDormClient(js),read('scripts/dorm-plan-client.js.txt'));
js=laborInterfaceJs(js);
js=assetOverviewJs(js);
js=js.replace('function navRenderV233(){','let wxNavigationReadyV314=false;\nfunction navRenderV233(){')
 .replace('nav.replaceChildren(frag);v284AddUtilityNav();','nav.replaceChildren(frag);v284AddUtilityNav();if(ready&&wxNavigationReadyV314&&!navEditModeV220&&!navDirtyV220)window.LOGBOOK_NAVIGATION?.commit();')
 .replace('async function wxLoadAll(){',`let wxLoadPromiseV314=null;
async function wxLoadAll(){if(wxLoadPromiseV314)return wxLoadPromiseV314;wxLoadPromiseV314=wxLoadAllInnerV314();try{return await wxLoadPromiseV314;}finally{wxLoadPromiseV314=null;}}
async function wxLoadAllInnerV314(){\n wxNavigationReadyV314=false;`)
 .replace("wxLoaded=false;wxLoadError='';if(view==='calendar')wxLoadAll();", "wxLoaded=false;wxLoadError='';wxLoadAll();")
 .replace('navTreeV233=navNormalizeV233(response.navTree);navSavedTreeV233=navDeepCopyV233(navTreeV233);navUpdateDirtyV220();navRenderV233();','navTreeV233=navNormalizeV233(response.navTree);navSavedTreeV233=navDeepCopyV233(navTreeV233);navUpdateDirtyV220();wxNavigationReadyV314=true;navRenderV233();')
 .replace("catch(e){wxLoaded=false;wxLoadError=String(e.message||e);", "catch(e){window.LOGBOOK_NAVIGATION?.commit(false);wxLoaded=false;wxLoadError=String(e.message||e);");
js=js.replace("navEditToggleV220(false);navUpdateDirtyV220();toast('메뉴", "navEditToggleV220(false);navUpdateDirtyV220();window.LOGBOOK_NAVIGATION?.commit();toast('메뉴");
const leaveGuard=js.match(/window\.addEventListener\('beforeunload',e=>\{if\((.*?)\)\{e\.preventDefault/);
if(!leaveGuard)throw Error('업데이트 적용 전 저장 상태 검사 위치를 확인하세요.');
const hook=js.lastIndexOf('})();');
js=js.slice(0,hook)+`\nwindow.logbookReloadState=()=>({dirty:!!(${leaveGuard[1]}||departuresBusyV305||settingsDirtyV258||dormPlanDraftV315||$('dormPlanRoomDialogV315')?.open)});\n`+js.slice(hook);
const css = unpack('v275CssGzip') + calendarCSS + departuresCSS + journalCSS + roomAssetCSS + dormPlanCSS + laborInterfaceCSS;
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
  <p id="pagesLoginStatus" role="status" aria-live="polite">연결 설정을 확인하고 있습니다.</p>
  <button id="pagesRetry" type="button" hidden>다시 시도</button>
 </div>
</section>
<div id="pagesSession" class="pages-session" hidden><span id="pagesAccount"></span><button id="pagesLogout" type="button">로그아웃</button></div>`);
html = html.replace('</body>', `<button type="button" id="pagesUpdateLauncher" hidden>업데이트 안내</button>
<div id="notificationDockV309" class="notification-dock"><aside class="pages-update-notice" id="pagesUpdateNotice" role="region" aria-label="새 업데이트 안내" hidden>
 <div class="pages-update-head"><strong>업데이트</strong><button id="pagesUpdateClose" type="button" aria-label="업데이트 알림 닫기">×</button></div><p>새 업데이트 사항이 있습니다</p>
 <p id="pagesUpdateVersion"></p><ul id="pagesUpdateNotes"></ul><p id="pagesUpdateHelp" role="status" aria-live="polite"></p><button id="pagesUpdateApply" type="button">확인</button>
</aside></div><script src="./assets/updates.js"></script><script src="./assets/navigation-start.js"></script><script src="./assets/pages.js"></script>\n</body>`);
// 로그인 후 동적으로 읽는 app.js도 동일한 빌드의 파일을 사용합니다.
const fingerprint = value => createHash('sha256').update(value).digest('hex').slice(0, 16);
const assets=[['assets/app.css', css], ...['assets/pages.css','assets/pages.js','assets/updates.js','assets/navigation-start.js','config.js'].map(path => [path,readFileSync(resolve(root,'docs',path),'utf8')])];
const release={...releaseDetails,id:fingerprint(JSON.stringify([releaseDetails,js,assets]))};
write('docs/release.json',JSON.stringify(release,null,2)+'\n');
html = html.replace(/<html\b/, `<html data-app-version="${fingerprint(js)}" data-release-id="${release.id}"`);
for (const [path, contents] of assets) {
  html = html.replaceAll(`"./${path}"`, `"./${path}?v=${fingerprint(contents)}"`);
}
write('docs/index.html', dormPlanHtml(roomAssetHtml(repairHtml(updateDeparturesHtml(updateNavigationHtml(updateJournalHtml(html)))))));
write('docs/assets/app.css', css);
// 저장된 세션은 화면 로딩과 서버 검증을 함께 시작하며, 업무 자료는 검증 응답 후에만 사용합니다.
write('docs/assets/app.js', js);

const privatePlan=JSON.parse(read('.deploy/dorm-plan-source.json'));
let legacy = roomAssetServer(repairServer(correctDormSource(read('Code.gs.txt'),privatePlan.correction)+'\n'+read('scripts/departures-server.gs.txt')),read('scripts/room-assets-server.gs.txt'),read('scripts/room-assets-bulk.gs.txt'));
legacy+='\n'+read('scripts/smart-inactive.gs.txt')+'\nconst DORM_PLAN_DEFAULT_V315_='+JSON.stringify(privatePlan)+';\n'+read('scripts/dorm-plan-server.gs.txt')+'\n'+read('scripts/dorm-corrections-server.gs.txt');
const names = [...new Set([...legacy.matchAll(/^function\s+([A-Za-z]\w*)\s*\(/gm)].map(m => m[1]))];
const frontendStrings = new Set([...js.matchAll(/['"]([A-Za-z][A-Za-z0-9]*)['"]/g)].map(m => m[1]));
const methods = names.filter(name => !name.endsWith('_') && frontendStrings.has(name)
  && !['doGet', 'doPost', 'setupLogbook', 'setupLiveFrontendV222', 'disableLiveFrontendV222', 'liveFrontendInfoV222', 'trainingScheduledHandoffV227', 'surveysOnSubmitV299'].includes(name));
methods.push('readCompressedV282', 'pingConnectionV273');
const uniqueMethods = [...new Set(methods)].sort();
const missing = [...js.matchAll(/server\(\s*['"]([A-Za-z][A-Za-z0-9]*)['"]/g)].map(m => m[1]).filter(name => !uniqueMethods.includes(name));
if (missing.length) throw new Error(`연결되지 않은 화면 API: ${[...new Set(missing)].join(', ')}`);
legacy = legacy.replace(/Session\.get(?:Effective|Active)User\(\)\.getEmail\(\)/g, 'pagesEmail_()');
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
