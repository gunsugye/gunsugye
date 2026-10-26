import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { updateJournalJs, updateJournalHtml } from './journal.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8').replace(/^\uFEFF/, '');
const write = (path, text) => { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), text, 'utf8'); };
let html = read('Index.html.txt');
const unpack = id => {
  const match = html.match(new RegExp(`<template id="${id}">([\\s\\S]*?)<\\/template>`));
  if (!match) throw new Error(`압축 원본을 찾을 수 없습니다: ${id}`);
  return gunzipSync(Buffer.from(match[1].replace(/\s/g, ''), 'base64')).toString('utf8');
};
const js = updateJournalJs(unpack('v275JsGzip')
  .replace(/const maxWait=method==='getBootstrap'\?23000:method==='pingConnectionV273'\?12000:30000;/,
    'const maxWait=90000;')
  .replace("'서버 응답 시간 초과 ('+Math.round(maxWait/1000)+'초). 시트 권한·배포 버전·Google 서버 상태를 확인하세요.'",
    "'서버 응답 시간 초과 ('+Math.round(maxWait/1000)+'초). 자동 재시도하지 않습니다. 새로고침 후 저장 결과를 확인하세요.'"));
const css = unpack('v275CssGzip');
// 원본 업무 화면은 유지하되 Apps Script 전용 압축 부트스트랩/진단 코드는 제거합니다.
html = html.replace(/<template id="v275(?:Css|Js)Gzip">[\s\S]*?<\/template>/g, '');
html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
html = html.replace('</head>', '<link rel="stylesheet" href="./assets/app.css">\n<link rel="stylesheet" href="./assets/pages.css">\n<script src="./config.js"></script>\n<script src="https://accounts.google.com/gsi/client" async defer></script>\n</head>');
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
html = html.replace('</body>', '<script src="./assets/pages.js"></script>\n</body>');
write('docs/index.html', updateJournalHtml(html));
write('docs/assets/app.css', css);
// app.js는 인증 성공 후에만 로드합니다. 원래 google.script.run 호출은 pages.js 어댑터로 연결합니다.
write('docs/assets/app.js', js);

let legacy = read('Code.gs.txt');
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
const pagesMethods_ = {${uniqueMethods.join(',')}};
return {
 call: function(name, args) {
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
write('apps-script/Legacy.gs', prefix + legacy + suffix);
write('apps-script/methods.json', JSON.stringify(uniqueMethods, null, 2) + '\n');
console.log(`화면/CSS/JS 생성, Apps Script API ${uniqueMethods.length}개 연결 완료`);
