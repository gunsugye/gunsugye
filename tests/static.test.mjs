import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Pages 경로에 맞는 상대 URL을 사용하고 압축 부트스트랩을 제거했다', () => {
  const html = read('docs/index.html');
  assert.ok(html.includes('./assets/pages.js'));
  assert.ok(html.includes('./config.js'));
  assert.ok(!html.includes('v275JsGzip'));
  assert.ok(!html.includes('google.script.run'));
  assert.ok(!html.includes('src="/assets/'));
  for (const path of ['docs/assets/pages.js', 'docs/assets/app.js', 'docs/config.js']) new vm.Script(read(path));
});
test('설정이 없으면 로그인 안내를 보여주고 업무 화면을 실행하지 않는다', () => {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { hidden: false, textContent: '', addEventListener() {} });
    return elements.get(id);
  };
  const context = vm.createContext({ window: {}, document: { getElementById: element }, clearTimeout, setTimeout, Proxy, console });
  new vm.Script(read('docs/assets/pages.js')).runInContext(context);
  assert.match(element('pagesLoginStatus').textContent, /관리자 설정/);
});
test('Google 토큰은 저장하지 않고 서버 세션만 보관하며 URL에는 인증을 기록하지 않는다', () => {
  const adapter = read('docs/assets/pages.js');
  assert.ok(adapter.includes("token?.startsWith('session.')"));
  assert.ok(adapter.includes('JSON.stringify({token,expiresAt})'));
  assert.ok(adapter.includes("request('/session','login')"));
  assert.ok(adapter.includes("request('/logout','logout')"));
  assert.ok(!/document\.cookie|location\.hash\s*=/.test(adapter));
  assert.ok(!read('docs/config.js').includes('API_SHARED_SECRET:'));
});

test('재방문 시 저장된 세션을 서버에 확인하고 Google 팝업 없이 화면을 연다', async () => {
  const elements = new Map(), listeners = new Map(), appended = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, { hidden: false, textContent: '', addEventListener(name, fn) { listeners.set(id + name, fn); } });
    return elements.get(id);
  };
  let saved = JSON.stringify({ token: 'session.valid.signature', expiresAt: Date.now() + 86400000 });
  const requests = [];
  const context = vm.createContext({
    window: { LOGBOOK_CONFIG: { googleClientId: 'client.apps.googleusercontent.com', apiUrl: 'https://api.example' } },
    document: { getElementById: element, createElement: () => ({}), body: { appendChild: script => appended.push(script) } },
    localStorage: { getItem: () => saved, removeItem: () => { saved = null; } },
    fetch: async (url, options) => { requests.push({ url, options }); return { status: 200, ok: true, json: async () => ({ ok: true, result: { userEmail: 'owner@gmail.com' } }) }; },
    AbortSignal, Date, Proxy, console, setTimeout, clearTimeout, confirm: () => true, location: { reload() {} }
  });
  new vm.Script(read('docs/assets/pages.js')).runInContext(context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests[0].url, 'https://api.example/rpc');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer session.valid.signature');
  assert.equal(element('pagesAccount').textContent, 'owner@gmail.com');
  assert.equal(appended[0].src, './assets/app.js');
  await listeners.get('pagesLogoutclick')();
  assert.equal(requests[1].url, 'https://api.example/logout');
  assert.equal(saved, null);
});
