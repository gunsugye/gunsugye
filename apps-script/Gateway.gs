/** GitHub Pages 전용 진입점. 업무 함수는 Legacy.gs의 비공개 팩토리 안에 있습니다. */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'logbook-api', version: 1 }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const actor = pagesVerifyRequest_(e);
    if(actor.method==='pagesPersonalLogin'){
      if(actor.email!=='personal@portal.invalid'||actor.sub!=='personal-login'||actor.sessionId)pagesForbidden_();
      return pagesJson_({ok:true,result:pagesCreateLegacy_(actor).personal('login',actor.args[0])});
    }
    if(['pagesPersonalGet','pagesPersonalLogout'].includes(actor.method)){
      if(actor.email!=='personal@portal.invalid'||!actor.sub.startsWith('personal:'))pagesForbidden_();
      return pagesJson_({ok:true,result:pagesCreateLegacy_(actor).personal(actor.method==='pagesPersonalGet'?'get':'logout')});
    }
    if(actor.sub.startsWith('personal:')||actor.sub==='personal-login')pagesForbidden_();
    if (actor.sessionId) pagesCheckSession_(actor);
    if (actor.method === 'pagesSessionLogout') {
      if (actor.sessionId) PropertiesService.getScriptProperties().deleteProperty('PAGES_SESSION_' + actor.sessionId);
      return pagesJson_({ ok: true, result: true });
    }
    if (actor.method === 'pagesSessionCreate') {
      const bootstrap = pagesCreateLegacy_(actor).call('getBootstrap', []);
      const props = PropertiesService.getScriptProperties(), now = Date.now();
      const all = props.getProperties();
      let count = 0;
      Object.keys(all).filter(k => k.indexOf('PAGES_SESSION_') === 0).forEach(k => {
        let value; try { value = JSON.parse(all[k]); } catch (_) {}
        if (!value || value.expiresAt <= now) props.deleteProperty(k);
        else if (value.email === actor.email) count++;
      });
      if (count >= 30) throw Error('로그인한 기기가 너무 많습니다. 기존 기기에서 로그아웃하세요.');
      const sessionId = Utilities.getUuid(), expiresAt = now + 30 * 86400000;
      props.setProperty('PAGES_SESSION_' + sessionId, JSON.stringify({ email: actor.email, sub: actor.sub, expiresAt: expiresAt }));
      return pagesJson_({ ok: true, result: { bootstrap: bootstrap, sessionId: sessionId, expiresAt: expiresAt } });
    }
    const result = pagesCreateLegacy_(actor).call(actor.method, actor.args);
    return pagesJson_({ ok: true, result: result === undefined ? null : result });
  } catch (error) {
    // 스택, 토큰, 서명, 원문 요청은 응답/로그에 기록하지 않습니다.
    return pagesJson_({ ok: false, code: error.pagesCode || 'APPLICATION_ERROR', error: String(error.message || error).slice(0, 1000) });
  }
}

function pagesCheckSession_(actor) {
  let stored;
  if (/^[0-9a-f-]{36}$/.test(actor.sessionId)) {
    try { stored = JSON.parse(PropertiesService.getScriptProperties().getProperty('PAGES_SESSION_' + actor.sessionId) || 'null'); } catch (_) {}
  }
  if (!stored || stored.email !== actor.email || stored.sub !== actor.sub || stored.expiresAt <= Date.now()) {
    const error = new Error('로그인 유지 기간이 만료되었거나 로그아웃한 기기입니다. 다시 로그인하세요.');
    error.pagesCode = 'SESSION_EXPIRED'; throw error;
  }
}

function pagesJson_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function pagesForbidden_() {
  const error = new Error('접근 권한이 없거나 요청 인증에 실패했습니다.');
  error.pagesCode = 'FORBIDDEN';
  throw error;
}

function pagesVerifyRequest_(e) {
  const raw = e && e.postData && e.postData.contents;
  if (!raw || raw.length > 13 * 1024 * 1024) pagesForbidden_();
  let envelope;
  try { envelope = JSON.parse(raw); } catch (_) { pagesForbidden_(); }
  const secret = PropertiesService.getScriptProperties().getProperty('PAGES_API_SHARED_SECRET');
  if (!secret || secret.length < 32 || !envelope || typeof envelope.payload !== 'string'
      || typeof envelope.signature !== 'string' || !/^[\w-]{43}$/.test(envelope.signature)) pagesForbidden_();
  const bytes = Utilities.computeHmacSha256Signature(envelope.payload, secret, Utilities.Charset.UTF_8);
  const expected = Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
  let difference = expected.length ^ envelope.signature.length;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ envelope.signature.charCodeAt(i);
  if (difference !== 0) pagesForbidden_();
  let actor;
  try { actor = JSON.parse(envelope.payload); } catch (_) { pagesForbidden_(); }
  if (!actor || actor.version !== 1 || !Number.isFinite(actor.timestamp)
      || Math.abs(Date.now() - actor.timestamp) > 90000
      || !/^[0-9a-f-]{36}$/.test(actor.nonce || '')
      || typeof actor.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(actor.email)
      || typeof actor.sub !== 'string' || !actor.sub
      || typeof actor.method !== 'string' || !/^[A-Za-z][A-Za-z0-9]*$/.test(actor.method)
      || !Array.isArray(actor.args) || actor.args.length > 30) pagesForbidden_();
  actor.email = actor.email.trim().toLowerCase();
  // 서명된 요청도 재전송을 차단합니다. 쓰기 요청은 서버/화면 모두 자동 재시도하지 않습니다.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const cache = CacheService.getScriptCache(), key = 'pages:nonce:' + actor.nonce;
    if (cache.get(key)) pagesForbidden_();
    cache.put(key, '1', 180);
  } finally { lock.releaseLock(); }
  return actor;
}

// _로 끝나는 함수는 google.script.run에서 호출할 수 없습니다.
function pagesActorForTrigger_() {
  const email = String(PropertiesService.getScriptProperties().getProperty('LOGBOOK_OWNER_EMAIL') || '').toLowerCase();
  if (!email || Session.getEffectiveUser().getEmail().toLowerCase() !== email) pagesForbidden_();
  return { email: email, sub: 'scheduled-owner', trigger: true };
}
function pagesTrainingScheduled_() { return pagesCreateLegacy_(pagesActorForTrigger_()).training(); }
function pagesSurveySubmit_(event) { return pagesCreateLegacy_(pagesActorForTrigger_()).survey(event); }

/** Apps Script 편집기에서 소유자가 한 번 실행. 기존 트리거만 같은 대상으로 이전합니다. */
function pagesMigrateTriggers_() {
  pagesActorForTrigger_();
  const triggers = ScriptApp.getProjectTriggers();
  const moved = [];
  triggers.forEach(function(trigger) {
    const handler = trigger.getHandlerFunction();
    if (handler === 'trainingScheduledHandoffV227') {
      if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'pagesTrainingScheduled_')) {
        ScriptApp.newTrigger('pagesTrainingScheduled_').timeBased().atHour(7).everyDays(1).inTimezone('Asia/Seoul').create();
      }
      ScriptApp.deleteTrigger(trigger); moved.push(handler);
    } else if (handler === 'surveysOnSubmitV299') {
      const formId = trigger.getTriggerSourceId();
      if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'pagesSurveySubmit_' && t.getTriggerSourceId() === formId)) {
        ScriptApp.newTrigger('pagesSurveySubmit_').forForm(FormApp.openById(formId)).onFormSubmit().create();
      }
      ScriptApp.deleteTrigger(trigger); moved.push(handler);
    }
  });
  return { migrated: moved };
}
