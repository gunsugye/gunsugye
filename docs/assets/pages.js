/* Google ID 토큰은 메모리에만 보관합니다. 새로고침 시 다시 로그인합니다. */
(() => {
  'use strict';
  const config = window.LOGBOOK_CONFIG || {};
  const $ = id => document.getElementById(id);
  let token = '', expiresAt = 0, appLoaded = false, expiryTimer, authenticating = false;
  const status = message => { $('pagesLoginStatus').textContent = message; };
  function showLogin(message) {
    token = ''; expiresAt = 0; clearTimeout(expiryTimer);
    $('pagesLogin').hidden = false; $('pagesSession').hidden = true;
    if (appLoaded) {
      $('pagesGoogleButton').hidden = true;
      $('pagesRetry').hidden = false;
      $('pagesRetry').textContent = '새로고침 후 다시 로그인';
    }
    if (message) status(message);
  }
  async function call(method, args = []) {
    if (!token || Date.now() >= expiresAt) {
      showLogin('로그인 시간이 만료되었습니다. 새로고침 후 다시 로그인하세요.');
      throw Error('Google 로그인이 필요합니다.');
    }
    let response;
    try {
      response = await fetch(config.apiUrl.replace(/\/$/, '') + '/rpc', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ method, args }), cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(90000)
      });
    } catch { throw Error('서버 응답을 확인할 수 없습니다. 자동 재시도하지 않습니다. 새로고침 후 저장 결과를 확인하세요.'); }
    let body;
    try { body = await response.json(); }
    catch { throw Error('API 서버 응답 형식을 확인하세요.'); }
    if (response.status === 401) showLogin('Google 로그인이 만료되었습니다. 다시 로그인하세요.');
    if (!response.ok || !body.ok) throw Error(body.error || '요청 처리에 실패했습니다.');
    return body.result;
  }
  // 기존 화면의 콜백/체이닝 계약을 유지합니다. 사용자 객체도 지원합니다.
  function runner(success, failure, userObject) {
    return new Proxy({}, { get(_target, name) {
      if (name === 'withSuccessHandler') return fn => runner(fn, failure, userObject);
      if (name === 'withFailureHandler') return fn => runner(success, fn, userObject);
      if (name === 'withUserObject') return object => runner(success, failure, object);
      if (name === 'then' || typeof name !== 'string') return undefined;
      return (...args) => { call(name, args).then(result => success?.(result, userObject), error => failure ? failure(error, userObject) : console.error(error.message)); };
    } });
  }
  window.google = window.google || {};
  window.google.script = { run: runner() };
  $('pagesLogout').addEventListener('click', () => {
    if (!confirm('저장 중인 작업이 있다면 먼저 완료하세요. 로그아웃하시겠습니까?')) return;
    token = ''; window.google.accounts?.id.disableAutoSelect();
    location.reload();
  });
  $('pagesRetry').addEventListener('click', () => location.reload());
  async function onCredential(response) {
    if (authenticating) return;
    if (appLoaded) { location.reload(); return; } // 이전 계정 데이터와 새 계정 데이터를 섞지 않습니다.
    authenticating = true;
    status('로그인과 업무일지 접근 권한을 확인하고 있습니다.');
    try {
      // exp는 화면 타이머 용도입니다. 서명/이메일/권한의 신뢰 여부는 서버에서 검증합니다.
      const middle = response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(middle.padEnd(Math.ceil(middle.length / 4) * 4, '=')), c => c.charCodeAt(0))));
      token = response.credential; expiresAt = Number(claims.exp) * 1000;
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw Error('로그인 시간이 만료되었습니다. 다시 로그인하세요.');
      // 단순 ping이 아니라 권한과 실제 데이터 조회까지 성공해야 화면을 엽니다.
      const bootstrap = await call('getBootstrap');
      const originalCall = call;
      let firstBootstrap = bootstrap;
      // 최초 화면 로딩의 동일 조회를 한 번 재사용합니다. 이후 요청은 항상 서버로 보냅니다.
      window.google.script.run = (() => {
        const make = (success, failure, userObject) => new Proxy({}, { get(_target, name) {
          if (name === 'withSuccessHandler') return fn => make(fn, failure, userObject);
          if (name === 'withFailureHandler') return fn => make(success, fn, userObject);
          if (name === 'withUserObject') return obj => make(success, failure, obj);
          if (name === 'then' || typeof name !== 'string') return undefined;
          return (...args) => {
            let pending;
            if (firstBootstrap && ((name === 'readCompressedV282' && args[0] === 'getBootstrap') || name === 'getBootstrap')) {
              pending = Promise.resolve(firstBootstrap); firstBootstrap = null;
            } else pending = originalCall(name, args);
            pending.then(result => success?.(result, userObject), error => failure ? failure(error, userObject) : console.error(error.message));
          };
        } });
        return make();
      })();
      $('pagesAccount').textContent = bootstrap.userEmail || '로그인됨';
      $('pagesSession').hidden = false;
      const script = document.createElement('script'); script.src = './assets/app.js';
      script.onerror = () => { showLogin('화면 파일을 불러오지 못했습니다. 다시 시도하세요.'); $('pagesRetry').hidden = false; };
      script.onload = () => { $('pagesLogin').hidden = true; };
      appLoaded = true; document.body.appendChild(script);
      expiryTimer = setTimeout(() => showLogin('로그인 시간이 만료되었습니다. 작업을 계속하려면 다시 로그인하세요.'), Math.max(1, expiresAt - Date.now()));
    } catch (error) {
      showLogin(error.message || '로그인에 실패했습니다.');
    } finally { authenticating = false; }
  }
  function init(attempt = 0) {
    if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(config.googleClientId || '') || !/^https:\/\//.test(config.apiUrl || '')) {
      status('관리자 설정이 필요합니다. docs/config.js에 Google 클라이언트 ID와 API 주소를 입력하세요.'); return;
    }
    if (!window.google.accounts?.id) {
      if (attempt >= 150) { status('Google 로그인 화면을 불러오지 못했습니다. 네트워크 연결을 확인하세요.'); $('pagesRetry').hidden = false; return; }
      setTimeout(() => init(attempt + 1), 100); return;
    }
    window.google.accounts.id.initialize({ client_id: config.googleClientId, callback: onCredential, auto_select: false });
    window.google.accounts.id.renderButton($('pagesGoogleButton'), { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', locale: 'ko' });
    status('관리자에게 등록한 Google 계정으로 로그인하세요.');
  }
  init();
})();
